// ─────────────────────────────────────────────────────────────
// Sincronización con Drive.
//
// 1. Trae: revisa los archivos de cada módulo en Drive. Si alguno
//    cambió desde la última vez, lo baja y lo fusiona con lo local.
// 2. Sube: cada colección con cambios pendientes se escribe en su
//    archivo de Drive (ya fusionada, así no pisa nada).
//
// Se dispara sola: después de un cambio, al volver internet,
// al volver a la app y cada 5 minutos con la app abierta.
// ─────────────────────────────────────────────────────────────

import * as db from './db.js';
import * as drive from './drive.js';
import { CARPETA_DRIVE } from '../config.js';
import { aplicarRemoto, quitarPendienteSiNoCambio, marcarTodoPendiente } from './datos.js';
import { fusionar, sonIguales } from './fusion.js';
import { subirPendientes, cantidadPendientes } from './archivos.js';
import { espejar } from './espejo.js';
import { emitir, escuchar } from './eventos.js';

const FORMATO = 1;

const est = { fase: 'inactivo', error: '', ultima: 0, pendientes: 0, archivos: 0 };
export const estadoSync = () => ({ ...est });

function fase(f, error = '') {
  est.fase = f; est.error = error;
  emitir('sync', estadoSync());
}

// Formato del archivo en Drive (legible si lo abrís a mano).
function aArchivo(grupo, registros) {
  const [modulo, coleccion] = grupo.split('/');
  return {
    formato: FORMATO, modulo, coleccion,
    registros: registros.map(r => ({
      id: r.id, datos: r.datos, creado: r.creado, modificado: r.modificado,
      borrado: !!r.borrado, dispositivo: r.dispositivo,
    })),
  };
}

function deArchivo(json) {
  return Array.isArray(json?.registros) ? json.registros : [];
}

let corriendo = null;
let repetir = false;

export function sincronizar() {
  if (corriendo) { repetir = true; return corriendo; }
  corriendo = (async () => {
    try {
      do {
        repetir = false;
        await ciclo();
      } while (repetir);
    } finally {
      corriendo = null;
    }
  })();
  return corriendo;
}

async function ciclo() {
  if (!drive.configurado()) return fase('sin-configurar');
  if (!navigator.onLine) return fase('sin-internet');
  if (!drive.conectado()) return fase('reconectar');

  fase('sincronizando');
  try {
    await pasada();
  } catch (e) {
    if (e instanceof drive.ErrorSesion) return fase('reconectar');
    if (String(e?.message).includes('404')) {
      // Se borró algo en Drive: se rehace el mapa de archivos y se reintenta una vez.
      await db.escribirMeta('drive:mapa', null);
      await marcarTodoPendiente();
      try { await pasada(); return; } catch (e2) { e = e2; }
      if (e instanceof drive.ErrorSesion) return fase('reconectar');
    }
    console.error(e);
    fase('error', e?.message || 'Error desconocido');
  }
}

// Varias tareas a la vez, pero no más de "cuantas" juntas (Drive se queja si son muchas).
async function enParalelo(lista, cuantas, tarea) {
  let i = 0;
  const trabajador = async () => { while (i < lista.length) { const x = lista[i++]; await tarea(x); } };
  await Promise.all(Array.from({ length: Math.min(cuantas, lista.length) }, trabajador));
}

