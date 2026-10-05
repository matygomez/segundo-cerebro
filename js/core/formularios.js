// ─────────────────────────────────────────────────────────────
// Motor de formularios.
//
// Un formulario se describe con datos, no con código:
//
// {
//   titulo: 'Nueva tarea',
//   textoGuardar: 'Crear tarea',
//   campos: [
//     { id: 'titulo', etiqueta: 'Título', tipo: 'texto', requerido: true },
//     { id: 'fecha',  etiqueta: 'Fecha',  tipo: 'fecha', valor: 'hoy' },
//     { id: 'prioridad', etiqueta: 'Prioridad', tipo: 'seleccion',
//       opciones: ['Normal', 'Alta', 'Urgente'], valor: 'Normal' },
//   ]
// }
//
// Tipos: texto, parrafo, numero, fecha, hora, seleccion, casilla.
// abrirFormulario() devuelve los valores, o null si se canceló.
// Más adelante, el editor de formularios va a guardar estas
// descripciones en Drive para que los crees desde la app.
// ─────────────────────────────────────────────────────────────

import { h, icono } from './ui.js';

const TIPOS = ['texto', 'parrafo', 'numero', 'fecha', 'hora', 'seleccion', 'casilla'];

function hoyISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function valorInicial(campo, previos) {
  if (previos && campo.id in previos) return previos[campo.id];
  if (campo.valor === 'hoy' && campo.tipo === 'fecha') return hoyISO();
  return campo.valor ?? (campo.tipo === 'casilla' ? false : '');
}

function control(campo, valor) {
  const id = `campo-${campo.id}`;
  const comun = { id, name: campo.id, required: !!campo.requerido };
  switch (campo.tipo) {
    case 'parrafo':
      return h('textarea', { ...comun, rows: 4, placeholder: campo.ayuda || '' }, valor);
    case 'numero':
      return h('input', { ...comun, type: 'number', inputmode: 'decimal', step: 'any', value: valor });
    case 'fecha':
      return h('input', { ...comun, type: 'date', value: valor });
    case 'hora':
      return h('input', { ...comun, type: 'time', value: valor });
    case 'seleccion': {
      const sel = h('select', comun,
        campo.requerido ? null : h('option', { value: '' }, '—'),
        (campo.opciones || []).map(o => h('option', { value: o }, o)));
      sel.value = valor;
      return sel;
    }
    case 'casilla':
      return h('input', { ...comun, type: 'checkbox', checked: !!valor });
    default:
      return h('input', { ...comun, type: 'text', value: valor, placeholder: campo.ayuda || '', autocomplete: 'off' });
  }
}

export function validarDefinicion(def) {
  if (!def || !Array.isArray(def.campos) || !def.campos.length) throw new Error('El formulario no tiene campos');
  const ids = new Set();
  for (const c of def.campos) {
    if (!c.id || ids.has(c.id)) throw new Error(`Campo sin id o repetido: "${c.id}"`);
    if (!TIPOS.includes(c.tipo || 'texto')) throw new Error(`Tipo de campo desconocido: "${c.tipo}"`);
    ids.add(c.id);
  }
}

export function abrirFormulario(def, previos = null) {
  validarDefinicion(def);
  return new Promise((ok) => {
    let resultado = null;
    const filas = def.campos.map(campo => {
      const c = control({ tipo: 'texto', ...campo }, valorInicial(campo, previos));
      const esCasilla = campo.tipo === 'casilla';
      return h('label', { class: esCasilla ? 'fila-campo casilla' : 'fila-campo', for: c.id },
        esCasilla ? c : null,
        h('span', { class: 'etiqueta-campo' }, campo.etiqueta || campo.id, campo.requerido ? h('span', { class: 'requerido', title: 'Obligatorio' }, ' *') : null),
        esCasilla ? null : c);
    });

    const form = h('form', { class: 'formulario', method: 'dialog', novalidate: true },
      h('header', { class: 'hoja-cabecera' },
        h('h2', {}, def.titulo || 'Formulario'),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      h('div', { class: 'formulario-campos' }, filas),
      h('p', { class: 'formulario-error', role: 'alert' }),
      h('div', { class: 'hoja-botones' },
        h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'boton principal' }, def.textoGuardar || 'Guardar')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const faltan = def.campos.filter(c => c.requerido && c.tipo !== 'casilla' && !String(form.elements[c.id].value).trim());
      if (faltan.length) {
        form.querySelector('.formulario-error').textContent = `Completá: ${faltan.map(c => c.etiqueta || c.id).join(', ')}.`;
        form.elements[faltan[0].id].focus();
        return;
      }
      resultado = {};
      for (const c of def.campos) {
        const el = form.elements[c.id];
        if (c.tipo === 'casilla') resultado[c.id] = el.checked;
        else if (c.tipo === 'numero') resultado[c.id] = el.value === '' ? null : Number(el.value);
        else resultado[c.id] = el.value.trim();
      }
      dlg.close();
    });

    const dlg = h('dialog', { class: 'hoja' }, form);
    dlg.addEventListener('close', () => { dlg.remove(); ok(resultado); });
    document.body.append(dlg);
    dlg.showModal();
    form.querySelector('input:not([type=checkbox]), textarea, select')?.focus();
  });
}
