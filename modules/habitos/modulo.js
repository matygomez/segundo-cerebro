// ─────────────────────────────────────────────────────────────
// Módulo Hábitos y metas.
//
// Guarda sus propios hábitos, registros (qué marcaste cada día),
// metas y ajustes. Las metas pueden leer números de otros módulos
// solo preguntando (ctx.pedir): Bitácora, Finanzas y Tareas.
//
// Rutas: #/habitos (Hoy) · /lista · /h/<id> · /metas · /est · /config
// ─────────────────────────────────────────────────────────────

import { crearModelo, hoyISO, sumarDias, lunesDe, progresoMeta, ritmo } from './modelo.js';
import { pantallaHabitos, cuadroHoy, cargarEstilos } from './vistas.js';

export default {
  id: 'habitos',
  nombre: 'Hábitos',

  bloquesInicio(ctx) {
    return [{
      id: 'hoy',
      titulo: 'Hábitos de hoy',
      enlace: { texto: 'Hábitos ›', href: '#/habitos' },
      ancho: 'mitad',
      opciones: [
        { id: 'pendientes', texto: 'Pendientes de días anteriores', defecto: true },
      ],
      async dibujar(contenedor, { opciones = {} } = {}) {
        cargarEstilos();
        const m = crearModelo(ctx);
        let turno = 0;
        const pintar = async () => {
          const mio = ++turno;
          const d = await m.cargar();
          if (mio !== turno) return;
          contenedor.replaceChildren(ctx.h('div', { class: 'hb hb-ini' }, cuadroHoy(ctx, m, d, { conPendientes: opciones.pendientes !== false, inicio: true })));
        };
        await pintar();
        let espera = null;
        const quitar = ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(pintar, 80); });
        return () => { turno++; quitar(); clearTimeout(espera); };
      },
    }];
  },

  botonesInicio(ctx) {
    return [{ id: 'nuevo', texto: 'Hábito', icono: 'mas', alTocar: () => ctx.navegar('habitos/lista/nuevo'), defecto: false }];
  },

  // Búsqueda general: hábitos y metas.
  async buscar(texto, ctx, { coincide }) {
    const d = await crearModelo(ctx).cargar();
    return [
      ...[...d.habitos, ...d.archivados].filter(h => coincide(h.nombre)).map(h => ({
        grupo: 'Hábitos', icono: 'habitos', titulo: h.nombre,
        sub: h.archivado ? 'Hábito archivado' : `Hábito · racha ${d.racha(h)}`, der: '', fecha: h.modificado,
        abrir: () => ctx.navegar(`habitos/h/${h.id}`),
      })),
      ...d.metas.filter(x => coincide(x.nombre)).map(x => ({
        grupo: 'Metas', icono: 'meta', titulo: x.nombre, sub: `Meta${x.fechaLimite ? ` · hasta el ${x.fechaLimite.split('-').reverse().join('/')}` : ''}`, der: '', fecha: x.modificado,
        abrir: () => ctx.navegar('habitos/metas'),
      })),
    ];
  },

  acciones: {
    // Para el Resumen: % cumplido de cada período, en total y por hábito.
    // dias: estado de cada día (solo si el período es de 7 días o menos).
    async 'resumen-habitos'({ periodos = [] } = {}, ctx) {
      const d = await crearModelo(ctx).cargar();
      const hoy = hoyISO();
      const calcular = (h, desde, hasta) => {
        let s = 0, t = 0;
        if (h.frecuencia?.tipo === 'semana') {
          const meta = Number(h.frecuencia.veces || 1);
          for (let l = lunesDe(desde); l <= hasta; l = sumarDias(l, 7)) {
            const dom = sumarDias(l, 6);
            if (dom < (h.desde || hoy) || l > hoy) continue;
            const hechas = Math.min(meta, d.hechasSemana(h, dom < hoy ? dom : hoy));
            s += hechas; t += dom < hoy ? meta : hechas;
          }
          return { s, t };
        }
        for (let f = desde; f <= hasta && f <= hoy; f = sumarDias(f, 1)) {
          const e = d.estadoEfectivo(h, f);
          if (e === 's') { s++; t++; } else if (e === 'x') t++;
        }
        return { s, t };
      };
      return periodos.map(({ desde, hasta }) => {
        let S = 0, T = 0;
        const corto = Math.round((new Date(hasta) - new Date(desde)) / 864e5) < 7;
        const porHabito = d.habitos.map(h => {
          const { s, t } = calcular(h, desde, hasta);
          S += s; T += t;
          const dias = corto ? Array.from({ length: 7 }, (_, i) => { const f = sumarDias(desde, i); return f > hoy ? '' : d.estadoEfectivo(h, f); }) : null;
          return { id: h.id, nombre: h.nombre, pct: t ? s / t : null, hechos: s, total: t, dias, semanal: h.frecuencia?.tipo === 'semana' ? Number(h.frecuencia.veces || 1) : 0 };
        });
        return { pct: T ? S / T : null, porHabito };
      });
    },
    // Rachas: la mejor actual y la mejor de siempre.
    async 'resumen-rachas'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      const l = d.habitos.map(h => ({ nombre: h.nombre, actual: d.racha(h), mejor: d.mejorRacha(h), semanal: h.frecuencia?.tipo === 'semana' }));
      const actual = [...l].sort((a, b) => b.actual - a.actual)[0] || null;
      const mejor = [...l].sort((a, b) => b.mejor - a.mejor)[0] || null;
      return { actual, mejor };
    },
    // Metas activas con su avance.
    async 'resumen-metas'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      return Promise.all(d.metas.map(async (x) => {
        const p = await progresoMeta(ctx, d, x);
        return { nombre: x.nombre, pct: p.objetivo ? Math.min(1, p.valor / p.objetivo) : 0, texto: p.texto, ritmo: ritmo(x, p), error: !!p.error };
      }));
    },
  },

  pantalla(contenedor, ctx, sub = []) {
    return pantallaHabitos(contenedor, ctx, sub);
  },
};
