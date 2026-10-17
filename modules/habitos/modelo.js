// ─────────────────────────────────────────────────────────────
// Hábitos y metas: datos y cálculos.
//
// Colecciones (en Drive: Segundo Cerebro/habitos/*.json):
//   habitos    { nombre, tipo: 'si'|'cant'|'evitar', objetivo, unidad,
//                frecuencia: { tipo: 'diario'|'dias'|'semana', dias: [0-6], veces },
//                momento: 'manana'|'tarde'|'noche', desde: 'AAAA-MM-DD',
//                orden, archivado, enEstadisticas, ordenEst }
//   registros  { habitoId, fecha: 'AAAA-MM-DD', estado: 's'|'x'|'d'|'', valor }
//              s = hecho · x = no · d = descanso (cantidad: valor, y 's' al llegar)
//   metas      { nombre, desde, fechaLimite, objetivo, unidad,
//                fuente: { tipo: 'manual'|'hitos'|'habito'|'bitacora'|'finanzas'|'tareas', … },
//                valorManual, hitos: [{ id, texto, hecho }], habitos: [ids], archivada }
//   ajustes    { clave: 'general', diasAtras, descansos: 'limite'|'libre'|'off', descansosMes, agruparHechos }
//
// Un día sin marcar dentro de los "días para marcar" queda pendiente (la
// racha está en pausa). Más viejo que eso, cuenta como no hecho.
// ─────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
export const aISO = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
export const deISO = (s) => { const [a, m, d] = String(s).split('-').map(Number); return new Date(a, m - 1, d); };
export const hoyISO = () => aISO(new Date());
export const sumarDias = (iso, n) => { const f = deISO(iso); f.setDate(f.getDate() + n); return aISO(f); };
export const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 864e5);
// Lunes de la semana de una fecha.
export const lunesDe = (iso) => { const f = deISO(iso); f.setDate(f.getDate() - ((f.getDay() + 6) % 7)); return aISO(f); };

