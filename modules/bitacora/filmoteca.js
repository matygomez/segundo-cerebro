// ─────────────────────────────────────────────────────────────
// Bitácora › Filmoteca: películas y series (al estilo Trakt).
//
// Cada película o serie es una nota de la Bitácora con un campo "cine":
//   { tmdb, tipo: 'movie'|'tv', titulo, original, anio, poster, fondo,
//     generos[], duracion, resumen, estado, calificacion (1-10 = medias
//     estrellas: 9 → 4,5 ★), recomendada, avisar, vistos { 'T-E': fecha },
//     vistas [fechas], agregada, ultimo }
// Lo que cambia con el tiempo (plataformas, temporadas, próximo episodio,
// estreno) se guarda aparte en la colección "cine" y se actualiza desde TMDB.
//
// Rutas: #/bitacora/f · /f/l/<estado> · /f/agregar · /f/stats
//        /f/v/<movie|tv>/<id>  (ver la ficha antes de guardarla)
// Avisos (si los prendés): tareas en Tareas › Sistemas › Filmoteca.
// ─────────────────────────────────────────────────────────────

import * as tmdb from './tmdb.js';
import { ic, ventana, cabecera, vacio, haceCuanto, poner } from './vistas.js';

export const ESTADOS = [
  { id: 'paraver', nombre: 'Pendientes' },
  { id: 'viendo', nombre: 'Viendo', soloTv: true },
  { id: 'vista', nombre: 'Vista' },
  { id: 'abandonada', nombre: 'Abandonada' },
];
export const nombreEstado = (id) => ESTADOS.find(e => e.id === id)?.nombre || (id === 'volver' ? 'Vista' : '');
const NOMBRE_LISTA = { paraver: 'Pendientes', viendo: 'Viendo', vista: 'Vistas', abandonada: 'Abandonadas' };
const pad = (n) => String(n).padStart(2, '0');
export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fechaLinda = (iso, conAnio = false) => { if (!iso) return ''; const [a, m, d] = iso.split('-').map(Number); const f = new Date(a, m - 1, d); return f.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', ...(conAnio || a !== new Date().getFullYear() ? { year: 'numeric' } : {}) }).replace(/\./g, ''); };
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const claveEp = (t, e) => `${t}-${e}`;
const estrellasNum = (v) => String((Number(v) || 0) / 2).replace('.', ',');

// ── Datos ──
export const config = (d) => ({ clave: d.ajuste('general')?.tmdbClave || '', avisarPorDefecto: !!d.ajuste('general')?.avisarCine });
export const items = (d) => d.notas.filter(n => n.cine);
export const vivo = (d, c) => d.cineVivo?.(`${c.tipo}:${c.tmdb}`) || null;

export async function carpetaFilmoteca(m) {
  const lista = (await m.col.carpetas.listar()).filter(c => c.sistema === 'filmoteca').sort((a, b) => a.creado - b.creado);
  for (const extra of lista.slice(1)) {
    for (const n of (await m.col.notas.listar()).filter(x => x.carpetaId === extra.id)) await m.col.notas.actualizar(n.id, { carpetaId: lista[0].id });
    await m.col.carpetas.borrar(extra.id);
  }
  if (lista.length) return lista[0].id;
  return m.col.carpetas.crear({ nombre: 'Filmoteca', icono: '', color: '#6B4E9B', padreId: '', sistema: 'filmoteca', orden: 0, base: false, campos: [], vistas: [] });
}

async function guardarVivo(m, v) {
  if (!v) return;
  const r = (await m.col.cine.listar()).find(x => x.clave === v.clave);
  if (r) await m.col.cine.actualizar(r.id, v); else await m.col.cine.crear(v);
}

export function guardarCine(m, n, cambios) {
  const cine = { ...n.cine, ...cambios, ultimo: Date.now() };
  n.cine = cine;
  return m.guardarNota(n.id, { cine });
}

// "Volver a ver" ya no existe: lo que estaba ahí pasa a Vista.
export async function migrar(m) {
  for (const n of await m.col.notas.listar()) {
    if (n.cine?.estado === 'volver') await m.col.notas.actualizar(n.id, { cine: { ...n.cine, estado: 'vista' } });
  }
}

// Episodios emitidos en orden: [{ t, e }]
export function emitidos(v) {
  const salida = [];
  for (const t of v?.temporadas || []) for (let e = 1; e <= (v.emitidos?.[t.n] ?? t.eps); e++) salida.push({ t: t.n, e });
  return salida;
}
export function progreso(c, v) {
  const lista = emitidos(v);
  const vistos = lista.filter(x => c.vistos?.[claveEp(x.t, x.e)]).length;
  const proximo = lista.find(x => !c.vistos?.[claveEp(x.t, x.e)]) || null;
  return { total: lista.length, vistos, proximo, pct: lista.length ? Math.round(vistos * 100 / lista.length) : 0 };
}
const ultimaVista = (c) => {
  const fechas = [...(c.vistas || []), ...(c.tipo === 'tv' ? Object.values(c.vistos || {}) : [])].filter(Boolean).sort();
  return fechas[fechas.length - 1] || '';
};

// Agregar desde un resultado de TMDB (o a mano). Devuelve el id de la nota.
export async function agregar(ctx, m, d, r, estado, { recomendada = '', nota = '', fecha = '', calificacion = 0, detalle = null } = {}) {
  const { clave, avisarPorDefecto } = config(d);
  let fijo = { tmdb: r.tmdb || 0, tipo: r.tipo, titulo: r.titulo, original: r.original || r.titulo, anio: r.anio || '', poster: r.poster || '', fondo: '', generos: [], duracion: 0, resumen: r.resumen || '' };
  let v = null;
  if (detalle) { fijo = detalle.fijo; v = detalle.vivo; }
  else if (r.tmdb && clave) {
    try { const x = await tmdb.detalle(clave, r.tipo, r.tmdb); fijo = x.fijo; v = x.vivo; } catch (e) { console.warn(e); }
  }
  const cine = { ...fijo, estado, calificacion: calificacion || 0, recomendada, avisar: avisarPorDefecto, vistos: {}, vistas: [], agregada: Date.now(), ultimo: Date.now(), manual: !r.tmdb };
  if (estado === 'vista') {
    const f = fecha || hoyISO();
    cine.vistas = [f];
    if (r.tipo === 'tv') for (const x of emitidos(v)) cine.vistos[claveEp(x.t, x.e)] = f;
  }
  if (v) await guardarVivo(m, v);
  const carpetaId = await carpetaFilmoteca(m);
  return m.crearNota({ titulo: fijo.titulo || r.titulo, carpetaId, texto: nota, cine });
}

// Aviso con "Deshacer" después de agregar.
export function avisoAgregada(ctx, m, id, estado) {
  ctx.aviso(`Agregada a ${NOMBRE_LISTA[estado] || nombreEstado(estado)}`, { accion: 'Deshacer', duracion: 6000, alTocar: async () => { await m.borrarDefinitivo(id); ctx.aviso('Listo, se deshizo'); } });
}

// Actualiza desde TMDB (plataformas, episodios, estrenos).
export async function refrescar(m, d, n, { forzar = false } = {}) {
  const { clave } = config(d);
  const c = n.cine;
  if (!clave || !c?.tmdb || !navigator.onLine) return null;
  const v = vivo(d, c);
  if (!forzar && v && Date.now() - (v.actualizado || 0) < 12 * 3600e3) return v;
  const x = await tmdb.detalle(clave, c.tipo, c.tmdb);
  await guardarVivo(m, x.vivo);
  const faltan = ['poster', 'fondo', 'generos', 'duracion', 'resumen', 'original'].filter(k => !c[k] || (Array.isArray(c[k]) && !c[k].length));
  if (faltan.length) await m.guardarNota(n.id, { cine: { ...c, ...Object.fromEntries(faltan.map(k => [k, x.fijo[k]])) } });
  return x.vivo;
}

// ── Avisos → Tareas › Sistemas › Filmoteca ──
let corriendo = false;
export async function sincronizarAvisos(ctx, m) {
  if (corriendo) return;
  corriendo = true;
  try {
    if (!await ctx.existeAccion?.('sistema-sincronizar')) return;
    const d = await m.cargar();
    const hoy = hoyISO();
    const tareas = [];
    for (const n of items(d)) {
      const c = n.cine;
      if (!c.avisar || !c.tmdb || c.estado === 'abandonada') continue;
      const v = vivo(d, c);
      const notas = v?.plataformas?.length ? `Dónde: ${v.plataformas.join(', ')}` : '';
      if (c.tipo === 'tv' && v?.proximo?.fecha && v.proximo.fecha >= hoy) {
        const p = v.proximo;
        tareas.push({ clave: `filmoteca:ep:${c.tmdb}:T${p.t}E${p.e}`, titulo: `${c.titulo} · T${p.t} E${p.e}${p.nombre && !/^Episodio \d+$/i.test(p.nombre) ? ` – ${p.nombre}` : ''}`, fecha: p.fecha, destino: 'sistema:filmoteca', notas, enlace: `bitacora/n/${n.id}` });
      }
      if (c.tipo === 'movie' && v?.estreno && v.estreno >= hoy && c.estado !== 'vista') {
        tareas.push({ clave: `filmoteca:estreno:${c.tmdb}`, titulo: `Estreno: ${c.titulo}`, fecha: v.estreno, destino: 'sistema:filmoteca', notas, enlace: `bitacora/n/${n.id}` });
      }
    }
    await ctx.pedir('sistema-sincronizar', { modulo: 'bitacora', prefijo: 'filmoteca:', tareas, conservarAntesDe: hoy });
  } catch (e) {
    console.warn('No se pudieron actualizar los avisos de la Filmoteca', e);
  } finally {
    corriendo = false;
  }
}

// Al abrir la app: se ponen al día las que estás viendo o tienen aviso.
export async function actualizarEnFondo(ctx, m) {
  try {
    await migrar(m);
    let d = await m.cargar();
    if (!config(d).clave || !navigator.onLine) return;
    const hoy = hoyISO();
    const pendientes = items(d).filter(n => n.cine.tmdb && (n.cine.estado === 'viendo' || n.cine.avisar || (n.cine.tipo === 'movie' && n.cine.estado === 'paraver' && (vivo(d, n.cine)?.estreno || '9') >= hoy)))
      .filter(n => Date.now() - (vivo(d, n.cine)?.actualizado || 0) > 20 * 3600e3).slice(0, 20);
    for (const n of pendientes) { try { await refrescar(m, d, n, { forzar: true }); } catch (e) { if (e instanceof tmdb.ErrorTMDB) break; } }
    if (pendientes.length) d = await m.cargar();
    await sincronizarAvisos(ctx, m);
  } catch (e) { console.warn(e); }
}

// ── Estadísticas ──
export function estadisticas(d, anio = null) {
  const enRango = (f) => f && (!anio || f.startsWith(String(anio)));
  const meses = Array(12).fill(0);
  const generos = new Map(), plataformas = new Map();
  let pelis = 0, eps = 0, minutos = 0;
  const series = new Set(), califs = [];
  const anios = new Set();
  for (const n of items(d)) {
    const c = n.cine;
    const v = vivo(d, c);
    let tuvo = false;
    if (c.tipo === 'movie') {
      for (const f of c.vistas || []) {
        anios.add(f.slice(0, 4));
        if (!enRango(f)) continue;
        pelis++; minutos += c.duracion || 100; meses[Number(f.slice(5, 7)) - 1]++; tuvo = true;
      }
    } else {
      for (const f of Object.values(c.vistos || {})) {
        anios.add(f.slice(0, 4));
        if (!enRango(f)) continue;
        eps++; minutos += c.duracion || 45; meses[Number(f.slice(5, 7)) - 1]++; tuvo = true; series.add(n.id);
      }
    }
    if (!tuvo) continue;
    for (const g of c.generos || []) generos.set(g, (generos.get(g) || 0) + 1);
    for (const p of v?.plataformas || []) plataformas.set(p, (plataformas.get(p) || 0) + 1);
    if (c.calificacion) califs.push(c.calificacion);
  }
  const top = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return {
    pelis, eps, series: series.size, horas: Math.round(minutos / 60), meses,
    generos: top(generos), plataformas: top(plataformas),
    promedio: califs.length ? (califs.reduce((a, b) => a + b, 0) / califs.length) / 2 : 0,   // en estrellas (0-5)
    anios: [...anios].filter(Boolean).sort(),
  };
}

// ── Piezas visuales ──
export function poster(ctx, c, { tam = 'w342', prog = null, marca = false, clase = '' } = {}) {
  const { h } = ctx;
  const caja = h('div', { class: `fm-poster ${clase}` });
  const respaldo = () => caja.prepend(h('span', { class: 'fm-poster-tit' }, c.titulo || ''));
  if (c.poster) {
    const img = h('img', { src: tmdb.imagen(c.poster, tam), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => { img.remove(); respaldo(); });
    caja.append(img);
  } else respaldo();
  caja.append(h('span', { class: 'fm-tipo' }, c.tipo === 'tv' ? 'SERIE' : 'PELÍCULA'));
  if (marca) caja.append(h('span', { class: 'fm-marca' }, ic('tilde')));
  if (prog !== null) caja.append(h('span', { class: 'fm-prog' }, h('span', { style: `width:${prog}%` })));
  return caja;
}

// Estrellas de solo lectura (valor 1-10 = medias estrellas).
const estrellasTexto = (ctx, v) => ctx.h('span', { class: 'fm-est', title: `${estrellasNum(v)} de 5` }, '★'.repeat(Math.floor(v / 2)), v % 2 ? '½' : '');

// Control: 5 estrellas, tocando la mitad izquierda o derecha de cada una.
export function controlEstrellas(ctx, valor, alCambiar) {
  const { h } = ctx;
  let v = Number(valor) || 0;
  const caja = h('span', { class: 'fm-estrellas', role: 'slider', 'aria-label': 'Calificación', 'aria-valuemin': '0', 'aria-valuemax': '5', tabindex: '0' });
  const pintar = () => {
    caja.setAttribute('aria-valuenow', String(v / 2));
    poner(caja, ...[0, 1, 2, 3, 4].map(i => {
      const lleno = Math.max(0, Math.min(2, v - i * 2)) * 50;
      const s = h('span', { class: 'fm-estrella' }, '★', h('i', { style: `width:${lleno}%` }, '★'));
      s.addEventListener('click', (e) => {
        const r = s.getBoundingClientRect();
        const nuevo = i * 2 + (e.clientX - r.left < r.width / 2 ? 1 : 2);
        v = v === nuevo ? 0 : nuevo;
        pintar(); alCambiar(v);
      });
      return s;
    }), h('span', { class: 'fm-est-n' }, v ? estrellasNum(v) : 'Sin calificar'));
  };
  caja.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); v = Math.max(0, Math.min(10, v + (e.key === 'ArrowRight' ? 1 : -1))); pintar(); alCambiar(v); }
  });
  pintar();
  return caja;
}

