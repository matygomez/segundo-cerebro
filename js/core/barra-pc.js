// ─────────────────────────────────────────────────────────────
// Base de la PC: barra de módulos (izquierda) y columna del módulo.
//
// - Barra de módulos: logo (agranda/achica la barra), buscador,
//   módulos con su ícono, Configuración y el usuario con un anillo
//   de color que muestra el estado de Drive.
// - Columna del módulo: cuadrito amarillo con el ícono, nombre,
//   botón principal y, cuando el módulo las tenga, sus pestañas.
//   Tocando el título se pliega a una tira angosta.
//
// En el celular nada de esto se ve (sigue la barra de abajo).
// Lo que cada usuario deja abierto o plegado se recuerda en este
// navegador (es solo una preferencia de pantalla).
// ─────────────────────────────────────────────────────────────

import { h, icono } from './ui.js';
import { listaModulos } from './registro.js';
import { escuchar } from './eventos.js';

const CLAVE = 'sc-barras-pc';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { return {}; } };
const guardar = (cambios) => { try { localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), ...cambios })); } catch { /* sin espacio o bloqueado: no pasa nada */ } };

const app = () => document.getElementById('app');
let opciones = null;
let rail, lista, pie, col, tira, avatar, usTexto, menuUs;
let actual = '';

export function armarBarraPC(op) {
  opciones = op;
  const pref = leer();
  // Se aplican apenas el #app existe (el cascarón se arma en el mismo turno).
  queueMicrotask(() => {
    app()?.classList.toggle('rail-ab', !!pref.abierta);
    app()?.classList.toggle('col-plegada', !!pref.plegada);
  });

  lista = h('nav', { class: 'pc-mods', 'aria-label': 'Módulos' });
  pie = h('div', { class: 'pc-pie' });
  avatar = h('span', { class: 'pc-av apagado', 'aria-hidden': 'true' }, icono('persona'));
  usTexto = h('small', {}, 'Sin Drive');
  menuUs = h('div', { class: 'pc-menu-us', hidden: true, role: 'menu' });

  rail = h('aside', { class: 'pc-rail' },
    h('button', { type: 'button', class: 'pc-logo', title: 'Agrandar o achicar la barra', onclick: alternarRail },
      h('span', { class: 'pc-logo-cuad' }, h('span', { class: 'marca-signo' })), h('span', { class: 'pc-tx pc-logo-tx' }, 'Segundo Cerebro')),
    h('button', { type: 'button', class: 'pc-it pc-bus', 'data-tip': 'Buscar (Ctrl K)', 'aria-label': 'Buscar en todo (Ctrl K)', onclick: () => opciones.alBuscar() },
      icono('lupa'), h('span', { class: 'pc-tx' }, 'Buscar'), h('kbd', { class: 'pc-tx' }, 'Ctrl K')),
    lista,
    pie,
    h('button', { type: 'button', class: 'pc-us', 'data-tip': 'Mi cuenta', 'aria-label': 'Tu cuenta', onclick: (e) => { e.stopPropagation(); abrirMenuUsuario(); } },
      avatar, h('span', { class: 'pc-tx pc-us-tx' }, h('b', {}, 'Mi cuenta'), usTexto)),
    menuUs);

  col = h('div', { class: 'pc-col' });
  tira = h('div', { class: 'pc-tira' });
  armarCartelito();
  document.addEventListener('click', (e) => { if (!menuUs.hidden && !menuUs.contains(e.target)) menuUs.hidden = true; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menuUs.hidden = true;
    // Ctrl+B pliega o despliega la columna del módulo (como en otros programas).
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && matchMedia('(min-width: 900px)').matches) { e.preventDefault(); alternarColumna(); }
  });
  return h('div', { class: 'pc-marco' }, rail, h('aside', { class: 'pc-colw' }, col, tira));
}

// Cartelito con el nombre al pasar el mouse cuando la barra o la columna están achicadas:
// sale enseguida (el de Windows tarda y no sigue el estilo de la app).
function armarCartelito() {
  const tip = h('div', { class: 'pc-tip', hidden: true, role: 'tooltip' });
  document.body.append(tip);
  const mostrar = (e) => {
    const el = e.target.closest?.('[data-tip]');
    const enRail = el && rail.contains(el);
    const achicado = enRail ? !app().classList.contains('rail-ab') : app().classList.contains('col-plegada');
    if (!el || !achicado || !(enRail || tira.contains(el) || col.contains(el))) { tip.hidden = true; return; }
    const r = el.getBoundingClientRect();
    tip.textContent = el.dataset.tip;
    tip.style.left = `${r.right + 10}px`;
    tip.style.top = `${r.top + r.height / 2}px`;
    tip.hidden = false;
  };
  document.addEventListener('mouseover', mostrar);
  document.addEventListener('click', () => { tip.hidden = true; });
}

