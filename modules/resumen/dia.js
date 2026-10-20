// ─────────────────────────────────────────────────────────────
// Resumen del día: el tiempo, lo de hoy (tareas, vencimientos, hábitos),
// cumpleaños y noticias de tus temas.
//   - Lo de hoy se pide a Tareas y Hábitos (ctx.pedir), no se guarda.
//   - El tiempo viene de Open-Meteo (gratis, sin clave).
//   - Las noticias: titulares de Google Noticias una vez por día; Gemini (clave
//     de Bitácora, acción 'gemini-preguntar') los explica. Quedan guardadas en
//     la revisión del día.
//   - Aprende: abrir una noticia sube su tema; "No me interesa" lo baja.
// Ajustes (colección "ajustes", uno solo): { nombre, hora, lugar, intereses, sugeridos, descartados }
// ─────────────────────────────────────────────────────────────

import { pedirSeguro, hoyISO, deISO, DIAS, MESES } from './datos.js';

const INTERESES = ['Economía mundial', 'Economía argentina', 'Tecnología', 'Guerras y política internacional', 'Política argentina'];
const base = () => ({ nombre: 'Matías', hora: '05:00', lugar: { tipo: 'gps' }, intereses: INTERESES.map(nombre => ({ nombre, peso: 0 })), sugeridos: [], descartados: [] });
const poner = (el, ...hijos) => el.replaceChildren(...hijos.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));
const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// ── Ajustes ──
export async function leerAjustes(ctx) {
  const r = (await ctx.datos('ajustes').listar()).sort((a, b) => (b.modificado || 0) - (a.modificado || 0))[0];
  return { ...base(), ...(r || {}) };
}
export async function guardarAjustes(ctx, cambios) {
  const col = ctx.datos('ajustes');
  const r = (await col.listar()).sort((a, b) => (b.modificado || 0) - (a.modificado || 0))[0];
  if (r) await col.actualizar(r.id, cambios);
  else await col.crear({ ...base(), ...cambios });
}
// Abrir una noticia suma; "No me interesa" resta. El peso ordena lo que se le pide a Gemini.
async function sumarPeso(ctx, tema, n) {
  const aj = await leerAjustes(ctx);
  const intereses = aj.intereses.map(i => (igual(i.nombre, tema) ? { ...i, peso: Math.max(-5, Math.min(10, (i.peso || 0) + n)) } : i));
  await guardarAjustes(ctx, { intereses });
}

// ── Tiempo ──
const CLIMA = [[0, '☀️', 'Despejado'], [1, '🌤️', 'Mayormente despejado'], [2, '⛅', 'Parcial nublado'], [3, '☁️', 'Nublado'], [45, '🌫️', 'Niebla'],
  [51, '🌦️', 'Llovizna'], [61, '🌧️', 'Lluvia débil'], [63, '🌧️', 'Lluvia'], [65, '🌧️', 'Lluvia fuerte'], [71, '🌨️', 'Nieve'], [80, '🌦️', 'Chaparrones'], [95, '⛈️', 'Tormenta']];
export const textoClima = (codigo) => [...CLIMA].reverse().find(([c]) => codigo >= c) || CLIMA[0];

// Si el permiso de ubicación todavía no se pidió, el Inicio no lo pide: lo pide la pantalla "Hoy".
async function puedeUbicar() {
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; } catch { return false; }
}
function ubicacion() {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) { mal(new Error('Este dispositivo no da la ubicación. Elegí una ciudad en Configurar.')); return; }
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, nombre: 'Ubicación actual' }),
      () => mal(new Error('No pude usar tu ubicación. Permitila o elegí una ciudad en Configurar.')),
      { timeout: 10000, maximumAge: 3 * 3600e3 });
  });
}
let climaGuardado = null;   // { clave, t, dato }: no lo pido de nuevo en media hora
export async function clima(aj, { pedirPermiso = false } = {}) {
  const l = aj.lugar || { tipo: 'gps' };
  const clave = JSON.stringify(l) + hoyISO();
  if (climaGuardado?.clave === clave && Date.now() - climaGuardado.t < 30 * 60e3) return climaGuardado.dato;
  let c;
  if (l.tipo === 'ciudad' && l.lat !== undefined) c = l;
  else if (pedirPermiso || await puedeUbicar()) c = await ubicacion();
  else return null;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`)
    .catch(() => { throw new Error('Sin conexión para ver el tiempo.'); });
  if (!r.ok) throw new Error('No se pudo ver el tiempo ahora.');
  const j = await r.json();
  const dato = {
    temp: Math.round(j.current.temperature_2m), codigo: j.current.weather_code, lugar: c.nombre,
    max: Math.round(j.daily.temperature_2m_max[0]), min: Math.round(j.daily.temperature_2m_min[0]), lluvia: j.daily.precipitation_probability_max?.[0] ?? null,
    horas: [9, 15, 21].map(hh => ({ hora: hh, temp: Math.round(j.hourly.temperature_2m[hh]) })),
  };
  climaGuardado = { clave, t: Date.now(), dato };
  return dato;
}
export async function buscarCiudades(texto) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(texto)}&count=6&language=es`);
  if (!r.ok) throw new Error('No se pudo buscar la ciudad.');
  return ((await r.json()).results || []).map(x => ({ tipo: 'ciudad', nombre: [x.name, x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude }));
}

