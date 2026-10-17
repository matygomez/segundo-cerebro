// ─────────────────────────────────────────────────────────────
// Búsqueda en toda la app.
//
// Cada módulo que quiera aparecer exporta buscar(texto, ctx, ayuda) y
// devuelve una lista de resultados:
//   { grupo: 'Tareas', icono, titulo, sub, der, fecha (ms, para ordenar), abrir() }
// "ayuda" trae coincide(texto) y fragmento(texto) para que todos busquen
// igual: sin tildes ni mayúsculas.
//
// Se abre con la lupa de arriba, con Ctrl + K, o escribiendo en la
// barra "Buscar en todo…" del Inicio.
// ─────────────────────────────────────────────────────────────

import { h, icono } from './ui.js';
import { buscarEnModulos } from './registro.js';

export const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RECIENTES = 'sc-busquedas';
const leerRecientes = () => { try { return JSON.parse(localStorage.getItem(RECIENTES) || '[]'); } catch { return []; } };
const guardarReciente = (q) => { try { localStorage.setItem(RECIENTES, JSON.stringify([q, ...leerRecientes().filter(x => x !== q)].slice(0, 6))); } catch { /* nada */ } };

// Todas las palabras tienen que aparecer (en cualquier orden).
function ayudante(texto) {
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean);
  const coincide = (...campos) => { const t = sinTildes(campos.join(' ')); return palabras.length > 0 && palabras.every(p => t.includes(p)); };
  const fragmento = (largo) => {
    const t = String(largo || '').replace(/[#*_>`\[\]]/g, '').replace(/\s+/g, ' ').trim();
    const i = sinTildes(t).indexOf(palabras[0] || '');
    if (i < 0) return '';
    const a = Math.max(0, i - 30);
    return `${a ? '…' : ''}${t.slice(a, i + 60)}${i + 60 < t.length ? '…' : ''}`;
  };
  return { palabras, coincide, fragmento };
}

export async function buscar(texto) {
  const ayuda = ayudante(texto);
  if (!ayuda.palabras.length) return [];
  const lista = await buscarEnModulos(texto, ayuda);
  // Primero lo que empieza con lo buscado, después lo más nuevo.
  const q = sinTildes(texto.trim());
  return lista.map(r => ({ ...r, _p: sinTildes(r.titulo).startsWith(q) ? 0 : sinTildes(r.titulo).includes(q) ? 1 : 2 }))
    .sort((a, b) => a._p - b._p || (b.fecha || 0) - (a.fecha || 0));
}

// Resalta lo buscado (todas las palabras).
function resaltar(texto, palabras) {
  const t = String(texto || '');
  const base = sinTildes(t);
  const marcas = [];
  for (const p of palabras) { let i = base.indexOf(p); while (i >= 0 && p) { marcas.push([i, i + p.length]); i = base.indexOf(p, i + p.length); } }
  if (!marcas.length) return [t];
  marcas.sort((a, b) => a[0] - b[0]);
  const salida = []; let pos = 0;
  for (const [a, b] of marcas) { if (a < pos) continue; if (a > pos) salida.push(t.slice(pos, a)); salida.push(h('mark', {}, t.slice(a, b))); pos = b; }
  if (pos < t.length) salida.push(t.slice(pos));
  return salida;
}

function fila(r, palabras, alAbrir) {
  return h('button', { type: 'button', class: 'bq-r', onclick: () => { alAbrir?.(); r.abrir?.(); } },
    h('span', { class: 'bq-ri' }, icono(r.icono || 'punto')),
    h('span', { class: 'bq-rt' }, h('b', {}, resaltar(r.titulo, palabras)), r.sub ? h('small', {}, resaltar(r.sub, palabras)) : null),
    r.der ? h('span', { class: 'bq-rd' }, r.der) : null);
}

// ── Ventana de búsqueda completa ──
let abierta = null;
export function abrirBusqueda(textoInicial = '') {
  if (abierta) { abierta.querySelector('input').value = textoInicial || abierta.querySelector('input').value; abierta.querySelector('input').focus(); return; }
  let filtro = '', turno = 0, resultados = [];
  const entrada = h('input', { type: 'search', value: textoInicial, placeholder: 'Buscar tareas, notas, gastos, hábitos…', autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Buscar' });
  const filtros = h('div', { class: 'bq-filtros' });
  const zona = h('div', { class: 'bq-res' });
  const dlg = h('dialog', { class: 'bq' },
    h('div', { class: 'bq-in' }, icono('lupa'), entrada, h('button', { type: 'button', class: 'bq-cerrar', onclick: () => dlg.close() }, 'Cerrar')),
    filtros, zona);
  const cerrar = () => dlg.close();

  function pintar(q) {
    const ayuda = ayudante(q);
    if (!ayuda.palabras.length) {
      const rec = leerRecientes();
      filtros.replaceChildren();
      zona.replaceChildren(rec.length
        ? h('div', {}, h('h4', {}, 'Búsquedas recientes'), h('div', { class: 'bq-recientes' }, rec.map(x => h('button', { type: 'button', onclick: () => { entrada.value = x; correr(); } }, x))))
        : h('p', { class: 'nota bq-vacio' }, 'Busca en tareas, notas, películas, movimientos, hábitos y metas.'));
      return;
    }
    const grupos = [...new Set(resultados.map(r => r.grupo))];
    if (filtro && !grupos.includes(filtro)) filtro = '';
    filtros.replaceChildren(...(resultados.length ? [
      h('button', { type: 'button', class: filtro ? '' : 'sel', onclick: () => { filtro = ''; pintar(q); } }, 'Todo', h('small', {}, String(resultados.length))),
      ...grupos.map(g => h('button', { type: 'button', class: filtro === g ? 'sel' : '', onclick: () => { filtro = g; pintar(q); } }, g, h('small', {}, String(resultados.filter(r => r.grupo === g).length)))),
    ] : []));
    if (!resultados.length) { zona.replaceChildren(h('p', { class: 'nota bq-vacio' }, `No encontré nada con "${q.trim()}".`)); return; }
    const max = filtro ? 200 : 4;
    zona.replaceChildren(...grupos.filter(g => !filtro || g === filtro).map(g => {
      const l = resultados.filter(r => r.grupo === g);
      return h('section', {},
        h('h4', {}, g, l.length > max ? h('button', { type: 'button', onclick: () => { filtro = g; pintar(q); zona.scrollTop = 0; } }, `Ver las ${l.length} ›`) : null),
        l.slice(0, max).map(r => fila(r, ayuda.palabras, () => { guardarReciente(q.trim()); cerrar(); })));
    }));
  }
  let espera = null;
  async function correr() {
    const q = entrada.value;
    const mio = ++turno;
    resultados = ayudante(q).palabras.length ? await buscar(q) : [];
    if (mio === turno) pintar(q);
  }
  entrada.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(correr, 150); });
  entrada.addEventListener('keydown', (e) => {
    const botones = [...zona.querySelectorAll('.bq-r')];
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
    if (e.key === 'Enter') { e.preventDefault(); botones[0]?.click(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); botones[0]?.focus(); }
  });
  zona.addEventListener('keydown', (e) => {
    const botones = [...zona.querySelectorAll('.bq-r')];
    const i = botones.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); botones[Math.min(botones.length - 1, i + 1)]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) entrada.focus(); else botones[i - 1].focus(); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) cerrar(); });
  // Si cambia la pantalla (por ejemplo, al abrir un resultado), se cierra.
  const alNavegar = () => cerrar();
  addEventListener('hashchange', alNavegar);
  dlg.addEventListener('close', () => { dlg.remove(); abierta = null; removeEventListener('hashchange', alNavegar); });
  document.body.append(dlg);
  abierta = dlg;
  dlg.showModal();
  entrada.focus();
  correr();
}

