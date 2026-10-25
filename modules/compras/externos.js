// ─────────────────────────────────────────────────────────────
// Compras: lo que viene de afuera.
//   · Escáner de códigos de barras (BarcodeDetector en Android; si el
//     navegador no lo trae, como Chrome en Windows, zxing desde un CDN).
//   · Open Food Facts: nombre y marca por código (base libre, sin clave).
//   · Precios Claros (SEPA): precio de referencia en súper cercanos.
//     Si el navegador no deja leerlo, no pasa nada: queda el último pagado.
// ─────────────────────────────────────────────────────────────

import { adivinar, hoyISO, leerContenido, tipoDesdeNombre } from './modelo.js';

// Solo códigos de producto (los de los envases). El code_128 de etiquetas
// internas y cajas hacía que tomara cualquier número.
const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';
// Cuántas lecturas iguales seguidas hacen falta para aceptar un código.
const CONFIRMAR = 2;

// ¿Es un código de producto válido? Revisa el largo y el dígito de control
// (el último), que se calcula con los demás: un número mal leído casi nunca lo cumple.
export function codigoValido(codigo) {
  const c = String(codigo || '');
  if (!/^\d+$/.test(c) || ![8, 12, 13, 14].includes(c.length)) return false;
  const digitos = c.split('').map(Number);
  const control = digitos.pop();
  const suma = digitos.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === control;
}

// Abre la cámara a pantalla completa.
//  · continuo = false: devuelve el primer código leído (o null si cerraste).
//  · continuo = true: llama alLeer(codigo) por cada lectura hasta que cerrás.
// Siempre se puede escribir el código a mano.
export function escanear(ctx, { titulo = 'Apuntá al código de barras', continuo = false, alLeer } = {}) {
  const { h } = ctx;
  return new Promise((resolver) => {
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    const marco = h('div', { class: 'cp-esc-marco' }, h('div', { class: 'cp-esc-laser' }));
    const estado = h('small', { class: 'cp-esc-estado' }, 'Abriendo la cámara…');
    const contador = h('b', { class: 'cp-esc-cont' });
    const linterna = h('button', { type: 'button', class: 'cp-bt ch cp-esc-luz', hidden: true }, '🔦 Linterna');
    const manual = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'O escribí el código', autocomplete: 'off' });
    let leidos = 0, ultimo = '', ultimoT = 0, terminado = false, parar = () => {};
    let candidato = '', veces = 0;

    const aceptar = (codigo) => {
      if (terminado) return;
      const t = Date.now();
      if (codigo === ultimo && t - ultimoT < 1500) return;   // el mismo código sigue frente a la cámara
      ultimo = codigo; ultimoT = t;
      navigator.vibrate?.(40);
      if (!continuo) { cerrar(codigo); return; }
      leidos++; contador.textContent = `${leidos} leídos`;
      alLeer?.(codigo);
    };
    // Lo que ve la cámara: tiene que ser válido y repetirse antes de tomarlo.
    const deCamara = (codigo) => {
      codigo = String(codigo || '').replace(/\D/g, '');
      if (codigo.length === 12) codigo = '0' + codigo;   // UPC-A = EAN-13 con un 0 adelante
      if (!codigoValido(codigo)) return;
      if (codigo === candidato) veces++; else { candidato = codigo; veces = 1; }
      if (veces >= CONFIRMAR) { veces = 0; candidato = ''; aceptar(codigo); }
    };
    const aMano = (codigo) => {
      codigo = String(codigo || '').replace(/\D/g, '');
      if (!codigo) return;
      if (!codigoValido(codigo) && !(codigo.length === 12 && codigoValido('0' + codigo))) {
        estado.textContent = `"${codigo}" no parece un código de producto: revisá los números.`;
        return;
      }
      aceptar(codigo.length === 12 ? '0' + codigo : codigo);
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
      h('div', { class: 'cp-esc-cam' }, video, marco, estado, contador, linterna,
        h('button', { type: 'button', class: 'cp-bt ch cp-esc-x', onclick: () => cerrar(null) }, continuo ? 'Listo' : '✕')),
      h('div', { class: 'cp-esc-pie' }, h('span', {}, titulo),
        h('form', { class: 'cp-fila', onsubmit: (e) => { e.preventDefault(); aMano(manual.value); manual.value = ''; } },
          manual, h('button', { class: 'cp-bt', type: 'submit' }, 'OK'))));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(null); });
    document.body.append(dlg);
    dlg.showModal();

    arrancarCamara(video, marco, deCamara).then(({ detener, luz }) => {
      if (terminado) { detener(); return; }
      parar = detener;
      estado.textContent = '';
      if (luz) {
        let prendida = false;
        linterna.hidden = false;
        linterna.onclick = async () => { prendida = !prendida; await luz(prendida); linterna.classList.toggle('p', prendida); };
      }
    }).catch(() => {
      estado.textContent = 'No se pudo abrir la cámara. Escribí el código abajo.';
    });
  });
}