// ── Lo de hoy ──
export async function loDeHoy(ctx) {
  const hoy = hoyISO();
  const [items, hab, cumples] = await Promise.all([
    pedirSeguro(ctx, 'calendario-items', { desde: hoy, hasta: hoy, repetidas: true }, []),
    pedirSeguro(ctx, 'resumen-habitos', { periodos: [{ desde: hoy, hasta: hoy }] }, null),
    pedirSeguro(ctx, 'cumpleanos', { desde: hoy, hasta: hoy }, null),   // todavía no existe: se va a cargar en Tareas
  ]);
  const l = items || [];
  const habitos = (hab?.[0]?.porHabito || []).filter(x => x.dias && x.dias[0] !== '-');
  return {
    tareas: l.filter(x => ['tarea', 'venc', 'ev', 'reu'].includes(x.tipo)),
    vence: l.filter(x => x.tipo === 'fin'),
    feriados: l.filter(x => x.tipo === 'fer'),
    habitos: { total: habitos.length, hechos: habitos.filter(x => x.dias[0] === 's').length },
    cumples,
  };
}
export const abrirCumpleanos = async (ctx) => {
  if (await ctx.existeAccion('abrir-cumpleanos')) return ctx.pedir('abrir-cumpleanos', {});
  ctx.navegar('tareas');
};

