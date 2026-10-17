// ─────────────────────────────────────────────────────────────
// Módulo Finanzas.
//
// Ofrece al resto de la app:
//   - Inicio: bloque "Disponible" y botón "Gasto"
//   - Recordatorios de pago en Tareas (área Sistemas)
//   - Resumen para el widget (a futuro)
// ─────────────────────────────────────────────────────────────

import { crearModelo, plata, mesActual } from './modelo.js';
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

  acciones: {
    // ¿Está pagado lo que recuerda esta tarea?
    'recordatorio-estado': (datos, ctx) => estadoRecordatorio(ctx, datos),
    // Abre el formulario de pago con todo completo.
    'recordatorio-pagar': (datos, ctx) => pagarRecordatorio(ctx, datos),
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
