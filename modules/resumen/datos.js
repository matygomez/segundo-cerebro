// ─────────────────────────────────────────────────────────────
// Resumen: fechas, períodos y lo que se le pide a cada módulo.
//
// No guarda datos de otros módulos: los pide cada vez con ctx.pedir.
// Solo guarda sus revisiones (lo que escribís y si ya la viste):
//   revisiones { tipo: 'semana' | 'mes' | 'dia', clave: 'AAAA-MM-DD' (lunes o el día) | 'AAAA-MM',
//                bien, trabo, foco, llevo, cambio, hecha, vista, noticias (solo 'dia') }
//   ajustes    { hora, lugar, intereses, sugeridos, descartados }  (uno solo; ver dia.js)
// ─────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
export const aISO = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
export const deISO = (s) => { const [a, m, d] = String(s).split('-').map(Number); return new Date(a, m - 1, d || 1); };
export const hoyISO = () => aISO(new Date());
export const sumarDias = (iso, n) => { const f = deISO(iso); f.setDate(f.getDate() + n); return aISO(f); };
export const lunesDe = (iso) => { const f = deISO(iso); f.setDate(f.getDate() - ((f.getDay() + 6) % 7)); return aISO(f); };
export const sumarMeses = (mes, n) => { const [a, m] = mes.split('-').map(Number); const f = new Date(a, m - 1 + n, 1); return `${f.getFullYear()}-${pad(f.getMonth() + 1)}`; };
export const finDeMes = (mes) => { const [a, m] = mes.split('-').map(Number); return `${mes}-${pad(new Date(a, m, 0).getDate())}`; };
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const plata = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;

// La semana que toca revisar: el domingo, la que termina; si no, la anterior.
export const semanaARevisar = () => { const hoy = hoyISO(); return deISO(hoy).getDay() === 0 ? lunesDe(hoy) : sumarDias(lunesDe(hoy), -7); };
// El mes que toca revisar: el anterior.
export const mesARevisar = () => sumarMeses(hoyISO().slice(0, 7), -1);

export function textoSemana(lunes, { corto = false } = {}) {
  const a = deISO(lunes), b = deISO(sumarDias(lunes, 6));
  const m = corto ? MES_CORTO : MESES;
  return a.getMonth() === b.getMonth() ? `${a.getDate()} al ${b.getDate()} de ${m[b.getMonth()]}` : `${a.getDate()} de ${m[a.getMonth()]} al ${b.getDate()} de ${m[b.getMonth()]}`;
}
export const textoMes = (mes) => { const [a, m] = mes.split('-').map(Number); return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${a}`; };

// Pide algo a otro módulo; si no está o falla, devuelve "porDefecto".
export async function pedirSeguro(ctx, accion, datos, porDefecto = null) {
  try { return (await ctx.existeAccion(accion)) ? await ctx.pedir(accion, datos) : porDefecto; } catch (e) { console.warn(accion, e); return porDefecto; }
}

// Todo junto para una lista de períodos: [{ tareas, habitos, finanzas, bitacora }]
export async function numeros(ctx, periodos) {
  const [t, h, f, b] = await Promise.all([
    pedirSeguro(ctx, 'resumen-tareas', { periodos }),
    pedirSeguro(ctx, 'resumen-habitos', { periodos }),
    pedirSeguro(ctx, 'resumen-finanzas', { periodos }),
    pedirSeguro(ctx, 'resumen-bitacora', { periodos }),
  ]);
  return periodos.map((p, i) => ({ ...p, tareas: t?.[i] || null, habitos: h?.[i] || null, finanzas: f?.[i] || null, bitacora: b?.[i] || null }));
}

export function crearModelo(ctx) {
  const col = ctx.datos('revisiones');
  async function leer(tipo, clave) {
    const l = (await col.listar()).filter(r => r.tipo === tipo && r.clave === clave).sort((a, b) => (b.modificado || 0) - (a.modificado || 0));
    return l[0] || null;
  }
  return {
    leer,
    async guardar(tipo, clave, cambios) {
      const r = await leer(tipo, clave);
      if (r) await col.actualizar(r.id, cambios);
      else await col.crear({ tipo, clave, ...cambios });
    },
    // ¿Hay que avisar en el Inicio? Devuelve [{ tipo, clave }]
    async pendientes({ horaDia } = {}) {
      const todas = await col.listar();
      const visto = (tipo, clave) => todas.some(r => r.tipo === tipo && r.clave === clave && (r.vista || r.hecha));
      const salida = [];
      const s = semanaARevisar(), m = mesARevisar();
      // Del menos frecuente (más importante) al diario.
      if (!visto('mes', m)) salida.push({ tipo: 'mes', clave: m });
      if (!visto('semana', s)) salida.push({ tipo: 'semana', clave: s });
      const hoy = hoyISO(), f = new Date();
      const ahora = `${pad(f.getHours())}:${pad(f.getMinutes())}`;
      if (ahora >= (horaDia || '05:00') && !todas.some(r => r.tipo === 'dia' && r.clave === hoy && r.vista)) salida.push({ tipo: 'dia', clave: hoy });
      return salida;
    },
  };
}
