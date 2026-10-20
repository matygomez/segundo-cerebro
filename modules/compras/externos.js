// ─────────────────────────────────────────────────────────────
// Compras: lo que viene de afuera.
//   · Escáner de códigos de barras (BarcodeDetector en Android; si el
//     navegador no lo trae, como Chrome en Windows, zxing desde un CDN).
//   · Open Food Facts: nombre y marca por código (base libre, sin clave).
//   · Precios Claros (SEPA): precio de referencia en súper cercanos.
//     Si el navegador no deja leerlo, no pasa nada: queda el último pagado.
// ─────────────────────────────────────────────────────────────

import { adivinar, hoyISO, leerContenido, tipoDesdeNombre } from './modelo.js';

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';

// Abre la cámara a pantalla completa.
//  · continuo = false: devuelve el primer código leído (o null si cerraste).
//  · continuo = true: llama alLeer(codigo) por cada lectura hasta que cerrás.
// Siempre se puede escribir el código a mano.
export function escanear(ctx, { titulo = 'Apuntá al código de barras', continuo = false, alLeer } = {}) {
  const { h } = ctx;
  return new Promise((resolver) => {
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    const estado = h('small', { class: 'cp-esc-estado' }, 'Abriendo la cámara…');
    const contador = h('b', { class: 'cp-esc-cont' });
    const manual = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'O escribí el código', autocomplete: 'off' });
    let leidos = 0, ultimo = '', ultimoT = 0, terminado = false, parar = () => {};

    const leer = (codigo) => {
      codigo = String(codigo || '').replace(/\D/g, '');
      if (!codigo || terminado) return;
      const t = Date.now();
      if (codigo === ultimo && t - ultimoT < 1500) return;   // el mismo código sigue frente a la cámara
      ultimo = codigo; ultimoT = t;
      navigator.vibrate?.(40);
      if (!continuo) { cerrar(codigo); return; }
      leidos++; contador.textContent = `${leidos} leídos`;
      alLeer?.(codigo);
    };
    const cerrar = (valor = null) => {
      if (terminado) return;
      terminado = true;
      parar();
      dlg.close();
      dlg.remove();
      resolver(valor);
    };

    const dlg = h('dialog', { class: 'cp-esc' },
      h('div', { class: 'cp-esc-cam' }, video, h('div', { class: 'cp-esc-marco' }, h('div', { class: 'cp-esc-laser' })), estado, contador,
        h('button', { type: 'button', class: 'cp-bt ch cp-esc-x', onclick: () => cerrar(null) }, continuo ? 'Listo' : '✕')),
      h('div', { class: 'cp-esc-pie' }, h('span', {}, titulo),
        h('form', { class: 'cp-fila', onsubmit: (e) => { e.preventDefault(); leer(manual.value); manual.value = ''; } },
          manual, h('button', { class: 'cp-bt', type: 'submit' }, 'OK'))));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(null); });
    document.body.append(dlg);
    dlg.showModal();

    arrancarCamara(video, leer).then((fn) => {
      if (terminado) { fn(); return; }
      parar = fn;
      estado.textContent = '';
    }).catch(() => {
      estado.textContent = 'No se pudo abrir la cámara. Escribí el código abajo.';
    });
  });
}

async function arrancarCamara(video, leer) {
  const restricciones = { video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false };
  if ('BarcodeDetector' in window) {
    const soporta = await window.BarcodeDetector.getSupportedFormats?.().catch(() => []) || [];
    const formatos = FORMATOS.filter(f => !soporta.length || soporta.includes(f));
    if (formatos.length) {
      const det = new window.BarcodeDetector({ formats: formatos });
      const flujo = await navigator.mediaDevices.getUserMedia(restricciones);
      video.srcObject = flujo;
      await video.play().catch(() => {});
      let vivo = true;
      const vuelta = async () => {
        if (!vivo) return;
        try { const r = await det.detect(video); if (r[0]) leer(r[0].rawValue); } catch { /* cuadro sin imagen todavía */ }
        setTimeout(vuelta, 200);
      };
      vuelta();
      return () => { vivo = false; flujo.getTracks().forEach(t => t.stop()); };
    }
  }
  const { BrowserMultiFormatReader } = await import(ZXING);
  const lector = new BrowserMultiFormatReader();
  const controles = await lector.decodeFromConstraints(restricciones, video, (r) => { if (r) leer(r.getText()); });
  return () => controles.stop();
}

