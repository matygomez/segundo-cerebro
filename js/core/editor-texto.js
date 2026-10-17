// ─────────────────────────────────────────────────────────────
// Editor de texto con formato (servicio del núcleo: ctx.editorTexto).
//
// Se escribe sobre la vista final, como en Todoist o Notion, pero lo
// que se guarda es Markdown (texto simple, compatible con Obsidian):
//   # / ## / ###  títulos      **negrita**   *cursiva*   <u>subrayado</u>
//   ~~tachado~~   ==resaltado==   `código`   [texto](link)   > cita
//   - lista   1. lista   - [ ] casilla   ---  línea divisoria
//
// En la PC, al seleccionar texto aparece una barrita flotante.
// En el celular, mientras escribís hay una barra fija arriba del teclado.
//
// Opciones para quien lo usa (la Bitácora):
//   enlaces: { buscar(q) → [{ titulo, sub, nueva }], alAbrir(titulo) }  → [[enlaces]]
//   incrustar(nombre) → elemento     → ![[imagen.png]]
//   extras: [{ icono, titulo, accion(editor) }]  botones de más en la barra
//   alPegarArchivos(archivos)        → pegar o soltar imágenes
// ─────────────────────────────────────────────────────────────

import { h } from './ui.js';

const TRAZOS = {
  ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  ol: '<path d="M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 14.5c0-1 2-1 2 0s-2 2-2 3h2"/>',
  chk: '<rect x="3.5" y="4.5" width="7" height="7" rx="1.5"/><path d="m4.5 15.5 2 2 3.5-3.5M14 8h7M14 16h7"/>',
  hr: '<path d="M3 12h18"/><path d="M8 7h8M8 17h8" opacity=".35"/>',
  cita: '<path d="M5 6v12M10 8h10M10 12h10M10 16h7"/>',
  mark: '<path d="m14 4 6 6-8 8H6v-6Z"/><path d="M4 21h16"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  limpiar: '<path d="M6 5h12M12 5v14M4 20 20 4"/>',
};
export function iconoEditor(nombre, trazo = TRAZOS[nombre]) {
  const s = document.createElement('span');
  s.className = 'icono';
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${trazo || ''}</svg>`;
  return s;
}

// ── Markdown → elementos ──
const RE_INLINE = new RegExp([
  '(`[^`\\n]+`)',                                   // 1 código
  '(!\\[\\[[^\\]\\n]+\\]\\])',                      // 2 ![[incrustado]]
  '(\\[\\[[^\\]\\n]+\\]\\])',                       // 3 [[enlace]]
  '(\\[[^\\]\\n]+\\]\\([^)\\s]+\\))',               // 4 [texto](url)
  '(\\*\\*[^*\\n]+?\\*\\*|__[^_\\n]+?__)',          // 5 negrita
  '(<u>[\\s\\S]+?<\\/u>)',                          // 6 subrayado
  '(~~[^~\\n]+?~~)',                                // 7 tachado
  '(==[^=\\n]+?==)',                                // 8 resaltado
  '(\\*[^*\\s][^*\\n]*?\\*|(?<![\\p{L}\\p{N}])_[^_\\s][^_\\n]*?_(?![\\p{L}\\p{N}]))', // 9 cursiva
].join('|'), 'gu');

function chipEnlace(md, op) {
  const [destino, alias] = md.slice(2, -2).split('|');
  const titulo = destino.split('#')[0].trim();
  return h('span', { class: 'ed-wl', contenteditable: 'false', 'data-md': md, title: titulo, onclick: (e) => { e.preventDefault(); op.enlaces?.alAbrir?.(titulo); } }, (alias || destino).trim());
}
function chipIncrustado(md, op) {
  const nombre = md.slice(3, -2).split('|')[0].trim();
  const caja = h('span', { class: 'ed-emb', contenteditable: 'false', 'data-md': md });
  const el = op.incrustar?.(nombre);
  caja.append(el || h('span', { class: 'ed-emb-nombre' }, nombre));
  return caja;
}

