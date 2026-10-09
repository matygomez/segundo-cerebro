// ─────────────────────────────────────────────────────────────
// Finanzas: piezas de interfaz compartidas por las pantallas.
// ─────────────────────────────────────────────────────────────

import { plata } from './modelo.js';

export const poner = (el, ...items) => el.replaceChildren(...items.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));

const TRAZOS = {
  menos: '<path d="M6 12h12"/>',
  mas: '<path d="M12 6v12M6 12h12"/>',
  transferir: '<path d="M5 8h13"/><path d="m15 5 3 3-3 3"/><path d="M19 16H6"/><path d="m9 13-3 3 3 3"/>',
  engranaje: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  asa: '<circle cx="9" cy="6.5" r="1.2"/><circle cx="15" cy="6.5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="17.5" r="1.2"/><circle cx="15" cy="17.5" r="1.2"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  izquierda: '<path d="m15 6-6 6 6 6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.5"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  papelera: '<path d="M5 7h14"/><path d="M10 7V5h4v2"/><path d="M7 7l1 12h8l1-12"/><path d="M10.5 10.5v5M13.5 10.5v5"/>',
  tabla: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9"/>',
};

export function ic(nombre) {
  const s = document.createElement('span');
  s.className = 'icono';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre]}</svg>`;
  return s;
}

export function cargarEstilos() {
  if (document.getElementById('estilos-finanzas')) return;
  const l = document.createElement('link');
  l.id = 'estilos-finanzas';
  l.rel = 'stylesheet';
  l.href = new URL('./finanzas.css', import.meta.url).href;
  document.head.append(l);
}

// Campo con etiqueta.
export function campo(ctx, etiqueta, control, ayuda = null) {
  const { h } = ctx;
  return h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, etiqueta), control, ayuda ? h('span', { class: 'nota' }, ayuda) : null);
}

export function inputImporte(ctx, valor = '', placeholder = '$ 0') {
  return ctx.h('input', { type: 'number', inputmode: 'decimal', step: '0.01', min: '0', class: 'fz-importe', value: valor, placeholder, 'aria-label': 'Importe' });
}

// Hoja de formulario genérica. alGuardar devuelve un texto de error o nada.
export function hoja(ctx, { titulo, cuerpo, textoGuardar = 'Guardar', alGuardar, extraBotones = null, ancho = '', sinCancelar = false }) {
  const { h, icono } = ctx;
  return new Promise((listo) => {
    const error = h('p', { class: 'formulario-error', role: 'alert' });
    const guardar = h('button', { type: 'submit', class: 'boton principal' }, textoGuardar);
    const form = h('form', { class: 'formulario fz-form', novalidate: true },
      h('header', { class: 'hoja-cabecera' }, h('h2', {}, titulo),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      h('div', { class: 'formulario-campos' }, cuerpo),
      error,
      h('div', { class: 'hoja-botones fz-botones' }, extraBotones, h('span', { class: 'fz-espacio' }),
        sinCancelar ? null : h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, alGuardar ? 'Cancelar' : 'Cerrar'),
        alGuardar ? guardar : null));
    let resultado = null;
    form.addEventListener('input', () => { error.textContent = ''; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!alGuardar) return;
      guardar.disabled = true;
      try {
        const r = await alGuardar();
        if (typeof r === 'string') { error.textContent = r; return; }
        resultado = r ?? true;
        dlg.close();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        guardar.disabled = false;
      }
    });
    const dlg = h('dialog', { class: `hoja fz-hoja ${ancho}` }, form);
    dlg.addEventListener('close', () => { dlg.remove(); listo(resultado); });
    document.body.append(dlg);
    dlg.showModal();
    form.querySelector('input:not([type=hidden]):not([type=checkbox]), select')?.focus();
  });
}

// Hoja solo de lectura (explicaciones, listas).
export function hojaInfo(ctx, titulo, contenido) {
  return hoja(ctx, { titulo, cuerpo: contenido, alGuardar: null });
}

// ── Selectores ──

// Lista con títulos: cuentas, reservas, inversiones y (opcional) crédito.
// Los valores son 'c:<id>' para cuentas y 't:<id>' para crédito.
export function selectCuentas(ctx, d, { tipos = ['cuenta', 'reserva', 'inversion'], creditos = false, pagarCredito = false, valor = '', vacio = null, yaHecho = null } = {}) {
  const { h } = ctx;
  const grupos = { cuenta: 'Cuentas', reserva: 'Reservas', inversion: 'Inversiones' };
  const op = (v, t) => h('option', { value: v, selected: v === valor }, t);
  return h('select', {},
    vacio ? op('', vacio) : null,
    tipos.map(tp => {
      const lista = d.cuentasActivas(tp);
      return lista.length ? h('optgroup', { label: grupos[tp] }, lista.map(c => op(`c:${c.id}`, c.nombre))) : null;
    }),
    creditos && d.creditosActivos().length ? h('optgroup', { label: pagarCredito ? 'Pagar crédito' : 'Crédito' }, d.creditosActivos().map(c => op(`t:${c.id}`, d.nombreCredito(c)))) : null,
    // Para cargar algo de antes, sin mover ninguna cuenta.
    yaHecho ? h('optgroup', { label: 'Ajustes' }, op('y:', yaHecho)) : null);
}

// Campo de categoría con buscador: se escribe y la lista se filtra.
// ↑ ↓ para moverse, Enter o Tab para elegir, Esc para cerrar.
// El botón ▾ (o tocar el campo) muestra la lista completa.
// Devuelve { elemento, valor(), fijar(id) }.
const sinAcentos = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function selectorCategoria(ctx, d, tipos, valor = '') {
  const { h } = ctx;
  let actual = valor;
  let opciones = [];
  let activa = 0;
  const TITULOS = { fijo: 'Gastos fijos', variable: 'Gastos variables', ingreso: 'Ingresos' };

  // Todas las opciones posibles, en el orden de Configurar.
  const todas = [];
  for (const tp of tipos) {
    const cats = d.categoriasDe(tp);
    const grupos = tp === 'fijo' ? [['familia', 'Familia'], ['personal', 'Personal']] : [[null, null]];
    for (const [clave, sub] of grupos) {
      const lista = clave ? cats.filter(c => (c.grupoFijo === 'personal' ? 'personal' : 'familia') === clave) : cats;
      const grupo = sub ? `${TITULOS[tp]} · ${sub}` : TITULOS[tp];
      for (const c of lista) {
        todas.push({ id: c.id, grupo, texto: c.nombre, padre: '' });
        for (const s of d.subcategorias(c.id)) todas.push({ id: s.id, grupo, texto: s.nombre, padre: c.nombre });
      }
    }
  }

  const input = h('input', {
    type: 'text', class: 'fz-combo-input', role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list',
    placeholder: 'Escribí para buscar', autocomplete: 'off', spellcheck: 'false',
  });
  const lista = h('div', { class: 'fz-combo-lista', role: 'listbox', hidden: true });
  const abrir = h('button', { type: 'button', class: 'fz-combo-abrir', 'aria-label': 'Ver todas las categorías', tabindex: '-1' }, ic('abajo'));
  const elemento = h('div', { class: 'fz-combo' }, input, abrir, lista);

  const textoDe = (id) => (id ? d.nombreCategoria(id) : '');
  input.value = textoDe(actual);

  function marcarTexto(texto, q) {
    if (!q) return texto;
    const i = sinAcentos(texto).indexOf(sinAcentos(q));
    if (i < 0) return texto;
    return [texto.slice(0, i), h('mark', {}, texto.slice(i, i + q.length)), texto.slice(i + q.length)];
  }

  function mostrar(todo) {
    const q = todo ? '' : input.value.trim();
    const nq = sinAcentos(q);
    opciones = todas.filter(o => !nq || sinAcentos(`${o.padre} ${o.texto}`).includes(nq));
    activa = Math.max(0, opciones.findIndex(o => o.id === actual && todo));
    const hijos = [];
    let grupo = '';
    opciones.forEach((o, i) => {
      if (o.grupo !== grupo) { hijos.push(h('div', { class: 'fz-combo-grupo' }, o.grupo)); grupo = o.grupo; }
      hijos.push(h('div', { class: `fz-combo-op${i === activa ? ' activa' : ''}${o.padre ? ' sub' : ''}`, role: 'option', 'data-i': i },
        o.padre ? h('span', { class: 'nota' }, marcarTexto(o.padre, q), ' › ') : null, marcarTexto(o.texto, q)));
    });
    if (!todas.length) hijos.push(h('p', { class: 'nota fz-combo-vacio' }, 'Todavía no hay categorías. Crealas desde Configurar Finanzas (⚙).'));
    else if (!opciones.length) hijos.push(h('p', { class: 'nota fz-combo-vacio' }, 'No hay categorías con ese nombre.'));
    poner(lista, hijos);
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    lista.querySelector('.activa')?.scrollIntoView({ block: 'nearest' });
  }
  function cerrar() { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  function marcar() {
    lista.querySelectorAll('.fz-combo-op').forEach(o => o.classList.toggle('activa', Number(o.dataset.i) === activa));
    lista.querySelector('.activa')?.scrollIntoView({ block: 'nearest' });
  }
  function elegir(i) {
    const o = opciones[i];
    if (!o) return false;
    actual = o.id;
    input.value = textoDe(o.id);
    cerrar();
    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  input.addEventListener('input', (e) => {
    if (e.target !== input) return;
    actual = '';            // al escribir, hay que volver a elegir
    mostrar(false);
  });
  input.addEventListener('click', () => { if (lista.hidden) mostrar(!input.value || !!actual); });
  input.addEventListener('keydown', (e) => {
    if (lista.hidden) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mostrar(!!actual); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); activa = Math.min(activa + 1, opciones.length - 1); marcar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activa = Math.max(activa - 1, 0); marcar(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); elegir(activa); }
    else if (e.key === 'Tab') { if (input.value.trim() && !actual) elegir(activa); else cerrar(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
  });
  input.addEventListener('blur', () => setTimeout(() => {
    if (elemento.contains(document.activeElement)) return;
    cerrar();
    if (!actual) {
      // Si lo escrito coincide exacto con una categoría, se toma.
      const exacta = todas.find(o => sinAcentos(textoDe(o.id)) === sinAcentos(input.value.trim()));
      if (exacta) { actual = exacta.id; input.value = textoDe(exacta.id); }
    }
  }, 150));
  lista.addEventListener('mousedown', (e) => {
    const op = e.target.closest('.fz-combo-op');
    if (!op) return;
    e.preventDefault();
    elegir(Number(op.dataset.i));
  });
  abrir.addEventListener('click', () => { if (lista.hidden) { mostrar(true); input.focus(); } else cerrar(); });

  return {
    elemento,
    valor: () => actual,
    fijar: (id) => { actual = id; input.value = textoDe(id); cerrar(); },
  };
}

// Ordenar arrastrando la manija (⋮⋮). Se mueve el hijo directo de la lista
// (.fz-lista-ord) más cercana a la manija, así nada sale de su lista.
// Al soltar llama a alSoltar(lista, ids en el nuevo orden).
export function hacerOrdenable(raiz, alSoltar) {
  raiz.addEventListener('pointerdown', (e) => {
    const asa = e.target.closest('.fz-asa-ord');
    if (!asa || e.button > 0) return;
    const lista = asa.closest('.fz-lista-ord');
    if (!lista) return;
    e.preventDefault();
    let mov = asa;
    while (mov.parentElement !== lista) mov = mov.parentElement;
    const antes = [...lista.children].map(x => x.dataset.id).join();
    mov.classList.add('fz-moviendo');
    const mover = (ev) => {
      for (const otro of [...lista.children]) {
        if (otro === mov) continue;
        const r = otro.getBoundingClientRect();
        if (ev.clientY > r.top && ev.clientY < r.bottom) {
          if (ev.clientY < r.top + r.height / 2) otro.before(mov); else otro.after(mov);
          break;
        }
      }
      if (ev.clientY < 70) window.scrollBy(0, -12);
      if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      mov.classList.remove('fz-moviendo');
      const ids = [...lista.children].map(x => x.dataset.id).filter(Boolean);
      if (ids.join() !== antes) alSoltar(lista, ids);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  });
  // Teclado: flechas sobre la manija.
  raiz.addEventListener('keydown', (e) => {
    const asa = e.target.closest('.fz-asa-ord');
    if (!asa || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const lista = asa.closest('.fz-lista-ord');
    let mov = asa;
    while (mov.parentElement !== lista) mov = mov.parentElement;
    const otro = e.key === 'ArrowUp' ? mov.previousElementSibling : mov.nextElementSibling;
    if (!otro) return;
    e.preventDefault();
    if (e.key === 'ArrowUp') otro.before(mov); else otro.after(mov);
    asa.focus();
    alSoltar(lista, [...lista.children].map(x => x.dataset.id).filter(Boolean));
  });
}

// Fila de "concepto ........ importe".
export function linea(ctx, a, b, clase = '') {
  return ctx.h('div', { class: `fz-linea ${clase}` }, ctx.h('span', {}, a), ctx.h('span', { class: 'num' }, b));
}

export const conSigno = (n) => (n < 0 ? `− ${plata(-n)}` : `+ ${plata(n)}`);

// Gráfico de barras simple: [[etiqueta, valor], ...]
export function barras(ctx, datos, { resaltarUltima = true, verdes = null } = {}) {
  const { h } = ctx;
  const max = Math.max(1, ...datos.map(x => Math.abs(x[1])));
  return h('div', { class: 'fz-barras' }, datos.map(([et, v], i) => h('div', {},
    h('span', { class: 'num' }, Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))),
    h('span', { class: `b${resaltarUltima && i === datos.length - 1 ? ' act' : ''}${verdes?.[i] ? ' verde' : ''}`, style: `height:${Math.max(3, Math.round(Math.abs(v) / max * 90))}px` }),
    et)));
}