function tarjeta(ctx, d, n, { sub = '', rec = false, est = false, prog = null, marca = false } = {}) {
  const { h } = ctx;
  const c = n.cine;
  return h('a', { href: `#/bitacora/n/${n.id}`, class: 'fm-item', title: c.titulo },
    poster(ctx, c, { prog, marca }),
    h('span', { class: 'fm-it' }, c.titulo),
    sub ? h('span', { class: 'fm-is' }, sub) : null,
    rec && c.recomendada ? h('span', { class: 'fm-rec' }, `Recomendada por ${c.recomendada}`) : null,
    est && c.calificacion ? estrellasTexto(ctx, c.calificacion) : null);
}

export const subtituloViendo = (d, c) => {
  const v = vivo(d, c);
  const p = progreso(c, v);
  if (p.proximo) return `T${p.proximo.t} · E${p.proximo.e} próximo`;
  if (v?.proximo?.fecha) return `Al día · nuevo ${fechaLinda(v.proximo.fecha)}`;
  return p.total ? 'Al día' : '';
};

export const listaViendo = (d, tipo = '') => items(d).filter(n => n.cine.estado === 'viendo' && (!tipo || n.cine.tipo === tipo)).sort((a, b) => (b.cine.ultimo || 0) - (a.cine.ultimo || 0));