function inline(texto, op) {
  const salida = [];
  let ultimo = 0;
  for (const m of String(texto).matchAll(RE_INLINE)) {
    if (m.index > ultimo) salida.push(document.createTextNode(texto.slice(ultimo, m.index)));
    ultimo = m.index + m[0].length;
    const t = m[0];
    if (m[1]) salida.push(h('code', {}, t.slice(1, -1)));
    else if (m[2]) salida.push(op.incrustar ? chipIncrustado(t, op) : document.createTextNode(t));
    else if (m[3]) salida.push(op.enlaces ? chipEnlace(t, op) : document.createTextNode(t));
    else if (m[4]) { const [, txt, url] = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/); salida.push(h('a', { href: url, target: '_blank', rel: 'noopener' }, inline(txt, op))); }
    else if (m[5]) salida.push(h('b', {}, inline(t.slice(2, -2), op)));
    else if (m[6]) salida.push(h('u', {}, inline(t.slice(3, -4), op)));
    else if (m[7]) salida.push(h('s', {}, inline(t.slice(2, -2), op)));
    else if (m[8]) salida.push(h('mark', {}, inline(t.slice(2, -2), op)));
    else if (m[9]) salida.push(h('i', {}, inline(t.slice(1, -1), op)));
  }
  if (ultimo < texto.length) salida.push(document.createTextNode(texto.slice(ultimo)));
  return salida;
}
function lineasInline(lineas, op) {
  const salida = [];
  lineas.forEach((l, i) => { if (i) salida.push(h('br')); salida.push(...inline(l, op)); });
  return salida;
}

const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/;

export function mdAElementos(md, op = {}) {
  const lineas = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const bloques = [];
  let i = 0;
  const parrafo = [];
  const cerrar = () => { if (parrafo.length) { bloques.push(h('p', {}, lineasInline(parrafo, op))); parrafo.length = 0; } };
  while (i < lineas.length) {
    const l = lineas[i];
    if (/^\s*```/.test(l)) {
      cerrar();
      const cod = [l];
      i++;
      while (i < lineas.length && !/^\s*```/.test(lineas[i])) cod.push(lineas[i++]);
      if (i < lineas.length) cod.push(lineas[i++]);
      bloques.push(h('pre', { class: 'ed-crudo' }, cod.join('\n')));
      continue;
    }
    if (!l.trim()) { cerrar(); i++; continue; }
    const tit = l.match(/^(#{1,6})\s+(.*)$/);
    if (tit) { cerrar(); bloques.push(h(`h${Math.min(3, tit[1].length)}`, {}, inline(tit[2], op))); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { cerrar(); bloques.push(h('hr')); i++; continue; }
    if (/^\s*>/.test(l)) {
      cerrar();
      const cita = [];
      while (i < lineas.length && /^\s*>/.test(lineas[i])) cita.push(lineas[i++].replace(/^\s*>\s?/, ''));
      bloques.push(h('blockquote', {}, lineasInline(cita, op)));
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l)) {
      cerrar();
      const tabla = [];
      while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])) tabla.push(lineas[i++]);
      bloques.push(h('pre', { class: 'ed-crudo' }, tabla.join('\n')));
      continue;
    }
    if (/^\s*!\[\[[^\]]+\]\]\s*$/.test(l) && op.incrustar) { cerrar(); bloques.push(h('p', {}, chipIncrustado(l.trim(), op))); i++; continue; }
    if (RE_ITEM.test(l)) {
      cerrar();
      const pila = [];
      while (i < lineas.length && RE_ITEM.test(lineas[i])) {
        const [, esp, marca, casilla, contenido] = lineas[i].match(RE_ITEM);
        const nivel = Math.floor(esp.replace(/\t/g, '  ').length / 2);
        const ordenada = /\d/.test(marca);
        while (pila.length && pila[pila.length - 1].nivel > nivel) pila.pop();
        let actual = pila[pila.length - 1];
        const tipo = casilla ? 'chk' : ordenada ? 'ol' : 'ul';
        if (!actual || actual.nivel < nivel || (actual.nivel === nivel && actual.tipo !== tipo)) {
          if (actual && actual.nivel === nivel) pila.pop();
          const lista = h(ordenada ? 'ol' : 'ul', { class: casilla ? 'ed-chk' : null });
          const padre = pila[pila.length - 1];
          if (padre && padre.nivel < nivel) (padre.lista.lastElementChild || padre.lista).append(lista); else bloques.push(lista);
          actual = { nivel, lista, tipo };
          pila.push(actual);
        }
        actual.lista.append(h('li', { class: casilla && /x/i.test(casilla) ? 'ok' : null }, inline(contenido, op)));
        i++;
      }
      continue;
    }
    parrafo.push(l);
    i++;
  }
  cerrar();
  return bloques;
}

