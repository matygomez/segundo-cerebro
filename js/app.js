// ─────────────────────────────────────────────────────────────
// Arranque de la app: arma la estructura, la navegación entre
// módulos, el indicador de sincronización y las actualizaciones.
//
// Rutas: #/home, #/ajustes, #/<modulo>/<lo-que-el-modulo-quiera>
// Cada módulo se puede abrir directo por su ruta (sirve para los
// accesos directos del celular), sin pasar por Inicio.
// ─────────────────────────────────────────────────────────────

import * as db from './core/db.js';
import * as drive from './core/drive.js';
import { iniciarSincronizacion, estadoSync, sincronizar } from './core/sincronizacion.js';
import { cargar, contexto, listaModulos, iniciarModulos } from './core/registro.js';
import { armarBarraPC, marcarBarraPC, dibujarColumna, estadoUsuario } from './core/barra-pc.js';
import { pantallaAjustes } from './core/ajustes.js';
import { escuchar } from './core/eventos.js';
import { h, icono, aviso } from './core/ui.js';
import { botonBusqueda, abrirBusqueda } from './core/busqueda.js';
import { ventana } from './core/android.js';
import { abrirVentana, iniciarAndroid } from './core/android-app.js';
import { cargarPreferencias, visible, barraCelular, esPC, definirOcultosPorDefecto, definirFueraDeBarra } from './core/preferencias.js';

const INICIO = 'home';
let limpiarPantalla = null;
let turno = 0;

function leerRuta() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { id: partes[0] || INICIO, sub: partes.slice(1) };
}

// Menú: en la PC es la columna de la izquierda; en el celular, la barra
// de abajo. Qué se ve y en qué orden sale de Ajustes › Módulos.
// Los módulos ocultos (como el futuro Calendario) no aparecen.
const menu = h('nav', { class: 'menu', 'aria-label': 'Secciones' });

// Menú del logo (solo celular): la barra de abajo tiene lugar para pocos,
// así que tocar el logo abre un panel con todos los módulos. En la PC el
// logo sigue llevando al Inicio, porque ahí ya está la columna con todos.
const panelModulos = h('div', { class: 'panel-modulos', id: 'panel-modulos', hidden: true });
const veloModulos = h('div', { class: 'velo-modulos', hidden: true, onclick: () => abrirPanel(false) });
const marca = h('a', { href: '#/home', class: 'marca', 'aria-controls': 'panel-modulos', onclick: (e) => {
  if (esPC()) return;
  e.preventDefault();
  abrirPanel(panelModulos.hidden);
} }, h('span', { class: 'marca-cuad', 'aria-hidden': 'true' }, h('span', { class: 'marca-signo' })),
  h('span', { class: 'marca-nombre' }, 'Segundo Cerebro'), h('span', { class: 'marca-flecha', 'aria-hidden': 'true' }));

// Celular: tu foto arriba a la derecha, con el anillo de Drive (verde al día, amarillo subiendo,
// rojo con problema, gris sin Drive). Tocarla abre el mismo menú que el logo.
const fotoCel = h('button', { type: 'button', class: 'foto-cel', 'aria-label': 'Tu cuenta y el menú', onclick: (e) => { e.stopPropagation(); abrirPanel(panelModulos.hidden); } },
  h('span', { class: 'pc-av apagado' }, icono('persona')));
let textoSync = 'Sin Drive', driveDesconectado = true;

// Celular: pestañas del módulo en una fila debajo del nombre (las mismas de la columna de la PC).
// Se deslizan de costado; al final, Filtros y Configurar si el módulo los tiene.
const pestanasCel = h('nav', { class: 'pest-cel', hidden: true, 'aria-label': 'Pestañas del módulo' });
// Selector de mes (Finanzas) junto a la lupa, y botón + abajo con lo que el módulo ofrece (Egreso, Ingreso…).
const mesCel = h('div', { class: 'mes-cel', hidden: true });
const fabCel = h('div', { class: 'fab-cel', hidden: true });
function dibujarMesYBotones(extra) {
  const mes = extra?.mes;
  mesCel.hidden = !mes;
  if (mes) {
    mesCel.replaceChildren(
      h('button', { type: 'button', 'aria-label': 'Mes anterior', disabled: !mes.puedeAntes, onclick: () => mes.mover(-1) }, icono('flecha-izq')),
      h('button', { type: 'button', class: `mes-cel-c${mes.otro ? ' otro' : ''}`, title: 'Volver al mes actual', onclick: () => mes.mover(0) }, mes.texto.slice(0, 3)),
      h('button', { type: 'button', 'aria-label': 'Mes siguiente', disabled: !mes.puedeDespues, onclick: () => mes.mover(1) }, icono('flecha-der')));
  }
  const botones = extra?.botones || [];
  fabCel.hidden = !botones.length;
  fabCel.classList.remove('abierto');
  if (!botones.length) { fabCel.replaceChildren(); return; }
  const opciones = h('div', { class: 'fab-cel-op' }, botones.map(b => h('button', { type: 'button', onclick: () => { fabCel.classList.remove('abierto'); b.alTocar?.(); } },
    b.signo ? h('b', {}, b.signo) : (b.icono instanceof Node ? b.icono.cloneNode(true) : icono(b.icono || 'mas')), h('span', {}, b.texto))));
  fabCel.replaceChildren(opciones, h('button', { type: 'button', class: 'fab-cel-b', 'aria-label': 'Agregar', onclick: (e) => {
    e.stopPropagation();
    if (botones.length === 1) { botones[0].alTocar?.(); return; }
    fabCel.classList.toggle('abierto');
  } }, icono('mas')));
}
document.addEventListener('click', (e) => { if (!fabCel.contains(e.target)) fabCel.classList.remove('abierto'); });

