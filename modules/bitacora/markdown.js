// ─────────────────────────────────────────────────────────────
// Bitácora: muestra el Markdown de una nota (modo "Leer").
//
// Entiende lo mismo que Obsidian para el uso diario: títulos (#),
// negrita, cursiva, tachado, resaltado (==), código, listas, casillas
// (- [ ]), citas (>), tablas, separadores, links, [[enlaces]],
// ![[imágenes]] y #etiquetas. Nunca usa innerHTML con tu texto.
// ─────────────────────────────────────────────────────────────

const RE_INLINE = new RegExp([
  '(`[^`\\n]+`)',                                         // 1 código
  '(!\\[\\[[^\\]\\n]+\\]\\])',                            // 2 ![[imagen]]
  '(\\[\\[[^\\]\\n]+\\]\\])',                             // 3 [[enlace]]
  '(!\\[[^\\]\\n]*\\]\\([^)\\s]+\\))',                    // 4 ![alt](url)
  '(\\[[^\\]\\n]+\\]\\([^)\\s]+\\))',                     // 5 [texto](url)
  '(\\*\\*[^*\\n]+?\\*\\*|__[^_\\n]+?__)',                // 6 negrita
  '(~~[^~\\n]+?~~)',                                      // 7 tachado
  '(==[^=\\n]+?==)',                                      // 8 resaltado
  '(\\*[^*\\s][^*\\n]*?\\*|(?<![\\p{L}\\p{N}])_[^_\\s][^_\\n]*?_(?![\\p{L}\\p{N}]))', // 9 cursiva
  '(https?:\\/\\/[^\\s<>()]+[^\\s<>().,;:!?\'"])',        // 10 link suelto
  '((?<![^\\s(])#[\\p{L}\\p{N}_\\-/]*[\\p{L}_\\-][\\p{L}\\p{N}_\\-/]*)', // 11 #etiqueta
].join('|'), 'gu');

const urlSegura = (u) => (/^(https?:|mailto:|tel:|#\/)/i.test(u) ? u : null);

export function inline(texto, op) {
  const { h } = op;
  const salida = [];
  let ultimo = 0;
  for (const m of String(texto).matchAll(RE_INLINE)) {
    if (m.index > ultimo) salida.push(texto.slice(ultimo, m.index));
    ultimo = m.index + m[0].length;
    const t = m[0];
    if (m[1]) salida.push(h('code', {}, t.slice(1, -1)));
    else if (m[2]) {
      const nombre = t.slice(3, -2).split('|')[0].trim();
      salida.push(op.imagen ? op.imagen(nombre) : h('span', { class: 'bt-md-emb' }, nombre));
    } else if (m[3]) {
      const [destino, alias] = t.slice(2, -2).split('|');
      const titulo = destino.split('#')[0].trim();
      const existe = op.existe ? op.existe(titulo) : true;
      salida.push(h('a', {
        href: '#', class: `bt-wl${existe ? '' : ' nueva'}`, title: existe ? titulo : `Crear "${titulo}"`,
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); op.alEnlace?.(titulo); },
      }, (alias || destino).trim()));
    } else if (m[4]) {
      const [, alt, url] = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const u = urlSegura(url);
      salida.push(u ? h('img', { src: u, alt, class: 'bt-md-img', loading: 'lazy' }) : t);
    } else if (m[5]) {
      const [, txt, url] = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const u = urlSegura(url);
      salida.push(u ? h('a', { href: u, target: u.startsWith('#') ? null : '_blank', rel: 'noopener', class: 'bt-link' }, inline(txt, op)) : t);
    } else if (m[6]) salida.push(h('strong', {}, inline(t.slice(2, -2), op)));
    else if (m[7]) salida.push(h('s', {}, inline(t.slice(2, -2), op)));
    else if (m[8]) salida.push(h('mark', {}, inline(t.slice(2, -2), op)));
    else if (m[9]) salida.push(h('em', {}, inline(t.slice(1, -1), op)));
    else if (m[10]) salida.push(h('a', { href: t, target: '_blank', rel: 'noopener', class: 'bt-link' }, t.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)));
    else if (m[11]) {
      const tag = t.slice(1).replace(/\/+$/, '').toLowerCase();
      salida.push(h('a', { href: '#', class: 'bt-tag', onclick: (e) => { e.preventDefault(); e.stopPropagation(); op.alEtiqueta?.(tag); } }, t));
    }
  }
  if (ultimo < texto.length) salida.push(texto.slice(ultimo));
  return salida;
}

const RE_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/;

