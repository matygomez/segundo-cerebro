// ─────────────────────────────────────────────────────────────
// Vista previa de un documento dentro de la nota (PDF o foto).
//
// Por defecto se ve online: se baja de Drive cada vez que lo abrís y
// solo queda en la memoria mientras la app está abierta. Si tocás
// "Guardar en este dispositivo", queda guardado (caché "sc-imagenes",
// que sobrevive a las actualizaciones) y se ve también sin internet.
//
// Los PDF se dibujan con PDF.js (js/vendor/pdfjs), porque el navegador
// de Android no muestra PDFs adentro de una página.
// ─────────────────────────────────────────────────────────────

import { ic } from './vistas.js';

const CACHE = 'sc-imagenes';
const PDFJS = new URL('../../js/vendor/pdfjs/pdf.min.mjs', import.meta.url).href;
const WORKER = new URL('../../js/vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const claveLocal = (id) => new URL(`./__archivos/${encodeURIComponent(id)}`, location.href).href;
const enMemoria = new Map();   // driveId → blob (solo mientras la app está abierta)
const portadas = new Map();    // driveId → imagen de la primera página ya dibujada

export const esPDF = (a) => /pdf/i.test(a?.tipo || '') || /\.pdf$/i.test(a?.nombre || '');
export const esFoto = (a) => /^image\//.test(a?.tipo || '') || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(a?.nombre || '');
const idDe = (a) => a?.driveId || a?.pendiente || '';

async function guardado(a) {
  try { const r = await (await caches.open(CACHE)).match(claveLocal(idDe(a))); return r ? await r.blob() : null; } catch { return null; }
}
export async function estaGuardado(a) { return !!(await guardado(a)); }

// El contenido del archivo: lo guardado en el dispositivo, lo que ya se bajó en esta sesión, o de Drive.
async function contenido(ctx, a) {
  const id = idDe(a);
  if (enMemoria.has(id)) return enMemoria.get(id);
  const blob = (await guardado(a)) || await ctx.archivos.descargar(a);
  enMemoria.set(id, blob);
  return blob;
}

export async function guardarEnDispositivo(ctx, a) {
  const blob = await contenido(ctx, a);
  const c = await caches.open(CACHE);
  await c.put(claveLocal(idDe(a)), new Response(blob, { headers: { 'Content-Type': blob.type || a.tipo || 'application/octet-stream' } }));
  // El lector de PDF también, para poder abrirlo sin internet.
  if (esPDF(a)) await Promise.all([PDFJS, WORKER].map(u => fetch(u).catch(() => null)));
}
export async function quitarDelDispositivo(a) {
  try { await (await caches.open(CACHE)).delete(claveLocal(idDe(a))); } catch { /* nada */ }
}

let pdfjs = null;
async function lectorPDF() {
  if (!pdfjs) {
    pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  }
  return pdfjs;
}

async function dibujarPagina(pdf, n, ancho) {
  const pagina = await pdf.getPage(n);
  const base = pagina.getViewport({ scale: 1 });
  const escala = Math.min(3, (ancho * (window.devicePixelRatio || 1)) / base.width);
  const vista = pagina.getViewport({ scale: escala });
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.floor(vista.width);
  lienzo.height = Math.floor(vista.height);
  lienzo.className = 'bt-visor-pag';
  await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise;
  return lienzo;
}

const abrirPDF = async (blob) => (await lectorPDF()).getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;

// Recuadro con la primera página (o la foto). Tocarlo abre el visor a pantalla completa.
export function portada(ctx, a) {
  const { h } = ctx;
  const id = idDe(a);
  const caja = h('button', { type: 'button', class: 'bt-portada', 'aria-label': `Ver ${a.nombre}`, onclick: () => visor(ctx, a) }, h('span', { class: 'nota' }, 'Cargando vista previa…'));
  if (!esPDF(a) && !esFoto(a)) return null;
  (async () => {
    try {
      if (!portadas.has(id)) {
        const blob = await contenido(ctx, a);
        let src;
        if (esFoto(a)) src = URL.createObjectURL(blob);
        else {
          const pdf = await abrirPDF(blob);
          src = (await dibujarPagina(pdf, 1, 720)).toDataURL('image/jpeg', 0.85);
          if (pdf.numPages > 1) src = { src, paginas: pdf.numPages };
          pdf.destroy();
        }
        portadas.set(id, src);
      }
      const p = portadas.get(id);
      const src = typeof p === 'string' ? p : p.src;
      caja.replaceChildren(h('img', { src, alt: a.nombre }), typeof p === 'object' ? h('span', { class: 'bt-portada-n' }, `${p.paginas} páginas`) : null);
    } catch (e) {
      caja.disabled = true;
      caja.replaceChildren(h('span', { class: 'nota' }, navigator.onLine
        ? `No se pudo mostrar la vista previa (${e.message || e}).`
        : 'Sin internet no se puede mostrar. Guardalo en este dispositivo para verlo sin conexión.'));
    }
  })();
  return caja;
}

// Visor a pantalla completa: todas las páginas, una abajo de la otra.
export function visor(ctx, a) {
  const { h, icono } = ctx;
  const hojas = h('div', { class: 'bt-visor-hojas' }, h('p', { class: 'nota' }, 'Cargando…'));
  const botonGuardar = h('button', { type: 'button', class: 'boton' }, 'Guardar en este dispositivo');
  const pintarGuardar = async () => {
    const ya = await estaGuardado(a);
    botonGuardar.textContent = ya ? 'Quitar del dispositivo' : 'Guardar en este dispositivo';
    botonGuardar.onclick = async () => {
      try {
        if (ya) { await quitarDelDispositivo(a); ctx.aviso('Ya no está guardado en este dispositivo.'); }
        else { await guardarEnDispositivo(ctx, a); ctx.aviso('Guardado: lo podés ver sin internet en este dispositivo.'); }
        pintarGuardar();
      } catch (e) { ctx.aviso(e.message); }
    };
  };
  pintarGuardar();
  const dlg = h('dialog', { class: 'bt-visor' },
    h('header', { class: 'bt-visor-cab' },
      h('b', {}, a.nombre),
      botonGuardar,
      a.url ? h('a', { href: a.url, target: '_blank', rel: 'noopener', class: 'boton' }, ic('drive'), 'Drive') : null,
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
    hojas);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  (async () => {
    try {
      const blob = await contenido(ctx, a);
      if (esFoto(a)) { hojas.replaceChildren(h('img', { src: URL.createObjectURL(blob), alt: a.nombre, class: 'bt-visor-pag' })); return; }
      const pdf = await abrirPDF(blob);
      const ancho = Math.min(hojas.clientWidth || window.innerWidth, 1000);
      hojas.replaceChildren();
      for (let i = 1; i <= pdf.numPages && dlg.open; i++) hojas.append(await dibujarPagina(pdf, i, ancho));
      pdf.destroy();
    } catch (e) {
      hojas.replaceChildren(h('p', { class: 'nota' }, navigator.onLine ? `No se pudo abrir: ${e.message || e}` : 'Sin internet no se puede mostrar. Guardalo en este dispositivo para verlo sin conexión.'));
    }
  })();
}