// ── Noticias ──
// Los titulares vienen de Google Noticias (edición Argentina), uno o dos por tema.
// La clave gratis de Gemini no puede buscar en Google, así que Gemini solo
// explica cada titular (resumen y detalle), sin buscar. Si Gemini falla,
// igual se ven los titulares con su enlace.
const fechaLarga = (iso) => { const f = deISO(iso); return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`; };
// "Guerras y política internacional" → (guerras OR "política internacional"): con "y" Google exige todas las palabras.
const consulta = (tema) => { const p = String(tema).split(/\s+y\s+|,/).map(x => x.trim()).filter(Boolean).map(x => (/\s/.test(x) ? `"${x}"` : x)); return p.length > 1 ? `(${p.join(' OR ')})` : p[0]; };
const rssDe = (tema) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${consulta(tema)} when:1d`)}&hl=es-419&gl=AR&ceid=AR:es-419`;
const sinHTML = (t) => String(t || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
// "Titular - Medio" → { titulo, fuente }
const separar = (t) => { const k = String(t).lastIndexOf(' - '); return k > 0 ? { titulo: t.slice(0, k).trim(), fuente: t.slice(k + 3).trim() } : { titulo: String(t).trim(), fuente: '' }; };

// Google Noticias no deja leerse directo desde el navegador: se pasa por un servicio
// gratis que lo permite (si uno no responde, el otro). allorigins trae la lista
// completa (~100); rss2json solo 10, por eso va segundo.
async function leerRSS(url) {
  try {
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (r.ok) {
      const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
      const l = [...xml.querySelectorAll('item')].map(it => {
        const val = (n) => it.querySelector(n)?.textContent || '';
        return { ...separar(val('title')), url: val('link'), fecha: val('pubDate'), desc: sinHTML(val('description')) };
      });
      if (l.length) return l;
    }
  } catch { /* probamos el otro */ }
  const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
  const j = r.ok ? await r.json() : null;
  if (j?.status !== 'ok') throw new Error('No se pudieron traer los titulares.');
  return (j.items || []).map(x => ({ ...separar(x.title), url: x.link, fecha: x.pubDate, desc: sinHTML(x.description) }));
}

// ¿De qué tema es un titular? Por las palabras del tema (raíz de 6 letras, sin tildes).
const plano = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const raices = (tema) => plano(tema).split(/[^a-zñ]+/).filter(w => w.length >= 4).map(w => w.slice(0, 6));
const RELACIONADAS = { econom: ['dolar', 'inflac', 'bcra', 'merca', 'bolsa', 'tasa', 'precio', 'fmi', 'reserv'], tecnol: ['intelig', ' ia ', 'chip', 'apple', 'google', 'celula', 'softwa', 'digita'],
  guerra: ['ataque', 'misil', 'ejerci', 'conflic', 'ucrani', 'rusia', 'israel', 'gaza', 'otan'], politi: ['gobier', 'congre', 'senado', 'diputa', 'milei', 'eleccio', 'minist'] };
function puntaje(x, tema) {
  const t = ` ${plano(`${x.titulo} ${x.desc}`)} `;
  let p = 0;
  for (const r of raices(tema)) { if (t.includes(r)) p += 2; for (const w of RELACIONADAS[r] || []) if (t.includes(w)) p += 1; }
  if (/argentin/.test(plano(tema)) && /argentin|milei|bcra|caputo|buenos aires/.test(t)) p += 2;
  if (/mundial|internacional/.test(plano(tema)) && !/argentin/.test(t)) p += 1;
  return p;
}

// Un solo pedido con todos tus temas juntos (el servicio gratis corta si se le piden varios seguidos).
async function titulares(aj) {
  const temas = [...aj.intereses].sort((a, b) => (b.peso || 0) - (a.peso || 0)).filter(i => (i.peso || 0) > -4).slice(0, 6);
  if (!temas.length) throw new Error('Agregá algún interés en Configurar.');
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${temas.map(t => consulta(t.nombre)).join(' OR ')} when:1d`)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const todos = await leerRSS(url);
  // Cada titular va al tema con el que más coincide.
  const vistos = new Set(), porTema = new Map(temas.map(t => [t.nombre, []])), sueltos = [];
  for (const x of todos) {
    const clave = plano(x.titulo).slice(0, 40);
    if (!x.titulo || vistos.has(clave)) continue;
    vistos.add(clave);
    const mejor = temas.map(t => ({ t, p: puntaje(x, t.nombre) })).sort((a, b) => b.p - a.p)[0];
    if (mejor.p > 0) porTema.get(mejor.t.nombre).push({ tema: mejor.t.nombre, ...x }); else sueltos.push(x);
  }
  // De a uno por tema (los de más interés primero), dando vueltas hasta llegar a 6.
  const salida = [];
  for (let vuelta = 0; salida.length < META && vuelta < META; vuelta++) {
    for (const t of temas) {
      const extra = (t.peso || 0) >= 2 && vuelta === 0 ? 2 : 1;
      for (let k = 0; k < extra && salida.length < META; k++) { const x = porTema.get(t.nombre).shift(); if (x) salida.push(x); }
    }
  }
  // Si igual faltan, los que no se pudieron ubicar (Gemini después les pone tema).
  while (salida.length < META && sueltos.length) salida.push({ tema: temas[0].nombre, ...sueltos.shift() });
  if (!salida.length) throw new Error('No llegaron titulares. Probá más tarde.');
  return temas.flatMap(t => salida.filter(x => x.tema === t.nombre));
}
const META = 6;   // titulares por día
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

function pregunta(aj, hoy, lista) {
  const no = [...aj.descartados, ...aj.intereses.map(i => i.nombre), ...aj.sugeridos].join(', ');
  return `Hoy es ${fechaLarga(hoy)}. Vivo en Argentina. Estos son titulares reales de hoy:
${lista.map((x, k) => `${k + 1}. [${x.tema}] ${x.titulo} (${x.fuente || 'sin medio'})${x.desc && x.desc !== x.titulo ? ` — ${x.desc.slice(0, 300)}` : ''}`).join('\n')}

Mis temas son: ${aj.intereses.map(i => i.nombre).join(', ')}. En "tema" poné cuál de esos le corresponde a cada titular.
Para cada titular escribí un resumen de una oración y un detalle de 2 o 3 párrafos cortos (separados por una línea en blanco): qué dice la noticia y el contexto general del tema para entender por qué importa.
Usá solo lo que dice el titular y conocimiento general: no inventes cifras, nombres ni hechos que no estén en el titular. Si no sabés algo, explicalo de forma general.
En español rioplatense, claro para alguien que no es experto.
Devolvé SOLO un JSON, sin nada antes ni después:
{"noticias":[{"n":1,"tema":"...","resumen":"...","detalle":"..."}],"sugeridos":["tema nuevo"]}
En "sugeridos" poné 2 o 3 temas nuevos que me podrían interesar (que no sean: ${no}).`;
}
function leerJSON(texto) {
  const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
  try { return JSON.parse(texto.slice(a, b + 1)); } catch { return null; }
}