export function filaSeguirViendo(ctx, d) {
  const { h } = ctx;
  const l = listaViendo(d);
  if (!l.length) return null;
  return h('div', { class: 'fm-carrusel' }, l.map(n => tarjeta(ctx, d, n, { sub: subtituloViendo(d, n.cine), prog: progreso(n.cine, vivo(d, n.cine)).pct })));
}

// Selector Películas · Series · Ambos (se recuerda mientras la app está abierta).
let filtroTipo = '';
function selectorTipo(ctx, alCambiar) {
  const { h } = ctx;
  return h('div', { class: 'bt-seg fm-tipo-sel', role: 'radiogroup', 'aria-label': 'Mostrar' },
    [['movie', 'Películas'], ['tv', 'Series'], ['', 'Ambos']].map(([v, t]) => h('button', { type: 'button', class: filtroTipo === v ? 'sel' : '', 'aria-pressed': String(filtroTipo === v), onclick: () => { filtroTipo = v; alCambiar(); } }, t)));
}

// ── Portada ──
export function pantallaFilmoteca(ctx, m, d, main) {
  const { h } = ctx;
  const todos = items(d).filter(n => !filtroTipo || n.cine.tipo === filtroTipo);
  const hoy = hoyISO();
  const fila = (titulo, lista, opciones, link) => (lista.length ? [
    h('div', { class: 'fm-fila-t' }, h('h2', {}, titulo), link ? h('a', { href: link }, 'Ver todo ›') : null),
    h('div', { class: 'fm-carrusel' }, lista.map(n => tarjeta(ctx, d, n, opciones(n)))),
  ] : []);
  const viendo = listaViendo(d, filtroTipo);
  const pendientes = todos.filter(n => n.cine.estado === 'paraver').sort((a, b) => (b.cine.agregada || 0) - (a.cine.agregada || 0));
  const proximos = todos.filter(n => n.cine.estado !== 'abandonada').map(n => {
    const v = vivo(d, n.cine);
    const f = n.cine.tipo === 'tv' ? v?.proximo?.fecha : (n.cine.estado !== 'vista' ? v?.estreno : '');
    return f && f >= hoy ? { n, f, v } : null;
  }).filter(Boolean).sort((a, b) => a.f.localeCompare(b.f));
  const vistas = todos.filter(n => ['vista', 'volver'].includes(n.cine.estado) && ultimaVista(n.cine)).sort((a, b) => ultimaVista(b.cine).localeCompare(ultimaVista(a.cine)));
  const st = estadisticas(d, new Date().getFullYear());
  const cfg = config(d);

  poner(main,
    cabecera(ctx, { titulo: 'Filmoteca', marca: ic('film'), volver: { href: '#/bitacora', texto: 'Bitácora' },
      botones: [h('a', { href: '#/bitacora/f/stats', class: 'boton' }, ic('grafico'), h('span', { class: 'fm-oc-cel' }, 'Estadísticas')), h('a', { href: '#/bitacora/f/agregar', class: 'boton principal' }, ic('mas'), 'Agregar')] }),
    !cfg.clave ? h('div', { class: 'fm-aviso' }, 'Para buscar películas y series (con pósters, episodios y plataformas) falta cargar la clave de TMDB. ', h('a', { href: '#/bitacora/ajustes' }, 'Cargarla ›')) : null,
    h('a', { href: '#/bitacora/f/agregar', class: 'bt-busca' }, ic('buscar'), h('span', {}, 'Buscar película o serie para agregar…')),
    selectorTipo(ctx, () => pantallaFilmoteca(ctx, m, d, main)),
    ...fila('Seguir viendo', viendo, (n) => ({ sub: subtituloViendo(d, n.cine), prog: progreso(n.cine, vivo(d, n.cine)).pct }), '#/bitacora/f/l/viendo'),
    ...fila('Pendientes', pendientes.slice(0, 15), (n) => ({ sub: [n.cine.anio, n.cine.tipo === 'tv' ? 'Serie' : 'Película'].filter(Boolean).join(' · '), rec: true }), '#/bitacora/f/l/paraver'),
    ...fila('Próximos estrenos y episodios', proximos.slice(0, 15).map(x => x.n), (n) => { const x = proximos.find(y => y.n === n); return { sub: n.cine.tipo === 'tv' ? `T${x.v.proximo.t} E${x.v.proximo.e} · ${fechaLinda(x.f)}` : `Estreno · ${fechaLinda(x.f)}` }; }, null),
    ...fila('Vistas hace poco', vistas.slice(0, 15), (n) => ({ sub: fechaLinda(ultimaVista(n.cine)), est: true, marca: true }), '#/bitacora/f/l/vista'),
    !todos.length ? vacio(ctx, filtroTipo ? 'Nada por acá' : 'Todavía no agregaste nada', filtroTipo ? 'Probá con "Ambos".' : 'Buscá una película o serie con "Agregar". Tocando un resultado ves su ficha antes de guardarla.') : null,
    h('a', { href: '#/bitacora/f/stats', class: 'fm-stats', title: 'Ver estadísticas' },
      h('div', { class: 'fm-stat' }, h('b', {}, `${st.horas} h`), h('span', {}, `vistas en ${new Date().getFullYear()}`)),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.pelis)), h('span', {}, 'películas')),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.eps)), h('span', {}, 'episodios')),
      h('div', { class: 'fm-stat' }, h('b', {}, st.promedio ? st.promedio.toFixed(1).replace('.', ',') : '—'), h('span', {}, 'tu calificación promedio'))),
    h('p', { class: 'fm-tmdb' }, 'Datos e imágenes: TMDB. Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.'),
  );
}

