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
import { iniciarSincronizacion, estadoSync } from './core/sincronizacion.js';
import { cargar, contexto, listaModulos, iniciarModulos } from './core/registro.js';
import { pantallaAjustes } from './core/ajustes.js';
import { escuchar } from './core/eventos.js';
import { h, icono, aviso } from './core/ui.js';
import { botonBusqueda } from './core/busqueda.js';
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
const engranaje = h('a', { href: '#/ajustes', class: 'barra-engranaje', 'aria-label': 'Ajustes', title: 'Ajustes', hidden: true }, icono('ajustes'));

// Menú del logo (solo celular): la barra de abajo tiene lugar para pocos,
// así que tocar el logo abre un panel con todos los módulos. En la PC el
// logo sigue llevando al Inicio, porque ahí ya está la columna con todos.
const panelModulos = h('div', { class: 'panel-modulos', id: 'panel-modulos', hidden: true });
const veloModulos = h('div', { class: 'velo-modulos', hidden: true, onclick: () => abrirPanel(false) });
const marca = h('a', { href: '#/home', class: 'marca', 'aria-controls': 'panel-modulos', onclick: (e) => {
  if (esPC()) return;
  e.preventDefault();
  abrirPanel(panelModulos.hidden);
} }, h('span', { class: 'marca-signo', 'aria-hidden': 'true' }), 'Segundo Cerebro', h('span', { class: 'marca-flecha', 'aria-hidden': 'true' }));

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
  const todos = [
    ...listaModulos().filter(m => !m.oculto && visible(m.id, 'cel')),
    { id: 'ajustes', nombre: 'Ajustes', icono: 'ajustes' },
  ];
  panelModulos.replaceChildren(
    h('div', { class: 'panel-grilla' }, todos.map(m => h('a', {
      href: `#/${m.id}`, class: 'panel-mod', 'aria-current': m.id === actual ? 'page' : null, onclick: () => abrirPanel(false),
    }, icono(m.icono), h('span', {}, m.nombre)))));
}

function itemsMenu() {
  const todos = [
    ...listaModulos().filter(m => !m.oculto).map(m => ({ id: m.id, nombre: m.nombre, icono: m.icono })),
    { id: 'ajustes', nombre: 'Ajustes', icono: 'ajustes' },
  ];
  if (esPC()) return todos.filter(it => visible(it.id, 'pc'));
  const orden = barraCelular(todos.map(it => it.id));
  return orden.map(id => todos.find(it => it.id === id)).filter(Boolean);
}

function dibujarMenu() {
  const items = itemsMenu();
  menu.replaceChildren(...items.map(it => h('a', { href: `#/${it.id}`, class: 'menu-item', 'data-id': it.id },
    icono(it.icono), h('span', {}, it.nombre))));
  menu.style.setProperty('--items', String(items.length));
  // En el celular, si Ajustes no está en la barra, queda un engranaje arriba.
  engranaje.hidden = esPC() || items.some(it => it.id === 'ajustes');
  marcarMenu(leerRuta().id);
}

function armarCascaron() {
  document.getElementById('app').replaceChildren(
    h('header', { class: 'barra' },
      marca,
      h('div', { class: 'barra-der' }, botonBusqueda(), h('div', { id: 'estado-sync' }), engranaje)),
    veloModulos,
    panelModulos,
    menu,
    h('main', { id: 'pantalla', tabindex: '-1' }),
  );
  dibujarMenu();
  dibujarEstado();
  escuchar('sync', dibujarEstado);
  escuchar('sesion', dibujarEstado);
  escuchar('preferencias', dibujarMenu);
  matchMedia('(min-width: 900px)').addEventListener('change', () => { abrirPanel(false); dibujarMenu(); });
  window.addEventListener('hashchange', () => abrirPanel(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panelModulos.hidden) abrirPanel(false); });
}

function marcarMenu(id) {
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

  if (id === 'ajustes') {
    limpiarPantalla = pantallaAjustes(pantalla);
    return;
  }

  pantalla.replaceChildren(h('p', { class: 'cargando' }, 'Abriendo…'));
  try {
    const def = await cargar(id);
    if (mio !== turno) return;
    if (!def) { location.replace('#/' + INICIO); return; }
    pantalla.replaceChildren();
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
  armarCascaron();
  window.addEventListener('hashchange', mostrar);
  await mostrar();
  iniciarSincronizacion();
  registrarServiceWorker();
  iniciarModulos();
}

arrancar();
