// ─────────────────────────────────────────────────────────────
// Resumen del día: el tiempo, lo de hoy (tareas, vencimientos, hábitos) y cumpleaños.
//   - Lo de hoy se pide a Tareas y Hábitos (ctx.pedir), no se guarda.
//   - El tiempo viene de Open-Meteo (gratis, sin clave).
//   (Las noticias se sacaron en 0.25.5: dependían de servicios gratis que fallaban.)
// Ajustes (colección "ajustes", uno solo): { nombre, hora, lugar }
// ─────────────────────────────────────────────────────────────

import { pedirSeguro, hoyISO } from './datos.js';

const base = () => ({ nombre: 'Matías', hora: '05:00', lugar: { tipo: 'gps' } });
const poner = (el, ...hijos) => el.replaceChildren(...hijos.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));

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

const saludo = () => { const hh = new Date().getHours(); return hh < 13 ? 'Buen día' : hh < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const mini = (h, v, t) => h('span', {}, h('b', {}, v), t);

// ── Cartel del día para el Inicio (sin ✕: se va con "Ver mi día" o "Ahora no") ──
// Saludo con tu nombre (sin repetir la fecha), números del día y un adelanto:
// tareas por área, vencimientos y cumpleaños.
export async function tarjetaDia(ctx, m, alCerrar) {
  const { h } = ctx;
  const hoy = hoyISO();
  const aj = await leerAjustes(ctx);
  const d = await loDeHoy(ctx);
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
  const pintarLineas = () => poner(lineas,
    !tiempo && aj.lugar?.tipo !== 'ciudad' ? linea('🌤️', enlace('Tocá para ver el tiempo', async () => {
      try { tiempo = await clima(aj, { pedirPermiso: true }); pintarNums(); pintarLineas(); } catch (e) { ctx.aviso(e.message); }
    })) : null,
    d.feriados.map(x => linea('🇦🇷', x.titulo)),
    // Las tareas de hoy, contadas por área en un solo renglón; tocar un área la abre en Tareas.
    porArea.length ? linea('○', h('span', { class: 'rs-chips' }, porArea.map(a => h('a', { class: 'rs-chip', href: a.id ? `#/tareas/area/${a.id}` : '#/tareas/hoy' }, a.nombre, h('b', {}, String(a.n)))))) : null,
    vence.map(x => linea('💳', enlace(`Vence: ${x.titulo}`, () => ctx.pedir('abrir-tarea', { id: x.id })))),
    (d.cumples || []).map(c => linea('🎂', enlace(`Cumpleaños de ${c.nombre} ›`, () => abrirCumpleanos(ctx)))));
  pintarNums();
  pintarLineas();
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
            : h('p', { class: 'nota' }, 'Los cumpleaños se van a cargar en Tareas. ', h('a', { href: '#/tareas', class: 'rs-link izq', onclick: (e) => { e.preventDefault(); abrirCumpleanos(ctx); } }, 'Ir a Tareas ›')))));

  clima(aj, { pedirPermiso: true }).then(t => {
    if (!t) return;
    const [ic, txt] = textoClima(t.codigo).slice(1);
    poner(zonaClima, h('h3', {}, 'Tiempo', h('small', {}, `📍 ${t.lugar}`)),
      h('div', { class: 'rs-clima' }, h('b', {}, `${t.temp}°`),
        h('span', {}, `${ic} ${txt}`, h('small', {}, `Máx ${t.max}° · mín ${t.min}°${t.lluvia !== null ? ` · lluvia ${t.lluvia}%` : ''}`)),
        h('span', { class: 'rs-horas' }, t.horas.map(x => h('span', {}, `${x.hora}h`, h('b', {}, `${x.temp}°`))))));
  }).catch(e => poner(zonaClima, h('h3', {}, 'Tiempo'), h('p', { class: 'nota' }, e.message, ' ', h('a', { href: '#/resumen/config', class: 'rs-link izq' }, 'Configurar ›'))));

  // Abrir "Hoy" cuenta como visto: el cartel del Inicio se va.
  const rev = await m.leer('dia', hoy);
  if (!rev?.vista) m.guardar('dia', hoy, { vista: true });
}

// ── Configurar Resumen (#/resumen/config) ──
// Vuelve a mostrar el panel del Inicio (mes, semana y día que estaban cerrados).
async function relanzar(ctx) {
  const col = ctx.datos('revisiones');
  for (const r of await col.listar()) {
    if (!r.vista || r.hecha) continue;
    if ((r.tipo === 'dia' && r.clave === hoyISO()) || r.tipo === 'semana' || r.tipo === 'mes') await col.actualizar(r.id, { vista: false });
  }
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
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Cumpleaños'),
        h('p', { class: 'nota' }, 'Los cumpleaños se configuran en Tareas. ',
          h('a', { href: '#/tareas', class: 'rs-link izq', onclick: (e) => { e.preventDefault(); abrirCumpleanos(ctx); } }, 'Configurarlos en Tareas ›'))));
  }
  pintar();
}