// ── Lista completa ──
const filtrosLista = { orden: 'agregada', rec: '', plat: '' };
export function pantallaLista(ctx, m, d, estado, main) {
  const { h } = ctx;
  const f = filtrosLista;
  const base = items(d).filter(n => n.cine.estado === estado || (estado === 'vista' && n.cine.estado === 'volver'));
  const recs = [...new Set(base.map(n => n.cine.recomendada).filter(Boolean))].sort();
  const plats = [...new Set(base.flatMap(n => vivo(d, n.cine)?.plataformas || []))].sort();
  let l = base.filter(n => (!filtroTipo || n.cine.tipo === filtroTipo) && (!f.rec || n.cine.recomendada === f.rec) && (!f.plat || (vivo(d, n.cine)?.plataformas || []).includes(f.plat)));
  const ord = {
    agregada: (a, b) => (b.cine.agregada || 0) - (a.cine.agregada || 0),
    titulo: (a, b) => sinTildes(a.cine.titulo).localeCompare(sinTildes(b.cine.titulo)),
    anio: (a, b) => String(b.cine.anio).localeCompare(String(a.cine.anio)),
    calificacion: (a, b) => (b.cine.calificacion || 0) - (a.cine.calificacion || 0),
    ultima: (a, b) => ultimaVista(b.cine).localeCompare(ultimaVista(a.cine)),
  };
  l = l.sort(ord[f.orden] || ord.agregada);
  const re = () => pantallaLista(ctx, m, d, estado, main);
  const sel = (clave, opciones, etiqueta) => h('select', { class: 'fm-sel', 'aria-label': etiqueta, onchange: (e) => { f[clave] = e.target.value; re(); } },
    opciones.map(([v, t]) => h('option', { value: v, selected: f[clave] === v }, t)));
  poner(main,
    cabecera(ctx, { titulo: NOMBRE_LISTA[estado] || nombreEstado(estado), volver: { href: '#/bitacora/f', texto: 'Filmoteca' }, botones: [h('a', { href: '#/bitacora/f/agregar', class: 'boton principal' }, ic('mas'), 'Agregar')] }),
    h('div', { class: 'fm-filtros' },
      selectorTipo(ctx, re),
      sel('orden', [['agregada', 'Agregadas'], ['titulo', 'Título'], ['anio', 'Año'], ['calificacion', 'Calificación'], ['ultima', 'Última vez vista']], 'Orden'),
      recs.length ? sel('rec', [['', 'Recomendada por: todos'], ...recs.map(r => [r, r])], 'Recomendada por') : null,
      plats.length ? sel('plat', [['', 'Plataforma: todas'], ...plats.map(p => [p, p])], 'Plataforma') : null),
    l.length ? h('div', { class: 'fm-grilla' }, l.map(n => tarjeta(ctx, d, n, {
      sub: estado === 'viendo' ? subtituloViendo(d, n.cine) : estado === 'vista' ? fechaLinda(ultimaVista(n.cine)) : [n.cine.anio, n.cine.tipo === 'tv' ? 'Serie' : 'Película'].filter(Boolean).join(' · '),
      rec: estado === 'paraver', est: estado === 'vista', prog: estado === 'viendo' ? progreso(n.cine, vivo(d, n.cine)).pct : null,
    }))) : vacio(ctx, 'No hay nada acá', null));
}

// ── Agregar ──
let ultimaBusqueda = '';
const existente = (d, tipo, id) => items(d).find(n => n.cine.tmdb === Number(id) && n.cine.tipo === tipo);

