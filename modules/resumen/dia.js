// ─────────────────────────────────────────────────────────────
// Resumen del día: el tiempo, lo de hoy (tareas, vencimientos, hábitos),
// cumpleaños y noticias de tus temas.
//   - Lo de hoy se pide a Tareas y Hábitos (ctx.pedir), no se guarda.
//   - El tiempo viene de Open-Meteo (gratis, sin clave).
//   - Las noticias las busca Gemini una vez por día, con la clave que ya
//     está en Bitácora (acción 'gemini-preguntar'), y quedan guardadas en
//     la revisión del día para no gastar el cupo gratis.
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
const fechaLarga = (iso) => { const f = deISO(iso); return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`; };
function pregunta(aj, hoy) {
  const temas = [...aj.intereses].sort((a, b) => (b.peso || 0) - (a.peso || 0))
    .map(i => `- ${i.nombre} (interés ${Math.max(1, Math.min(9, 3 + (i.peso || 0)))} de 9)`).join('\n');
  const no = [...aj.descartados, ...aj.intereses.map(i => i.nombre), ...aj.sugeridos].join(', ');
  return `Hoy es ${fechaLarga(hoy)}. Vivo en Argentina. Buscá en internet las noticias más importantes de hoy o de las últimas 24 horas sobre estos temas (más noticias de los temas con más interés):
${temas}

Devolvé SOLO un JSON, sin nada antes ni después, con esta forma:
{"noticias":[{"tema":"exactamente uno de los temas de arriba","titulo":"título corto","resumen":"una oración","detalle":"3 a 5 párrafos cortos separados por una línea en blanco: qué pasó, el contexto y por qué importa","fuente":"nombre del medio"}],"sugeridos":["tema nuevo"]}
Entre 4 y 6 noticias distintas, en español rioplatense, claras para alguien que no es experto.
En "sugeridos" poné 2 o 3 temas nuevos que me podrían interesar según los de más interés (que no sean: ${no}).`;
}
function leerJSON(texto) {
  const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
  try { return JSON.parse(texto.slice(a, b + 1)); } catch { return null; }
}
// El enlace sale de las fuentes reales que usó Gemini; si no coincide ninguna, una búsqueda de la noticia.
function enlace(n, fuentes) {
  const f = fuentes.find(x => n.fuente && (x.titulo.toLowerCase().includes(String(n.fuente).toLowerCase().replace(/\s+/g, '')) || String(n.fuente).toLowerCase().includes(x.titulo.toLowerCase().replace(/\.(com|ar|net|org).*$/, ''))));
  return f?.url || `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(n.titulo)}`;
}

let buscando = null;
// Devuelve las noticias de hoy ([] si todavía no hay) o null si falta la clave de Gemini.
export async function noticias(ctx, m, { forzar = false } = {}) {
  const hoy = hoyISO();
  const rev = await m.leer('dia', hoy);
  if (rev?.noticias?.length && !forzar) return rev.noticias;
  if (!await pedirSeguro(ctx, 'gemini-hay-clave', {}, false)) return null;
  // Si falló hace poco (Gemini saturado o sin internet), espera media hora antes de reintentar.
  if (!forzar && rev?.noticiasIntento && Date.now() - rev.noticiasIntento < 30 * 60e3) return [];
  buscando ||= (async () => {
    await m.guardar('dia', hoy, { noticiasIntento: Date.now() });
    const aj = await leerAjustes(ctx);
    let r, x;
    try {
      r = await ctx.pedir('gemini-preguntar', { texto: pregunta(aj, hoy), buscar: true });
      x = leerJSON(r?.texto || '');
      if (!x?.noticias?.length) throw new Error('Gemini no devolvió noticias.');
    } catch (e) {
      await m.guardar('dia', hoy, { noticiasError: e.message || String(e) });
      throw e;
    }
    const lista = x.noticias.slice(0, 6).map(n => ({
      tema: String(n.tema || ''), titulo: String(n.titulo || '').slice(0, 200), resumen: String(n.resumen || '').slice(0, 400),
      detalle: String(n.detalle || '').slice(0, 4000), fuente: String(n.fuente || ''), url: enlace(n, r.fuentes || []),
    })).filter(n => n.titulo);
    await m.guardar('dia', hoy, { noticias: lista, noticiasHora: Date.now(), noticiasError: '' });
    const ya = [...aj.intereses.map(i => i.nombre), ...aj.descartados, ...aj.sugeridos];
    const nuevos = (x.sugeridos || []).map(String).filter(s => s && !ya.some(y => igual(y, s)));
    if (nuevos.length) await guardarAjustes(ctx, { sugeridos: [...aj.sugeridos, ...nuevos].slice(-6) });
    return lista;
  })().finally(() => { buscando = null; });
  return buscando;
}

// Ventana con la noticia completa.
export function abrirNoticia(ctx, n) {
  const { h } = ctx;
  sumarPeso(ctx, n.tema, 1);
  const dlg = h('dialog', { class: 'hoja rs-hoja' },
    h('span', { class: 'rs-aviso-et' }, n.tema),
    h('h2', {}, n.titulo),
    String(n.detalle || n.resumen).split(/\n\s*\n/).map(p => h('p', {}, p)),
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
// Igual a la vista previa: saludo con tu nombre, números del día y un adelanto
// (próximas tareas, vencimientos, cumpleaños y la primera noticia).
export async function tarjetaDia(ctx, m, alCerrar) {
  const { h } = ctx;
  const hoy = hoyISO(), f = deISO(hoy);
  const aj = await leerAjustes(ctx);
  const [d, rev] = await Promise.all([loDeHoy(ctx), m.leer('dia', hoy)]);
  let tiempo = await clima(aj).catch(() => null);
  const pendientes = d.tareas.filter(x => !x.hecha), vence = d.vence.filter(x => !x.hecha);
  const nums = h('span', { class: 'rs-aviso-mini' });
  const pintarNums = () => poner(nums,
    tiempo ? mini(h, `${tiempo.temp}°`, textoClima(tiempo.codigo)[2].toLowerCase()) : null,
    mini(h, String(pendientes.length), pendientes.length === 1 ? 'tarea' : 'tareas'),
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
    pendientes.slice(0, 3).map(x => linea('○', enlace(`${x.hora ? `${x.hora} · ` : ''}${x.titulo}`, () => ctx.pedir('abrir-tarea', { id: x.id })))),
    pendientes.length > 3 ? linea('', enlace(`y ${pendientes.length - 3} más ›`, () => ctx.navegar('resumen/hoy'))) : null,
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
    h('b', { class: 'rs-aviso-t' }, `Tu ${DIAS[f.getDay()]} ${f.getDate()}`),
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
      h('span', { class: 'nota' }, 'Buscadas con Gemini una vez por día. ',
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