// ── Barra del Inicio: resultados abajo, mientras escribís ──
export function barraBusqueda() {
  const entrada = h('input', { type: 'search', placeholder: 'Buscar en todo…', autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Buscar en todo' });
  const lista = h('div', { class: 'bq-desp', hidden: true });
  let turno = 0, espera = null;
  async function correr() {
    const q = entrada.value;
    const mio = ++turno;
    const ayuda = ayudante(q);
    if (!ayuda.palabras.length) { lista.hidden = true; lista.replaceChildren(); return; }
    const r = await buscar(q);
    if (mio !== turno) return;
    lista.hidden = false;
    lista.replaceChildren(...(r.length
      ? [...r.slice(0, 5).map(x => fila(x, ayuda.palabras, () => guardarReciente(q.trim()))),
        r.length > 5 ? h('button', { type: 'button', class: 'bq-mas', onclick: () => abrirBusqueda(q) }, `Ver los ${r.length} resultados ›`) : null].filter(Boolean)
      : [h('p', { class: 'nota bq-vacio' }, 'Nada con eso.')]));
  }
  entrada.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(correr, 150); });
  entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); abrirBusqueda(entrada.value); } if (e.key === 'Escape') { entrada.value = ''; correr(); } });
  return h('div', { class: 'bq-barra' }, h('label', { class: 'bq-campo' }, icono('lupa'), entrada), lista);
}

// Botón de la barra de arriba y Ctrl + K.
export function botonBusqueda() {
  const b = h('button', { type: 'button', class: 'bq-boton', 'aria-label': 'Buscar en todo', title: 'Buscar (Ctrl + K)', onclick: () => abrirBusqueda() },
    icono('lupa'), h('span', {}, 'Buscar en todo…'), h('kbd', {}, 'Ctrl K'));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBusqueda(); }
  });
  return b;
}
