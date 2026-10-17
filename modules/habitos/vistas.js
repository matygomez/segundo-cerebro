// ─────────────────────────────────────────────────────────────
// Hábitos y metas: pantallas.
//   Hoy · Hábitos (lista y detalle con historial) · Metas · Estadísticas · Configurar
//
// En Hoy: tocar el círculo = hecho. Deslizar a la izquierda = no lo hice,
// a la derecha = descanso (los dos preguntan antes). Lo ya marcado queda
// bloqueado: se corrige desde el historial de cada hábito.
// ─────────────────────────────────────────────────────────────

import { crearModelo, hoyISO, sumarDias, deISO, aISO, diasEntre, lunesDe, MOMENTOS, textoFrecuencia, progresoMeta, ritmo } from './modelo.js';

const TRAZOS = {
  mas: '<path d="M12 5v14M5 12h14"/>',
  fuego: '<path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 5 5 5 8 1-1 1.5-2 1.5-3 2 2 2.5 4 2.5 5 0 3-3 6-7 6Z"/>',
  pausa: '<path d="M9 6v12M15 6v12"/>',
  luna: '<path d="M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10Z"/>',
  candado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  izq: '<path d="m15 6-6 6 6 6"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  meta: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6"/>',
  puntos: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  repetir: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 16M4 20v-4h4"/>',
  habitos: '<path d="M12 21a8 8 0 1 0 0-16"/><path d="M12 5V3M12 13l3-3"/><circle cx="12" cy="13" r="1"/>',
};
export function ic(nombre, clase = 'icono') {
  const s = document.createElement('span');
  s.className = clase;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre] || ''}</svg>`;
  return s;
}
export function anillo(p, tam = 56, gr = 5, texto = true) {
  const r = (tam - gr) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p || 0));
  const s = document.createElement('span');
  s.className = 'hb-anillo';
  s.style.width = s.style.height = `${tam}px`;
  s.innerHTML = `<svg viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}"><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="var(--linea)" stroke-width="${gr}"/><circle cx="${tam / 2}" cy="${tam / 2}" r="${r}" fill="none" stroke="var(--laton)" stroke-width="${gr}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" transform="rotate(-90 ${tam / 2} ${tam / 2})"/>${texto ? `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="var(--tinta)" font-size="${tam * 0.24}" font-weight="600">${Math.round(v * 100)}%</text>` : ''}</svg>`;
  return s;
}
export function cargarEstilos() {
  if (document.getElementById('estilos-habitos')) return;
  const l = document.createElement('link');
  l.id = 'estilos-habitos'; l.rel = 'stylesheet';
  l.href = new URL('./habitos.css', import.meta.url).href;
  document.head.append(l);
}
const poner = (el, ...hijos) => el.replaceChildren(...hijos.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));
const DN = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const cuando = (fecha) => { const k = diasEntre(fecha, hoyISO()); if (k === 0) return 'Hoy'; if (k === 1) return 'Ayer'; const f = deISO(fecha); return `${DN[f.getDay()]} ${f.getDate()}`; };
const cuandoLargo = (fecha) => { const k = diasEntre(fecha, hoyISO()); if (k === 0) return 'hoy'; if (k === 1) return 'ayer'; const f = deISO(fecha); return `el ${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][f.getDay()]} ${f.getDate()}`; };
const esPC = () => matchMedia('(min-width: 900px)').matches;

// ── Cuadraditos de los últimos 7 días ──
function mini7(ctx, d, h, { resaltar = '' } = {}) {
  const hoy = hoyISO();
  return ctx.h('span', { class: 'hb-mini7', 'aria-hidden': 'true' }, Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(hoy, i - 6);
    const e = d.estadoEfectivo(h, f);
    const cls = f === resaltar ? 'pd' : ({ s: 'on', x: 'x', d: 'd', p: 'p' }[e] || '');
    return ctx.h('i', { class: `${cls}${f === hoy ? ' hoy' : ''}` });
  }));
}

// ── Marcar con confirmación (no / descanso) ──
async function marcarCon(ctx, m, d, h, fecha, estado) {
  const { h: hh } = ctx;
  if (estado === 'd') {
    if (d.cfg.descansos === 'off') return false;
    const quedan = d.descansosRestantes(fecha);
    if (quedan <= 0) { ctx.aviso('No te quedan descansos este mes.'); return false; }
    const ok = await ctx.confirmar(hh('span', { class: 'hb-conf' }, `¿Querés marcar "${h.nombre}" como descanso?`,
      hh('small', {}, `${cuando(fecha)}. No cuenta como hecho, pero la racha sigue.${Number.isFinite(quedan) ? ` Te quedan ${quedan} descanso${quedan === 1 ? '' : 's'} este mes.` : ''}`)), { si: 'Sí', no: 'No' });
    if (!ok) return false;
  }
  if (estado === 'x') {
    const ok = await ctx.confirmar(hh('span', { class: 'hb-conf' }, `¿Querés marcar "${h.nombre}" como no completado?`,
      hh('small', {}, `${cuando(fecha)}. ${h.frecuencia?.tipo === 'semana' ? 'No suma para la semana.' : 'La racha vuelve a cero.'}`)), { si: 'Sí', no: 'No', peligro: true });
    if (!ok) return false;
  }
  await m.marcar(h, fecha, estado, h.tipo === 'cant' && estado === 's' ? Math.max(Number(h.objetivo) || 1, d.valor(h, fecha)) : undefined);
  const txt = { s: 'Hecho', x: 'No completado', d: 'Descanso' }[estado];
  ctx.aviso(`${cuando(fecha)} · ${h.nombre}: ${txt}`, { accion: 'Deshacer', alTocar: () => m.marcar(h, fecha, null), duracion: 6000 });
  return true;
}

// ── Deslizar: izquierda = no, derecha = descanso ──
function deslizable(ctx, caja, fila, { alIzquierda, alDerecha }) {
  let x0 = null, y0 = null, dx = 0, activo = false;
  fila.addEventListener('pointerdown', (e) => { if (e.button > 0 || e.target.closest('button, input')) return; x0 = e.clientX; y0 = e.clientY; dx = 0; activo = false; });
  fila.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!activo) { if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my)) { activo = true; try { fila.setPointerCapture(e.pointerId); } catch { /* nada */ } caja.classList.add('moviendo'); } else if (Math.abs(my) > 10) { x0 = null; return; } else return; }
    dx = Math.max(alIzquierda ? -140 : 0, Math.min(alDerecha ? 140 : 0, mx));
    caja.classList.toggle('izq', dx < 0); caja.classList.toggle('der', dx > 0);
    fila.style.transform = `translateX(${dx}px)`;
  });
  const soltar = async () => {
    if (x0 === null) return;
    x0 = null;
    caja.classList.remove('moviendo');
    if (!activo) return;
    if (Math.abs(dx) > 70) {
      fila.style.transform = `translateX(${dx < 0 ? -140 : 140}px)`;
      const hecho = dx < 0 ? await alIzquierda() : await alDerecha();
      if (!hecho) { fila.style.transform = ''; caja.classList.remove('izq', 'der'); }
    } else { fila.style.transform = ''; caja.classList.remove('izq', 'der'); }
  };
  fila.addEventListener('pointerup', soltar);
  fila.addEventListener('pointercancel', () => { x0 = null; fila.style.transform = ''; caja.classList.remove('moviendo', 'izq', 'der'); });
}

