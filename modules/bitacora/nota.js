// ─────────────────────────────────────────────────────────────
// Bitácora: una nota.
//   Leer: el Markdown armado (casillas tildables, [[enlaces]], #etiquetas, imágenes)
//   Editar: barra de formato + texto; al escribir [[ aparece el buscador de notas
//   Arriba: título (renombrar actualiza los enlaces), campos si está en una base
//   y etiquetas. Abajo: archivos, "Mencionada en" y "Menciones sin enlace".
//   Se guarda solo.
// ─────────────────────────────────────────────────────────────

import { renderizar, alternarCasilla } from './markdown.js';
import { BANDEJA, sumarDias, hoyISO, escaparRegex, comparar, sincronizarRecordatorios } from './modelo.js';
import { ic, ventana, menu, elegirCarpeta, haceCuanto, vacio, marcaCarpeta } from './vistas.js';
import { controlCampo } from './base.js';

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esImagen = (a) => /^image\//.test(a?.tipo || '') || /\.(png|jpe?g|gif|webp|bmp|avif|heic)$/i.test(a?.nombre || '');
const pad = (n) => String(n).padStart(2, '0');

// Abrir una nota por título (o crearla, como Obsidian).
export async function abrirPorTitulo(ctx, m, d, titulo, carpetaId = BANDEJA) {
  const n = d.porTitulo(titulo, carpetaId);
  if (n) { ctx.navegar(`bitacora/n/${n.id}`); return; }
  const id = await m.crearNota({ titulo, carpetaId });
  ctx.aviso(`Nota nueva: "${titulo}"`);
  sessionStorage.setItem('bt-editar', id);
  ctx.navegar(`bitacora/n/${id}`);
}

// Muestra el texto de una nota (lo usan la nota y la portada del Inicio).
export function cuerpoLectura(ctx, m, d, n, { alCasilla = null } = {}) {
  const { h } = ctx;
  return renderizar(n.texto || '', {
    h,
    existe: (t) => !!d.porTitulo(t),
    alEnlace: (t) => abrirPorTitulo(ctx, m, d, t, n.carpetaId || BANDEJA),
    alEtiqueta: (t) => ctx.navegar(`bitacora/e/${encodeURIComponent(t)}`),
    alCasilla,
    imagen: (nombre) => incrustado(ctx, m, d, n, nombre),
  });
}

function incrustado(ctx, m, d, n, nombre) {
  const { h } = ctx;
  const a = (n.adjuntos || []).find(x => x.nombre === nombre) || (n.adjuntos || []).find(x => sinTildes(x.nombre) === sinTildes(nombre));
  if (a && esImagen(a)) {
    const img = h('img', { class: 'bt-img', alt: nombre, loading: 'lazy' });
    const caja = h('button', { type: 'button', class: 'bt-img-caja cargando', title: nombre, onclick: () => visor(ctx, a, img.src) }, img);
    ctx.archivos.urlImagen(a).then(u => { if (u) { img.src = u; caja.classList.remove('cargando'); } else caja.replaceChildren(h('span', { class: 'bt-img-falta' }, `🖼 ${nombre}${a.pendiente ? ' (subiendo…)' : ' (sin conexión)'}`)); })
      .catch(() => caja.replaceChildren(h('span', { class: 'bt-img-falta' }, `🖼 ${nombre}`)));
    return caja;
  }
  if (a) return a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener', class: 'bt-adj-chip' }, ic('clip'), a.nombre) : h('span', { class: 'bt-adj-chip' }, ic('clip'), `${a.nombre} (subiendo…)`);
  const otra = d.porTitulo(nombre);
  if (otra) return h('a', { href: `#/bitacora/n/${otra.id}`, class: 'bt-wl' }, otra.titulo);
  return h('span', { class: 'bt-img-falta' }, `${nombre} (no está)`);
}

function visor(ctx, a, src) {
  const { h } = ctx;
  if (!src) return;
  ventana(ctx, a.nombre, h('div', { class: 'bt-visor' }, h('img', { src, alt: a.nombre })), {
    clase: 'bt-hoja-ancha',
    botones: a.url ? [h('a', { href: a.url, target: '_blank', rel: 'noopener', class: 'boton' }, ic('drive'), 'Abrir en Drive')] : null,
  });
}

