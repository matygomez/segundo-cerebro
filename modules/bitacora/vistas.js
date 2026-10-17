// ─────────────────────────────────────────────────────────────
// Bitácora: pantallas generales.
//   Árbol de carpetas y etiquetas (a la izquierda en la PC)
//   Inicio del módulo (bloques elegibles)
//   Carpeta, Bandeja, Etiqueta, Buscar, Papelera, Configurar
//   Menú "+ Nueva", notas rápidas, plantillas y Compartir (Android)
// ─────────────────────────────────────────────────────────────

import { filaSeguirViendo, items as itemsCine, config as configCine } from './filmoteca.js';
import {
  BANDEJA, DIAS_PAPELERA, TIPOS, COLORES_CARPETA, resumen, etiquetasDe, plantillaTitulo, comparar, hoyISO,
} from './modelo.js';

// Como replaceChildren, pero ignora los vacíos (null, false).
export const poner = (el, ...hijos) => el.replaceChildren(...hijos.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));

export const esPC = () => matchMedia('(min-width: 900px)').matches;
export const disp = () => (esPC() ? 'pc' : 'cel');

export function cargarEstilos() {
  if (document.getElementById('estilos-bitacora')) return;
  const l = document.createElement('link');
  l.id = 'estilos-bitacora';
  l.rel = 'stylesheet';
  l.href = new URL('./bitacora.css', import.meta.url).href;
  document.head.append(l);
}

// Íconos propios del módulo (trazo, como los de la app).
const TRAZOS = {
  carpeta: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
  bandeja: '<path d="M4 13.5 6.5 5.5h11L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',
  buscar: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
  papelera: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  puntos: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  base: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9"/>',
  nota: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4M9 12h6M9 15.5h6"/>',
  inicio: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  ojoNo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><path d="M4 4l16 16"/>',
  reloj: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  check: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  clip: '<path d="M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7.3 7.2a6 6 0 0 0 8.5 8.5L20 14.5"/>',
  drive: '<path d="M8.5 4h7l5.5 9.5-3.5 6h-11L3 13.5Z"/><path d="M8.5 4 12 10l-3.5 6M15.5 4 12 10M3 13.5h18"/>',
  portapapeles: '<rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9.5 4.5V3.5h5v1M9 10h6M9 14h4"/>',
  tabla: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14.5h16M10 5v14"/>',
  tarjetas: '<rect x="4" y="4.5" width="7" height="7" rx="1.5"/><rect x="13" y="4.5" width="7" height="7" rx="1.5"/><rect x="4" y="13.5" width="7" height="7" rx="1.5"/><rect x="13" y="13.5" width="7" height="7" rx="1.5"/>',
  filtro: '<path d="M4 6h16l-6 7v5l-4 2v-7Z"/>',
  orden: '<path d="M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3"/>',
  grupo: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  suma: '<path d="M17 5H7l6 7-6 7h10"/>',
  arriba: '<path d="m6 15 6-6 6 6"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17M8 5l2 4M13 5l2 4M18 5l2 4"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  tilde: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  play: '<path d="M8 5.5v13l10-6.5Z"/>',
  paleta: '<path d="M12 4a8 8 0 1 0 0 16c1.2 0 1.6-.9 1.2-1.8-.5-1 .2-2.2 1.3-2.2H17a3 3 0 0 0 3-3c0-5-3.6-9-8-9Z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  telefono: '<path d="M6.5 4h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 6a2 2 0 0 1 2-2Z"/>',
  mail: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="m4 7 8 6 8-6"/>',
  imagen: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 2.5-2.5L20 18"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  editar: '<path d="M5 19h4l10-10-4-4L5 15Z"/><path d="m13.5 6.5 4 4"/>',
};
// Símbolo de un tipo de campo (ícono de trazo o letra).
export const simboloTipo = (t) => { const s = document.createElement('span'); s.className = 'bt-tipo-sym'; if (t.icono) s.append(ic(t.icono)); else s.textContent = t.sym; return s; };

