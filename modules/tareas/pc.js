// ─────────────────────────────────────────────────────────────
// Tareas en la PC: pantallas con tarjetas que llenan la pantalla.
//
//   Resumen (#/tareas)        tablero: números, estado del mes, lo próximo,
//                             tu día (reloj), avance por área, cuándo
//                             terminás (mapa de calor) y registro.
//   Hoy                       por momento del día + cómo vas, por área y lo que viene.
//   Próximos                  por día + programadas.
//   Bandeja                   cuánto hace que está cada cosa y "Ordenar de a una".
//   Cada área                 General, proyectos plegables, Programadas y Hechas hoy;
//                             al costado: cómo vas, proyectos y hechas (4 formas).
//   Mis filtros               un filtro guardado junta tareas de todas las áreas.
//
// Filtros: el botón de abajo de la columna abre un panel (fecha, hora, área,
// proyecto, etiquetas, estado, cómo es, duración, antigüedad, texto) que se
// aplica a la lista que estás viendo; se puede guardar con nombre.
//
// El celular sigue con las pantallas de vistas.js (no cambia nada ahí).
// Todo se copió de la maqueta aprobada (vistas-previas/tareas-tablero.html):
// filas compactas (círculo, título, área abajo y un tag a la derecha),
// mismas tarjetas, textos y separaciones. Tocar una fila abre el detalle al costado.
// ─────────────────────────────────────────────────────────────

import { hoy, sumarDias, diasEntre, hecha, vencida, deHoy, programada, ordenar, ordenarManual, textoFecha, textoRepeticion } from './modelo.js';
import { pedirNombre } from './editor.js';

// ── Estado de pantalla (dura mientras la app está abierta) ──
let FILT = {};                          // filtro que se está aplicando ahora
const VER = { hoyArea: '', proy: {}, ordenFecha: false, hechas: 'semana', registro: 'todas', semana: 0 };

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const horaAhora = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };
const isoDe = (ms) => { const f = new Date(ms); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
// Cada vez que se completó (las que se repiten guardan todas sus veces).
const vecesHecha = (t) => [...(t.completadas || []), ...(t.completada ? [Number(t.completada) || Date.parse(t.completada)] : [])].filter(Boolean);
const hechaHace = (t, dias) => { const desde = sumarDias(hoy(), -dias); return vecesHecha(t).some(ms => isoDe(ms) >= desde); };
const textoHace = (n) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`);

// ─────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────

const FN = {
  fecha: { venc: 'Vencidas', hoy: 'Hoy', man: 'Mañana', semana: 'Esta semana', '7d': 'Próximos 7 días', mes: 'Este mes', sin: 'Sin fecha', rango: 'Entre fechas' },
  hora: { con: 'Con hora', sin: 'Sin hora', maniana: 'A la mañana', tarde: 'A la tarde', noche: 'A la noche' },
  estado: { pend: 'Solo pendientes', todas: 'Pendientes y hechas', hhoy: 'Hechas hoy', hsem: 'Hechas esta semana', hmes: 'Hechas este mes' },
  como: { repite: 'Se repite', una: 'Una vez', sub: 'Con subtareas', rec: 'Con recordatorio', nota: 'Con nota o archivo', orig: 'De Finanzas o Bitácora' },
  dur: { corta: 'Cortas (menos de 15 min)', media: 'Medias (15 a 60 min)', larga: 'Largas (más de 1 h)' },
  antig: { 7: 'Creadas hace +7 días', 30: 'Creadas hace +30 días', post: 'Pasadas a mañana 3+ veces' },
};
const momento = (hora) => (!hora ? '' : hora < '13:00' ? 'maniana' : hora < '19:00' ? 'tarde' : 'noche');

export function filtroActivo(F = FILT) {
  return Object.entries(F).some(([k, v]) => !['etiqModo', 'desde', 'hasta'].includes(k) && (Array.isArray(v) ? v.length : v));
}

// Los filtros guardados antes (texto, área, proyecto, fecha) se leen con el mismo motor.
export function filtroDe(f) {
  if (f.nuevo) return f.nuevo;
  const F = {};
  if (f.fecha) F.fecha = { vencidas: 'venc', hoy: 'hoy', semana: '7d', 'sin-fecha': 'sin' }[f.fecha] || '';
  if (f.areaId) F.area = [f.areaId];
  if (f.proyectoId) F.proy = [f.proyectoId];
  if (f.texto) F.texto = f.texto;
  if (f.incluirHechas) F.estado = 'todas';
  return F;
}

// ¿La tarea pasa el filtro? (las hechas solo si el estado lo pide)
function pasa(t, d, F = FILT) {
  const e = F.estado || '';
  if (hecha(t)) {
    if (!e || e === 'pend') return false;
    if (e === 'hhoy' && !hechaHace(t, 0)) return false;
    if (e === 'hsem' && !hechaHace(t, 6)) return false;
    if (e === 'hmes' && !hechaHace(t, 30)) return false;
  } else if (e.startsWith('h')) return false;
  const f = t.fecha || '';
  switch (F.fecha) {
    case 'venc': if (!vencida(t)) return false; break;
    case 'hoy': if (f !== hoy()) return false; break;
    case 'man': if (f !== sumarDias(hoy(), 1)) return false; break;
    case 'semana': { const dom = sumarDias(hoy(), (7 - new Date().getDay()) % 7); if (!f || f < hoy() || f > dom) return false; break; }
    case '7d': if (!f || f <= hoy() || f > sumarDias(hoy(), 7)) return false; break;
    case 'mes': if (!f || f.slice(0, 7) !== hoy().slice(0, 7)) return false; break;
    case 'sin': if (f) return false; break;
    case 'rango': if (!f || (F.desde && f < F.desde) || (F.hasta && f > F.hasta)) return false; break;
    default: break;
  }
  if (F.hora === 'con' && !t.hora) return false;
  if (F.hora === 'sin' && t.hora) return false;
  if (['maniana', 'tarde', 'noche'].includes(F.hora) && momento(t.hora) !== F.hora) return false;
  if (F.area?.length && !F.area.includes(t.areaId || '_bandeja')) return false;
  if (F.proy?.length) {
    const clave = programada(t) ? '_prog' : t.proyectoId || '_general';
    if (!F.proy.includes(clave)) return false;
  }
  if (F.etiq?.length) {
    const tiene = F.etiq.filter(x => (t.etiquetas || []).includes(x)).length;
    if (F.etiqModo === 'todas' ? tiene < F.etiq.length : !tiene) return false;
  }
  const C = F.como || [];
  if (C.includes('repite') && !t.repeticion?.tipo) return false;
  if (C.includes('una') && t.repeticion?.tipo) return false;
  if (C.includes('sub') && !(d.hijas?.(t.id) || []).length) return false;
  if (C.includes('rec') && !t.recordatorio) return false;
  if (C.includes('nota') && !t.notas && !(t.adjuntos || []).length) return false;
  if (C.includes('orig') && !['finanzas', 'bitacora'].includes(t.origen?.modulo)) return false;
  const dur = Number(t.duracion) || 0;
  if (F.dur === 'corta' && !(dur && dur < 15)) return false;
  if (F.dur === 'media' && !(dur >= 15 && dur <= 60)) return false;
  if (F.dur === 'larga' && !(dur > 60)) return false;
  const edad = t.creado ? Math.floor((Date.now() - t.creado) / 86_400_000) : 0;
  if (F.antig === '7' && edad <= 7) return false;
  if (F.antig === '30' && edad <= 30) return false;
  if (F.antig === 'post' && (t.postergada || 0) < 3) return false;
  if (F.texto) {
    const txt = `${t.titulo} ${t.notas || ''} ${(t.etiquetas || []).map(x => `#${x}`).join(' ')}`.toLowerCase();
    if (!String(F.texto).toLowerCase().split(/\s+/).filter(Boolean).every(p => txt.includes(p))) return false;
  }
  return true;
}

// Las tareas que cumplen un filtro (lo usa también el celular para los filtros nuevos).
export const filtrarTareas = (d, tareas, F) => tareas.filter(t => pasa(t, d, F));

// Cuántas tareas pendientes cumple un filtro guardado (el número de la columna).
export function cuantasCumplen(d, F) {
  return d.tareas.filter(t => !d.enOculto?.(t) && (!t.padreId || !d.tarea(t.padreId)) && pasa(t, d, F)).length;
}

// Texto de cada filtro puesto (para los chips con ×).
function chipsDe(F, d) {
  const r = [];
  for (const k of ['fecha', 'hora', 'estado', 'dur', 'antig']) {
    if (!F[k]) continue;
    r.push([k, k === 'fecha' && F[k] === 'rango' ? `Del ${F.desde || '…'} al ${F.hasta || '…'}` : FN[k][F[k]]]);
  }
  for (const v of F.area || []) r.push([`area:${v}`, v === '_bandeja' ? 'Bandeja' : d.area(v)?.nombre || 'Área']);
  for (const v of F.proy || []) r.push([`proy:${v}`, v === '_general' ? 'General' : v === '_prog' ? 'Programadas' : d.proyecto(v)?.nombre || 'Proyecto']);
  for (const v of F.etiq || []) r.push([`etiq:${v}`, `#${v}${F.etiqModo === 'todas' && F.etiq.length > 1 ? ' (todas)' : ''}`]);
  for (const v of F.como || []) r.push([`como:${v}`, FN.como[v]]);
  if (F.texto) r.push(['texto', `“${F.texto}”`]);
  return r;
}

function sacarFiltro(clave) {
  if (clave === 'todo') { FILT = {}; return; }
  const [k, ...resto] = clave.split(':');
  if (resto.length) { const v = resto.join(':'); FILT[k] = (FILT[k] || []).filter(x => x !== v); return; }
  delete FILT[k];
  if (k === 'fecha') { delete FILT.desde; delete FILT.hasta; }
}

// ─────────────────────────────────────────────────────────────
// Pantallas (copiadas de la maqueta aprobada, tareas-tablero.html)
// ─────────────────────────────────────────────────────────────

