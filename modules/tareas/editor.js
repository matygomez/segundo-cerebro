// ─────────────────────────────────────────────────────────────
// Tareas: editor de una tarea (crear y modificar) y menú de opciones.
// ─────────────────────────────────────────────────────────────

import { PRIORIDADES, ESTADOS, REPETICIONES } from './modelo.js';

const nuevoIdSub = () => Math.random().toString(36).slice(2, 10);

// Reemplaza el contenido aceptando listas y salteando vacíos.
export const poner = (el, ...items) => el.replaceChildren(...items.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));

// Abre el editor. "tarea" es null para una nueva; "base" trae valores
// iniciales (por ejemplo el área o la fecha de la vista actual).
export function abrirEditor(ctx, m, d, tarea = null, base = {}) {
  const { h, icono } = ctx;
  const t = {
    titulo: '', notas: '', fecha: '', hora: '', inicio: '', prioridad: 1, estado: 'pendiente',
    repeticion: null, etiquetas: [], subtareas: [], duracion: '', recordatorio: '',
    areaId: '', proyectoId: '', seccionId: '',
    ...base, ...(tarea || {}),
  };
  let subtareas = (t.subtareas || []).map(s => ({ ...s }));

  return new Promise((listo) => {
    const opcion = (valor, texto, actual) => h('option', { value: valor, selected: String(valor) === String(actual ?? '') }, texto);

    // ── Campos ──
    const titulo = h('input', { type: 'text', class: 'tr-titulo-input', value: t.titulo, placeholder: 'Qué hay que hacer', 'aria-label': 'Título', autocomplete: 'off' });
    const notas = h('textarea', { rows: 3, placeholder: 'Notas' }, t.notas || '');
    const fecha = h('input', { type: 'date', value: t.fecha || '' });
    const hora = h('input', { type: 'time', value: t.hora || '' });

    let prioridad = Number(t.prioridad) || 1;
    const botonesPrioridad = PRIORIDADES.map(p => h('button', {
      type: 'button', class: `tr-prio-boton prio-${p.valor}`, 'aria-pressed': String(p.valor === prioridad),
      onclick: () => { prioridad = p.valor; botonesPrioridad.forEach((b, i) => b.setAttribute('aria-pressed', String(PRIORIDADES[i].valor === prioridad))); },
    }, p.nombre));

    const area = h('select', { 'aria-label': 'Área' });
    const proyecto = h('select', { 'aria-label': 'Proyecto' });
    const seccion = h('select', { 'aria-label': 'Sección' });
    function llenarUbicacion(areaId, proyectoId, seccionId) {
      poner(area, opcion('', 'Sin área', areaId),
        d.areas.filter(a => !a.archivada || a.id === areaId).map(a => opcion(a.id, a.nombre, areaId)));
      const proys = d.proyectos.filter(p => p.areaId === areaId && (!p.archivado || p.id === proyectoId));
      poner(proyecto, opcion('', 'Sin proyecto', proyectoId), proys.map(p => opcion(p.id, p.nombre, proyectoId)));
      proyecto.disabled = !areaId || !proys.length;
      const secs = d.secciones.filter(s => s.proyectoId === proyectoId);
      poner(seccion, opcion('', 'Sin sección', seccionId), secs.map(s => opcion(s.id, s.nombre, seccionId)));
      seccion.disabled = !proyectoId || !secs.length;
    }
    llenarUbicacion(t.areaId, t.proyectoId, t.seccionId);
    area.addEventListener('change', () => llenarUbicacion(area.value, '', ''));
    proyecto.addEventListener('change', () => llenarUbicacion(area.value, proyecto.value, ''));

    // ── Subtareas ──
    const listaSub = h('ul', { class: 'tr-subtareas' });
    const nuevaSub = h('input', { type: 'text', placeholder: 'Agregar subtarea', autocomplete: 'off', enterkeyhint: 'done' });
    function dibujarSub() {
      listaSub.replaceChildren(...subtareas.map(s => h('li', {},
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

    // ── Más opciones ──
    const estado = h('select', {}, ESTADOS.map(e => opcion(e.valor, e.nombre, t.estado)));
    const inicio = h('input', { type: 'date', value: t.inicio || '' });
    const repTipo = h('select', {}, REPETICIONES.map(r => opcion(r.valor, r.nombre, t.repeticion?.tipo || '')));
    const repCada = h('input', { type: 'number', min: 1, step: 1, inputmode: 'numeric', value: t.repeticion?.cada || 1, 'aria-label': 'Cada cuánto' });
    const filaCada = h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Cada cuántos'), repCada);
    const ajustarCada = () => { filaCada.hidden = !REPETICIONES.find(r => r.valor === repTipo.value)?.unidad; };
    repTipo.addEventListener('change', ajustarCada); ajustarCada();
    const etiquetas = h('input', { type: 'text', value: (t.etiquetas || []).join(', '), placeholder: 'Separadas por coma', autocomplete: 'off' });
    const duracion = h('input', { type: 'number', min: 0, step: 5, inputmode: 'numeric', value: t.duracion || '', placeholder: 'Minutos' });
    const recordatorio = h('input', { type: 'datetime-local', value: t.recordatorio || '' });

    const tieneExtras = t.estado === 'en-curso' || t.inicio || t.repeticion?.tipo || t.etiquetas?.length || t.duracion || t.recordatorio;
    const fila = (texto, ...controles) => h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, texto), ...controles);

    const error = h('p', { class: 'formulario-error', role: 'alert' });

    const form = h('form', { class: 'formulario tr-editor', novalidate: true },
      h('header', { class: 'hoja-cabecera' },
        h('h2', {}, tarea ? 'Editar tarea' : 'Nueva tarea'),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      h('div', { class: 'formulario-campos' },
        titulo,
        notas,
        h('div', { class: 'tr-dos' }, fila('Fecha', fecha), fila('Hora', hora)),
        h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Prioridad'), h('div', { class: 'tr-prio' }, botonesPrioridad)),
        h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Ubicación'), h('div', { class: 'tr-ubicacion' }, area, proyecto, seccion)),
        h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Subtareas'), listaSub,
          h('div', { class: 'tr-nueva-sub' }, nuevaSub, h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Agregar subtarea', onclick: agregarSub }, icono('mas')))),
        h('details', { class: 'tr-mas', open: !!tieneExtras },
          h('summary', {}, 'Más opciones'),
          h('div', { class: 'formulario-campos' },
            h('div', { class: 'tr-dos' }, fila('Estado', estado), fila('Fecha de inicio', inicio)),
            h('div', { class: 'tr-dos' }, fila('Repetición', repTipo), filaCada),
            fila('Etiquetas', etiquetas),
            h('div', { class: 'tr-dos' }, fila('Duración estimada', duracion), fila('Recordatorio', recordatorio)),
            h('p', { class: 'nota' }, 'El recordatorio queda guardado y visible en la tarea. El aviso en el celular llega con la versión Android.'))),
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
      const datos = {
        titulo: titulo.value, notas: notas.value.trim(), fecha: fecha.value, hora: hora.value,
        prioridad, estado: estado.value, inicio: inicio.value,
        repeticion: repTipo.value ? { tipo: repTipo.value, cada: Math.max(1, Number(repCada.value) || 1) } : null,
        etiquetas: etiquetas.value.split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean),
        subtareas: subtareas.map(s => ({ ...s, texto: s.texto.trim() })).filter(s => s.texto),
        duracion: duracion.value ? Number(duracion.value) : '',
        recordatorio: recordatorio.value,
        areaId: area.value, proyectoId: proyecto.value, seccionId: seccion.value,
      };
      try {
        if (tarea) {
          await m.guardarTarea(tarea.id, datos);
          ctx.aviso('Tarea guardada');
        } else {
          await m.crearTarea(datos);
          ctx.aviso('Tarea creada');
        }
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
      h('button', { type: 'button', class: o.peligro ? 'tr-menu-item peligro' : 'tr-menu-item', disabled: !!o.desactivado,
        onclick: () => { dlg.close(); o.accion(); } }, o.texto))));
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