export function ic(nombre, clase = 'icono') {
  const s = document.createElement('span');
  s.className = clase;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre] || TRAZOS.nota}</svg>`;
  return s;
}

export function haceCuanto(ms) {
  if (!ms) return '';
  const seg = Math.round((Date.now() - ms) / 1000);
  if (seg < 60) return 'recién';
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  const f = new Date(ms), hoy = new Date();
  const mismoDia = f.toDateString() === hoy.toDateString();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1).toDateString() === f.toDateString();
  const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (mismoDia) return `hoy ${hora}`;
  if (ayer) return `ayer ${hora}`;
  if (Date.now() - ms < 6 * 86400000) return f.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', ...(f.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}) }).replace('.', '');
}

// ── Piezas comunes: ventanas y menús ──
export function ventana(ctx, titulo, contenido, { botones = null, clase = '', alCerrar = null } = {}) {
  const { h, icono } = ctx;
  const dlg = h('dialog', { class: `hoja bt-hoja ${clase}` },
    h('header', { class: 'hoja-cabecera' }, h('h2', {}, titulo),
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
    h('div', { class: 'bt-hoja-cuerpo' }, contenido),
    botones ? h('div', { class: 'hoja-botones' }, botones) : null);
  dlg.addEventListener('close', () => { dlg.remove(); alCerrar?.(); });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

export function menu(ctx, titulo, opciones) {
  const { h } = ctx;
  let dlg;
  const lista = h('div', { class: 'bt-menu' }, opciones.filter(Boolean).map(o => (o.separador
    ? h('div', { class: 'bt-menu-sep' }, o.separador)
    : h('button', { type: 'button', class: `bt-menu-op${o.peligro ? ' peligro' : ''}`, onclick: () => { dlg.close(); o.accion(); } },
      o.icono ? (typeof o.icono === 'string' && TRAZOS[o.icono] ? ic(o.icono) : h('span', { class: 'bt-emoji' }, o.icono)) : null,
      h('span', {}, o.texto, o.nota ? h('small', {}, o.nota) : null)))));
  dlg = ventana(ctx, titulo, lista, { clase: 'bt-hoja-menu' });
  return dlg;
}

export function pedirTexto(ctx, titulo, valor = '', etiqueta = 'Nombre') {
  return ctx.formulario({ titulo, textoGuardar: 'Guardar', campos: [{ id: 'v', etiqueta, tipo: 'texto', requerido: true, valor }] })
    .then(r => (r ? r.v.trim() : null));
}

// Elegir carpeta. Devuelve el id ('' = Bandeja) o null si se canceló.
export function elegirCarpeta(ctx, d, { titulo = 'Mover a…', actual = null, excluir = null, conBandeja = true } = {}) {
  const { h } = ctx;
  return new Promise((ok) => {
    let elegido = null;
    const prohibidas = new Set(excluir ? [excluir, ...d.descendientes(excluir).map(c => c.id)] : []);
    const fila = (id, nombre, nivel, color, emoji) => h('button', {
      type: 'button', class: `bt-elegir${id === actual ? ' actual' : ''}`, style: `padding-left:${0.75 + nivel * 1.1}rem`,
      disabled: prohibidas.has(id), onclick: () => { elegido = id; dlg.close(); },
    }, id === BANDEJA ? ic('bandeja') : marcaCarpeta(h, { color, icono: emoji }), h('span', {}, nombre));
    const filas = [];
    if (conBandeja) filas.push(fila(BANDEJA, 'Bandeja', 0));
    else filas.push(h('button', { type: 'button', class: 'bt-elegir', onclick: () => { elegido = ''; dlg.close(); } }, ic('inicio'), h('span', {}, 'Raíz (arriba de todo)')));
    const ir = (padre, nivel) => { for (const c of d.hijas(padre)) { filas.push(fila(c.id, c.nombre, nivel, c.color, c.icono)); ir(c.id, nivel + 1); } };
    ir('', 0);
    const dlg = ventana(ctx, titulo, h('div', { class: 'bt-elegir-lista' }, filas), { alCerrar: () => ok(elegido) });
  });
}

export function marcaCarpeta(h, c) {
  if (c?.icono) return h('span', { class: 'bt-emoji', style: c.color ? `--c:${c.color}` : null }, c.icono);
  return h('span', { class: 'bt-punto', style: `background:${c?.color || 'var(--tinta-2)'}` });
}

// ── Ajustes guardados ──
const BLOQUES = [
  { id: 'fijadas', nombre: 'Fijadas' },
  { id: 'seguir', nombre: 'Seguir viendo (Filmoteca)', nota: 'solo aparece si estás viendo alguna serie' },
  { id: 'bandeja', nombre: 'Bandeja (solo si tiene algo)' },
  { id: 'recientes', nombre: 'Recientes' },
  { id: 'carpetas', nombre: 'Carpetas y etiquetas', nota: 'en el celular; en la PC están siempre a la izquierda' },
];
export function configInicio(d) {
  const a = d.ajuste(`inicio-${disp()}`) || {};
  const guardados = (a.bloques || []).filter(b => BLOQUES.some(x => x.id === b.id));
  for (const b of BLOQUES) if (!guardados.some(x => x.id === b.id)) guardados.push({ id: b.id, on: true });
  return { bloques: guardados };
}
export const plegados = (d) => new Set(d.ajuste(`plegados-${disp()}`)?.ids || []);
export async function alternarPlegado(m, d, id) {
  const s = plegados(d);
  if (s.has(id)) s.delete(id); else s.add(id);
  await m.guardarAjuste(`plegados-${disp()}`, { ids: [...s] });
}
export const tiposOcultos = (d) => new Set(d.ajuste('general')?.tiposOcultos || []);

// ── Árbol (PC a la izquierda; en el celular es un bloque del Inicio) ──
export function arbol(ctx, m, d, actual = '') {
  const { h } = ctx;
  const pleg = plegados(d);
  const alternar = (id) => (e) => { e.preventDefault(); e.stopPropagation(); alternarPlegado(m, d, id); };
  const flecha = (id, tiene) => (tiene
    ? h('button', { type: 'button', class: `bt-ar-flecha${pleg.has(id) ? '' : ' abierta'}`, 'aria-label': pleg.has(id) ? 'Desplegar' : 'Plegar', onclick: alternar(id) }, ic('flecha'))
    : h('span', { class: 'bt-ar-flecha vacia' }));
  const fila = (href, contenido, { nivel = 0, sel = false, n = null, extra = null } = {}) => h('a', { href, class: `bt-ar${sel ? ' sel' : ''}`, style: nivel ? `--nivel:${nivel}` : null },
    contenido, n !== null && n !== undefined ? h('span', { class: 'bt-ar-n' }, String(n || '')) : null, extra);
  const seccion = (id, titulo, boton = null) => h('div', { class: 'bt-ar-sec' },
    h('button', { type: 'button', class: `bt-ar-sec-tit${pleg.has(id) ? '' : ' abierta'}`, onclick: alternar(id) }, ic('flecha', 'icono bt-ar-sec-fl'), titulo), boton);

  const filas = [
    fila('#/bitacora', [h('span', { class: 'bt-ar-flecha vacia' }), ic('inicio'), h('span', { class: 'bt-ar-nom' }, 'Inicio')], { sel: actual === 'inicio' }),
    fila('#/bitacora/buscar', [h('span', { class: 'bt-ar-flecha vacia' }), ic('buscar'), h('span', { class: 'bt-ar-nom' }, 'Buscar')], { sel: actual === 'buscar' }),
    fila('#/bitacora/f', [h('span', { class: 'bt-ar-flecha vacia' }), ic('film'), h('span', { class: 'bt-ar-nom' }, 'Filmoteca')], { sel: actual === 'f', n: itemsCine(d).length || null }),
    seccion('sec:carpetas', 'Carpetas', h('button', { type: 'button', class: 'bt-ar-mas', title: 'Nueva carpeta', 'aria-label': 'Nueva carpeta', onclick: () => nuevaCarpeta(ctx, m, '') }, ic('mas'))),
  ];
  if (!pleg.has('sec:carpetas')) {
    const nB = d.notasDe(BANDEJA).length;
    filas.push(fila('#/bitacora/bandeja', [h('span', { class: 'bt-ar-flecha vacia' }), ic('bandeja'), h('span', { class: 'bt-ar-nom' }, 'Bandeja')], { sel: actual === 'c:', n: nB }));
    const ir = (padre, nivel) => {
      for (const c of d.hijas(padre)) {
        const hijas = d.hijas(c.id).length > 0;
        filas.push(fila(`#/bitacora/c/${c.id}`, [flecha(c.id, hijas), marcaCarpeta(h, c), h('span', { class: 'bt-ar-nom' }, c.nombre), c.base ? h('span', { class: 'bt-chip-base' }, 'base') : null],
          { nivel, sel: actual === `c:${c.id}`, n: d.cantidad(c.id) }));
        if (hijas && !pleg.has(c.id)) ir(c.id, nivel + 1);
      }
    };
    ir('', 0);
    if (!d.hijas('').length) filas.push(h('p', { class: 'bt-ar-vacio' }, 'Creá tu primera carpeta con +'));
  }
  const etiquetas = d.etiquetas();
  if (etiquetas.length) {
    filas.push(seccion('sec:etiquetas', 'Etiquetas'));
    if (!pleg.has('sec:etiquetas')) {
      const visibles = etiquetas.filter(e => { const p = e.nombre.split('/'); for (let i = 1; i < p.length; i++) if (pleg.has('t:' + p.slice(0, i).join('/'))) return false; return true; });
      for (const e of visibles) {
        const nivel = e.nombre.split('/').length - 1;
        const hijas = etiquetas.some(x => x.nombre.startsWith(e.nombre + '/'));
        filas.push(fila(`#/bitacora/e/${encodeURIComponent(e.nombre)}`, [flecha('t:' + e.nombre, hijas), h('span', { class: 'bt-ar-nom bt-tag' }, '#' + e.nombre.split('/').pop())],
          { nivel, sel: actual === `e:${e.nombre}`, n: d.conEtiqueta(e.nombre).length }));
      }
    }
  }
  filas.push(h('div', { class: 'bt-ar-sep' }));
  filas.push(fila('#/bitacora/papelera', [h('span', { class: 'bt-ar-flecha vacia' }), ic('papelera'), h('span', { class: 'bt-ar-nom' }, 'Papelera')], { sel: actual === 'papelera', n: d.papelera.length || null }));
  return h('nav', { class: 'bt-arbol', 'aria-label': 'Carpetas y etiquetas' }, filas);
}

