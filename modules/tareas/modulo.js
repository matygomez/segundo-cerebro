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
          // Primero y siempre: las tareas de hoy. Las vencidas, solo como aviso abajo.
          const deHoyL = ordenar(pend.filter(deHoy));
          const nVenc = pend.filter(vencida).length;
          const avisoVencidas = nVenc
            ? h('a', { href: '#/tareas/hoy/vencidas', class: 'tr-inicio-vencidas' }, `+ ${nVenc} tarea${nVenc > 1 ? 's' : ''} vencida${nVenc > 1 ? 's' : ''}`)
            : null;
          const pie = h('div', { class: 'tr-inicio-pie' }, [
            deHoyL.length > MAX ? h('a', { href: '#/tareas/hoy/hoy', class: 'tr-link' }, `Ver las ${deHoyL.length} de hoy`) : null,
            avisoVencidas,
            h('a', { href: deHoyL.length || nVenc ? '#/tareas/hoy' : '#/tareas/proximos', class: 'tr-link' }, deHoyL.length || nVenc ? 'Abrir Tareas' : 'Ver próximos días'),
          ].filter(Boolean));
          contenedor.replaceChildren(
            deHoyL.length
              ? h('ul', { class: 'tr-lista' }, deHoyL.slice(0, MAX).map(t => filaTarea(ctx, m, d, t)))
              : h('p', { class: 'nota tr-inicio-nada' }, 'No hay tareas para hoy.'),
            pie);
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
    await m.actualizarAdjuntoComentarios(pendiente, archivo);
  },

  async resumen(ctx) {
    const d = await crearModelo(ctx).cargar();
    const pend = d.tareas.filter(t => !hecha(t));
    return { hoy: pend.filter(deHoy).length, vencidas: pend.filter(vencida).length };
  },
};
