// ─────────────────────────────────────────────────────────────
// Bitácora: una nota.
//   Se escribe sobre la vista final (editor con formato del núcleo): títulos,
//   negrita, listas, casillas, [[enlaces]], #etiquetas e imágenes. Se guarda
//   como Markdown (compatible con Obsidian). Al escribir [[ aparece el buscador.
//   Arriba: título (renombrar actualiza los enlaces), campos si está en una base
//   y etiquetas. Abajo: archivos, "Mencionada en" y "Menciones sin enlace".
//   Se guarda solo.
// ─────────────────────────────────────────────────────────────

import { renderizar } from './markdown.js';
import { BANDEJA, sumarDias, hoyISO, escaparRegex, comparar, sincronizarRecordatorios } from './modelo.js';
import { ic, ventana, menu, elegirCarpeta, haceCuanto, vacio, marcaCarpeta, poner } from './vistas.js';
import { controlCampo } from './base.js';
import { encabezadoCine } from './filmoteca.js';

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
    ctx.archivos.urlImagen(a).then(u => { if (u) { img.src = u; caja.classList.remove('cargando'); } else poner(caja, h('span', { class: 'bt-img-falta' }, ic('imagen'), ` ${nombre}${a.pendiente ? ' (subiendo…)' : ' (sin conexión)'}`)); })
      .catch(() => poner(caja, h('span', { class: 'bt-img-falta' }, ic('imagen'), ` ${nombre}`)));
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

// En el celular, el teclado solo se abre si el foco se pide en el mismo toque.
// Como la ventana de la tarea se abre un instante después, se enfoca antes un
// campo invisible y la ventana le pasa el foco al título.
function abrirTecladoYa() {
  const i = document.createElement('input');
  i.setAttribute('aria-hidden', 'true');
  i.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.append(i);
  i.focus();
  setTimeout(() => i.remove(), 2500);
}