function dibujarPestanas(def, extra, { conf, filtrar } = {}) {
  dibujarMesYBotones(extra);
  if (!extra?.grupos) { pestanasCel.hidden = true; pestanasCel.replaceChildren(); return; }
  const izq = pestanasCel.scrollLeft;
  const pest = extra.grupos.filter(g => g.enCel !== false).flatMap(g => g.pestañas).map(p => h('a', { href: p.href, class: 'pest-cel-p', 'aria-current': p.activa ? 'page' : null },
    p.nombre, p.n ? h('span', { class: 'pest-cel-n' }, String(p.n)) : null));
  const confAttrs = typeof conf === 'function' ? { href: '#', onclick: (e) => { e.preventDefault(); conf(); } } : { href: conf || '#/ajustes' };
  pestanasCel.replaceChildren(...[...pest,
    filtrar ? h('button', { type: 'button', class: 'pest-cel-ic', 'aria-label': 'Filtros', onclick: filtrar }, icono('filtro')) : null,
    conf ? h('a', { ...confAttrs, class: 'pest-cel-ic', 'aria-label': `Configurar ${def.nombre}` }, icono('engranaje')) : null].filter(Boolean));
  pestanasCel.hidden = false;
  // La pestaña elegida queda a la vista (si estaba fuera de la pantalla, se corre la fila).
  pestanasCel.scrollLeft = izq;
  const activa = pestanasCel.querySelector('[aria-current="page"]');
  if (activa && (activa.offsetLeft < pestanasCel.scrollLeft || activa.offsetLeft + activa.offsetWidth > pestanasCel.scrollLeft + pestanasCel.clientWidth)) {
    pestanasCel.scrollLeft = activa.offsetLeft - 12;
  }
}

function abrirPanel(abrir) {
  if (abrir) {
    dibujarPanel();
    // Baja justo debajo de la barra de arriba, que cambia de alto según el celular.
    const borde = `${marca.closest('.barra').getBoundingClientRect().bottom}px`;
    panelModulos.style.top = veloModulos.style.top = borde;
  }
  panelModulos.hidden = veloModulos.hidden = !abrir;
  marca.classList.toggle('abierto', abrir);
  marca.setAttribute('aria-expanded', String(abrir));
}

function dibujarPanel() {
  const actual = leerRuta().id;
  const cerrar = () => abrirPanel(false);
  const todos = listaModulos().filter(m => !m.oculto && !m.fueraDePC && visible(m.id, 'cel'));
  const fila = (ic, texto, alTocar, clase = '') => h('button', { type: 'button', class: `panel-fila ${clase}`, onclick: () => { cerrar(); alTocar(); } }, icono(ic), h('span', {}, texto));
  const tono = fotoCel.firstChild.className;
  panelModulos.replaceChildren(
    h('div', { class: 'panel-us' }, h('span', { class: tono }, icono('persona')),
      h('div', {}, h('b', {}, 'Mi cuenta'), h('small', { class: tono.split(' ')[1] || '' }, textoSync))),
    h('button', { type: 'button', class: 'panel-bus', onclick: () => { cerrar(); abrirBusqueda(); } }, icono('lupa'), h('span', {}, 'Buscar en todo…')),
    h('div', { class: 'panel-grilla' }, todos.map(m => h('a', {
      href: `#/${m.id}`, class: 'panel-mod', 'aria-current': m.id === actual ? 'page' : null, onclick: cerrar,
    }, icono(m.icono), h('span', {}, m.nombre)))),
    fila('engranaje', 'Configuración', () => { location.hash = '#/ajustes'; }),
    driveDesconectado ? fila('nube', 'Conectar Drive', conectarDrive) : fila('girar', 'Sincronizar ahora', () => sincronizar()));
}

