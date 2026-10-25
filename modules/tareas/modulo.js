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
import { pantallaTareas, filaTarea, cargarEstilos, alternarHecha } from './vistas.js';
import { abrirEditor } from './editor.js';
import { sincronizarCalendario } from './calendario.js';

// En el celular, el teclado solo se abre si el foco se pide en el mismo toque.
// Como la ventana de la tarea se abre un instante después, se enfoca antes un
// campo invisible y la ventana le pasa el foco al título.
function abrirTecladoYa() {
  const i = document.createElement('input');
  i.setAttribute('aria-hidden', 'true');
  i.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.append(i);
  i.focus();
  setTimeout(() => i.remove(), 2500);
}

export default {
  id: 'tareas',
  nombre: 'Tareas',

  pantalla: pantallaTareas,

  botonesInicio(ctx) {
    return [{
      id: 'nueva-tarea', texto: 'Tarea', icono: 'mas',
      alTocar: async () => {
        abrirTecladoYa();
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
      enlace: { texto: 'Tareas ›', href: '#/tareas/hoy' },
      ancho: 'mitad',
      opciones: [
        { id: 'vencidas', texto: 'Con vencidas', defecto: true },
        { id: 'max5', texto: 'Máx. 5', defecto: true },
        { id: 'subtareas', texto: 'Con subtareas', defecto: false },
      ],
      async dibujar(contenedor, { opciones = {} } = {}) {
        cargarEstilos();
        const { h } = ctx;
        const m = crearModelo(ctx);
        const MAX = opciones.max5 === false ? Infinity : 5;

        async function pintar() {
          const d = await m.cargar();
          const pend = d.tareas.filter(t => !hecha(t) && !d.enOculto?.(t));
          const venc = ordenar(pend.filter(vencida));
          const deHoyL = ordenar(pend.filter(deHoy));
          const lista = opciones.vencidas === false ? deHoyL : [...venc, ...deHoyL];
          // Sin "Con subtareas": cada tarea sola, sin desplegar sus subtareas.
          const dd = opciones.subtareas ? d : Object.assign(Object.create(d), { hijas: () => [] });
          const sobran = lista.length - Math.min(lista.length, MAX);
          const avisoVencidas = opciones.vencidas === false && venc.length
            ? h('a', { href: '#/tareas/hoy/vencidas', class: 'tr-inicio-vencidas' }, `+ ${venc.length} tarea${venc.length > 1 ? 's' : ''} vencida${venc.length > 1 ? 's' : ''}`)
            : null;
          const pie = [
            sobran > 0 ? h('a', { href: '#/tareas/hoy', class: 'tr-link' }, `+ ${sobran} más`) : null,
            avisoVencidas,
          ].filter(Boolean);
          contenedor.replaceChildren(...[
            lista.length
              ? h('ul', { class: 'tr-lista' }, lista.slice(0, MAX).map(t => filaTarea(ctx, m, dd, t)))
              : h('p', { class: 'nota tr-inicio-nada' }, venc.length ? 'No hay tareas para hoy.' : 'No hay tareas para hoy. ', venc.length ? null : h('a', { href: '#/tareas/proximos', class: 'tr-link' }, 'Ver próximos días')),
            pie.length ? h('div', { class: 'tr-inicio-pie' }, pie) : null].filter(Boolean));
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

  // Búsqueda general: títulos y notas de las tareas.
  async buscar(texto, ctx, { coincide, fragmento }) {
    const d = await crearModelo(ctx).cargar();
    const DS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fechaTxt = (iso) => { const [a, m, dd] = iso.split('-').map(Number); const f = new Date(a, m - 1, dd); return `${DS[f.getDay()]} ${dd} ${MS[m - 1]}`; };
    const lugar = (t) => [d.area(t.areaId)?.nombre || 'Bandeja', d.proyecto(t.proyectoId)?.nombre].filter(Boolean).join(' › ');
    return d.todas.filter(t => coincide(t.titulo, t.notas, (t.etiquetas || []).join(' ')))
      .sort((a, b) => (hecha(a) ? 1 : 0) - (hecha(b) ? 1 : 0))
      .slice(0, 60)
      .map(t => {
        const frag = !coincide(t.titulo) ? fragmento(t.notas) : '';
        return {
          grupo: 'Tareas', icono: 'tareas', titulo: t.titulo,
          sub: [lugar(t), frag ? `"${frag}"` : hecha(t) ? 'hecha' : t.fecha ? fechaTxt(t.fecha) : 'sin fecha'].join(' · '),
          der: vencida(t) ? 'vencida' : '', fecha: hecha(t) ? 0 : (t.modificado || 0),
          abrir: async () => { cargarEstilos(); const m = crearModelo(ctx); const dd = await m.cargar(); const x = dd.tarea(t.id); if (x) abrirEditor(ctx, m, dd, x); },
        };
      });
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
          id: t.id, titulo: t.titulo, hora: t.hora || '', duracion: t.duracion || '', hecha: hecha(t), tipo: tipoDe(t), areaId: t.areaId || '',
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
    // Datos opcionales: titulo, notas, origen { modulo, clave, enlace } (enlace = ruta para volver, ej. a una nota).
    async 'nueva-tarea'({ fecha = '', titulo = '', notas = '', origen = null } = {}, ctx) {
      cargarEstilos();
      const m = crearModelo(ctx);
      abrirEditor(ctx, m, await m.cargar(), null, { fecha, titulo, notas, ...(origen ? { origen } : {}) });
    },

    // ── Planificador semanal (Calendario) ──
    // Completar o reabrir una tarea (con las mismas preguntas que en la lista).
    async 'tarea-completar'({ id } = {}, ctx) {
      const m = crearModelo(ctx);
      const d = await m.cargar();
      const t = d.tarea(id);
      if (!t) throw new Error('Esa tarea ya no existe.');
      cargarEstilos();
      return alternarHecha(ctx, m, d, t);
    },
    // Ponerle otra fecha (o sacársela: fecha '').
    async 'tarea-fecha'({ id, fecha = '' } = {}, ctx) {
      const m = crearModelo(ctx);
      const d = await m.cargar();
      const t = d.tarea(id);
      if (!t) throw new Error('Esa tarea ya no existe.');
      if (!fecha && t.repeticion?.tipo) throw new Error('Las tareas que se repiten necesitan una fecha.');
      await m.cambiarFecha(t, fecha);
    },
    // Lo que todavía no tiene día: Bandeja y tareas sin fecha (sin las de Sistemas).
    async 'tareas-sin-fecha'(_, ctx) {
      const m = crearModelo(ctx);
      const d = await m.cargar();
      const lugar = (t) => { const a = d.area(t.areaId), p = d.proyecto(t.proyectoId); return [a?.nombre || 'Bandeja', p?.nombre].filter(Boolean).join(' › '); };
      return d.tareas
        .filter(t => !hecha(t) && !t.fecha && !t.padreId && !d.enOculto(t) && !d.area(t.areaId)?.sistema && !d.proyecto(t.proyectoId)?.sistema)
        .sort((a, b) => (a.areaId ? 1 : 0) - (b.areaId ? 1 : 0) || (a.orden || 0) - (b.orden || 0))
        .map(t => ({ id: t.id, titulo: t.titulo, lugar: lugar(t) }));
    },
    // ── Resumen ──
    // Tareas hechas en cada período: total, por área y por día de la semana.
    async 'resumen-tareas'({ periodos = [] } = {}, ctx) {
      const d = await crearModelo(ctx).cargar();
      const aDia = (ms) => { const f = new Date(ms); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
      const veces = [];
      for (const t of d.todas) {
        if (d.area(t.areaId)?.sistema || d.proyecto(t.proyectoId)?.sistema) continue;
        const area = d.area(t.areaId)?.nombre || 'Bandeja';
        const marcas = [...(t.completadas || [])];
        if (t.ultimaCompletada && !marcas.includes(t.ultimaCompletada)) marcas.push(t.ultimaCompletada);
        if (hecha(t) && t.completada) marcas.push(t.completada);
        for (const ms of marcas) veces.push({ dia: aDia(ms), wd: new Date(ms).getDay(), area });
      }
      return periodos.map(({ desde, hasta }) => {
        const l = veces.filter(v => v.dia >= desde && v.dia <= hasta);
        const porArea = {};
        const porDia = [0, 0, 0, 0, 0, 0, 0];
        for (const v of l) { porArea[v.area] = (porArea[v.area] || 0) + 1; porDia[v.wd]++; }
        const porFecha = {};
        for (const v of l) porFecha[v.dia] = (porFecha[v.dia] || 0) + 1;
        return { hechas: l.length, porArea: Object.entries(porArea).sort((a, b) => b[1] - a[1]), porDia, porFecha };
      });
    },
    // Vencidas (sin las de sistemas, como pagos).
    async 'resumen-vencidas'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      const lugar = (t) => [d.area(t.areaId)?.nombre || 'Bandeja', d.proyecto(t.proyectoId)?.nombre].filter(Boolean).join(' › ');
      return d.tareas.filter(t => vencida(t) && !d.enOculto(t) && !d.area(t.areaId)?.sistema && !d.proyecto(t.proyectoId)?.sistema)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map(t => ({ id: t.id, titulo: t.titulo, lugar: lugar(t), fecha: t.fecha, repite: !!t.repeticion?.tipo }));
    },
    // Manda una tarea a la papelera.
    async 'tarea-borrar'({ id } = {}, ctx) {
      await crearModelo(ctx).eliminar('tareas', id);
    },
    // ── Metas (Hábitos y metas) ──
    async 'metas-proyectos'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      return d.proyectos.filter(p => !p.archivado && !p.sistema).map(p => ({ id: p.id, nombre: `${d.area(p.areaId)?.nombre || 'Bandeja'} › ${p.nombre}` }));
    },
    async 'metas-proyecto'({ proyectoId } = {}, ctx) {
      const d = await crearModelo(ctx).cargar();
      const l = d.todas.filter(t => t.proyectoId === proyectoId && !t.padreId);
      return { hechas: l.filter(hecha).length, total: l.length };
    },

    'sistema-pendientes': (datos, ctx) => crearModelo(ctx).pendientesDeSistema(String(datos?.prefijo || '')),
    'sistema-sincronizar': (datos, ctx) => crearModelo(ctx).sincronizarSistema(datos || {}),

    // App de Android: ventanita "Nueva tarea". Termina cuando se cierra.
    async 'nueva-tarea-ventana'(_, ctx) {
      cargarEstilos();
      const m = crearModelo(ctx);
      const d = await m.cargar();
      return new Promise((listo) => abrirEditor(ctx, m, d, null, {}, { alCerrar: () => listo(true) }));
    },
    // App de Android: tareas pendientes para el widget y los avisos (sin las ocultas ni los eventos).
    async 'tareas-android'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      const BANDEJA = 'Bandeja';
      const tareas = d.tareas.filter(t => !hecha(t) && !t.aviso && !d.enOculto?.(t)).slice(0, 400).map(t => ({
        id: t.id, titulo: t.titulo, area: d.area(t.areaId)?.nombre || BANDEJA, proyecto: d.proyecto(t.proyectoId)?.nombre || '',
        fecha: t.fecha || '', hora: t.hora || '', recordatorio: t.recordatorio || '',
      }));
      return { areas: [BANDEJA, ...d.areas.filter(a => !a.archivada).map(a => a.nombre)], tareas };
    },

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