let buscando = null;
// Devuelve las noticias de hoy ([] si todavía no hay).
export async function noticias(ctx, m, { forzar = false } = {}) {
  const hoy = hoyISO();
  const rev = await m.leer('dia', hoy);
  // Si hoy llegaron pocas (el servicio cortó), se reintenta cada media hora.
  const pocas = rev?.noticias?.length && rev.noticias.length < 4 && Date.now() - (rev.noticiasIntento || 0) > 30 * 60e3;
  if (rev?.noticias?.length && !forzar && !pocas) return rev.noticias;
  // Si falló hace poco (sin internet o servicio caído), espera media hora antes de reintentar.
  if (!forzar && !pocas && rev?.noticiasIntento && Date.now() - rev.noticiasIntento < 30 * 60e3) return rev?.noticias || [];
  buscando ||= (async () => {
    await m.guardar('dia', hoy, { noticiasIntento: Date.now() });
    const aj = await leerAjustes(ctx);
    let lista;
    try { lista = await titulares(aj); } catch (e) { await m.guardar('dia', hoy, { noticiasError: e.message }); throw e; }
    // Gemini explica cada titular; si no hay clave o falla, quedan los titulares solos.
    let x = null;
    if (await pedirSeguro(ctx, 'gemini-hay-clave', {}, false)) {
      try { x = leerJSON((await ctx.pedir('gemini-preguntar', { texto: pregunta(aj, hoy, lista) }))?.texto || ''); } catch (e) { console.warn('noticias gemini', e); }
    }
    const final = lista.map((n, k) => {
      const g = (x?.noticias || []).find(y => Number(y.n) === k + 1) || {};
      return {
        tema: aj.intereses.find(i => igual(i.nombre, g.tema))?.nombre || n.tema, titulo: n.titulo.slice(0, 200), fuente: n.fuente, url: n.url || `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(n.titulo)}`,
        resumen: String(g.resumen || (n.desc !== n.titulo ? n.desc : '') || '').slice(0, 400), detalle: String(g.detalle || '').slice(0, 4000),
      };
    });
    await m.guardar('dia', hoy, { noticias: final, noticiasHora: Date.now(), noticiasError: '' });
    if (x?.sugeridos?.length) {
      const ya = [...aj.intereses.map(i => i.nombre), ...aj.descartados, ...aj.sugeridos];
      const nuevos = x.sugeridos.map(String).filter(s => s && !ya.some(y => igual(y, s)));
      if (nuevos.length) await guardarAjustes(ctx, { sugeridos: [...aj.sugeridos, ...nuevos].slice(-6) });
    }
    return final;
  })().finally(() => { buscando = null; });
  return buscando;
}

// Si Gemini no pudo explicar el titular a la mañana, lo intenta al abrirlo (un pedido) y lo guarda.
async function completarDetalle(ctx, n, zona) {
  const { h } = ctx;
  if (!await pedirSeguro(ctx, 'gemini-hay-clave', {}, false)) return;
  poner(zona, h('p', { class: 'nota' }, 'Preparando el detalle…'));
  try {
    const x = leerJSON((await ctx.pedir('gemini-preguntar', { texto: pregunta(await leerAjustes(ctx), hoyISO(), [{ ...n, desc: n.resumen }]) }))?.texto || '');
    const g = x?.noticias?.[0];
    if (!g?.detalle) throw new Error('Gemini no devolvió el detalle.');
    n.detalle = String(g.detalle).slice(0, 4000); n.resumen = n.resumen || String(g.resumen || '');
    const col = ctx.datos('revisiones');
    const rev = (await col.listar()).find(r => r.tipo === 'dia' && r.clave === hoyISO());
    if (rev?.noticias) await col.actualizar(rev.id, { noticias: rev.noticias.map(y => (y.titulo === n.titulo ? { ...y, detalle: n.detalle, resumen: n.resumen } : y)) });
    poner(zona, n.detalle.split(/\n\s*\n/).map(p => h('p', {}, p)));
  } catch (e) { poner(zona, h('p', {}, n.resumen || ''), h('p', { class: 'nota' }, `No se pudo preparar el detalle (${e.message}).`)); }
}