export function pantallaAgregar(ctx, m, d, main) {
  const { h } = ctx;
  const cfg = config(d);
  const input = h('input', { type: 'search', class: 'bt-busca-input', placeholder: 'Nombre de la película o serie', value: ultimaBusqueda, autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Buscar' });
  const res = h('div', {});
  let espera = null, turno = 0;
  async function buscarYa() {
    ultimaBusqueda = input.value;
    const q = input.value.trim();
    const mio = ++turno;
    if (!q) { poner(res, h('p', { class: 'nota' }, cfg.clave ? 'Escribí el nombre. Tocá un resultado para ver su ficha antes de guardarla.' : 'Sin la clave de TMDB solo podés cargar a mano.')); return; }
    if (!cfg.clave) return;
    poner(res, h('p', { class: 'cargando' }, 'Buscando…'));
    try {
      const lista = await tmdb.buscar(cfg.clave, q);
      if (mio !== turno) return;
      poner(res, lista.length ? h('section', { class: 'tarjeta fm-res-lista' }, lista.slice(0, 20).map(r => {
        const ya = existente(d, r.tipo, r.tmdb);
        return h('a', { href: ya ? `#/bitacora/n/${ya.id}` : `#/bitacora/f/v/${r.tipo}/${r.tmdb}`, class: 'fm-res' },
          poster(ctx, r, { tam: 'w154', clase: 'chico' }),
          h('div', { class: 'fm-res-t' }, h('b', {}, r.titulo), h('small', {}, [r.tipo === 'tv' ? 'Serie' : 'Película', r.anio, r.original && r.original !== r.titulo ? r.original : ''].filter(Boolean).join(' · ')),
            r.resumen ? h('span', { class: 'fm-res-sin' }, r.resumen.slice(0, 140) + (r.resumen.length > 140 ? '…' : '')) : null),
          h('div', { class: 'fm-res-b' }, ya
            ? h('span', { class: 'fm-ya' }, `En ${NOMBRE_LISTA[ya.cine.estado] || nombreEstado(ya.cine.estado)}`)
            : h('button', { type: 'button', class: 'boton bt-chico', onclick: async (e) => { e.preventDefault(); e.stopPropagation(); const id = await agregar(ctx, m, d, r, 'paraver'); avisoAgregada(ctx, m, id, 'paraver'); } }, ic('reloj'), 'Pendientes')));
      })) : h('p', { class: 'nota' }, 'TMDB no encontró nada con ese nombre. Probá con el título original o cargala a mano.'));
    } catch (e) {
      if (mio === turno) poner(res, h('p', { class: 'nota error' }, e.message));
    }
  }
  input.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(buscarYa, 400); });
  poner(main,
    cabecera(ctx, { titulo: 'Agregar', volver: { href: '#/bitacora/f', texto: 'Filmoteca' } }),
    !cfg.clave ? h('div', { class: 'fm-aviso' }, 'Falta la clave de TMDB para buscar. ', h('a', { href: '#/bitacora/ajustes' }, 'Cargarla ›')) : null,
    h('div', { class: 'bt-busca-fila' }, ic('buscar'), input),
    res,
    h('div', { class: 'botonera' }, h('button', { type: 'button', class: 'boton', onclick: () => cargarAMano(ctx, m, d) }, 'Cargar a mano')),
  );
  buscarYa();
  setTimeout(() => input.focus(), 50);
}

// Ficha de algo que todavía no guardaste.
export async function pantallaPrevia(ctx, m, d, tipo, id, main) {
  const { h } = ctx;
  const ya = existente(d, tipo, id);
  if (ya) { location.replace(`#/bitacora/n/${ya.id}`); return; }
  const volver = { href: '#/bitacora/f/agregar', texto: 'Resultados' };
  poner(main, h('a', { href: volver.href, class: 'bt-volver' }, `‹ ${volver.texto}`), h('p', { class: 'cargando' }, 'Cargando…'));
  let x;
  try { x = await tmdb.detalle(config(d).clave, tipo, id); } catch (e) {
    poner(main, cabecera(ctx, { titulo: 'No se pudo abrir', volver }), h('p', { class: 'nota error' }, e.message));
    return;
  }
  const n = { id: '', titulo: x.fijo.titulo, cine: { ...x.fijo, estado: '', vistos: {}, vistas: [] } };
  const ficha = encabezadoCine(ctx, m, d, n, { previa: true, vivo: x.vivo });
  const r = { tmdb: x.fijo.tmdb, tipo, titulo: x.fijo.titulo };
  const agregarComo = async (estado, extra = {}) => {
    const nid = await agregar(ctx, m, d, r, estado, { ...extra, detalle: x });
    avisoAgregada(ctx, m, nid, estado);
    ctx.navegar(`bitacora/n/${nid}`);
  };
  poner(main,
    h('a', { href: volver.href, class: 'bt-volver' }, `‹ ${volver.texto}`),
    h('article', { class: 'bt-nota fm-nota' }, ficha.el,
      h('div', { class: 'fm-barra-abajo' },
        h('span', { class: 'fm-barra-t' }, 'Todavía no está guardada · agregala a'),
        h('div', { class: 'fm-barra-b' },
          h('button', { type: 'button', class: 'boton', onclick: () => agregarComo('paraver') }, ic('reloj'), 'Pendientes'),
          tipo === 'tv' ? h('button', { type: 'button', class: 'boton', onclick: () => agregarComo('viendo') }, ic('play'), 'Viendo') : null,
          h('button', { type: 'button', class: 'boton principal', onclick: () => dialogoLaVi(ctx, { titulo: 'Ya la vi', alGuardar: (fecha, cal) => agregarComo('vista', { fecha, calificacion: cal }) }) }, ic('tilde'), 'Ya la vi')))));
}

export function dialogoLaVi(ctx, { titulo = 'La vi', calificacion = 0, fecha = '', alGuardar }) {
  const { h } = ctx;
  const f = h('input', { type: 'date', value: fecha || hoyISO(), max: hoyISO(), 'aria-label': 'Cuándo' });
  let cal = calificacion;
  const dlg = ventana(ctx, titulo, h('div', { class: 'formulario-campos' },
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Cuándo'), f),
    h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Calificación (opcional)'), controlEstrellas(ctx, cal, (v) => { cal = v; }))), {
    botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { type: 'button', class: 'boton principal', onclick: async () => { dlg.close(); await alGuardar(f.value || hoyISO(), cal); } }, 'Guardar')],
  });
}