// Devuelve un elemento con la nota armada.
export function renderizar(texto, op) {
  const { h } = op;
  const lineas = String(texto || '').replace(/\r\n?/g, '\n').split('\n');
  const raiz = h('div', { class: 'bt-md' });
  let i = 0;
  // Si la nota empieza con propiedades (---), no se muestran como texto.
  if (lineas[0] === '---') { const fin = lineas.indexOf('---', 1); if (fin > 0) i = fin + 1; }

  const parrafo = [];
  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const p = h('p');
    parrafo.forEach((l, k) => { if (k) p.append(h('br')); p.append(...inline(l, op)); });
    raiz.append(p);
    parrafo.length = 0;
  };

  while (i < lineas.length) {
    const l = lineas[i];
    // Código
    if (/^\s*```/.test(l)) {
      cerrarParrafo();
      const cod = [];
      i++;
      while (i < lineas.length && !/^\s*```/.test(lineas[i])) cod.push(lineas[i++]);
      i++;
      raiz.append(h('pre', {}, h('code', {}, cod.join('\n'))));
      continue;
    }
    if (!l.trim()) { cerrarParrafo(); i++; continue; }
    // Título
    const tit = l.match(/^(#{1,6})\s+(.*)$/);
    if (tit) { cerrarParrafo(); raiz.append(h(`h${Math.min(6, tit[1].length + 1)}`, { class: 'bt-md-h' }, inline(tit[2], op))); i++; continue; }
    // Separador
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { cerrarParrafo(); raiz.append(h('hr')); i++; continue; }
    // Cita
    if (/^\s*>/.test(l)) {
      cerrarParrafo();
      const cita = [];
      while (i < lineas.length && /^\s*>/.test(lineas[i])) cita.push(lineas[i++].replace(/^\s*>\s?/, ''));
      raiz.append(h('blockquote', {}, [...renderizar(cita.join('\n'), { ...op, alCasilla: null }).childNodes]));
      continue;
    }
    // Tabla
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lineas[i + 1] || '')) {
      cerrarParrafo();
      const celdas = (x) => x.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const cab = celdas(l);
      i += 2;
      const filas = [];
      while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])) filas.push(celdas(lineas[i++]));
      raiz.append(h('div', { class: 'bt-md-tabla' }, h('table', {},
        h('thead', {}, h('tr', {}, cab.map(c => h('th', {}, inline(c, op))))),
        h('tbody', {}, filas.map(f => h('tr', {}, cab.map((_, k) => h('td', {}, inline(f[k] || '', op)))))))));
      continue;
    }
    // Listas (con casillas y sangría)
    if (RE_ITEM.test(l)) {
      cerrarParrafo();
      const pila = [];   // [{ nivel, lista }]
      while (i < lineas.length && RE_ITEM.test(lineas[i])) {
        const [, esp, marca, casilla, contenido] = lineas[i].match(RE_ITEM);
        const nivel = Math.floor(esp.replace(/\t/g, '  ').length / 2);
        const ordenada = /\d/.test(marca);
        while (pila.length && pila[pila.length - 1].nivel > nivel) pila.pop();
        let actual = pila[pila.length - 1];
        if (!actual || actual.nivel < nivel) {
          const lista = h(ordenada ? 'ol' : 'ul', { class: casilla ? 'bt-md-chk' : '' });
          if (actual) (actual.lista.lastElementChild || actual.lista).append(lista); else raiz.append(lista);
          actual = { nivel, lista };
          pila.push(actual);
        }
        const li = h('li');
        if (casilla) {
          const linea = i;
          const marcada = /x/i.test(casilla);
          actual.lista.classList.add('bt-md-chk');
          li.classList.add('bt-md-tarea');
          if (marcada) li.classList.add('hecha');
          li.append(h('input', { type: 'checkbox', checked: marcada, disabled: !op.alCasilla, onclick: (e) => { e.stopPropagation(); op.alCasilla?.(linea, e.target.checked); } }));
          li.append(h('span', {}, inline(contenido, op)));
        } else li.append(...inline(contenido, op));
        actual.lista.append(li);
        i++;
      }
      continue;
    }
    parrafo.push(l);
    i++;
  }
  cerrarParrafo();
  return raiz;
}

// Marca o desmarca la casilla de la línea n del texto.
export function alternarCasilla(texto, linea, marcada) {
  const lineas = String(texto || '').split('\n');
  if (lineas[linea] !== undefined) lineas[linea] = lineas[linea].replace(/\[[ xX]\]/, marcada ? '[x]' : '[ ]');
  return lineas.join('\n');
}
