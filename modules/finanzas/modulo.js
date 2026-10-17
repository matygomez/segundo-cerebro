// ─────────────────────────────────────────────────────────────
// Módulo Finanzas.
//
// Ofrece al resto de la app:
//   - Inicio: bloque "Disponible" y botón "Gasto"
//   - Recordatorios de pago en Tareas (área Sistemas)
//   - Resumen para el widget (a futuro)
// ─────────────────────────────────────────────────────────────

import { crearModelo, plata, mesActual } from './modelo.js';

const sumarMes = (mes) => { const [a, m] = mes.split('-').map(Number); const f = new Date(a, m, 1); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; };
import { pantallaFinanzas } from './vistas.js';
import { abrirMovimiento } from './formularios.js';
import { cargarEstilos } from './comun.js';
import { sincronizarRecordatorios, estadoRecordatorio, pagarRecordatorio } from './recordatorios.js';

export default {
  id: 'finanzas',
  nombre: 'Finanzas',

  pantalla: pantallaFinanzas,

  // Al abrir la app y cada vez que cambian los datos de Finanzas,
  // se ponen al día las tareas de recordatorio.
  alIniciar(ctx) {
    let espera = null;
    ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(() => sincronizarRecordatorios(ctx), 1200); });
    setTimeout(() => sincronizarRecordatorios(ctx), 800);
    // Una vez por hora (por si cambia el mes con la app abierta).
    setInterval(() => sincronizarRecordatorios(ctx), 3_600_000);
  },

  // Búsqueda general: movimientos (descripción, categoría, cuenta o importe).
  async buscar(texto, ctx, { coincide }) {
    const m = crearModelo(ctx);
    const d = await m.cargar();
    const MS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fechaTxt = (iso) => { const [a, mm, dd] = iso.split('-').map(Number); return `${dd} ${MS[mm - 1]}${a !== new Date().getFullYear() ? ` ${a}` : ''}`; };
    const TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', rendimiento: 'Rendimiento', prestamo: 'Préstamo' };
    const soloNumero = /^[\d.,\s$]+$/.test(texto.trim()) ? Number(texto.replace(/[^\d,]/g, '').replace(',', '.')) : null;
    return d.movimientos.filter(x => {
      const cat = x.categoriaId ? d.nombreCategoria(x.categoriaId) : '';
      const cuenta = x.cuentaId ? d.nombreCuenta(x.cuentaId) : x.creditoId ? d.nombreCredito(d.credito(x.creditoId)) : '';
      if (soloNumero) return Math.round(Number(x.importe)) === Math.round(soloNumero);
      return coincide(x.descripcion, cat, cuenta);
    }).slice(0, 60).map(x => {
      const cat = x.categoriaId ? d.nombreCategoria(x.categoriaId) : '';
      const cuenta = x.cuentaId ? d.nombreCuenta(x.cuentaId) : x.creditoId ? d.nombreCredito(d.credito(x.creditoId)) : '';
      return {
        grupo: 'Finanzas', icono: 'finanzas', titulo: x.descripcion || cat || TIPO[x.tipo] || 'Movimiento',
        sub: [TIPO[x.tipo], cat && x.descripcion ? cat : '', cuenta, fechaTxt(x.fecha)].filter(Boolean).join(' · '),
        der: `${x.tipo === 'ingreso' ? '+ ' : ''}${plata(x.importe)}`, fecha: new Date(x.fecha).getTime(),
        abrir: async () => { cargarEstilos(); const dd = await m.cargar(); const mov = dd.movimientos.find(y => y.id === x.id); if (mov) abrirMovimiento(ctx, m, dd, mov.tipo, mov); },
      };
    });
  },

  acciones: {
    // Para el Resumen: gastado, ingresado y gastos por categoría (con su presupuesto) en cada período.
    async 'resumen-finanzas'({ periodos = [] } = {}, ctx) {
      const d = await crearModelo(ctx).cargar();
      const diasMes = (mes) => { const [a, mm] = mes.split('-').map(Number); return new Date(a, mm, 0).getDate(); };
      return periodos.map(({ desde, hasta }) => {
        const porCat = new Map();
        let gastado = 0, ingresado = 0;
        const fin = hasta.slice(0, 7);
        for (let mes = desde.slice(0, 7); mes <= fin; mes = sumarMes(mes)) {
          const primero = `${mes}-01`;
          for (const g of d.gastosDelMes(mes)) {
            // Las cuotas de crédito cuentan en el mes; en una semana, solo si incluye el día 1.
            if (g.cuota ? !(primero >= desde && primero <= hasta) : (g.mov.fecha < desde || g.mov.fecha > hasta)) continue;
            const imp = Number(g.importe) || 0;
            gastado += imp;
            const cat = d.categoriaPrincipal(g.categoriaId);
            const k = cat?.id || '-';
            if (!porCat.has(k)) porCat.set(k, { nombre: cat?.nombre || 'Sin categoría', monto: 0, cat });
            porCat.get(k).monto += imp;
          }
          for (const x of d.ingresosDelMes(mes)) if (x.fecha >= desde && x.fecha <= hasta) ingresado += Number(x.importe) || 0;
        }
        // Presupuesto de cada categoría, proporcional a los días del período.
        const presupuestoDe = (cat) => {
          if (!cat || cat.id === undefined) return 0;
          let total = 0;
          for (let f = new Date(desde + 'T00:00'); ; f.setDate(f.getDate() + 1)) {
            const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
            if (iso > hasta) break;
            const mes = iso.slice(0, 7);
            total += (d.presupuesto(cat, mes) || 0) / diasMes(mes);
          }
          return Math.round(total);
        };
        const categorias = [...porCat.values()].map(x => ({ nombre: x.nombre, monto: Math.round(x.monto), presupuesto: x.cat?.presupuestos ? presupuestoDe(x.cat) : 0 }))
          .sort((a, b) => b.monto - a.monto);
        return { gastado: Math.round(gastado), ingresado: Math.round(ingresado), categorias };
      });
    },
    // ¿Está pagado lo que recuerda esta tarea?
    'recordatorio-estado': (datos, ctx) => estadoRecordatorio(ctx, datos),
    // Abre el formulario de pago con todo completo.
    'recordatorio-pagar': (datos, ctx) => pagarRecordatorio(ctx, datos),

    // Para las metas de Hábitos: cuentas y categorías que se pueden elegir.
    async 'metas-cuentas'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      const cats = d.categorias.filter(c => !c.archivada).map(c => ({ id: c.id, nombre: d.nombreCategoria(c.id), tipo: c.tipo }));
      return { cuentas: d.cuentas.filter(c => !c.archivada).map(c => ({ id: c.id, nombre: c.nombre })), categorias: cats };
    },
    // Un número para una meta: saldo de una cuenta, o lo gastado / ingresado
    // en una categoría (y sus subcategorías) entre desde y hasta.
    async 'metas-valor'({ medida = 'saldo', id = '', desde = '0000-01-01', hasta = '9999-12-31' } = {}, ctx) {
      const d = await crearModelo(ctx).cargar();
      if (medida === 'saldo') { if (!d.cuenta(id)) throw new Error('la cuenta ya no existe'); return d.saldo(id); }
      const esDe = (catId) => catId === id || d.categoria(catId)?.padreId === id;
      const hoy = mesActual();
      const fin = (hasta.slice(0, 7) < hoy ? hasta.slice(0, 7) : hoy);
      let total = 0;
      for (let mes = desde.slice(0, 7); mes <= fin; mes = sumarMes(mes)) {
        if (medida === 'gastado') {
          for (const g of d.gastosDelMes(mes)) {
            if (!esDe(g.categoriaId)) continue;
            if (!g.cuota && (g.mov.fecha < desde || g.mov.fecha > hasta)) continue;
            total += Number(g.importe) || 0;
          }
        } else {
          for (const m of d.ingresosDelMes(mes)) if (esDe(m.categoriaId) && m.fecha >= desde && m.fecha <= hasta) total += Number(m.importe) || 0;
        }
      }
      return total;
    },
  },

  botonesInicio(ctx) {
    const abrir = (tipo) => async () => {
      cargarEstilos();
      const m = crearModelo(ctx);
      abrirMovimiento(ctx, m, await m.cargar(), tipo);
    };
    return [
      { id: 'gasto', texto: 'Gasto', icono: 'mas', alTocar: abrir('gasto') },
      { id: 'ingreso', texto: 'Ingreso', icono: 'mas', alTocar: abrir('ingreso'), defecto: false },
    ];
  },

  bloquesInicio(ctx) {
    return [{
      id: 'disponible',
      titulo: 'Disponible',
      enlace: { texto: 'Finanzas ›', href: '#/finanzas' },
      ancho: 'mitad',
      opciones: [
        { id: 'barra', texto: 'Barra', defecto: true },
        { id: 'desglose', texto: 'De dónde sale', defecto: true },
      ],
      async dibujar(contenedor, { opciones = {} } = {}) {
        cargarEstilos();
        const { h } = ctx;
        const m = crearModelo(ctx);
        async function pintar() {
          const d = await m.cargar();
          if (!d.cuentas.length) {
            contenedor.replaceChildren(h('p', { class: 'nota' }, 'Configurá tus cuentas para ver tu disponible.'),
              h('a', { href: '#/finanzas/config', class: 'tr-link fz-link' }, 'Configurar Finanzas'));
            return;
          }
          const r = d.resumenMes(mesActual());
          const comprometido = Math.max(0, r.fijosPendientes) + Math.max(0, r.faltanteCredito);
          const base = Math.max(r.enCuentas, r.disponible + comprometido, 1);
          const anchoDisp = Math.max(0, Math.min(100, (r.disponible / base) * 100));
          const anchoComp = Math.max(0, Math.min(100 - anchoDisp, (comprometido / base) * 100));
          const datos = [
            ['Gastado este mes', 'Gastado', r.totalGastos, ''],
            ['Gastos fijos pendientes', 'Fijos pend.', r.fijosPendientes, ''],
            ['Falta para la tarjeta', 'Falta tarjeta', r.faltanteCredito, r.faltanteCredito > 0 ? 'rojo' : ''],
          ];
          contenedor.replaceChildren(...[
            h('a', { href: '#/finanzas', class: 'fz-ini-num' },
              h('span', { class: `fz-ini-valor num${r.disponible < 0 ? ' negativo' : ''}` }, plata(r.disponible)),
              h('span', { class: 'nota' }, 'hasta fin de mes')),
            opciones.barra !== false ? h('div', { class: 'fz-ini-barra', title: `Dorado: disponible. Oscuro: lo que ya está comprometido (fijos pendientes y tarjeta) de ${plata(r.enCuentas)} en cuentas.` },
              h('i', { style: `width:${anchoDisp}%` }), h('i', { style: `width:${anchoComp}%` })) : null,
            opciones.desglose !== false ? h('div', { class: 'fz-ini-filas' }, datos.map(([largo, , v, cl]) => h('div', {}, h('span', {}, largo), h('b', { class: `num ${cl}` }, plata(v))))) : null,
            opciones.desglose !== false ? h('div', { class: 'fz-ini-cajas' }, datos.map(([, corto, v, cl]) => h('div', {}, h('small', {}, corto), h('b', { class: `num ${cl}` }, plata(v))))) : null,
          ].filter(Boolean));
        }
        let espera = null;
        const quitar = ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(pintar, 60); });
        await pintar();
        return () => { quitar(); clearTimeout(espera); };
      },
    }];
  },

  async resumen(ctx) {
    const d = await crearModelo(ctx).cargar();
    const r = d.resumenMes(mesActual());
    return { disponible: r.disponible, gastosMes: r.totalGastos };
  },
};
