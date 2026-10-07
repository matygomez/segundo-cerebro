// ─────────────────────────────────────────────────────────────
// Service worker: guarda los archivos de la app en el teléfono
// para que abra sin internet, y avisa cuando hay versión nueva.
//
// En cada actualización hay que cambiar VERSION (y sumar a
// ARCHIVOS los módulos nuevos).
// ─────────────────────────────────────────────────────────────

const VERSION = 'sc-0.4.1';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icono.svg',
  './icons/icono-192.png',
  './js/app.js',
  './js/config.js',
  './js/modulos.js',
  './js/core/ajustes.js',
  './js/core/archivos.js',
  './js/core/datos.js',
  './js/core/db.js',
  './js/core/drive.js',
  './js/core/eventos.js',
  './js/core/formularios.js',
  './js/core/fusion.js',
  './js/core/registro.js',
  './js/core/sincronizacion.js',
  './js/core/ui.js',
  './modules/home/modulo.js',
  './modules/tareas/modulo.js',
  './modules/tareas/modelo.js',
  './modules/tareas/vistas.js',
  './modules/tareas/editor.js',
  './modules/tareas/arrastre.js',
  './modules/tareas/tareas.css',
  './modules/finanzas/modulo.js',
  './modules/finanzas/modelo.js',
  './modules/finanzas/comun.js',
  './modules/finanzas/formularios.js',
  './modules/finanzas/vistas.js',
  './modules/finanzas/movimientos.js',
  './modules/finanzas/config.js',
  './modules/finanzas/finanzas.css',
];

const FUENTES = 'sc-fuentes';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== FUENTES) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google (inicio de sesión y Drive): siempre directo a internet.
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts.')) return;
  if (url.hostname === 'accounts.google.com') return;

  // Tipografías: se guardan la primera vez y después se usan sin internet.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FUENTES).then(async c => {
      const guardada = await c.match(req);
      if (guardada) return guardada;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Archivos de la app: primero la copia guardada (abre al instante y sin
  // internet); módulos nuevos que no estaban en la lista se guardan al usarse.
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const guardada = await c.match(req, { ignoreSearch: true });
    if (guardada) return guardada;
    try {
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      if (req.mode === 'navigate') return c.match('./index.html');
      throw err;
    }
  })());
});
