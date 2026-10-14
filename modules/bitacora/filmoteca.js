// ─────────────────────────────────────────────────────────────
// Bitácora › Filmoteca: películas y series (al estilo Trakt).
//
// Cada película o serie es una nota de la Bitácora con un campo "cine":
//   { tmdb, tipo: 'movie'|'tv', titulo, original, anio, poster, fondo,
//     generos[], duracion, resumen, estado, calificacion (1-10),
//     recomendada, avisar, vistos { 'T-E': 'AAAA-MM-DD' }, vistas [fechas],
//     agregada, ultimo }
// Lo que cambia con el tiempo (plataformas, temporadas, próximo episodio,
// estreno) se guarda aparte en la colección "cine" y se actualiza desde TMDB.
//
// Rutas: #/bitacora/f · /f/l/<estado> · /f/agregar · /f/stats
// Avisos (si los prendés): tareas en Tareas › Sistemas › Filmoteca.
// ─────────────────────────────────────────────────────────────

import * as tmdb from './tmdb.js';
import { ic, ventana, cabecera, vacio, haceCuanto, poner } from './vistas.js';

export const ESTADOS = [
  { id: 'paraver', nombre: 'Para ver' },
  { id: 'viendo', nombre: 'Viendo', soloTv: true },
  { id: 'vista', nombre: 'Vista' },
  { id: 'abandonada', nombre: 'Abandonada' },
  { id: 'volver', nombre: 'Volver a ver' },
];
export const nombreEstado = (id) => ESTADOS.find(e => e.id === id)?.nombre || '';
const pad = (n) => String(n).padStart(2, '0');
export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fechaLinda = (iso, conAnio = false) => { if (!iso) return ''; const [a, m, d] = iso.split('-').map(Number); const f = new Date(a, m - 1, d); return f.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', ...(conAnio || a !== new Date().getFullYear() ? { year: 'numeric' } : {}) }).replace(/\./g, ''); };
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const claveEp = (t, e) => `${t}-${e}`;

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
  return m.col.carpetas.crear({ nombre: 'Filmoteca', icono: '🎬', color: '#6B4E9B', padreId: '', sistema: 'filmoteca', orden: 0, base: false, campos: [], vistas: [] });
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

// Agregar desde un resultado de TMDB (o a mano).
export async function agregar(ctx, m, d, r, estado, { recomendada = '', nota = '', fecha = '', calificacion = 0 } = {}) {
  const { clave, avisarPorDefecto } = config(d);
  let fijo = { tmdb: r.tmdb || 0, tipo: r.tipo, titulo: r.titulo, original: r.original || r.titulo, anio: r.anio || '', poster: r.poster || '', fondo: '', generos: [], duracion: 0, resumen: r.resumen || '' };
  let v = null;
  if (r.tmdb && clave) {
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
    promedio: califs.length ? (califs.reduce((a, b) => a + b, 0) / califs.length) : 0,
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
  if (marca) caja.append(h('span', { class: 'fm-marca' }, '✓'));
  if (prog !== null) caja.append(h('span', { class: 'fm-prog' }, h('span', { style: `width:${prog}%` })));
  return caja;
}

const corazonesTexto = (ctx, n) => ctx.h('span', { class: 'fm-corazones', title: `${n}/10` }, '♥'.repeat(n), ctx.h('span', { class: 'fm-cor-off' }, '♥'.repeat(10 - n)));

function tarjeta(ctx, d, n, { sub = '', rec = false, cor = false, prog = null, marca = false } = {}) {
  const { h } = ctx;
  const c = n.cine;
  return h('a', { href: `#/bitacora/n/${n.id}`, class: 'fm-item', title: c.titulo },
    poster(ctx, c, { prog, marca }),
    h('span', { class: 'fm-it' }, c.titulo),
    sub ? h('span', { class: 'fm-is' }, sub) : null,
    rec && c.recomendada ? h('span', { class: 'fm-rec' }, `Recomendada por ${c.recomendada}`) : null,
    cor && c.calificacion ? corazonesTexto(ctx, c.calificacion) : null);
}

const subtituloViendo = (d, c) => {
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

// ── Portada ──
let filtroTipo = '';
export function pantallaFilmoteca(ctx, m, d, main) {
  const { h } = ctx;
  const todos = items(d).filter(n => !filtroTipo || n.cine.tipo === filtroTipo);
  const cuenta = (e) => todos.filter(n => n.cine.estado === e).length;
  const hoy = hoyISO();
  const fila = (titulo, lista, opciones, link) => (lista.length ? [
    h('div', { class: 'fm-fila-t' }, h('h2', {}, titulo), link ? h('a', { href: link.href }, link.texto) : null),
    h('div', { class: 'fm-carrusel' }, lista.map(n => tarjeta(ctx, d, n, opciones(n)))),
  ] : []);
  const viendo = listaViendo(d, filtroTipo);
  const paraver = todos.filter(n => n.cine.estado === 'paraver').sort((a, b) => (b.cine.agregada || 0) - (a.cine.agregada || 0));
  const proximos = todos.filter(n => n.cine.estado !== 'abandonada').map(n => {
    const v = vivo(d, n.cine);
    const f = n.cine.tipo === 'tv' ? v?.proximo?.fecha : (n.cine.estado !== 'vista' ? v?.estreno : '');
    return f && f >= hoy ? { n, f, v } : null;
  }).filter(Boolean).sort((a, b) => a.f.localeCompare(b.f));
  const vistas = todos.filter(n => ['vista', 'volver'].includes(n.cine.estado) && ultimaVista(n.cine)).sort((a, b) => ultimaVista(b.cine).localeCompare(ultimaVista(a.cine)));
  const st = estadisticas(d, new Date().getFullYear());
  const cfg = config(d);

  poner(main, 
    cabecera(ctx, { titulo: 'Filmoteca', marca: h('span', { class: 'bt-emoji' }, '🎬'), volver: { href: '#/bitacora', texto: 'Bitácora' },
      botones: [h('a', { href: '#/bitacora/f/stats', class: 'boton' }, '📊 ', h('span', { class: 'fm-oc-cel' }, 'Estadísticas')), h('a', { href: '#/bitacora/f/agregar', class: 'boton principal' }, ic('mas'), 'Agregar')] }),
    !cfg.clave ? h('div', { class: 'fm-aviso' }, 'Para buscar películas y series (con pósters, episodios y plataformas) falta cargar la clave de TMDB. ', h('a', { href: '#/bitacora/ajustes' }, 'Cargarla ›')) : null,
    h('a', { href: '#/bitacora/f/agregar', class: 'bt-busca' }, ic('buscar'), h('span', {}, 'Buscar película o serie para agregar…')),
    h('div', { class: 'fm-chips' },
      [['', 'Todo'], ['movie', 'Películas'], ['tv', 'Series']].map(([v, t]) => h('button', { type: 'button', class: `fm-chip${filtroTipo === v ? ' sel' : ''}`, onclick: () => { filtroTipo = v; pantallaFilmoteca(ctx, m, d, main); } }, t)),
      h('span', { class: 'fm-chips-sep' }),
      ESTADOS.map(e => h('a', { href: `#/bitacora/f/l/${e.id}`, class: 'fm-chip' }, e.nombre, h('small', {}, String(cuenta(e.id)))))),
    ...fila('Seguir viendo', viendo, (n) => ({ sub: subtituloViendo(d, n.cine), prog: progreso(n.cine, vivo(d, n.cine)).pct }), viendo.length > 6 ? { href: '#/bitacora/f/l/viendo', texto: 'Ver todo ›' } : null),
    ...fila('Para ver', paraver.slice(0, 15), (n) => ({ sub: [n.cine.anio, n.cine.tipo === 'tv' ? 'Serie' : 'Película'].filter(Boolean).join(' · '), rec: true }), { href: '#/bitacora/f/l/paraver', texto: `Ver ${paraver.length > 15 ? `las ${paraver.length}` : 'todo'} ›` }),
    ...fila('Próximos estrenos y episodios', proximos.slice(0, 15).map(x => x.n), (n) => { const x = proximos.find(y => y.n === n); return { sub: n.cine.tipo === 'tv' ? `T${x.v.proximo.t} E${x.v.proximo.e} · ${fechaLinda(x.f)}` : `Estreno · ${fechaLinda(x.f)}` }; }),
    ...fila('Vistas hace poco', vistas.slice(0, 15), (n) => ({ sub: fechaLinda(ultimaVista(n.cine)), cor: true, marca: true }), { href: '#/bitacora/f/l/vista', texto: 'Historial ›' }),
    !todos.length ? vacio(ctx, 'Todavía no agregaste nada', 'Buscá una película o serie con "Agregar" y elegí si la querés ver, la estás viendo o ya la viste.') : null,
    h('div', { class: 'fm-stats' },
      h('div', { class: 'fm-stat' }, h('b', {}, `${st.horas} h`), h('span', {}, `vistas en ${new Date().getFullYear()}`)),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.pelis)), h('span', {}, 'películas')),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.eps)), h('span', {}, 'episodios')),
      h('div', { class: 'fm-stat' }, h('b', {}, st.promedio ? st.promedio.toFixed(1).replace('.', ',') : '—'), h('span', {}, 'tu calificación promedio'))),
    h('p', { class: 'fm-tmdb' }, 'Datos e imágenes: TMDB. Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.'),
  );
}