// Pedacito de texto alrededor de una mención.
function alrededor(texto, buscado) {
  const t = String(texto || '');
  const i = sinTildes(t).indexOf(sinTildes(buscado));
  if (i < 0) return t.slice(0, 100);
  const desde = Math.max(0, i - 50), hasta = Math.min(t.length, i + buscado.length + 60);
  return `${desde ? '…' : ''}${t.slice(desde, hasta).replace(/\s+/g, ' ')}${hasta < t.length ? '…' : ''}`;
}

// Posición del cursor dentro de un textarea (para ubicar el buscador de [[).
function coordenadasCursor(ta, pos) {
  const div = document.createElement('div');
  const est = getComputedStyle(ta);
  for (const p of ['boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderLeftWidth', 'tabSize']) div.style[p] = est[p];
  Object.assign(div.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '-9999px' });
  div.textContent = ta.value.slice(0, pos);
  const marca = document.createElement('span');
  marca.textContent = '​';
  div.append(marca);
  document.body.append(div);
  const r = { top: marca.offsetTop - ta.scrollTop + parseFloat(est.lineHeight || '20'), left: Math.min(marca.offsetLeft, ta.clientWidth - 40) };
  div.remove();
  return r;
}

export function vistaNota(ctx, m, d, id, main) {
  const { h } = ctx;
  let n = d.nota(id);
  if (!n) {
    main.replaceChildren(vacio(ctx, 'Esta nota no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/bitacora', class: 'boton' }, 'Volver a la Bitácora')));
    return {};
  }
  if (n.papelera) {
    main.replaceChildren(vacio(ctx, `"${n.titulo}" está en la papelera`, null,
      h('button', { type: 'button', class: 'boton principal', onclick: () => m.restaurar(n.id) }, 'Recuperar'),
      h('a', { href: '#/bitacora/papelera', class: 'boton' }, 'Ver papelera')));
    return { actualizar(d2) { if (!d2.nota(id)?.papelera) vistaNota(ctx, m, d2, id, main); } };
  }

  const pedidoEditar = sessionStorage.getItem('bt-editar') === id;
  if (pedidoEditar) sessionStorage.removeItem('bt-editar');
  let modo = pedidoEditar || !String(n.texto || '').trim() ? 'editar' : 'leer';
  let texto = n.texto || '';
  let espera = null, pendiente = false;

  // ── Guardado ──
  const guardarTexto = async () => {
    clearTimeout(espera);
    if (!pendiente) return;
    pendiente = false;
    if (texto !== n.texto) await m.guardarNota(id, { texto });
  };
  const programarGuardado = () => { pendiente = true; clearTimeout(espera); espera = setTimeout(guardarTexto, 700); };
  const guardarProps = (campoId, v) => { n = { ...n, props: { ...(n.props || {}), [campoId]: v } }; return m.guardarNota(id, { props: n.props }); };

  // ── Barra de arriba ──
  const ruta = n.carpetaId ? d.ruta(n.carpetaId) : [];
  const volver = h('a', { href: n.carpetaId ? `#/bitacora/c/${n.carpetaId}` : '#/bitacora/bandeja', class: 'bt-volver' }, '‹ ', ruta.length ? ruta.map(c => c.nombre).join(' › ') : 'Bandeja');
  const segLeer = h('button', { type: 'button', onclick: () => cambiarModo('leer') }, 'Leer');
  const segEditar = h('button', { type: 'button', onclick: () => cambiarModo('editar') }, 'Editar');
  const botonPin = h('button', { type: 'button', class: `boton-icono bt-pin${n.fijada ? ' on' : ''}`, title: n.fijada ? 'Quitar de fijadas' : 'Fijar', 'aria-label': 'Fijar', 'aria-pressed': String(!!n.fijada), onclick: () => m.guardarNota(id, { fijada: !n.fijada }) }, ic('pin'));
  const barra = h('div', { class: 'bt-nota-barra' }, volver, h('span', { class: 'bt-espacio' }),
    h('div', { class: 'bt-seg' }, segLeer, segEditar), botonPin,
    h('button', { type: 'button', class: 'boton-icono', title: 'Más opciones', 'aria-label': 'Más opciones', onclick: () => menuNota() }, ic('puntos')));

  // ── Título ──
  const titulo = h('textarea', { class: 'bt-nota-titulo', rows: 1, 'aria-label': 'Título', placeholder: 'Título', enterkeyhint: 'done' }, n.titulo);
  const ajustarAlto = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  titulo.addEventListener('input', () => ajustarAlto(titulo));
  titulo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); titulo.blur(); if (modo === 'editar') area.focus(); } });
  titulo.addEventListener('change', async () => {
    const nuevo = titulo.value.replace(/\s+/g, ' ').trim();
    if (!nuevo) { titulo.value = n.titulo; return; }
    if (nuevo === n.titulo) return;
    const cambiadas = await m.renombrar(id, nuevo);
    n = { ...n, titulo: nuevo };
    if (cambiadas) ctx.aviso(`Se actualizaron los enlaces en ${cambiadas} nota${cambiadas === 1 ? '' : 's'}`);
  });

  // ── Propiedades: campos de la base + etiquetas ──
  const zonaProps = h('div', { class: 'bt-props' });
  function pintarProps() {
    const c = d.carpeta(n.carpetaId);
    const filas = [];
    if (c?.base) for (const f of c.campos || []) {
      const v = f.tipo === 'auto' ? (f.auto === 'creada' ? n.creado : n.modificado) : n.props?.[f.id];
      filas.push(h('div', { class: 'bt-prop' }, h('span', { class: 'bt-prop-n' }, f.nombre), h('div', { class: 'bt-prop-v' }, controlCampo(ctx, m, d, f, v, (x) => guardarProps(f.id, x)))));
    }
    const etiq = n.etiquetas || [];
    const nueva = h('input', { type: 'text', class: 'bt-tag-input', placeholder: '+ etiqueta', 'aria-label': 'Agregar etiqueta', enterkeyhint: 'done', autocomplete: 'off' });
    const agregar = () => {
      const t = nueva.value.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();
      if (!t || etiq.includes(t)) { nueva.value = ''; return; }
      m.guardarNota(id, { etiquetas: [...etiq, t] });
    };
    nueva.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregar(); } });
    nueva.addEventListener('change', agregar);
    filas.push(h('div', { class: 'bt-prop' }, h('span', { class: 'bt-prop-n' }, 'Etiquetas'), h('div', { class: 'bt-prop-v bt-tags' },
      etiq.map(t => h('span', { class: 'bt-tag-chip' }, h('a', { href: `#/bitacora/e/${encodeURIComponent(t)}`, class: 'bt-tag' }, '#' + t),
        h('button', { type: 'button', 'aria-label': `Quitar #${t}`, onclick: () => m.guardarNota(id, { etiquetas: etiq.filter(x => x !== t) }) }, '×'))),
      nueva)));
    zonaProps.replaceChildren(...filas);
  }

  // ── Cuerpo ──
  const zonaCuerpo = h('div', { class: 'bt-cuerpo' });
  const area = h('textarea', { class: 'bt-editor', 'aria-label': 'Texto de la nota', placeholder: 'Escribí acá… (Markdown: # título, **negrita**, - lista, - [ ] casilla, [[otra nota]], #etiqueta)', spellcheck: 'true' });
  const pop = h('div', { class: 'bt-pop', hidden: true, role: 'listbox' });
  const elegirArchivo = h('input', { type: 'file', multiple: true, hidden: true });
  elegirArchivo.addEventListener('change', () => { const f = [...elegirArchivo.files]; elegirArchivo.value = ''; subir(f); });

  const herramienta = (contenido, titulo2, fn) => h('button', { type: 'button', class: 'bt-hb', title: titulo2, 'aria-label': titulo2, onmousedown: (e) => e.preventDefault(), onclick: fn }, contenido);
  const barraFormato = h('div', { class: 'bt-formato' },
    herramienta(h('b', {}, 'B'), 'Negrita', () => envolver('**')),
    herramienta(h('i', {}, 'I'), 'Cursiva', () => envolver('*')),
    herramienta(h('s', {}, 'S'), 'Tachado', () => envolver('~~')),
    herramienta('H', 'Título (tocá de nuevo para cambiar el nivel)', ciclarTitulo),
    herramienta('•', 'Lista', () => prefijo('- ')),
    herramienta('1.', 'Lista numerada', () => prefijo('1. ')),
    herramienta('☐', 'Casilla', () => prefijo('- [ ] ')),
    herramienta('[[ ]]', 'Enlazar otra nota', () => { insertar('[['); revisarPop(); }),
    herramienta('#', 'Etiqueta', () => insertar('#')),
    herramienta('🔗', 'Link', () => envolver('[', '](https://)')),
    herramienta(ic('clip'), 'Subir archivo o foto', () => elegirArchivo.click()),
    ctx.archivos.selectorDisponible() ? herramienta(ic('drive'), 'Enlazar archivo de Drive', elegirDeDrive) : null,
    navigator.clipboard?.read ? herramienta(ic('portapapeles'), 'Pegar imagen copiada', pegarDesdeBoton) : null,
    elegirArchivo);

  function marcarCambio() { texto = area.value; programarGuardado(); revisarPop(); }
  area.addEventListener('input', () => { marcarCambio(); ajustarAlto(area); });
  area.addEventListener('blur', () => { setTimeout(() => { if (!pop.contains(document.activeElement)) cerrarPop(); }, 150); guardarTexto(); });
  area.addEventListener('click', revisarPop);
  area.addEventListener('paste', (e) => {
    const archivos = [...(e.clipboardData?.files || [])];
    if (!archivos.length) return;
    e.preventDefault();
    subir(archivos);
  });
  area.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
  area.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files || [])]; if (!f.length) return; e.preventDefault(); subir(f); });

  function reemplazar(desde, hasta, nuevo, selDesde, selHasta) {
    area.focus();
    area.setRangeText(nuevo, desde, hasta, 'end');
    if (selDesde !== undefined) area.setSelectionRange(selDesde, selHasta ?? selDesde);
    marcarCambio();
    ajustarAlto(area);
  }
  function envolver(antes, despues = antes) {
    const s = area.selectionStart, e = area.selectionEnd;
    const sel = area.value.slice(s, e) || 'texto';
    reemplazar(s, e, antes + sel + despues, s + antes.length, s + antes.length + sel.length);
  }
  function insertar(t) { const s = area.selectionStart, e = area.selectionEnd; reemplazar(s, e, t); }
  function lineasSeleccionadas() {
    const v = area.value, s = area.selectionStart, e = area.selectionEnd;
    const ini = v.lastIndexOf('\n', s - 1) + 1;
    let fin = v.indexOf('\n', e); if (fin < 0) fin = v.length;
    return { ini, fin, lineas: v.slice(ini, fin).split('\n') };
  }
  function prefijo(p) {
    const { ini, fin, lineas } = lineasSeleccionadas();
    const todas = lineas.every(l => l.startsWith(p));
    const nuevas = lineas.map(l => (todas ? l.slice(p.length) : p + l.replace(/^(\s*)([-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '$1')));
    const t = nuevas.join('\n');
    reemplazar(ini, fin, t, ini + t.length);
  }
  function ciclarTitulo() {
    const { ini, fin, lineas } = lineasSeleccionadas();
    const l = lineas[0];
    const nivel = (l.match(/^(#{1,6})\s/) || ['', ''])[1].length;
    const sinMarca = l.replace(/^#{1,6}\s+/, '');
    const nueva = nivel >= 3 ? sinMarca : `${'#'.repeat(nivel + 1)} ${sinMarca}`;
    reemplazar(ini, ini + l.length, nueva, ini + nueva.length);
    void fin;
  }

  // ── Buscador de [[ ──
  let opcionesPop = [], elegida = 0, inicioPop = -1;
  function revisarPop() {
    const antes = area.value.slice(0, area.selectionStart);
    const mm = antes.match(/\[\[([^\]\n|#]*)$/);
    if (!mm || area.selectionStart !== area.selectionEnd) { cerrarPop(); return; }
    inicioPop = antes.length - mm[1].length;
    const q = sinTildes(mm[1].trim());
    const lista = d.notas.filter(x => x.id !== id && (!q || sinTildes(x.titulo).includes(q)))
      .sort((a, b) => (sinTildes(b.titulo).startsWith(q) ? 1 : 0) - (sinTildes(a.titulo).startsWith(q) ? 1 : 0) || b.modificado - a.modificado).slice(0, 7);
    opcionesPop = lista.map(x => ({ titulo: x.titulo, sub: d.nombreRuta(x.carpetaId) }));
    if (mm[1].trim() && !lista.some(x => sinTildes(x.titulo) === q)) opcionesPop.push({ titulo: mm[1].trim(), sub: 'Enlace a una nota nueva (se crea al tocarlo)', nueva: true });
    if (!opcionesPop.length) { cerrarPop(); return; }
    elegida = Math.min(elegida, opcionesPop.length - 1);
    pintarPop();
    const { top, left } = coordenadasCursor(area, area.selectionStart);
    pop.style.top = `${area.offsetTop + top + 4}px`;
    pop.style.left = `${area.offsetLeft + Math.max(0, left - 10)}px`;
    pop.hidden = false;
  }
  function pintarPop() {
    pop.replaceChildren(...opcionesPop.map((o, i) => h('button', { type: 'button', role: 'option', class: `bt-pop-op${i === elegida ? ' sel' : ''}${o.nueva ? ' nueva' : ''}`, 'aria-selected': String(i === elegida), onmousedown: (e) => e.preventDefault(), onclick: () => usarPop(i) },
      h('b', {}, o.nueva ? `+ ${o.titulo}` : o.titulo), h('small', {}, o.sub))));
  }
  function cerrarPop() { pop.hidden = true; opcionesPop = []; elegida = 0; }
  function usarPop(i) {
    const o = opcionesPop[i];
    if (!o) return;
    const fin = area.selectionStart;
    const cierra = area.value.slice(fin, fin + 2) === ']]';
    reemplazar(inicioPop, fin + (cierra ? 2 : 0), `${o.titulo}]]`);
    cerrarPop();
  }
  area.addEventListener('keydown', (e) => {
    if (pop.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); elegida = (elegida + 1) % opcionesPop.length; pintarPop(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); elegida = (elegida - 1 + opcionesPop.length) % opcionesPop.length; pintarPop(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); usarPop(elegida); }
    else if (e.key === 'Escape') { e.preventDefault(); cerrarPop(); }
  });

  // ── Archivos ──
  const nombreUnico = (nombre) => {
    const usados = new Set((n.adjuntos || []).map(a => a.nombre.toLowerCase()));
    if (!usados.has(nombre.toLowerCase())) return nombre;
    const [, base, ext] = nombre.match(/^(.*?)(\.[^.]*)?$/);
    let i = 2;
    while (usados.has(`${base} (${i})${ext || ''}`.toLowerCase())) i++;
    return `${base} (${i})${ext || ''}`;
  };
  async function subir(archivos) {
    for (const f0 of archivos) {
      const d0 = new Date();
      const base = /^image\.\w+$/i.test(f0.name) || !f0.name ? `Pegado ${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())} ${pad(d0.getHours())}${pad(d0.getMinutes())}${pad(d0.getSeconds())}.${(f0.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}` : f0.name;
      const nombre = nombreUnico(base);
      const f = new File([f0], nombre, { type: f0.type });
      const marca = `![[${nombre}]]`;
      if (modo === 'editar') insertar((area.selectionStart > 0 && area.value[area.selectionStart - 1] !== '\n' ? '\n' : '') + marca + '\n');
      else { texto = `${texto}${texto && !texto.endsWith('\n') ? '\n' : ''}${marca}\n`; }
      const aviso = ctx.aviso(`Subiendo ${nombre}…`, { duracion: 0 });
      try {
        const info = await ctx.archivos.subir(f);
        n = { ...n, adjuntos: [...(n.adjuntos || []), { ...info, nombre, origen: 'subido' }] };
        await m.guardarNota(id, { adjuntos: n.adjuntos, texto });
        aviso.remove();
        if (info.pendiente) ctx.aviso(`${nombre} se sube a Drive cuando haya conexión.`);
      } catch (e) {
        aviso.remove();
        ctx.aviso(`No se pudo subir ${nombre}: ${e.message}`);
      }
    }
    if (modo === 'leer') pintarCuerpo();
    pintarArchivos();
  }
  async function pegarDesdeBoton() {
    try {
      const items = await navigator.clipboard.read();
      const archivos = [];
      for (const it of items) for (const t of it.types) if (t.startsWith('image/')) archivos.push(new File([await it.getType(t)], `image.${t.split('/')[1]}`, { type: t }));
      if (!archivos.length) { ctx.aviso('No hay una imagen copiada.'); return; }
      subir(archivos);
    } catch { ctx.aviso('No se pudo leer lo copiado. Probá con Ctrl+V adentro del texto.'); }
  }
  async function elegirDeDrive() {
    try {
      const elegidos = await ctx.archivos.elegirDeDrive();
      if (!elegidos.length) return;
      n = { ...n, adjuntos: [...(n.adjuntos || []), ...elegidos.map(a => ({ ...a, nombre: nombreUnico(a.nombre), origen: 'drive' }))] };
      const lineas = elegidos.map(a => `[📎 ${a.nombre}](${a.url})`).join('\n');
      if (modo === 'editar') insertar(lineas + '\n'); else texto = `${texto}\n${lineas}\n`;
      await m.guardarNota(id, { adjuntos: n.adjuntos, texto });
      if (modo === 'leer') pintarCuerpo();
      pintarArchivos();
    } catch (e) { ctx.aviso(e.message); }
  }
  const zonaArchivos = h('div', { class: 'bt-archivos' });
  function pintarArchivos() {
    const adj = n.adjuntos || [];
    zonaArchivos.replaceChildren(...(adj.length ? [h('h3', { class: 'bt-sec-h' }, `Archivos (${adj.length})`),
      h('div', { class: 'bt-adj-lista' }, adj.map(a => h('div', { class: 'bt-adj' },
        h('span', { class: 'bt-adj-ic' }, esImagen(a) ? '🖼' : '📎'),
        a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener' }, a.nombre) : h('span', {}, a.nombre, a.pendiente ? ' (subiendo…)' : ''),
        h('small', {}, a.origen === 'drive' ? 'enlazado de Drive' : 'subido'),
        h('button', { type: 'button', class: 'boton-icono bt-chico', 'aria-label': `Quitar ${a.nombre}`, title: 'Quitar de la nota (el archivo queda en Drive)', onclick: async () => {
          if (!await ctx.confirmar(`¿Quitar "${a.nombre}" de la nota? El archivo queda en tu Drive.`, { si: 'Quitar' })) return;
          n = { ...n, adjuntos: adj.filter(x => x !== a) };
          texto = texto.split('\n').filter(l => l.trim() !== `![[${a.nombre}]]`).join('\n');
          if (modo === 'editar') area.value = texto;
          await m.guardarNota(id, { adjuntos: n.adjuntos, texto });
          pintarArchivos(); if (modo === 'leer') pintarCuerpo();
        } }, ctx.icono('cerrar')))))] : []));
  }

  // ── Menciones ──
  const zonaMenciones = h('div', { class: 'bt-menciones' });
  const abiertas = { con: true, sin: false };
  function pintarMenciones() {
    const con = d.menciones(n);
    const sin = d.sinEnlace(n);
    const sec = (clave, titulo2, lista, fila) => [
      h('button', { type: 'button', class: `bt-men-tit${abiertas[clave] ? ' abierta' : ''}`, onclick: () => { abiertas[clave] = !abiertas[clave]; pintarMenciones(); } }, ic('flecha', 'icono bt-men-fl'), `${titulo2} (${lista.length})`),
      abiertas[clave] ? h('div', { class: 'bt-men-lista' }, lista.length ? lista.map(fila) : h('p', { class: 'nota' }, 'Ninguna.')) : null,
    ];
    zonaMenciones.replaceChildren(...[
      ...sec('con', 'Mencionada en', con, x => h('a', { href: `#/bitacora/n/${x.id}`, class: 'bt-men' }, h('b', {}, x.titulo), h('span', {}, alrededor(x.texto, `[[${n.titulo}`)))),
      ...sec('sin', 'Menciones sin enlace', sin, x => h('div', { class: 'bt-men' },
        h('a', { href: `#/bitacora/n/${x.id}` }, h('b', {}, x.titulo)), h('span', {}, alrededor(x.texto, n.titulo)),
        h('button', { type: 'button', class: 'boton bt-chico', onclick: () => enlazar(x) }, 'Enlazar'))),
    ].filter(Boolean));
  }
  async function enlazar(x) {
    const partes = String(x.texto || '').split(/(\[\[[^\]]*\]\])/);
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaparRegex(n.titulo)})(?=$|[^\\p{L}\\p{N}])`, 'iu');
    let hecho = false;
    const nuevas = partes.map((p, i) => {
      if (hecho || i % 2) return p;
      return p.replace(re, (todo, pre, encontrado) => { hecho = true; return `${pre}[[${n.titulo}${encontrado === n.titulo ? '' : '|' + encontrado}]]`; });
    });
    if (!hecho) { ctx.aviso('No se encontró el texto exacto (puede ser por tildes). Abrí la nota y enlazalo a mano.'); return; }
    await m.guardarNota(x.id, { texto: nuevas.join('') });
    ctx.aviso(`Enlazada en "${x.titulo}"`);
  }

  const pie = h('p', { class: 'bt-pie' });
  const pintarPie = () => { pie.textContent = `Editada ${haceCuanto(n.modificado)} · Creada ${new Date(n.creado).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`; };

  function pintarCuerpo() {
    segLeer.classList.toggle('sel', modo === 'leer');
    segEditar.classList.toggle('sel', modo === 'editar');
    if (modo === 'editar') {
      area.value = texto;
      zonaCuerpo.replaceChildren(barraFormato, h('div', { class: 'bt-editor-caja' }, area, pop));
      requestAnimationFrame(() => ajustarAlto(area));
    } else {
      const cuerpo = String(texto || '').trim()
        ? cuerpoLectura(ctx, m, d, { ...n, texto }, { alCasilla: async (linea, marcada) => { texto = alternarCasilla(texto, linea, marcada); n = { ...n, texto }; await m.guardarNota(id, { texto }); pintarCuerpo(); } })
        : h('button', { type: 'button', class: 'bt-vacio-nota', onclick: () => cambiarModo('editar') }, 'Nota vacía. Tocá para escribir.');
      zonaCuerpo.replaceChildren(cuerpo);
    }
  }
  async function cambiarModo(nuevo) {
    if (modo === nuevo) return;
    await guardarTexto();
    modo = nuevo;
    pintarCuerpo();
    if (modo === 'editar') setTimeout(() => { area.focus(); area.setSelectionRange(area.value.length, area.value.length); }, 30);
  }

  // ── Menú ⋯ ──
  let puedeRecordar = false, puedeTarea = false;
  ctx.existeAccion?.('sistema-sincronizar').then(x => { puedeRecordar = x; });
  ctx.existeAccion?.('nueva-tarea').then(x => { puedeTarea = x; });
  function menuNota() {
    menu(ctx, n.titulo, [
      puedeRecordar ? { icono: 'reloj', texto: 'Recordarme esta nota', nota: 'Crea una tarea en Tareas › Sistemas › Bitácora', accion: recordarme } : null,
      puedeTarea ? { icono: 'check', texto: 'Crear tarea desde esta nota', nota: 'La tarea queda con un link a la nota', accion: () => ctx.pedir('nueva-tarea', { titulo: n.titulo, origen: { modulo: 'bitacora', clave: `bitacora-tarea:${id}:${Date.now()}`, enlace: `bitacora/n/${id}` } }).catch(e => ctx.aviso(e.message)) } : null,
      { icono: 'carpeta', texto: 'Mover a carpeta…', accion: async () => { const x = await elegirCarpeta(ctx, d, { actual: n.carpetaId || BANDEJA }); if (x !== null && x !== (n.carpetaId || '')) { await m.guardarNota(id, { carpetaId: x }); ctx.aviso(`Movida a ${d.nombreRuta(x)}`); } } },
      { icono: 'pin', texto: n.fijada ? 'Quitar de fijadas' : 'Fijar en el Inicio', accion: () => m.guardarNota(id, { fijada: !n.fijada }) },
      { icono: 'tarjetas', texto: 'Duplicar', accion: async () => { const x = await m.duplicar(id); ctx.navegar(`bitacora/n/${x}`); } },
      { icono: 'nota', texto: 'Copiar enlace [[…]]', nota: 'Para pegarlo en otra nota', accion: async () => { try { await navigator.clipboard.writeText(`[[${n.titulo}]]`); ctx.aviso('Enlace copiado'); } catch { ctx.aviso(`[[${n.titulo}]]`); } } },
      { icono: 'papelera', texto: 'Mandar a la papelera', peligro: true, accion: async () => {
        await guardarTexto();
        await m.aPapelera(id);
        ctx.aviso('Nota en la papelera', { accion: 'Deshacer', alTocar: async () => { await m.restaurar(id); ctx.navegar(`bitacora/n/${id}`); } });
        ctx.navegar(n.carpetaId ? `bitacora/c/${n.carpetaId}` : 'bitacora');
      } },
    ]);
  }

  function recordarme() {
    const hoy = hoyISO();
    const dia = new Date().getDay();
    const lunes = sumarDias(hoy, ((8 - dia) % 7) || 7);
    const mes = (k) => { const d0 = new Date(); d0.setMonth(d0.getMonth() + k); return `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`; };
    const opciones = [['Mañana', sumarDias(hoy, 1)], ['Próximo lunes', lunes], ['En 1 semana', sumarDias(hoy, 7)], ['En 1 mes', mes(1)], ['En 3 meses', mes(3)]];
    let fecha = opciones[1][1];
    const fechaInput = h('input', { type: 'date', value: fecha, min: hoy, 'aria-label': 'Fecha' });
    const botones = h('div', { class: 'bt-opc' });
    const pintar = () => botones.replaceChildren(...opciones.map(([t, f]) => h('button', { type: 'button', class: f === fecha ? 'sel' : '', onclick: () => { fecha = f; fechaInput.value = f; pintar(); } }, t)));
    fechaInput.addEventListener('change', () => { fecha = fechaInput.value; pintar(); });
    pintar();
    const tit = h('input', { type: 'text', value: `Ver: ${n.titulo}`, 'aria-label': 'Título de la tarea' });
    const dlg = ventana(ctx, 'Recordarme esta nota', h('div', { class: 'formulario-campos' },
      h('p', { class: 'nota' }, 'Crea una tarea en Tareas › Sistemas › Bitácora con un link a esta nota.'),
      botones,
      h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'O elegí la fecha'), fechaInput),
      h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Título de la tarea'), tit)), {
      botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { type: 'button', class: 'boton principal', onclick: async () => {
          if (!fecha) return;
          await m.crearRecordatorio({ notaId: id, titulo: tit.value.trim() || `Ver: ${n.titulo}`, fecha });
          dlg.close();
          await sincronizarRecordatorios(ctx);
          ctx.aviso(`Listo. Te la recuerda el ${new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} en Tareas.`);
        } }, 'Recordarme')],
    });
  }

  // ── Armar ──
  pintarProps(); pintarCuerpo(); pintarArchivos(); pintarMenciones(); pintarPie();
  main.replaceChildren(h('article', { class: 'bt-nota' }, barra, titulo, zonaProps, zonaCuerpo, zonaArchivos, zonaMenciones, pie));
  requestAnimationFrame(() => ajustarAlto(titulo));
  if (pedidoEditar) setTimeout(() => { if (n.titulo === 'Sin título') { titulo.focus(); titulo.select(); } else area.focus(); }, 60);

  return {
    actualizar(d2) {
      d = d2;
      const nuevo = d.nota(id);
      if (!nuevo || nuevo.papelera) return;
      const antes = n;
      n = nuevo;
      if (document.activeElement !== titulo) titulo.value = n.titulo;
      botonPin.classList.toggle('on', !!n.fijada);
      botonPin.setAttribute('aria-pressed', String(!!n.fijada));
      const escribiendo = pendiente || document.activeElement === area;
      if (!escribiendo && n.texto !== texto) { texto = n.texto || ''; pintarCuerpo(); }
      else if (modo === 'leer' && (antes.adjuntos || []).length !== (n.adjuntos || []).length) pintarCuerpo();
      if (!zonaProps.contains(document.activeElement)) pintarProps();
      pintarArchivos(); pintarMenciones(); pintarPie();
      const r = n.carpetaId ? d.ruta(n.carpetaId) : [];
      volver.href = n.carpetaId ? `#/bitacora/c/${n.carpetaId}` : '#/bitacora/bandeja';
      volver.replaceChildren('‹ ', r.length ? r.map(c => c.nombre).join(' › ') : 'Bandeja');
    },
    limpiar() { guardarTexto(); },
  };
}

export { comparar, marcaCarpeta };
