// ─────────────────────────────────────────────────────────────
// Finanzas: piezas de interfaz compartidas por las pantallas.
// ─────────────────────────────────────────────────────────────

import { plata } from './modelo.js';

export const poner = (el, ...items) => el.replaceChildren(...items.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));

const TRAZOS = {
  menos: '<path d="M6 12h12"/>',
  mas: '<path d="M12 6v12M6 12h12"/>',
  transferir: '<path d="M5 8h13"/><path d="m15 5 3 3-3 3"/><path d="M19 16H6"/><path d="m9 13-3 3 3 3"/>',
  engranaje: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
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

// Botón que abre la lista de categorías con títulos y subcategorías.
export function selectorCategoria(ctx, d, tipos, valor = '') {
  const { h, icono } = ctx;
  let actual = valor;
  const texto = h('span', {});
  const boton = h('button', { type: 'button', class: 'fz-selector-cat' }, texto, ic('abajo'));
  const pintar = () => {
    texto.textContent = actual ? d.nombreCategoria(actual) : 'Elegí una categoría';
    boton.classList.toggle('vacio', !actual);
  };
  pintar();
  const TITULOS = { fijo: 'Gastos fijos', variable: 'Gastos variables', ingreso: 'Ingresos' };
  boton.addEventListener('click', () => {
    const lista = h('div', { class: 'fz-lista-cat' });
    let hay = false;
    for (const tp of tipos) {
      const cats = d.categoriasDe(tp);
      if (!cats.length) continue;
      hay = true;
      lista.append(h('div', { class: 'fz-grupo-cat' }, TITULOS[tp]));
      const conSubgrupos = tp === 'fijo' ? [['familia', 'Familia'], ['personal', 'Personal']] : [[null, null]];
      for (const [clave, titulo] of conSubgrupos) {
      const delGrupo = clave ? cats.filter(c => (c.grupoFijo === 'personal' ? 'personal' : 'familia') === clave) : cats;
      if (!delGrupo.length) continue;
      if (titulo) lista.append(h('div', { class: 'fz-subgrupo-cat' }, titulo));
      for (const c of delGrupo) {
        const subs = d.subcategorias(c.id);
        lista.append(h('button', { type: 'button', class: 'fz-cat-padre', onclick: () => elegir(c.id) }, c.nombre, subs.length ? h('span', { class: 'nota' }, 'general') : null));
        for (const s of subs) lista.append(h('button', { type: 'button', class: 'fz-cat-sub', onclick: () => elegir(s.id) }, s.nombre));
      }
      }
    }
    if (!hay) lista.append(h('p', { class: 'nota' }, 'Todavía no hay categorías. Crealas desde Configurar Finanzas (⚙).'));
    const dlg = h('dialog', { class: 'hoja fz-hoja' },
      h('header', { class: 'hoja-cabecera' }, h('h2', {}, 'Categoría'),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      lista);
    function elegir(id) { actual = id; pintar(); boton.dispatchEvent(new Event('input', { bubbles: true })); dlg.close(); }
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  });
  return { elemento: boton, valor: () => actual, fijar: (id) => { actual = id; pintar(); } };
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