function itemsMenu() {
  const todos = [
    ...listaModulos().filter(m => !m.oculto).map(m => ({ id: m.id, nombre: m.nombre, icono: m.icono })),
    { id: 'ajustes', nombre: 'Configuración', icono: 'engranaje' },
  ];
  // Lo que está unido a otro módulo (Resumen va dentro del Inicio) no sale en la barra (PC y celular).
  const unido = (id) => !!listaModulos().find(m => m.id === id)?.fueraDePC;
  if (esPC()) return todos.filter(it => visible(it.id, 'pc') && !unido(it.id));
  const orden = barraCelular(todos.filter(it => !unido(it.id)).map(it => it.id));
  return orden.map(id => todos.find(it => it.id === id)).filter(Boolean);
}

function dibujarMenu() {
  const items = itemsMenu();
  menu.replaceChildren(...items.map(it => h('a', { href: `#/${it.id}`, class: 'menu-item', 'data-id': it.id },
    icono(it.icono), h('span', {}, it.nombre))));
  menu.style.setProperty('--items', String(items.length));
  marcarMenu(leerRuta().id);
}

function armarCascaron() {
  document.getElementById('app').replaceChildren(
    h('header', { class: 'barra' },
      marca,
      h('div', { class: 'barra-der' }, mesCel, botonBusqueda(), h('div', { id: 'estado-sync' }), fotoCel),
      pestanasCel),
    veloModulos,
    panelModulos,
    menu,
    fabCel,
    // PC: barra de módulos y columna del módulo (en el celular no se ven)
    armarBarraPC({ items: () => itemsMenu(), alBuscar: () => abrirBusqueda(), alSincronizar: () => sincronizar(), alConectar: conectarDrive, alPestanas: dibujarPestanas }),
    h('main', { id: 'pantalla', tabindex: '-1' }),
  );
  dibujarMenu();
  dibujarEstado();
  escuchar('sync', dibujarEstado);
  escuchar('sesion', dibujarEstado);
  escuchar('preferencias', () => { dibujarMenu(); marcarBarraPC(leerRuta().id, true); });
  matchMedia('(min-width: 900px)').addEventListener('change', () => { abrirPanel(false); dibujarMenu(); });
  window.addEventListener('hashchange', () => abrirPanel(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panelModulos.hidden) abrirPanel(false); });
}

async function conectarDrive() {
  try { await drive.conectar(); } catch (err) { aviso(err.message); }
}