const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaDe = (iso) => new Date(`${iso}T12:00`);
// Color de cada área, en el orden de la columna (como la maqueta: Personal verde, Muchtek azul, Familia amarillo, U762 rojo).
const COLORES = ['v', 'z', 'a', 'r'];
// "3 h 15", "1 h", "45 min"
const duracionCorta = (min) => { min = Math.round(Number(min) || 0); if (!min) return ''; const hh = Math.floor(min / 60), mm = min % 60; return hh ? (mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`) : `${mm} min`; };
const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function crearPC(E) {
  const { ctx, h, m, ic } = E;
  let d = E.d;
  let ultimaVista = '';          // para animar la entrada solo al cambiar de pantalla

  // ── Piezas (mismas clases que la maqueta, con prefijo tp-) ──
  const card = ({ c, r, titulo, sub = '', link = null, cuerpo, extra = null, clase = '' }) =>
    h('section', { class: `tp-card ${clase}`.trim(), style: `grid-column: span ${c}; grid-row: span ${r}` },
      h('div', { class: 'tp-kcab' }, h('div', {}, h('b', {}, titulo), sub ? h('small', {}, sub) : null), link),
      extra,
      h('div', { class: 'tp-cuerpo' }, cuerpo));
  const grid = (cards) => {
    const clave = `${E.vista()}:${E.id()}`;
    const g = h('div', { class: `tp-bento${clave !== ultimaVista ? ' entra' : ' quieto'}` }, cards);
    // Al redibujar la misma pantalla, la tarjeta que está bajo el mouse no hace la animación de "levantarse" (se veía como un salto).
    if (clave === ultimaVista) requestAnimationFrame(() => requestAnimationFrame(() => g.classList.remove('quieto')));
    ultimaVista = clave;
    return g;
  };
  const tag = (texto, color = 'g') => (texto ? h('span', { class: `tp-tag ${color}` }, texto) : null);
  const enlace = (texto, href) => h('a', { class: 'tp-a', href }, texto);
  const boton = (texto, alTocar, titulo = '') => h('button', { type: 'button', class: 'tp-a', title: titulo || null, onclick: alTocar }, texto);
  const vacio = (titulo, texto) => h('div', { class: 'tp-vacio' }, h('div', {}, h('b', {}, titulo), texto || ''));
  const mini = (texto) => h('div', { class: 'tp-mini' }, texto);
  const anillo = (hechas, total) => {
    const R = 20, C = 2 * Math.PI * R, p = total ? hechas / total : 0;
    const s = h('span', { class: 'tp-anillo' });
    s.innerHTML = `<svg width="54" height="54" viewBox="0 0 52 52"><circle cx="26" cy="26" r="${R}" fill="none" stroke="var(--tp-sup2)" stroke-width="6"/><circle cx="26" cy="26" r="${R}" fill="none" stroke="var(--tp-verde)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/><text x="26" y="30" text-anchor="middle" font-family="Barlow Condensed" font-size="13" font-weight="600" fill="var(--tp-texto)">${hechas}/${total}</text></svg>`;
    return s;
  };
  // Fila de datos de "Cómo vas": título chico, número, aclaración.
  const cv = (antes, items) => h('div', { class: 'tp-cv' }, antes, items.map(([lab, val, pie]) => h('div', {}, h('small', {}, lab), h('b', {}, val), h('i', {}, pie || ''))));
  // Título de grupo como "A LA MAÑANA". Con clave se pliega (y se recuerda).
  const sec = (texto, color = '') => h('div', { class: `tp-sec${color ? ` ${color}` : ''}` }, texto);
  const grupo = (clave, titulo, n, contenido, color = '') => {
    const pleg = E.plegado(clave);
    const cuerpo = h('div', { class: `tp-pcuerpo tp-gcuerpo${pleg ? ' plegado' : ''}` }, contenido);
    const cab = h('button', {
      type: 'button', class: `tp-gsec${pleg ? ' plegado' : ''}${color ? ` ${color}` : ''}`, 'aria-expanded': String(!pleg),
      onclick: () => { const p = !cab.classList.contains('plegado'); cab.classList.toggle('plegado', p); cuerpo.classList.toggle('plegado', p); cab.setAttribute('aria-expanded', String(!p)); E.plegar(clave); },
    }, h('span', {}, `${titulo.toUpperCase()} · ${n}`), ic('flecha'));
    return [cab, cuerpo];
  };

  // ── Datos comunes ──
  const sueltaPorFecha = (t) => { const madre = d.padre(t); return !madre || hecha(madre) || !madre.fecha || madre.fecha !== t.fecha; };
  const porFecha = (ts) => ts.filter(sueltaPorFecha);
  const principales = (ts) => ts.filter(t => !t.padreId || !d.tarea(t.padreId));
  const pendientes = () => d.tareas.filter(t => !hecha(t) && !d.enOculto?.(t));
  const areasActivas = () => d.areas.filter(a => !a.archivada && !a.sistema);
  const proyectosDe = (areaId) => d.proyectos.filter(p => p.areaId === areaId && !p.archivado);
  const msHecha = (t) => Number(t.completada) || Date.parse(t.completada) || 0;
  // Las que se repiten no se cierran (pasan a la próxima fecha): si la última vez
  // fue hoy, se muestra una copia tildada en su fecha de antes, para ver lo hecho.
  const repeHoy = (t) => {
    const ult = (t.completadas || []).at(-1);
    if (hecha(t) || !t.repeticion?.tipo || !ult || isoDe(ult) !== hoy()) return null;
    const prev = (t.anteriores || []).at(-1);
    return { ...t, fecha: prev ? prev.fecha : hoy(), estado: 'hecha', completada: ult, copiaRepe: true, repeHoy: !!prev };
  };
  const hechasHoy = () => [
    ...d.tareas.filter(t => hecha(t) && t.completada && isoDe(msHecha(t)) === hoy()),
    ...d.tareas.map(repeHoy).filter(Boolean),
  ];
  const nombreArea = (t) => d.area(t.areaId)?.nombre || 'Bandeja';
  const nombreLugar = (t) => d.proyecto(t.proyectoId)?.nombre || nombreArea(t);
  const colorDe = (areaId) => { const i = areasActivas().findIndex(a => a.id === areaId); return i < 0 ? 'g' : COLORES[i % COLORES.length]; };
  const conFiltro = (ts) => (filtroActivo() ? ts.filter(t => pasa(t, d)) : ts);

  // Cuándo es la tarea, como en la maqueta: "hace 3 días", "ayer", "hoy 14:00", "lun 09:00", "2 dic".
  function cuando(t, { enHoy = false } = {}) {
    if (hecha(t)) { const n = diasEntre(isoDe(msHecha(t)), hoy()); return n <= 0 ? ['hoy', 'v'] : [textoHace(n), 'g']; }
    if (!t.fecha) return null;
    const n = diasEntre(hoy(), t.fecha);
    if (n < 0) return [textoHace(-n), 'r'];
    if (n === 0) return enHoy ? (t.hora ? [t.hora, 'a'] : null) : [t.hora ? `hoy ${t.hora}` : 'hoy', 'a'];
    const f = fechaDe(t.fecha);
    const dia = n < 7 ? DIAS_C[f.getDay()] : `${f.getDate()} ${MES_C[f.getMonth()]}`;
    return [t.hora ? `${dia} ${t.hora}` : dia, n === 1 ? 'z' : 'g'];
  }
  // Aclaración de la fila: área, cuántos ítems tiene y si se repite.
  function aclaracion(t, conArea = true) {
    const partes = conArea ? [nombreArea(t)] : [];
    const subs = d.hijas?.(t.id) || [];
    if (subs.length) partes.push(`${subs.length} ítem${subs.length === 1 ? '' : 's'} · ${subs.filter(hecha).length} hecho${subs.filter(hecha).length === 1 ? '' : 's'}`);
    if (t.repeticion?.tipo) partes.push(`se repite ${textoRepeticion(t.repeticion).toLowerCase()}`);
    return partes.join(' · ');
  }

  // ── Fila de tarea: círculo, título con aclaración abajo y un tag a la derecha ──
  const recienHechas = new Set();   // brillo de la que acaba de llegar a otro grupo
  function fila(t, { sub = null, etiqueta = undefined, enHoy = false, arrastrable = false } = {}) {
    const esHecha = hecha(t);
    const real = t.copiaRepe ? (d.tarea(t.id) || t) : t;
    const tg = etiqueta !== undefined ? etiqueta : cuando(t, { enHoy });
    const ck = t.aviso ? h('span', { class: 'tp-ck aviso', title: 'Aviso: no hay que completarlo' }) : h('button', {
      type: 'button', class: 'tp-ck', 'aria-label': esHecha ? `Reabrir "${t.titulo}"` : `Completar "${t.titulo}"`,
      onclick: (e) => { e.stopPropagation(); tildar(t, el); },
    });
    const el = h('div', {
      class: `tp-f tp-t${esHecha ? ' hecha' : ''}`, 'data-id': t.id, tabindex: '0', role: 'button', draggable: arrastrable ? 'true' : null,
      // La copia tildada de una repetida abre la tarea de verdad.
      onclick: () => E.abrir(real), onkeydown: (e) => { if (e.key === 'Enter' && e.target === el) E.abrir(real); },
    }, ck, h('span', { class: 'tp-tx' }, t.titulo, sub ? h('small', {}, sub) : null), Array.isArray(tg) ? tag(tg[0], tg[1]) : tg);
    if (arrastrable) el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-tarea', t.id); e.dataTransfer.effectAllowed = 'move'; });
    if (recienHechas.has(t.id)) { el.classList.add('llega'); setTimeout(() => recienHechas.delete(t.id), 1500); }
    return el;
  }
  // Al tildar: se marca, se va con animación y recién ahí se guarda (así se ve el movimiento).
  async function tildar(t, el) {
    const vuelve = hecha(t);
    el.classList.toggle('hecha', !vuelve);
    el.querySelector('.tp-ck')?.setAttribute('disabled', '');
    recienHechas.add(t.id);
    await new Promise(r => setTimeout(r, 260));
    el.style.maxHeight = `${el.offsetHeight}px`;
    el.classList.add('saliendo');
    await new Promise(r => setTimeout(r, 300));
    const r = await E.completar(t);
    if (r === false) { el.classList.remove('saliendo'); el.classList.toggle('hecha', vuelve); el.style.maxHeight = ''; el.querySelector('.tp-ck')?.removeAttribute('disabled'); recienHechas.delete(t.id); }
  }

  // ── Agregar tarea: caja con "#área · 18:00" a la derecha. Entiende #área, #proyecto, #etiqueta y una hora. ──
  function interpretar(texto, base) {
    const datos = { ...base };
    let titulo = ` ${texto} `;
    const mh = titulo.match(/\s(\d{1,2})(?::(\d{2})|\s?h(?:s)?)(?=\s)/i);
    if (mh && Number(mh[1]) < 24 && Number(mh[2] || 0) < 60) {
      datos.hora = `${mh[1].padStart(2, '0')}:${mh[2] || '00'}`;
      if (!datos.fecha) datos.fecha = hoy();
      titulo = titulo.replace(mh[0], ' ');
    }
    const etiquetas = [];
    titulo = titulo.replace(/\s#([\p{L}\p{N}_-]+)/gu, (_, palabra) => {
      const p = normal(palabra);
      const area = areasActivas().find(a => normal(a.nombre).replace(/\s+/g, '') === p);
      const proy = !area && d.proyectos.find(x => !x.archivado && normal(x.nombre).replace(/\s+/g, '') === p);
      if (area) { datos.areaId = area.id; if (datos.proyectoId && d.proyecto(datos.proyectoId)?.areaId !== area.id) datos.proyectoId = ''; }
      else if (proy) { datos.proyectoId = proy.id; datos.areaId = proy.areaId; }
      else etiquetas.push(palabra.toLowerCase());
      return ' ';
    });
    if (etiquetas.length) datos.etiquetas = [...new Set([...(datos.etiquetas || []), ...etiquetas])];
    datos.titulo = titulo.replace(/\s+/g, ' ').trim();
    return datos;
  }
  function agregar(base, ayuda) {
    const campo = h('input', { type: 'text', placeholder: ayuda, 'aria-label': 'Agregar tarea', autocomplete: 'off', enterkeyhint: 'done' });
    campo.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || !campo.value.trim()) return;
      e.preventDefault();
      const datos = interpretar(campo.value.trim(), base);
      if (!datos.titulo) return;
      campo.value = '';
      await m.crearTarea(datos);
      ctx.aviso(`Tarea creada: "${datos.titulo}"`);
      setTimeout(() => document.querySelector('.tp-qadd input')?.focus(), 150);
    });
    return h('label', { class: 'tp-campo tp-qadd' }, ic('mas'), campo, h('span', { class: 'tp-mini' }, '#área · 18:00'));
  }
  const herr = (...cosas) => h('div', { class: 'tp-aherr' }, cosas);
  const btn = (texto, alTocar, { icono = '', clase = '', titulo = '' } = {}) => h('button', { type: 'button', class: `tp-btn ${clase}`.trim(), title: titulo || null, onclick: alTocar }, icono ? ic(icono) : null, texto);

  // Chips del filtro puesto, arriba de la lista.
  function chipsFiltro() {
    const c = chipsDe(FILT, d);
    if (!c.length) return null;
    return h('div', { class: 'tp-chips tp-fchips' },
      c.map(([k, t]) => h('button', { type: 'button', class: 'tp-chip on', onclick: () => { sacarFiltro(k); E.redibujar(); pintarFiltros(); } }, `${t} `, h('b', {}, '×'))),
      h('button', { type: 'button', class: 'tp-chip', onclick: () => { FILT = {}; E.redibujar(); pintarFiltros(); } }, 'Sacar filtros'));
  }

  // ─────────────────────────────────────────────────────────────
  // Hoy
  // ─────────────────────────────────────────────────────────────
  function vistaHoy() {
    const ahora = horaAhora();
    const delArea = (t) => !VER.hoyArea || (t.areaId || '_bandeja') === VER.hoyArea;
    const pend = conFiltro(pendientes()).filter(delArea);
    // Las que tienen hora y ya se pasó, bajan solas a Vencidas.
    const pasadas = porFecha(pend.filter(t => deHoy(t) && t.hora && t.hora < ahora));
    const venc = [...porFecha(ordenar(pend.filter(vencida))), ...ordenar(pasadas)];
    const deHoyL = porFecha(ordenar(pend.filter(t => deHoy(t) && !(t.hora && t.hora < ahora))));
    const hechas = porFecha(hechasHoy().filter(delArea));
    // Sin hora: grupo "HOY" (cuando quieras en el día). Con hora: por momento del día.
    const en = (mom) => deHoyL.filter(t => momento(t.hora) === mom);
    const total = venc.length + deHoyL.length + hechas.length;
    const f = new Date();
    const nArea = VER.hoyArea === '_bandeja' ? 'Bandeja' : d.area(VER.hoyArea)?.nombre;
    const titulo = VER.hoyArea ? `Hoy en ${nArea}` : `Hoy, ${DIAS[f.getDay()]} ${f.getDate()}`;
    const filaV = (t) => fila(t, { sub: aclaracion(t), etiqueta: [t.fecha < hoy() ? textoHace(diasEntre(t.fecha, hoy())) : t.hora, 'r'] });
    const filaH = (t) => fila(t, { sub: aclaracion(t), enHoy: true });
    const momentos = [['', 'HOY'], ['maniana', 'A LA MAÑANA'], ['tarde', 'A LA TARDE'], ['noche', 'A LA NOCHE']];
    const lista = [
      venc.length ? [sec(`VENCIDAS · ${venc.length}`, 'r'), venc.map(filaV)] : null,
      momentos.map(([k, t]) => (en(k).length ? [sec(t), en(k).map(filaH)] : null)),
      hechas.length && !filtroActivo() ? [sec(`HECHAS HOY · ${hechas.length}`, 'v'), hechas.map(t => fila(t, { sub: nombreArea(t), etiqueta: null }))] : null,
      !venc.length && !deHoyL.length ? vacio(`Nada para hoy${VER.hoyArea ? ` en ${nArea}` : ''}`, filtroActivo() ? 'Probá sacando algún filtro' : 'Disfrutá el día 🎉') : null,
    ];

    // Cómo vas hoy
    const queda = deHoyL.reduce((s, t) => s + (Number(t.duracion) || 0), 0);
    const prox = deHoyL.find(t => t.hora && t.hora >= ahora);
    const vieja = ordenar(pend.filter(vencida))[0];
    const pend2 = total - hechas.length;
    const como = cv(anillo(hechas.length, Math.max(total, 1)), [
      ['Hecho', `${total ? Math.round(hechas.length / total * 100) : 0} %`, `te queda${pend2 === 1 ? '' : 'n'} ${pend2} tarea${pend2 === 1 ? '' : 's'}`],
      ['Te queda', queda ? duracionCorta(queda) : '—', queda ? 'tiempo estimado' : 'sin duración cargada'],
      ['Próxima con hora', prox ? prox.hora : '—', prox ? prox.titulo : 'nada con hora'],
      ['Vencida más vieja', vieja ? `${diasEntre(vieja.fecha, hoy())} día${diasEntre(vieja.fecha, hoy()) === 1 ? '' : 's'}` : '—', vieja ? vieja.titulo : 'al día'],
    ]);

    // Por área: tocar una filtra todo; "Ver todas ×" lo saca.
    const todasP = pendientes();
    const filaArea = (id, nombre, icono, siempre = true) => {
      const v = todasP.filter(t => (t.areaId || '_bandeja') === id && vencida(t)).length;
      const hy = todasP.filter(t => (t.areaId || '_bandeja') === id && deHoy(t)).length;
      if (!siempre && !v && !hy) return null;
      return h('div', { class: `tp-f tp-area-f${VER.hoyArea === id ? ' sel' : ''}`, role: 'button', tabindex: '0', onclick: () => { VER.hoyArea = VER.hoyArea === id ? '' : id; E.redibujar(); pintarFiltros(); } },
        ic(icono), h('span', { class: 'tp-tx' }, nombre), tag(v ? `${v} vencida${v > 1 ? 's' : ''}` : '', 'r'), tag(hy ? `${hy} hoy` : '', 'a'), !v && !hy ? tag('al día', 'v') : null);
    };
    const porArea = [...areasActivas().map(a => filaArea(a.id, a.nombre, a.icono || 'carpeta')), filaArea('_bandeja', 'Bandeja', 'bandeja', false)];

    // Lo que viene
    const vienen = porFecha(ordenar(pend.filter(t => t.fecha > hoy()))).slice(0, 10);

    return grid([
      card({ c: 8, r: 8, titulo, sub: VER.hoyArea ? `Solo las tareas de ${nArea}` : 'Por momento del día', clase: 'tp-lista',
        extra: [agregar({ fecha: hoy(), ...(VER.hoyArea && VER.hoyArea !== '_bandeja' ? { areaId: VER.hoyArea } : {}) }, 'Agregar una tarea para hoy… (Enter)'), chipsFiltro()], cuerpo: lista }),
      card({ c: 4, r: 1, titulo: VER.hoyArea ? `Cómo vas en ${nArea}` : 'Cómo vas hoy', cuerpo: como, clase: 'tp-cvc tp-comp' }),
      card({ c: 4, r: 2, titulo: 'Por área', sub: VER.hoyArea ? `Mostrando solo ${nArea}` : 'Tocá una para ver solo esas', clase: 'tp-comp',
        link: VER.hoyArea ? boton('Ver todas ×', () => { VER.hoyArea = ''; E.redibujar(); pintarFiltros(); }) : null, cuerpo: porArea }),
      card({ c: 4, r: 5, titulo: 'Lo que viene', sub: VER.hoyArea ? `En ${nArea}` : 'Para que no te agarre de sorpresa', link: enlace('Próximos →', '#/tareas/proximos'),
        cuerpo: vienen.length ? vienen.map(t => fila(t, { sub: aclaracion(t) })) : mini('Nada en los próximos días.') }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Próximos: la semana en columnas (se arrastra de un día a otro) + sin fecha y atrasadas
  // ─────────────────────────────────────────────────────────────
  function vistaProximos() {
    const lunes = sumarDias(hoy(), -((new Date().getDay() + 6) % 7) + VER.semana * 7);
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
    const pend = conFiltro(pendientes());
    const delDia = (df) => [
      ...porFecha(ordenar(pend.filter(t => t.fecha === df && !(df < hoy())))),
      ...(df === hoy() ? hechasHoy() : d.tareas.filter(t => hecha(t) && t.completada && isoDe(msHecha(t)) === df)).filter(t => !t.padreId),
    ];
    const soltar = (df) => ({
      ondragover: (e) => { if (e.dataTransfer.types.includes('text/x-tarea')) { e.preventDefault(); e.currentTarget.classList.add('destino'); } },
      ondragleave: (e) => e.currentTarget.classList.remove('destino'),
      ondrop: async (e) => {
        e.preventDefault(); e.currentTarget.classList.remove('destino');
        const t = d.tarea(e.dataTransfer.getData('text/x-tarea'));
        if (!t || t.fecha === df) return;
        const antes = t.fecha || '';
        await m.cambiarFecha(t, df);
        ctx.aviso(`"${t.titulo}" pasó al ${DIAS[fechaDe(df).getDay()]} ${fechaDe(df).getDate()}`, { accion: 'Deshacer', alTocar: () => m.cambiarFecha({ ...t, fecha: df }, antes), duracion: 6000 });
      },
    });
    const semana = h('div', { class: 'tp-semana' }, dias.map(df => {
      const f = fechaDe(df);
      return h('div', { class: `tp-dia${df === hoy() ? ' hoy' : ''}${df < hoy() ? ' pas' : ''}`, ...soltar(df) },
        h('span', {}, DIAS_C[f.getDay()], h('b', {}, String(f.getDate()))),
        delDia(df).map(t => h('div', {
          class: `tp-ev ${colorDe(t.areaId)}${hecha(t) ? ' hecha' : ''}`, draggable: hecha(t) ? null : 'true', 'data-id': t.id, title: `${t.titulo}${t.hora ? ` · ${t.hora}` : ''}`,
          onclick: () => E.abrir(t), ondragstart: (e) => { e.dataTransfer.setData('text/x-tarea', t.id); e.dataTransfer.effectAllowed = 'move'; },
        }, t.hora ? h('i', {}, t.hora) : null, t.titulo)));
    }));
    const f1 = fechaDe(dias[0]), f7 = fechaDe(dias[6]);
    const rango = VER.semana === 0 ? 'Esta semana' : `${f1.getDate()} ${MES_C[f1.getMonth()]} al ${f7.getDate()} ${MES_C[f7.getMonth()]}`;
    const nav = h('span', { class: 'tp-a-g' },
      boton('‹ Semana anterior', () => { VER.semana--; E.redibujar(); }), ' · ',
      VER.semana ? [boton('Hoy', () => { VER.semana = 0; E.redibujar(); }), ' · '] : null,
      boton('Siguiente ›', () => { VER.semana++; E.redibujar(); }));
    // Sin fecha y atrasadas: vencidas + las sueltas de cada área que no tienen fecha.
    const atrasadas = porFecha(ordenar(pend.filter(vencida)));
    const sinFecha = principales(pend.filter(t => !t.fecha && t.areaId && !t.proyectoId));
    return grid([
      card({ c: 9, r: 8, titulo: VER.semana === 0 ? 'Semana' : `Semana · ${rango}`, sub: 'Arrastrá una tarea a otro día para moverla', link: nav, cuerpo: [chipsFiltro(), semana], clase: 'tp-lista' }),
      card({ c: 3, r: 8, titulo: 'Sin fecha y atrasadas', sub: 'Para ubicar en la semana',
        cuerpo: atrasadas.length || sinFecha.length ? [...atrasadas.map(t => fila(t, { sub: nombreArea(t), arrastrable: true })), ...sinFecha.map(t => fila(t, { sub: nombreArea(t), arrastrable: true }))] : mini('Nada sin ubicar. Vas bien.') }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Área
  // ─────────────────────────────────────────────────────────────
  function bloqueHechas(ts, proys) {
    const veces = ts.flatMap(t => vecesHecha(t).map(ms => ({ t, ms, dia: isoDe(ms) })));
    const modos = [['semana', 'Semana'], ['lista', 'Lista'], ['calendario', 'Calendario'], ['proyecto', 'Por proyecto']];
    const chips = h('div', { class: 'tp-chips tp-hchips' }, modos.map(([k, n]) => h('button', { type: 'button', class: `tp-chip${VER.hechas === k ? ' on' : ''}`, onclick: () => { VER.hechas = k; E.redibujar(); } }, n)));
    let cuerpo;
    if (VER.hechas === 'lista') {
      const ult = [...veces].sort((a, b) => b.ms - a.ms).slice(0, 25);
      cuerpo = ult.length ? ult.map(x => fila(x.t, { sub: d.proyecto(x.t.proyectoId)?.nombre || '', etiqueta: [textoHace(diasEntre(x.dia, hoy())), 'g'] })) : mini('Todavía no cerraste nada acá.');
      // Las que se repiten siguen pendientes: igual se ven tachadas (es una vez hecha).
      if (ult.length) for (const el of cuerpo) el.classList.add('hecha');
    } else if (VER.hechas === 'calendario') {
      // Últimas 8 semanas, un cuadrito por día (más claro = más hechas).
      const inicio = sumarDias(hoy(), -55 - ((new Date().getDay() + 6) % 7) + 6);
      const celdas = [];
      for (let i = 0; i < 56; i++) {
        const dia = sumarDias(inicio, i), n = veces.filter(x => x.dia === dia).length;
        celdas.push(h('i', { class: `h${Math.min(n, 4)}${dia > hoy() ? ' fut' : ''}`, title: `${textoFecha(dia)}: ${n} hecha${n === 1 ? '' : 's'}` }));
      }
      cuerpo = [h('div', { class: 'tp-hcal' }, celdas),
        h('div', { class: 'tp-leyenda' }, h('span', {}, 'Menos'), ['var(--tp-sup2)', '#2f4a3c', '#3f6e55', '#5a9a74', '#7fc79a'].map(c => h('i', { style: `background:${c}` })), h('span', {}, 'Más'))];
    } else if (VER.hechas === 'proyecto') {
      const filas = proys.map(p => {
        const del = ts.filter(t => t.proyectoId === p.id), hc = del.filter(hecha).length, tot = del.length;
        return h('div', { class: 'tp-f tp-col' }, h('span', { class: 'tp-tx' }, p.nombre), h('span', { class: 'tp-der' }, `${hc} de ${tot}`), h('div', { class: 'tp-barra' }, h('i', { class: 'v', style: `width:${tot ? Math.round(hc / tot * 100) : 0}%` })));
      });
      cuerpo = filas.length ? filas : mini('Sin proyectos.');
    } else {
      const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy(), i - 6));
      const ns = dias.map(df => veces.filter(x => x.dia === df).length), max = Math.max(1, ...ns);
      cuerpo = h('div', { class: 'tp-cols' }, dias.map((df, i) => h('div', { class: 'tp-co', title: `${textoFecha(df)}: ${ns[i]} hecha${ns[i] === 1 ? '' : 's'}` },
        h('i', { class: df === hoy() ? 'on' : '', style: `height:${Math.round(ns[i] / max * 85)}%;animation-delay:${i * 50}ms` }),
        h('small', {}, DIAS_C[fechaDe(df).getDay()].slice(0, 1).toUpperCase()))));
    }
    const sub = { semana: 'Cuántas cerraste cada día', lista: 'Las últimas, con su fecha', calendario: 'Últimas 8 semanas, un cuadrito por día', proyecto: 'Hechas sobre el total de cada proyecto' }[VER.hechas];
    return { sub, chips, cuerpo };
  }

  function vistaArea(id) {
    const a = d.area(id);
    if (!a) return null;
    const proys = proyectosDe(id);
    const pf = VER.proy[id] || '';
    const ord = (ts) => (VER.ordenFecha ? ordenar(ts) : ordenarManual(ts));
    const todas = principales(d.tareas.filter(t => t.areaId === id));
    const pend = todas.filter(t => !hecha(t));
    const general = conFiltro(pend.filter(t => !t.proyectoId));
    const prog = ordenar((d.programadas || []).filter(t => t.areaId === id && !t.padreId && (!filtroActivo() || pasa(t, d))));
    const hechasHoyA = hechasHoy().filter(t => t.areaId === id && !t.padreId);
    const filaA = (t) => fila(t);
    const lista = [];
    if (!pf && general.length) lista.push(grupo(`area:${id}:general`, 'General', general.length, ord(general).map(filaA)));
    for (const p of proys.filter(p => !pf || p.id === pf)) {
      const delP = todas.filter(t => t.proyectoId === p.id);
      const pp = conFiltro(delP.filter(t => !hecha(t)));
      const hc = delP.filter(hecha), recientes = filtroActivo() ? [] : hc.filter(t => hechaHace(t, 7));
      if (filtroActivo() && !pp.length) continue;
      const tot = delP.length, clave = `area:${id}:p:${p.id}`, pleg = !pf && E.plegado(clave);
      const cuerpoP = h('div', { class: `tp-pcuerpo${pleg ? ' plegado' : ''}` }, ord(pp).map(filaA), recientes.map(filaA), !pp.length && !recientes.length ? mini('Sin pendientes') : null);
      const cab = h('button', {
        type: 'button', class: `tp-pcab${pleg ? ' plegado' : ''}`, 'aria-expanded': String(!pleg),
        onclick: () => { const x = !cab.classList.contains('plegado'); cab.classList.toggle('plegado', x); cuerpoP.classList.toggle('plegado', x); cab.setAttribute('aria-expanded', String(!x)); E.plegar(clave); },
      }, ic('flecha'), h('b', {}, p.nombre), h('span', { class: 'tp-mini' }, `${pp.length} pendiente${pp.length === 1 ? '' : 's'}`),
      h('span', { class: 'tp-barra chica' }, h('i', { class: 'v', style: `width:${tot ? Math.round(hc.length / tot * 100) : 0}%` })));
      lista.push(cab, cuerpoP);
    }
    if (!pf && prog.length) lista.push(grupo(`area:${id}:prog`, 'Programadas', prog.length, prog.map(filaA)));
    if (!pf && hechasHoyA.length && !filtroActivo()) lista.push(grupo(`area:${id}:hechas`, 'Hechas hoy', hechasHoyA.length, hechasHoyA.map(filaA), 'v'));
    if (!lista.length) lista.push(vacio(filtroActivo() ? 'Nada con este filtro' : 'Nada pendiente', filtroActivo() ? 'Probá sacando algún filtro' : `Todo al día en ${a.nombre}`));

    const venc = ordenar(pend.filter(vencida));
    const delMes = todas.filter(t => hechaHace(t, 30));
    const prox = ordenar(pend.filter(t => t.fecha >= hoy()))[0];
    const como = cv(anillo(delMes.length, delMes.length + pend.length), [
      ['Pendientes', String(pend.length), `${proys.length} proyecto${proys.length === 1 ? '' : 's'}`],
      ['Vencidas', String(venc.length), venc[0] ? venc[0].titulo : 'al día'],
      ['Lo próximo', prox ? (cuando(prox)?.[0] || '—') : '—', prox ? prox.titulo : 'sin fechas'],
      ['Hechas', String(delMes.length), 'este mes'],
    ]);
    const filasProy = proys.length ? proys.map(p => {
      const pp = pend.filter(t => t.proyectoId === p.id), v = pp.some(vencida);
      return h('div', { class: `tp-f tp-area-f${pf === p.id ? ' sel' : ''}`, role: 'button', tabindex: '0', onclick: () => { VER.proy[id] = pf === p.id ? '' : p.id; E.redibujar(); } },
        ic(p.icono || 'carpeta'), h('span', { class: 'tp-tx' }, p.nombre), v ? tag('vencidas', 'r') : null, h('span', { class: 'tp-der' }, String(pp.length)));
    }) : mini('Todavía no hay proyectos. Tocá + para crear uno.');
    const nuevoProy = boton('+', async () => { const n = await pedirNombre(ctx, 'Nuevo proyecto', '', 'Crear proyecto'); if (n) { await m.crearProyecto(id, n); ctx.aviso(`Proyecto "${n}" creado`); } }, 'Nuevo proyecto');
    const hb = bloqueHechas(todas, proys);
    const pNombre = d.proyecto(pf)?.nombre;
    const base = { areaId: id, ...(pf ? { proyectoId: pf } : {}) };
    return grid([
      card({ c: 8, r: 8, titulo: pf ? `${a.nombre} › ${pNombre}` : a.nombre, clase: 'tp-lista',
        sub: pf ? `Solo el proyecto ${pNombre}` : `${pend.length} pendiente${pend.length === 1 ? '' : 's'}${venc.length ? ` · ${venc.length} vencida${venc.length > 1 ? 's' : ''}` : ''}`,
        link: boton('···', () => E.opcionesArea(a), 'Opciones del área'),
        extra: [herr(agregar(base, `Agregar una tarea en ${pNombre || a.nombre}… (Enter)`),
          btn(VER.ordenFecha ? 'Por fecha ✓' : 'Ordenar por fecha', () => { VER.ordenFecha = !VER.ordenFecha; E.redibujar(); }, { icono: 'semana', clase: VER.ordenFecha ? 'on' : '', titulo: 'Ordena por fecha dentro de cada grupo; los proyectos se mantienen' })), chipsFiltro()],
        cuerpo: lista }),
      card({ c: 4, r: 1, titulo: `Cómo vas en ${a.nombre}`, cuerpo: como, clase: 'tp-cvc tp-comp' }),
      card({ c: 4, r: 3, titulo: 'Proyectos', sub: pf ? `Mostrando solo ${pNombre}` : 'Tocá uno para ver solo ese', clase: 'tp-comp',
        link: pf ? boton('Ver todos ×', () => { VER.proy[id] = ''; E.redibujar(); }) : nuevoProy, cuerpo: filasProy }),
      card({ c: 4, r: 4, titulo: 'Hechas', sub: hb.sub, extra: hb.chips, cuerpo: hb.cuerpo }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Bandeja
  // ─────────────────────────────────────────────────────────────
  const edad = (t) => (t.creado ? Math.max(0, Math.floor((Date.now() - t.creado) / 86_400_000)) : 0);
  const DESDE = { finanzas: 'Finanzas', bitacora: 'Bitácora', widget: 'Widget', celular: 'Celular', pc: 'PC' };
  const desde = (t) => DESDE[t.origen?.modulo] || DESDE[t.desde] || '';
  // Sugerencia de área: la que tiene más tareas con palabras en común.
  function sugerirArea(t) {
    const palabras = (s) => normal(s).split(/[^a-z0-9ñ]+/).filter(p => p.length > 3);
    const mias = new Set(palabras(t.titulo));
    if (!mias.size) return null;
    let mejor = null, puntos = 0;
    for (const a of areasActivas()) {
      const p = d.tareas.filter(x => x.areaId === a.id).reduce((s, x) => s + palabras(x.titulo).filter(w => mias.has(w)).length, 0);
      if (p > puntos) { puntos = p; mejor = a; }
    }
    return mejor;
  }

  function vistaBandeja() {
    const items = principales(pendientes().filter(t => !t.areaId)).sort((a, b) => edad(b) - edad(a));
    const ver = conFiltro(items);
    const viejas = items.filter(t => edad(t) > 7);
    const ordenadas = d.tareas.filter(t => t.ordenadaBandeja && Date.now() - t.ordenadaBandeja < 7 * 86_400_000).sort((a, b) => b.ordenadaBandeja - a.ordenadaBandeja);
    const filaB = (t) => {
      const e = edad(t), sug = sugerirArea(t);
      const sub = [desde(t) ? `Desde: ${desde(t)}` : '', sug ? `¿Va en ${sug.nombre}?` : ''].filter(Boolean).join(' · ');
      return fila(t, { sub, etiqueta: [textoHace(e), e > 7 ? 'r' : 'g'] });
    };
    return grid([
      card({ c: 8, r: 8, titulo: 'Bandeja', sub: `${items.length} para ordenar${viejas.length ? ` · ${viejas.length} con más de 7 días` : ''}`, clase: 'tp-lista',
        extra: [herr(agregar({}, 'Agregar una tarea en Bandeja… (Enter)'), btn('Ordenar de a una', () => ordenarDeAUna(items), { icono: 'bandeja', clase: 'p', titulo: 'Te muestra una por vez para decidir qué hacer' })), chipsFiltro()],
        cuerpo: ver.length ? grupo('bandeja:para', 'Para ordenar', ver.length, ver.map(filaB)) : vacio(filtroActivo() ? 'Nada con este filtro' : 'Bandeja en cero', filtroActivo() ? 'Probá sacando algún filtro' : 'Todo ordenado') }),
      card({ c: 4, r: 1, titulo: 'Cómo va la Bandeja', clase: 'tp-cvc tp-comp', cuerpo: cv(null, [
        ['Para ordenar', String(items.length), 'en total'],
        ['Más de 7 días', String(viejas.length), viejas[0]?.titulo || 'ninguna'],
        ['La más vieja', items.length ? `hace ${edad(items[0])} d` : '—', ''],
        ['Ordenadas', String(ordenadas.length), 'esta semana'],
      ]) }),
      card({ c: 4, r: 3, titulo: 'Hace más de 7 días', sub: 'Conviene decidir qué hacer con estas', clase: 'tp-comp',
        cuerpo: viejas.length ? viejas.map(t => h('div', { class: 'tp-f tp-t', role: 'button', tabindex: '0', onclick: () => E.abrir(t) }, h('span', { class: 'tp-tx' }, t.titulo, h('small', {}, `Anotada hace ${edad(t)} días${desde(t) ? ` · ${desde(t)}` : ''}`)), tag(`${edad(t)} d`, 'r'))) : mini('Ninguna. Vas bien.') }),
      card({ c: 4, r: 4, titulo: 'Ordenadas', sub: 'A dónde fue lo que sacaste de la Bandeja',
        cuerpo: ordenadas.length ? ordenadas.map(t => h('div', { class: 'tp-f tp-t', role: 'button', tabindex: '0', onclick: () => E.abrir(t) }, h('span', { class: 'tp-tx' }, t.titulo, h('small', {}, textoHace(Math.floor((Date.now() - t.ordenadaBandeja) / 86_400_000)))), tag(nombreLugar(t), 'a'))) : mini('Todavía nada. Usá "Ordenar de a una".') }),
    ]);
  }

  // Una tarea por vez: área (con la sugerida marcada), cuándo, y seguir.
  function ordenarDeAUna(items) {
    if (!items.length) { ctx.aviso('La Bandeja ya está en cero'); return; }
    const total = items.length;
    let i = 0, hechas = 0;
    const caja = h('div', { class: 'tp-uno-c' });
    const velo = h('div', { class: 'tp-uno', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ordenar la Bandeja de a una' }, caja);
    const cerrar = () => { velo.remove(); document.removeEventListener('keydown', tecla); };
    const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    velo.addEventListener('click', (e) => { if (e.target === velo) cerrar(); });
    document.body.append(velo);

    function pintar() {
      if (i >= items.length) {
        const quedan = principales(d.tareas.filter(t => !t.areaId && !hecha(t))).length;
        caja.replaceChildren(h('div', { class: 'tp-uno-fin' }, h('b', {}, quedan ? 'Listo por ahora' : 'Bandeja en cero'), h('span', { class: 'tp-mini' }, quedan ? `Ordenaste ${hechas}. Te quedan ${quedan} que salteaste.` : `Ordenaste ${hechas}. Todo tiene su lugar.`)),
          h('div', { class: 'tp-uno-pie' }, h('button', { type: 'button', class: 'tp-btn p', onclick: cerrar }, 'Volver a la Bandeja')));
        return;
      }
      const t = items[i], e = edad(t), sug = sugerirArea(t);
      const sel = { area: sug?.id || '', fecha: '' };
      const opcion = (g, valor, texto, on, clase = '') => h('button', { type: 'button', class: `tp-btn${on ? ' on' : ''}${clase ? ` ${clase}` : ''}`, 'data-g': g, onclick: (ev) => {
        sel[g] = valor;
        for (const b of caja.querySelectorAll(`[data-g="${g}"]`)) b.classList.toggle('on', b === ev.currentTarget);
      } }, texto);
      const finde = sumarDias(hoy(), (5 - new Date().getDay() + 7) % 7 || 7);
      const seguir = async (accion) => {
        try {
          if (accion === 'hecha') { await m.completar(t); ctx.aviso('Hecha'); }
          else if (accion === 'borrar') { await m.eliminar('tareas', t.id); ctx.aviso('Borrada (está en la papelera)'); }
          else if (accion === 'mover') {
            if (!sel.area) { ctx.aviso('Elegí a qué área va'); return; }
            await m.guardarTarea(t.id, { ...t, areaId: sel.area, proyectoId: '', seccionId: '', ...(sel.fecha ? { fecha: sel.fecha } : {}), ordenadaBandeja: Date.now() });
            ctx.aviso(`Movida a ${d.area(sel.area)?.nombre || 'su área'}`);
          }
          if (accion !== 'saltar') hechas++;
        } catch (err) { ctx.aviso(err.message); return; }
        caja.querySelector('.tp-uno-card')?.classList.add('va');
        setTimeout(() => { i++; pintar(); }, 280);
      };
      caja.replaceChildren(
        h('div', { class: 'tp-uno-top' }, h('span', {}, `${i + 1} de ${total}`), h('span', { class: 'tp-barra' }, h('i', { class: 'v', style: `width:${Math.round(i / total * 100)}%` })), h('button', { type: 'button', class: 'tp-x', 'aria-label': 'Cerrar', onclick: cerrar }, '×')),
        h('div', { class: 'tp-uno-card' },
          h('div', { class: 'tp-uno-t' }, t.titulo),
          h('div', { class: 'tp-uno-s' }, `Anotada ${textoHace(e)}${desde(t) ? ` · desde ${desde(t)}` : ''}`, e > 7 ? [' ', tag('más de 7 días', 'r')] : null),
          h('div', { class: 'tp-fs' }, '¿A QUÉ ÁREA VA?'),
          h('div', { class: 'tp-op' }, areasActivas().map(a => opcion('area', a.id, sug?.id === a.id ? `${a.nombre} · sugerida` : a.nombre, sel.area === a.id, sug?.id === a.id ? 'sug' : ''))),
          h('div', { class: 'tp-fs' }, '¿CUÁNDO?'),
          h('div', { class: 'tp-op' }, opcion('fecha', hoy(), 'Hoy'), opcion('fecha', sumarDias(hoy(), 1), 'Mañana'), opcion('fecha', finde, 'Esta semana (viernes)'), opcion('fecha', '', 'Sin fecha', true))),
        h('div', { class: 'tp-uno-pie' },
          btn('Ya la hice', () => seguir('hecha')),
          btn('Borrar', () => seguir('borrar')),
          btn('Saltar', () => seguir('saltar')),
          btn('Mover y seguir →', () => seguir('mover'), { clase: 'p' })));
    }
    pintar();
  }

  // ─────────────────────────────────────────────────────────────
  // Filtro guardado: junta tareas de todas las áreas.
  // ─────────────────────────────────────────────────────────────
  function vistaFiltro(id) {
    const f = d.filtro(id);
    if (!f) return grid([card({ c: 12, r: 8, titulo: 'Filtro', cuerpo: vacio('Este filtro ya no existe') })]);
    const F = filtroDe(f);
    const ts = porFecha([...d.tareas, ...(F.proy?.includes('_prog') ? d.programadas || [] : [])].filter(t => !d.enOculto?.(t) && pasa(t, d, F)));
    const orden = f.orden || 'fecha';
    const ordenadas = orden === 'dur' ? [...ts].sort((a, b) => (Number(a.duracion) || 999) - (Number(b.duracion) || 999))
      : orden === 'creacion' ? [...ts].sort((a, b) => b.creado - a.creado)
        : orden === 'nombre' ? [...ts].sort((a, b) => a.titulo.localeCompare(b.titulo)) : ordenar(ts);
    const grupos = [...areasActivas(), ...d.areas.filter(a => a.sistema && !a.archivada), { id: '', nombre: 'Bandeja' }];
    const lista = grupos.map(a => { const del = ordenadas.filter(t => (t.areaId || '') === a.id); return del.length ? grupo(`filtro:${id}:${a.id}`, a.nombre, del.length, del.map(t => fila(t))) : null; });
    const desc = chipsDe(F, d).map(x => x[1]).join(' · ');
    const base = { ...(F.area?.length === 1 && F.area[0] !== '_bandeja' ? { areaId: F.area[0] } : {}), ...(F.etiq?.length ? { etiquetas: [...F.etiq] } : {}), ...(F.fecha === 'hoy' ? { fecha: hoy() } : {}) };
    return grid([
      card({ c: 12, r: 8, titulo: f.nombre, sub: `${ts.length} tarea${ts.length === 1 ? '' : 's'} de todas las áreas${desc ? ` · ${desc}` : ''}`, clase: 'tp-lista',
        extra: herr(agregar(base, 'Agregar una tarea… (Enter)'), btn('Borrar este filtro', async () => { if (await ctx.confirmar(`¿Borrar el filtro "${f.nombre}"?`, { si: 'Borrar', peligro: true })) { await m.borrarFiltro(f.id); ctx.aviso('Filtro borrado'); location.hash = '#/tareas/hoy'; } })),
        cuerpo: ts.length ? lista : vacio('Nada con este filtro', 'Todo al día') }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Resumen (distribución "Tuya")
  // ─────────────────────────────────────────────────────────────
  function vistaResumen() {
    const todas = d.tareas.filter(t => !t.padreId || !d.tarea(t.padreId));
    const pend = pendientes();
    const venc = porFecha(ordenar(pend.filter(vencida)));
    const deHoyL = porFecha(ordenar(pend.filter(deHoy)));
    const veces = d.tareas.flatMap(t => vecesHecha(t).map(ms => ({ t, ms, dia: isoDe(ms) })));
    const semana = veces.filter(x => x.dia >= sumarDias(hoy(), -6)).length;
    const semanaAntes = veces.filter(x => x.dia >= sumarDias(hoy(), -13) && x.dia < sumarDias(hoy(), -6)).length;
    // Vencidas ayer: las de hoy que ya estaban atrasadas ayer (las pendientes y las que cerraste hoy).
    const ayer = sumarDias(hoy(), -1);
    const vencAyer = pend.filter(t => t.fecha && t.fecha < ayer).length + hechasHoy().filter(t => t.fecha && t.fecha < ayer).length;
    // Días para cerrar: de que se creó a que se hizo (últimos 30 días contra los 30 anteriores).
    const cierre = (desde, hasta) => {
      const L = d.tareas.filter(t => hecha(t) && t.creado && msHecha(t) && isoDe(msHecha(t)) >= sumarDias(hoy(), -desde) && isoDe(msHecha(t)) < sumarDias(hoy(), -hasta));
      return L.length ? L.reduce((s, t) => s + Math.max(0, (msHecha(t) - t.creado) / 86_400_000), 0) / L.length : null;
    };
    const c30 = cierre(30, -1), c60 = cierre(60, 30);
    const nm = (lab, val, del = '', col = '') => h('div', { class: 'tp-nm' }, h('span', { class: 'lab' }, lab), h('span', { class: 'big' }, val), h('span', { class: `tp-del ${col}`, style: del ? null : 'visibility:hidden' }, del || '0'));
    const signo = (n, dec = false) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${dec ? Math.abs(n).toFixed(1).replace('.', ',') : Math.abs(n)}`;
    const dV = venc.length - vencAyer, dH = semana - semanaAntes, dC = c30 != null && c60 != null ? c30 - c60 : 0;
    const nums = h('section', { class: 'tp-card tp-nums', style: 'grid-column: span 2; grid-row: span 1' },
      nm('Vencidas', String(venc.length), dV ? signo(dV) : '', dV > 0 ? 'r' : 'v'),
      nm('Hoy', String(deHoyL.length)),
      nm('Hechas', String(semana), dH ? signo(dH) : '', dH >= 0 ? 'v' : 'r'),
      nm('Días cierre', c30 == null ? '—' : String(Math.round(c30)), Math.abs(dC) >= 0.1 ? signo(dC, true) : '', dC <= 0 ? 'v' : 'r'));

    // Estado del mes
    const mes = hoy().slice(0, 7);
    const delMes = todas.filter(t => (t.fecha || '').slice(0, 7) === mes || (hecha(t) && isoDe(msHecha(t)).slice(0, 7) === mes));
    const aTiempo = delMes.filter(t => hecha(t) && (!t.fecha || isoDe(msHecha(t)) <= t.fecha)).length;
    const tarde = delMes.filter(hecha).length - aTiempo;
    const partes = [['A tiempo', aTiempo, 'var(--tp-verde)'], ['Tarde', tarde, 'var(--tp-laton)'], ['Pendientes', delMes.length - aTiempo - tarde, '#3a3d41']];
    const estado = card({ c: 3, r: 1, titulo: `Estado del mes · ${delMes.length} tarea${delMes.length === 1 ? '' : 's'}`, clase: 'tp-comp', cuerpo: [
      h('div', { class: 'tp-apil' }, partes.map(p => (p[1] ? h('i', { style: `flex:${p[1]};background:${p[2]}` }) : null))),
      h('div', { class: 'tp-ley' }, partes.map(p => h('span', { class: 'tp-mini' }, h('i', { style: `background:${p[2]}` }), p[0], ' ', h('b', {}, String(p[1]))))),
    ] });

    // Lo próximo
    const ahora = horaAhora();
    const proximas = porFecha(ordenar(pend.filter(t => t.fecha > hoy() || (deHoy(t) && !(t.hora && t.hora < ahora))))).slice(0, 12);
    const filaProx = (t) => {
      const subs = d.hijas?.(t.id) || [];
      const c = cuando(t), a = d.area(t.areaId);
      return h('div', { class: 'tp-f tp-t', role: 'button', tabindex: '0', onclick: () => E.abrir(t) },
        h('span', { class: `tp-icoc ${colorDe(t.areaId)}` }, ic(a?.icono || 'bandeja')),
        h('span', { class: 'tp-tx' }, t.titulo, h('small', {}, `${nombreArea(t)} · ${c ? c[0] : ''}`)),
        h('span', { class: 'tp-der' }, subs.length ? `${subs.length} subtarea${subs.length === 1 ? '' : 's'}` : duracionCorta(t.duracion)));
    };
    const loProximo = card({ c: 4, r: 5, titulo: 'Lo próximo', sub: 'Los próximos días', link: enlace('Ver todo →', '#/tareas/proximos'), cuerpo: proximas.length ? proximas.map(filaProx) : mini('Nada en camino.') });

    // Tu día: reloj de 24 h + lista
    const conHora = deHoyL.filter(t => t.hora);
    const listaDia = [...deHoyL.filter(t => t.hora), ...deHoyL.filter(t => !t.hora), ...venc].map(t => {
      const esV = vencida(t);
      return fila(t, { sub: `${t.hora || 'sin hora'} · ${esV ? 'vencida' : nombreArea(t)}`, etiqueta: [duracionCorta(t.duracion), esV ? 'r' : colorDe(t.areaId)] });
    });
    const tuDia = card({ c: 5, r: 4, titulo: 'Tu día', sub: 'Cada arco es una tarea con hora · adentro, las vencidas', link: enlace('Calendario →', '#/calendario'),
      cuerpo: h('div', { class: 'tp-dia-g' }, relojDia(conHora, venc.length), h('div', {}, listaDia.length ? listaDia : mini('Nada para hoy.'))) });

    // Avance y desvío por área
    const avance = areasActivas().map(a => {
      const del = todas.filter(t => t.areaId === a.id && ((t.fecha || '').slice(0, 7) === mes || hechaHace(t, 30)));
      const hc = del.filter(hecha), tot = del.length, p = tot ? Math.round(hc.length / tot * 100) : 0;
      const atrasos = [...hc.filter(t => t.fecha).map(t => Math.max(0, diasEntre(t.fecha, isoDe(msHecha(t))))), ...del.filter(vencida).map(t => diasEntre(t.fecha, hoy()))];
      const atraso = atrasos.length ? atrasos.reduce((s, x) => s + x, 0) / atrasos.length : 0;
      return h('div', { class: 'tp-f tp-col' }, ic(a.icono || 'carpeta'), h('span', { class: 'tp-tx' }, a.nombre), h('span', { class: 'tp-der' }, h('b', {}, `${p} %`), ` · ${hc.length}/${tot}`),
        h('div', { class: 'tp-barra' }, h('i', { class: p < 50 ? 'r' : p < 70 ? '' : 'v', style: `width:${p}%` })),
        h('span', { class: 'tp-mini tp-entre' }, h('span', {}, 'Atraso promedio'), h('span', { class: atraso > 2 ? 'mal' : atraso > 1 ? 'am' : 'ok' }, `${atraso.toFixed(1).replace('.', ',')} días`)));
    });
    const avanceC = card({ c: 3, r: 3, titulo: 'Avance y desvío por área', sub: 'Hechas del mes y cuánto se atrasan', clase: 'tp-comp', cuerpo: avance.length ? avance : mini('Sin áreas.') });

    // Cuándo terminás: día de la semana × hora, últimos 30 días.
    const mapa = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const x of veces.filter(v => v.dia >= sumarDias(hoy(), -30))) { const f = new Date(x.ms); mapa[(f.getDay() + 6) % 7][f.getHours()]++; }
    const max = Math.max(1, ...mapa.flat());
    const calor = h('div', { class: 'tp-heat' }, ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dn, i) => [h('span', { class: 'hd' }, dn), mapa[i].map((n, hh) => h('i', { class: `h${n ? Math.ceil(n / max * 4) : 0}`, title: `${dn} ${hh} h: ${n} hecha${n === 1 ? '' : 's'}` }))]),
      h('span', {}), Array.from({ length: 24 }, (_, k) => h('span', { class: 'hx' }, k % 6 === 0 ? `${k} h` : '')));
    const calorC = card({ c: 3, r: 2, titulo: 'Cuándo terminás tus tareas', sub: 'Por hora del día, últimos 30 días', cuerpo: calor });

    // Registro: vencidas, de hoy, las que vienen, sin fecha y las hechas (las más nuevas primero).
    const estadoDe = (t) => (hecha(t) ? ['Hecha', 'v'] : vencida(t) ? ['Vencida', 'r'] : deHoy(t) ? ['Hoy', 'a'] : t.fecha ? ['Programada', 'z'] : ['Sin fecha', 'g']);
    const filtrosReg = [['todas', 'Todas', () => true], ['venc', 'Vencidas', vencida], ['hoy', 'Hoy', deHoy], ['prog', 'Programadas', t => !hecha(t) && t.fecha > hoy()], ['hechas', 'Hechas', hecha]];
    const peso = (t) => (hecha(t) ? 4 : vencida(t) ? 0 : deHoy(t) ? 1 : t.fecha ? 2 : 3);
    const regTodas = [...todas, ...(d.programadas || []).filter(t => !t.padreId)].sort((a, b) => peso(a) - peso(b) || (peso(a) === 4 ? msHecha(b) - msHecha(a) : (a.fecha || '9').localeCompare(b.fecha || '9')));
    const fr = filtrosReg.find(x => x[0] === VER.registro) || filtrosReg[0];
    const reg = regTodas.filter(fr[2]).slice(0, 80);
    const fechaReg = (t) => { if (hecha(t)) { const f = new Date(msHecha(t)); return diasEntre(isoDe(msHecha(t)), hoy()) < 2 ? textoHace(diasEntre(isoDe(msHecha(t)), hoy())) : `${f.getDate()} ${MES_C[f.getMonth()]}`; } if (!t.fecha) return '—'; const n = diasEntre(hoy(), t.fecha); if (n <= 0) return textoHace(-n); const f = fechaDe(t.fecha); return n < 7 ? `${DIAS_C[f.getDay()]} ${f.getDate()}` : `${f.getDate()} ${MES_C[f.getMonth()]}`; };
    const exportar = () => {
      const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
      const csv = ['Tarea;Área;Proyecto;Fecha;Hora;Estado', ...regTodas.filter(fr[2]).map(t => [t.titulo, nombreArea(t), d.proyecto(t.proyectoId)?.nombre || '', t.fecha || '', t.hora || '', estadoDe(t)[0]].map(q).join(';'))].join('\n');
      const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: `tareas-${hoy()}.csv` });
      document.body.append(a); a.click(); a.remove();
    };
    const registro = card({ c: 12, r: 3, titulo: 'Registro', sub: 'Vencidas, de hoy, las que vienen y las hechas', link: boton('Exportar', exportar, 'Bajar la lista como planilla (CSV)'),
      extra: h('div', { class: 'tp-chips' }, filtrosReg.map(([k, n, f]) => h('button', { type: 'button', class: `tp-chip${VER.registro === k ? ' on' : ''}`, onclick: () => { VER.registro = k; E.redibujar(); } }, `${n} ${regTodas.filter(f).length}`))),
      cuerpo: h('table', { class: 'tp-tabla' }, h('thead', {}, h('tr', {}, h('th', {}, 'Tarea'), h('th', {}, 'Área'), h('th', {}, 'Fecha'), h('th', {}, 'Estado'))),
        h('tbody', {}, reg.map(t => { const [e, c] = estadoDe(t); return h('tr', { onclick: () => E.abrir(t) }, h('td', {}, t.titulo), h('td', {}, nombreArea(t)), h('td', {}, fechaReg(t)), h('td', {}, tag(e, c))); }))) });

    return grid([nums, estado, loProximo, tuDia, avanceC, calorC, registro]);
  }

  function relojDia(conHora, nVenc) {
    const cx = 110, cy = 110, R = 86;
    const pt = (a, r) => { const t = (a / 24) * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
    const arco = (a1, a2, r, c, w) => { const p1 = pt(a1, r), p2 = pt(Math.max(a2, a1 + 0.2), r), lg = (a2 - a1) > 12 ? 1 : 0; return `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${r} ${r} 0 ${lg} 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; };
    let s = `<svg viewBox="-22 -22 264 264" width="100%" height="100%"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--tp-sup2)" stroke-width="12"/><circle cx="${cx}" cy="${cy}" r="62" fill="none" stroke="var(--tp-linea)" stroke-width="1" stroke-dasharray="2 4"/>`;
    for (let k = 0; k < 24; k++) { const a = pt(k, R + 12), b = pt(k, R + (k % 6 === 0 ? 17 : 14)); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--tp-tenue)" stroke-width="${k % 6 === 0 ? 1.6 : 0.8}"/>`; }
    for (const k of [0, 6, 12, 18]) { const p = pt(k, R + 27); s += `<text x="${p[0]}" y="${p[1] + 3}" text-anchor="middle" font-size="9" fill="var(--tp-suave)" font-family="Barlow">${k}</text>`; }
    // La noche (de 23 a 7) más oscura, como la maqueta.
    s += arco(0, 7, R, '#2a2b2e', 12) + arco(23, 24, R, '#2a2b2e', 12);
    const color = { v: 'var(--tp-verde)', z: 'var(--tp-azul)', a: 'var(--tp-laton)', r: 'var(--tp-rojo)', g: 'var(--tp-lila)' };
    for (const t of conHora) { const [hh, mm] = t.hora.split(':').map(Number), ini = hh + mm / 60, dur = (Number(t.duracion) || 60) / 60; s += arco(ini, Math.min(24, ini + dur), R, color[colorDe(t.areaId)], 12); }
    for (let i = 0; i < Math.min(nVenc, 6); i++) s += arco(10 + i * 3, 10.8 + i * 3, 62, 'var(--tp-rojo)', 6);
    const n = new Date(), ahora = n.getHours() + n.getMinutes() / 60, pa = pt(ahora, R + 2);
    s += `<line x1="${cx}" y1="${cy}" x2="${pa[0]}" y2="${pa[1]}" stroke="var(--tp-texto)" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="var(--tp-texto)"/>`;
    s += `<text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="15" font-weight="600" fill="var(--tp-texto)" font-family="Barlow Condensed">${horaAhora()}</text><text x="${cx}" y="${cy + 41}" text-anchor="middle" font-size="8.5" fill="var(--tp-suave)" font-family="Barlow">ahora</text></svg>`;
    const div = h('div', { class: 'tp-reloj' });
    div.innerHTML = s;
    return div;
  }

  // ─────────────────────────────────────────────────────────────
  // Panel de filtros (botón de abajo de la columna)
  // ─────────────────────────────────────────────────────────────
  let panel = null, editando = null;
  const guardar = { nombre: '', icono: 'filtro', orden: 'fecha', numero: true };

  function cerrarFiltros() { panel?.remove(); panel = null; editando = null; document.removeEventListener('pointerdown', afuera, true); document.removeEventListener('keydown', escFiltros); marcarBotonFiltros(); }
  function escFiltros(e) { if (e.key === 'Escape' && panel) { e.stopPropagation(); cerrarFiltros(); } }
  function afuera(e) { if (panel && !panel.contains(e.target) && !e.target.closest('.pc-cpie, .pc-tpie, .tp-chips, .tp-aherr, .tp-area-f')) cerrarFiltros(); }
  function abrirFiltros(boton) {
    if (panel) { cerrarFiltros(); return; }
    // En un filtro guardado, el panel arranca con ese filtro para poder cambiarlo.
    if (E.vista() === 'filtro' && d.filtro(E.id()) && !filtroActivo()) {
      editando = d.filtro(E.id());
      FILT = JSON.parse(JSON.stringify(filtroDe(editando)));
      Object.assign(guardar, { nombre: editando.nombre, icono: editando.icono || 'filtro', orden: editando.orden || 'fecha', numero: editando.numero !== false });
    }
    panel = h('div', { class: 'tp-fpanel', role: 'dialog', 'aria-label': 'Filtros' });
    document.body.append(panel);
    const r = boton?.getBoundingClientRect?.();
    if (r) { panel.style.left = `${Math.max(8, r.left)}px`; panel.style.bottom = `${Math.max(8, window.innerHeight - r.top + 8)}px`; }
    pintarFiltros();
    document.addEventListener('pointerdown', afuera, true);
    document.addEventListener('keydown', escFiltros);
  }

  function pintarFiltros() {
    marcarBotonFiltros();
    if (!panel) return;
    const sc = panel.querySelector('.tp-fp-cuerpo')?.scrollTop || 0;
    const aplicar = () => { E.redibujar(); pintarFiltros(); };
    const op = (k, v, t) => h('button', { type: 'button', class: `tp-chip${FILT[k] === v ? ' on' : ''}`, onclick: () => { if (FILT[k] === v) delete FILT[k]; else FILT[k] = v; aplicar(); } }, t);
    const om = (k, v, t) => h('button', { type: 'button', class: `tp-chip${(FILT[k] || []).includes(v) ? ' on' : ''}`, onclick: () => { const L = FILT[k] = FILT[k] || []; const i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); aplicar(); } }, t);
    const sec2 = (t, nota, ...chips) => [h('div', { class: 'tp-fs' }, t, nota ? h('i', {}, nota) : null), h('div', { class: 'tp-chips' }, chips)];
    const vista = E.vista(), idV = E.id();
    const enArea = vista === 'area', enHoy = vista === 'hoy';
    const proys = enArea ? proyectosDe(idV) : d.proyectos.filter(p => !p.archivado && areasActivas().some(a => a.id === p.areaId));
    const etiquetas = [...new Set(d.tareas.flatMap(t => t.etiquetas || []))].sort();
    const fecha = h('input', { type: 'date', value: FILT.desde || '', onchange: (e) => { FILT.desde = e.target.value; aplicar(); } });
    const fecha2 = h('input', { type: 'date', value: FILT.hasta || '', onchange: (e) => { FILT.hasta = e.target.value; aplicar(); } });
    let espera = null;
    const texto = h('input', { type: 'text', class: 'tp-fp-tx', placeholder: 'Que contenga… (ej: turno)', value: FILT.texto || '', oninput: (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => { FILT.texto = e.target.value.trim(); if (!FILT.texto) delete FILT.texto; E.redibujar(); marcarBotonFiltros(); }, 350);
    } });
    const iconos = ['filtro', 'calendario', 'reloj', 'persona', 'casa', 'diana', 'sol', 'estrella', 'maletin', 'carrito'];
    const cuerpo = h('div', { class: 'tp-fp-cuerpo' },
      sec2('FECHA', '', Object.entries(FN.fecha).map(([k, t]) => op('fecha', k, t)), FILT.fecha === 'rango' ? h('div', { class: 'tp-fp-rango' }, fecha, h('span', {}, 'a'), fecha2) : null),
      sec2('HORA', '', Object.entries(FN.hora).map(([k, t]) => op('hora', k, t))),
      enHoy ? sec2('ÁREA', 'una por vez en Hoy', [...areasActivas().map(a => [a.id, a.nombre]), ['_bandeja', 'Bandeja']].map(([k, n]) => h('button', { type: 'button', class: `tp-chip${VER.hoyArea === k ? ' on' : ''}`, onclick: () => { VER.hoyArea = VER.hoyArea === k ? '' : k; aplicar(); } }, n)))
        : enArea ? null : sec2('ÁREA', 'podés elegir varias', [...areasActivas().map(a => om('area', a.id, a.nombre)), om('area', '_bandeja', 'Bandeja')]),
      sec2('PROYECTO', 'podés elegir varios', om('proy', '_general', 'General'), om('proy', '_prog', 'Programadas'), proys.map(p => om('proy', p.id, p.nombre))),
      etiquetas.length ? sec2('ETIQUETAS', '', etiquetas.map(e => om('etiq', e, `#${e}`)), h('span', { class: 'tp-fp-modo' }, [['cualq', 'Cualquiera'], ['todas', 'Todas']].map(([k, t]) => h('button', { type: 'button', class: (FILT.etiqModo || 'cualq') === k ? 'on' : '', onclick: () => { FILT.etiqModo = k; aplicar(); } }, t)))) : null,
      sec2('ESTADO', '', Object.entries(FN.estado).map(([k, t]) => op('estado', k, t))),
      sec2('CÓMO ES LA TAREA', '', Object.entries(FN.como).map(([k, t]) => om('como', k, t))),
      sec2('DURACIÓN', '', Object.entries(FN.dur).map(([k, t]) => op('dur', k, t))),
      sec2('ANTIGÜEDAD', '', Object.entries(FN.antig).map(([k, t]) => op('antig', k, t))),
      h('div', { class: 'tp-fs' }, 'TEXTO'), texto,
      h('div', { class: 'tp-fs' }, editando ? `CAMBIAR "${editando.nombre.toUpperCase()}"` : 'GUARDAR CON NOMBRE', h('i', {}, 'queda en la columna, en Mis filtros')),
      h('div', { class: 'tp-fg' }, h('input', { type: 'text', placeholder: 'Nombre (ej: Llamadas)', value: guardar.nombre, oninput: (e) => { guardar.nombre = e.target.value; } }),
        h('button', { type: 'button', class: 'tp-btn p', onclick: guardarFiltro }, editando ? 'Guardar cambios' : 'Guardar')),
      h('div', { class: 'tp-fp-fila' }, h('span', {}, 'Ícono'), h('span', { class: 'tp-fp-ics' }, iconos.map(n => h('button', { type: 'button', class: guardar.icono === n ? 'on' : '', 'aria-label': n, onclick: () => { guardar.icono = n; pintarFiltros(); } }, ic(n))))),
      h('div', { class: 'tp-fp-fila' }, h('span', {}, 'Ordenar'), h('select', { onchange: (e) => { guardar.orden = e.target.value; } },
        [['fecha', 'Por fecha'], ['area', 'Por área'], ['dur', 'Por duración'], ['creacion', 'Por creación'], ['nombre', 'Por nombre']].map(([v, t]) => h('option', { value: v, selected: guardar.orden === v }, t)))),
      h('label', { class: 'tp-fp-fila' }, h('span', {}, 'Mostrar el número en la columna'), h('input', { type: 'checkbox', checked: guardar.numero, onchange: (e) => { guardar.numero = e.target.checked; } })));
    const n = chipsDe(FILT, d).length;
    panel.replaceChildren(
      h('div', { class: 'tp-fp-cab' }, h('h4', {}, 'Filtrar'), h('span', { class: 'tp-fp-cab-d' }, n ? h('button', { type: 'button', class: 'tp-chip', onclick: () => { FILT = {}; aplicar(); } }, `Sacar todo (${n})`) : null,
        h('button', { type: 'button', class: 'tp-x', 'aria-label': 'Cerrar', onclick: cerrarFiltros }, '×'))),
      h('span', { class: 'tp-mini' }, 'Se aplica a la lista que estás viendo. Tocá de nuevo para sacar.'),
      cuerpo);
    cuerpo.scrollTop = sc;
  }

  async function guardarFiltro() {
    if (!filtroActivo()) { ctx.aviso('Primero elegí algún filtro'); return; }
    const nombre = guardar.nombre.trim();
    if (!nombre) { ctx.aviso('Ponele un nombre'); return; }
    const datos = { nombre, nuevo: JSON.parse(JSON.stringify(FILT)), icono: guardar.icono, orden: guardar.orden, numero: guardar.numero,
      // Campos de antes, para que el celular lo siga entendiendo.
      texto: FILT.texto || '', areaId: FILT.area?.length === 1 && FILT.area[0] !== '_bandeja' ? FILT.area[0] : '', proyectoId: '', fecha: { venc: 'vencidas', hoy: 'hoy', '7d': 'semana', sin: 'sin-fecha' }[FILT.fecha] || '', incluirHechas: !!FILT.estado && FILT.estado !== 'pend' };
    // Guardar con el mismo nombre que uno que ya existe lo cambia (no crea otro).
    const existente = editando || d.filtros.find(f => normal(f.nombre) === normal(nombre));
    let id;
    if (existente) { await m.actualizarFiltro(existente.id, datos); id = existente.id; } else id = await m.crearFiltro(datos);
    FILT = {};
    Object.assign(guardar, { nombre: '', icono: 'filtro', orden: 'fecha', numero: true });
    cerrarFiltros();
    ctx.aviso(existente ? 'Filtro actualizado' : 'Filtro guardado en la columna');
    location.hash = `#/tareas/filtro/${id}`;
  }

  // El botón de la columna se pone amarillo con el número de filtros puestos.
  function marcarBotonFiltros() {
    const n = chipsDe(FILT, d).length + (VER.hoyArea && E.vista() === 'hoy' ? 1 : 0);
    for (const b of document.querySelectorAll('.pc-cpie [aria-label="Filtros"], .pc-tpie [data-filtros]')) {
      b.classList.toggle('on', !!n || !!panel);
      b.dataset.n = n ? String(n) : '';
    }
  }

  return {
    vista(nombre, id) {
      switch (nombre) {
        case 'inicio': return vistaResumen();
        case 'hoy': return vistaHoy();
        case 'proximos': return vistaProximos();
        case 'bandeja': return vistaBandeja();
        case 'area': return vistaArea(id);
        case 'filtro': return vistaFiltro(id);
        default: return null;
      }
    },
    actualizar(nuevo) { d = nuevo; marcarBotonFiltros(); },
    abrirFiltros: (boton) => abrirFiltros(boton),
    cerrarFiltros,
  };
}
