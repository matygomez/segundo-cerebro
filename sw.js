// ─────────────────────────────────────────────────────────────
// Service worker: guarda los archivos de la app en el teléfono
// para que abra sin internet, y avisa cuando hay versión nueva.
//
// En cada actualización hay que cambiar VERSION (y sumar a
// ARCHIVOS los módulos nuevos).
// ─────────────────────────────────────────────────────────────

const VERSION = 'sc-0.23.1';

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
  './js/core/preferencias.js',
  './js/core/calendario.js',
  './js/core/compartido.js',
  './js/core/editor-texto.js',
  './js/core/inicio.js',
  './js/core/ajustes-inicio.js',
  './js/core/espejo.js',
  './js/core/registro.js',
  './js/core/busqueda.js',
  './js/core/sincronizacion.js',
  './js/core/ui.js',
  './modules/home/modulo.js',
  './modules/tareas/modulo.js',
  './modules/tareas/modelo.js',
  './modules/tareas/vistas.js',
  './modules/tareas/editor.js',
  './modules/tareas/arrastre.js',
  './modules/tareas/calendario.js',
  './modules/tareas/tareas.css',
  './modules/calendario/modulo.js',
  './modules/calendario/calendario.css',
  './modules/calendario/semana.js',
  './modules/habitos/modulo.js',
  './modules/habitos/modelo.js',
  './modules/habitos/vistas.js',
  './modules/habitos/habitos.css',
  './modules/resumen/modulo.js',
  './modules/resumen/datos.js',
  './modules/resumen/vistas.js',
  './modules/resumen/resumen.css',
  './modules/finanzas/modulo.js',
  './modules/finanzas/modelo.js',
  './modules/finanzas/comun.js',
  './modules/finanzas/formularios.js',
  './modules/finanzas/vistas.js',
  './modules/finanzas/movimientos.js',
  './modules/finanzas/config.js',
  './modules/finanzas/analisis.js',
  './modules/finanzas/control.js',
  './modules/finanzas/recordatorios.js',
  './modules/finanzas/finanzas.css',
  './modules/bitacora/modulo.js',
  './modules/bitacora/modelo.js',
  './modules/bitacora/markdown.js',
  './modules/bitacora/vistas.js',
  './modules/bitacora/nota.js',
  './modules/bitacora/base.js',
  './modules/bitacora/filmoteca.js',
  './modules/bitacora/tmdb.js',
  './modules/bitacora/ordenar.js',
  './modules/bitacora/bitacora.css',
];

const FUENTES = 'sc-fuentes';
const COMPARTIDO = 'sc-compartido';

// "Compartir" desde otra app de Android: llega acá, se guarda en el
// dispositivo y se abre la Bitácora para ordenarlo.
async function recibirCompartido(req) {
  const datos = await req.formData();
  const c = await caches.open(COMPARTIDO);
  const base = new URL('./__compartido/', self.registration.scope).href;
  const archivos = [];
  let i = 0;
  for (const f of datos.getAll('archivos')) {
    if (!(f instanceof File) || !f.size) continue;
    const clave = `archivo-${i++}`;
    await c.put(base + clave, new Response(f));
    archivos.push({ clave, nombre: f.name || `compartido-${Date.now()}`, tipo: f.type || '' });
  }
  const info = { titulo: datos.get('titulo') || '', texto: datos.get('texto') || '', url: datos.get('url') || '', archivos, llegada: Date.now() };
  await c.put(base + 'datos', new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
  return Response.redirect(new URL('./#/bitacora/compartir', self.registration.scope).href, 303);
}

// Al instalar una versión se bajan TODOS los archivos frescos: sin copias del
// navegador ni de GitHub (el "?v=" obliga a traer la versión nueva). Así no
// quedan archivos viejos mezclados con nuevos. Si alguno falla, no se instala
// a medias: se reintenta la próxima vez.
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(ARCHIVOS.map(async (u) => {
      const r = await fetch(new Request(`${u}${u.includes('?') ? '&' : '?'}v=${VERSION}`, { cache: 'reload' }));
      if (!r.ok) throw new Error(`No se pudo bajar ${u}`);
      await c.put(u, r);
    }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== FUENTES && k !== COMPARTIDO && k !== 'sc-imagenes') await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/compartir')) {
    e.respondWith(recibirCompartido(req).catch(() => Response.redirect(new URL('./#/bitacora', self.registration.scope).href, 303)));
    return;
  }
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
      const r = await fetch(req, { cache: 'reload' });
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      if (req.mode === 'navigate') return c.match('./index.html');
      throw err;
    }
  })());
});
