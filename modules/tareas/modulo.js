// ─────────────────────────────────────────────────────────────
// Módulo Tareas.
//
// Ofrece al resto de la app:
//   - Inicio: bloque "Hoy" y botón "Nueva tarea"
//   - Captura rápida: lo que escribís llega a la Bandeja de entrada
//   - Acción "crear-tarea" para que otros módulos creen tareas
//   - Resumen para el widget (a futuro)
// ─────────────────────────────────────────────────────────────

import { crearModelo, hecha, vencida, deHoy, ordenar, siguienteFecha, textoRepeticion } from './modelo.js';
import { pantallaTareas, filaTarea, cargarEstilos } from './vistas.js';
import { abrirEditor } from './editor.js';
import { sincronizarCalendario } from './calendario.js';

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

  // Google Calendar: al abrir la app, al conectar Google, al volver a la
  // app y cada 15 minutos mientras está abierta.
  alIniciar(ctx) {
    setTimeout(() => sincronizarCalendario(ctx, { forzar: true }), 1500);
    ctx.alConectarGoogle?.(() => setTimeout(() => sincronizarCalendario(ctx, { forzar: true }), 800));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizarCalendario(ctx); });
    setInterval(() => sincronizarCalendario(ctx, { forzar: true }), 15 * 60_000);
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
          const pend = d.tareas.filter(t => !hecha(t) && !d.enOculto?.(t));
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
    // Tareas automáticas de otros módulos (área Sistemas).
    // sistema-pendientes { prefijo } → claves de las tareas pendientes.
    // sistema-sincronizar { modulo, prefijo, tareas: [{ clave, titulo, fecha, inicio, hecha, aviso, notas }] }
    // Para el Calendario (solo lectura): todo lo que tiene fecha entre dos días.
    async 'calendario-items'({ desde, hasta, repetidas = true } = {}, ctx) {
      const m = crearModelo(ctx);
      const d = await m.cargar();
      const salida = [];
      const lugar = (t) => {
        const a = d.area(t.areaId), p = d.proyecto(t.proyectoId);
        return [a?.nombre || 'Bandeja', p?.nombre].filter(Boolean).join(' › ');
      };
      const tipoDe = (t) => {
        if (t.origen?.modulo === 'finanzas') return 'fin';
        if (t.origen?.modulo === 'calendario') return d.proyecto(t.proyectoId)?.sistema === 'feriados' ? 'fer' : t.aviso ? 'ev' : 'reu';
        if (t.aviso) return 'ev';
        return vencida(t) ? 'venc' : 'tarea';
      };
      for (const t of d.todas) {
        if (!t.fecha) continue;
        const base = {
          id: t.id, titulo: t.titulo, hora: t.hora || '', duracion: t.duracion || '', hecha: hecha(t), tipo: tipoDe(t),
          lugar: lugar(t), repeticion: textoRepeticion(t.repeticion), clave: t.origen?.clave || '', aviso: !!t.aviso,
        };
        if (t.fecha >= desde && t.fecha <= hasta) salida.push({ ...base, fecha: t.fecha });
        // Próximas veces de las que se repiten (más suaves en el calendario).
        if (repetidas && t.repeticion?.tipo && !hecha(t)) {
          let f = t.fecha;
          for (let i = 0; i < 400; i++) {
            f = siguienteFecha(f, t.repeticion);
            if (!f || f > hasta) break;
            if (f >= desde) salida.push({ ...base, fecha: f, tipo: 'tarea', repite: true });
          }
        }
      }
      return salida.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '99').localeCompare(b.hora || '99'));
    },
    // Abrir el detalle de una tarea (o crear una nueva con fecha) desde otro módulo.
    async 'abrir-tarea'({ id } = {}, ctx) {
      cargarEstilos();
      const m = crearModelo(ctx);
      const d = await m.cargar();
      const t = d.tarea(id);
      if (!t) throw new Error('Esa tarea ya no existe.');
      abrirEditor(ctx, m, d, t);
    },
    async 'nueva-tarea'({ fecha = '' } = {}, ctx) {
      cargarEstilos();
      const m = crearModelo(ctx);
      abrirEditor(ctx, m, await m.cargar(), null, { fecha });
    },

    'sistema-pendientes': (datos, ctx) => crearModelo(ctx).pendientesDeSistema(String(datos?.prefijo || '')),
    'sistema-sincronizar': (datos, ctx) => crearModelo(ctx).sincronizarSistema(datos || {}),

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
    const pend = d.tareas.filter(t => !hecha(t) && !d.enOculto?.(t));
    return { hoy: pend.filter(deHoy).length, vencidas: pend.filter(vencida).length };
  },
};