// ── Lista completa ──
const filtrosLista = { tipo: '', orden: 'agregada', rec: '', plat: '' };
export function pantallaLista(ctx, m, d, estado, main) {
  const { h } = ctx;
  const f = filtrosLista;
  const base = items(d).filter(n => n.cine.estado === estado);
  const recs = [...new Set(base.map(n => n.cine.recomendada).filter(Boolean))].sort();
  const plats = [...new Set(base.flatMap(n => vivo(d, n.cine)?.plataformas || []))].sort();
  let l = base.filter(n => (!f.tipo || n.cine.tipo === f.tipo) && (!f.rec || n.cine.recomendada === f.rec) && (!f.plat || (vivo(d, n.cine)?.plataformas || []).includes(f.plat)));
  const ord = {
    agregada: (a, b) => (b.cine.agregada || 0) - (a.cine.agregada || 0),
    titulo: (a, b) => sinTildes(a.cine.titulo).localeCompare(sinTildes(b.cine.titulo)),
    anio: (a, b) => String(b.cine.anio).localeCompare(String(a.cine.anio)),
    calificacion: (a, b) => (b.cine.calificacion || 0) - (a.cine.calificacion || 0),
    ultima: (a, b) => ultimaVista(b.cine).localeCompare(ultimaVista(a.cine)),
  };
  l = l.sort(ord[f.orden] || ord.agregada);
  const sel = (clave, opciones, etiqueta) => h('select', { class: 'fm-sel', 'aria-label': etiqueta, onchange: (e) => { f[clave] = e.target.value; pantallaLista(ctx, m, d, estado, main); } },
    opciones.map(([v, t]) => h('option', { value: v, selected: f[clave] === v }, t)));
  poner(main, 
    cabecera(ctx, { titulo: nombreEstado(estado), volver: { href: '#/bitacora/f', texto: 'Filmoteca' }, botones: [h('a', { href: '#/bitacora/f/agregar', class: 'boton principal' }, ic('mas'), 'Agregar')] }),
    h('div', { class: 'fm-chips' },
      [['', 'Todo'], ['movie', 'Películas'], ['tv', 'Series']].map(([v, t]) => h('button', { type: 'button', class: `fm-chip${f.tipo === v ? ' sel' : ''}`, onclick: () => { f.tipo = v; pantallaLista(ctx, m, d, estado, main); } }, t)),
      h('span', { class: 'fm-chips-sep' }),
      sel('orden', [['agregada', '⇅ Agregadas'], ['titulo', '⇅ Título'], ['anio', '⇅ Año'], ['calificacion', '⇅ Calificación'], ['ultima', '⇅ Última vez vista']], 'Orden'),
      recs.length ? sel('rec', [['', 'Recomendada por: todos'], ...recs.map(r => [r, r])], 'Recomendada por') : null,
      plats.length ? sel('plat', [['', 'Plataforma: todas'], ...plats.map(p => [p, p])], 'Plataforma') : null),
    l.length ? h('div', { class: 'fm-grilla' }, l.map(n => tarjeta(ctx, d, n, {
      sub: estado === 'viendo' ? subtituloViendo(d, n.cine) : estado === 'vista' || estado === 'volver' ? fechaLinda(ultimaVista(n.cine)) : [n.cine.anio, n.cine.tipo === 'tv' ? 'Serie' : 'Película'].filter(Boolean).join(' · '),
      rec: estado === 'paraver', cor: estado === 'vista' || estado === 'volver', prog: estado === 'viendo' ? progreso(n.cine, vivo(d, n.cine)).pct : null,
    }))) : vacio(ctx, 'No hay nada acá', null));
}

