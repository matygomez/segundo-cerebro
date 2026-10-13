// ─────────────────────────────────────────────────────────────
// Copia legible en Drive.
//
// Un módulo (la Bitácora) puede pedir que, además de sus datos, cada
// registro quede como un archivo de texto en carpetas reales de Drive:
//   Segundo Cerebro/Bitácora/Tiro/Curso CLU/Clase básica.md
// Así se pueden abrir con Obsidian o cualquier editor, y son tuyos
// aunque algún día dejes la app.
//
// Es de un solo sentido: la app escribe, Drive guarda. Se pone al día
// en cada sincronización (crea, actualiza, mueve, renombra y manda a
// la papelera de Drive lo que ya no está).
//
// El módulo entrega una función que devuelve:
//   { carpetas: [['Tiro'], ['Tiro', 'Curso CLU']],
//     archivos: [{ clave, ruta: ['Tiro', 'Curso CLU'], nombre: 'X.md', contenido }] }
// Qué archivo de Drive es cada cosa se anota en la colección
// "<modulo>/espejo", que se sincroniza: todos tus dispositivos usan los
// mismos archivos y no se duplican.
// ─────────────────────────────────────────────────────────────

import * as drive from './drive.js';
import * as db from './db.js';
import { coleccion } from './datos.js';
import { CARPETA_DRIVE } from '../config.js';

const proveedores = new Map();   // modulo → { raiz, lista }
const estados = new Map();       // modulo → { ultima, error, pendientes }
const LIMITE = 60;               // pedidos a Drive por pasada (el resto, en la próxima)

export function definir(modulo, raiz, lista) {
  proveedores.set(modulo, { raiz, lista });
}

export const estado = (modulo) => ({ ultima: 0, error: '', pendientes: false, ...(estados.get(modulo) || {}) });

// Huella corta del contenido, para saber si cambió.
function huella(texto) {
  let x = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) { x ^= texto.charCodeAt(i); x = Math.imul(x, 0x01000193); }
  return `${(x >>> 0).toString(36)}-${texto.length}`;
}

async function raizApp() {
  const mapa = (await db.leerMeta('drive:mapa')) || { raiz: '', carpetas: {}, archivos: {} };
  if (!mapa.raiz) { mapa.raiz = await drive.carpeta(CARPETA_DRIVE); await db.escribirMeta('drive:mapa', mapa); }
  return mapa.raiz;
}

// Pone al día la copia de todos los módulos. Devuelve true si quedó trabajo para la próxima.
export async function espejar() {
  let quedan = false;
  for (const [modulo, p] of proveedores) {
    try {
      const pendiente = await espejarModulo(modulo, p);
      estados.set(modulo, { ultima: Date.now(), error: '', pendientes: pendiente });
      quedan ||= pendiente;
    } catch (e) {
      if (e instanceof drive.ErrorSesion) throw e;
      console.warn(`No se pudo actualizar la copia en Drive de "${modulo}"`, e);
      estados.set(modulo, { ...estado(modulo), error: e.message || String(e) });
    }
  }
  return quedan;
}