function alternarRail() {
  const abierta = !app().classList.contains('rail-ab');
  app().classList.toggle('rail-ab', abierta);
  guardar({ abierta });
}
function alternarColumna(plegar) {
  const plegada = plegar ?? !app().classList.contains('col-plegada');
  app().classList.toggle('col-plegada', plegada);
  guardar({ plegada });
}

// Los módulos de la barra (mismo orden y visibilidad que Configuración › Módulos).
export function marcarBarraPC(id, redibujar = false) {
  actual = id;
  if (!lista) return;
  if (redibujar || !lista.childElementCount) {
    const items = opciones.items();
    const enlace = (it) => h('a', { href: `#/${it.id}`, class: 'pc-it', 'data-id': it.id, 'data-tip': it.nombre, 'aria-label': it.nombre }, icono(it.icono), h('span', { class: 'pc-tx' }, it.nombre));
    lista.replaceChildren(...items.filter(it => it.id !== 'ajustes').map(enlace));
    const conf = items.find(it => it.id === 'ajustes') || { id: 'ajustes', nombre: 'Configuración', icono: 'engranaje' };
    pie.replaceChildren(enlace(conf));
  }
  for (const a of rail.querySelectorAll('[data-id]')) a.toggleAttribute('aria-current', a.dataset.id === id);
}

// Anillo de Drive alrededor de la foto: aldia | subiendo | problema | apagado.
export function estadoUsuario(tono, texto, desconectado) {
  if (!avatar) return;
  avatar.className = `pc-av ${tono}`;
  usTexto.textContent = texto;
  usTexto.className = tono;
  avatar.parentElement.dataset.desconectado = desconectado ? '1' : '';
}

function abrirMenuUsuario() {
  if (!menuUs.hidden) { menuUs.hidden = true; return; }
  const desconectado = avatar.parentElement.dataset.desconectado === '1';
  const op = (ic, texto, alTocar, clase = '') => h('button', { type: 'button', class: `pc-mu ${clase}`, role: 'menuitem', onclick: () => { menuUs.hidden = true; alTocar(); } }, icono(ic), h('span', {}, texto));
  menuUs.replaceChildren(
    h('div', { class: 'pc-mu-cab' }, h('span', { class: avatar.className }, icono('persona')), h('div', {}, h('b', {}, 'Mi cuenta'), h('small', {}, usTexto.textContent))),
    desconectado ? op('nube', 'Conectar Drive', opciones.alConectar) : op('girar', 'Sincronizar ahora', opciones.alSincronizar),
    op('engranaje', 'Configuración', () => { location.hash = '#/ajustes'; }),
    h('div', { class: 'pc-mu pc-mu-prox' }, icono('salir'), h('span', {}, 'Salir de la cuenta'), h('small', {}, 'llega con los usuarios')),
  );
  menuUs.hidden = false;
}

