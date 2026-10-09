// ─────────────────────────────────────────────────────────────
// Conexión con Google Drive.
//
// Permiso pedido: "drive.file". La app solo ve los archivos que
// ella misma creó (o que elijas a mano). El resto de tu Drive
// queda invisible para la app.
//
// Sin servidor propio, Google entrega permisos que duran 1 hora.
// Cuando vencen, la app sigue funcionando sin conexión y se
// reconecta con el primer toque que hagas en la pantalla: como
// recuerda tu cuenta, la ventana de Google se abre y se cierra sola,
// sin elegir cuenta. Si eso falla, queda el botón "Reconectar".
// ─────────────────────────────────────────────────────────────

import { GOOGLE_CLIENT_ID } from '../config.js';
import { emitir } from './eventos.js';

const ALCANCE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3';
const GUARDADO = 'sc-sesion';
const CUENTA = 'sc-cuenta';   // correo de la cuenta, para no tener que elegirla cada vez

let token = null;
let expira = 0;
let cliente = null;
let esperando = null;
let autoIntentado = false;   // la reconexión automática se intenta una sola vez por apertura

const leerCuenta = () => { try { return localStorage.getItem(CUENTA) || ''; } catch { return ''; } };

export class ErrorSesion extends Error {}

export const configurado = () => !!GOOGLE_CLIENT_ID;
export const conectado = () => !!token && Date.now() < expira - 60_000;

export function estado() {
  if (!configurado()) return 'sin-configurar';
  return conectado() ? 'conectado' : 'desconectado';
}

// Recupera la sesión guardada si todavía no venció.
export function restaurar() {
  try {
    const g = JSON.parse(localStorage.getItem(GUARDADO) || 'null');
    if (g && g.expira > Date.now() + 60_000) { token = g.token; expira = g.expira; }
  } catch { /* sin sesión guardada */ }
  emitir('sesion', estado());
  // Se deja todo listo para que el toque abra la ventana de Google al instante.
  if (configurado() && leerCuenta()) cargarScriptGoogle().then(prepararCliente).catch(() => {});
  // Si ya estabas conectado de antes, se anota tu cuenta para las próximas veces.
  if (conectado() && !leerCuenta()) recordarCuenta();
}

// Si la sesión venció y ya te habías conectado antes, el primer toque
// en la pantalla reconecta solo. Se llama una vez al abrir la app.
export function reconectarAlTocar() {
  const alTocar = () => {
    if (autoIntentado || conectado() || !configurado() || !leerCuenta() || !navigator.onLine) return;
    if (!window.google?.accounts?.oauth2) return;   // todavía cargando: el próximo toque
    autoIntentado = true;
    conectar().catch(() => { /* queda el botón Reconectar */ });
  };
  document.addEventListener('pointerup', alTocar, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter') alTocar(); }, true);
}

function guardarSesion() {
  try { localStorage.setItem(GUARDADO, JSON.stringify({ token, expira })); } catch { /* sin almacenamiento */ }
}

function cargarScriptGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => mal(new Error('No se pudo cargar el inicio de sesión de Google. Revisá la conexión.'));
    document.head.appendChild(s);
  });
}

function prepararCliente() {
  if (cliente) return;
  const cuenta = leerCuenta();
  cliente = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: ALCANCE,
    ...(cuenta ? { login_hint: cuenta } : {}),
    callback: (r) => {
      const p = esperando; esperando = null;
      if (r.error) { p?.mal(new Error('Google rechazó la conexión: ' + r.error)); return; }
      token = r.access_token;
      expira = Date.now() + Number(r.expires_in || 3600) * 1000;
      guardarSesion();
      emitir('sesion', estado());
      autoIntentado = false;   // la próxima vez que venza, el toque vuelve a reconectar
      if (!leerCuenta()) recordarCuenta();
      p?.ok();
    },
    error_callback: (e) => {
      const p = esperando; esperando = null;
      p?.mal(new Error(e?.type === 'popup_closed' ? 'Cerraste la ventana de Google antes de terminar.' : 'No se pudo abrir la ventana de Google.'));
    },
  });
}

// Guarda el correo de la cuenta conectada (Drive lo informa con el mismo permiso).
async function recordarCuenta() {
  try {
    const r = await pedir(`${API}/about?fields=user(emailAddress)`);
    const correo = (await r.json()).user?.emailAddress;
    if (correo) { localStorage.setItem(CUENTA, correo); cliente = null; }   // se rearma con la cuenta al próximo uso
  } catch { /* se intenta la próxima vez */ }
}

// Debe llamarse desde un toque del usuario (Google abre una ventana).
export async function conectar() {
  if (!configurado()) throw new Error('Falta configurar GOOGLE_CLIENT_ID en js/config.js');
  await cargarScriptGoogle();
  prepararCliente();
  if (esperando) return esperando.promesa;   // ya hay una ventana abierta
  let ok, mal;
  const promesa = new Promise((a, b) => { ok = a; mal = b; });
  esperando = { ok, mal, promesa };
  cliente.requestAccessToken({ prompt: '' });
  return promesa;
}

