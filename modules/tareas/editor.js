// ─────────────────────────────────────────────────────────────
// Tareas: editor de una tarea (crear y modificar), menús y
// pequeños diálogos.
//
// Orden del editor: título, notas, subtareas, fecha y hora,
// ubicación, adjuntos, más opciones y comentarios.
// ─────────────────────────────────────────────────────────────

import { REPETICIONES, FECHAS_FILTRO } from './modelo.js';

const nuevoIdSub = () => Math.random().toString(36).slice(2, 10);

// Reemplaza el contenido aceptando listas y salteando vacíos.
export const poner = (el, ...items) => el.replaceChildren(...items.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));

const ICONO_CLIP = '<path d="M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7.3 7.2a6 6 0 0 0 8.5 8.5L20 14.5"/>';
const ICONO_DRIVE = '<path d="M8.5 4h7l5.5 9.5-3.5 6h-11L3 13.5Z"/><path d="M8.5 4 12 10l-3.5 6M15.5 4 12 10M3 13.5h18"/>';
function icSvg(trazo) {
  const s = document.createElement('span');
  s.className = 'icono'; s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${trazo}</svg>`;
  return s;
}

const fechaHora = (ms) => new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\./g, '');

// Abre el editor. "tarea" es null para una nueva; "base" trae valores
// iniciales (por ejemplo el área o la fecha de la vista actual).
export function abrirEditor(ctx, m, d, tarea = null, base = {}) {
  const { h, icono } = ctx;
  const t = {
    titulo: '', notas: '', fecha: '', hora: '', inicio: '',
    repeticion: null, etiquetas: [], subtareas: [], adjuntos: [], duracion: '', recordatorio: '',
    areaId: '', proyectoId: '', seccionId: '',
    ...base, ...(tarea || {}),
  };
  let subtareas = (t.subtareas || []).map(s => ({ ...s }));
  let adjuntos = (t.adjuntos || []).map(a => ({ ...a }));
  let subiendo = 0;

  return new Promise((listo) => {
    const opcion = (valor, texto, actual) => h('option', { value: valor, selected: String(valor) === String(actual ?? '') }, texto);
    const fila = (texto, ...controles) => h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, texto), ...controles);
    const bloque = (texto, ...contenido) => h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, texto), ...contenido);

    // ── Título y notas ──
    const titulo = h('input', { type: 'text', class: 'tr-titulo-input', value: t.titulo, placeholder: 'Qué hay que hacer', 'aria-label': 'Título', autocomplete: 'off' });
    const notas = h('textarea', { rows: 3, placeholder: 'Notas', 'aria-label': 'Notas' }, t.notas || '');

    // ── Subtareas ──
    const listaSub = h('ul', { class: 'tr-subtareas' });
    const nuevaSub = h('input', { type: 'text', placeholder: 'Agregar subtarea', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': 'Nueva subtarea' });
    function dibujarSub() {
      poner(listaSub, subtareas.map(s => h('li', {},
        h('input', { type: 'checkbox', checked: !!s.hecha, 'aria-label': 'Hecha', onchange: (e) => { s.hecha = e.target.checked; } }),
        h('input', { type: 'text', value: s.texto, 'aria-label': 'Subtarea', oninput: (e) => { s.texto = e.target.value; } }),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Quitar subtarea', onclick: () => { subtareas = subtareas.filter(x => x !== s); dibujarSub(); } }, icono('cerrar')))));
    }
    function agregarSub() {
      const texto = nuevaSub.value.trim();
      if (!texto) return;
      subtareas.push({ id: nuevoIdSub(), texto, hecha: false });
      nuevaSub.value = '';
      dibujarSub();
    }
    nuevaSub.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSub(); } });
    dibujarSub();

    // ── Fecha ──
    const fecha = h('input', { type: 'date', value: t.fecha || '' });
    const hora = h('input', { type: 'time', value: t.hora || '' });

    // ── Ubicación: proyecto y sección aparecen solo si hay ──
    const area = h('select', {});
    const proyecto = h('select', {});
    const seccion = h('select', {});
    const filaProyecto = fila('Proyecto', proyecto);
    const filaSeccion = fila('Sección', seccion);
    function llenarUbicacion(areaId, proyectoId, seccionId) {
      poner(area, opcion('', 'Bandeja de entrada', areaId),
        d.areas.filter(a => !a.archivada || a.id === areaId).map(a => opcion(a.id, a.nombre, areaId)));
      const proys = d.proyectos.filter(p => p.areaId === areaId && (!p.archivado || p.id === proyectoId));
      poner(proyecto, opcion('', 'Ninguno', proyectoId), proys.map(p => opcion(p.id, p.nombre, proyectoId)));
      filaProyecto.hidden = !areaId || !proys.length;
      const secs = d.secciones.filter(s => s.proyectoId === proyectoId);
      poner(seccion, opcion('', 'Ninguna', seccionId), secs.map(s => opcion(s.id, s.nombre, seccionId)));
      filaSeccion.hidden = filaProyecto.hidden || !proyectoId || !secs.length;
    }
    llenarUbicacion(t.areaId, t.proyectoId, t.seccionId);
    area.addEventListener('change', () => llenarUbicacion(area.value, '', ''));
    proyecto.addEventListener('change', () => llenarUbicacion(area.value, proyecto.value, ''));

    // ── Adjuntos ──
    const listaAdj = h('ul', { class: 'tr-adjuntos' });
    const elegirArchivo = h('input', { type: 'file', multiple: true, hidden: true });
    function dibujarAdj() {
      poner(listaAdj,
        adjuntos.map(a => h('li', {},
          icSvg(ICONO_CLIP),
          a.url
            ? h('a', { href: a.url, target: '_blank', rel: 'noopener', class: 'tr-adjunto-nombre' }, a.nombre)
            : h('span', { class: 'tr-adjunto-nombre' }, a.nombre, h('span', { class: 'nota' }, ' (se sube al volver la conexión)')),
          h('button', { type: 'button', class: 'boton-icono', 'aria-label': `Quitar ${a.nombre}`, onclick: () => { adjuntos = adjuntos.filter(x => x !== a); dibujarAdj(); } }, icono('cerrar')))),
        subiendo ? h('li', { class: 'nota' }, `Subiendo ${subiendo} archivo${subiendo > 1 ? 's' : ''}…`) : null);
    }
    elegirArchivo.addEventListener('change', async () => {
      const archivos = [...elegirArchivo.files];
      elegirArchivo.value = '';
      subiendo += archivos.length; dibujarAdj();
      for (const f of archivos) {
        try {
          adjuntos.push(await ctx.archivos.subir(f));
          if (adjuntos.at(-1).pendiente) ctx.aviso('Sin conexión: el archivo se sube solo cuando vuelva.');
        } catch (err) {
          ctx.aviso(`No se pudo subir ${f.name}: ${err.message}`);
        }
        subiendo--; dibujarAdj();
      }
    });
    async function elegirDeDrive() {
      try {
        const elegidos = await ctx.archivos.elegirDeDrive();
        for (const e of elegidos) if (!adjuntos.some(a => a.driveId === e.driveId)) adjuntos.push(e);
        dibujarAdj();
      } catch (err) {
        ctx.aviso(err.message);
      }
    }
    // Si algún adjunto en espera ya se subió, se actualiza.
    (async () => {
      let cambio = false;
      for (const [i, a] of adjuntos.entries()) {
        if (!a.pendiente) continue;
        const listoDrive = await ctx.archivos.resolver(a.pendiente);
        if (listoDrive) { adjuntos[i] = listoDrive; cambio = true; }
      }
      if (cambio) dibujarAdj();
    })();
    dibujarAdj();

    // ── Más opciones ──
    const inicio = h('input', { type: 'date', value: t.inicio || '' });
    const repTipo = h('select', {}, REPETICIONES.map(r => opcion(r.valor, r.nombre, t.repeticion?.tipo || '')));
    const repCada = h('input', { type: 'number', min: 1, step: 1, inputmode: 'numeric', value: t.repeticion?.cada || 1 });
    const filaCada = fila('Cada cuántos', repCada);
    const ajustarCada = () => { filaCada.hidden = !REPETICIONES.find(r => r.valor === repTipo.value)?.unidad; };
    repTipo.addEventListener('change', ajustarCada); ajustarCada();
    const etiquetas = h('input', { type: 'text', value: (t.etiquetas || []).join(', '), placeholder: 'Separadas por coma', autocomplete: 'off' });
    const duracion = h('input', { type: 'number', min: 0, step: 5, inputmode: 'numeric', value: t.duracion || '', placeholder: 'Minutos' });
    const recordatorio = h('input', { type: 'datetime-local', value: t.recordatorio || '' });
    const tieneExtras = t.inicio || t.repeticion?.tipo || t.etiquetas?.length || t.duracion || t.recordatorio;

    // ── Comentarios (se guardan al instante, cada uno por separado) ──
    const zonaComentarios = h('div', { class: 'tr-comentarios' });
    async function dibujarComentarios() {
      if (!tarea) {
        poner(zonaComentarios, h('p', { class: 'nota' }, 'Vas a poder comentar una vez creada la tarea.'));
        return;
      }
      const datos = await m.cargar();
      const lista = datos.comentariosDe(tarea.id);
      const nuevo = h('textarea', { rows: 2, placeholder: 'Escribí un comentario', 'aria-label': 'Nuevo comentario' });
      poner(zonaComentarios,
        lista.length ? h('ul', { class: 'tr-lista-comentarios' }, lista.map(c => h('li', {},
          h('div', { class: 'tr-comentario-cabecera' },
            h('span', { class: 'nota' }, fechaHora(c.creado), c.editado ? ' · editado' : ''),
            h('span', { class: 'tr-comentario-acciones' },
              h('button', {
                type: 'button', class: 'tr-link', onclick: async () => {
                  const r = await ctx.formulario({ titulo: 'Editar comentario', campos: [{ id: 'texto', etiqueta: 'Comentario', tipo: 'parrafo', requerido: true }] }, { texto: c.texto });
                  if (r?.texto) { await m.editarComentario(c.id, r.texto); dibujarComentarios(); }
                },
              }, 'Editar'),
              h('button', {
                type: 'button', class: 'tr-link peligro', onclick: async () => {
                  if (await ctx.confirmar('¿Borrar este comentario?', { si: 'Borrar', peligro: true })) { await m.borrarComentario(c.id); dibujarComentarios(); }
                },
              }, 'Borrar'))),
          h('p', { class: 'tr-comentario-texto' }, c.texto)))) : null,
        h('div', { class: 'tr-nuevo-comentario' }, nuevo,
          h('button', {
            type: 'button', class: 'boton', onclick: async () => {
              if (!nuevo.value.trim()) return;
              await m.comentar(tarea.id, nuevo.value);
              dibujarComentarios();
            },
          }, 'Comentar')));
    }
    dibujarComentarios();

    const error = h('p', { class: 'formulario-error', role: 'alert' });

    const form = h('form', { class: 'formulario tr-editor', novalidate: true },
      h('header', { class: 'hoja-cabecera' },
        h('h2', {}, tarea ? 'Editar tarea' : 'Nueva tarea'),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      h('div', { class: 'formulario-campos' },
        titulo,
        notas,
        bloque('Subtareas', listaSub,
          h('div', { class: 'tr-nueva-sub' }, nuevaSub, h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Agregar subtarea', onclick: agregarSub }, icono('mas')))),
        h('div', { class: 'tr-dos' }, fila('Fecha', fecha), fila('Hora', hora)),
        fila('Área', area),
        h('div', { class: 'tr-dos' }, filaProyecto, filaSeccion),
        bloque('Adjuntos', listaAdj,
          h('div', { class: 'botonera' },
            h('button', { type: 'button', class: 'boton', onclick: () => elegirArchivo.click() }, icSvg(ICONO_CLIP), 'Subir archivo'),
            h('button', { type: 'button', class: 'boton', onclick: elegirDeDrive }, icSvg(ICONO_DRIVE), 'Elegir de Drive')),
          elegirArchivo),
        h('details', { class: 'tr-mas', open: !!tieneExtras },
          h('summary', {}, 'Más opciones'),
          h('div', { class: 'formulario-campos' },
            h('div', { class: 'tr-dos' }, fila('Repetición', repTipo), filaCada),
            h('div', { class: 'tr-dos' }, fila('Fecha de inicio', inicio), fila('Duración estimada', duracion)),
            fila('Etiquetas', etiquetas),
            fila('Recordatorio', recordatorio),
            h('p', { class: 'nota' }, 'El recordatorio queda guardado y visible en la tarea. El aviso en el celular llega con la versión Android.'))),
        h('details', { class: 'tr-mas', open: true },
          h('summary', {}, 'Comentarios'),
          zonaComentarios),
      ),
      error,
      h('div', { class: 'hoja-botones tr-botones' },
        tarea ? h('button', { type: 'button', class: 'boton peligro', onclick: borrar }, 'Borrar') : null,
        h('span', { class: 'tr-espacio' }),
        h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'boton principal' }, tarea ? 'Guardar' : 'Crear tarea')));

    async function borrar() {
      if (!await ctx.confirmar(`¿Borrar "${tarea.titulo}"?`, { si: 'Borrar', peligro: true })) return;
      await m.borrarTarea(tarea.id);
      ctx.aviso('Tarea borrada');
      dlg.close();
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      agregarSub();
      if (!titulo.value.trim()) { error.textContent = 'Escribí un título.'; titulo.focus(); return; }
      if (hora.value && !fecha.value) { error.textContent = 'Para poner hora, elegí también una fecha.'; fecha.focus(); return; }
      if (repTipo.value && !fecha.value) { error.textContent = 'Para que se repita, la tarea necesita una fecha.'; fecha.focus(); return; }
      if (subiendo) { error.textContent = 'Esperá a que terminen de subirse los archivos.'; return; }
      const datos = {
        titulo: titulo.value, notas: notas.value.trim(), fecha: fecha.value, hora: hora.value, inicio: inicio.value,
        repeticion: repTipo.value ? { tipo: repTipo.value, cada: Math.max(1, Number(repCada.value) || 1) } : null,
        etiquetas: etiquetas.value.split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean),
        subtareas: subtareas.map(s => ({ ...s, texto: s.texto.trim() })).filter(s => s.texto),
        adjuntos,
        duracion: duracion.value ? Number(duracion.value) : '',
        recordatorio: recordatorio.value,
        areaId: area.value,
        proyectoId: filaProyecto.hidden ? '' : proyecto.value,
        seccionId: filaSeccion.hidden ? '' : seccion.value,
      };
      try {
        if (tarea) { await m.guardarTarea(tarea.id, datos); ctx.aviso('Tarea guardada'); }
        else { await m.crearTarea(datos); ctx.aviso('Tarea creada'); }
        dlg.close();
      } catch (err) {
        error.textContent = err.message;
      }
    });

    const dlg = h('dialog', { class: 'hoja tr-hoja' }, form);
    dlg.addEventListener('close', () => { dlg.remove(); listo(); });
    document.body.append(dlg);
    dlg.showModal();
    if (!tarea) titulo.focus();
  });
}

// Menú de opciones simple: una lista de botones en una hoja.
export function menu(ctx, titulo, opciones) {
  const { h, icono } = ctx;
  const dlg = h('dialog', { class: 'hoja' },
    h('header', { class: 'hoja-cabecera' },
      h('h2', {}, titulo),
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
    h('div', { class: 'tr-menu' }, opciones.filter(Boolean).map(o =>
      h('button', {
        type: 'button', class: o.peligro ? 'tr-menu-item peligro' : 'tr-menu-item', disabled: !!o.desactivado,
        onclick: () => { dlg.close(); o.accion(); },
      }, o.texto))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

// Pide un nombre con el motor de formularios del núcleo.
export async function pedirNombre(ctx, titulo, actual = '', textoGuardar = 'Guardar') {
  const r = await ctx.formulario({
    titulo, textoGuardar,
    campos: [{ id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true }],
  }, { nombre: actual });
  return r?.nombre?.trim() || null;
}

// Formulario de un filtro guardado (nuevo o existente).
export async function pedirFiltro(ctx, d, actual = null) {
  const ubicaciones = [{ valor: '', texto: 'Todas las áreas' }];
  for (const a of d.areas.filter(x => !x.archivada)) {
    ubicaciones.push({ valor: `a:${a.id}`, texto: a.nombre });
    for (const p of d.proyectos.filter(x => x.areaId === a.id && !x.archivado)) {
      ubicaciones.push({ valor: `p:${p.id}`, texto: `${a.nombre} / ${p.nombre}` });
    }
  }
  const previos = actual ? {
    nombre: actual.nombre, texto: actual.texto || '', fecha: actual.fecha || '', incluirHechas: !!actual.incluirHechas,
    ubicacion: actual.proyectoId ? `p:${actual.proyectoId}` : actual.areaId ? `a:${actual.areaId}` : '',
  } : null;
  const r = await ctx.formulario({
    titulo: actual ? 'Editar filtro' : 'Nuevo filtro',
    textoGuardar: actual ? 'Guardar' : 'Crear filtro',
    campos: [
      { id: 'nombre', etiqueta: 'Nombre del filtro', tipo: 'texto', requerido: true },
      { id: 'texto', etiqueta: 'Texto o #etiqueta', tipo: 'texto', ayuda: 'Por ejemplo: munición #compras' },
      { id: 'ubicacion', etiqueta: 'Área o proyecto', tipo: 'seleccion', opciones: ubicaciones, valor: '' },
      { id: 'fecha', etiqueta: 'Fecha', tipo: 'seleccion', opciones: FECHAS_FILTRO, valor: '' },
      { id: 'incluirHechas', etiqueta: 'Incluir tareas hechas', tipo: 'casilla' },
    ],
  }, previos);
  if (!r) return null;
  const proyectoId = r.ubicacion.startsWith('p:') ? r.ubicacion.slice(2) : '';
  const areaId = r.ubicacion.startsWith('a:') ? r.ubicacion.slice(2) : (proyectoId ? d.proyecto(proyectoId)?.areaId || '' : '');
  return { nombre: r.nombre, texto: r.texto, areaId, proyectoId, fecha: r.fecha, incluirHechas: r.incluirHechas };
}