// ── Un hábito (en Hoy, en pendientes y en el Inicio) ──
export function filaHabito(ctx, m, d, h, fecha, { pendiente = false, deslizar = true } = {}) {
  const { h: hh } = ctx;
  const e = d.estado(h, fecha);
  const esHoy = fecha === hoyISO();
  const marcado = !!e;
  let control;
  if (e === 's') control = hh('button', { type: 'button', class: 'hb-check on', 'aria-label': `${h.nombre}: hecho`, onclick: () => ctx.aviso('Ya está marcado. Para corregirlo, entrá al historial del hábito.') }, '✓');
  else if (e === 'x') control = hh('button', { type: 'button', class: 'hb-check no', 'aria-label': `${h.nombre}: no completado`, onclick: () => ctx.aviso('Ya está marcado. Para corregirlo, entrá al historial del hábito.') }, '✗');
  else if (e === 'd') control = hh('button', { type: 'button', class: 'hb-check de', 'aria-label': `${h.nombre}: descanso`, onclick: () => ctx.aviso('Ya está marcado. Para corregirlo, entrá al historial del hábito.') }, ic('luna'));
  else if (h.tipo === 'cant' && esHoy) control = hh('span', { class: 'hb-cant-anillo' }, anillo(d.valor(h, fecha) / (Number(h.objetivo) || 1), 30, 4, false));
  else control = hh('button', { type: 'button', class: 'hb-check', 'aria-label': `Marcar "${h.nombre}" como hecho`, onclick: () => marcarCon(ctx, m, d, h, fecha, 's') }, '✓');

  const racha = d.racha(h);
  const enPausa = d.tienePendiente(h);
  const porSemana = h.frecuencia?.tipo === 'semana';
  const linea = [
    pendiente ? hh('span', { class: 'hb-dia' }, cuando(fecha)) : null,
    enPausa || pendiente ? hh('span', { class: 'hb-racha pausa' }, ic('pausa'), 'racha en pausa')
      : hh('span', { class: 'hb-racha' }, ic('fuego'), porSemana ? `${racha} semana${racha === 1 ? '' : 's'}` : `${racha} día${racha === 1 ? '' : 's'}`),
    !pendiente && textoFrecuencia(h) ? hh('span', {}, `· ${textoFrecuencia(h)}${porSemana ? ` · van ${d.hechasSemana(h)}` : ''}`) : null,
    !pendiente && h.tipo === 'cant' ? hh('span', {}, `· ${h.unidad || ''}`) : null,
  ];
  const derecha = h.tipo === 'cant' && esHoy && !marcado
    ? hh('span', { class: 'hb-cant' },
      hh('button', { type: 'button', 'aria-label': 'Menos', onclick: () => m.marcar(h, fecha, '', Math.max(0, d.valor(h, fecha) - 1)) }, '−'),
      hh('b', {}, `${d.valor(h, fecha)}/${h.objetivo || 1}`),
      hh('button', { type: 'button', 'aria-label': 'Más', onclick: () => { const v = d.valor(h, fecha) + 1; m.marcar(h, fecha, v >= (Number(h.objetivo) || 1) ? 's' : '', v); } }, '+'))
    : mini7(ctx, d, h, { resaltar: pendiente ? fecha : '' });

  const fila = hh('div', { class: 'hb-fila' }, control,
    hh('a', { class: 'hb-nom', href: `#/habitos/h/${h.id}`, draggable: 'false', onclick: (ev) => { if (fila.dataset.movido) ev.preventDefault(); } }, hh('b', {}, h.nombre), hh('small', {}, linea)),
    derecha);
  const caja = hh('div', { class: 'hb-desl' },
    hh('span', { class: 'hb-fondo no' }, '✗ No completado'),
    d.cfg.descansos !== 'off' ? hh('span', { class: 'hb-fondo de' }, ic('luna'), 'Descanso') : null,
    fila);
  if (deslizar && !marcado) {
    deslizable(ctx, caja, fila, {
      alIzquierda: () => marcarCon(ctx, m, d, h, fecha, 'x'),
      alDerecha: d.cfg.descansos !== 'off' ? () => marcarCon(ctx, m, d, h, fecha, 'd') : null,
    });
  }
  return caja;
}

// Racha perfecta: días seguidos (hasta ayer) con todo lo que tocaba hecho o en descanso.
function rachaPerfecta(d) {
  let n = 0;
  for (let k = 1; k < 400; k++) {
    const f = sumarDias(hoyISO(), -k);
    const tocan = d.habitos.filter(h => h.frecuencia?.tipo !== 'semana' && d.toca(h, f));
    if (!tocan.length) { if (k > 60) break; continue; }
    if (tocan.every(h => ['s', 'd'].includes(d.estado(h, f)))) n++; else break;
  }
  return n;
}

// ── Cuadro de hoy (lo usan la pantalla y el Inicio) ──
export function cuadroHoy(ctx, m, d, { conPendientes = true, inicio = false } = {}) {
  const { h: hh } = ctx;
  const hoy = hoyISO();
  const lista = d.deHoy();
  const marcados = lista.filter(h => d.estado(h, hoy));
  const hechos = lista.filter(h => d.estado(h, hoy) === 's');
  const agrupar = d.cfg.agruparHechos !== false;
  const visibles = agrupar ? lista.filter(h => !d.estado(h, hoy)) : lista;
  const salida = [];

  const pend = conPendientes ? d.pendientes() : [];
  if (pend.length) {
    salida.push(hh('section', { class: `${inicio ? 'hb-sub' : 'tarjeta hb-card'} hb-pend` },
      hh('span', { class: 'hb-pend-t' }, 'Pendientes de días anteriores'),
      pend.map(p => filaHabito(ctx, m, d, p.h, p.fecha, { pendiente: true })),
      inicio ? null : hh('span', { class: 'hb-ayuda' }, `Tocá el círculo si lo hiciste · ← deslizá si no lo hiciste${d.cfg.descansos !== 'off' ? ' · → deslizá para descanso' : ''}`)));
  }

  if (!d.habitos.length) {
    salida.push(hh('section', { class: inicio ? 'hb-sub' : 'tarjeta hb-card' },
      hh('p', { class: 'nota' }, 'Todavía no tenés hábitos.'),
      hh('a', { class: 'boton', href: '#/habitos/lista/nuevo' }, ic('mas'), 'Crear el primero')));
    return salida;
  }

  const grupos = MOMENTOS.map(([id, nombre]) => {
    const l = visibles.filter(h => (h.momento || 'manana') === id);
    return l.length ? [hh('div', { class: 'hb-grupo' }, nombre), l.map(h => filaHabito(ctx, m, d, h, hoy))] : null;
  });
  const racha = rachaPerfecta(d);
  let abiertos = false;
  const listaMarcados = hh('div', { class: 'hb-listos-l', hidden: true }, marcados.map(h => {
    const e = d.estado(h, hoy);
    return hh('span', { class: `hb-listo e-${e}` }, e === 's' ? '✓' : e === 'x' ? '✗' : ic('luna'), ` ${h.nombre}`);
  }), hh('small', { class: 'nota' }, 'Bloqueados. Para corregir, entrá al historial del hábito.'));
  const resumenMarcados = () => {
    const nx = marcados.filter(h => d.estado(h, hoy) === 'x').length, nd = marcados.filter(h => d.estado(h, hoy) === 'd').length;
    return [`${hechos.length} completado${hechos.length === 1 ? '' : 's'} hoy`, nx ? ` · ${nx} sin hacer` : '', nd ? ` · ${nd} descanso${nd === 1 ? '' : 's'}` : ''].join('');
  };
  const botonListos = agrupar && marcados.length ? hh('button', {
    type: 'button', class: 'hb-listos', 'aria-expanded': 'false',
    onclick: () => { abiertos = !abiertos; listaMarcados.hidden = !abiertos; botonListos.classList.toggle('abierto', abiertos); botonListos.setAttribute('aria-expanded', String(abiertos)); },
  }, hh('span', { class: 'hb-listos-ok' }, '✓'), resumenMarcados(), ic('candado', 'icono hb-candado'), ic('flecha', 'icono hb-fl')) : null;

  salida.push(hh('section', { class: inicio ? 'hb-sub' : 'tarjeta hb-card' },
    hh('div', { class: 'hb-resumen' }, anillo(lista.length ? hechos.length / lista.length : 0, inicio ? 46 : 58, 5),
      hh('span', {}, hh('b', {}, lista.length ? `${hechos.length} de ${lista.length} hábitos` : 'Hoy no te toca ninguno'),
        hh('small', {}, `hoy${racha ? ` · racha perfecta: ${racha} día${racha === 1 ? '' : 's'}` : ''}`))),
    grupos,
    !visibles.length && lista.length ? hh('p', { class: 'nota hb-todo' }, '¡Listo por hoy!') : null,
    botonListos, botonListos ? listaMarcados : null,
    inicio ? null : hh('a', { class: 'hb-agregar', href: '#/habitos/lista/nuevo' }, ic('mas'), 'Nuevo hábito'),
    inicio ? null : hh('span', { class: 'hb-ayuda' }, `← Deslizá un hábito para marcarlo como no completado${d.cfg.descansos !== 'off' ? ' · → para descanso' : ''}.`)));
  return salida;
}