async function espejarModulo(modulo, p) {
  const col = coleccion(modulo, 'espejo');
  const porClave = new Map();
  for (const r of (await col.listar()).sort((a, b) => a.creado - b.creado)) {
    if (porClave.has(r.clave)) { await col.borrar(r.id); continue; }   // anotado dos veces (dos equipos a la vez)
    porClave.set(r.clave, r);
  }
  const { carpetas = [], archivos = [] } = (await p.lista()) || {};
  let pedidos = 0;
  const raiz = await drive.carpeta(p.raiz, await raizApp());
  pedidos++;

  const anotar = async (clave, datos) => {
    const r = porClave.get(clave);
    if (r) { await col.actualizar(r.id, datos); porClave.set(clave, { ...r, ...datos }); }
    else { const id = await col.crear({ clave, ...datos }); porClave.set(clave, { id, clave, ...datos }); }
  };

  // Carpetas: se crean una vez; si alguien la borró en Drive, se vuelve a crear.
  const vistas = new Map();
  async function carpeta(ruta, verificar = false) {
    if (!ruta.length) return raiz;
    const clave = 'dir:' + ruta.join('/');
    if (vistas.has(clave)) return vistas.get(clave);
    const r = porClave.get(clave);
    let id = r?.archivoId || '';
    if (id && verificar) { pedidos++; if (!(await drive.datosArchivo(id))) id = ''; }
    if (!id) {
      const padre = await carpeta(ruta.slice(0, -1), verificar);
      id = await drive.carpeta(ruta[ruta.length - 1], padre);
      pedidos += 2;
      await anotar(clave, { archivoId: id, padreId: padre, nombre: ruta[ruta.length - 1] });
    }
    vistas.set(clave, id);
    return id;
  }

  for (const ruta of carpetas) {
    if (pedidos >= LIMITE) return true;
    if (!porClave.has('dir:' + ruta.join('/'))) await carpeta(ruta);
  }

  for (const x of archivos) {
    if (pedidos >= LIMITE) return true;
    const version = x.copiaDe ? `copia:${x.copiaDe}:${x.ruta.join('/')}/${x.nombre}` : huella(`${x.ruta.join('/')}\n${x.nombre}\n${x.contenido}`);
    const r = porClave.get(x.clave);
    if (r && r.version === version) continue;
    let padre = await carpeta(x.ruta);
    let id = r?.archivoId || '';
    if (x.copiaDe) {
      // Archivo copiado (una imagen): si es la misma, solo se mueve o renombra.
      try {
        if (id && r.fuente === x.copiaDe) { await drive.cambiarArchivo(id, { nombre: x.nombre, padreNuevo: padre, padreViejo: r.padreId }); pedidos++; }
        else {
          if (id) { try { await drive.aPapelera(id); } catch { /* ya no estaba */ } pedidos++; }
          id = (await drive.copiar(x.copiaDe, x.nombre, padre)).id; pedidos++;
        }
      } catch (e) {
        if (e.estado !== 404) throw e;
        id = '';   // el original ya no existe: no se reintenta
      }
      await anotar(x.clave, { archivoId: id, padreId: padre, nombre: x.nombre, version, fuente: x.copiaDe });
      continue;
    }
    try {
      if (id) {
        if (r.padreId !== padre || r.nombre !== x.nombre) { await drive.cambiarArchivo(id, { nombre: x.nombre, padreNuevo: padre, padreViejo: r.padreId }); pedidos++; }
        await drive.actualizarTexto(id, x.contenido); pedidos++;
      } else {
        id = (await drive.crearTexto(x.nombre, padre, x.contenido)).id; pedidos++;
      }
    } catch (e) {
      if (e.estado !== 404) throw e;
      // El archivo o su carpeta ya no están en Drive: se revisan las carpetas y se crea de nuevo.
      vistas.clear();
      padre = await carpeta(x.ruta, true);
      id = (await drive.crearTexto(x.nombre, padre, x.contenido)).id;
      pedidos += 2;
    }
    await anotar(x.clave, { archivoId: id, padreId: padre, nombre: x.nombre, version });
  }

  // Lo que ya no está: a la papelera de Drive (se puede recuperar desde ahí).
  const siguen = new Set(archivos.map(x => x.clave));
  for (const r of [...porClave.values()]) {
    if (r.clave.startsWith('dir:') || siguen.has(r.clave)) continue;
    if (pedidos >= LIMITE) return true;
    if (r.archivoId) { try { await drive.aPapelera(r.archivoId); } catch (e) { if (e.estado !== 404) throw e; } }
    pedidos++;
    await col.borrar(r.id);
    porClave.delete(r.clave);
  }

  // Carpetas que ya no se usan: se borran si quedaron vacías.
  const usadas = new Set();
  for (const ruta of [...carpetas, ...archivos.map(x => x.ruta)]) for (let i = 1; i <= ruta.length; i++) usadas.add('dir:' + ruta.slice(0, i).join('/'));
  const sobrantes = [...porClave.values()].filter(r => r.clave.startsWith('dir:') && !usadas.has(r.clave))
    .sort((a, b) => b.clave.split('/').length - a.clave.split('/').length);   // primero las más profundas
  for (const r of sobrantes) {
    if (pedidos >= LIMITE) return true;
    try {
      const dentro = await drive.hijos(r.archivoId); pedidos++;
      if (!dentro.length) { await drive.aPapelera(r.archivoId); pedidos++; }
    } catch (e) { if (e.estado !== 404) throw e; }
    await col.borrar(r.id);
    porClave.delete(r.clave);
  }
  return false;
}