async function pasada() {
  let mapa = (await db.leerMeta('drive:mapa')) || { raiz: '', carpetas: {}, archivos: {} };

  // Si la carpeta principal se borró en Drive, se rehace y se vuelve a subir todo lo local.
  // (Se revisa a la vez que se listan sus carpetas, para no esperar dos veces.)
  let enRaiz = [];
  if (mapa.raiz) {
    const [sigue, hijos] = await Promise.all([drive.existe(mapa.raiz), drive.hijos(mapa.raiz)]);
    if (sigue) enRaiz = hijos;
    else { mapa = { raiz: '', carpetas: {}, archivos: {} }; await marcarTodoPendiente(); }
  }
  if (!mapa.raiz) { mapa.raiz = await drive.carpeta(CARPETA_DRIVE); enRaiz = await drive.hijos(mapa.raiz); }

  // ── 1. Traer ──
  // Todos los .json de todos los módulos en un solo pedido (antes era uno por módulo, en fila).
  const carpetas = enRaiz.filter(x => x.mimeType === 'application/vnd.google-apps.folder');
  const nombrePorId = new Map(carpetas.map(c => [c.id, c.name]));
  for (const c of carpetas) mapa.carpetas[c.name] = c.id;
  const archivos = carpetas.length ? await drive.jsonDeCarpetas(carpetas.map(c => c.id)) : [];
  const cambiados = [];
  for (const a of archivos) {
    const modulo = (a.parents || []).map(id => nombrePorId.get(id)).find(Boolean);
    if (!modulo) continue;
    const grupo = `${modulo}/${a.name.slice(0, -5)}`;
    const conocido = mapa.archivos[grupo];
    if (conocido && conocido.id === a.id && conocido.modificado === a.modifiedTime) continue;
    cambiados.push({ grupo, a });
  }
  // Se bajan a la vez; la fusión con lo local va igual de a una (pasa por la cola de datos).
  await enParalelo(cambiados, 4, async ({ grupo, a }) => {
    const remotos = deArchivo(await drive.leerJSON(a.id));
    await aplicarRemoto(grupo, remotos, fusionar, sonIguales);
    mapa.archivos[grupo] = { id: a.id, modificado: a.modifiedTime };
  });
  await db.escribirMeta('drive:mapa', mapa);

  // ── 2. Subir ──
  const pendientes = await db.leerMeta('pendientes', []);
  // Las carpetas de módulos nuevos se crean antes, para no crearlas dos veces.
  for (const grupo of pendientes) {
    const modulo = grupo.split('/')[0];
    if (!mapa.carpetas[modulo]) mapa.carpetas[modulo] = await drive.carpeta(modulo, mapa.raiz);
  }
  await enParalelo(pendientes, 4, async (grupo) => {
    const [modulo, coleccion] = grupo.split('/');
    const locales = await db.registrosDeGrupo(grupo);
    const contenido = aArchivo(grupo, locales);
    const existente = mapa.archivos[grupo];
    const r = existente
      ? await drive.actualizarJSON(existente.id, contenido)
      : await drive.crearJSON(`${coleccion}.json`, mapa.carpetas[modulo], contenido);
    mapa.archivos[grupo] = { id: r.id, modificado: r.modifiedTime };
    await db.escribirMeta('drive:mapa', mapa);
    await quitarPendienteSiNoCambio(grupo, locales, sonIguales);
  });

  // ── 3. Adjuntos que quedaron en espera ──
  await subirPendientes();
  est.archivos = await cantidadPendientes();

  // Tus datos ya están al día: se avisa ya, sin esperar la copia de los .md.
  est.ultima = Date.now();
  await db.escribirMeta('ultimaSync', est.ultima);
  fase('al-dia');

  // ── 4. Copia legible (notas .md de la Bitácora), por detrás ──
  if (await espejar()) programar(2000);   // quedó trabajo: sigue en un ratito
}

// ── Disparadores automáticos ────────────────────────────────

let demora = null;
function programar(ms = 3000) {
  clearTimeout(demora);
  demora = setTimeout(() => sincronizar(), ms);
}

export async function iniciarSincronizacion() {
  est.ultima = await db.leerMeta('ultimaSync', 0);
  est.pendientes = (await db.leerMeta('pendientes', [])).length;
  est.archivos = await cantidadPendientes();
  escuchar('archivos-pendientes', async () => { est.archivos = await cantidadPendientes(); emitir('sync', estadoSync()); programar(500); });
  escuchar('pendientes', (n) => { est.pendientes = n; emitir('sync', estadoSync()); if (n) programar(); });
  escuchar('sesion', (s) => { if (s === 'conectado') programar(100); else emitir('sync', estadoSync()); });
  window.addEventListener('online', () => programar(500));
  window.addEventListener('offline', () => fase('sin-internet'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') programar(500); });
  setInterval(() => sincronizar(), 5 * 60_000);
  programar(300);
}