function marcarMenu(id) {
  marcarBarraPC(id);
  // Celular: arriba va el nombre del módulo abierto (el logo abre el menú con todos).
  const nombre = id === 'ajustes' ? 'Configuración' : listaModulos().find(m => m.id === id)?.nombre;
  marca.querySelector('.marca-nombre').textContent = nombre || 'Segundo Cerebro';
  for (const a of document.querySelectorAll('.menu-item')) {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

async function mostrar() {
  const mio = ++turno;
  const { id, sub } = leerRuta();
  const pantalla = document.getElementById('pantalla');
  try { limpiarPantalla?.(); } catch (e) { console.error(e); }
  limpiarPantalla = null;
  marcarMenu(id);

  animarEntrada(pantalla);
  if (id === 'ajustes') {
    dibujarColumna({ id: 'ajustes', nombre: 'Configuración', icono: 'engranaje' }, null);
    limpiarPantalla = pantallaAjustes(pantalla);
    return;
  }

  pantalla.replaceChildren(h('p', { class: 'cargando' }, 'Abriendo…'));
  try {
    const def = await cargar(id);
    if (mio !== turno) return;
    if (!def) { location.replace('#/' + INICIO); return; }
    pantalla.replaceChildren();
    dibujarColumna(def, contexto(def.id));
    const r = await def.pantalla(pantalla, contexto(def.id), sub);
    if (mio !== turno) { if (typeof r === 'function') r(); return; }
    limpiarPantalla = typeof r === 'function' ? r : null;
  } catch (e) {
    console.error(e);
    if (mio !== turno) return;
    pantalla.replaceChildren(h('section', { class: 'tarjeta error-seccion' },
      h('h2', {}, 'No se pudo abrir esta sección'),
      h('p', { class: 'error-msj' }, e.message),
      h('p', { class: 'nota' }, 'Puede pasar si la app quedó a medio actualizar. "Forzar actualización" vuelve a bajar la app completa; tus datos no se tocan.'),
      h('div', { class: 'botonera' },
        h('button', { type: 'button', class: 'boton principal', onclick: forzarActualizacion }, 'Forzar actualización'),
        h('a', { href: '#/' + INICIO, class: 'boton' }, 'Volver a Inicio'))));
  }
}

// En la PC, al abrir una pantalla sus tarjetas aparecen una detrás de otra.
// Solo al entrar: si se redibuja por un cambio de datos, no se vuelve a animar.
let quitarEntrada = null;
function animarEntrada(pantalla) {
  clearTimeout(quitarEntrada);
  pantalla.classList.remove('entrando');
  void pantalla.offsetWidth;
  pantalla.classList.add('entrando');
  quitarEntrada = setTimeout(() => pantalla.classList.remove('entrando'), 900);
}

// Borra la copia guardada de la app y la vuelve a bajar. Los datos no se tocan.
async function forzarActualizacion() {
  if (!navigator.onLine) { aviso('Necesitás internet para forzar la actualización.'); return; }
  try {
    for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister();
    for (const k of await caches.keys()) if (k !== 'sc-imagenes' && k !== 'sc-fuentes' && k !== 'sc-compartido') await caches.delete(k);
  } catch (e) { console.warn(e); }
  location.reload();
}

function dibujarEstado() {
  const zona = document.getElementById('estado-sync');
  if (!zona) return;
  const s = estadoSync();
  const e = drive.estado();
  let ic = 'nube-off', texto = 'Sin Drive', clase = '', alTocar = () => { location.hash = '#/ajustes'; };

  if (e === 'desconectado') {
    ic = 'nube'; texto = s.ultima ? 'Reconectar' : 'Conectar Drive'; clase = 'atencion';
    alTocar = async () => { try { await drive.conectar(); } catch (err) { aviso(err.message); } };
  } else if (e === 'conectado') {
    ({
      sincronizando: () => { ic = 'girar'; texto = 'Sincronizando'; clase = 'girando'; },
      'sin-internet': () => { ic = 'nube-off'; texto = 'Sin internet'; },
      error: () => { ic = 'alerta'; texto = 'Error al sincronizar'; clase = 'atencion'; },
    }[s.fase] || (() => { ic = 'nube-check'; texto = 'Guardado en Drive'; }))();
    if (s.pendientes && s.fase !== 'sincronizando') texto = `${s.pendientes} sin subir`;
  }
  zona.replaceChildren(h('button', { class: `chip-sync ${clase}`, onclick: alTocar, title: 'Estado de sincronización' }, icono(ic), h('span', {}, texto)));
  // Anillo de color alrededor de la foto (PC): verde al día, amarillo subiendo, rojo con problema, gris sin Drive.
  const tono = e !== 'conectado' ? 'apagado' : s.fase === 'sincronizando' ? 'subiendo' : (s.fase === 'error' || s.fase === 'sin-internet') ? 'problema' : s.pendientes ? 'subiendo' : 'aldia';
  estadoUsuario(tono, texto, e === 'desconectado');
  fotoCel.firstChild.className = `pc-av ${tono}`;
  textoSync = texto; driveDesconectado = e === 'desconectado';
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (!reg) return;
    const ofrecer = (sw) => aviso('Hay una versión nueva de la app.', {
      accion: 'Actualizar', duracion: 0, alTocar: () => sw.postMessage('actualizar'),
    });
    if (reg.waiting && navigator.serviceWorker.controller) ofrecer(reg.waiting);
    // Buscar versión nueva cada vez que la app vuelve a primer plano
    // (en el celular muchas veces no se abre "de cero").
    let ultima = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultima < 60_000) return;
      ultima = Date.now();
      reg.update().catch(() => {});
    });
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) ofrecer(nuevo);
      });
    });
  }).catch(e => console.warn('Sin modo sin conexión:', e));

  // Solo se recarga cuando una versión nueva reemplaza a otra,
  // no la primera vez que la app se instala.
  let primeraInstalacion = !navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (primeraInstalacion) { primeraInstalacion = false; return; }
    if (recargando) return;
    recargando = true;
    location.reload();
  });
}

async function arrancar() {
  try {
    await db.abrir();
  } catch (e) {
    document.getElementById('app').textContent = 'Este navegador no permite guardar datos (IndexedDB). Probá con Chrome sin modo incógnito.';
    return;
  }
  drive.restaurar();
  drive.reconectarAlTocar();
  definirOcultosPorDefecto(listaModulos().filter(m => m.ocultoPorDefecto).map(m => m.id));
  definirFueraDeBarra(listaModulos().filter(m => m.fueraDeBarra).map(m => m.id));
  await cargarPreferencias();
  // Ventanita del panel de Android (Finanzas, Nueva tarea, Anotar): solo el formulario.
  const cual = ventana();
  if (cual) { abrirVentana(cual); return; }
  armarCascaron();
  window.addEventListener('hashchange', mostrar);
  await mostrar();
  iniciarSincronizacion();
  registrarServiceWorker();
  iniciarModulos();
  iniciarAndroid();
}

arrancar();