// ── Elementos → Markdown ──
const envolver = (marca, txt, fin = marca) => {
  if (!txt.trim()) return txt;
  const [, a, medio, b] = txt.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return `${a}${marca}${medio}${fin}${b}`;
};
function inlineMd(nodo) {
  let s = '';
  for (const n of nodo.childNodes) {
    if (n.nodeType === 3) { s += n.nodeValue.replace(/ /g, ' ').replace(/​/g, ''); continue; }
    if (n.nodeType !== 1) continue;
    const t = n.tagName.toLowerCase();
    if (n.dataset?.md) { s += n.dataset.md; continue; }
    if (t === 'br') { s += '\n'; continue; }
    const dentro = inlineMd(n);
    if (t === 'b' || t === 'strong') s += envolver('**', dentro);
    else if (t === 'i' || t === 'em') s += envolver('*', dentro);
    else if (t === 'u') s += envolver('<u>', dentro, '</u>');
    else if (t === 's' || t === 'strike' || t === 'del') s += envolver('~~', dentro);
    else if (t === 'mark') s += envolver('==', dentro);
    else if (t === 'code') s += dentro ? `\`${dentro}\`` : '';
    else if (t === 'a') s += dentro ? `[${dentro}](${n.getAttribute('href') || ''})` : '';
    else if (t === 'span' && n.style?.fontWeight >= 600) s += envolver('**', dentro);
    else s += dentro;
  }
  return s;
}
const ES_BLOQUE = /^(p|div|h[1-6]|ul|ol|li|blockquote|hr|pre)$/;
function listaMd(lista, nivel) {
  const salida = [];
  const chk = lista.classList.contains('ed-chk');
  const ord = lista.tagName === 'OL';
  let n = 1;
  for (const li of lista.children) {
    if (li.tagName !== 'LI') continue;
    const sub = [...li.children].filter(x => x.tagName === 'UL' || x.tagName === 'OL');
    const copia = li.cloneNode(true);
    copia.querySelectorAll(':scope > ul, :scope > ol').forEach(x => x.remove());
    const texto = inlineMd(copia).replace(/\n+/g, ' ').trim();
    const marca = chk ? `- [${li.classList.contains('ok') ? 'x' : ' '}] ` : ord ? `${n++}. ` : '- ';
    salida.push(`${'  '.repeat(nivel)}${marca}${texto}`);
    for (const s of sub) salida.push(...listaMd(s, nivel + 1));
  }
  return salida;
}
export function elementosAMd(raiz) {
  const bloques = [];
  let suelto = null;   // texto e inline sueltos en la raíz
  const cerrarSuelto = () => { if (suelto) { const t = inlineMd(suelto).trim(); if (t) bloques.push(t); suelto = null; } };
  const procesar = (n) => {
    if (n.nodeType === 3 || (n.nodeType === 1 && !ES_BLOQUE.test(n.tagName.toLowerCase()) && !n.classList?.contains('ed-emb-bloque'))) {
      if (!suelto) suelto = document.createElement('p');
      suelto.append(n.cloneNode(true));
      return;
    }
    if (n.nodeType !== 1) return;
    cerrarSuelto();
    const t = n.tagName.toLowerCase();
    if (/^h[1-6]$/.test(t)) { const x = inlineMd(n).replace(/\n+/g, ' ').trim(); if (x) bloques.push(`${'#'.repeat(Math.min(3, Number(t[1])))} ${x}`); }
    else if (t === 'hr') bloques.push('---');
    else if (t === 'ul' || t === 'ol') { const l = listaMd(n, 0); if (l.length) bloques.push(l.join('\n')); }
    else if (t === 'blockquote') { const x = [...n.children].some(c => ES_BLOQUE.test(c.tagName.toLowerCase())) ? elementosAMd(n) : inlineMd(n); if (x.trim()) bloques.push(x.trim().split('\n').map(l => `> ${l}`).join('\n')); }
    else if (t === 'pre') bloques.push(n.textContent.replace(/\n+$/, ''));
    else if ((t === 'div' || t === 'p') && [...n.children].some(c => ES_BLOQUE.test(c.tagName.toLowerCase()))) { for (const c of [...n.childNodes]) procesar(c); cerrarSuelto(); }
    else { const x = inlineMd(n).replace(/\n+$/, ''); if (x.trim()) bloques.push(x); }
  };
  for (const n of [...raiz.childNodes]) procesar(n);
  cerrarSuelto();
  return bloques.join('\n\n');
}

