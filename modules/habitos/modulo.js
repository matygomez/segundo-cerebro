// ─────────────────────────────────────────────────────────────
// Módulo Hábitos y metas.
//
// Guarda sus propios hábitos, registros (qué marcaste cada día),
// metas y ajustes. Las metas pueden leer números de otros módulos
// solo preguntando (ctx.pedir): Bitácora, Finanzas y Tareas.
//
// Rutas: #/habitos (Hoy) · /lista · /h/<id> · /metas · /est · /config
// ─────────────────────────────────────────────────────────────

import { crearModelo } from './modelo.js';
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

  pantalla(contenedor, ctx, sub = []) {
    return pantallaHabitos(contenedor, ctx, sub);
  },
};
