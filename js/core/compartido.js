// ─────────────────────────────────────────────────────────────
// Lo que llega desde "Compartir" de Android (un link, un texto, una
// foto). El service worker lo recibe, lo deja guardado en el
// dispositivo y abre #/bitacora/compartir. Acá se lee.
// ─────────────────────────────────────────────────────────────

const CACHE = 'sc-compartido';
const url = (n) => new URL(`./__compartido/${n}`, location.href).href;

// { titulo, texto, url, archivos: [File] } o null si no hay nada.
export async function leer() {
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(url('datos'));
    if (!r) return null;
    const datos = await r.json();
    const archivos = [];
    for (const a of datos.archivos || []) {
      const f = await c.match(url(a.clave));
      if (f) archivos.push(new File([await f.blob()], a.nombre, { type: a.tipo }));
    }
    return { titulo: datos.titulo || '', texto: datos.texto || '', url: datos.url || '', archivos, llegada: datos.llegada || Date.now() };
  } catch {
    return null;
  }
}

export async function limpiar() {
  try { await caches.delete(CACHE); } catch { /* nada */ }
}