// ── Open Food Facts ──
const SECTOR_OFF = [
  [/dairies|milks|cheeses|yogurts|butters/, 'Lácteos'], [/meats|poultry|fish/, 'Carnes y freezer'], [/breads|biscuits/, 'Panadería'],
  [/beverages|waters|sodas|juices|wines|beers/, 'Bebidas'], [/fruits|vegetables/, 'Verdulería'],
];
export async function buscarCodigo(codigo) {
  try {
    const r = await conTiempo(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=product_name,product_name_es,brands,quantity,categories_tags`, 7000);
    if (!r.ok) return null;
    const j = await r.json();
    const p = j.status === 1 ? j.product : null;
    const nombreBase = (p?.product_name_es || p?.product_name || '').trim();
    if (!nombreBase) return null;
    const marca = (p.brands || '').split(',')[0].trim();
    const cant = (p.quantity || '').trim();
    const nombre = [nombreBase, marca && !nombreBase.toLowerCase().includes(marca.toLowerCase()) ? marca : '', cant && !nombreBase.includes(cant) ? cant : ''].filter(Boolean).join(' ');
    const cats = (p.categories_tags || []).join(' ');
    const g = adivinar(nombre);
    const sector = SECTOR_OFF.find(([re]) => re.test(cats))?.[1] || g.sector;
    const c = leerContenido(cant) || leerContenido(nombre);
    return { nombre, marca, codigo: String(codigo), emoji: g.emoji, sector, lugar: g.lugar, origen: 'off', tipoNombre: tipoDesdeNombre(nombreBase, marca), contenido: c?.contenido || null, base: c?.base || g.base };
  } catch { return null; }
}

// ── Precios Claros ──
// Pide las sucursales cerca tuyo (con el GPS) y el precio del producto en
// ellas. Si se nombra el súper, prefiere esa cadena; si no, el más barato.
const BASE_PC = 'https://d3e6htiiul5ek9.cloudfront.net/prod/';
let sucursalesCache = null;
export async function precioReferencia(codigo, superNombre = '') {
  try {
    if (!codigo) return null;
    if (!sucursalesCache || sucursalesCache.dia !== hoyISO()) {
      const pos = await new Promise((ok, mal) => navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(ok, mal, { timeout: 6000, maximumAge: 3600e3 })
        : mal(new Error('sin GPS')));
      const r = await conTiempo(`${BASE_PC}sucursales?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&limit=30`, 7000);
      const j = await r.json();
      sucursalesCache = { dia: hoyISO(), ids: (j.sucursales || []).map(s => s.id).filter(Boolean) };
    }
    if (!sucursalesCache.ids.length) return null;
    const r = await conTiempo(`${BASE_PC}producto?limit=30&id_producto=${encodeURIComponent(codigo)}&array_sucursales=${sucursalesCache.ids.join(',')}`, 7000);
    const j = await r.json();
    const con = (j.sucursales || []).map(s => ({ precio: Number(s.preciosProducto?.precioLista) || 0, cadena: s.banderaDescripcion || '', lugar: s.sucursalNombre || '' })).filter(s => s.precio > 0);
    if (!con.length) return null;
    const n = superNombre.toLowerCase();
    const mia = n ? con.filter(s => n.includes(s.cadena.toLowerCase().split(' ')[0]) || s.cadena.toLowerCase().includes(n.split(' ')[0])) : [];
    const el = (mia.length ? mia : con).sort((a, b) => a.precio - b.precio)[0];
    return { precio: el.precio, texto: `${el.cadena} ${el.lugar} · Precios Claros · hoy`.replace(/\s+/g, ' ') };
  } catch { return null; }
}

function conTiempo(url, ms) {
  const ab = new AbortController();
  const t = setTimeout(() => ab.abort(), ms);
  return fetch(url, { signal: ab.signal }).finally(() => clearTimeout(t));
}