export function vistaNota(ctx, m, d, id, main) {
  const { h } = ctx;
  let n = d.nota(id);
  if (!n) {
    poner(main, vacio(ctx, 'Esta nota no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/bitacora', class: 'boton' }, 'Volver a la Bitácora')));
    return {};
  }
  if (n.papelera) {
    poner(main, vacio(ctx, `"${n.titulo}" está en la papelera`, null,
      h('button', { type: 'button', class: 'boton principal', onclick: () => m.restaurar(n.id) }, 'Recuperar'),
      h('a', { href: '#/bitacora/papelera', class: 'boton' }, 'Ver papelera')));
    return { actualizar(d2) { if (!d2.nota(id)?.papelera) vistaNota(ctx, m, d2, id, main); } };
  }

  const pedidoEditar = sessionStorage.getItem('bt-editar') === id;
  if (pedidoEditar) sessionStorage.removeItem('bt-editar');
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
  const destinoVolver = () => (n.cine ? '#/bitacora/f' : n.carpetaId ? `#/bitacora/c/${n.carpetaId}` : '#/bitacora/bandeja');
  const textoVolver = (r) => (n.cine ? 'Filmoteca' : r.length ? r.map(c => c.nombre).join(' › ') : 'Bandeja');
  const volver = h('a', { href: destinoVolver(), class: 'bt-volver' }, '‹ ', textoVolver(ruta));
  const botonPin = h('button', { type: 'button', class: `boton-icono bt-pin${n.fijada ? ' on' : ''}`, title: n.fijada ? 'Quitar de fijadas' : 'Fijar', 'aria-label': 'Fijar', 'aria-pressed': String(!!n.fijada), onclick: () => m.guardarNota(id, { fijada: !n.fijada }) }, ic('pin'));
  const barra = h('div', { class: 'bt-nota-barra' }, volver, h('span', { class: 'bt-espacio' }),
    botonPin,
    h('button', { type: 'button', class: 'boton-icono', title: 'Más opciones', 'aria-label': 'Más opciones', onclick: () => menuNota() }, ic('puntos')));

  // ── Título ──
  const titulo = h('textarea', { class: 'bt-nota-titulo', rows: 1, 'aria-label': 'Título', placeholder: 'Título', enterkeyhint: 'done' }, n.titulo);
  const ajustarAlto = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  titulo.addEventListener('input', () => ajustarAlto(titulo));
  titulo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); titulo.blur(); editor.enfocar(false); } });
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
    poner(zonaProps, ...filas);
  }

  // ── Cuerpo: editor con formato ──
  const zonaCuerpo = h('div', { class: 'bt-cuerpo' });
  const elegirArchivo = h('input', { type: 'file', multiple: true, hidden: true });
  elegirArchivo.addEventListener('change', () => { const f = [...elegirArchivo.files]; elegirArchivo.value = ''; subir(f); });

  // Buscador de [[: notas que coinciden y, si no existe, la opción de crearla.
  function buscarNotas(q0) {
    const q = sinTildes(String(q0 || '').trim());
    const lista = d.notas.filter(x => x.id !== id && !x.papelera && (!q || sinTildes(x.titulo).includes(q)))
      .sort((a, b) => (sinTildes(b.titulo).startsWith(q) ? 1 : 0) - (sinTildes(a.titulo).startsWith(q) ? 1 : 0) || b.modificado - a.modificado).slice(0, 7);
    const ops = lista.map(x => ({ titulo: x.titulo, sub: d.nombreRuta(x.carpetaId) }));
    if (q && !lista.some(x => sinTildes(x.titulo) === q)) ops.push({ titulo: String(q0).trim(), sub: 'Enlace a una nota nueva (se crea al tocarlo)', nueva: true });
    return ops;
  }
  const editor = ctx.editorTexto({
    valor: texto,
    clase: 'bt-ed',
    etiqueta: 'Texto de la nota',
    placeholder: 'Escribí acá…  [[ para enlazar otra nota, #etiqueta para etiquetar',
    etiquetas: true,
    enlaces: { buscar: buscarNotas, alAbrir: (t) => { guardarTexto(); abrirPorTitulo(ctx, m, d, t, n.carpetaId || BANDEJA); } },
    incrustar: (nombre) => incrustado(ctx, m, d, n, nombre),
    alPegarArchivos: (archivos) => subir(archivos),
    alCambiar: (md) => { texto = md; programarGuardado(); },
    alSalir: () => guardarTexto(),
  });
  const herramienta = (contenido, titulo2, fn) => h('button', { type: 'button', class: 'bt-hb', title: titulo2, 'aria-label': titulo2, onmousedown: (e) => e.preventDefault(), onclick: fn }, contenido);
  const barraArchivos = h('div', { class: 'bt-formato bt-formato-chica' },
    herramienta('[[ ]]', 'Enlazar otra nota', () => { editor.enfocar(!editor.tieneFoco()); document.execCommand('insertText', false, '[['); }),
    herramienta(ic('clip'), 'Subir archivo o foto', () => elegirArchivo.click()),
    ctx.archivos.selectorDisponible() ? herramienta(ic('drive'), 'Enlazar archivo de Drive', elegirDeDrive) : null,
    navigator.clipboard?.read ? herramienta(ic('portapapeles'), 'Pegar imagen copiada', pegarDesdeBoton) : null,
    elegirArchivo);
  poner(zonaCuerpo, barraArchivos, editor.el);

  // Para insertar algo donde estaba el cursor aunque se haya ido a otro lado.
  let rangoGuardado = null;
  const recordarCursor = () => {
    const sel = getSelection();
    rangoGuardado = sel.rangeCount && editor.area.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  };
  function insertarEnCursor(md) {
    if (rangoGuardado && editor.area.contains(rangoGuardado.startContainer)) {
      editor.area.focus();
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rangoGuardado);
    }
    rangoGuardado = null;
    editor.insertarMd(md);
  }

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
    recordarCursor();
    for (const f0 of archivos) {
      const d0 = new Date();
      const base = /^image\.\w+$/i.test(f0.name) || !f0.name ? `Pegado ${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())} ${pad(d0.getHours())}${pad(d0.getMinutes())}${pad(d0.getSeconds())}.${(f0.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}` : f0.name;
      const nombre = nombreUnico(base);
      const f = new File([f0], nombre, { type: f0.type });
      const marca = `![[${nombre}]]`;
      const aviso = ctx.aviso(`Subiendo ${nombre}…`, { duracion: 0 });
      try {
        const info = await ctx.archivos.subir(f);
        n = { ...n, adjuntos: [...(n.adjuntos || []), { ...info, nombre, origen: 'subido' }] };
        insertarEnCursor(marca);
        recordarCursor();
        texto = editor.valor();
        pendiente = false; clearTimeout(espera);
        await m.guardarNota(id, { adjuntos: n.adjuntos, texto });
        aviso.remove();
        if (info.pendiente) ctx.aviso(`${nombre} se sube a Drive cuando haya conexión.`);
      } catch (e) {
        aviso.remove();
        ctx.aviso(`No se pudo subir ${nombre}: ${e.message}`);
      }
    }
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
      recordarCursor();
      const elegidos = await ctx.archivos.elegirDeDrive();
      if (!elegidos.length) return;
      n = { ...n, adjuntos: [...(n.adjuntos || []), ...elegidos.map(a => ({ ...a, nombre: nombreUnico(a.nombre), origen: 'drive' }))] };
      const lineas = elegidos.map(a => `[${a.nombre}](${a.url})`).join('\n');
      insertarEnCursor(lineas);
      texto = editor.valor();
      pendiente = false; clearTimeout(espera);
      await m.guardarNota(id, { adjuntos: n.adjuntos, texto });
      pintarArchivos();
    } catch (e) { ctx.aviso(e.message); }
  }
  const zonaArchivos = h('div', { class: 'bt-archivos' });
  function pintarArchivos() {
    const adj = n.adjuntos || [];
    poner(zonaArchivos, ...(adj.length ? [h('h3', { class: 'bt-sec-h' }, `Archivos (${adj.length})`),
      h('div', { class: 'bt-adj-lista' }, adj.map(a => h('div', { class: 'bt-adj' },
        h('span', { class: 'bt-adj-ic' }, ic(esImagen(a) ? 'imagen' : 'clip')),
        a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener' }, a.nombre) : h('span', {}, a.nombre, a.pendiente ? ' (subiendo…)' : ''),
        h('small', {}, a.origen === 'drive' ? 'enlazado de Drive' : 'subido'),
        h('button', { type: 'button', class: 'boton-icono bt-chico', 'aria-label': `Quitar ${a.nombre}`, title: 'Quitar de la nota (el archivo queda en Drive)', onclick: async () => {
          if (!await ctx.confirmar(`¿Quitar "${a.nombre}" de la nota? El archivo queda en tu Drive.`, { si: 'Quitar' })) return;
          n = { ...n, adjuntos: adj.filter(x => x !== a) };
          texto = texto.split('\n').filter(l => l.trim() !== `![[${a.nombre}]]`).join('\n');
          editor.poner(texto);
          pendiente = false; clearTimeout(espera);
          await m.guardarNota(id, { adjuntos: n.adjuntos, texto });
          pintarArchivos();
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
    poner(zonaMenciones, ...[
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

  // ── Menú ⋯ ──
  let puedeRecordar = false, puedeTarea = false;
  ctx.existeAccion?.('sistema-sincronizar').then(x => { puedeRecordar = x; });
  ctx.existeAccion?.('nueva-tarea').then(x => { puedeTarea = x; });
  function menuNota() {
    menu(ctx, n.titulo, [
      puedeRecordar ? { icono: 'reloj', texto: 'Recordarme esta nota', nota: 'Crea una tarea en Tareas › Sistemas › Bitácora', accion: recordarme } : null,
      puedeTarea ? { icono: 'check', texto: 'Crear tarea desde esta nota', nota: 'La tarea queda con un link a la nota', accion: () => abrirTecladoYa() || ctx.pedir('nueva-tarea', { titulo: n.titulo, origen: { modulo: 'bitacora', clave: `bitacora-tarea:${id}:${Date.now()}`, enlace: `bitacora/n/${id}` } }).catch(e => ctx.aviso(e.message)) } : null,
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
    const pintar = () => poner(botones, ...opciones.map(([t, f]) => h('button', { type: 'button', class: f === fecha ? 'sel' : '', onclick: () => { fecha = f; fechaInput.value = f; pintar(); } }, t)));
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
  pintarProps(); pintarArchivos(); pintarMenciones(); pintarPie();
  const cine = n.cine ? encabezadoCine(ctx, m, d, n) : null;
  poner(main, cine
    ? h('article', { class: 'bt-nota fm-nota' }, barra, cine.el, h('h3', { class: 'bt-sec-h fm-notas-h' }, 'Notas'), zonaProps, zonaCuerpo, zonaArchivos, zonaMenciones, pie)
    : h('article', { class: 'bt-nota' }, barra, titulo, zonaProps, zonaCuerpo, zonaArchivos, zonaMenciones, pie));
  requestAnimationFrame(() => ajustarAlto(titulo));
  if (pedidoEditar) setTimeout(() => { if (n.titulo === 'Sin título') { titulo.focus(); titulo.select(); } else editor.enfocar(); }, 60);

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
      const escribiendo = pendiente || editor.tieneFoco();
      if (!escribiendo && (n.texto || '') !== texto) { texto = n.texto || ''; editor.poner(texto); }
      else if (!escribiendo && (antes.adjuntos || []).length !== (n.adjuntos || []).length) editor.poner(texto);
      if (!zonaProps.contains(document.activeElement)) pintarProps();
      pintarArchivos(); pintarMenciones(); pintarPie();
      const r = n.carpetaId ? d.ruta(n.carpetaId) : [];
      volver.href = destinoVolver();
      poner(volver, '‹ ', textoVolver(r));
      if (cine && n.cine) cine.actualizar(n, d);
    },
    limpiar() { guardarTexto(); },
  };
}

export { comparar, marcaCarpeta };