// ── Agregar ──
let ultimaBusqueda = '';
export function pantallaAgregar(ctx, m, d, main) {
  const { h } = ctx;
  const cfg = config(d);
  const input = h('input', { type: 'search', class: 'bt-busca-input', placeholder: 'Nombre de la película o serie', value: ultimaBusqueda, autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Buscar' });
  const res = h('div', {});
  let espera = null, turno = 0;
  const existente = (r) => items(d).find(n => n.cine.tmdb === r.tmdb && n.cine.tipo === r.tipo);
  async function buscarYa() {
    ultimaBusqueda = input.value;
    const q = input.value.trim();
    const mio = ++turno;
    if (!q) { poner(res, h('p', { class: 'nota' }, cfg.clave ? 'Escribí el nombre. Los datos vienen de TMDB (la misma base que usa Trakt).' : 'Sin la clave de TMDB solo podés cargar a mano.')); return; }
    if (!cfg.clave) return;
    poner(res, h('p', { class: 'cargando' }, 'Buscando…'));
    try {
      const lista = await tmdb.buscar(cfg.clave, q);
      if (mio !== turno) return;
      poner(res, lista.length ? h('section', { class: 'tarjeta fm-res-lista' }, lista.slice(0, 20).map(r => {
        const ya = existente(r);
        return h('div', { class: 'fm-res' },
          poster(ctx, r, { tam: 'w154', clase: 'chico' }),
          h('div', { class: 'fm-res-t' }, h('b', {}, r.titulo), h('small', {}, [r.tipo === 'tv' ? 'Serie' : 'Película', r.anio, r.original && r.original !== r.titulo ? r.original : ''].filter(Boolean).join(' · ')),
            r.resumen ? h('span', { class: 'fm-res-sin' }, r.resumen.slice(0, 140) + (r.resumen.length > 140 ? '…' : '')) : null),
          h('div', { class: 'fm-res-b' }, ya
            ? [h('span', { class: 'fm-ya' }, `En ${nombreEstado(ya.cine.estado)}`), h('a', { href: `#/bitacora/n/${ya.id}`, class: 'boton bt-chico' }, 'Abrir')]
            : [
              h('button', { type: 'button', class: 'boton bt-chico', onclick: () => dialogoParaVer(ctx, m, d, r) }, '＋ Para ver'),
              r.tipo === 'tv' ? h('button', { type: 'button', class: 'boton bt-chico', onclick: async () => { const id = await agregar(ctx, m, d, r, 'viendo'); avisoAgregada(ctx, id, 'Viendo'); } }, '▶ Viendo') : null,
              h('button', { type: 'button', class: 'boton bt-chico', onclick: () => dialogoLaVi(ctx, { titulo: 'Ya la vi', alGuardar: async (fecha, cal) => { const id = await agregar(ctx, m, d, r, 'vista', { fecha, calificacion: cal }); avisoAgregada(ctx, id, 'Vistas'); } }) }, '✓ Ya la vi'),
            ]));
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

function avisoAgregada(ctx, id, lista) {
  ctx.aviso(`Agregada a ${lista}`, { accion: 'Abrir', alTocar: () => ctx.navegar(`bitacora/n/${id}`) });
}

function recomendadores(d) { return [...new Set(items(d).map(n => n.cine.recomendada).filter(Boolean))].sort(); }

function dialogoParaVer(ctx, m, d, r) {
  const { h } = ctx;
  const lista = h('datalist', { id: 'fm-recs' }, recomendadores(d).map(x => h('option', { value: x })));
  const rec = h('input', { type: 'text', list: 'fm-recs', placeholder: 'Ej: Juan (trabajo)', 'aria-label': 'Recomendada por' });
  const nota = h('textarea', { rows: 3, placeholder: 'Ej: dice que el capítulo 3 es tremendo', 'aria-label': 'Nota' });
  const dlg = ventana(ctx, `Para ver: ${r.titulo}`, h('div', { class: 'formulario-campos' },
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Recomendada por (opcional)'), rec, lista),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Nota (opcional)'), nota)), {
    botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { type: 'button', class: 'boton principal', onclick: async () => { dlg.close(); const id = await agregar(ctx, m, d, r, 'paraver', { recomendada: rec.value.trim(), nota: nota.value.trim() }); avisoAgregada(ctx, id, 'Para ver'); } }, 'Agregar')],
  });
  setTimeout(() => rec.focus(), 50);
}

export function controlCorazones(ctx, valor, alCambiar) {
  const { h } = ctx;
  let v = Number(valor) || 0;
  const caja = h('span', { class: 'fm-hearts', role: 'radiogroup', 'aria-label': 'Calificación' });
  const pintar = () => poner(caja, ...Array.from({ length: 10 }, (_, i) => h('button', { type: 'button', class: i < v ? 'on' : '', 'aria-label': `${i + 1} de 10`, onclick: () => { v = v === i + 1 ? 0 : i + 1; pintar(); alCambiar(v); } }, '♥')),
    h('span', { class: 'fm-hearts-n' }, v ? `${v}/10` : 'Sin calificar'));
  pintar();
  return caja;
}

export function dialogoLaVi(ctx, { titulo = 'La vi', calificacion = 0, alGuardar }) {
  const { h } = ctx;
  const fecha = h('input', { type: 'date', value: hoyISO(), max: hoyISO(), 'aria-label': 'Cuándo' });
  let cal = calificacion;
  const dlg = ventana(ctx, titulo, h('div', { class: 'formulario-campos' },
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Cuándo'), fecha),
    h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Calificación'), controlCorazones(ctx, cal, (v) => { cal = v; }))), {
    botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { type: 'button', class: 'boton principal', onclick: async () => { dlg.close(); await alGuardar(fecha.value || hoyISO(), cal); } }, 'Guardar')],
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
      { id: 'recomendada', etiqueta: 'Recomendada por (opcional)', tipo: 'texto' },
    ],
  }).then(async (r) => {
    if (!r) return;
    const estado = r.tipo === 'movie' && r.estado === 'viendo' ? 'paraver' : r.estado;
    const id = await agregar(ctx, m, d, { tipo: r.tipo, titulo: r.titulo, anio: r.anio }, estado, { recomendada: r.recomendada });
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
    cabecera(ctx, { titulo: 'Estadísticas', volver: { href: '#/bitacora/f', texto: 'Filmoteca' } }),
    h('div', { class: 'bt-seg fm-anios' }, [...anios.map(a => [Number(a), a]), [0, 'Todo']].map(([v, t]) => h('button', { type: 'button', class: anioStats === v ? 'sel' : '', onclick: () => { anioStats = v; pantallaStats(ctx, m, d, main); } }, t))),
    h('div', { class: 'fm-stats' },
      h('div', { class: 'fm-stat' }, h('b', {}, `${st.horas} h`), h('span', {}, 'vistas')),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.pelis)), h('span', {}, 'películas')),
      h('div', { class: 'fm-stat' }, h('b', {}, String(st.eps)), h('span', {}, `episodios · ${st.series} serie${st.series === 1 ? '' : 's'}`)),
      h('div', { class: 'fm-stat' }, h('b', {}, st.promedio ? st.promedio.toFixed(1).replace('.', ',') : '—'), h('span', {}, 'calificación promedio'))),
    anioStats ? h('section', { class: 'tarjeta' }, h('h2', {}, 'Por mes'), h('div', { class: 'fm-meses' }, st.meses.map((v, i) => h('div', { title: `${v}` }, h('small', {}, v ? String(v) : ''), h('i', { style: `height:${Math.round(v * 100 / max)}%` }), 'EFMAMJJASOND'[i])))) : null,
    h('section', { class: 'tarjeta' }, h('h2', {}, 'Géneros que más viste'), barras(st.generos)),
    h('section', { class: 'tarjeta' }, h('h2', {}, 'Plataformas'), barras(st.plataformas), h('p', { class: 'nota' }, 'Según en qué plataforma está cada título en Argentina.')),
  );
}

