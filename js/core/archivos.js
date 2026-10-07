// ─────────────────────────────────────────────────────────────
// Archivos (adjuntos). Servicio del núcleo que puede usar
// cualquier módulo con ctx.archivos.
//
// subir(archivo)  → lo guarda en Drive, en
//                   Segundo Cerebro/<modulo>/adjuntos.
//                   Sin internet o sin sesión, queda en espera en
//                   el dispositivo y se sube en la próxima
//                   sincronización. Devuelve:
//                   { driveId, nombre, tipo, url }  si ya se subió
//                   { pendiente, nombre, tipo }     si quedó en espera
// elegirDeDrive() → abre el selector de Google y devuelve los
//                   archivos elegidos (mismo formato).
// resolver(id)    → para un archivo que estaba en espera, devuelve
//                   sus datos de Drive si ya se subió.
//
// Cuando un archivo en espera se sube, el núcleo avisa al módulo
// llamando a su función archivoSubido(info, ctx).
// ─────────────────────────────────────────────────────────────

import * as db from './db.js';
import * as drive from './drive.js';
import { nuevoId } from './datos.js';
import { emitir } from './eventos.js';
import { CARPETA_DRIVE, GOOGLE_API_KEY, GOOGLE_APP_ID } from '../config.js';

const deDrive = (r) => ({ driveId: r.id, nombre: r.name, tipo: r.mimeType || '', url: r.webViewLink || `https://drive.google.com/file/d/${r.id}/view` });

async function carpetaAdjuntos(modulo) {
  const mapa = (await db.leerMeta('drive:mapa')) || { raiz: '', carpetas: {}, archivos: {} };
  if (!mapa.raiz) mapa.raiz = await drive.carpeta(CARPETA_DRIVE);
  if (!mapa.carpetas[modulo]) mapa.carpetas[modulo] = await drive.carpeta(modulo, mapa.raiz);
  const clave = `${modulo}/adjuntos`;
  if (!mapa.carpetas[clave]) mapa.carpetas[clave] = await drive.carpeta('adjuntos', mapa.carpetas[modulo]);
  await db.escribirMeta('drive:mapa', mapa);
  return mapa.carpetas[clave];
}

export async function subir(modulo, archivo) {
  const nombre = archivo.name || `archivo-${Date.now()}`;
  if (drive.conectado() && navigator.onLine) {
    try {
      return deDrive(await drive.subirArchivo(nombre, await carpetaAdjuntos(modulo), archivo));
    } catch (e) {
      if (!(e instanceof drive.ErrorSesion) && navigator.onLine) throw e;
    }
  }
  const id = nuevoId();
  await db.guardarArchivo({ id, modulo, nombre, tipo: archivo.type || '', blob: archivo, creado: Date.now() });
  emitir('archivos-pendientes');
  return { pendiente: id, nombre, tipo: archivo.type || '' };
}

export async function resolver(idPendiente) {
  const subidos = await db.leerMeta('archivos:subidos', {});
  return subidos[idPendiente] || null;
}

export async function cantidadPendientes() {
  return (await db.listarArchivos()).length;
}

// La sincronización llama a esto cuando hay conexión.
export async function subirPendientes() {
  const lista = await db.listarArchivos();
  for (const f of lista) {
    const info = deDrive(await drive.subirArchivo(f.nombre, await carpetaAdjuntos(f.modulo), f.blob));
    const subidos = await db.leerMeta('archivos:subidos', {});
    subidos[f.id] = info;
    await db.escribirMeta('archivos:subidos', subidos);
    await db.borrarArchivo(f.id);
    emitir('archivo-subido', { modulo: f.modulo, pendiente: f.id, archivo: info });
  }
}

// ── Selector de Google ──────────────────────────────────────

export const selectorDisponible = () => !!GOOGLE_API_KEY && !!GOOGLE_APP_ID;

function cargarPicker() {
  if (window.google?.picker) return Promise.resolve();
  return new Promise((ok, mal) => {
    const listo = () => window.gapi.load('picker', { callback: ok, onerror: () => mal(new Error('No se pudo cargar el selector de Google')) });
    if (window.gapi) return listo();
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = listo;
    s.onerror = () => mal(new Error('No se pudo cargar el selector de Google. Revisá la conexión.'));
    document.head.append(s);
  });
}

export async function elegirDeDrive() {
  if (!selectorDisponible()) throw new Error('Falta configurar la clave del selector (GOOGLE_API_KEY en js/config.js).');
  if (!drive.conectado()) throw new Error('Conectá tu cuenta de Google para elegir archivos de Drive.');
  await cargarPicker();
  const P = window.google.picker;
  return new Promise((ok) => {
    const vista = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(false).setOwnedByMe(true);
    new P.PickerBuilder()
      .addView(vista)
      .addView(new P.DocsView(P.ViewId.DOCS).setOwnedByMe(false))
      .enableFeature(P.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(drive.tokenActual())
      .setDeveloperKey(GOOGLE_API_KEY)
      .setAppId(GOOGLE_APP_ID)
      .setLocale('es')
      .setCallback((r) => {
        if (r.action === P.Action.PICKED) {
          ok(r.docs.map(d => ({ driveId: d.id, nombre: d.name, tipo: d.mimeType || '', url: d.url || `https://drive.google.com/file/d/${d.id}/view` })));
        } else if (r.action === P.Action.CANCEL) {
          ok([]);
        }
      })
      .build()
      .setVisible(true);
  });
}