// ── Columna del módulo ──
// Cada módulo puede (más adelante) exportar columna(ctx) → { contexto, textoBoton?, grupos: [{ titulo, pestañas: [{ id, nombre, icono, href, activa }] }],
//   configurar: '#/ruta', filtros(boton) → abre sus filtros,
//   botones?: [{ texto, icono?, alTocar }] (el primero grande, los demás en una fila chica),
//   mes?: { texto, otro, puedeAntes, puedeDespues, mover(n) } (n = -1, 1, o 0 para volver al actual) }.
// Un módulo pide redibujar la columna (por ejemplo al cambiar de mes) con window.dispatchEvent(new Event('pc-columna')).
// Mientras no la tenga, la columna muestra el nombre y el botón principal.
// Dónde se configura cada módulo, hasta que cada uno lo mande en columna() → configurar.
const CONFIGURAR_DE = { finanzas: '#/finanzas/config', bitacora: '#/bitacora/ajustes', habitos: '#/habitos/config', compras: '#/compras/ajustes', resumen: '#/resumen/config', home: '#/ajustes/inicio' };
let turno = 0;
let ultima = null, esperaCol = null;
// Si cambian los datos del módulo abierto, la columna se vuelve a dibujar (números al día).
escuchar('datos', (e) => {
  if (!ultima || e?.modulo !== ultima.def.id || !ultima.def.columna) return;
  clearTimeout(esperaCol);
  esperaCol = setTimeout(() => dibujarColumna(ultima.def, ultima.ctx, { sinAnimar: true }), 250);
});
addEventListener('pc-columna', () => { if (ultima) dibujarColumna(ultima.def, ultima.ctx, { sinAnimar: true }); });
// El ícono puede venir como nombre (íconos de la app) o ya dibujado por el módulo.
const iconoDe = (x) => (x instanceof Node ? x.cloneNode(true) : icono(x || 'punto'));
export async function dibujarColumna(def, ctx, { sinAnimar = false } = {}) {
  if (!col) return;
  // Dentro del mismo módulo (ir de Hoy a Bandeja, por ejemplo) la columna no se anima:
  // se marca enseguida la pestaña nueva y después se actualizan los números.
  if (ultima?.def.id === def.id) {
    sinAnimar = true;
    const ruta = location.hash.split('?')[0];
    for (const a of [...col.querySelectorAll('.pc-pest'), ...tira.querySelectorAll('.pc-ti[href]')]) {
      const h = a.getAttribute('href');
      if (h === ruta) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
  }
  ultima = { def, ctx };
  const mio = ++turno;
  const gris = def.id === 'ajustes';
  // El ícono está en el registro de módulos (js/modulos.js), no siempre en la definición.
  const ic = def.icono || listaModulos().find(m => m.id === def.id)?.icono || 'punto';
  const cuad = (cls = '') => h('span', { class: `pc-cuad ${gris ? 'gris' : ''} ${cls}`.trim() }, icono(ic));

  // Botón principal: el primer botón rápido que el módulo ofrece al Inicio ("+ Tarea", "+ Gasto"…).
  let boton = null;
  try { boton = (await def.botonesInicio?.(ctx))?.[0] || null; } catch { boton = null; }
  let extra = null;
  try { extra = def.columna ? await def.columna(ctx) : null; } catch { extra = null; }
  if (mio !== turno) return;

  const cab = h('button', { type: 'button', class: 'pc-cab', title: 'Plegar la columna', onclick: () => alternarColumna(true) },
    cuad(), h('span', { class: 'pc-cab-tx' }, h('b', {}, def.nombre), extra?.contexto ? h('small', {}, extra.contexto) : null));
  const botones = extra?.botones || null;
  const prin = botones ? h('div', { class: 'pc-acc' },
    h('button', { type: 'button', class: 'pc-prin', onclick: () => botones[0].alTocar?.() }, h('b', {}, '+'), h('span', {}, botones[0].texto)),
    botones.length > 1 ? h('div', { class: 'pc-acc2' }, botones.slice(1).map(b => h('button', { type: 'button', class: 'pc-sec', onclick: () => b.alTocar?.() }, b.icono ? iconoDe(b.icono) : null, h('span', {}, b.texto)))) : null)
    : boton ? h('button', { type: 'button', class: 'pc-prin', onclick: () => boton.alTocar?.() }, h('b', {}, '+'), h('span', {}, extra?.textoBoton || boton.texto)) : null;
  // Selector de mes (Finanzas): flechas y, tocando el nombre, vuelve al mes actual.
  const mes = extra?.mes || null;
  const selMes = mes ? h('div', { class: 'pc-mes' },
    h('button', { type: 'button', 'aria-label': 'Mes anterior', title: mes.puedeAntes ? 'Mes anterior' : 'No hay nada cargado antes', disabled: !mes.puedeAntes, onclick: () => mes.mover(-1) }, icono('flecha-izq')),
    h('button', { type: 'button', class: `pc-mes-c${mes.otro ? ' otro' : ''}`, title: 'Volver al mes actual', onclick: () => mes.mover(0) }, mes.texto),
    h('button', { type: 'button', 'aria-label': 'Mes siguiente', title: mes.puedeDespues ? 'Mes siguiente' : 'No hay nada cargado después', disabled: !mes.puedeDespues, onclick: () => mes.mover(1) }, icono('flecha-der'))) : null;
  const grupos = (extra?.grupos || []).map(g => [
    g.titulo ? h('div', { class: 'pc-g' }, g.titulo) : null,
    ...g.pestañas.map(p => h('a', { href: p.href, class: 'pc-pest', 'aria-current': p.activa ? 'page' : null }, iconoDe(p.icono), h('span', {}, p.nombre), p.n ? h('span', { class: 'pc-n' }, String(p.n)) : null)),
  ]).flat();

  // Pie de la columna: Filtros (si el módulo los ofrece) y Configurar este módulo.
  const conf = gris ? null : (extra?.configurar || CONFIGURAR_DE[def.id] || '#/ajustes');
  // Configurar puede ser una ruta o algo que el módulo abre (por ejemplo una ventana).
  const confAttrs = typeof conf === 'function' ? { onclick: (e) => { e.preventDefault(); conf(); }, href: '#' } : { href: conf };
  const filtrar = extra?.filtros ? (e) => extra.filtros(e.currentTarget) : null;
  const tipFiltros = filtrar ? 'Filtros' : 'Filtros: llegan con el diseño nuevo de este módulo';
  const pieCol = gris ? null : h('div', { class: 'pc-cpie' },
    h('button', { type: 'button', class: 'pc-tb', 'data-tip': tipFiltros, title: tipFiltros, 'aria-label': 'Filtros', disabled: !filtrar, onclick: filtrar }, icono('filtro')),
    h('a', { ...confAttrs, class: 'pc-tb', 'data-tip': `Configurar ${def.nombre}`, title: `Configurar ${def.nombre}`, 'aria-label': `Configurar ${def.nombre}` }, icono('engranaje')));

  col.replaceChildren(...[cab, prin, selMes, ...grupos, pieCol].filter(Boolean));
  if (!sinAnimar) { col.classList.remove('cambia'); void col.offsetWidth; col.classList.add('cambia'); }

  const nuevo = botones ? [
    h('button', { type: 'button', class: 'pc-ti pc-ti-nuevo', 'data-tip': botones[0].texto, onclick: () => botones[0].alTocar?.() }, icono('mas'), h('small', {}, botones[0].texto)),
    ...botones.slice(1).map(b => h('button', { type: 'button', class: 'pc-ti', 'data-tip': b.texto, onclick: () => b.alTocar?.() }, b.icono ? iconoDe(b.icono) : icono('mas'), h('small', {}, b.texto)))]
    : boton ? h('button', { type: 'button', class: 'pc-ti pc-ti-nuevo', title: boton.texto, onclick: () => boton.alTocar?.() }, icono('mas'), h('small', {}, 'Nuevo')) : null;
  const mesTira = mes ? h('div', { class: 'pc-mest' },
    h('button', { type: 'button', 'aria-label': 'Mes anterior', disabled: !mes.puedeAntes, onclick: () => mes.mover(-1) }, icono('flecha-izq')),
    h('button', { type: 'button', class: `pc-mest-c${mes.otro ? ' otro' : ''}`, 'data-tip': `${mes.texto} · tocá para volver al actual`, onclick: () => mes.mover(0) }, mes.texto.slice(0, 3)),
    h('button', { type: 'button', 'aria-label': 'Mes siguiente', disabled: !mes.puedeDespues, onclick: () => mes.mover(1) }, icono('flecha-der'))) : null;
  tira.replaceChildren(...[
    h('button', { type: 'button', class: `pc-cuad ${gris ? 'gris' : ''} pc-tira-cuad`, title: `Abrir ${def.nombre}`, onclick: () => alternarColumna(false) }, icono(ic)),
    ...[nuevo].flat(),
    mesTira,
    ...(extra?.grupos || []).flatMap((g, i) => [
      i ? h('div', { class: 'pc-tsep' }) : null,
      ...g.pestañas.map(p => h('a', { href: p.href, class: 'pc-ti', 'data-tip': p.nombre, 'aria-current': p.activa ? 'page' : null }, iconoDe(p.icono), h('small', {}, p.nombre))),
    ]),
    gris ? null : h('div', { class: 'pc-tpie' },
      h('button', { type: 'button', class: 'pc-ti', 'data-tip': tipFiltros, 'data-filtros': '1', disabled: !filtrar, onclick: filtrar }, icono('filtro'), h('small', {}, 'Filtros')),
      h('a', { ...confAttrs, class: 'pc-ti', 'data-tip': `Configurar ${def.nombre}` }, icono('engranaje'), h('small', {}, 'Ajustes'))),
  ].filter(Boolean));
}