// ── Ficha (va arriba de la nota) ──
export function encabezadoCine(ctx, m, d, n) {
  const { h } = ctx;
  const el = h('div', { class: 'fm-ficha' });
  const abiertas = new Map();      // temporada → abierta
  const episodios = new Map();     // temporada → lista de TMDB
  let refrescando = false;

  function pintar() {
    const c = n.cine;
    const v = vivo(d, c);
    const esTv = c.tipo === 'tv';
    const hoy = hoyISO();
    const fondo = c.fondo ? `linear-gradient(90deg, rgb(10 14 16 / .92) 0%, rgb(10 14 16 / .7) 55%, rgb(10 14 16 / .35)), url("${tmdb.imagen(c.fondo, 'w780')}")` : '';
    const meta = esTv
      ? [c.anio, v?.temporadas?.length ? `${v.temporadas.length} temporada${v.temporadas.length === 1 ? '' : 's'}` : '', v ? `${emitidos(v).length} episodios` : '', c.duracion ? `~${c.duracion} min` : '', v?.terminada ? 'Terminada' : v?.estado === 'Returning Series' ? 'En emisión' : '']
      : [c.anio, c.duracion ? `${Math.floor(c.duracion / 60)} h ${c.duracion % 60} min` : ''];
    const prog = esTv ? progreso(c, v) : null;
    const estreno = !esTv && v?.estreno && v.estreno > hoy ? v.estreno : '';

    const filas = [];
    filas.push(['Dónde verla', v?.plataformas?.length ? h('span', {}, h('span', { class: 'fm-plat' }, v.plataformas.map(p => h('span', {}, p))), h('span', { class: 'fm-nota' }, ' en Argentina')) : h('span', { class: 'fm-nota' }, v ? 'No está en plataformas de Argentina' : c.tmdb ? 'Se ve al tener conexión' : '—')]);
    filas.push(['Tu calificación', controlCorazones(ctx, c.calificacion, (x) => guardarCine(m, n, { calificacion: x }))]);
    const rec = h('input', { type: 'text', value: c.recomendada || '', list: 'fm-recs-ficha', placeholder: '—', 'aria-label': 'Recomendada por' });
    rec.addEventListener('change', () => guardarCine(m, n, { recomendada: rec.value.trim() }));
    filas.push(['Recomendada por', h('span', {}, rec, h('datalist', { id: 'fm-recs-ficha' }, recomendadores(d).map(x => h('option', { value: x }))))]);
    if (estreno) filas.push(['Estreno', h('span', {}, fechaLinda(estreno, true))]);
    if (esTv && v?.proximo?.fecha) filas.push(['Próximo episodio', h('span', {}, `T${v.proximo.t} E${v.proximo.e} · ${fechaLinda(v.proximo.fecha, true)}`)]);
    if (c.tmdb && (esTv ? !v?.terminada : (estreno || c.estado !== 'vista'))) {
      filas.push([esTv ? 'Avisarme episodios nuevos' : 'Avisarme el estreno', h('span', { class: 'fm-sw-fila' },
        h('button', { type: 'button', class: `aj-switch${c.avisar ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!c.avisar), 'aria-label': 'Avisarme', onclick: () => guardarCine(m, n, { avisar: !c.avisar }) }),
        h('span', { class: 'fm-nota' }, 'llega como tarea a Tareas › Sistemas'))]);
    }

    const historial = (c.vistas || []).slice().sort().reverse();
    poner(el, 
      h('div', { class: 'fm-hero', style: fondo ? `background-image:${fondo}` : null },
        poster(ctx, c, { tam: 'w342' }),
        h('div', { class: 'fm-hero-t' },
          h('h1', {}, c.titulo),
          h('div', { class: 'fm-meta' }, meta.filter(Boolean).join(' · ')),
          c.generos?.length ? h('div', { class: 'fm-gen' }, c.generos.map(g => h('span', {}, g))) : null)),
      h('div', { class: 'fm-orig' }, h('b', {}, 'Título original'), c.original || c.titulo),
      c.resumen ? h('p', { class: 'fm-sinopsis' }, c.resumen) : null,
      h('div', { class: 'fm-acciones' },
        h('div', { class: 'fm-estado', role: 'radiogroup', 'aria-label': 'Lista' }, ESTADOS.filter(e => esTv || !e.soloTv).map(e => h('button', {
          type: 'button', class: c.estado === e.id ? 'sel' : '', 'aria-pressed': String(c.estado === e.id),
          onclick: () => cambiarEstado(e.id),
        }, e.nombre))),
        !esTv ? h('button', { type: 'button', class: 'boton', onclick: () => dialogoLaVi(ctx, { titulo: historial.length ? 'La vi otra vez' : 'La vi', calificacion: c.calificacion, alGuardar: async (f, cal) => guardarCine(m, n, { vistas: [...(c.vistas || []), f], calificacion: cal || c.calificacion, estado: c.estado === 'volver' || c.estado === 'paraver' || c.estado === 'abandonada' ? 'vista' : c.estado }) }) }, '👁 ', historial.length ? 'La vi otra vez' : 'La vi') : null),
      h('section', { class: 'tarjeta fm-props' }, h('dl', {}, filas.map(([k, val]) => [h('dt', {}, k), h('dd', {}, val)]))),
      historial.length ? h('section', { class: 'tarjeta fm-hist' }, h('h3', { class: 'bt-sec-h' }, historial.length > 1 ? `La viste ${historial.length} veces` : 'La viste'),
        historial.map((f, i) => h('div', {}, h('span', {}, fechaLinda(f, true)), h('span', { class: 'fm-nota' }, i === historial.length - 1 ? 'primera vez' : ''),
          h('button', { type: 'button', class: 'boton-icono bt-chico', 'aria-label': 'Quitar esta fecha', onclick: async () => { const l = [...(c.vistas || [])]; l.splice(l.lastIndexOf(f), 1); await guardarCine(m, n, { vistas: l }); } }, ctx.icono('cerrar'))))) : null,
      esTv ? zonaEpisodios(c, v, prog) : null,
    );
  }

  async function cambiarEstado(estado) {
    const c = n.cine;
    const cambios = { estado };
    if (estado === 'vista' && c.tipo === 'movie' && !(c.vistas || []).length) {
      dialogoLaVi(ctx, { calificacion: c.calificacion, alGuardar: (f, cal) => guardarCine(m, n, { estado, vistas: [f], calificacion: cal || c.calificacion }) });
      return;
    }
    if (estado === 'vista' && c.tipo === 'tv') {
      const v = vivo(d, c);
      const vistos = { ...(c.vistos || {}) };
      const pend = emitidos(v).filter(x => !vistos[claveEp(x.t, x.e)]);
      if (pend.length && await ctx.confirmar(`¿Marco los ${pend.length} episodios que faltan como vistos hoy?`, { si: 'Sí, marcarlos', no: 'No, solo cambiar la lista' })) {
        for (const x of pend) vistos[claveEp(x.t, x.e)] = hoyISO();
        cambios.vistos = vistos;
      }
      cambios.vistas = [...(c.vistas || []), hoyISO()];
    }
    await guardarCine(m, n, cambios);
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
        cambios.vistas = [...(c.vistas || []), hoy];
        ctx.aviso('¡Terminaste la serie! Quedó en Vistas.');
      }
      await guardarCine(m, n, cambios);
    };
    const todos = emitidos(v);
    const proxima = prog.proximo;
    const secciones = v.temporadas.map(t => {
      const em = v.emitidos?.[t.n] ?? t.eps;
      const vistosT = Array.from({ length: em }, (_, i) => c.vistos?.[claveEp(t.n, i + 1)]).filter(Boolean).length;
      const abierta = abiertas.has(t.n) ? abiertas.get(t.n) : (proxima ? proxima.t === t.n : t.n === v.temporadas[v.temporadas.length - 1].n);
      const det = h('details', { class: 'fm-temp', open: abierta });
      det.addEventListener('toggle', () => { abiertas.set(t.n, det.open); if (det.open && !episodios.has(t.n)) cargarTemporada(t.n); });
      const lista = episodios.get(t.n);
      const eps = Array.from({ length: Math.max(t.eps, lista?.length || 0) }, (_, i) => {
        const e = i + 1, info = lista?.find(x => x.e === e);
        const visto = c.vistos?.[claveEp(t.n, e)];
        const salio = e <= em || (info?.fecha && info.fecha <= hoy);
        const esProx = proxima && proxima.t === t.n && proxima.e === e;
        return h('div', { class: `fm-ep${esProx ? ' prox' : ''}${salio ? '' : ' futuro'}` },
          h('input', { type: 'checkbox', checked: !!visto, disabled: !salio, 'aria-label': `T${t.n} E${e}`, onchange: (ev) => marcar([{ t: t.n, e }], ev.target.checked ? hoy : null) }),
          h('div', { class: 'fm-ep-n' }, `E${e}${info?.nombre && !/^Episodio \d+$/i.test(info.nombre) ? ` · ${info.nombre}` : ''}`,
            visto ? h('button', { type: 'button', class: 'fm-ep-f', title: 'Cambiar la fecha', onclick: () => cambiarFecha(t.n, e, visto) }, `visto el ${fechaLinda(visto)}`)
              : h('small', {}, esProx ? 'próximo para ver' : info?.fecha ? (salio ? fechaLinda(info.fecha, true) : `sale el ${fechaLinda(info.fecha, true)}`) : (salio ? '' : 'todavía no salió'))),
          salio && !visto ? h('button', { type: 'button', class: 'fm-hasta', onclick: () => marcar(todos.filter(x => x.t < t.n || (x.t === t.n && x.e <= e)), hoy) }, 'Hasta acá') : null);
      });
      det.append(
        h('summary', {}, h('span', { class: 'fm-temp-n' }, t.nombre || `Temporada ${t.n}`),
          em ? h('span', { class: 'fm-temp-bar' }, h('span', { style: `width:${Math.round(vistosT * 100 / em)}%` })) : null,
          h('span', { class: 'fm-nota fm-temp-c' }, em ? `${vistosT} / ${em}` : t.fecha ? `sale ${fechaLinda(t.fecha, true)}` : 'próximamente'),
          h('span', { class: 'bt-espacio' }),
          em && vistosT < em ? h('button', { type: 'button', class: 'boton bt-chico', onclick: (ev) => { ev.preventDefault(); marcar(Array.from({ length: em }, (_, i) => ({ t: t.n, e: i + 1 })), hoy); } }, 'Temporada completa') : null),
        h('div', { class: 'fm-eps' }, eps));
      if (abierta && !episodios.has(t.n)) cargarTemporada(t.n);
      return det;
    });
    return h('section', { class: 'fm-episodios' },
      h('div', { class: 'fm-fila-t' }, h('h2', {}, 'Episodios'), h('span', { class: 'fm-nota' }, prog.total ? `${prog.vistos} de ${prog.total} vistos${proxima ? ` · próximo T${proxima.t} E${proxima.e}` : ' · al día'}` : '')),
      secciones);
  }

  function cambiarFecha(t, e, actual) {
    const { h: hh } = ctx;
    const f = hh('input', { type: 'date', value: actual, max: hoyISO(), 'aria-label': 'Fecha' });
    const dlg = ventana(ctx, `T${t} E${e}: ¿cuándo lo viste?`, f, {
      botones: [
        hh('button', { type: 'button', class: 'boton peligro', onclick: async () => { dlg.close(); const vistos = { ...n.cine.vistos }; delete vistos[claveEp(t, e)]; await guardarCine(m, n, { vistos }); } }, 'Desmarcar'),
        hh('span', { class: 'bt-espacio' }),
        hh('button', { type: 'button', class: 'boton principal', onclick: async () => { dlg.close(); if (f.value) await guardarCine(m, n, { vistos: { ...n.cine.vistos, [claveEp(t, e)]: f.value } }); } }, 'Guardar')],
    });
  }

  async function cargarTemporada(t) {
    const { clave } = config(d);
    if (!clave || !navigator.onLine) return;
    episodios.set(t, null);
    try { episodios.set(t, await tmdb.temporada(clave, n.cine.tmdb, t)); pintar(); } catch { episodios.delete(t); }
  }

  async function actualizarDesdeTMDB() {
    if (refrescando) return;
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
      if (!el.contains(document.activeElement) || document.activeElement?.type === 'checkbox' || document.activeElement?.tagName === 'BUTTON') pintar();
    },
  };
}

export { haceCuanto };