// Ventana con la noticia completa.
export function abrirNoticia(ctx, n) {
  const { h } = ctx;
  sumarPeso(ctx, n.tema, 1);
  const texto = h('div', { class: 'rs-hoja-texto' }, String(n.detalle || n.resumen || '').split(/\n\s*\n/).map(p => h('p', {}, p)));
  if (!n.detalle) completarDetalle(ctx, n, texto);
  const dlg = h('dialog', { class: 'hoja rs-hoja' },
    h('span', { class: 'rs-aviso-et' }, n.tema),
    h('h2', {}, n.titulo),
    texto,
    h('a', { href: n.url, target: '_blank', rel: 'noopener', class: 'rs-link izq' }, `Leer en la fuente original${n.fuente ? ` (${n.fuente})` : ''} ›`),
    h('div', { class: 'hoja-botones' },
      h('button', { type: 'button', class: 'boton', onclick: async () => { await sumarPeso(ctx, n.tema, -3); dlg.close(); ctx.aviso(`Listo, vas a ver menos de "${n.tema}".`); } }, 'No me interesa este tema'),
      h('button', { type: 'button', class: 'boton principal', onclick: () => dlg.close() }, 'Cerrar')));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  dlg.showModal();
}

const saludo = () => { const hh = new Date().getHours(); return hh < 13 ? 'Buen día' : hh < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const mini = (h, v, t) => h('span', {}, h('b', {}, v), t);

// ── Cartel del día para el Inicio (sin ✕: se va con "Ver mi día" o "Ahora no") ──
// Saludo con tu nombre (sin repetir la fecha), números del día y un adelanto:
// tareas por área, vencimientos, cumpleaños y la primera noticia.
export async function tarjetaDia(ctx, m, alCerrar) {
  const { h } = ctx;
  const hoy = hoyISO();
  const aj = await leerAjustes(ctx);
  const [d, rev] = await Promise.all([loDeHoy(ctx), m.leer('dia', hoy)]);
  let tiempo = await clima(aj).catch(() => null);
  const pendientes = d.tareas.filter(x => !x.hecha), vence = d.vence.filter(x => !x.hecha);
  const porArea = [];
  for (const x of pendientes) {
    const nombre = String(x.lugar || 'Bandeja').split(' › ')[0];
    const a = porArea.find(y => y.nombre === nombre) || (porArea.push({ nombre, id: x.areaId || '', n: 0 }), porArea[porArea.length - 1]);
    a.n++;
  }
  porArea.sort((a, b) => b.n - a.n);
  const nums = h('span', { class: 'rs-aviso-mini' });
  const pintarNums = () => poner(nums,
    tiempo ? mini(h, `${tiempo.temp}°`, textoClima(tiempo.codigo)[2].toLowerCase()) : null,
    vence.length ? mini(h, String(vence.length), 'vence') : null,
    d.habitos.total ? mini(h, String(d.habitos.total - d.habitos.hechos), 'hábitos') : null);
  const lineas = h('div', { class: 'rs-lineas' });
  const enlace = (texto, alTocar) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); alTocar(); } }, texto);
  const linea = (icono, ...cont) => h('span', {}, h('em', {}, icono), ...cont);
  const pintarLineas = (lista, estado = '') => poner(lineas,
    !tiempo && aj.lugar?.tipo !== 'ciudad' ? linea('🌤️', enlace('Tocá para ver el tiempo', async () => {
      try { tiempo = await clima(aj, { pedirPermiso: true }); pintarNums(); pintarLineas(lista, estado); } catch (e) { ctx.aviso(e.message); }
    })) : null,
    d.feriados.map(x => linea('🇦🇷', x.titulo)),
    // Las tareas de hoy, contadas por área en un solo renglón; tocar un área la abre en Tareas.
    porArea.length ? linea('○', h('span', { class: 'rs-chips' }, porArea.map(a => h('a', { class: 'rs-chip', href: a.id ? `#/tareas/area/${a.id}` : '#/tareas/hoy' }, a.nombre, h('b', {}, String(a.n)))))) : null,
    vence.map(x => linea('💳', enlace(`Vence: ${x.titulo}`, () => ctx.pedir('abrir-tarea', { id: x.id })))),
    (d.cumples || []).map(c => linea('🎂', enlace(`Cumpleaños de ${c.nombre} ›`, () => abrirCumpleanos(ctx)))),
    lista?.[0] ? linea('📰', enlace(lista[0].titulo, () => abrirNoticia(ctx, lista[0])))
      : lista === null ? linea('📰', 'Para ver noticias, poné tu clave de Gemini en ', h('a', { href: '#/bitacora/ajustes' }, 'Configurar Bitácora'))
        : linea('📰', h('span', { class: 'rs-tenue' }, estado || 'Buscando las noticias de hoy…')));
  pintarNums();
  if (rev?.noticias?.length) pintarLineas(rev.noticias);
  else {
    pintarLineas([], rev?.noticiasError ? `Las noticias no llegaron (${rev.noticiasError}). Se reintenta sola.` : '');
    // Se buscan de fondo y aparecen cuando llegan.
    noticias(ctx, m).then(l => pintarLineas(l, l?.length ? '' : 'Las noticias todavía no llegaron. Se reintenta sola.'))
      .catch(e => pintarLineas([], `Las noticias no llegaron (${e.message}). Se reintenta sola.`));
  }
  const verlo = async (ir) => { await m.guardar('dia', hoy, { vista: true }); if (ir) ctx.navegar('resumen/hoy'); else alCerrar(); };
  return h('section', { class: 'rs-aviso dia' },
    h('span', { class: 'rs-aviso-et' }, `${saludo()}${aj.nombre ? `, ${aj.nombre}` : ''}`),
    nums,
    lineas,
    h('span', { class: 'rs-aviso-bot' },
      h('button', { type: 'button', class: 'rs-bt p', onclick: () => verlo(true) }, 'Ver mi día'),
      h('button', { type: 'button', class: 'rs-bt', onclick: () => verlo(false) }, 'Ahora no')));
}