// ── Filas de notas ──
export function filaNota(ctx, d, n, { conCarpeta = false, extra = null } = {}) {
  const { h } = ctx;
  const tags = etiquetasDe(n).slice(0, 3);
  const res = resumen(n.texto, 110);
  return h('a', { href: `#/bitacora/n/${n.id}`, class: 'bt-fila' },
    h('div', { class: 'bt-fila-t' },
      h('b', {}, n.fijada ? ic('pin', 'icono bt-fila-pin') : null, n.titulo || 'Sin título'),
      res ? h('span', { class: 'bt-fila-res' }, res) : null,
      h('small', {}, [conCarpeta ? d.nombreRuta(n.carpetaId) : null, ...tags.map(t => '#' + t)].filter(Boolean).join(' · '))),
    h('span', { class: 'bt-fila-cuando' }, haceCuanto(n.modificado)),
    extra);
}

export function vacio(ctx, titulo, texto, ...botones) {
  const { h } = ctx;
  return h('div', { class: 'vacio' }, h('h2', {}, titulo), texto ? h('p', {}, texto) : null, botones.length ? h('div', { class: 'botonera' }, botones) : null);
}

export function cabecera(ctx, { titulo, marca = null, volver = null, botones = [] }) {
  const { h } = ctx;
  return h('header', { class: 'bt-cab' },
    volver ? h('a', { href: volver.href, class: 'bt-volver' }, `‹ ${volver.texto}`) : null,
    h('div', { class: 'bt-cab-fila' },
      h('h1', { class: 'bt-titulo' }, marca, h('span', {}, titulo)),
      h('div', { class: 'bt-cab-botones' }, botones)));
}

const botonNueva = (ctx, m, d, carpetaId) => ctx.h('button', { type: 'button', class: 'boton principal bt-nueva', onclick: () => menuNueva(ctx, m, d, carpetaId) }, ic('mas'), 'Nueva');

// ── Inicio del módulo ──
export function pantallaInicio(ctx, m, d, main) {
  const { h, icono } = ctx;
  const cfg = configInicio(d);
  const cont = [];
  cont.push(cabecera(ctx, {
    titulo: 'Bitácora', marca: icono('bitacora'),
    botones: [
      h('a', { href: '#/bitacora/ajustes', class: 'boton-icono', title: 'Configurar Bitácora', 'aria-label': 'Configurar Bitácora' }, ic('ajustes')),
      botonNueva(ctx, m, d, BANDEJA),
    ],
  }));
  cont.push(h('a', { href: '#/bitacora/buscar', class: 'bt-busca' }, ic('buscar'), h('span', {}, 'Buscar en títulos, texto y #etiquetas…')));

  {
    for (const b of cfg.bloques.filter(x => x.on)) {
      if (b.id === 'fijadas') {
        const fijas = d.notas.filter(n => n.fijada).sort((a, b2) => comparar(a.titulo, b2.titulo));
        if (!fijas.length) continue;
        cont.push(h('section', { class: 'tarjeta bt-bloque' }, h('h2', { class: 'bt-bloque-h' }, 'Fijadas'),
          h('div', { class: 'bt-fijas' }, fijas.map(n => h('a', { href: `#/bitacora/n/${n.id}`, class: 'bt-fija' }, h('b', {}, n.titulo), h('small', {}, d.nombreRuta(n.carpetaId)))))));
      }
      if (b.id === 'seguir') {
        const fila = filaSeguirViendo(ctx, d);
        if (!fila) continue;
        cont.push(h('section', { class: 'tarjeta bt-bloque' }, h('div', { class: 'bt-bloque-tit' }, h('h2', { class: 'bt-bloque-h' }, 'Seguir viendo'), h('a', { href: '#/bitacora/f', class: 'bt-link-chico' }, 'Filmoteca ›')), fila));
      }
      if (b.id === 'bandeja') {
        const en = d.notasDe(BANDEJA).sort((a, b2) => b2.modificado - a.modificado);
        if (!en.length) continue;
        cont.push(h('section', { class: 'tarjeta bt-bloque bt-bloque-bandeja' },
          h('div', { class: 'bt-bloque-tit' }, h('h2', { class: 'bt-bloque-h' }, 'Bandeja'), h('a', { href: '#/bitacora/bandeja', class: 'bt-link-chico' }, `${en.length} para ordenar ›`)),
          h('div', { class: 'bt-lista' }, en.slice(0, 5).map(n => filaNota(ctx, d, n, {
            extra: h('button', { type: 'button', class: 'boton bt-mover', onclick: async (e) => { e.preventDefault(); e.stopPropagation(); const id = await elegirCarpeta(ctx, d, { actual: BANDEJA }); if (id !== null && id !== BANDEJA) { await m.guardarNota(n.id, { carpetaId: id }); ctx.aviso(`Movida a ${d.nombreRuta(id)}`); } } }, 'Mover…'),
          })))));
      }
      if (b.id === 'recientes') {
        const rec = [...d.notas].sort((a, b2) => b2.modificado - a.modificado).slice(0, 8);
        cont.push(h('section', { class: 'tarjeta bt-bloque' }, h('h2', { class: 'bt-bloque-h' }, 'Recientes'),
          rec.length ? h('div', { class: 'bt-lista' }, rec.map(n => filaNota(ctx, d, n, { conCarpeta: true })))
            : h('p', { class: 'nota' }, 'Todavía no hay notas. Tocá "+ Nueva" para crear la primera, o armá tus carpetas con el + de "Carpetas".')));
      }
      if (b.id === 'carpetas' && !esPC()) {
        cont.push(h('section', { class: 'tarjeta bt-bloque bt-bloque-arbol' }, arbol(ctx, m, d, 'inicio')));
      }
    }
  }
  poner(main, ...cont);
}