function cargarAMano(ctx, m, d) {
  ctx.formulario({
    titulo: 'Cargar a mano', textoGuardar: 'Agregar',
    campos: [
      { id: 'titulo', etiqueta: 'Título', tipo: 'texto', requerido: true },
      { id: 'tipo', etiqueta: 'Tipo', tipo: 'seleccion', requerido: true, opciones: [{ valor: 'movie', texto: 'Película' }, { valor: 'tv', texto: 'Serie' }], valor: 'movie' },
      { id: 'anio', etiqueta: 'Año (opcional)', tipo: 'texto' },
      { id: 'estado', etiqueta: 'Lista', tipo: 'seleccion', requerido: true, opciones: ESTADOS.map(e => ({ valor: e.id, texto: e.nombre })), valor: 'paraver' },
    ],
  }).then(async (r) => {
    if (!r) return;
    const estado = r.tipo === 'movie' && r.estado === 'viendo' ? 'paraver' : r.estado;
    const id = await agregar(ctx, m, d, { tipo: r.tipo, titulo: r.titulo, anio: r.anio }, estado);
    avisoAgregada(ctx, m, id, estado);
    ctx.navegar(`bitacora/n/${id}`);
  });
}

// ── Estadísticas ──
let anioStats = new Date().getFullYear();
export function pantallaStats(ctx, m, d, main) {
  const { h } = ctx;
  const st0 = estadisticas(d, null);
  const anios = [...new Set([...st0.anios, String(new Date().getFullYear())])].sort().slice(-4);
  const st = estadisticas(d, anioStats || null);
  const max = Math.max(1, ...st.meses);
  const barras = (lista) => (lista.length ? h('div', { class: 'fm-barras' }, lista.map(([n, v]) => h('div', {}, h('span', {}, n), h('i', { style: `width:${Math.round(v * 100 / lista[0][1])}%` }), h('span', {}, String(v))))) : h('p', { class: 'nota' }, 'Sin datos todavía.'));
  poner(main,
    cabecera(ctx, { titulo: 'Estadísticas', marca: ic('grafico'), volver: { href: '#/bitacora/f', texto: 'Filmoteca' } }),
    h('div', { class: 'bt-seg fm-anios' }, [...anios.map(a => [Number(a), a]), [0, 'Todo']].map(([v, t]) => h('button', { type: 'button', class: anioStats === v ? 'sel' : '', onclick: () => { anioStats = v; pantallaStats(ctx, m, d, main); } }, t))),
    h('div', { class: 'fm-stats' },
      h('div', { class: 'fm-stat' }, h('b', {}, `${st.horas} h`), h('span', {}, 'vistas')),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.pelis)), h('span', {}, 'películas')),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.eps)), h('span', {}, `episodios · ${st.series} serie${st.series === 1 ? '' : 's'}`)),
      h('div', { class: 'fm-stat' }, h('b', {}, st.promedio ? st.promedio.toFixed(1).replace('.', ',') : '—'), h('span', {}, 'calificación promedio (de 5)'))),
    anioStats ? h('section', { class: 'tarjeta' }, h('h2', {}, 'Por mes'), h('div', { class: 'fm-meses' }, st.meses.map((v, i) => h('div', { title: `${v}` }, h('small', {}, v ? String(v) : ''), h('i', { style: `height:${Math.round(v * 100 / max)}%` }), 'EFMAMJJASOND'[i])))) : null,
    h('section', { class: 'tarjeta' }, h('h2', {}, 'Géneros que más viste'), barras(st.generos)),
    h('section', { class: 'tarjeta' }, h('h2', {}, 'Plataformas'), barras(st.plataformas), h('p', { class: 'nota' }, 'Según en qué plataforma está cada título en Argentina.')),
  );
}