// Prende la cámara de atrás con enfoque continuo y algo de zoom (así no hace
// falta acercarse tanto, que es cuando se desenfoca) y lee solo lo que está
// dentro del recuadro amarillo, unas 6 veces por segundo.
async function arrancarCamara(video, marco, leer) {
  const flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  video.srcObject = flujo;
  await video.play().catch(() => {});
  const pista = flujo.getVideoTracks()[0];
  const puede = pista.getCapabilities?.() || {};
  const ajustes = {};
  if (puede.focusMode?.includes('continuous')) ajustes.focusMode = 'continuous';
  if (puede.zoom?.max > 1) ajustes.zoom = Math.min(2, puede.zoom.max);
  if (Object.keys(ajustes).length) await pista.applyConstraints({ advanced: [ajustes] }).catch(() => {});
  const luz = puede.torch ? (on) => pista.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}) : null;

  const detectar = await crearDetector();
  const lienzo = document.createElement('canvas');
  const pincel = lienzo.getContext('2d', { willReadFrequently: true });
  let vivo = true;
  const vuelta = async () => {
    if (!vivo) return;
    try {
      const recorte = zonaDelMarco(video, marco);
      if (recorte) {
        lienzo.width = recorte.w; lienzo.height = recorte.h;
        pincel.drawImage(video, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, recorte.w, recorte.h);
        const codigo = await detectar(lienzo);
        if (codigo) leer(codigo);
      }
    } catch { /* cuadro sin imagen todavía */ }
    setTimeout(vuelta, 150);
  };
  vuelta();
  return { detener: () => { vivo = false; flujo.getTracks().forEach(t => t.stop()); }, luz };
}

// BarcodeDetector (Android) o, si el navegador no lo trae, zxing.
async function crearDetector() {
  if ('BarcodeDetector' in window) {
    const soporta = await window.BarcodeDetector.getSupportedFormats?.().catch(() => []) || [];
    const formatos = FORMATOS.filter(f => !soporta.length || soporta.includes(f));
    if (formatos.length) {
      const det = new window.BarcodeDetector({ formats: formatos });
      return async (lienzo) => (await det.detect(lienzo))[0]?.rawValue || null;
    }
  }
  const { BrowserMultiFormatReader } = await import(ZXING);
  const lector = new BrowserMultiFormatReader();
  return (lienzo) => { try { return lector.decodeFromCanvas(lienzo).getText(); } catch { return null; } };
}

// Qué parte de la imagen de la cámara cae dentro del recuadro de la pantalla
// (el video se ve recortado para llenar el cuadro, por eso la cuenta).
function zonaDelMarco(video, marco) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const caja = video.getBoundingClientRect(), m = marco.getBoundingClientRect();
  const escala = Math.max(caja.width / vw, caja.height / vh);
  const dx = (caja.width - vw * escala) / 2, dy = (caja.height - vh * escala) / 2;
  // Un poco de margen alrededor del marco, por si el código no está perfecto adentro.
  const margen = 12;
  const x = Math.max(0, (m.left - caja.left - dx - margen) / escala), y = Math.max(0, (m.top - caja.top - dy - margen) / escala);
  const w = Math.min(vw - x, (m.width + margen * 2) / escala), h = Math.min(vh - y, (m.height + margen * 2) / escala);
  return w > 20 && h > 20 ? { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } : null;
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