// ── Mapa de calor (26 semanas) ──
function mapaCalor(ctx, d, h) {
  const { h: hh } = ctx;
  const hoy = hoyISO();
  const lunes = sumarDias(lunesDe(hoy), -25 * 7);
  const celdas = [];
  for (let i = 0; i < 26 * 7; i++) {
    const f = sumarDias(lunes, i);
    if (f > hoy) { celdas.push(hh('i', { class: 'fut' })); continue; }
    const e = d.estadoEfectivo(h, f);
    let cls = { s: 'n3', x: 'x', d: 'd', p: 'p' }[e] || '';
    if (h.tipo === 'cant' && e !== 's' && d.valor(h, f)) cls = d.valor(h, f) / (Number(h.objetivo) || 1) >= 0.5 ? 'n2' : 'n1';
    celdas.push(hh('i', { class: cls, title: `${f}${e && e !== '-' ? ` · ${{ s: 'hecho', x: 'no', d: 'descanso', p: 'sin marcar' }[e] || ''}` : ''}` }));
  }
  return hh('div', { class: 'hb-heat' }, celdas);
}
function numeros(ctx, d, h) {
  const { h: hh } = ctx;
  const sem = h.frecuencia?.tipo === 'semana';
  return hh('div', { class: 'hb-stats' },
    hh('div', {}, hh('b', {}, String(d.racha(h))), hh('small', {}, sem ? 'semanas seguidas' : 'racha actual')),
    hh('div', {}, hh('b', {}, String(d.mejorRacha(h))), hh('small', {}, 'mejor racha')),
    hh('div', {}, hh('b', {}, `${Math.round(d.cumplido(h) * 100)}%`), hh('small', {}, 'cumplido')));
}

// Carrusel de estadísticas (deslizar o flechas).
let slideEst = 0;
function carrusel(ctx, d, { compacto = false } = {}) {
  const { h: hh } = ctx;
  const lista = d.estadisticas();
  if (!lista.length) return hh('section', { class: 'tarjeta hb-card' }, hh('p', { class: 'nota' }, 'Elegí en Configurar qué hábitos mostrar en Estadísticas.'));
  slideEst = Math.min(slideEst, lista.length - 1);
  const pista = hh('div', { class: 'hb-pista' }, lista.map(h => hh('div', { class: 'hb-slide' },
    hh('h3', {}, h.nombre, hh('small', {}, ' · últimos 6 meses')), mapaCalor(ctx, d, h), numeros(ctx, d, h))));
  const puntos = hh('span', { class: 'hb-puntos' });
  const ir = (i) => {
    slideEst = Math.max(0, Math.min(lista.length - 1, i));
    pista.style.transform = `translateX(-${slideEst * 100}%)`;
    poner(puntos, lista.map((_, k) => hh('i', { class: k === slideEst ? 'on' : '' })));
    texto.textContent = `${slideEst + 1} de ${lista.length}`;
  };
  const texto = hh('small', { class: 'nota' });
  const vent = hh('div', { class: 'hb-carr' }, pista);
  let x0 = null;
  vent.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  vent.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) ir(slideEst + (dx < 0 ? 1 : -1)); });
  const caja = hh('section', { class: `tarjeta hb-card${compacto ? ' compacto' : ''}` }, vent,
    lista.length > 1 ? hh('div', { class: 'hb-carr-nav' },
      hh('button', { type: 'button', class: 'hb-flecha', 'aria-label': 'Anterior', onclick: () => ir(slideEst - 1) }, ic('izq')), puntos,
      hh('button', { type: 'button', class: 'hb-flecha', 'aria-label': 'Siguiente', onclick: () => ir(slideEst + 1) }, ic('flecha'))) : null,
    lista.length > 1 ? texto : null);
  ir(slideEst);
  return caja;
}