// ── El editor ──
const esCelular = () => matchMedia('(pointer: coarse)').matches || !matchMedia('(min-width: 900px)').matches;

export function crearEditor(opciones = {}) {
  const op = opciones;
  const ed = h('div', { class: 'ed-area', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': op.etiqueta || 'Texto', spellcheck: 'true', 'data-ph': op.placeholder || '' });
  const flot = h('div', { class: 'ed-barra ed-flot', hidden: true });
  const fija = h('div', { class: 'ed-barra ed-fija', hidden: true });
  const pop = h('div', { class: 'ed-pop', hidden: true, role: 'listbox' });
  const caja = h('div', { class: `ed${op.clase ? ' ' + op.clase : ''}` }, ed, flot, pop, fija);
  let ultimo = '';
  let espera = null;

  const vacio = () => !ed.textContent.trim() && !ed.querySelector('hr, .ed-emb, .ed-wl, li, img');
  const marcarVacio = () => ed.classList.toggle('vacio', vacio());

  function poner(md) {
    ed.replaceChildren(...mdAElementos(md, op));
    if (!ed.childNodes.length) ed.append(h('p', {}, h('br')));
    ultimo = valor();
    marcarVacio();
    pintarEtiquetas();
  }
  function valor() { return vacio() ? '' : elementosAMd(ed).replace(/\n{3,}/g, '\n\n').trim(); }
  function avisar() {
    marcarVacio();
    const v = valor();
    if (v === ultimo) return;
    ultimo = v;
    op.alCambiar?.(v);
    clearTimeout(espera);
    espera = setTimeout(pintarEtiquetas, 900);
  }

  // #etiquetas con color (no se toca el párrafo donde estás escribiendo)
  function pintarEtiquetas() {
    if (!op.etiquetas) return;
    const sel = getSelection();
    const conCursor = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('code, pre, .ed-tag, .ed-wl, .ed-emb, a') || n === conCursor ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodos = [];
    while (tw.nextNode()) if (/(^|[\s(])#[\p{L}\p{N}_\-/]*[\p{L}_\-]/u.test(tw.currentNode.nodeValue)) nodos.push(tw.currentNode);
    for (const n of nodos) {
      const partes = n.nodeValue.split(/((?<![^\s(])#[\p{L}\p{N}_\-/]*[\p{L}_\-][\p{L}\p{N}_\-/]*)/u);
      if (partes.length < 2) continue;
      n.replaceWith(...partes.map((p, i) => (i % 2 ? h('span', { class: 'ed-tag' }, p) : document.createTextNode(p))).filter(x => x.nodeType === 1 || x.nodeValue));
    }
  }

  // ── Comandos ──
  const bloqueActual = () => {
    const s = getSelection();
    let n = s.anchorNode;
    while (n && n !== ed && !(n.nodeType === 1 && /^(P|DIV|H1|H2|H3|BLOCKQUOTE|LI|PRE)$/.test(n.tagName))) n = n.parentNode;
    return n && n !== ed ? n : null;
  };
  const listaActual = () => { let n = getSelection().anchorNode; while (n && n !== ed) { if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) return n; n = n.parentNode; } return null; };
  function envolverSeleccion(tag) {
    const s = getSelection();
    if (!s.rangeCount) return;
    let n = s.anchorNode;
    while (n && n !== ed) { if (n.nodeType === 1 && n.tagName.toLowerCase() === tag) { n.replaceWith(...n.childNodes); return; } n = n.parentNode; }
    const r = s.getRangeAt(0);
    if (r.collapsed) return;
    const el = document.createElement(tag);
    el.append(r.extractContents());
    r.insertNode(el);
    s.removeAllRanges();
    const r2 = document.createRange(); r2.selectNodeContents(el); s.addRange(r2);
  }
  function comando(c) {
    ed.focus();
    document.execCommand('defaultParagraphSeparator', false, 'p');
    if (['h1', 'h2', 'h3', 'blockquote'].includes(c)) {
      const b = bloqueActual();
      document.execCommand('formatBlock', false, b && b.tagName.toLowerCase() === c ? 'p' : c);
    } else if (c === 'ul' || c === 'ol') {
      const l = listaActual();
      if (l?.classList.contains('ed-chk') && c === 'ul') l.classList.remove('ed-chk');
      else document.execCommand(c === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
    } else if (c === 'chk') {
      let l = listaActual();
      if (l && l.tagName === 'UL') l.classList.toggle('ed-chk');
      else { document.execCommand('insertUnorderedList'); l = listaActual(); l?.classList.add('ed-chk'); }
    } else if (c === 'hr') {
      // La línea va después de lo seleccionado, sin borrarlo.
      const s0 = getSelection();
      if (s0.rangeCount && !s0.isCollapsed) { const b = bloqueActual(); const r = document.createRange(); if (b) r.selectNodeContents(b); else r.setStart(s0.focusNode, s0.focusOffset); r.collapse(false); s0.removeAllRanges(); s0.addRange(r); }
      document.execCommand('insertHorizontalRule');
      const hr = [...ed.querySelectorAll('hr')].find(x => !x.nextElementSibling);
      if (hr) { const p = h('p', {}, h('br')); hr.after(p); const r = document.createRange(); r.setStart(p, 0); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    } else if (c === 'mark' || c === 'code') envolverSeleccion(c);
    else if (c === 'link') {
      const url = (op.pedirLink || ((v) => window.prompt('Dirección del link', v)))('https://');
      Promise.resolve(url).then(u => { if (u) { ed.focus(); document.execCommand('createLink', false, u); avisar(); } });
      return;
    } else if (c === 'limpiar') {
      document.execCommand('removeFormat');
      const s = getSelection();
      if (s.rangeCount) { for (const x of ed.querySelectorAll('mark, code')) if (s.containsNode(x, true)) x.replaceWith(...x.childNodes); }
      const b = bloqueActual();
      if (b && /^H[1-3]|BLOCKQUOTE$/.test(b.tagName)) document.execCommand('formatBlock', false, 'p');
    } else document.execCommand(c);
    avisar();
    ubicarFlot();
  }

  const boton = (c, contenido, titulo) => h('button', { type: 'button', class: 'ed-b', title: titulo, 'aria-label': titulo, onmousedown: (e) => e.preventDefault(), onclick: () => comando(c) }, contenido);
  const sep = () => h('span', { class: 'ed-sep' });
  const botones = () => [
    boton('h1', 'T1', 'Título grande'), boton('h2', 'T2', 'Título mediano'), boton('h3', 'T3', 'Título chico'), sep(),
    boton('bold', h('b', {}, 'B'), 'Negrita'), boton('italic', h('i', {}, 'I'), 'Cursiva'), boton('underline', h('u', {}, 'U'), 'Subrayado'), boton('strikeThrough', h('s', {}, 'S'), 'Tachado'),
    boton('mark', iconoEditor('mark'), 'Resaltar'), boton('code', iconoEditor('code'), 'Código'), sep(),
    boton('ul', iconoEditor('ul'), 'Lista'), boton('ol', iconoEditor('ol'), 'Lista numerada'), boton('chk', iconoEditor('chk'), 'Casillas'),
    boton('blockquote', iconoEditor('cita'), 'Cita'), boton('hr', iconoEditor('hr'), 'Línea divisoria'), sep(),
    boton('link', iconoEditor('link'), 'Link'), boton('limpiar', iconoEditor('limpiar'), 'Quitar formato'),
    ...(op.extras || []).map(x => h('button', { type: 'button', class: 'ed-b', title: x.titulo, 'aria-label': x.titulo, onmousedown: (e) => e.preventDefault(), onclick: () => x.accion(api) }, typeof x.icono === 'function' ? x.icono() : x.icono?.cloneNode ? x.icono.cloneNode(true) : x.icono)),
  ];
  flot.append(...botones());
  fija.append(...botones());

  // Barra flotante (PC): aparece al seleccionar texto.
  function ubicarFlot() {
    const s = getSelection();
    if (esCelular() || !s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode)) { flot.hidden = true; return; }
    const r = s.getRangeAt(0).getBoundingClientRect();
    const c = caja.getBoundingClientRect();
    flot.hidden = false;
    const arriba = r.top - c.top - flot.offsetHeight - 8;
    flot.style.top = `${arriba < -c.top + 4 ? r.bottom - c.top + 8 : arriba}px`;
    flot.style.left = `${Math.max(0, Math.min(c.width - flot.offsetWidth, r.left - c.left + r.width / 2 - flot.offsetWidth / 2))}px`;
  }
  // Barra fija (celular): pegada arriba del teclado mientras escribís.
  function ubicarFija() {
    if (!esCelular() || document.activeElement !== ed) { fija.hidden = true; return; }
    fija.hidden = false;
    const vv = window.visualViewport;
    const alto = fija.offsetHeight;
    fija.style.top = `${(vv ? vv.offsetTop + vv.height : innerHeight) - alto}px`;
  }
  const alSel = () => { if (!caja.isConnected) { document.removeEventListener('selectionchange', alSel); return; } ubicarFlot(); revisarPop(); };
  document.addEventListener('selectionchange', alSel);
  window.visualViewport?.addEventListener('resize', ubicarFija);
  window.visualViewport?.addEventListener('scroll', ubicarFija);
  ed.addEventListener('focus', () => { setTimeout(ubicarFija, 50); caja.classList.add('activo'); });
  ed.addEventListener('blur', () => setTimeout(() => {
    if (caja.contains(document.activeElement) && document.activeElement !== ed) return;
    fija.hidden = true; flot.hidden = true; cerrarPop(); caja.classList.remove('activo'); pintarEtiquetas(); op.alSalir?.(valor());
  }, 180));

  // Casillas: tocar el cuadradito las tilda.
  ed.addEventListener('click', (e) => {
    const li = e.target.closest?.('ul.ed-chk > li');
    if (!li || e.target.closest('.ed-wl, .ed-emb, a')) return;
    const r = li.getBoundingClientRect();
    if (e.clientX - r.left < 26) { li.classList.toggle('ok'); avisar(); e.preventDefault(); }
  });
  // Links: Ctrl+clic (o tocar en el celular) los abre.
  ed.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (a && (e.ctrlKey || e.metaKey || esCelular())) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
  });

  ed.addEventListener('input', () => { convertirEnlacesEscritos(); avisar(); revisarPop(); });
  ed.addEventListener('keydown', (e) => {
    if (!pop.hidden && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) { teclaPop(e); return; }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); comando('link'); }
  });
  // Pegar: imágenes al que lo usa; texto siempre sin formato raro.
  ed.addEventListener('paste', (e) => {
    const archivos = [...(e.clipboardData?.files || [])];
    if (archivos.length) { if (op.alPegarArchivos) { e.preventDefault(); e.stopPropagation(); op.alPegarArchivos(archivos); } return; }
    const texto = e.clipboardData?.getData('text/plain');
    if (texto === undefined) return;
    e.preventDefault();
    if (/(^|\n)\s*([-*+]\s|\d+\.\s|#{1,3}\s|>\s)|\*\*|\[\[/.test(texto) && texto.includes('\n')) insertarMd(texto);
    else document.execCommand('insertText', false, texto);
  });
  ed.addEventListener('drop', (e) => {
    const archivos = [...(e.dataTransfer?.files || [])];
    if (!archivos.length || !op.alPegarArchivos) return;
    e.preventDefault(); e.stopPropagation();
    op.alPegarArchivos(archivos);
  });

  // [[ escrito a mano y cerrado con ]] → se convierte en enlace.
  function convertirEnlacesEscritos() {
    if (!op.enlaces && !op.incrustar) return;
    const s = getSelection();
    const n = s.anchorNode;
    if (!n || n.nodeType !== 3 || !ed.contains(n)) return;
    const m = n.nodeValue.match(/(!?)\[\[([^\]\n]+)\]\]/);
    if (!m) return;
    const md = m[0];
    const chip = m[1] ? (op.incrustar ? chipIncrustado(md, op) : null) : (op.enlaces ? chipEnlace(md, op) : null);
    if (!chip) return;
    const despues = n.splitText(m.index);
    despues.nodeValue = despues.nodeValue.slice(md.length);
    despues.before(chip);
    const r = document.createRange(); r.setStart(despues, 0); s.removeAllRanges(); s.addRange(r);
  }

  // ── Buscador de [[ (Bitácora) ──
  let ops = [], elegida = 0, inicio = null;
  function revisarPop() {
    if (!op.enlaces || document.activeElement !== ed) { cerrarPop(); return; }
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed || s.anchorNode?.nodeType !== 3) { cerrarPop(); return; }
    const antes = s.anchorNode.nodeValue.slice(0, s.anchorOffset);
    const m = antes.match(/\[\[([^\]\n|#]*)$/);
    if (!m) { cerrarPop(); return; }
    inicio = { nodo: s.anchorNode, desde: antes.length - m[0].length, hasta: s.anchorOffset };
    ops = op.enlaces.buscar(m[1]) || [];
    if (!ops.length) { cerrarPop(); return; }
    elegida = Math.min(elegida, ops.length - 1);
    pintarPop();
    const r = s.getRangeAt(0).getBoundingClientRect(), c = caja.getBoundingClientRect();
    pop.hidden = false;
    pop.style.top = `${r.bottom - c.top + 6}px`;
    pop.style.left = `${Math.max(0, Math.min(c.width - pop.offsetWidth, r.left - c.left - 10))}px`;
  }
  function pintarPop() {
    pop.replaceChildren(...ops.map((o, i) => h('button', { type: 'button', role: 'option', class: `ed-pop-op${i === elegida ? ' sel' : ''}${o.nueva ? ' nueva' : ''}`, onmousedown: (e) => e.preventDefault(), onclick: () => usarPop(i) },
      h('b', {}, o.nueva ? `+ ${o.titulo}` : o.titulo), o.sub ? h('small', {}, o.sub) : null)));
  }
  function cerrarPop() { pop.hidden = true; ops = []; elegida = 0; }
  function usarPop(i) {
    const o = ops[i];
    if (!o || !inicio) return;
    const { nodo, desde, hasta } = inicio;
    let resto = nodo.nodeValue.slice(hasta);
    if (resto.startsWith(']]')) resto = resto.slice(2);
    const antes = nodo.nodeValue.slice(0, desde);
    const chip = chipEnlace(`[[${o.titulo}]]`, op);
    const despues = document.createTextNode(resto.startsWith(' ') ? resto : ` ${resto}`);
    nodo.nodeValue = antes;
    nodo.after(chip, despues);
    const r = document.createRange(); r.setStart(despues, 1); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    cerrarPop();
    avisar();
  }
  function teclaPop(e) {
    e.preventDefault();
    if (e.key === 'ArrowDown') { elegida = (elegida + 1) % ops.length; pintarPop(); }
    else if (e.key === 'ArrowUp') { elegida = (elegida - 1 + ops.length) % ops.length; pintarPop(); }
    else if (e.key === 'Escape') cerrarPop();
    else usarPop(elegida);
  }

  // Insertar Markdown donde está el cursor (o al final).
  function insertarMd(md) {
    const s = getSelection();
    const nodos = mdAElementos(md, op);
    const enLinea = nodos.length === 1 && nodos[0].tagName === 'P';
    if (s.rangeCount && ed.contains(s.anchorNode)) {
      const r = s.getRangeAt(0);
      r.deleteContents();
      const frag = document.createDocumentFragment();
      if (enLinea) frag.append(...nodos[0].childNodes); else frag.append(...nodos);
      const ultimoNodo = frag.lastChild;
      r.insertNode(frag);
      if (ultimoNodo) { const r2 = document.createRange(); r2.setStartAfter(ultimoNodo); s.removeAllRanges(); s.addRange(r2); }
    } else {
      if (vacio()) ed.replaceChildren();
      ed.append(...nodos);
    }
    avisar();
  }

  const api = {
    el: caja, area: ed,
    valor, poner,
    enfocar(alFinal = true) { ed.focus(); if (alFinal) { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } },
    tieneFoco: () => document.activeElement === ed,
    insertarMd,
    comando,
  };
  poner(op.valor || '');
  return api;
}
