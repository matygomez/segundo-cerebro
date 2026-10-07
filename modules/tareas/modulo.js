// ─────────────────────────────────────────────────────────────
// Módulo Tareas.
//
// Ofrece al resto de la app:
//   - Inicio: bloque "Hoy" y botón "Nueva tarea"
//   - Captura rápida: lo que escribís llega a la Bandeja de entrada
//   - Acción "crear-tarea" para que otros módulos creen tareas
//   - Resumen para el widget (a futuro)
// ─────────────────────────────────────────────────────────────

import { crearModelo, hecha, vencida, deHoy, ordenar } from './modelo.js';
import { pantallaTareas, filaTarea, cargarEstilos } from './vistas.js';
import { abrirEditor } from './editor.js';

export default {
  id: 'tareas',
  nombre: 'Tareas',

  pantalla: pantallaTareas,

  botonesInicio(ctx) {
    return [{
      id: 'nueva-tarea', texto: 'Nueva tarea', icono: 'mas',
      alTocar: async () => {
        cargarEstilos();
        const m = crearModelo(ctx);
        abrirEditor(ctx, m, await m.cargar());
      },
    }];
  },

  bloquesInicio(ctx) {
    return [{
      id: 'hoy',
      titulo: 'Tareas de hoy',
      async dibujar(contenedor) {
        cargarEstilos();
        const { h } = ctx;
        const m = crearModelo(ctx);
        const MAX = 6;

        async function pintar() {
          const d = await m.cargar();
          const pend = d.tareas.filter(t => !hecha(t));
          const lista = [...ordenar(pend.filter(vencida)), ...ordenar(pend.filter(deHoy))];
          if (!lista.length) {
            contenedor.replaceChildren(h('p', { class: 'nota' }, 'Nada pendiente para hoy.'),
              h('a', { href: '#/tareas/proximos', class: 'tr-link' }, 'Ver próximos días'));
            return;
          }
          contenedor.replaceChildren(
            h('ul', { class: 'tr-lista' }, lista.slice(0, MAX).map(t => filaTarea(ctx, m, d, t))),
            h('a', { href: '#/tareas/hoy', class: 'tr-link' }, lista.length > MAX ? `Ver las ${lista.length} tareas` : 'Abrir Tareas'));
        }

        let espera = null;
        const quitar = ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(pintar, 60); });
        await pintar();
        return () => { quitar(); clearTimeout(espera); };
      },
    }];
  },

  async capturar(texto, ctx) {
    await crearModelo(ctx).crearTarea({ titulo: texto });
  },

  acciones: {
    // Otros módulos pueden pedir: ctx.pedir('crear-tarea', { titulo, fecha, hora, notas })
    async 'crear-tarea'(datos, ctx) {
      const { titulo, fecha = '', hora = '', notas = '' } = datos || {};
      return crearModelo(ctx).crearTarea({ titulo, fecha, hora, notas });
    },
  },

  // Un adjunto que estaba en espera ya se subió: se actualiza en su tarea.
  async archivoSubido({ pendiente, archivo }, ctx) {
    const m = crearModelo(ctx);
    const d = await m.cargar();
    for (const t of d.tareas) await m.actualizarAdjunto(t, pendiente, archivo);
  },

  async resumen(ctx) {
    const d = await crearModelo(ctx).cargar();
    const pend = d.tareas.filter(t => !hecha(t));
    return { hoy: pend.filter(deHoy).length, vencidas: pend.filter(vencida).length };
  },
};