// ── Metas ──
const NOMBRE_FUENTE = { manual: 'A mano', hitos: 'Hitos', habito: 'Hábito', bitacora: 'Bitácora', finanzas: 'Finanzas', tareas: 'Tareas' };
async function tarjetaMeta(ctx, m, d, meta, { compacta = false } = {}) {
  const { h: hh } = ctx;
  const p = await progresoMeta(ctx, d, meta);
  const pct = p.objetivo ? Math.min(1, p.valor / p.objetivo) : 0;
  const f = meta.fuente || { tipo: 'manual' };
  const fechaTxt = meta.fechaLimite ? (() => { const x = deISO(meta.fechaLimite); return `hasta el ${x.getDate()} ${MESES[x.getMonth()].slice(0, 3)}${x.getFullYear() !== new Date().getFullYear() ? ` ${x.getFullYear()}` : ''}`; })() : 'sin fecha';
  const r = ritmo(meta, p);
  const ajustar = async (n) => { await m.guardarMeta(meta.id, { valorManual: Math.max(0, (Number(meta.valorManual) || 0) + n) }); };
  return hh('div', { class: 'hb-meta' },
    hh('div', { class: 'hb-meta-top' }, hh('b', {}, meta.nombre), hh('small', {}, fechaTxt),
      compacta ? null : hh('button', { type: 'button', class: 'hb-mini-b', 'aria-label': 'Opciones de la meta', onclick: () => menuMeta(ctx, m, d, meta) }, ic('puntos'))),
    hh('span', { class: 'hb-barra' }, hh('i', { style: `width:${pct * 100}%` })),
    hh('div', { class: 'hb-meta-pie' },
      hh('span', {}, `${p.texto} · ${Math.round(pct * 100)}%`),
      hh('span', { class: `hb-fuente f-${f.tipo}` }, f.etiqueta || NOMBRE_FUENTE[f.tipo] || 'A mano'),
      (meta.habitos || []).map(id => d.habito(id)).filter(Boolean).map(h => hh('span', { class: 'hb-fuente f-habito' }, ic('repetir'), h.nombre)),
      f.tipo === 'manual' && !compacta ? hh('span', { class: 'hb-mas1' },
        hh('button', { type: 'button', onclick: () => ajustar(-1), 'aria-label': 'Restar uno' }, '−1'),
        hh('button', { type: 'button', onclick: () => ajustar(1), 'aria-label': 'Sumar uno' }, '+1')) : null),
    f.tipo === 'hitos' && !compacta ? hh('div', { class: 'hb-hitos' }, (meta.hitos || []).map(x => hh('label', { class: x.hecho ? 'ok' : '' },
      hh('input', { type: 'checkbox', checked: !!x.hecho, onchange: (e) => m.guardarMeta(meta.id, { hitos: meta.hitos.map(y => (y.id === x.id ? { ...y, hecho: e.target.checked } : y)) }) }), ` ${x.texto}`))) : null,
    r ? hh('small', { class: 'hb-ritmo' }, r) : null);
}
async function menuMeta(ctx, m, d, meta) {
  const { h: hh, icono } = ctx;
  const dlg = hh('dialog', { class: 'hoja' },
    hh('header', { class: 'hoja-cabecera' }, hh('h2', {}, meta.nombre), hh('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
    hh('div', { class: 'hb-menu' },
      hh('button', { type: 'button', onclick: () => { dlg.close(); formMeta(ctx, m, d, meta); } }, 'Editar'),
      meta.fuente?.tipo === 'manual' ? hh('button', { type: 'button', onclick: async () => { dlg.close(); const r = await ctx.formulario({ titulo: 'Cuánto llevás', campos: [{ id: 'v', etiqueta: meta.unidad || 'Valor', tipo: 'numero' }] }, { v: meta.valorManual || 0 }); if (r) await m.guardarMeta(meta.id, { valorManual: Number(r.v) || 0 }); } }, 'Cambiar cuánto llevo') : null,
      hh('button', { type: 'button', onclick: async () => { dlg.close(); await m.guardarMeta(meta.id, { archivada: true }); ctx.aviso('Meta archivada'); } }, 'Archivar'),
      hh('button', { type: 'button', class: 'peligro', onclick: async () => { dlg.close(); if (await ctx.confirmar(`¿Borrar la meta "${meta.nombre}"?`, { si: 'Borrar', peligro: true })) await m.borrarMeta(meta.id); } }, 'Borrar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

// Formulario de meta (nueva o editar), con de dónde saca su número.
async function formMeta(ctx, m, d, meta = null) {
  const { h: hh, icono } = ctx;
  const f0 = meta?.fuente || { tipo: 'manual' };
  const est = { tipo: f0.tipo, ...f0 };
  const nombre = hh('input', { type: 'text', value: meta?.nombre || '', placeholder: 'Ej: Leer 24 libros en 2026' });
  const limite = hh('input', { type: 'date', value: meta?.fechaLimite || `${new Date().getFullYear()}-12-31` });
  const objetivo = hh('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: meta?.objetivo ?? '' });
  const unidad = hh('input', { type: 'text', value: meta?.unidad || '', placeholder: 'libros, km, $…' });
  const hitos = hh('textarea', { rows: 5, placeholder: 'Un hito por línea' }, (meta?.hitos || []).map(x => x.texto).join('\n'));
  const zonaFuente = hh('div', { class: 'hb-regla' });
  const zonaObj = hh('div', { class: 'hb-dos' }, hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Objetivo'), objetivo), hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Unidad'), unidad));
  const prueba = hh('small', { class: 'hb-prueba' });
  const elegirHabitos = hh('div', { class: 'hb-checks' }, d.habitos.map(h => hh('label', {}, hh('input', { type: 'checkbox', value: h.id, checked: (meta?.habitos || []).includes(h.id) }), ` ${h.nombre}`)));
  const opciones = hh('div', { class: 'hb-fuentes' });

  // Listas que dan los otros módulos (si no están, esa opción no se ofrece).
  const pedirSeguro = async (accion, datos = {}) => { try { return await ctx.pedir(accion, datos); } catch { return null; } };
  const [carpetas, finanzas, proyectos] = await Promise.all([pedirSeguro('metas-carpetas'), pedirSeguro('metas-cuentas'), pedirSeguro('metas-proyectos')]);
  const FUENTES = [
    ['manual', 'A mano', 'Botón +1'], ['hitos', 'Hitos', 'Pasos a tildar'],
    d.habitos.length ? ['habito', 'Hábito', 'Veces o cantidad'] : null,
    carpetas ? ['bitacora', 'Bitácora', 'Notas que cumplen algo'] : null,
    finanzas ? ['finanzas', 'Finanzas', 'Saldo o total'] : null,
    proyectos ? ['tareas', 'Tareas', 'Tareas de un proyecto'] : null,
  ].filter(Boolean);

  const sel = (valor, ops, alCambiar, vacio = null) => {
    const s = hh('select', {}, vacio ? hh('option', { value: '' }, vacio) : null, ops.map(([v, t]) => hh('option', { value: v, selected: String(v) === String(valor ?? '') }, t)));
    s.addEventListener('change', () => { alCambiar(s.value); pintarFuente(); });
    return s;
  };
  const periodo = () => hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Cuenta desde'),
    sel(est.periodo || 'meta', [['meta', 'Que creo la meta'], ['anio', 'El 1° de enero de este año']], v => { est.periodo = v; }));

  function pintarFuente() {
    poner(opciones, FUENTES.map(([v, t, s]) => hh('button', { type: 'button', class: `hb-op${est.tipo === v ? ' sel' : ''}`, onclick: () => { est.tipo = v; pintarFuente(); } }, hh('b', {}, t), hh('small', {}, s))));
    const filas = [];
    zonaObj.hidden = ['hitos', 'tareas'].includes(est.tipo);
    if (est.tipo === 'hitos') filas.push(hitos);
    if (est.tipo === 'habito') {
      filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Hábito'), sel(est.habitoId, d.habitos.map(h => [h.id, h.nombre]), v => { est.habitoId = v; }, 'Elegí un hábito')));
      filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Contar'), sel(est.modo || 'veces', [['veces', 'Cada vez que lo hice (✓)'], ['cantidad', 'La cantidad que cargué']], v => { est.modo = v; })));
      filas.push(periodo());
    }
    if (est.tipo === 'bitacora') {
      const c = (carpetas || []).find(x => x.id === est.carpetaId);
      const condCampos = (c?.campos || []).filter(x => x.tipo === 'opcion' || x.tipo === 'opciones' || x.tipo === 'sino');
      const numCampos = (c?.campos || []).filter(x => x.tipo === 'numero' || x.tipo === 'calificacion' || x.tipo === 'progreso');
      const fechaCampos = (c?.campos || []).filter(x => x.tipo === 'fecha');
      const campoCond = condCampos.find(x => x.id === est.campoId);
      filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Contar notas de la carpeta'), sel(est.carpetaId, (carpetas || []).map(x => [x.id, x.nombre]), v => { est.carpetaId = v; est.campoId = ''; est.valor = ''; est.sumarId = ''; }, 'Elegí una carpeta')));
      if (c) {
        filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Cuáles notas'), sel(est.campoId, condCampos.map(x => [x.id, `Según "${x.nombre}"`]), v => { est.campoId = v; est.valor = ''; }, 'Todas las notas')));
        if (campoCond) filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, `"${campoCond.nombre}" tiene que ser`), sel(est.valor, campoCond.tipo === 'sino' ? [['si', 'Sí'], ['no', 'No']] : (campoCond.opciones || []).map(o => [o.id, o.nombre]), v => { est.valor = v; }, 'Elegí')));
        filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Qué suma'), sel(est.sumarId, numCampos.map(x => [x.id, `La suma de "${x.nombre}"`]), v => { est.sumarId = v; }, 'Cada nota suma 1')));
        filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Según la fecha'), sel(est.fechaSegun || (c.fechas?.[0]?.[0] || 'modificado'), [...(c.fechas || []), ['modificado', 'En que se editó por última vez'], ['creado', 'En que se creó'], ...fechaCampos.map(x => [x.id, `Del campo "${x.nombre}"`])], v => { est.fechaSegun = v; })));
        filas.push(periodo());
        filas.push(hh('small', { class: 'nota' }, 'Sirve para cualquier carpeta: libros leídos, películas vistas, alumnos aprobados, procedimientos revisados…'));
      }
    }
    if (est.tipo === 'finanzas') {
      filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Tomar'), sel(est.medida || 'saldo', [['saldo', 'El saldo de una cuenta'], ['gastado', 'Lo gastado en una categoría'], ['ingresado', 'Lo ingresado en una categoría']], v => { est.medida = v; est.id = ''; })));
      const l = (est.medida || 'saldo') === 'saldo' ? finanzas.cuentas : finanzas.categorias;
      filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, (est.medida || 'saldo') === 'saldo' ? 'Cuenta' : 'Categoría'), sel(est.id, l.map(x => [x.id, x.nombre]), v => { est.id = v; }, 'Elegí')));
      if ((est.medida || 'saldo') !== 'saldo') filas.push(periodo());
      if (est.medida === 'gastado') filas.push(hh('small', { class: 'nota' }, 'Para "gastar menos de…": la meta se cumple mientras te mantengas por debajo del objetivo.'));
    }
    if (est.tipo === 'tareas') {
      filas.push(hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Proyecto'), sel(est.proyectoId, proyectos.map(x => [x.id, x.nombre]), v => { est.proyectoId = v; }, 'Elegí un proyecto')));
      filas.push(hh('small', { class: 'nota' }, 'Avanza con las tareas hechas del proyecto, sobre el total.'));
    }
    if (est.tipo === 'manual') filas.push(hh('small', { class: 'nota' }, 'Avanza con los botones +1 y −1 de la meta.'));
    poner(zonaFuente, filas, prueba);
    probar();
  }
  let esperaPrueba = null;
  function fuenteArmada() {
    const f = { tipo: est.tipo };
    const etiquetas = {
      habito: () => `Hábito ${d.habito(est.habitoId)?.nombre || ''}${est.modo === 'cantidad' ? ' · cantidad' : ' · cada ✓'}`,
      bitacora: () => { const c = (carpetas || []).find(x => x.id === est.carpetaId); const cc = c?.campos.find(x => x.id === est.campoId); const v = cc ? (cc.tipo === 'sino' ? (est.valor === 'si' ? 'Sí' : 'No') : cc.opciones?.find(o => o.id === est.valor)?.nombre) : ''; return `Bitácora › ${c?.nombre || ''}${cc && v ? ` · ${cc.nombre} = ${v}` : ''}`; },
      finanzas: () => { const l = (est.medida || 'saldo') === 'saldo' ? finanzas.cuentas : finanzas.categorias; return `Finanzas › ${(est.medida || 'saldo') === 'saldo' ? 'saldo de' : est.medida === 'gastado' ? 'gastado en' : 'ingresado en'} ${l.find(x => x.id === est.id)?.nombre || ''}`; },
      tareas: () => `Tareas › ${proyectos?.find(x => x.id === est.proyectoId)?.nombre || ''}`,
    };
    if (est.tipo === 'habito') Object.assign(f, { habitoId: est.habitoId || '', modo: est.modo || 'veces', periodo: est.periodo || 'meta' });
    if (est.tipo === 'bitacora') {
      const c = (carpetas || []).find(x => x.id === est.carpetaId);
      Object.assign(f, { carpetaId: est.carpetaId || '', campoId: est.campoId || '', valor: est.valor || '', sumarId: est.sumarId || '', fechaSegun: est.fechaSegun || (c?.fechas?.[0]?.[0] || 'modificado'), periodo: est.periodo || 'meta' });
    }
    if (est.tipo === 'finanzas') Object.assign(f, { medida: est.medida || 'saldo', id: est.id || '', periodo: est.periodo || 'meta' });
    if (est.tipo === 'tareas') Object.assign(f, { proyectoId: est.proyectoId || '' });
    if (etiquetas[est.tipo]) f.etiqueta = etiquetas[est.tipo]();
    return f;
  }
  function armar() {
    const lineas = hitos.value.split('\n').map(x => x.trim()).filter(Boolean);
    const viejos = meta?.hitos || [];
    return {
      nombre: nombre.value.trim(), fechaLimite: limite.value, objetivo: Number(objetivo.value) || 0, unidad: unidad.value.trim(),
      fuente: fuenteArmada(),
      hitos: lineas.map((t, i) => ({ id: viejos.find(v => v.texto === t)?.id || `h${Date.now().toString(36)}${i}`, texto: t, hecho: !!viejos.find(v => v.texto === t)?.hecho })),
      habitos: [...elegirHabitos.querySelectorAll('input:checked')].map(x => x.value),
    };
  }
  function probar() {
    clearTimeout(esperaPrueba);
    esperaPrueba = setTimeout(async () => {
      const datos = armar();
      if (datos.fuente.tipo === 'manual') { prueba.textContent = ''; return; }
      const p = await progresoMeta(ctx, d, { ...meta, ...datos, desde: meta?.desde || hoyISO() });
      prueba.textContent = `Hoy da: ${p.texto}`;
    }, 250);
  }
  for (const el of [objetivo, unidad, hitos]) el.addEventListener('input', probar);

  const error = hh('p', { class: 'formulario-error', role: 'alert' });
  const dlg = hh('dialog', { class: 'hoja hb-hoja hb-hoja-meta' },
    hh('form', { class: 'formulario', method: 'dialog', novalidate: true },
      hh('header', { class: 'hoja-cabecera' }, hh('h2', {}, meta ? 'Editar meta' : 'Nueva meta'), hh('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      hh('div', { class: 'formulario-campos' },
        hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Nombre'), nombre),
        hh('div', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, '¿Cómo avanza?'), opciones),
        zonaFuente,
        zonaObj,
        hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Fecha límite'), limite),
        d.habitos.length ? hh('details', { class: 'hb-det' }, hh('summary', {}, 'Hábitos asociados (opcional)'), elegirHabitos) : null),
      error,
      hh('div', { class: 'hoja-botones' },
        hh('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        hh('button', { type: 'submit', class: 'boton principal' }, meta ? 'Guardar' : 'Crear meta'))));
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = armar();
    if (!datos.nombre) { error.textContent = 'Poné un nombre.'; return; }
    if (datos.fuente.tipo === 'hitos' && !datos.hitos.length) { error.textContent = 'Escribí al menos un hito.'; return; }
    if (!['hitos', 'tareas'].includes(datos.fuente.tipo) && !datos.objetivo) { error.textContent = 'Poné un objetivo.'; return; }
    if (datos.fuente.tipo === 'habito' && !datos.fuente.habitoId) { error.textContent = 'Elegí el hábito.'; return; }
    if (datos.fuente.tipo === 'bitacora' && !datos.fuente.carpetaId) { error.textContent = 'Elegí la carpeta.'; return; }
    if (datos.fuente.tipo === 'finanzas' && !datos.fuente.id) { error.textContent = 'Elegí la cuenta o categoría.'; return; }
    if (datos.fuente.tipo === 'tareas' && !datos.fuente.proyectoId) { error.textContent = 'Elegí el proyecto.'; return; }
    if (meta) await m.guardarMeta(meta.id, datos); else await m.crearMeta(datos);
    dlg.close();
    ctx.aviso(meta ? 'Meta guardada' : 'Meta creada');
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  pintarFuente();
  dlg.showModal();
  nombre.focus();
}

// ── Formulario de hábito ──
export function formHabito(ctx, m, h = null) {
  const { h: hh, icono } = ctx;
  const est = {
    tipo: h?.tipo || 'si', frec: h?.frecuencia?.tipo || 'diario', dias: new Set(h?.frecuencia?.dias || [1, 2, 3, 4, 5]),
    momento: h?.momento || 'manana',
  };
  const nombre = hh('input', { type: 'text', value: h?.nombre || '', placeholder: 'Ej: Leer 20 minutos', autocomplete: 'off' });
  const objetivo = hh('input', { type: 'number', min: 1, step: 1, inputmode: 'numeric', value: h?.objetivo || 8 });
  const unidad = hh('input', { type: 'text', value: h?.unidad || '', placeholder: 'vasos, páginas, km…' });
  const veces = hh('input', { type: 'number', min: 1, max: 7, step: 1, inputmode: 'numeric', value: h?.frecuencia?.veces || 3 });
  const desde = hh('input', { type: 'date', value: h?.desde || hoyISO() });
  const enEst = hh('input', { type: 'checkbox', checked: h ? h.enEstadisticas !== false : true });
  const zona = hh('div', { class: 'formulario-campos' });
  const seg = (valor, ops, alElegir) => hh('span', { class: 'hb-seg' }, ops.map(([v, t]) => hh('button', { type: 'button', class: v === valor ? 'sel' : '', onclick: () => { alElegir(v); pintar(); } }, t)));
  function pintar() {
    poner(zona,
      hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Nombre'), nombre),
      hh('div', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Tipo'),
        seg(est.tipo, [['si', 'Sí / No'], ['cant', 'Cantidad'], ['evitar', 'Evitar']], v => { est.tipo = v; }),
        hh('small', { class: 'nota' }, { si: 'Lo hiciste o no (leer, entrenar).', cant: 'Llegar a una cantidad por día (8 vasos de agua).', evitar: 'Algo que querés dejar: cada día que lo cumplís suma (sin pantallas, sin azúcar).' }[est.tipo])),
      est.tipo === 'cant' ? hh('div', { class: 'hb-dos' }, hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Objetivo por día'), objetivo), hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Unidad'), unidad)) : null,
      hh('div', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Frecuencia'),
        seg(est.frec, [['diario', 'Todos los días'], ['dias', 'Días elegidos'], ['semana', 'Veces por semana']], v => { est.frec = v; })),
      est.frec === 'dias' ? hh('span', { class: 'hb-dias' }, [1, 2, 3, 4, 5, 6, 0].map(n => hh('button', { type: 'button', class: est.dias.has(n) ? 'sel' : '', onclick: () => { if (est.dias.has(n)) est.dias.delete(n); else est.dias.add(n); pintar(); } }, DN[n]))) : null,
      est.frec === 'semana' ? hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Veces por semana'), veces) : null,
      hh('div', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Momento del día'), seg(est.momento, [['manana', 'Mañana'], ['tarde', 'Tarde'], ['noche', 'Noche']], v => { est.momento = v; })),
      hh('label', { class: 'fila-campo' }, hh('span', { class: 'etiqueta-campo' }, 'Empieza el'), desde),
      hh('label', { class: 'hb-check-l' }, enEst, ' Mostrar en Estadísticas'));
  }
  const error = hh('p', { class: 'formulario-error', role: 'alert' });
  const dlg = hh('dialog', { class: 'hoja hb-hoja' },
    hh('form', { class: 'formulario', method: 'dialog', novalidate: true },
      hh('header', { class: 'hoja-cabecera' }, hh('h2', {}, h ? 'Editar hábito' : 'Nuevo hábito'), hh('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      zona, error,
      hh('div', { class: 'hoja-botones' },
        hh('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        hh('button', { type: 'submit', class: 'boton principal' }, h ? 'Guardar' : 'Crear hábito'))));
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!nombre.value.trim()) { error.textContent = 'Poné un nombre.'; return; }
    if (est.frec === 'dias' && !est.dias.size) { error.textContent = 'Elegí al menos un día.'; return; }
    const datos = {
      nombre: nombre.value.trim(), tipo: est.tipo,
      objetivo: est.tipo === 'cant' ? Math.max(1, Number(objetivo.value) || 1) : null, unidad: est.tipo === 'cant' ? unidad.value.trim() : '',
      frecuencia: est.frec === 'dias' ? { tipo: 'dias', dias: [...est.dias] } : est.frec === 'semana' ? { tipo: 'semana', veces: Math.max(1, Math.min(7, Number(veces.value) || 1)) } : { tipo: 'diario' },
      momento: est.momento, desde: desde.value || hoyISO(), enEstadisticas: enEst.checked,
    };
    if (h) await m.guardarHabito(h.id, datos); else await m.crearHabito(datos);
    dlg.close();
    ctx.aviso(h ? 'Hábito guardado' : `Hábito creado: ${datos.nombre}`);
  });
  dlg.addEventListener('close', () => { dlg.remove(); if (/\/nuevo$/.test(location.hash)) history.replaceState(null, '', location.hash.replace(/\/nuevo$/, '')); });
  document.body.append(dlg);
  pintar();
  dlg.showModal();
  nombre.focus();
}

// ── Pantalla del módulo ──
export async function pantallaHabitos(contenedor, ctx, sub = []) {
  cargarEstilos();
  const { h: hh, icono } = ctx;
  const m = crearModelo(ctx);
  const pestana = sub[0] === 'lista' || sub[0] === 'h' ? 'lista' : sub[0] === 'metas' ? 'metas' : sub[0] === 'est' ? 'est' : sub[0] === 'config' ? 'config' : 'hoy';
  const cuerpo = hh('div', { class: 'hb-cuerpo' });
  const tab = (id, texto, ruta) => hh('a', { href: `#/habitos${ruta}`, class: pestana === id ? 'sel' : '' }, texto);
  contenedor.replaceChildren(hh('div', { class: 'hb' },
    hh('header', { class: 'hb-cab' },
      hh('div', { class: 'hb-titulos' }, hh('h1', {}, 'Hábitos y metas'), hh('p', { class: 'nota' }, 'Lo que hacés todos los días y hacia dónde vas.')),
      hh('div', { class: 'hb-der' },
        hh('nav', { class: 'hb-pest' }, tab('hoy', 'Hoy', ''), tab('lista', 'Hábitos', '/lista'), tab('metas', 'Metas', '/metas'), tab('est', 'Estadísticas', '/est')),
        hh('a', { href: '#/habitos/config', class: `boton-icono${pestana === 'config' ? ' activo' : ''}`, 'aria-label': 'Configurar', title: 'Configurar' }, ic('ajustes')))),
    cuerpo));

  let turno = 0, yaAbrioNuevo = false;
  async function pintar() {
    const mio = ++turno;
    const d = await m.cargar();
    if (mio !== turno) return;
    const enfocado = document.activeElement;
    if (cuerpo.contains(enfocado) && /^(INPUT|TEXTAREA|SELECT)$/.test(enfocado.tagName)) return;

    if (pestana === 'hoy') {
      const metas = await Promise.all(d.metas.slice(0, 4).map(x => tarjetaMeta(ctx, m, d, x, { compacta: true })));
      if (mio !== turno) return;
      poner(cuerpo, hh('div', { class: 'hb-cols' },
        hh('div', { class: 'hb-col' }, cuadroHoy(ctx, m, d)),
        hh('div', { class: 'hb-col' },
          hh('section', { class: 'tarjeta hb-card' }, hh('h3', {}, ic('meta'), 'Metas', hh('a', { href: '#/habitos/metas', class: 'hb-link' }, d.metas.length ? 'Ver todas ›' : '+ Nueva meta')),
            metas.length ? metas : hh('p', { class: 'nota' }, 'Sin metas todavía.')),
          d.habitos.length ? carrusel(ctx, d, { compacto: true }) : null)));
      return;
    }

    if (pestana === 'lista' && sub[0] === 'h' && sub[1]) { pintarDetalle(d, sub[1]); return; }

    if (pestana === 'lista') {
      const fila = (h, i) => hh('div', { class: 'hb-lfila' },
        hh('a', { href: `#/habitos/h/${h.id}`, class: 'hb-lnom' }, hh('b', {}, h.nombre),
          hh('small', {}, [{ si: 'Sí / No', cant: `Cantidad · ${h.objetivo || 1} ${h.unidad || ''}`, evitar: 'Evitar' }[h.tipo || 'si'], textoFrecuencia(h) || 'Todos los días', MOMENTOS.find(x => x[0] === (h.momento || 'manana'))[1]].join(' · '))),
        hh('span', { class: 'hb-racha' }, ic('fuego'), String(d.racha(h))),
        hh('span', { class: 'hb-flechas' },
          hh('button', { type: 'button', 'aria-label': 'Subir', disabled: i === 0, onclick: () => mover(d, i, -1) }, '↑'),
          hh('button', { type: 'button', 'aria-label': 'Bajar', disabled: i === d.habitos.length - 1, onclick: () => mover(d, i, 1) }, '↓')));
      poner(cuerpo, hh('section', { class: 'tarjeta hb-card hb-ancho' },
        hh('h3', {}, 'Tus hábitos', hh('button', { type: 'button', class: 'hb-link', onclick: () => formHabito(ctx, m) }, '+ Nuevo hábito')),
        d.habitos.length ? d.habitos.map(fila) : hh('p', { class: 'nota' }, 'Todavía no tenés hábitos.'),
        d.archivados.length ? hh('details', { class: 'hb-det' }, hh('summary', {}, `Archivados (${d.archivados.length})`),
          d.archivados.map(h => hh('div', { class: 'hb-lfila' }, hh('span', { class: 'hb-lnom' }, h.nombre),
            hh('button', { type: 'button', class: 'boton chico', onclick: () => m.guardarHabito(h.id, { archivado: false }) }, 'Volver a activar')))) : null));
      if (sub[1] === 'nuevo' && !yaAbrioNuevo) { yaAbrioNuevo = true; formHabito(ctx, m); }
      return;
    }

    if (pestana === 'metas') {
      const tarjetas = await Promise.all(d.metas.map(x => tarjetaMeta(ctx, m, d, x)));
      if (mio !== turno) return;
      poner(cuerpo, hh('section', { class: 'tarjeta hb-card hb-ancho' },
        hh('h3', {}, ic('meta'), 'Metas', hh('button', { type: 'button', class: 'hb-link', onclick: () => formMeta(ctx, m, d) }, '+ Nueva meta')),
        tarjetas.length ? tarjetas : hh('p', { class: 'nota' }, 'Una meta tiene fecha y un número a alcanzar. Puede avanzar a mano, con hitos, con un hábito, o leyendo la Bitácora, Finanzas o Tareas.')));
      return;
    }

    if (pestana === 'est') { poner(cuerpo, hh('div', { class: 'hb-ancho' }, d.habitos.length ? carrusel(ctx, d) : hh('p', { class: 'nota' }, 'Todavía no tenés hábitos.'))); return; }

    if (pestana === 'config') {
      const c = d.cfg;
      const guardar = (cambios) => m.guardarAjustes(d, cambios);
      const dias = hh('input', { type: 'number', min: 1, max: 30, inputmode: 'numeric', class: 'hb-num', value: c.diasAtras, 'aria-label': 'Días para marcar un pendiente' });
      dias.addEventListener('change', () => guardar({ diasAtras: Math.max(1, Math.min(30, Number(dias.value) || 7)) }));
      const nDesc = hh('input', { type: 'number', min: 1, max: 31, inputmode: 'numeric', class: 'hb-num', value: c.descansosMes, 'aria-label': 'Descansos por mes' });
      nDesc.addEventListener('change', () => guardar({ descansosMes: Math.max(1, Number(nDesc.value) || 2) }));
      const lista = [...d.habitos].sort((a, b) => (a.ordenEst ?? a.orden ?? 0) - (b.ordenEst ?? b.orden ?? 0));
      const moverEst = async (i, dlt) => { const j = i + dlt; if (j < 0 || j >= lista.length) return; [lista[i], lista[j]] = [lista[j], lista[i]]; for (const [k, h] of lista.entries()) await m.guardarHabito(h.id, { ordenEst: k }); };
      const llave = (on, alTocar, etiqueta) => hh('button', { type: 'button', role: 'switch', class: `aj-switch${on ? ' on' : ''}`, 'aria-checked': String(on), 'aria-label': etiqueta, onclick: alTocar });
      // Una opción: título y explicación a la izquierda, el control a la derecha (o abajo si es ancho).
      const opcion = (titulo, texto, control, { abajo = false } = {}) => hh('div', { class: `hb-cf${abajo ? ' abajo' : ''}` },
        hh('div', { class: 'hb-cf-txt' }, hh('b', {}, titulo), hh('small', {}, texto)),
        hh('div', { class: 'hb-cf-ctrl' }, control));
      poner(cuerpo, hh('div', { class: 'hb-cols' },
        hh('section', { class: 'tarjeta hb-card' }, hh('h3', {}, 'Configurar'),
          opcion('Días para marcar un pendiente', 'Pasado ese tiempo sin marcar, el día cuenta como no hecho.', hh('span', { class: 'hb-cf-num' }, dias, 'días')),
          opcion('Descansos', 'No cuentan como hechos, pero no cortan la racha.', [
            hh('span', { class: 'hb-seg' }, [['limite', 'Con límite'], ['libre', 'Sin límite'], ['off', 'Apagados']].map(([v, t]) => hh('button', { type: 'button', class: c.descansos === v ? 'sel' : '', onclick: () => guardar({ descansos: v }) }, t))),
            c.descansos === 'limite' ? hh('span', { class: 'hb-cf-num' }, nDesc, 'por mes') : null], { abajo: true }),
          opcion('Agrupar lo ya marcado', 'En Hoy, lo que ya marcaste se junta en una línea "N completados".', llave(c.agruparHechos !== false, () => guardar({ agruparHechos: c.agruparHechos === false }), 'Agrupar lo ya marcado'))),
        hh('section', { class: 'tarjeta hb-card' }, hh('h3', {}, 'Hábitos en Estadísticas'),
          hh('p', { class: 'nota hb-cf-nota' }, 'Cuáles aparecen y en qué orden.'),
          lista.length ? lista.map((h, i) => hh('div', { class: 'hb-cf hb-cf-hab' },
            hh('div', { class: 'hb-cf-txt' }, hh('b', {}, h.nombre)),
            hh('div', { class: 'hb-cf-ctrl' },
              hh('span', { class: 'hb-flechas' },
                hh('button', { type: 'button', 'aria-label': 'Subir', disabled: i === 0, onclick: () => moverEst(i, -1) }, '↑'),
                hh('button', { type: 'button', 'aria-label': 'Bajar', disabled: i === lista.length - 1, onclick: () => moverEst(i, 1) }, '↓')),
              llave(h.enEstadisticas !== false, () => m.guardarHabito(h.id, { enEstadisticas: h.enEstadisticas === false }), `Mostrar ${h.nombre}`)))) : hh('p', { class: 'nota' }, 'Todavía no tenés hábitos.'))));
    }
  }

  async function mover(d, i, dlt) {
    const l = [...d.habitos]; const j = i + dlt;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    for (const [k, h] of l.entries()) if (h.orden !== k) await m.guardarHabito(h.id, { orden: k });
  }

  // Detalle de un hábito: números, mapa e historial para corregir.
  let mesDet = null, diaSel = null;
  function pintarDetalle(d, id) {
    const h = d.habito(id);
    if (!h) { poner(cuerpo, hh('p', { class: 'nota' }, 'Ese hábito ya no existe.'), hh('a', { href: '#/habitos/lista', class: 'boton' }, 'Volver')); return; }
    const hoy = hoyISO();
    if (!mesDet) mesDet = hoy.slice(0, 7);
    const [a, mm] = mesDet.split('-').map(Number);
    const primero = new Date(a, mm - 1, 1);
    const corr = (primero.getDay() + 6) % 7;
    const ndias = new Date(a, mm, 0).getDate();
    const celdas = [];
    for (let i = 0; i < corr; i++) celdas.push(hh('span'));
    for (let n = 1; n <= ndias; n++) {
      const f = aISO(new Date(a, mm - 1, n));
      const e = f > hoy || f < (h.desde || hoy) ? 'fuera' : d.estadoEfectivo(h, f);
      celdas.push(hh('button', {
        type: 'button', class: `hb-dia-c e-${e}${f === hoy ? ' hoy' : ''}${f === diaSel ? ' sel' : ''}`, disabled: e === 'fuera',
        title: f, onclick: () => { diaSel = diaSel === f ? null : f; pintarDetalle(d, id); },
      }, String(n)));
    }
    const corregir = async (estado) => {
      const f = diaSel; diaSel = null;
      if (estado === 'cant') {
        const r = await ctx.formulario({ titulo: `${h.nombre} · ${cuandoLargo(f)}`, campos: [{ id: 'v', etiqueta: `Cantidad (${h.unidad || 'objetivo ' + (h.objetivo || 1)})`, tipo: 'numero' }] }, { v: d.valor(h, f) });
        if (r) await m.marcar(h, f, Number(r.v) >= (Number(h.objetivo) || 1) ? 's' : '', Number(r.v) || 0);
        return;
      }
      if (estado === 'd' && d.cfg.descansos === 'limite' && d.descansosRestantes(f) <= 0 && d.estado(h, f) !== 'd') { ctx.aviso('No te quedan descansos ese mes.'); return; }
      await m.marcar(h, f, estado, h.tipo === 'cant' && estado === 's' ? Math.max(Number(h.objetivo) || 1, d.valor(h, f)) : undefined);
      ctx.aviso(`${cuando(f)} corregido`);
    };
    const mover = (n) => { const x = new Date(a, mm - 1 + n, 1); mesDet = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; diaSel = null; pintarDetalle(d, id); };
    poner(cuerpo, hh('div', { class: 'hb-cols' },
      hh('div', { class: 'hb-col' },
        hh('section', { class: 'tarjeta hb-card' },
          hh('a', { href: '#/habitos/lista', class: 'hb-volver' }, '‹ Hábitos'),
          hh('h2', { class: 'hb-det-tit' }, h.nombre),
          hh('p', { class: 'nota' }, [{ si: 'Sí / No', cant: `Cantidad · ${h.objetivo || 1} ${h.unidad || ''} por día`, evitar: 'Evitar' }[h.tipo || 'si'], textoFrecuencia(h) || 'Todos los días', MOMENTOS.find(x => x[0] === (h.momento || 'manana'))[1]].join(' · ')),
          numeros(ctx, d, h),
          hh('div', { class: 'hb-botones' },
            hh('button', { type: 'button', class: 'boton', onclick: () => formHabito(ctx, m, h) }, 'Editar'),
            hh('button', { type: 'button', class: 'boton', onclick: async () => { if (await ctx.confirmar(`¿Archivar "${h.nombre}"? Deja de aparecer, pero se guarda su historial.`, { si: 'Archivar' })) { await m.archivarHabito(h.id); ctx.navegar('habitos/lista'); } } }, 'Archivar'),
            hh('button', { type: 'button', class: 'boton peligro', onclick: async () => { if (await ctx.confirmar(`¿Borrar "${h.nombre}" y todo su historial?`, { si: 'Borrar', peligro: true })) { await m.borrarHabito(h.id); ctx.navegar('habitos/lista'); } } }, 'Borrar'))),
        hh('section', { class: 'tarjeta hb-card' }, hh('h3', {}, 'Últimos 6 meses'), mapaCalor(ctx, d, h))),
      hh('div', { class: 'hb-col' },
        hh('section', { class: 'tarjeta hb-card' },
          hh('div', { class: 'hb-mes-cab' },
            hh('button', { type: 'button', class: 'hb-flecha', 'aria-label': 'Mes anterior', onclick: () => mover(-1) }, ic('izq')),
            hh('b', {}, `${MESES[mm - 1][0].toUpperCase()}${MESES[mm - 1].slice(1)} ${a}`),
            hh('button', { type: 'button', class: 'hb-flecha', 'aria-label': 'Mes siguiente', disabled: mesDet >= hoy.slice(0, 7), onclick: () => mover(1) }, ic('flecha'))),
          hh('div', { class: 'hb-ley' }, hh('span', {}, hh('i', { class: 'e-s' }), 'Hecho'), hh('span', {}, hh('i', { class: 'e-x' }), 'No'), hh('span', {}, hh('i', { class: 'e-d' }), 'Descanso'), hh('span', {}, hh('i', { class: 'e-p' }), 'Sin marcar')),
          hh('div', { class: 'hb-mes' }, ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => hh('span', { class: 'hb-dn' }, x)), celdas),
          diaSel ? hh('div', { class: 'hb-corregir' }, hh('b', {}, `${cuando(diaSel)}:`),
            h.tipo === 'cant' ? hh('button', { type: 'button', onclick: () => corregir('cant') }, 'Cantidad…') : null,
            hh('button', { type: 'button', class: 'si', onclick: () => corregir('s') }, '✓ Hecho'),
            hh('button', { type: 'button', class: 'no', onclick: () => corregir('x') }, '✗ No'),
            d.cfg.descansos !== 'off' ? hh('button', { type: 'button', class: 'de', onclick: () => corregir('d') }, 'Descanso') : null,
            hh('button', { type: 'button', onclick: () => corregir(null) }, 'Sin marcar'))
            : hh('small', { class: 'nota' }, 'Tocá un día para corregirlo. Es el único lugar donde se cambia algo ya marcado.')))));
  }

  let espera = null;
  const repintar = () => { clearTimeout(espera); espera = setTimeout(pintar, 80); };
  const quitas = [ctx.alCambiarDatos(repintar),
    // Las metas leen números de otros módulos: si cambian, se recalculan.
    ...(pestana === 'metas' || pestana === 'hoy' ? ['bitacora', 'finanzas', 'tareas'].map(x => ctx.alCambiarDatosDe(x, repintar)) : [])];
  const quitar = () => quitas.forEach(q => q?.());
  // A medianoche cambia "hoy".
  let dia = hoyISO();
  const reloj = setInterval(() => { if (hoyISO() !== dia) { dia = hoyISO(); pintar(); } }, 60_000);
  await pintar();
  return () => { quitar(); clearInterval(reloj); clearTimeout(espera); };
}
