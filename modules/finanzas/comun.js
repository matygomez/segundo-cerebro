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
  calculadora: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><rect x="8" y="6" width="8" height="3.5" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
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
  return h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, etiqueta), control?._caja || control, ayuda ? h('span', { class: 'nota' }, ayuda) : null);
}

// ── Importes: se puede escribir una cuenta (1500+2300*2, 25000/3) ──
// Se escribe sin puntos: los decimales van con coma. Si se escribe un
// punto, se cambia por coma. Al salir del campo queda el resultado.
// Para el resto del código, input.value devuelve siempre el número ya
// calculado (con punto decimal), o '' si está vacío.
export const textoImporte = (n) => (n === '' || n === null || n === undefined ? '' : String(n).replace('.', ','));
const OPERADOR = /[+\-*/x×÷−]/i;
const tieneCuenta = (t) => OPERADOR.test(String(t).trim().slice(1));

// Devuelve el número, null si está vacío o NaN si la cuenta está mal.
export function evaluarCuenta(texto) {
  const s = String(texto ?? '').replace(/\s/g, '').replace(/[x×]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\./g, ',').replace(/,/g, '.');
  if (!s) return null;
  let i = 0;
  const ver = () => s[i];
  function numero() {
    if (ver() === '(') { i++; const v = suma(); if (ver() !== ')') throw 0; i++; return v; }
    if (ver() === '-') { i++; return -numero(); }
    if (ver() === '+') { i++; return numero(); }
    const m = /^\d+(\.\d*)?|^\.\d+/.exec(s.slice(i));
    if (!m) throw 0;
    i += m[0].length;
    return Number(m[0]);
  }
  function producto() {
    let v = numero();
    while (ver() === '*' || ver() === '/') { const op = s[i++]; const b = numero(); v = op === '*' ? v * b : v / b; }
    return v;
  }
  function suma() {
    let v = producto();
    while (ver() === '+' || ver() === '-') { const op = s[i++]; const b = producto(); v = op === '+' ? v + b : v - b; }
    return v;
  }
  try {
    const v = suma();
    if (i !== s.length || !Number.isFinite(v)) return NaN;
    return Math.round(v * 100) / 100;
  } catch { return NaN; }
}

const VALOR = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

export function inputImporte(ctx, valor = '', placeholder = '$ 0') {
  const { h } = ctx;
  const input = h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done', class: 'fz-importe', 'aria-label': 'Importe',
    placeholder: /^-?\d+(\.\d+)?$/.test(String(placeholder)) ? textoImporte(placeholder) : placeholder,
  });
  VALOR.set.call(input, textoImporte(valor));
  // input.value: el número calculado, para que todos los formularios lo lean igual.
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { const t = VALOR.get.call(this); const v = evaluarCuenta(t); return v === null ? '' : Number.isNaN(v) ? t : String(v); },
    set(x) { VALOR.set.call(this, textoImporte(x)); },
  });
  input.textoEscrito = () => VALOR.get.call(input);
  const res = h('p', { class: 'fz-imp-res', 'aria-live': 'polite' });
  const extras = h('span', { class: 'fz-imp-extras' });
  const boton = h('button', { type: 'button', class: 'fz-imp-calc', title: 'Calculadora', 'aria-label': 'Abrir calculadora', onclick: (e) => { e.preventDefault(); abrirCalculadora(ctx, input); } }, ic('calculadora'));
  const caja = h('div', { class: 'fz-imp-caja' }, input, extras, boton);
  input._caja = h('div', { class: 'fz-imp' }, caja, res);
  // Para sumar algo adentro del campo (por ejemplo "Todo").
  input._extra = (el) => { extras.append(el); caja.classList.add('con-extra'); };
  function mostrarResultado() {
    const t = VALOR.get.call(input);
    if (!tieneCuenta(t)) { res.textContent = ''; res.classList.remove('error'); return; }
    const v = evaluarCuenta(t);
    if (Number.isNaN(v)) { res.textContent = 'La cuenta no está completa'; res.classList.add('error'); }
    else { res.textContent = `= ${plata(v)}`; res.classList.remove('error'); }
  }
  input.addEventListener('input', () => {
    const t = VALOR.get.call(input);
    if (t.includes('.')) {
      const pos = input.selectionStart;
      VALOR.set.call(input, t.replace(/\./g, ','));
      try { input.setSelectionRange(pos, pos); } catch { /* nada */ }
    }
    mostrarResultado();
  });
  // Al salir del campo, la cuenta se reemplaza por el resultado.
  input.addEventListener('blur', () => {
    const t = VALOR.get.call(input);
    if (!tieneCuenta(t)) return;
    const v = evaluarCuenta(t);
    if (v === null || Number.isNaN(v)) return;
    VALOR.set.call(input, textoImporte(v));
    mostrarResultado();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return input;
}

// Calculadora con teclas grandes (en el celular el teclado no tiene "+").
export function abrirCalculadora(ctx, input) {
  const { h } = ctx;
  let cuenta = (input.textoEscrito?.() || '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  const verCuenta = h('div', { class: 'fz-calc-cuenta' });
  const verTotal = h('div', { class: 'fz-calc-total num' });
  function pintar() {
    verCuenta.textContent = cuenta || ' ';
    const v = evaluarCuenta(cuenta);
    verTotal.textContent = v === null ? '$ 0' : Number.isNaN(v) ? '…' : plata(v);
  }
  const tecla = (t, clase = '', accion = null) => h('button', { type: 'button', class: `fz-tecla ${clase}`, onclick: () => { accion ? accion() : (cuenta += t); pintar(); } }, t);
  const usar = () => {
    const v = evaluarCuenta(cuenta);
    if (v === null) VALOR.set.call(input, '');
    else if (Number.isNaN(v)) { verTotal.textContent = 'La cuenta no está completa'; return; }
    else VALOR.set.call(input, textoImporte(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    dlg.close();
  };
  const dlg = h('dialog', { class: 'hoja fz-calc-hoja' },
    h('div', { class: 'fz-calc-pantalla' }, verCuenta, verTotal),
    h('div', { class: 'fz-teclas' },
      tecla('7'), tecla('8'), tecla('9'), tecla('÷', 'op'),
      tecla('4'), tecla('5'), tecla('6'), tecla('×', 'op'),
      tecla('1'), tecla('2'), tecla('3'), tecla('−', 'op'),
      tecla(','), tecla('0'), tecla('⌫', '', () => { cuenta = cuenta.slice(0, -1); }), tecla('+', 'op'),
      tecla('C', 'borrar', () => { cuenta = ''; }),
      h('button', { type: 'button', class: 'fz-tecla usar', onclick: usar }, 'Usar')));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => {
    if (/^[0-9+\-*/,.x]$/.test(e.key)) { cuenta += e.key === '.' ? ',' : e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key === '-' ? '−' : e.key; pintar(); e.preventDefault(); }
    else if (e.key === 'Backspace') { cuenta = cuenta.slice(0, -1); pintar(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); usar(); }
  });
  document.body.append(dlg);
  dlg.showModal();
  pintar();
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