// ── Ficha (va arriba de la nota; con previa: true, de algo no guardado) ──
export function encabezadoCine(ctx, m, d, n, opciones = {}) {
  const { h } = ctx;
  const previa = !!opciones.previa;
  const el = h('div', { class: 'fm-ficha' });
  const abiertas = new Map();      // temporada → abierta
  const episodios = new Map();     // temporada → lista de TMDB
  const desplegados = new Set();   // episodios con el detalle abierto
  let refrescando = false;
  const vivoActual = () => opciones.vivo || vivo(d, n.cine);

  function pintar() {
    const c = n.cine;
    const v = vivoActual();
    const esTv = c.tipo === 'tv';
    const hoy = hoyISO();
    const fondo = c.fondo ? `linear-gradient(90deg, rgb(10 14 16 / .92) 0%, rgb(10 14 16 / .7) 55%, rgb(10 14 16 / .35)), url("${tmdb.imagen(c.fondo, 'w780')}")` : '';
    const meta = esTv
      ? [c.anio, v?.temporadas?.length ? `${v.temporadas.length} temporada${v.temporadas.length === 1 ? '' : 's'}` : '', v ? `${emitidos(v).length} episodios` : '', c.duracion ? `~${c.duracion} min` : '', v?.terminada ? 'Terminada' : v?.estado === 'Returning Series' ? 'En emisión' : '']
      : [c.anio, c.duracion ? `${Math.floor(c.duracion / 60)} h ${c.duracion % 60} min` : ''];
    const prog = esTv ? progreso(c, v) : null;
    const estreno = !esTv && v?.estreno && v.estreno > hoy ? v.estreno : '';
    const vistaEl = !esTv && (c.vistas || []).length ? [...c.vistas].sort().pop() : '';

    const filas = [];
    filas.push(['Dónde verla', v?.plataformas?.length ? h('span', {}, h('span', { class: 'fm-plat' }, v.plataformas.map(p => h('span', {}, p))), h('span', { class: 'fm-nota' }, ' en Argentina')) : h('span', { class: 'fm-nota' }, v ? 'No está en plataformas de Argentina' : c.tmdb ? 'Se ve al tener conexión' : '—')]);
    if (estreno) filas.push(['Estreno', h('span', {}, fechaLinda(estreno, true))]);
    if (esTv && v?.proximo?.fecha) filas.push(['Próximo episodio', h('span', {}, `T${v.proximo.t} E${v.proximo.e} · ${fechaLinda(v.proximo.fecha, true)}`)]);
    if (!previa) {
      if (vistaEl) filas.push(['La viste', h('button', { type: 'button', class: 'fm-link', title: 'Cambiar la fecha', onclick: () => cambiarFechaVista(vistaEl) }, fechaLinda(vistaEl, true))]);
      filas.push(['Tu calificación', controlEstrellas(ctx, c.calificacion, (x) => guardarCine(m, n, { calificacion: x }))]);
      const rec = h('input', { type: 'text', value: c.recomendada || '', list: 'fm-recs-ficha', placeholder: '—', 'aria-label': 'Recomendada por' });
      rec.addEventListener('change', () => guardarCine(m, n, { recomendada: rec.value.trim() }));
      filas.push(['Recomendada por', h('span', {}, rec, h('datalist', { id: 'fm-recs-ficha' }, [...new Set(items(d).map(x => x.cine.recomendada).filter(Boolean))].sort().map(x => h('option', { value: x }))))]);
      if (c.tmdb && (esTv ? !v?.terminada : (estreno || c.estado !== 'vista'))) {
        filas.push([esTv ? 'Avisarme episodios nuevos' : 'Avisarme el estreno', h('span', { class: 'fm-sw-fila' },
          h('button', { type: 'button', class: `aj-switch${c.avisar ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!c.avisar), 'aria-label': 'Avisarme', onclick: () => guardarCine(m, n, { avisar: !c.avisar }) }),
          h('span', { class: 'fm-nota' }, 'llega como tarea a Tareas › Sistemas'))]);
      }
    }

    poner(el,
      h('div', { class: 'fm-hero', style: fondo ? `background-image:${fondo}` : null },
        poster(ctx, c, { tam: 'w342' }),
        h('div', { class: 'fm-hero-t' },
          h('h1', {}, c.titulo),
          h('div', { class: 'fm-meta' }, meta.filter(Boolean).join(' · ')),
          c.generos?.length ? h('div', { class: 'fm-gen' }, c.generos.map(g => h('span', {}, g))) : null)),
      h('div', { class: 'fm-orig' }, h('b', {}, 'Título original'), c.original || c.titulo),
      c.resumen ? h('p', { class: 'fm-sinopsis' }, c.resumen) : null,
      previa ? null : h('div', { class: 'fm-acciones' },
        h('div', { class: 'fm-estado', role: 'radiogroup', 'aria-label': 'Lista' }, ESTADOS.filter(e => esTv || !e.soloTv).map(e => h('button', {
          type: 'button', class: (c.estado === e.id || (e.id === 'vista' && c.estado === 'volver')) ? 'sel' : '', 'aria-pressed': String(c.estado === e.id),
          onclick: () => cambiarEstado(e.id),
        }, e.nombre)))),
      h('section', { class: 'tarjeta fm-props' }, h('dl', {}, filas.map(([k, val]) => [h('dt', {}, k), h('dd', {}, val)]))),
      esTv ? zonaEpisodios(c, v, prog) : null,
    );
  }

  async function cambiarEstado(estado) {
    const c = n.cine;
    if (c.estado === estado) return;
    const antes = { estado: c.estado, vistas: [...(c.vistas || [])], vistos: { ...(c.vistos || {}) }, calificacion: c.calificacion };
    const deshacer = () => ctx.aviso(`Movida a ${NOMBRE_LISTA[estado]}`, { accion: 'Deshacer', duracion: 6000, alTocar: () => guardarCine(m, n, antes) });
    if (estado === 'vista' && c.tipo === 'movie' && !(c.vistas || []).length) {
      dialogoLaVi(ctx, { titulo: 'La vi', calificacion: c.calificacion, alGuardar: async (f, cal) => { await guardarCine(m, n, { estado, vistas: [f], calificacion: cal || c.calificacion }); deshacer(); } });
      return;
    }
    const cambios = { estado };
    if (estado === 'vista' && c.tipo === 'tv') {
      const v = vivoActual();
      const vistos = { ...(c.vistos || {}) };
      const pend = emitidos(v).filter(x => !vistos[claveEp(x.t, x.e)]);
      if (pend.length && await ctx.confirmar(`¿Marco los ${pend.length} episodios que faltan como vistos hoy?`, { si: 'Sí, marcarlos', no: 'No, solo cambiar la lista' })) {
        for (const x of pend) vistos[claveEp(x.t, x.e)] = hoyISO();
        cambios.vistos = vistos;
      }
      if (!(c.vistas || []).length) cambios.vistas = [hoyISO()];
    }
    await guardarCine(m, n, cambios);
    deshacer();
  }

  function cambiarFechaVista(actual) {
    const f = h('input', { type: 'date', value: actual, max: hoyISO(), 'aria-label': 'Fecha' });
    const dlg = ventana(ctx, '¿Cuándo la viste?', f, {
      botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { type: 'button', class: 'boton principal', onclick: async () => { dlg.close(); if (f.value) { const l = [...(n.cine.vistas || [])]; l[l.lastIndexOf(actual)] = f.value; await guardarCine(m, n, { vistas: l }); } } }, 'Guardar')],
    });
  }

  function zonaEpisodios(c, v, prog) {
    if (!v?.temporadas?.length) return h('p', { class: 'nota' }, c.tmdb ? 'Los episodios aparecen cuando haya conexión con TMDB.' : 'Cargada a mano: sin lista de episodios.');
    const hoy = hoyISO();
    const marcar = async (lista, valor) => {
      const vistos = { ...(c.vistos || {}) };
      for (const x of lista) { if (valor) vistos[claveEp(x.t, x.e)] = vistos[claveEp(x.t, x.e)] || valor; else delete vistos[claveEp(x.t, x.e)]; }
      const cambios = { vistos };
      if (valor && ['paraver', 'volver', 'abandonada'].includes(c.estado)) cambios.estado = 'viendo';
      const p = progreso({ ...c, vistos }, v);
      if (valor && !p.proximo && v.terminada && c.estado !== 'vista') {
        cambios.estado = 'vista';
        if (!(c.vistas || []).length) cambios.vistas = [hoy];
        ctx.aviso('¡Terminaste la serie! Quedó en Vistas.');
      }
      await guardarCine(m, n, cambios);
    };
    const todos = emitidos(v);
    const proxima = prog.proximo;
    const secciones = v.temporadas.map(t => {
      const em = v.emitidos?.[t.n] ?? t.eps;
      const vistosT = Array.from({ length: em }, (_, i) => c.vistos?.[claveEp(t.n, i + 1)]).filter(Boolean).length;
      const abierta = abiertas.has(t.n) ? abiertas.get(t.n) : (previa ? t.n === v.temporadas[0].n : proxima ? proxima.t === t.n : t.n === v.temporadas[v.temporadas.length - 1].n);
      const det = h('details', { class: 'fm-temp', open: abierta });
      det.addEventListener('toggle', () => { abiertas.set(t.n, det.open); if (det.open && !episodios.has(t.n)) cargarTemporada(t.n); });
      const lista = episodios.get(t.n);
      const eps = Array.from({ length: Math.max(t.eps, lista?.length || 0) }, (_, i) => {
        const e = i + 1, info = lista?.find(x => x.e === e);
        const visto = c.vistos?.[claveEp(t.n, e)];
        const salio = e <= em || (info?.fecha && info.fecha <= hoy);
        const esProx = !previa && proxima && proxima.t === t.n && proxima.e === e;
        const clave = claveEp(t.n, e);
        const abierto = desplegados.has(clave);
        const alternar = () => { if (desplegados.has(clave)) desplegados.delete(clave); else desplegados.add(clave); pintar(); };
        const nombre = `E${e}${info?.nombre && !/^Episodio \d+$/i.test(info.nombre) ? ` · ${info.nombre}` : ''}`;
        const sub = visto ? `visto el ${fechaLinda(visto)}` : esProx ? 'próximo para ver' : info?.fecha ? (salio ? fechaLinda(info.fecha, true) : `sale el ${fechaLinda(info.fecha, true)}`) : (salio ? '' : 'todavía no salió');
        return h('div', { class: `fm-ep${esProx ? ' prox' : ''}${salio ? '' : ' futuro'}${abierto ? ' abierto' : ''}` },
          h('div', { class: 'fm-ep-fila' },
            previa ? null : h('input', { type: 'checkbox', checked: !!visto, disabled: !salio, 'aria-label': `T${t.n} E${e}`, onchange: (ev) => marcar([{ t: t.n, e }], ev.target.checked ? hoy : null) }),
            h('button', { type: 'button', class: 'fm-ep-n', 'aria-expanded': String(abierto), onclick: alternar }, h('span', {}, nombre), sub ? h('small', {}, sub) : null),
            !previa && salio && !visto ? h('button', { type: 'button', class: 'fm-hasta', onclick: () => marcar(todos.filter(x => x.t < t.n || (x.t === t.n && x.e <= e)), hoy) }, 'Hasta acá') : null,
            h('button', { type: 'button', class: 'fm-ep-fl', 'aria-label': abierto ? 'Ocultar detalle' : 'Ver detalle', onclick: alternar }, ic('flecha'))),
          abierto ? h('div', { class: 'fm-ep-d' },
            info?.imagen ? h('img', { class: 'fm-ep-img', src: tmdb.imagen(info.imagen, 'w300'), alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('div', { class: 'fm-ep-img vacia' }),
            h('div', {},
              h('small', {}, [info?.fecha ? fechaLinda(info.fecha, true) : '', info?.duracion ? `${info.duracion} min` : ''].filter(Boolean).join(' · ') || (lista === null ? 'Cargando…' : '')),
              h('p', {}, info?.resumen || (lista ? 'Sin descripción.' : navigator.onLine ? 'Cargando…' : 'Sin conexión.')),
              visto && !previa ? h('button', { type: 'button', class: 'fm-link', onclick: () => cambiarFecha(t.n, e, visto) }, 'Cambiar la fecha en que lo viste') : null)) : null);
      });
      det.append(
        h('summary', {}, h('span', { class: 'fm-temp-n' }, t.nombre || `Temporada ${t.n}`),
          em && !previa ? h('span', { class: 'fm-temp-bar' }, h('span', { style: `width:${Math.round(vistosT * 100 / em)}%` })) : null,
          h('span', { class: 'fm-nota fm-temp-c' }, em ? (previa ? `${em} episodios` : `${vistosT} / ${em}`) : t.fecha ? `sale ${fechaLinda(t.fecha, true)}` : 'próximamente'),
          h('span', { class: 'bt-espacio' }),
          !previa && em && vistosT < em ? h('button', { type: 'button', class: 'boton bt-chico', onclick: (ev) => { ev.preventDefault(); marcar(Array.from({ length: em }, (_, i) => ({ t: t.n, e: i + 1 })), hoy); } }, 'Temporada completa') : null),
        h('div', { class: 'fm-eps' }, eps));
      if (abierta && !episodios.has(t.n)) cargarTemporada(t.n);
      return det;
    });
    return h('section', { class: 'fm-episodios' },
      h('div', { class: 'fm-fila-t' }, h('h2', {}, 'Episodios'), !previa && prog.total ? h('span', { class: 'fm-nota' }, `${prog.vistos} de ${prog.total} vistos${proxima ? ` · próximo T${proxima.t} E${proxima.e}` : ' · al día'}`) : null),
      secciones);
  }

  function cambiarFecha(t, e, actual) {
    const f = h('input', { type: 'date', value: actual, max: hoyISO(), 'aria-label': 'Fecha' });
    const dlg = ventana(ctx, `T${t} E${e}: ¿cuándo lo viste?`, f, {
      botones: [
        h('button', { type: 'button', class: 'boton peligro', onclick: async () => { dlg.close(); const vistos = { ...n.cine.vistos }; delete vistos[claveEp(t, e)]; await guardarCine(m, n, { vistos }); } }, 'Desmarcar'),
        h('span', { class: 'bt-espacio' }),
        h('button', { type: 'button', class: 'boton principal', onclick: async () => { dlg.close(); if (f.value) await guardarCine(m, n, { vistos: { ...n.cine.vistos, [claveEp(t, e)]: f.value } }); } }, 'Guardar')],
    });
  }

  async function cargarTemporada(t) {
    const { clave } = config(d);
    if (!clave || !navigator.onLine || !n.cine.tmdb) return;
    episodios.set(t, null);
    try { episodios.set(t, await tmdb.temporada(clave, n.cine.tmdb, t)); pintar(); } catch { episodios.delete(t); }
  }

  async function actualizarDesdeTMDB() {
    if (refrescando || previa) return;
    refrescando = true;
    try { const v = await refrescar(m, d, n); if (v) { d = await m.cargar(); n = d.nota(n.id) || n; pintar(); } } catch (e) { console.warn(e); }
    refrescando = false;
  }

  pintar();
  actualizarDesdeTMDB();
  return {
    el,
    actualizar(nuevo, d2) {
      d = d2; n = nuevo;
      if (!el.contains(document.activeElement) || document.activeElement?.type === 'checkbox' || document.activeElement?.tagName === 'BUTTON' || document.activeElement?.classList?.contains('fm-estrellas')) pintar();
    },
  };
}

export { haceCuanto };
