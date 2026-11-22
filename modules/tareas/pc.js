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
// Las filas de tarea son las mismas de siempre (filaTarea): tildar, abrir
// el detalle al costado, subtareas, etc. funcionan igual.
// ─────────────────────────────────────────────────────────────

import { hoy, sumarDias, diasEntre, hecha, vencida, deHoy, programada, ordenar, ordenarManual, textoFecha, textoDuracion } from './modelo.js';
import { pedirNombre } from './editor.js';

// ── Estado de pantalla (dura mientras la app está abierta) ──
let FILT = {};                          // filtro que se está aplicando ahora
const VER = { hoyArea: '', proy: {}, ordenFecha: false, hechas: 'semana', registro: 'todas' };
const recienHechas = new Set();         // para el brillo de la tarea que acaba de llegar a "Hechas"

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
// Piezas
// ─────────────────────────────────────────────────────────────

export function crearPC(E) {
  const { ctx, h, m, ic } = E;
  let d = E.d;

  const card = ({ c, r, titulo, sub = '', link = null, cuerpo, extra = null, clase = '', id = '' }) =>
    h('section', { class: `tp-card ${clase}`, style: `grid-column: span ${c}; grid-row: span ${r}`, 'data-k': id || titulo },
      h('div', { class: 'tp-cab' }, h('div', {}, h('b', {}, titulo), sub ? h('small', {}, sub) : null), link),
      extra,
      h('div', { class: 'tp-cuerpo' }, cuerpo));
  const grid = (cards, filas = 8) => h('div', { class: 'tp-grid', style: `--filas: ${filas}` }, cards);
  const tag = (texto, color = 'g') => (texto ? h('span', { class: `tp-tag ${color}` }, texto) : null);
  const enlace = (texto, href) => h('a', { class: 'tp-link', href }, texto);
  const boton = (texto, alTocar, clase = '') => h('button', { type: 'button', class: `tp-link ${clase}`, onclick: alTocar }, texto);
  const vacio = (titulo, texto) => h('div', { class: 'tp-vacio' }, h('b', {}, titulo), texto ? h('span', {}, texto) : null);
  const lista = (ts, opc = {}) => h('ul', { class: 'tr-lista' }, ts.map(t => {
    const li = E.fila(t, opc);
    if (recienHechas.has(t.id)) { li.classList.add('tp-llega'); setTimeout(() => recienHechas.delete(t.id), 1200); }
    return li;
  }));
  const anillo = (hechas, total, tam = 54) => {
    const R = 20, C = 2 * Math.PI * R, p = total ? hechas / total : 0;
    const s = h('span', { class: 'tp-anillo' });
    s.innerHTML = `<svg width="${tam}" height="${tam}" viewBox="0 0 52 52"><circle cx="26" cy="26" r="${R}" fill="none" stroke="var(--superficie-2)" stroke-width="6"/><circle cx="26" cy="26" r="${R}" fill="none" stroke="var(--verde)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/><text x="26" y="30" text-anchor="middle" font-family="Barlow Condensed" font-size="13" font-weight="600" fill="var(--tinta)">${hechas}/${total}</text></svg>`;
    return s;
  };
  const datosFila = (items) => h('div', { class: 'tp-datos' }, items.map(([lab, val, pie]) => h('div', {}, h('small', {}, lab), h('b', {}, val), h('i', {}, pie || ''))));

  // Grupo plegable con el estilo de "A LA MAÑANA". Se recuerda plegado (como los proyectos).
  const grupo = (clave, titulo, n, contenido, color = '') => {
    const pleg = E.plegado(clave);
    const cuerpo = h('div', { class: `tp-gcuerpo${pleg ? ' plegado' : ''}` }, contenido);
    const cab = h('button', {
      type: 'button', class: `tp-gsec${pleg ? ' plegado' : ''}${color ? ` ${color}` : ''}`, 'aria-expanded': String(!pleg),
      onclick: () => { const p = !cab.classList.contains('plegado'); cab.classList.toggle('plegado', p); cuerpo.classList.toggle('plegado', p); cab.setAttribute('aria-expanded', String(!p)); E.plegar(clave); },
    }, h('span', {}, `${titulo.toUpperCase()} · ${n}`), ic('abajo'));
    return [cab, cuerpo];
  };

  // ── Datos comunes ──
  const sueltaPorFecha = (t) => { const madre = d.padre(t); return !madre || hecha(madre) || !madre.fecha || madre.fecha !== t.fecha; };
  const porFecha = (ts) => ts.filter(sueltaPorFecha);
  const principales = (ts) => ts.filter(t => !t.padreId || !d.tarea(t.padreId));
  const pendientes = () => d.tareas.filter(t => !hecha(t) && !d.enOculto?.(t));
  const areasActivas = () => d.areas.filter(a => !a.archivada && !a.sistema);
  const proyectosDe = (areaId) => d.proyectos.filter(p => p.areaId === areaId && !p.archivado);
  const hechasHoy = () => d.tareas.filter(t => hecha(t) && t.completada && isoDe(Number(t.completada) || Date.parse(t.completada)) === hoy());
  const nombreLugar = (t) => d.proyecto(t.proyectoId)?.nombre || d.area(t.areaId)?.nombre || 'Bandeja';
  const conFiltro = (ts) => (filtroActivo() ? ts.filter(t => pasa(t, d)) : ts);

  // Chips del filtro puesto, arriba de la lista.
  function chipsFiltro() {
    const c = chipsDe(FILT, d);
    if (!c.length) return null;
    return h('div', { class: 'tp-chips tp-fchips' },
      c.map(([k, t]) => h('button', { type: 'button', class: 'tp-chip on', onclick: () => { sacarFiltro(k); E.redibujar(); pintarFiltros(); } }, t, ' ×')),
      h('button', { type: 'button', class: 'tp-chip', onclick: () => { FILT = {}; E.redibujar(); pintarFiltros(); } }, 'Sacar filtros'));
  }
  const herramientas = (...cosas) => h('div', { class: 'tp-herr' }, cosas);
  const rapida = (base, ayuda) => E.rapida(base, ayuda);

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
    const en = (mom) => deHoyL.filter(t => momento(t.hora) === mom);
    const total = venc.length + deHoyL.length + hechas.length;
    const f = new Date();
    const nombreArea = VER.hoyArea === '_bandeja' ? 'Bandeja' : d.area(VER.hoyArea)?.nombre;
    const titulo = VER.hoyArea ? `Hoy en ${nombreArea}` : `Hoy, ${DIAS[f.getDay()]} ${f.getDate()}`;
    const contenido = [
      venc.length ? grupo('hoy:venc', 'Vencidas', venc.length, lista(venc), 'rojo') : null,
      en('maniana').length ? grupo('hoy:man', 'A la mañana', en('maniana').length, lista(en('maniana'), { ubicacion: true })) : null,
      en('tarde').length ? grupo('hoy:tar', 'A la tarde', en('tarde').length, lista(en('tarde'))) : null,
      en('noche').length ? grupo('hoy:noc', 'A la noche', en('noche').length, lista(en('noche'))) : null,
      en('').length ? grupo('hoy:sin', 'Sin hora', en('').length, lista(en(''))) : null,
      hechas.length && !filtroActivo() ? grupo('hoy:hechas', 'Hechas hoy', hechas.length, lista(hechas), 'verde') : null,
      !venc.length && !deHoyL.length ? vacio(`Nada para hoy${VER.hoyArea ? ` en ${nombreArea}` : ''}`, filtroActivo() ? 'Probá sacando algún filtro' : 'Disfrutá el día') : null,
    ];

    // Cómo vas hoy: anillo + lo que te queda, lo próximo con hora y la vencida más vieja.
    const queda = deHoyL.reduce((s, t) => s + (Number(t.duracion) || 0), 0);
    const prox = deHoyL.find(t => t.hora && t.hora >= ahora);
    const vieja = ordenar(pend.filter(vencida))[0];
    const como = h('div', { class: 'tp-como' }, anillo(hechas.length, Math.max(total, 1)), datosFila([
      ['Hecho', `${hechas.length} de ${total}`, total ? `${Math.round(hechas.length / total * 100)} %` : ''],
      ['Te queda', queda ? textoDuracion(queda) : `${deHoyL.length} tarea${deHoyL.length === 1 ? '' : 's'}`, queda ? `${deHoyL.length} tareas` : 'sin duración cargada'],
      ['Próxima', prox ? prox.hora : '—', prox ? prox.titulo : 'nada con hora'],
      ['Más vieja', vieja ? textoHace(diasEntre(vieja.fecha, hoy())) : '—', vieja ? vieja.titulo : 'al día'],
    ]));

    // Por área: tocar una filtra todo; "Ver todas ×" lo saca.
    const todasP = pendientes();
    const filaArea = (id, nombre, icono) => {
      const v = todasP.filter(t => (t.areaId || '_bandeja') === id && vencida(t)).length;
      const hy = todasP.filter(t => (t.areaId || '_bandeja') === id && deHoy(t)).length;
      return h('button', { type: 'button', class: `tp-fila tp-sel${VER.hoyArea === id ? ' on' : ''}`, onclick: () => { VER.hoyArea = VER.hoyArea === id ? '' : id; E.redibujar(); } },
        ic(icono), h('span', { class: 'tp-tx' }, nombre), tag(v ? `${v} vencida${v > 1 ? 's' : ''}` : '', 'r'), tag(hy ? `${hy} hoy` : '', 'a'), !v && !hy ? tag('al día', 'v') : null);
    };
    const porArea = [...areasActivas().map(a => filaArea(a.id, a.nombre, a.icono || 'carpeta')), filaArea('_bandeja', 'Bandeja', 'bandeja')];

    // Lo que viene: próximos 7 días, por día.
    const vienen = porFecha(ordenar(pend.filter(t => t.fecha > hoy() && t.fecha <= sumarDias(hoy(), 7))));
    const dias = [...new Set(vienen.map(t => t.fecha))];
    const loQueViene = dias.length ? dias.map(df => [h('p', { class: 'tp-dia' }, textoFecha(df)), lista(vienen.filter(t => t.fecha === df))]) : vacio('Nada en los próximos 7 días');

    return grid([
      card({ c: 8, r: 8, titulo, sub: VER.hoyArea ? `Solo las tareas de ${nombreArea}` : 'Por momento del día', extra: [herramientas(rapida({ fecha: hoy(), ...(VER.hoyArea && VER.hoyArea !== '_bandeja' ? { areaId: VER.hoyArea } : {}) }, 'Agregar una tarea para hoy… (Enter)')), chipsFiltro()], cuerpo: contenido, clase: 'tp-lista' }),
      card({ c: 4, r: 1, titulo: VER.hoyArea ? `Cómo vas en ${nombreArea}` : 'Cómo vas hoy', cuerpo: como, clase: 'tp-compacta' }),
      card({ c: 4, r: 2, titulo: 'Por área', sub: VER.hoyArea ? `Mostrando solo ${nombreArea}` : 'Tocá una para ver solo esas', link: VER.hoyArea ? boton('Ver todas ×', () => { VER.hoyArea = ''; E.redibujar(); }) : null, cuerpo: porArea }),
      card({ c: 4, r: 5, titulo: 'Lo que viene', sub: 'Los próximos 7 días', link: enlace('Próximos →', '#/tareas/proximos'), cuerpo: loQueViene }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Próximos
  // ─────────────────────────────────────────────────────────────
  function vistaProximos() {
    const pend = conFiltro(pendientes());
    const vienen = porFecha(ordenar(pend.filter(t => t.fecha > hoy() && t.fecha <= sumarDias(hoy(), 14))));
    const despues = porFecha(ordenar(pend.filter(t => t.fecha > sumarDias(hoy(), 14))));
    const dias = [...new Set(vienen.map(t => t.fecha))];
    const prog = ordenar((d.programadas || []).filter(t => !t.padreId && (!filtroActivo() || pasa(t, d))));
    const semana = pend.filter(t => t.fecha > hoy() && t.fecha <= sumarDias(hoy(), 7));
    const porArea = [...areasActivas(), { id: '', nombre: 'Bandeja', icono: 'bandeja' }].map(a => {
      const n = semana.filter(t => (t.areaId || '') === a.id).length;
      return n ? h('div', { class: 'tp-fila' }, ic(a.icono || 'carpeta'), h('span', { class: 'tp-tx' }, a.nombre), h('span', { class: 'tp-der' }, String(n))) : null;
    }).filter(Boolean);
    return grid([
      card({ c: 8, r: 8, titulo: 'Próximos', sub: 'Las próximas dos semanas, día por día', extra: [herramientas(rapida({ fecha: sumarDias(hoy(), 1) }, 'Agregar una tarea para mañana… (Enter)')), chipsFiltro()], clase: 'tp-lista',
        cuerpo: [
          dias.map(df => grupo(`prox:${df}`, textoFecha(df), vienen.filter(t => t.fecha === df).length, lista(vienen.filter(t => t.fecha === df)))),
          despues.length ? grupo('prox:despues', 'Más adelante', despues.length, lista(despues)) : null,
          !dias.length && !despues.length ? vacio('Nada en camino', filtroActivo() ? 'Probá sacando algún filtro' : '') : null,
        ] }),
      card({ c: 4, r: 3, titulo: 'Esta semana por área', sub: `${semana.length} tarea${semana.length === 1 ? '' : 's'} en los próximos 7 días`, cuerpo: porArea.length ? porArea : vacio('Semana libre') }),
      card({ c: 4, r: 5, titulo: 'Programadas', sub: 'Ocultas hasta el día en que aparecen', cuerpo: prog.length ? lista(prog) : vacio('No hay programadas') }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Área
  // ─────────────────────────────────────────────────────────────
  function bloqueHechas(ts, proys) {
    const veces = ts.flatMap(t => vecesHecha(t).map(ms => ({ t, ms, dia: isoDe(ms) })));
    const modos = [['semana', 'Semana'], ['lista', 'Lista'], ['calendario', 'Calendario'], ['proyecto', 'Por proyecto']];
    const chips = h('div', { class: 'tp-chips' }, modos.map(([k, n]) => h('button', { type: 'button', class: `tp-chip${VER.hechas === k ? ' on' : ''}`, onclick: () => { VER.hechas = k; E.redibujar(); } }, n)));
    let cuerpo;
    if (VER.hechas === 'lista') {
      const ult = [...veces].sort((a, b) => b.ms - a.ms).slice(0, 25);
      cuerpo = ult.length ? ult.map(x => h('div', { class: 'tp-fila' }, h('span', { class: 'tp-tx' }, x.t.titulo, h('small', {}, d.proyecto(x.t.proyectoId)?.nombre || 'General')), h('span', { class: 'tp-der' }, textoHace(diasEntre(x.dia, hoy()))))) : vacio('Todavía no hay hechas');
    } else if (VER.hechas === 'calendario') {
      // Últimas 8 semanas, un cuadrito por día (más oscuro = más hechas).
      const inicio = sumarDias(hoy(), -55 - ((new Date().getDay() + 6) % 7) + 6);
      const celdas = [];
      for (let i = 0; i < 56; i++) {
        const dia = sumarDias(inicio, i), n = veces.filter(x => x.dia === dia).length;
        celdas.push(h('i', { class: `n${Math.min(n, 4)}${dia > hoy() ? ' fut' : ''}`, title: `${textoFecha(dia)}: ${n} hecha${n === 1 ? '' : 's'}` }));
      }
      cuerpo = h('div', { class: 'tp-hcal' }, celdas);
    } else if (VER.hechas === 'proyecto') {
      cuerpo = [{ id: '', nombre: 'General' }, ...proys].map(p => {
        const del = ts.filter(t => (t.proyectoId || '') === p.id), hc = del.filter(hecha).length, tot = del.length;
        return tot ? h('div', { class: 'tp-fila tp-col' }, h('div', { class: 'tp-fila-l' }, h('span', { class: 'tp-tx' }, p.nombre), h('span', { class: 'tp-der' }, `${hc} de ${tot}`)), h('div', { class: 'tp-barra' }, h('i', { style: `width:${Math.round(hc / tot * 100)}%` }))) : null;
      });
    } else {
      const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy(), i - 6));
      const ns = dias.map(df => veces.filter(x => x.dia === df).length), max = Math.max(1, ...ns);
      cuerpo = h('div', { class: 'tp-barras' }, dias.map((df, i) => h('div', { class: 'tp-bar' },
        h('i', { style: `height:${Math.max(3, ns[i] / max * 100)}%`, class: df === hoy() ? 'hoy' : '' }, h('small', {}, ns[i] ? String(ns[i]) : '')),
        h('span', {}, DIAS[new Date(`${df}T12:00`).getDay()].slice(0, 1).toUpperCase()))));
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
    const ver = conFiltro;
    const general = ver(pend.filter(t => !t.proyectoId));
    const prog = ordenar((d.programadas || []).filter(t => t.areaId === id && !t.padreId && (!filtroActivo() || pasa(t, d))));
    const hechasHoyA = hechasHoy().filter(t => t.areaId === id && !t.padreId);
    const contenido = [];
    if (!pf && general.length) contenido.push(grupo(`area:${id}:general`, 'General', general.length, lista(ord(general), { ubicacion: false })));
    for (const p of proys.filter(p => !pf || p.id === pf)) {
      const delP = todas.filter(t => t.proyectoId === p.id);
      const pp = ver(delP.filter(t => !hecha(t)));
      if (filtroActivo() && !pp.length) continue;
      const hc = delP.filter(hecha), recientes = filtroActivo() ? [] : hc.filter(t => hechaHace(t, 7));
      const tot = delP.length, clave = `area:${id}:p:${p.id}`, pleg = !pf && E.plegado(clave);
      const cuerpoP = h('div', { class: `tp-pcuerpo${pleg ? ' plegado' : ''}` }, pp.length ? lista(ord(pp), { ubicacion: false }) : null, recientes.length ? lista(recientes, { ubicacion: false }) : null, !pp.length && !recientes.length ? h('p', { class: 'tp-mini' }, 'Sin pendientes') : null);
      const cab = h('button', {
        type: 'button', class: `tp-pcab${pleg ? ' plegado' : ''}`, 'aria-expanded': String(!pleg),
        onclick: () => { const x = !cab.classList.contains('plegado'); cab.classList.toggle('plegado', x); cuerpoP.classList.toggle('plegado', x); E.plegar(clave); },
      }, ic('abajo'), h('b', {}, p.nombre), h('span', { class: 'tp-mini' }, `${pp.length} pendiente${pp.length === 1 ? '' : 's'}`),
      h('span', { class: 'tp-barra chica' }, h('i', { style: `width:${tot ? Math.round(hc.length / tot * 100) : 0}%` })));
      contenido.push(cab, cuerpoP);
    }
    if (!pf && prog.length) contenido.push(grupo(`area:${id}:prog`, 'Programadas', prog.length, lista(prog, { ubicacion: false })));
    if (!pf && hechasHoyA.length && !filtroActivo()) contenido.push(grupo(`area:${id}:hechas`, 'Hechas hoy', hechasHoyA.length, lista(hechasHoyA, { ubicacion: false }), 'verde'));
    if (!contenido.length) contenido.push(vacio(filtroActivo() ? 'Nada con este filtro' : 'Nada pendiente', filtroActivo() ? 'Probá sacando algún filtro' : `Todo al día en ${a.nombre}`));

    const venc = pend.filter(vencida);
    const delMes = todas.filter(t => hecha(t) && hechaHace(t, 30));
    const prox = ordenar(pend.filter(t => t.fecha >= hoy()))[0];
    const como = h('div', { class: 'tp-como' }, anillo(delMes.length, delMes.length + pend.length), datosFila([
      ['Pendientes', String(pend.length), `${proys.length} proyecto${proys.length === 1 ? '' : 's'}`],
      ['Vencidas', String(venc.length), venc[0] ? ordenar(venc)[0].titulo : 'al día'],
      ['Lo próximo', prox ? textoFecha(prox.fecha) : '—', prox ? prox.titulo : 'sin fechas'],
      ['Hechas', String(delMes.length), 'último mes'],
    ]));
    const filasProy = proys.length ? proys.map(p => {
      const pp = pend.filter(t => t.proyectoId === p.id), v = pp.filter(vencida).length;
      return h('button', { type: 'button', class: `tp-fila tp-sel${pf === p.id ? ' on' : ''}`, onclick: () => { VER.proy[id] = pf === p.id ? '' : p.id; E.redibujar(); } },
        ic(p.icono || 'proyecto'), h('span', { class: 'tp-tx' }, p.nombre), v ? tag('vencidas', 'r') : null, h('span', { class: 'tp-der' }, String(pp.length)));
    }) : h('p', { class: 'tp-mini' }, 'Todavía no hay proyectos. Tocá + para crear uno.');
    const nuevoProy = a.sistema ? null : h('button', { type: 'button', class: 'tp-link', title: 'Nuevo proyecto', onclick: async () => { const n = await pedirNombre(ctx, 'Nuevo proyecto', '', 'Crear proyecto'); if (n) { await m.crearProyecto(id, n); ctx.aviso(`Proyecto "${n}" creado`); } } }, '+');
    const hb = bloqueHechas(todas, proys);
    const pNombre = d.proyecto(pf)?.nombre;
    const base = { areaId: id, ...(pf ? { proyectoId: pf } : {}) };
    return grid([
      card({ c: 8, r: 8, titulo: pf ? `${a.nombre} › ${pNombre}` : a.nombre, sub: pf ? `Solo el proyecto ${pNombre}` : `${pend.length} pendiente${pend.length === 1 ? '' : 's'}${venc.length ? ` · ${venc.length} vencida${venc.length > 1 ? 's' : ''}` : ''}`, clase: 'tp-lista',
        extra: [herramientas(a.sistema ? h('span', { class: 'tp-mini' }, 'Acá llega solo lo automático (Finanzas, Bitácora, feriados…).') : rapida(base, `Agregar una tarea en ${pNombre || a.nombre}… (Enter)`),
          h('button', { type: 'button', class: `tp-btn${VER.ordenFecha ? ' on' : ''}`, title: 'Ordena por fecha dentro de cada grupo; los proyectos se mantienen', onclick: () => { VER.ordenFecha = !VER.ordenFecha; E.redibujar(); } }, ic('calendario'), VER.ordenFecha ? 'Por fecha ✓' : 'Ordenar por fecha')), chipsFiltro()],
        cuerpo: contenido }),
      card({ c: 4, r: 1, titulo: `Cómo vas en ${a.nombre}`, cuerpo: como, clase: 'tp-compacta' }),
      card({ c: 4, r: 3, titulo: 'Proyectos', sub: pf ? `Mostrando solo ${pNombre}` : 'Tocá uno para ver solo ese', link: pf ? boton('Ver todos ×', () => { VER.proy[id] = ''; E.redibujar(); }) : nuevoProy, cuerpo: filasProy }),
      card({ c: 4, r: 4, titulo: 'Hechas', sub: hb.sub, extra: hb.chips, cuerpo: hb.cuerpo }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Bandeja
  // ─────────────────────────────────────────────────────────────
  const edad = (t) => (t.creado ? Math.max(0, Math.floor((Date.now() - t.creado) / 86_400_000)) : 0);
  // Sugerencia de área: la que tiene más tareas con palabras en común.
  function sugerirArea(t) {
    const palabras = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter(p => p.length > 3);
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
    const filas = ver.map(t => {
      const li = E.fila(t, { ubicacion: false });
      const e = edad(t), sug = sugerirArea(t);
      // Antigüedad y sugerencia van en la línea de datos de la tarea (si no tiene, se crea).
      const cuerpoT = li.querySelector('.tr-fila .tr-cuerpo');
      let metas = cuerpoT?.querySelector(':scope > .tr-metas');
      if (cuerpoT && !metas) { metas = h('span', { class: 'tr-metas' }); cuerpoT.querySelector(':scope > .tr-tit-ic')?.after(metas); }
      metas?.prepend(tag(textoHace(e), e > 7 ? 'r' : 'g'));
      if (sug) metas?.append(h('span', { class: 'tr-meta tp-sug' }, `¿Va en ${sug.nombre}?`));
      return li;
    });
    return grid([
      card({ c: 8, r: 8, titulo: 'Bandeja', sub: `${items.length} para ordenar${viejas.length ? ` · ${viejas.length} con más de 7 días` : ''}`, clase: 'tp-lista',
        extra: [herramientas(rapida({}, 'Anotar algo en la Bandeja… (Enter)'), h('button', { type: 'button', class: 'tp-btn p', onclick: () => ordenarDeAUna(items) }, ic('bandeja'), 'Ordenar de a una')), chipsFiltro()],
        cuerpo: ver.length ? grupo('bandeja:para', 'Para ordenar', ver.length, h('ul', { class: 'tr-lista' }, filas)) : vacio(filtroActivo() ? 'Nada con este filtro' : 'Bandeja en cero', filtroActivo() ? 'Probá sacando algún filtro' : 'Todo tiene su lugar') }),
      card({ c: 4, r: 1, titulo: 'Cómo va la Bandeja', clase: 'tp-compacta', cuerpo: datosFila([
        ['Para ordenar', String(items.length), 'en total'],
        ['Más de 7 días', String(viejas.length), viejas[0]?.titulo || 'ninguna'],
        ['La más vieja', items.length ? textoHace(edad(items[0])) : '—', ''],
        ['Ordenadas', String(ordenadas.length), 'esta semana'],
      ]) }),
      card({ c: 4, r: 3, titulo: 'Hace más de 7 días', sub: 'Conviene decidir qué hacer con estas', cuerpo: viejas.length ? lista(viejas, { ubicacion: false }) : vacio('Ninguna', 'Vas bien') }),
      card({ c: 4, r: 4, titulo: 'Ordenadas', sub: 'A dónde fue lo que sacaste de la Bandeja', cuerpo: ordenadas.length ? ordenadas.map(t => h('div', { class: 'tp-fila' }, h('span', { class: 'tp-tx' }, t.titulo, h('small', {}, textoHace(Math.floor((Date.now() - t.ordenadaBandeja) / 86_400_000)))), tag(nombreLugar(t), 'a'))) : vacio('Todavía nada', 'Usá "Ordenar de a una"') }),
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
        caja.replaceChildren(h('div', { class: 'tp-uno-fin' }, h('b', {}, quedan ? 'Listo por ahora' : 'Bandeja en cero'), h('span', {}, quedan ? `Ordenaste ${hechas}. Te quedan ${quedan} que salteaste.` : `Ordenaste ${hechas}. Todo tiene su lugar.`)),
          h('div', { class: 'tp-uno-pie' }, h('button', { type: 'button', class: 'boton principal', onclick: cerrar }, 'Volver a la Bandeja')));
        return;
      }
      const t = items[i], e = edad(t), sug = sugerirArea(t);
      const sel = { area: sug?.id || '', fecha: '' };
      const opcion = (grupoN, valor, texto, on) => h('button', { type: 'button', class: `tp-btn${on ? ' on' : ''}`, 'data-g': grupoN, onclick: (ev) => {
        sel[grupoN] = valor;
        for (const b of caja.querySelectorAll(`[data-g="${grupoN}"]`)) b.classList.toggle('on', b === ev.currentTarget);
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
        caja.querySelector('.tp-uno-t')?.classList.add('va');
        setTimeout(() => { i++; pintar(); }, 260);
      };
      caja.replaceChildren(
        h('div', { class: 'tp-uno-top' }, h('span', {}, `${i + 1} de ${total}`), h('span', { class: 'tp-barra' }, h('i', { style: `width:${Math.round(i / total * 100)}%` })), h('button', { type: 'button', class: 'tp-x', 'aria-label': 'Cerrar', onclick: cerrar }, '×')),
        h('div', { class: 'tp-uno-t' },
          h('h2', {}, t.titulo),
          h('p', {}, `Anotada ${textoHace(e)}`, e > 7 ? tag('más de 7 días', 'r') : null),
          h('p', { class: 'tp-fs' }, '¿A QUÉ ÁREA VA?'),
          h('div', { class: 'tp-op' }, areasActivas().map(a => opcion('area', a.id, sug?.id === a.id ? `${a.nombre} · sugerida` : a.nombre, sel.area === a.id))),
          h('p', { class: 'tp-fs' }, '¿CUÁNDO?'),
          h('div', { class: 'tp-op' }, opcion('fecha', hoy(), 'Hoy'), opcion('fecha', sumarDias(hoy(), 1), 'Mañana'), opcion('fecha', finde, 'Esta semana (viernes)'), opcion('fecha', '', 'Sin fecha', true))),
        h('div', { class: 'tp-uno-pie' },
          h('button', { type: 'button', class: 'tp-btn', onclick: () => seguir('hecha') }, 'Ya la hice'),
          h('button', { type: 'button', class: 'tp-btn', onclick: () => seguir('borrar') }, 'Borrar'),
          h('button', { type: 'button', class: 'tp-btn', onclick: () => seguir('saltar') }, 'Saltar'),
          h('button', { type: 'button', class: 'boton principal', onclick: () => seguir('mover') }, 'Mover y seguir →')));
    }
    pintar();
  }

  // ─────────────────────────────────────────────────────────────
  // Filtro guardado: junta tareas de todas las áreas.
  // ─────────────────────────────────────────────────────────────
  function vistaFiltro(id) {
    const f = d.filtro(id);
    if (!f) return grid([card({ c: 12, r: 2, titulo: 'Filtro', cuerpo: vacio('Este filtro ya no existe') })]);
    const F = filtroDe(f);
    const ts = porFecha([...d.tareas, ...(F.proy?.includes('_prog') ? d.programadas || [] : [])].filter(t => !d.enOculto?.(t) && pasa(t, d, F)));
    const orden = f.orden || 'fecha';
    const ordenadas = orden === 'dur' ? [...ts].sort((a, b) => (Number(a.duracion) || 999) - (Number(b.duracion) || 999))
      : orden === 'creacion' ? [...ts].sort((a, b) => b.creado - a.creado)
        : orden === 'nombre' ? [...ts].sort((a, b) => a.titulo.localeCompare(b.titulo)) : ordenar(ts);
    const grupos = [...areasActivas(), ...d.areas.filter(a => a.sistema && !a.archivada), { id: '', nombre: 'Bandeja' }];
    const contenido = grupos.map(a => { const del = ordenadas.filter(t => (t.areaId || '') === a.id); return del.length ? grupo(`filtro:${id}:${a.id}`, a.nombre, del.length, lista(del, { ubicacion: 'proyecto' })) : null; });
    const desc = chipsDe(F, d).map(x => x[1]).join(' · ');
    return grid([
      card({ c: 8, r: 8, titulo: f.nombre, sub: `${ts.length} tarea${ts.length === 1 ? '' : 's'} · ${desc}`, clase: 'tp-lista',
        cuerpo: ts.length ? contenido : vacio('Nada con este filtro', 'Todo al día') }),
      card({ c: 4, r: 8, titulo: 'Cómo funciona', cuerpo: [
        h('p', { class: 'tp-texto' }, 'Es un filtro que guardaste con nombre. Junta las tareas de ', h('b', {}, F.area?.length ? chipsDe({ area: F.area }, d).map(x => x[1]).join(', ') : 'todas las áreas'), ' que cumplen: ', h('b', {}, desc || 'todo'), '.'),
        h('p', { class: 'tp-texto' }, `Orden: ${{ fecha: 'por fecha', area: 'por área', dur: 'por duración', creacion: 'por creación', nombre: 'por nombre' }[orden]}.${f.numero ? ' Muestra el número en la columna.' : ''}`),
        h('div', { class: 'tp-herr' },
          h('button', { type: 'button', class: 'tp-btn', onclick: (e) => { FILT = JSON.parse(JSON.stringify(F)); editando = f; abrirFiltros(e.currentTarget, true); } }, 'Cambiar este filtro'),
          h('button', { type: 'button', class: 'tp-btn', onclick: async () => { if (await ctx.confirmar(`¿Borrar el filtro "${f.nombre}"?`, { si: 'Borrar', peligro: true })) { await m.borrarFiltro(f.id); location.hash = '#/tareas/hoy'; } } }, 'Borrar')),
      ] }),
    ]);
  }

  // ─────────────────────────────────────────────────────────────
  // Resumen: tablero
  // ─────────────────────────────────────────────────────────────
  function vistaResumen() {
    const todas = d.tareas.filter(t => !t.padreId || !d.tarea(t.padreId));
    const pend = pendientes();
    const venc = porFecha(pend.filter(vencida));
    const deHoyL = porFecha(pend.filter(deHoy));
    const veces = d.tareas.flatMap(t => vecesHecha(t).map(ms => ({ t, ms, dia: isoDe(ms) })));
    const semana = veces.filter(x => x.dia >= sumarDias(hoy(), -6)).length;
    const semanaAntes = veces.filter(x => x.dia >= sumarDias(hoy(), -13) && x.dia < sumarDias(hoy(), -6)).length;
    // Días para cerrar: de que se creó a que se hizo (últimos 30 días).
    const cerradas = d.tareas.filter(t => hecha(t) && t.creado && hechaHace(t, 30));
    const diasCierre = cerradas.length ? cerradas.reduce((s, t) => s + Math.max(0, (vecesHecha(t).at(-1) - t.creado) / 86_400_000), 0) / cerradas.length : 0;
    const num = (lab, val, del = '', col = '') => h('div', { class: 'tp-num' }, h('small', {}, lab), h('b', {}, val), h('span', { class: `tp-del ${col}` }, del || ' '));
    const dif = semana - semanaAntes;
    const numeros = card({ c: 2, r: 1, titulo: 'Números', clase: 'tp-nums', cuerpo: [
      num('Vencidas', String(venc.length), '', venc.length ? 'r' : ''),
      num('Hoy', String(deHoyL.length)),
      num('Hechas', String(semana), dif ? `${dif > 0 ? '+' : ''}${dif} semana` : 'semana', dif >= 0 ? 'v' : 'r'),
      num('Cierre', diasCierre ? diasCierre.toFixed(1).replace('.', ',') : '—', 'días prom.'),
    ] });

    // Estado del mes: tareas con fecha este mes.
    const mes = hoy().slice(0, 7);
    const delMes = d.tareas.filter(t => (t.fecha || '').slice(0, 7) === mes || (hecha(t) && t.completada && isoDe(Number(t.completada) || Date.parse(t.completada)).slice(0, 7) === mes));
    const aTiempo = delMes.filter(t => hecha(t) && (!t.fecha || isoDe(Number(t.completada) || Date.parse(t.completada)) <= t.fecha)).length;
    const tarde = delMes.filter(t => hecha(t)).length - aTiempo;
    const pendMes = delMes.filter(t => !hecha(t)).length;
    const partes = [['A tiempo', aTiempo, 'var(--verde)'], ['Tarde', tarde, 'var(--laton)'], ['Pendientes', pendMes, '#3a3d41']];
    const estado = card({ c: 3, r: 1, titulo: `Estado del mes · ${delMes.length} tareas`, clase: 'tp-compacta', cuerpo: [
      h('div', { class: 'tp-apil' }, partes.map(p => (p[1] ? h('i', { style: `flex:${p[1]};background:${p[2]}` }) : null))),
      h('div', { class: 'tp-ley' }, partes.map(p => h('span', {}, h('i', { style: `background:${p[2]}` }), p[0], ' ', h('b', {}, String(p[1]))))),
    ] });

    // Lo próximo
    const proximas = porFecha(ordenar(pend.filter(t => t.fecha > hoy()))).slice(0, 12);
    const loProximo = card({ c: 4, r: 5, titulo: 'Lo próximo', sub: 'Los próximos días', link: enlace('Ver todo →', '#/tareas/proximos'), cuerpo: proximas.length ? lista(proximas) : vacio('Nada en camino') });

    // Tu día: reloj de 24 h con un arco por tarea con hora.
    const conHora = deHoyL.filter(t => t.hora);
    const tuDia = card({ c: 5, r: 4, titulo: 'Tu día', sub: 'Cada arco es una tarea con hora · adentro, las vencidas', link: enlace('Hoy →', '#/tareas/hoy'),
      cuerpo: h('div', { class: 'tp-dia-g' }, relojDia(conHora, venc.length), h('div', { class: 'tp-dia-l' }, deHoyL.length || venc.length ? lista([...ordenar(deHoyL), ...venc.slice(0, 3)]) : vacio('Nada para hoy'))) });

    // Avance y desvío por área
    const avance = areasActivas().map(a => {
      const del = todas.filter(t => t.areaId === a.id && ((t.fecha || '').slice(0, 7) === mes || hechaHace(t, 30)));
      const hc = del.filter(hecha), tot = del.length, p = tot ? Math.round(hc.length / tot * 100) : 0;
      const atrasos = [...hc.filter(t => t.fecha).map(t => Math.max(0, diasEntre(t.fecha, isoDe(vecesHecha(t).at(-1))))), ...del.filter(vencida).map(t => diasEntre(t.fecha, hoy()))];
      const atraso = atrasos.length ? atrasos.reduce((s, x) => s + x, 0) / atrasos.length : 0;
      return h('div', { class: 'tp-fila tp-col' },
        h('div', { class: 'tp-fila-l' }, ic(a.icono || 'carpeta'), h('span', { class: 'tp-tx' }, a.nombre), h('span', { class: 'tp-der' }, h('b', {}, `${p} %`), ` · ${hc.length}/${tot}`)),
        h('div', { class: 'tp-barra' }, h('i', { class: p < 50 ? 'r' : p < 70 ? '' : 'v', style: `width:${p}%` })),
        h('div', { class: 'tp-fila-l tp-mini' }, h('span', {}, 'Atraso promedio'), h('span', { class: atraso > 2 ? 'mal' : atraso > 1 ? 'am' : 'ok' }, `${atraso.toFixed(1).replace('.', ',')} días`)));
    });
    const avanceC = card({ c: 3, r: 3, titulo: 'Avance y desvío por área', sub: 'Hechas del mes y cuánto se atrasan', cuerpo: avance.length ? avance : vacio('Sin áreas') });

    // Cuándo terminás: día de la semana × hora, últimos 30 días.
    const mapa = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const x of veces.filter(v => v.dia >= sumarDias(hoy(), -30))) { const f = new Date(x.ms); mapa[(f.getDay() + 6) % 7][f.getHours()]++; }
    const max = Math.max(1, ...mapa.flat());
    const calor = h('div', { class: 'tp-heat' }, ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dn, i) => [h('span', { class: 'hd' }, dn), mapa[i].map((n, hh) => h('i', { class: `h${n ? Math.ceil(n / max * 4) : 0}`, title: `${dn} ${hh} h: ${n}` }))]),
      h('span', {}), Array.from({ length: 24 }, (_, k) => h('span', { class: 'hx' }, k % 6 === 0 ? `${k} h` : '')));
    const calorC = card({ c: 3, r: 2, titulo: 'Cuándo terminás tus tareas', sub: 'Por hora del día, últimos 30 días', cuerpo: calor });

    // Registro
    const estadoDe = (t) => (hecha(t) ? ['Hecha', 'v'] : vencida(t) ? ['Vencida', 'r'] : deHoy(t) ? ['Hoy', 'a'] : t.fecha ? ['Programada', 'z'] : ['Sin fecha', 'g']);
    const filtrosReg = [['todas', 'Todas', () => true], ['venc', 'Vencidas', vencida], ['hoy', 'Hoy', deHoy], ['prog', 'Programadas', t => !hecha(t) && t.fecha > hoy()], ['hechas', 'Hechas', hecha]];
    const regTodas = [...todas].sort((a, b) => (b.modificado || b.creado) - (a.modificado || a.creado));
    const fr = filtrosReg.find(x => x[0] === VER.registro) || filtrosReg[0];
    const reg = regTodas.filter(fr[2]).slice(0, 60);
    const registro = card({ c: 12, r: 3, titulo: 'Registro', sub: 'Lo último que tocaste, de más nuevo a más viejo',
      extra: h('div', { class: 'tp-chips' }, filtrosReg.map(([k, n, f]) => h('button', { type: 'button', class: `tp-chip${VER.registro === k ? ' on' : ''}`, onclick: () => { VER.registro = k; E.redibujar(); } }, `${n} ${regTodas.filter(f).length}`))),
      cuerpo: h('table', { class: 'tp-tabla' }, h('thead', {}, h('tr', {}, h('th', {}, 'Tarea'), h('th', {}, 'Lugar'), h('th', {}, 'Fecha'), h('th', {}, 'Estado'))),
        h('tbody', {}, reg.map(t => { const [e, c] = estadoDe(t); return h('tr', { onclick: () => E.abrir(t) }, h('td', {}, t.titulo), h('td', {}, nombreLugar(t)), h('td', {}, t.fecha ? textoFecha(t.fecha) : '—'), h('td', {}, tag(e, c))); }))) });

    return grid([numeros, estado, loProximo, tuDia, avanceC, calorC, registro], 8);
  }

  function relojDia(conHora, nVenc) {
    const cx = 110, cy = 110, R = 86;
    const pt = (a, r) => { const t = (a / 24) * 2 * Math.PI - Math.PI / 2; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
    const arco = (a1, a2, r, c, w) => { const p1 = pt(a1, r), p2 = pt(Math.max(a2, a1 + 0.2), r), lg = (a2 - a1) > 12 ? 1 : 0; return `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${r} ${r} 0 ${lg} 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; };
    let s = `<svg viewBox="-22 -22 264 264" class="tp-reloj"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--superficie-2)" stroke-width="12"/><circle cx="${cx}" cy="${cy}" r="62" fill="none" stroke="var(--linea)" stroke-dasharray="2 4"/>`;
    for (let k = 0; k < 24; k++) { const a = pt(k, R + 12), b = pt(k, R + (k % 6 === 0 ? 17 : 14)); s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--tinta-2)" stroke-opacity=".6" stroke-width="${k % 6 === 0 ? 1.6 : 0.8}"/>`; }
    for (const k of [0, 6, 12, 18]) { const p = pt(k, R + 27); s += `<text x="${p[0]}" y="${p[1] + 3}" text-anchor="middle" font-size="9" fill="var(--tinta-2)" font-family="Barlow">${k}</text>`; }
    const colores = ['#8FA9E8', 'var(--laton)', 'var(--verde)', '#C9A0DC'];
    conHora.forEach((t, i) => { const [hh, mm] = t.hora.split(':').map(Number), ini = hh + mm / 60, dur = (Number(t.duracion) || 60) / 60; s += arco(ini, ini + dur, R, colores[i % colores.length], 12); });
    for (let i = 0; i < Math.min(nVenc, 6); i++) s += arco(i * 4, i * 4 + 1, 62, 'var(--rojo)', 6);
    const n = new Date(), ahora = n.getHours() + n.getMinutes() / 60, pa = pt(ahora, R + 2);
    s += `<line x1="${cx}" y1="${cy}" x2="${pa[0]}" y2="${pa[1]}" stroke="var(--tinta)" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="var(--tinta)"/>`;
    s += `<text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="15" font-weight="600" fill="var(--tinta)" font-family="Barlow Condensed">${horaAhora()}</text><text x="${cx}" y="${cy + 41}" text-anchor="middle" font-size="8.5" fill="var(--tinta-2)" font-family="Barlow">ahora</text></svg>`;
    const div = h('div', { class: 'tp-reloj-c' });
    div.innerHTML = s;
    return div;
  }

  // ─────────────────────────────────────────────────────────────
  // Panel de filtros (botón de abajo de la columna)
  // ─────────────────────────────────────────────────────────────
  let panel = null, editando = null, botonAncla = null;
  const guardar = { nombre: '', icono: 'filtro', orden: 'fecha', numero: true };

  function cerrarFiltros() { panel?.remove(); panel = null; editando = null; document.removeEventListener('pointerdown', afuera, true); }
  function afuera(e) { if (panel && !panel.contains(e.target) && !e.target.closest('.pc-cpie, .pc-tpie, .tp-chips, .tp-herr')) cerrarFiltros(); }
  function abrirFiltros(boton, desdeFiltro = false) {
    if (panel && !desdeFiltro) { cerrarFiltros(); return; }
    cerrarFiltros();
    if (desdeFiltro) editando = d.filtro(E.id()) || null;
    if (editando) Object.assign(guardar, { nombre: editando.nombre, icono: editando.icono || 'filtro', orden: editando.orden || 'fecha', numero: editando.numero !== false });
    botonAncla = boton;
    panel = h('div', { class: 'tp-fpanel', role: 'dialog', 'aria-label': 'Filtros' });
    document.body.append(panel);
    const r = boton?.getBoundingClientRect?.();
    if (r) { panel.style.left = `${Math.max(8, r.left)}px`; panel.style.bottom = `${Math.max(8, window.innerHeight - r.top + 8)}px`; }
    pintarFiltros();
    document.addEventListener('pointerdown', afuera, true);
  }

  function pintarFiltros() {
    marcarBotonFiltros();
    if (!panel) return;
    const sc = panel.querySelector('.tp-fp-cuerpo')?.scrollTop || 0;
    const aplicar = () => { E.redibujar(); pintarFiltros(); };
    const op = (k, v, t) => h('button', { type: 'button', class: `tp-chip${FILT[k] === v ? ' on' : ''}`, onclick: () => { if (FILT[k] === v) delete FILT[k]; else FILT[k] = v; aplicar(); } }, t);
    const om = (k, v, t) => h('button', { type: 'button', class: `tp-chip${(FILT[k] || []).includes(v) ? ' on' : ''}`, onclick: () => { const L = FILT[k] = FILT[k] || []; const i = L.indexOf(v); i >= 0 ? L.splice(i, 1) : L.push(v); aplicar(); } }, t);
    const sec = (t, nota, ...chips) => [h('p', { class: 'tp-fs' }, t, nota ? h('i', {}, ` ${nota}`) : null), h('div', { class: 'tp-chips' }, chips)];
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
      sec('FECHA', '', Object.entries(FN.fecha).map(([k, t]) => op('fecha', k, t)), FILT.fecha === 'rango' ? h('div', { class: 'tp-fp-rango' }, fecha, h('span', {}, 'a'), fecha2) : null),
      sec('HORA', '', Object.entries(FN.hora).map(([k, t]) => op('hora', k, t))),
      enHoy ? sec('ÁREA', 'una por vez en Hoy', [...areasActivas().map(a => [a.id, a.nombre]), ['_bandeja', 'Bandeja']].map(([k, n]) => h('button', { type: 'button', class: `tp-chip${VER.hoyArea === k ? ' on' : ''}`, onclick: () => { VER.hoyArea = VER.hoyArea === k ? '' : k; aplicar(); } }, n)))
        : enArea ? null : sec('ÁREA', 'podés elegir varias', [...areasActivas().map(a => om('area', a.id, a.nombre)), om('area', '_bandeja', 'Bandeja')]),
      sec('PROYECTO', 'podés elegir varios', om('proy', '_general', 'General'), om('proy', '_prog', 'Programadas'), proys.map(p => om('proy', p.id, p.nombre))),
      etiquetas.length ? sec('ETIQUETAS', '', etiquetas.map(e => om('etiq', e, `#${e}`)), h('span', { class: 'tp-fp-modo' }, [['cualq', 'Cualquiera'], ['todas', 'Todas']].map(([k, t]) => h('button', { type: 'button', class: (FILT.etiqModo || 'cualq') === k ? 'on' : '', onclick: () => { FILT.etiqModo = k; aplicar(); } }, t)))) : null,
      sec('ESTADO', '', Object.entries(FN.estado).map(([k, t]) => op('estado', k, t))),
      sec('CÓMO ES LA TAREA', '', Object.entries(FN.como).map(([k, t]) => om('como', k, t))),
      sec('DURACIÓN', '', Object.entries(FN.dur).map(([k, t]) => op('dur', k, t))),
      sec('ANTIGÜEDAD', '', Object.entries(FN.antig).map(([k, t]) => op('antig', k, t))),
      h('p', { class: 'tp-fs' }, 'TEXTO'), texto,
      h('p', { class: 'tp-fs' }, editando ? `CAMBIAR "${editando.nombre.toUpperCase()}"` : 'GUARDAR COMO VISTA'),
      h('input', { type: 'text', class: 'tp-fp-tx', placeholder: 'Nombre (ej: Llamadas)', value: guardar.nombre, oninput: (e) => { guardar.nombre = e.target.value; } }),
      h('div', { class: 'tp-fp-fila' }, h('span', {}, 'Ícono'), h('span', { class: 'tp-fp-ics' }, iconos.map(n => h('button', { type: 'button', class: guardar.icono === n ? 'on' : '', 'aria-label': n, onclick: () => { guardar.icono = n; pintarFiltros(); } }, ic(n))))),
      h('div', { class: 'tp-fp-fila' }, h('span', {}, 'Ordenar'), h('select', { onchange: (e) => { guardar.orden = e.target.value; } },
        [['fecha', 'Por fecha'], ['area', 'Por área'], ['dur', 'Por duración'], ['creacion', 'Por creación'], ['nombre', 'Por nombre']].map(([v, t]) => h('option', { value: v, selected: guardar.orden === v }, t)))),
      h('label', { class: 'tp-fp-fila' }, h('span', {}, 'Número en la columna'), h('input', { type: 'checkbox', checked: guardar.numero, onchange: (e) => { guardar.numero = e.target.checked; } })),
      h('button', { type: 'button', class: 'boton principal tp-fp-guardar', onclick: guardarFiltro }, editando ? 'Guardar cambios' : 'Guardar'));
    const n = chipsDe(FILT, d).length;
    panel.replaceChildren(
      h('div', { class: 'tp-fp-cab' }, h('b', {}, 'Filtrar'), n ? h('button', { type: 'button', class: 'tp-chip', onclick: () => { FILT = {}; aplicar(); } }, `Sacar todo (${n})`) : null,
        h('button', { type: 'button', class: 'tp-x', 'aria-label': 'Cerrar', onclick: cerrarFiltros }, '×')),
      h('p', { class: 'tp-mini' }, 'Se aplica a la lista que estás viendo. Tocá de nuevo para sacar.'),
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
    let id;
    if (editando) { await m.actualizarFiltro(editando.id, datos); id = editando.id; } else id = await m.crearFiltro(datos);
    FILT = {};
    Object.assign(guardar, { nombre: '', icono: 'filtro', orden: 'fecha', numero: true });
    cerrarFiltros();
    ctx.aviso(editando ? 'Filtro actualizado' : 'Filtro guardado en la columna');
    location.hash = `#/tareas/filtro/${id}`;
  }

  // El botón de la columna se pone amarillo con el número de filtros puestos.
  function marcarBotonFiltros() {
    const n = chipsDe(FILT, d).length + (VER.hoyArea && E.vista() === 'hoy' ? 1 : 0);
    for (const b of document.querySelectorAll('.pc-cpie [aria-label="Filtros"], .pc-tpie [data-filtros]')) {
      b.classList.toggle('on', !!n);
      b.dataset.n = n ? String(n) : '';
    }
  }

  // Al tildar: la fila se va (se achica) y donde llega brilla un momento.
  function alTildar(e) {
    const b = e.target.closest('.tr-check');
    if (!b) return;
    const li = b.closest('.tr-tarea');
    if (!li || li.classList.contains('hija')) return;
    recienHechas.add(li.dataset.id);
    li.classList.add(li.classList.contains('hecha') ? 'tp-vuelve' : 'tp-sale');
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
    alTildar,
  };
}