export function desconectar() {
  if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
  token = null; expira = 0;
  localStorage.removeItem(GUARDADO);
  localStorage.removeItem(CUENTA);
  cliente = null;
  emitir('sesion', estado());
}

// ── Pedidos a la API ────────────────────────────────────────

async function pedir(url, opciones = {}) {
  if (!conectado()) throw new ErrorSesion('Sesión de Google vencida');
  const r = await fetch(url, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, ...(opciones.headers || {}) },
  });
  if (r.status === 401) {
    token = null; expira = 0;
    localStorage.removeItem(GUARDADO);
    emitir('sesion', estado());
    throw new ErrorSesion('Sesión de Google vencida');
  }
  if (!r.ok) {
    let detalle = '';
    try { detalle = (await r.json()).error?.message || ''; } catch { /* sin detalle */ }
    throw new Error(`Drive respondió ${r.status}${detalle ? ': ' + detalle : ''}`);
  }
  return r;
}

const comillas = (t) => String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function buscar(q) {
  const archivos = [];
  let pagina = '';
  do {
    const p = new URLSearchParams({
      q, spaces: 'drive', pageSize: '1000',
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
    });
    if (pagina) p.set('pageToken', pagina);
    const r = await (await pedir(`${API}/files?${p}`)).json();
    archivos.push(...(r.files || []));
    pagina = r.nextPageToken || '';
  } while (pagina);
  return archivos;
}

const CARPETA = 'application/vnd.google-apps.folder';

// Busca una carpeta por nombre dentro de otra; si no existe, la crea.
export async function carpeta(nombre, padreId = 'root') {
  const q = `name = '${comillas(nombre)}' and mimeType = '${CARPETA}' and '${padreId}' in parents and trashed = false`;
  const encontradas = await buscar(q);
  if (encontradas.length) return encontradas[0].id;
  const r = await pedir(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: CARPETA, parents: [padreId] }),
  });
  return (await r.json()).id;
}

// Devuelve null si el archivo no existe o está en la papelera.
export async function existe(id) {
  try {
    const r = await (await pedir(`${API}/files/${id}?fields=id,trashed`)).json();
    return r.trashed ? null : r;
  } catch (e) {
    if (String(e.message).includes('404')) return null;
    throw e;
  }
}

export async function hijos(padreId) {
  return buscar(`'${padreId}' in parents and trashed = false`);
}

export async function leerJSON(id) {
  const r = await pedir(`${API}/files/${id}?alt=media`);
  return r.json();
}

function multipart(metadatos, contenido, tipo) {
  const limite = 'sc' + Math.random().toString(36).slice(2);
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n`,
    `--${limite}\r\nContent-Type: ${tipo}\r\n\r\n`,
    contenido,
    `\r\n--${limite}--`,
  ]);
  return { cuerpo, tipoCuerpo: `multipart/related; boundary=${limite}` };
}

export async function crearJSON(nombre, padreId, datos) {
  const { cuerpo, tipoCuerpo } = multipart(
    { name: nombre, parents: [padreId], mimeType: 'application/json' },
    JSON.stringify(datos), 'application/json');
  const r = await pedir(`${SUBIDA}/files?uploadType=multipart&fields=id,modifiedTime`, {
    method: 'POST', headers: { 'Content-Type': tipoCuerpo }, body: cuerpo,
  });
  return r.json();
}

export async function actualizarJSON(id, datos) {
  const r = await pedir(`${SUBIDA}/files/${id}?uploadType=media&fields=id,modifiedTime`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
  });
  return r.json();
}

// Sube un archivo (adjuntos). Hasta 5 MB va en un solo pedido; más grande
// usa la subida "reanudable" de Google, que acepta archivos pesados.

// Baja el contenido de un archivo (para ver imágenes adjuntas dentro de la app).
export async function descargar(id) {
  const r = await pedir(`${API}/files/${encodeURIComponent(id)}?alt=media`);
  return r.blob();
}

const CAMPOS_ARCHIVO = 'id,name,mimeType,webViewLink';
export async function subirArchivo(nombre, padreId, blob) {
  const tipo = blob.type || 'application/octet-stream';
  if (blob.size <= 5 * 1024 * 1024) {
    const { cuerpo, tipoCuerpo } = multipart({ name: nombre, parents: [padreId] }, blob, tipo);
    const r = await pedir(`${SUBIDA}/files?uploadType=multipart&fields=${CAMPOS_ARCHIVO}`, {
      method: 'POST', headers: { 'Content-Type': tipoCuerpo }, body: cuerpo,
    });
    return r.json();
  }
  const inicio = await pedir(`${SUBIDA}/files?uploadType=resumable&fields=${CAMPOS_ARCHIVO}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': tipo },
    body: JSON.stringify({ name: nombre, parents: [padreId] }),
  });
  const destino = inicio.headers.get('Location');
  if (!destino) throw new Error('Drive no aceptó la subida del archivo grande');
  const r = await pedir(destino, { method: 'PUT', headers: { 'Content-Type': tipo }, body: blob });
  return r.json();
}

// Para el selector de Google (lo usa archivos.js).
export const tokenActual = () => (conectado() ? token : null);