// ── Carpeta (o Bandeja) ──
export function pantallaCarpeta(ctx, m, d, carpetaId, main, { renderBase }) {
  const { h } = ctx;
  const c = d.carpeta(carpetaId);
  if (carpetaId && !c) { poner(main, vacio(ctx, 'Esta carpeta no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/bitacora', class: 'boton' }, 'Volver a la Bitácora'))); return; }
  const ruta = c ? d.ruta(c.id) : [];
  const padre = ruta.length > 1 ? ruta[ruta.length - 2] : null;
  const botones = [];
  if (c) {
    if (c.base) botones.push(h('a', { href: `#/bitacora/c/${c.id}/campos`, class: 'boton-icono', title: 'Campos de la base', 'aria-label': 'Campos de la base' }, ic('ajustes')));
    botones.push(h('button', { type: 'button', class: 'boton-icono', title: 'Opciones de la carpeta', 'aria-label': 'Opciones de la carpeta', onclick: () => menuCarpeta(ctx, m, d, c) }, ic('puntos')));
  }
  botones.push(botonNueva(ctx, m, d, carpetaId));
  const cont = [cabecera(ctx, {
    titulo: c ? c.nombre : 'Bandeja',
    marca: c ? marcaCarpeta(h, c) : ic('bandeja'),
    volver: padre ? { href: `#/bitacora/c/${padre.id}`, texto: padre.nombre } : { href: '#/bitacora', texto: 'Bitácora' },
    botones,
  })];
  if (!c) cont.push(h('p', { class: 'nota' }, 'Lo que capturás rápido o compartís desde otras apps cae acá. Movelo a su carpeta cuando puedas.'));
  const hijas = c ? d.hijas(c.id) : [];
  if (hijas.length) cont.push(h('div', { class: 'bt-subcarpetas' }, hijas.map(x => h('a', { href: `#/bitacora/c/${x.id}`, class: 'bt-subcarpeta' }, marcaCarpeta(h, x), h('span', {}, x.nombre), h('small', {}, String(d.cantidad(x.id)))))));

  if (c?.base) { const zona = h('div', { class: 'bt-base-zona' }); cont.push(zona); poner(main, ...cont); renderBase(zona, c); return; }

  const notas = d.notasDe(carpetaId).sort((a, b) => (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0) || b.modificado - a.modificado);
  cont.push(notas.length
    ? h('section', { class: 'tarjeta bt-bloque' }, h('div', { class: 'bt-lista' }, notas.map(n => filaNota(ctx, d, n, c ? {} : {
      extra: h('button', { type: 'button', class: 'boton bt-mover', onclick: async (e) => { e.preventDefault(); e.stopPropagation(); const id = await elegirCarpeta(ctx, d, { actual: BANDEJA }); if (id !== null && id !== BANDEJA) { await m.guardarNota(n.id, { carpetaId: id }); ctx.aviso(`Movida a ${d.nombreRuta(id)}`); } } }, 'Mover…'),
    }))))
    : vacio(ctx, c ? 'Carpeta vacía' : 'La Bandeja está vacía', c ? 'Creá una nota acá con "+ Nueva".' : null));
  poner(main, ...cont);
}

export async function nuevaCarpeta(ctx, m, padreId) {
  const nombre = await pedirTexto(ctx, padreId ? 'Nueva subcarpeta' : 'Nueva carpeta');
  if (!nombre) return;
  const colores = COLORES_CARPETA;
  const padre = padreId ? (await m.cargar()).carpeta(padreId) : null;
  const id = await m.crearCarpeta({ nombre, padreId, color: padre?.color || colores[Math.floor(Math.random() * colores.length)] });
  ctx.navegar(`bitacora/c/${id}`);
}

export function menuCarpeta(ctx, m, d, c) {
  menu(ctx, c.nombre, [
    { icono: 'mas', texto: 'Nueva subcarpeta', accion: () => nuevaCarpeta(ctx, m, c.id) },
    { icono: 'editar', texto: 'Renombrar', accion: async () => { const n = await pedirTexto(ctx, 'Renombrar carpeta', c.nombre); if (n) await m.guardarCarpeta(c.id, { nombre: n }); } },
    { icono: 'paleta', texto: 'Ícono y color', accion: () => iconoYColor(ctx, m, c) },
    { icono: 'carpeta', texto: 'Mover a…', accion: async () => { const id = await elegirCarpeta(ctx, d, { titulo: `Mover "${c.nombre}" a…`, actual: c.padreId || '', excluir: c.id, conBandeja: false }); if (id !== null) { try { await m.moverCarpeta(c.id, id); } catch (e) { ctx.aviso(e.message); } } } },
    { icono: 'arriba', texto: 'Subir en la lista', accion: () => m.ordenarCarpeta(c.id, -1) },
    { icono: 'abajo', texto: 'Bajar en la lista', accion: () => m.ordenarCarpeta(c.id, 1) },
    c.base
      ? { icono: 'base', texto: 'Campos de la base de datos', accion: () => ctx.navegar(`bitacora/c/${c.id}/campos`) }
      : { icono: 'base', texto: 'Convertir en base de datos', nota: 'Sus notas pasan a tener campos y se ven como tabla o tarjetas', accion: async () => { await m.guardarCarpeta(c.id, { base: true, campos: c.campos || [], vistas: c.vistas || [] }); ctx.navegar(`bitacora/c/${c.id}/campos`); } },
    { icono: 'papelera', texto: 'Borrar carpeta', peligro: true, nota: 'Sus notas y subcarpetas pasan a la carpeta de arriba', accion: async () => {
      if (!await ctx.confirmar(`¿Borrar la carpeta "${c.nombre}"? Las notas y subcarpetas que tenga pasan a ${c.padreId ? d.carpeta(c.padreId)?.nombre : 'la Bandeja'}. No se borra ninguna nota.`, { si: 'Borrar carpeta', peligro: true })) return;
      await m.borrarCarpeta(c.id);
      ctx.navegar(c.padreId ? `bitacora/c/${c.padreId}` : 'bitacora');
    } },
  ]);
}

