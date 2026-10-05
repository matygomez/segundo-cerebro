// ─────────────────────────────────────────────────────────────
// Base de datos local (IndexedDB). Es la copia del dispositivo:
// la app siempre lee y escribe acá, y la sincronización la lleva
// y la trae de Drive cuando hay internet.
//
//  registros → todos los datos de todos los módulos
//              clave = "modulo/coleccion/id", grupo = "modulo/coleccion"
//  meta      → datos internos (id de dispositivo, ids de Drive, pendientes)
//  archivos  → archivos esperando subirse a Drive (adjuntos, a futuro)
// ─────────────────────────────────────────────────────────────

const NOMBRE = 'segundo-cerebro';
const VERSION_DB = 1;
let conexion = null;

function promesa(req) {
  return new Promise((ok, mal) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

export function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE, VERSION_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('registros')) {
        const r = db.createObjectStore('registros', { keyPath: 'clave' });
        r.createIndex('grupo', 'grupo');
        r.createIndex('modulo', 'modulo');
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'clave' });
      if (!db.objectStoreNames.contains('archivos')) db.createObjectStore('archivos', { keyPath: 'id' });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
  return conexion;
}

async function almacen(nombre, modo = 'readonly') {
  const db = await abrir();
  return db.transaction(nombre, modo).objectStore(nombre);
}

function terminar(tx) {
  return new Promise((ok, mal) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error);
  });
}

// ── Registros ───────────────────────────────────────────────

export async function registrosDeGrupo(grupo) {
  const s = await almacen('registros');
  return promesa(s.index('grupo').getAll(grupo));
}

export async function registrosDeModulo(modulo) {
  const s = await almacen('registros');
  return promesa(s.index('modulo').getAll(modulo));
}

export async function guardarRegistros(lista) {
  const db = await abrir();
  const tx = db.transaction('registros', 'readwrite');
  const s = tx.objectStore('registros');
  for (const r of lista) s.put(r);
  return terminar(tx);
}

export async function todosLosGrupos() {
  const s = await almacen('registros');
  const grupos = [];
  return new Promise((ok, mal) => {
    const req = s.index('grupo').openKeyCursor(null, 'nextunique');
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return ok(grupos);
      grupos.push(c.key);
      c.continue();
    };
    req.onerror = () => mal(req.error);
  });
}

// ── Meta ────────────────────────────────────────────────────

export async function leerMeta(clave, porDefecto = null) {
  const s = await almacen('meta');
  const fila = await promesa(s.get(clave));
  return fila ? fila.valor : porDefecto;
}

export async function escribirMeta(clave, valor) {
  const s = await almacen('meta', 'readwrite');
  return promesa(s.put({ clave, valor }));
}

// ── Archivos pendientes de subir ────────────────────────────

export async function guardarArchivo(fila) {
  const s = await almacen('archivos', 'readwrite');
  return promesa(s.put(fila));
}

export async function listarArchivos() {
  const s = await almacen('archivos');
  return promesa(s.getAll());
}

export async function borrarArchivo(id) {
  const s = await almacen('archivos', 'readwrite');
  return promesa(s.delete(id));
}

// ── Mantenimiento ───────────────────────────────────────────

export async function contarRegistros() {
  const s = await almacen('registros');
  return promesa(s.count());
}

export async function borrarTodo() {
  const db = await abrir();
  const tx = db.transaction(['registros', 'meta', 'archivos'], 'readwrite');
  tx.objectStore('registros').clear();
  tx.objectStore('meta').clear();
  tx.objectStore('archivos').clear();
  return terminar(tx);
}