// ── Pantalla "Hoy" (#/resumen/hoy): para volver a verlo cuando quieras ──
export async function pantallaHoy(cuerpo, ctx, m) {
  const { h } = ctx;
  const hoy = hoyISO();
  const aj = await leerAjustes(ctx);
  const d = await loDeHoy(ctx);
  const zonaClima = h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Tiempo'), h('p', { class: 'nota' }, 'Buscando el pronóstico…'));
  const zonaNoti = h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Noticias para vos', h('small', {}, 'Tocá una para verla completa')), h('p', { class: 'nota' }, 'Buscando las noticias de hoy…'));
  const fila = (icono, texto, der, alTocar, hecha) => h(alTocar ? 'button' : 'div', alTocar ? { type: 'button', class: `rs-fila${hecha ? ' hecha' : ''}`, onclick: alTocar } : { class: 'rs-fila' },
    h('span', { class: 'rs-t' }, icono ? `${icono} ${texto}` : texto), der ? h('small', {}, der) : null);

  poner(cuerpo,
    h('div', { class: 'rs-grid2' },
      zonaClima,
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Para hoy', h('small', {}, 'tareas, vencimientos y hábitos')),
        d.feriados.map(x => fila('🇦🇷', x.titulo, 'feriado')),
        d.tareas.length ? d.tareas.map(x => fila(x.hecha ? '✓' : '○', x.titulo, x.hora || x.lugar, () => ctx.pedir('abrir-tarea', { id: x.id }), x.hecha)) : h('p', { class: 'nota' }, 'No tenés tareas para hoy.'),
        d.vence.map(x => fila('💳', x.titulo, x.hecha ? 'pagado' : 'vence hoy', () => ctx.pedir('abrir-tarea', { id: x.id }), x.hecha)),
        d.habitos.total ? fila('✅', 'Hábitos del día', `${d.habitos.hechos} de ${d.habitos.total}`, () => ctx.navegar('habitos')) : null),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Cumpleaños'),
        d.cumples?.length ? d.cumples.map(c => fila('🎂', c.nombre, c.edad ? `cumple ${c.edad}` : 'hoy', () => abrirCumpleanos(ctx)))
          : d.cumples ? h('p', { class: 'nota' }, 'Hoy no cumple nadie.')
            : h('p', { class: 'nota' }, 'Los cumpleaños se van a cargar en Tareas. ', h('a', { href: '#/tareas', class: 'rs-link izq', onclick: (e) => { e.preventDefault(); abrirCumpleanos(ctx); } }, 'Ir a Tareas ›'))),
      zonaNoti));

  clima(aj, { pedirPermiso: true }).then(t => {
    if (!t) return;
    const [ic, txt] = textoClima(t.codigo).slice(1);
    poner(zonaClima, h('h3', {}, 'Tiempo', h('small', {}, `📍 ${t.lugar}`)),
      h('div', { class: 'rs-clima' }, h('b', {}, `${t.temp}°`),
        h('span', {}, `${ic} ${txt}`, h('small', {}, `Máx ${t.max}° · mín ${t.min}°${t.lluvia !== null ? ` · lluvia ${t.lluvia}%` : ''}`)),
        h('span', { class: 'rs-horas' }, t.horas.map(x => h('span', {}, `${x.hora}h`, h('b', {}, `${x.temp}°`))))));
  }).catch(e => poner(zonaClima, h('h3', {}, 'Tiempo'), h('p', { class: 'nota' }, e.message, ' ', h('a', { href: '#/resumen/config', class: 'rs-link izq' }, 'Configurar ›'))));

  const pintarNoti = (lista, aviso = '') => {
    const titulo = h('h3', {}, 'Noticias para vos', h('small', {}, 'Tocá una para verla completa'));
    if (lista === null) { poner(zonaNoti, titulo, h('p', { class: 'nota' }, 'Para ver noticias, poné tu clave de Gemini en ', h('a', { href: '#/bitacora/ajustes', class: 'rs-link izq' }, 'Configurar Bitácora'), '.')); return; }
    poner(zonaNoti, titulo,
      lista.length ? lista.map(n => h('button', { type: 'button', class: 'rs-noti', onclick: () => abrirNoticia(ctx, n) },
        h('span', { class: 'rs-aviso-et' }, n.tema), h('b', {}, n.titulo), h('span', {}, n.resumen))) : h('p', { class: 'nota' }, aviso || 'Todavía no hay noticias de hoy.'),
      h('span', { class: 'nota' }, 'Titulares de Google Noticias, explicados con Gemini. Una vez por día. ',
        h('button', { type: 'button', class: 'rs-bt ch', onclick: () => { poner(zonaNoti, titulo, h('p', { class: 'nota' }, 'Buscando…')); noticias(ctx, m, { forzar: true }).then(pintarNoti, e => pintarNoti([], e.message)); } }, 'Buscar de nuevo')));
  };
  noticias(ctx, m).then(l => pintarNoti(l, 'Gemini no respondió. Se vuelve a intentar sola en un rato.'), e => pintarNoti([], e.message));
  // Abrir "Hoy" cuenta como visto: el cartel del Inicio se va.
  const rev = await m.leer('dia', hoy);
  if (!rev?.vista) m.guardar('dia', hoy, { vista: true });
}