function iconoYColor(ctx, m, c) {
  const { h } = ctx;
  let color = c.color || COLORES_CARPETA[0];
  const emoji = h('input', { type: 'text', value: c.icono || '', placeholder: 'Ej: 🎯 📁 🔫 📚 (opcional)', maxlength: '4', 'aria-label': 'Ícono' });
  const muestras = h('div', { class: 'bt-colores' });
  const pintar = () => poner(muestras, ...COLORES_CARPETA.map(x => h('button', { type: 'button', class: `bt-color${x === color ? ' sel' : ''}`, style: `background:${x}`, 'aria-label': x, onclick: () => { color = x; pintar(); } })));
  pintar();
  const dlg = ventana(ctx, 'Ícono y color', h('div', { class: 'formulario-campos' },
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Ícono (un emoji; vacío = punto de color)'), emoji),
    h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Color'), muestras)),
  { botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
    h('button', { type: 'button', class: 'boton principal', onclick: async () => { await m.guardarCarpeta(c.id, { color, icono: emoji.value.trim() }); dlg.close(); } }, 'Guardar')] });
}

// ── Etiqueta ──
export function pantallaEtiqueta(ctx, m, d, tag, main) {
  const { h } = ctx;
  const notas = d.conEtiqueta(tag).sort((a, b) => b.modificado - a.modificado);
  const hijas = d.etiquetas().filter(e => e.nombre.startsWith(tag + '/') && e.nombre.split('/').length === tag.split('/').length + 1);
  const padre = tag.includes('/') ? tag.split('/').slice(0, -1).join('/') : '';
  poner(main, 
    cabecera(ctx, { titulo: '#' + tag, volver: padre ? { href: `#/bitacora/e/${encodeURIComponent(padre)}`, texto: '#' + padre } : { href: '#/bitacora', texto: 'Bitácora' } }),
    hijas.length ? h('div', { class: 'bt-subcarpetas' }, hijas.map(e => h('a', { href: `#/bitacora/e/${encodeURIComponent(e.nombre)}`, class: 'bt-subcarpeta' }, h('span', { class: 'bt-tag' }, '#' + e.nombre.split('/').pop()), h('small', {}, String(d.conEtiqueta(e.nombre).length))))) : null,
    notas.length ? h('section', { class: 'tarjeta bt-bloque' }, h('div', { class: 'bt-lista' }, notas.map(n => filaNota(ctx, d, n, { conCarpeta: true }))))
      : vacio(ctx, 'Ninguna nota con esta etiqueta', null));
}

