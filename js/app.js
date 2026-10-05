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
import { cargar, contexto, listaModulos } from './core/registro.js';
import { pantallaAjustes } from './core/ajustes.js';
import { escuchar } from './core/eventos.js';
import { h, icono, aviso } from './core/ui.js';

const INICIO = 'home';
let limpiarPantalla = null;
let turno = 0;

function leerRuta() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { id: partes[0] || INICIO, sub: partes.slice(1) };
}

function armarCascaron() {
  const items = [
    ...listaModulos().map(m => ({ id: m.id, nombre: m.nombre, icono: m.icono })),
    { id: 'ajustes', nombre: 'Ajustes', icono: 'ajustes' },
  ];
  const menu = h('nav', { class: 'menu', 'aria-label': 'Secciones' },
    items.map(it => h('a', { href: `#/${it.id}`, class: 'menu-item', 'data-id': it.id },
      icono(it.icono), h('span', {}, it.nombre))));

  document.getElementById('app').replaceChildren(
    h('header', { class: 'barra' },
      h('a', { href: '#/home', class: 'marca' }, h('span', { class: 'marca-signo', 'aria-hidden': 'true' }), 'Segundo Cerebro'),
      h('div', { id: 'estado-sync' })),
    menu,
    h('main', { id: 'pantalla', tabindex: '-1' }),
  );
  dibujarEstado();
  escuchar('sync', dibujarEstado);
  escuchar('sesion', dibujarEstado);
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
    pantalla.replaceChildren(h('section', { class: 'tarjeta' },
      h('h2', {}, 'No se pudo abrir esta sección'),
      h('p', {}, e.message),
      h('a', { href: '#/' + INICIO, class: 'boton' }, 'Volver a Inicio')));
  }
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
  armarCascaron();
  window.addEventListener('hashchange', mostrar);
  await mostrar();
  iniciarSincronizacion();
  registrarServiceWorker();
}

arrancar();