export const MOMENTOS = [['manana', 'Mañana'], ['tarde', 'Tarde'], ['noche', 'Noche']];
export const AJUSTES_INICIALES = { diasAtras: 7, descansos: 'limite', descansosMes: 2, agruparHechos: true };
const DN = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function textoFrecuencia(h) {
  const f = h.frecuencia || { tipo: 'diario' };
  if (f.tipo === 'semana') return `${f.veces || 1} ${Number(f.veces) === 1 ? 'vez' : 'veces'} por semana`;
  if (f.tipo === 'dias') {
    const d = [...(f.dias || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    if (d.length === 5 && [1, 2, 3, 4, 5].every(x => d.includes(x))) return 'Lun a vie';
    if (d.length === 2 && d.includes(0) && d.includes(6)) return 'Fines de semana';
    return d.map(x => DN[x]).join(', ');
  }
  return '';
}

export function crearModelo(ctx) {
  const col = {
    habitos: ctx.datos('habitos'),
    registros: ctx.datos('registros'),
    metas: ctx.datos('metas'),
    ajustes: ctx.datos('ajustes'),
  };

  async function cargar() {
    const [habitosT, registros, metasT, ajustes] = await Promise.all([col.habitos.listar(), col.registros.listar(), col.metas.listar(), col.ajustes.listar()]);
    const general = ajustes.find(a => a.clave === 'general');
    const cfg = { ...AJUSTES_INICIALES, ...(general || {}) };
    const habitos = habitosT.filter(h => !h.archivado).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.creado - b.creado);
    // Un registro por hábito y día (si dos dispositivos crearon el mismo, gana el último).
    const reg = new Map();
    for (const r of registros.sort((a, b) => (a.modificado || 0) - (b.modificado || 0))) reg.set(`${r.habitoId}|${r.fecha}`, r);
    const hoy = hoyISO();

    const d = {
      cfg, cfgId: general?.id || null,
      habitos, archivados: habitosT.filter(h => h.archivado),
      metas: metasT.filter(m => !m.archivada).sort((a, b) => (a.fechaLimite || '9').localeCompare(b.fechaLimite || '9')),
      habito: (id) => habitosT.find(h => h.id === id) || null,
      registro: (hId, fecha) => reg.get(`${hId}|${fecha}`) || null,
    };

    // ¿Le toca este día?
    d.toca = (h, fecha) => {
      if (fecha < (h.desde || hoy)) return false;
      const f = h.frecuencia || { tipo: 'diario' };
      if (f.tipo === 'dias') return (f.dias || []).includes(deISO(fecha).getDay());
      return true;   // diario y "X veces por semana" se pueden hacer cualquier día
    };
    // Estado guardado de un día: 's' | 'x' | 'd' | '' (sin marcar)
    d.estado = (h, fecha) => {
      const r = d.registro(h.id, fecha);
      if (!r) return '';
      if (h.tipo === 'cant' && !r.estado) return Number(r.valor) >= Number(h.objetivo || 1) ? 's' : '';
      return r.estado || '';
    };
    d.valor = (h, fecha) => Number(d.registro(h.id, fecha)?.valor) || 0;
    const porSemana = (h) => h.frecuencia?.tipo === 'semana';
    d.hechasSemana = (h, fecha = hoy) => { const l = lunesDe(fecha); let n = 0; for (let i = 0; i < 7; i++) { const f = sumarDias(l, i); if (f <= fecha && d.estado(h, f) === 's') n++; } return n; };

    // Estado "visible" de un día pasado: con los días viejos sin marcar como no hechos.
    d.estadoEfectivo = (h, fecha) => {
      const e = d.estado(h, fecha);
      if (e) return e;
      if (!d.toca(h, fecha) || porSemana(h)) return '-';   // no tocaba
      if (fecha >= hoy) return '';
      return diasEntre(fecha, hoy) <= d.cfg.diasAtras ? 'p' : 'x';   // p = pendiente
    };

    // Días sin marcar que todavía se pueden marcar (de más nuevo a más viejo).
    d.pendientes = () => {
      const salida = [];
      for (const h of habitos) {
        if (porSemana(h)) continue;
        for (let k = 1; k <= d.cfg.diasAtras; k++) {
          const f = sumarDias(hoy, -k);
          if (d.estadoEfectivo(h, f) === 'p') salida.push({ h, fecha: f, k });
        }
      }
      return salida.sort((a, b) => a.k - b.k || (a.h.orden ?? 0) - (b.h.orden ?? 0));
    };
    d.tienePendiente = (h) => d.pendientes().some(p => p.h.id === h.id);

    // Hábitos de hoy (los que tocan hoy; los de "X por semana" hasta cumplir la semana o si ya se marcó hoy).
    d.deHoy = () => habitos.filter(h => {
      if (!d.toca(h, hoy)) return false;
      if (porSemana(h)) return d.hechasSemana(h) < Number(h.frecuencia.veces || 1) || !!d.estado(h, hoy);
      return true;
    });

    // Racha: días (o semanas) seguidos cumplidos. Los descansos no la cortan;
    // los pendientes tampoco (queda "en pausa"); hoy sin marcar no cuenta.
    d.racha = (h, hasta = hoy) => {
      if (porSemana(h)) {
        let n = 0, l = lunesDe(hasta);
        const meta = Number(h.frecuencia.veces || 1);
        if (d.hechasSemana(h, hasta) >= meta) n++;
        for (let i = 0; i < 520; i++) {
          l = sumarDias(l, -7);
          if (sumarDias(l, 6) < (h.desde || hoy)) break;
          if (d.hechasSemana(h, sumarDias(l, 6)) >= meta) n++; else break;
        }
        return n;
      }
      let n = 0;
      for (let k = 0; k < 3660; k++) {
        const f = sumarDias(hasta, -k);
        if (f < (h.desde || hoy)) break;
        const e = d.estadoEfectivo(h, f);
        if (e === 's') n++;
        else if (e === 'd' || e === '-' || e === 'p' || (k === 0 && e === '')) continue;
        else break;
      }
      return n;
    };
    d.mejorRacha = (h) => {
      if (porSemana(h)) return d.racha(h);
      let mejor = 0, n = 0;
      for (let f = h.desde || hoy; f <= hoy; f = sumarDias(f, 1)) {
        const e = d.estadoEfectivo(h, f);
        if (e === 's') { n++; mejor = Math.max(mejor, n); } else if (e === 'x') n = 0;
      }
      return mejor;
    };
    // % cumplido: hechos sobre los días que tocaban (sin descansos ni pendientes).
    d.cumplido = (h, dias = 180) => {
      let s = 0, t = 0;
      for (let k = 1; k <= dias; k++) {
        const f = sumarDias(hoy, -k);
        if (f < (h.desde || hoy)) break;
        const e = d.estadoEfectivo(h, f);
        if (e === 's') { s++; t++; } else if (e === 'x') t++;
      }
      return t ? s / t : 0;
    };
    // Descansos usados en el mes de una fecha.
    d.descansosDelMes = (fecha = hoy) => {
      const mes = fecha.slice(0, 7);
      let n = 0;
      for (const r of reg.values()) if (r.estado === 'd' && r.fecha.slice(0, 7) === mes && d.habito(r.habitoId)) n++;
      return n;
    };
    d.descansosRestantes = (fecha = hoy) => (d.cfg.descansos === 'limite' ? Math.max(0, Number(d.cfg.descansosMes || 0) - d.descansosDelMes(fecha)) : Infinity);
    d.estadisticas = () => habitos.filter(h => h.enEstadisticas !== false).sort((a, b) => (a.ordenEst ?? a.orden ?? 0) - (b.ordenEst ?? b.orden ?? 0));
    return d;
  }

  // Guarda el estado de un día (o lo borra con estado null).
  async function marcar(h, fecha, estado, valor) {
    const todos = (await col.registros.listar()).filter(r => r.habitoId === h.id && r.fecha === fecha);
    const datos = { habitoId: h.id, fecha, estado: estado || '', ...(valor !== undefined ? { valor } : {}) };
    if (estado === null && valor === undefined) { for (const r of todos) await col.registros.borrar(r.id); return; }
    if (todos.length) {
      const [primero, ...resto] = todos.sort((a, b) => (b.modificado || 0) - (a.modificado || 0));
      await col.registros.actualizar(primero.id, datos);
      for (const r of resto) await col.registros.borrar(r.id);
    } else await col.registros.crear(datos);
  }

  return {
    col, cargar, marcar,
    async crearHabito(datos) {
      const lista = await col.habitos.listar();
      return col.habitos.crear({ desde: hoyISO(), enEstadisticas: true, archivado: false, orden: lista.length ? Math.max(...lista.map(x => x.orden || 0)) + 1 : 1, ...datos });
    },
    guardarHabito: (id, datos) => col.habitos.actualizar(id, datos),
    archivarHabito: (id) => col.habitos.actualizar(id, { archivado: true }),
    async borrarHabito(id) {
      for (const r of (await col.registros.listar()).filter(x => x.habitoId === id)) await col.registros.borrar(r.id);
      await col.habitos.borrar(id);
    },
    crearMeta: (datos) => col.metas.crear({ desde: hoyISO(), archivada: false, valorManual: 0, hitos: [], habitos: [], ...datos }),
    guardarMeta: (id, datos) => col.metas.actualizar(id, datos),
    borrarMeta: (id) => col.metas.borrar(id),
    async guardarAjustes(d, cambios) {
      const datos = { ...d.cfg, ...cambios, clave: 'general' };
      delete datos.id; delete datos.creado; delete datos.modificado; delete datos.dispositivo;
      if (d.cfgId) await col.ajustes.actualizar(d.cfgId, datos); else await col.ajustes.crear(datos);
    },
  };
}

// ── Metas: cuánto llevan ──
// Devuelve { valor, objetivo, texto } pidiendo a otros módulos cuando hace falta.
export async function progresoMeta(ctx, d, meta) {
  const f = meta.fuente || { tipo: 'manual' };
  const desde = f.periodo === 'anio' ? `${new Date().getFullYear()}-01-01` : (meta.desde || hoyISO());
  const hasta = meta.fechaLimite || '9999-12-31';
  const objetivo = Number(meta.objetivo) || 0;
  const fmt = (n) => (meta.unidad === '$' ? `$ ${Math.round(n).toLocaleString('es-AR')}` : (Math.round(n * 10) / 10).toLocaleString('es-AR'));
  try {
    if (f.tipo === 'hitos') {
      const l = meta.hitos || [];
      return { valor: l.filter(x => x.hecho).length, objetivo: l.length, texto: `${l.filter(x => x.hecho).length} de ${l.length} hitos` };
    }
    if (f.tipo === 'habito') {
      const h = d.habito(f.habitoId);
      if (!h) return { valor: 0, objetivo, texto: 'El hábito ya no existe', error: true };
      let n = 0;
      for (let x = desde; x <= hasta && x <= hoyISO(); x = sumarDias(x, 1)) n += f.modo === 'cantidad' ? d.valor(h, x) : (d.estado(h, x) === 's' ? 1 : 0);
      return { valor: n, objetivo, texto: `${fmt(n)} de ${fmt(objetivo)}${meta.unidad && meta.unidad !== '$' ? ` ${meta.unidad}` : ''}` };
    }
    if (f.tipo === 'bitacora') {
      const n = Number(await ctx.pedir('metas-contar', { ...f, desde, hasta })) || 0;
      return { valor: n, objetivo, texto: `${fmt(n)} de ${fmt(objetivo)}${meta.unidad && meta.unidad !== '$' ? ` ${meta.unidad}` : ''}` };
    }
    if (f.tipo === 'finanzas') {
      const n = Number(await ctx.pedir('metas-valor', { ...f, desde, hasta })) || 0;
      return { valor: n, objetivo, texto: `$ ${Math.round(n).toLocaleString('es-AR')} de $ ${Math.round(objetivo).toLocaleString('es-AR')}`, menos: f.medida === 'gastado' };
    }
    if (f.tipo === 'tareas') {
      const r = await ctx.pedir('metas-proyecto', { proyectoId: f.proyectoId });
      return { valor: r?.hechas || 0, objetivo: r?.total || 0, texto: `${r?.hechas || 0} de ${r?.total || 0} tareas` };
    }
  } catch (e) {
    return { valor: 0, objetivo, texto: `No se pudo leer (${e.message})`, error: true };
  }
  const n = Number(meta.valorManual) || 0;
  return { valor: n, objetivo, texto: `${fmt(n)} de ${fmt(objetivo)}${meta.unidad && meta.unidad !== '$' ? ` ${meta.unidad}` : ''}` };
}

// "Vas adelantado / atrasado" según el tiempo que pasó.
export function ritmo(meta, p) {
  if (!meta.fechaLimite || !p.objetivo || p.menos) return '';
  const desde = (meta.fuente?.periodo === 'anio') ? `${new Date().getFullYear()}-01-01` : (meta.desde || hoyISO());
  const total = Math.max(1, diasEntre(desde, meta.fechaLimite));
  const pasado = Math.min(total, Math.max(0, diasEntre(desde, hoyISO())));
  const esperado = (p.objetivo * pasado) / total;
  const dif = p.valor - esperado;
  if (p.valor >= p.objetivo) return '¡Cumplida!';
  if (pasado >= total) return 'Venció la fecha';
  const u = (Math.abs(dif) >= 1 ? Math.round(Math.abs(dif)) : Math.round(Math.abs(dif) * 10) / 10).toLocaleString('es-AR');
  if (Math.abs(dif) < Math.max(0.5, p.objetivo * 0.02)) return 'Vas al ritmo justo';
  return dif > 0 ? `Vas adelantado: ${u} sobre el ritmo` : `Vas atrasado: ${u} debajo del ritmo`;
}