// ── Buscar ──
let ultimaBusqueda = '';
export function pantallaBuscar(ctx, m, d, main) {
  const { h } = ctx;
  const input = h('input', { type: 'search', class: 'bt-busca-input', placeholder: 'Buscar… (podés usar #etiqueta)', value: ultimaBusqueda, autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Buscar' });
  const res = h('div', {});
  const pintar = () => {
    ultimaBusqueda = input.value;
    const q = input.value.trim();
    if (!q) { poner(res, h('p', { class: 'nota' }, 'Escribí parte del título o del texto. Con #etiqueta filtrás por etiqueta.')); return; }
    const lista = d.buscar(q);
    poner(res, lista.length
      ? h('section', { class: 'tarjeta bt-bloque' }, h('p', { class: 'nota' }, `${lista.length} resultado${lista.length === 1 ? '' : 's'}`), h('div', { class: 'bt-lista' }, lista.slice(0, 100).map(n => filaNota(ctx, d, n, { conCarpeta: true }))))
      : h('p', { class: 'nota' }, 'No hay notas que coincidan.'));
  };
  input.addEventListener('input', pintar);
  poner(main, cabecera(ctx, { titulo: 'Buscar', marca: ic('buscar'), volver: { href: '#/bitacora', texto: 'Bitácora' } }), h('div', { class: 'bt-busca-fila' }, ic('buscar'), input), res);
  pintar();
  setTimeout(() => input.focus(), 50);
  return { actualizar(d2) { d = d2; pintar(); } };
}

// ── Papelera ──
export function pantallaPapelera(ctx, m, d, main) {
  const { h } = ctx;
  const dias = (n) => Math.max(0, DIAS_PAPELERA - Math.floor((Date.now() - n.papelera) / 86400000));
  poner(main, 
    cabecera(ctx, { titulo: 'Papelera', marca: ic('papelera'), volver: { href: '#/bitacora', texto: 'Bitácora' },
      botones: d.papelera.length ? [h('button', { type: 'button', class: 'boton peligro', onclick: async () => { if (await ctx.confirmar(`¿Borrar definitivamente las ${d.papelera.length} notas de la papelera?`, { si: 'Vaciar', peligro: true })) { await m.limpiarPapelera(true); ctx.aviso('Papelera vacía'); } } }, 'Vaciar')] : [] }),
    h('p', { class: 'nota' }, `Las notas borradas quedan acá ${DIAS_PAPELERA} días y después se borran solas.`),
    d.papelera.length
      ? h('section', { class: 'tarjeta bt-bloque' }, h('div', { class: 'bt-lista' }, d.papelera.map(n => h('div', { class: 'bt-fila' },
        h('div', { class: 'bt-fila-t' }, h('b', {}, n.titulo || 'Sin título'), h('small', {}, `Borrada ${haceCuanto(n.papelera)} · se borra en ${dias(n)} día${dias(n) === 1 ? '' : 's'}`)),
        h('button', { type: 'button', class: 'boton', onclick: async () => { await m.restaurar(n.id); ctx.aviso('Nota recuperada', { accion: 'Abrir', alTocar: () => ctx.navegar(`bitacora/n/${n.id}`) }); } }, 'Recuperar'),
        h('button', { type: 'button', class: 'boton-icono', title: 'Borrar definitivamente', 'aria-label': 'Borrar definitivamente', onclick: async () => { if (await ctx.confirmar(`¿Borrar "${n.titulo}" para siempre?`, { si: 'Borrar', peligro: true })) await m.borrarDefinitivo(n.id); } }, ic('papelera'))))))
      : vacio(ctx, 'La papelera está vacía', null));
}

// ── Configurar Bitácora ──
export function pantallaAjustes(ctx, m, d, main) {
  const { h } = ctx;
  const cfg = configInicio(d);
  const guardarInicio = (cambios) => m.guardarAjuste(`inicio-${disp()}`, { bloques: cfg.bloques, ...cambios });
  const filasBloques = cfg.bloques.map((b, i) => {
    const def = BLOQUES.find(x => x.id === b.id);
    return h('div', { class: 'aj-fila' },
      h('span', { class: 'aj-nombre' }, def.nombre, def.nota ? h('small', { class: 'bt-nota-chica' }, def.nota) : null),
      h('span', { class: 'aj-acciones' },
        h('button', { type: 'button', class: 'aj-flecha', disabled: i === 0, 'aria-label': 'Subir', onclick: () => { const l = [...cfg.bloques]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; guardarInicio({ bloques: l }); } }, '↑'),
        h('button', { type: 'button', class: 'aj-flecha', disabled: i === cfg.bloques.length - 1, 'aria-label': 'Bajar', onclick: () => { const l = [...cfg.bloques]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; guardarInicio({ bloques: l }); } }, '↓'),
        h('button', { type: 'button', class: `aj-switch${b.on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(b.on), 'aria-label': def.nombre, onclick: () => guardarInicio({ bloques: cfg.bloques.map(x => (x.id === b.id ? { ...x, on: !x.on } : x)) }) })));
  });

  const ocultos = tiposOcultos(d);
  const tipos = h('div', { class: 'bt-tipos' }, TIPOS.map(t => h('button', {
    type: 'button', class: `bt-tipo${ocultos.has(t.id) ? ' off' : ''}`, 'aria-pressed': String(!ocultos.has(t.id)),
    onclick: () => { const s = new Set(ocultos); if (s.has(t.id)) s.delete(t.id); else s.add(t.id); m.guardarAjuste('general', { tiposOcultos: [...s] }); },
  }, simboloTipo(t), t.nombre)));

  const est = ctx.espejo?.estado?.() || {};
  poner(main, 
    cabecera(ctx, { titulo: 'Configurar Bitácora', marca: ic('ajustes'), volver: { href: '#/bitacora', texto: 'Bitácora' } }),
    h('section', { class: 'tarjeta' }, h('h2', {}, `Inicio de la Bitácora · ${esPC() ? 'en la PC' : 'en el celular'}`),
      h('p', { class: 'nota' }, 'Qué bloques se ven y en qué orden. Se guarda por separado en la PC y en el celular.'),
      h('div', { class: 'aj-tabla' }, filasBloques)),
    h('section', { class: 'tarjeta' },
      h('div', { class: 'bt-bloque-tit' }, h('h2', {}, 'Plantillas y notas rápidas'), h('button', { type: 'button', class: 'boton', onclick: () => editarPlantilla(ctx, m, d, null) }, ic('mas'), 'Nueva')),
      h('p', { class: 'nota' }, 'Una plantilla arma la nota con un texto inicial. Si la marcás como "nota rápida", aparece arriba en "+ Nueva" como un formulario corto (y si va a una base de datos, con sus campos).'),
      d.plantillas.length
        ? h('div', { class: 'aj-tabla' }, d.plantillas.map(p => h('div', { class: 'aj-fila' },
          h('span', { class: 'aj-nombre' }, p.icono ? h('span', { class: 'bt-emoji' }, p.icono) : ic('nota'), p.nombre, h('small', { class: 'bt-nota-chica' }, `→ ${p.carpetaId === '@actual' ? 'la carpeta donde estés' : d.nombreRuta(p.carpetaId)}${p.rapida ? ' · nota rápida' : ''}`)),
          h('span', { class: 'aj-acciones' },
            h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Editar plantilla', onclick: () => editarPlantilla(ctx, m, d, p) }, ic('editar')),
            h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Borrar plantilla', onclick: async () => { if (await ctx.confirmar(`¿Borrar la plantilla "${p.nombre}"? Las notas ya creadas no cambian.`, { si: 'Borrar', peligro: true })) await m.borrarPlantilla(p.id); } }, ic('papelera'))))))
        : h('p', { class: 'nota' }, 'Todavía no hay plantillas.')),
    seccionFilmoteca(ctx, m, d),
    h('section', { class: 'tarjeta' }, h('h2', {}, 'Tipos de campo para las bases de datos'),
      h('p', { class: 'nota' }, 'Tocá los que no uses para ocultarlos al agregar un campo. Vale para todas las bases.'), tipos),
    h('section', { class: 'tarjeta' }, h('h2', {}, 'Copia en Drive'),
      h('p', { class: 'nota' }, 'Cada nota se guarda también como un archivo .md en Google Drive › Segundo Cerebro › Bitácora, con tus mismas carpetas. Se puede abrir con Obsidian o cualquier editor. Se actualiza sola en cada sincronización.'),
      h('p', { class: 'nota' }, est.error ? `Último error: ${est.error}` : est.ultima ? `Al día · ${haceCuanto(est.ultima)}${est.pendientes ? ' (todavía subiendo)' : ''}` : 'Se actualiza al sincronizar con Drive.')),
    h('section', { class: 'tarjeta' }, h('div', { class: 'bt-bloque-tit' }, h('h2', {}, 'Papelera'), h('a', { href: '#/bitacora/papelera', class: 'boton' }, `Abrir (${d.papelera.length})`))),
  );
}

export function editarPlantilla(ctx, m, d, p) {
  const { h } = ctx;
  const nombre = h('input', { type: 'text', value: p?.nombre || '', placeholder: 'Ej: Reunión, Idea, Alumno', 'aria-label': 'Nombre' });
  const icono = h('input', { type: 'text', value: p?.icono || '', placeholder: 'Ej: 💡', maxlength: '4', 'aria-label': 'Ícono' });
  const destino = h('select', { 'aria-label': 'Carpeta' },
    h('option', { value: '@actual', selected: p?.carpetaId === '@actual' }, 'La carpeta donde estés (o Bandeja)'),
    h('option', { value: '', selected: p && p.carpetaId === '' }, 'Bandeja'),
    (() => { const l = []; const ir = (padre, niv) => { for (const c of d.hijas(padre)) { l.push(h('option', { value: c.id, selected: p?.carpetaId === c.id }, `${'— '.repeat(niv)}${c.nombre}${c.base ? ' (base)' : ''}`)); ir(c.id, niv + 1); } }; ir('', 0); return l; })());
  if (!p) destino.value = '@actual';
  const titulo = h('input', { type: 'text', value: p?.titulo || '', placeholder: 'Ej: Reunión {fecha} –', 'aria-label': 'Título automático' });
  const texto = h('textarea', { rows: 7, class: 'bt-mono', placeholder: '## Temas\n- \n## Acuerdos\n- \n## Pendientes\n- [ ] ', 'aria-label': 'Texto inicial' }, p?.texto || '');
  const rapida = h('input', { type: 'checkbox', checked: !!p?.rapida });
  const error = h('p', { class: 'formulario-error' });
  const dlg = ventana(ctx, p ? 'Editar plantilla' : 'Nueva plantilla', h('div', { class: 'formulario-campos' },
    h('div', { class: 'bt-dos' },
      h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Nombre'), nombre),
      h('label', { class: 'fila-campo bt-angosto' }, h('span', { class: 'etiqueta-campo' }, 'Ícono'), icono)),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Carpeta donde se guarda'), destino),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Título automático ({fecha} y {hora} se completan solos; vacío = lo escribís vos)'), titulo),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Texto inicial'), texto),
    h('label', { class: 'fila-campo casilla' }, rapida, h('span', {}, 'Nota rápida: aparece arriba en "+ Nueva" como formulario corto')),
    error),
  { botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
    h('button', { type: 'button', class: 'boton principal', onclick: async () => {
      if (!nombre.value.trim()) { error.textContent = 'Poné un nombre.'; nombre.focus(); return; }
      await m.guardarPlantilla(p?.id, { nombre: nombre.value.trim(), icono: icono.value.trim(), carpetaId: destino.value, titulo: titulo.value, texto: texto.value, rapida: rapida.checked });
      dlg.close();
      ctx.aviso('Plantilla guardada');
    } }, 'Guardar')] });
}

// ── "+ Nueva" ──
export function menuNueva(ctx, m, d, carpetaId = BANDEJA) {
  const destinoDe = (p) => (p.carpetaId === '@actual' ? carpetaId : (d.carpeta(p.carpetaId) ? p.carpetaId : BANDEJA));
  const rapidas = d.plantillas.filter(p => p.rapida);
  const otras = d.plantillas.filter(p => !p.rapida);
  const base = d.carpeta(carpetaId)?.base ? d.carpeta(carpetaId) : null;
  const rapidaBase = base ? d.plantillas.find(p => p.rapida && p.carpetaId === base.id) : null;
  menu(ctx, 'Nueva', [
    base ? { icono: 'base', texto: `Nuevo en ${base.nombre}`, nota: 'Formulario con los campos de la base', accion: () => notaRapida(ctx, m, d, { plantilla: rapidaBase, carpetaId: base.id }) } : null,
    { icono: 'nota', texto: base ? 'Nota en blanco en la base' : 'Nota en blanco', nota: `en ${d.nombreRuta(carpetaId)}`, accion: () => crearYAbrir(ctx, m, d, { carpetaId }) },
    rapidas.length ? { separador: 'Notas rápidas' } : null,
    ...rapidas.map(p => ({ icono: p.icono || 'nota', texto: p.nombre, nota: d.nombreRuta(destinoDe(p)), accion: () => notaRapida(ctx, m, d, { plantilla: p, carpetaId: destinoDe(p) }) })),
    otras.length ? { separador: 'Plantillas' } : null,
    ...otras.map(p => ({ icono: p.icono || 'nota', texto: p.nombre, nota: d.nombreRuta(destinoDe(p)), accion: () => crearYAbrir(ctx, m, d, { carpetaId: destinoDe(p), titulo: plantillaTitulo(p.titulo) || p.nombre, texto: p.texto || '' }) })),
    { separador: '' },
    { icono: 'ajustes', texto: 'Administrar plantillas', accion: () => ctx.navegar('bitacora/ajustes') },
  ]);
}

export async function crearYAbrir(ctx, m, d, { carpetaId = BANDEJA, titulo = '', texto = '' }) {
  const id = await m.crearNota({ titulo: titulo || 'Sin título', carpetaId, texto });
  sessionStorage.setItem('bt-editar', id);
  ctx.navegar(`bitacora/n/${id}`);
}

// Formulario corto: título, campos (si va a una base) y texto.
export async function notaRapida(ctx, m, d, { plantilla = null, carpetaId = BANDEJA }) {
  const { h } = ctx;
  const { controlCampo } = await import('./base.js');
  const c = d.carpeta(carpetaId);
  const titulo = h('input', { type: 'text', value: plantilla ? plantillaTitulo(plantilla.titulo) : '', placeholder: 'Título', 'aria-label': 'Título', autocomplete: 'off' });
  const props = {};
  const filas = (c?.base ? c.campos || [] : []).filter(f => f.tipo !== 'auto').map(f => h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, f.nombre),
    controlCampo(ctx, m, d, f, undefined, (v) => { props[f.id] = v; })));
  const texto = h('textarea', { rows: 4, placeholder: 'Texto (opcional)', 'aria-label': 'Texto' }, plantilla?.texto || '');
  const error = h('p', { class: 'formulario-error' });
  const nombre = plantilla?.nombre || (c?.base ? `Nuevo en ${c.nombre}` : 'Nota rápida');
  const guardar = async (abrir) => {
    if (!titulo.value.trim()) { error.textContent = 'Escribí un título.'; titulo.focus(); return; }
    const id = await m.crearNota({ titulo: titulo.value.trim(), carpetaId, texto: texto.value, props });
    dlg.close();
    if (abrir) ctx.navegar(`bitacora/n/${id}`);
    else ctx.aviso(`Guardada en ${d.nombreRuta(carpetaId)}`, { accion: 'Abrir', alTocar: () => ctx.navegar(`bitacora/n/${id}`) });
  };
  const dlg = ventana(ctx, `${plantilla?.icono ? plantilla.icono + ' ' : ''}${nombre}`, h('div', { class: 'formulario-campos' },
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, c?.base ? 'Nombre' : 'Título'), titulo),
    filas, h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Texto'), texto),
    h('p', { class: 'nota' }, `Se guarda en ${d.nombreRuta(carpetaId)}.`), error),
  { botones: [h('button', { type: 'button', class: 'boton', onclick: () => guardar(true) }, 'Guardar y abrir'), h('button', { type: 'button', class: 'boton principal', onclick: () => guardar(false) }, 'Guardar')] });
  setTimeout(() => titulo.focus(), 50);
}

// ── Compartir desde Android ──
export async function recibirCompartido(ctx, m) {
  const { h } = ctx;
  const c = await ctx.compartido?.leer?.();
  if (!c) return;
  await ctx.compartido.limpiar();
  const espera = ctx.aviso('Guardando lo que compartiste…', { duracion: 0 });
  // Se guarda enseguida en la Bandeja (aunque cierres sin tocar nada).
  const url = c.url || (c.texto.match(/https?:\/\/\S+/) || [''])[0];
  let host = '';
  try { host = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { /* nada */ }
  const primera = c.texto.replace(url, '').trim().split('\n')[0].slice(0, 80);
  const titulo = (c.titulo || primera || (host ? `Link de ${host}` : '') || `Compartido ${new Date().toLocaleDateString('es-AR')}`).trim();
  const lineas = [c.texto.trim(), url && !c.texto.includes(url) ? url : ''].filter(Boolean);
  const adjuntos = [];
  for (const f of c.archivos) {
    try {
      const info = await ctx.archivos.subir(f);
      adjuntos.push({ ...info, nombre: f.name, origen: 'subido' });
      lineas.push(`![[${f.name}]]`);
    } catch (e) { ctx.aviso(`No se pudo guardar ${f.name}: ${e.message}`); }
  }
  const id = await m.crearNota({ titulo, carpetaId: BANDEJA, texto: lineas.join('\n\n'), adjuntos });
  espera.remove();
  const dd = await m.cargar();
  const tit = h('input', { type: 'text', value: titulo, 'aria-label': 'Título' });
  let destino = BANDEJA;
  const botonCarpeta = h('button', { type: 'button', class: 'boton bt-elegir-boton', onclick: async () => { const x = await elegirCarpeta(ctx, dd, { titulo: 'Guardar en…', actual: destino }); if (x !== null) { destino = x; botonCarpeta.lastChild.textContent = dd.nombreRuta(x); } } }, ic('carpeta'), h('span', {}, 'Bandeja'));
  const extra = h('textarea', { rows: 3, placeholder: 'Agregar una nota (opcional)', 'aria-label': 'Nota' });
  let listo = false;
  const guardar = async (abrir) => {
    listo = true;
    const n = dd.nota(id);
    await m.guardarNota(id, { titulo: tit.value.trim() || titulo, carpetaId: destino, texto: [extra.value.trim(), n?.texto || ''].filter(Boolean).join('\n\n') });
    dlg.close();
    if (abrir) ctx.navegar(`bitacora/n/${id}`);
    else ctx.aviso(`Guardado en ${dd.nombreRuta(destino)}`);
  };
  const dlg = ventana(ctx, 'Guardar en Bitácora', h('div', { class: 'formulario-campos' },
    h('div', { class: 'bt-compartido' }, url ? h('span', { class: 'bt-con-ic' }, ic('link'), host || url) : null, c.archivos.length ? h('span', { class: 'bt-con-ic' }, ic('clip'), c.archivos.map(f => f.name).join(', ')) : null, !url && !c.archivos.length ? h('span', {}, resumen(c.texto, 90)) : null),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Título'), tit),
    h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Carpeta'), botonCarpeta),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Nota'), extra)),
  { botones: [
    h('button', { type: 'button', class: 'boton peligro', onclick: async () => { listo = true; await m.aPapelera(id); dlg.close(); ctx.aviso('Descartado'); } }, 'Descartar'),
    h('span', { class: 'bt-espacio' }),
    h('button', { type: 'button', class: 'boton', onclick: () => guardar(true) }, 'Abrir'),
    h('button', { type: 'button', class: 'boton principal', onclick: () => guardar(false) }, 'Listo')],
  alCerrar: () => { if (!listo) ctx.aviso('Quedó guardado en la Bandeja'); } });
}

export { hoyISO };

function seccionFilmoteca(ctx, m, d) {
  const { h } = ctx;
  const cfg = configCine(d);
  const clave = h('input', { type: 'password', value: cfg.clave, placeholder: 'Pegá acá la clave de TMDB', autocomplete: 'off', 'aria-label': 'Clave de TMDB' });
  const estado = h('span', { class: 'nota' }, cfg.clave ? 'Clave cargada.' : 'Todavía no cargaste la clave.');
  const ver = h('button', { type: 'button', class: 'boton bt-chico', onclick: () => { clave.type = clave.type === 'password' ? 'text' : 'password'; ver.textContent = clave.type === 'password' ? 'Ver' : 'Ocultar'; } }, 'Ver');
  const probar = async () => {
    estado.textContent = 'Probando…';
    try {
      const { buscar } = await import('./tmdb.js');
      await buscar(clave.value.trim(), 'Relatos salvajes');
      await m.guardarAjuste('general', { tmdbClave: clave.value.trim() });
      estado.textContent = '✓ Funciona. Clave guardada.';
    } catch (e) { estado.textContent = e.message; }
  };
  return h('section', { class: 'tarjeta' }, h('h2', { class: 'bt-con-ic' }, ic('film'), 'Filmoteca'),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Clave de TMDB (se carga una sola vez y queda en tu Drive para la PC y el celular)'),
      h('div', { class: 'bt-ctrl-con-acc' }, clave, ver)),
    h('div', { class: 'botonera' }, h('button', { type: 'button', class: 'boton principal', onclick: probar }, 'Probar y guardar'), estado),
    h('details', { class: 'fm-ayuda' }, h('summary', {}, 'Cómo conseguir la clave (gratis, 5 minutos)'),
      h('ol', {},
        h('li', {}, 'Entrá a themoviedb.org y creá una cuenta (confirmá el mail).'),
        h('li', {}, 'Andá a tu perfil › Configuración › API (themoviedb.org/settings/api).'),
        h('li', {}, 'Pedí una clave de tipo "Developer" / uso personal y completá el formulario (sitio: podés poner la dirección de tu app de GitHub).'),
        h('li', {}, 'Copiá la "Clave de la API" (o el "Token de acceso de lectura", sirve cualquiera de los dos), pegala acá arriba y tocá "Probar y guardar".'))),
    h('div', { class: 'aj-tabla' },
      h('div', { class: 'aj-fila' }, h('span', { class: 'aj-nombre' }, 'Avisar episodios nuevos y estrenos', h('small', { class: 'bt-nota-chica' }, 'Valor inicial para lo que agregues. Después se cambia en cada ficha.')),
        h('button', { type: 'button', class: `aj-switch${cfg.avisarPorDefecto ? ' on' : ''}`, role: 'switch', 'aria-checked': String(cfg.avisarPorDefecto), 'aria-label': 'Avisar por defecto', onclick: () => m.guardarAjuste('general', { avisarCine: !cfg.avisarPorDefecto }) })),
      h('div', { class: 'aj-fila' }, h('span', { class: 'aj-nombre' }, 'Idioma', h('small', { class: 'bt-nota-chica' }, 'El título original se ve aparte en cada ficha')), h('span', {}, 'Español (Latinoamérica)')),
      h('div', { class: 'aj-fila' }, h('span', { class: 'aj-nombre' }, 'Plataformas de'), h('span', {}, 'Argentina')),
      h('div', { class: 'aj-fila' }, h('span', { class: 'aj-nombre' }, 'Pósters', h('small', { class: 'bt-nota-chica' }, 'Se ven desde internet (TMDB). No se guardan en Drive ni en el teléfono.')))));
}
