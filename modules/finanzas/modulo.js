// ─────────────────────────────────────────────────────────────
// Módulo Finanzas.
//
// Ofrece al resto de la app:
//   - Inicio: bloque "Disponible" y botón "Gasto"
//   - Resumen para el widget (a futuro)
// ─────────────────────────────────────────────────────────────

import { crearModelo, plata, mesActual } from './modelo.js';
import { pantallaFinanzas } from './vistas.js';
import { abrirMovimiento } from './formularios.js';
import { cargarEstilos } from './comun.js';

export default {
  id: 'finanzas',
  nombre: 'Finanzas',

  pantalla: pantallaFinanzas,

  botonesInicio(ctx) {
    return [{
      id: 'gasto', texto: 'Gasto', icono: 'mas',
      alTocar: async () => {
        cargarEstilos();
        const m = crearModelo(ctx);
        abrirMovimiento(ctx, m, await m.cargar(), 'gasto');
      },
    }];
  },

  bloquesInicio(ctx) {
    return [{
      id: 'disponible',
      titulo: 'Disponible',
      async dibujar(contenedor) {
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
          contenedor.replaceChildren(
            h('a', { href: '#/finanzas', class: 'fz-inicio' },
              h('span', { class: 'fz-disponible-valor num' }, plata(r.disponible)),
              h('span', { class: 'nota' }, `Gastos del mes ${plata(r.totalGastos)} · ingresos ${plata(r.totalIngresos)}`)));
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