// ── Configurar Resumen (#/resumen/config) ──
// Vuelve a mostrar el panel del Inicio (mes, semana y día que estaban cerrados) y reintenta las noticias.
async function relanzar(ctx) {
  const col = ctx.datos('revisiones');
  for (const r of await col.listar()) {
    if (!r.vista || r.hecha) continue;
    if ((r.tipo === 'dia' && r.clave === hoyISO()) || r.tipo === 'semana' || r.tipo === 'mes') await col.actualizar(r.id, { vista: false });
  }
  const hoyRev = (await col.listar()).find(r => r.tipo === 'dia' && r.clave === hoyISO());
  if (hoyRev && !hoyRev.noticias?.length) await col.actualizar(hoyRev.id, { noticiasIntento: 0, noticiasError: '' });
  ctx.navegar('home');
}

export async function pantallaConfig(cuerpo, ctx) {
  const { h } = ctx;
  let aj = await leerAjustes(ctx);
  const guardar = async (c) => { Object.assign(aj, c); await guardarAjustes(ctx, c); pintar(); };

  function pintar() {
    const hora = h('input', { type: 'time', value: aj.hora || '05:00', onchange: () => hora.value && guardar({ hora: hora.value }) });
    const buscar = h('input', { type: 'search', placeholder: 'Buscar ciudad…', enterkeyhint: 'search' });
    const resultados = h('div', { class: 'rs-chips' });
    const hacerBusqueda = async () => {
      if (buscar.value.trim().length < 2) return;
      poner(resultados, h('span', { class: 'nota' }, 'Buscando…'));
      try {
        const l = await buscarCiudades(buscar.value.trim());
        poner(resultados, l.length ? l.map(c => h('button', { type: 'button', class: 'rs-chip', onclick: () => guardar({ lugar: c }) }, c.nombre)) : h('span', { class: 'nota' }, 'No encontré esa ciudad.'));
      } catch (e) { poner(resultados, h('span', { class: 'nota' }, e.message)); }
    };
    buscar.addEventListener('keydown', (e) => { if (e.key === 'Enter') hacerBusqueda(); });
    const nuevo = h('input', { type: 'text', placeholder: 'Agregar un tema…', enterkeyhint: 'done' });
    const agregar = () => {
      const t = nuevo.value.trim();
      if (!t || aj.intereses.some(i => igual(i.nombre, t))) return;
      guardar({ intereses: [...aj.intereses, { nombre: t, peso: 0 }], sugeridos: aj.sugeridos.filter(s => !igual(s, t)) });
    };
    nuevo.addEventListener('keydown', (e) => { if (e.key === 'Enter') agregar(); });
    const gps = aj.lugar?.tipo !== 'ciudad';

    const nombre = h('input', { type: 'text', value: aj.nombre || '', placeholder: 'Tu nombre', onchange: () => guardar({ nombre: nombre.value.trim() }) });
    poner(cuerpo,
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Resumen del día'),
        h('label', { class: 'rs-campo' }, h('span', {}, 'Te saluda como'), nombre),
        h('label', { class: 'rs-campo' }, h('span', {}, 'Aparece en el Inicio desde las'), hora),
        h('span', { class: 'nota' }, 'Se muestra la primera vez que abrís la app desde esa hora, hasta que tocás "Ver mi día" o "Ahora no". Siempre lo podés volver a ver en Resumen › Hoy.'),
        h('button', { type: 'button', class: 'rs-bt', onclick: () => relanzar(ctx) }, '↻ Relanzar el panel')),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Tiempo', h('small', {}, gps ? '📍 Ubicación actual' : `📍 ${aj.lugar.nombre}`)),
        h('div', { class: 'rs-chips' },
          h('button', { type: 'button', class: `rs-chip${gps ? ' on' : ''}`, onclick: () => guardar({ lugar: { tipo: 'gps' } }) }, '📍 Ubicación actual (GPS)'),
          !gps ? h('button', { type: 'button', class: 'rs-chip on' }, aj.lugar.nombre) : null),
        h('div', { class: 'rs-campo-fila' }, buscar, h('button', { type: 'button', class: 'rs-bt', onclick: hacerBusqueda }, 'Buscar')),
        resultados),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Intereses', h('small', {}, 'Tocá ✕ para quitar')),
        h('div', { class: 'rs-chips' }, aj.intereses.map(i => h('span', { class: 'rs-chip on' }, i.nombre,
          h('button', { type: 'button', class: 'rs-chip-x', 'aria-label': `Quitar ${i.nombre}`, onclick: () => guardar({ intereses: aj.intereses.filter(x => x !== i), descartados: [...aj.descartados, i.nombre] }) }, '✕')))),
        h('div', { class: 'rs-campo-fila' }, nuevo, h('button', { type: 'button', class: 'rs-bt', onclick: agregar }, 'Agregar')),
        aj.sugeridos.length ? [h('h3', {}, 'Te sugiero', h('small', {}, 'según lo que abrís')),
          h('div', { class: 'rs-chips' }, aj.sugeridos.map(s => h('span', { class: 'rs-chip sug' },
            h('button', { type: 'button', class: 'rs-chip-mas', onclick: () => guardar({ intereses: [...aj.intereses, { nombre: s, peso: 0 }], sugeridos: aj.sugeridos.filter(x => x !== s) }) }, `+ ${s}`),
            h('button', { type: 'button', class: 'rs-chip-x', 'aria-label': `No sugerir ${s}`, onclick: () => guardar({ sugeridos: aj.sugeridos.filter(x => x !== s), descartados: [...aj.descartados, s] }) }, '✕'))))] : null,
        h('span', { class: 'nota' }, 'La app aprende de las noticias que abrís y de las que marcás "No me interesa este tema".')),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Cumpleaños'),
        h('p', { class: 'nota' }, 'Los cumpleaños se configuran en Tareas. ',
          h('a', { href: '#/tareas', class: 'rs-link izq', onclick: (e) => { e.preventDefault(); abrirCumpleanos(ctx); } }, 'Configurarlos en Tareas ›'))));
  }
  pintar();
}
