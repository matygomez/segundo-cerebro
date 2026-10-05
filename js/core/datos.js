// ─────────────────────────────────────────────────────────────
// Datos para los módulos.
//
// Cada módulo recibe acceso SOLO a sus propias colecciones:
//   ctx.datos('tareas').crear({ titulo: 'Algo' })
// Así ningún módulo puede leer ni tocar lo de otro.
//
// En Drive, cada colección es un archivo:
//   Segundo Cerebro/<modulo>/<coleccion>.json
// Un módulo puede partir datos grandes por mes usando nombres
// como 'movimientos-2026-10'.
// ─────────────────────────────────────────────────────────────

import * as db from './db.js';
import { emitir } from './eventos.js';

const NOMBRE_VALIDO = /^[a-z0-9][a-z0-9-]{0,60}$/;

// Cola para que las escrituras no se pisen entre sí.
let cola = Promise.resolve();
function enCola(fn) {
  const p = cola.then(fn, fn);
  cola = p.catch(() => {});
  return p;
}

let dispositivo = null;
export async function idDispositivo() {
  if (dispositivo) return dispositivo;
  dispositivo = await db.leerMeta('dispositivo');
  if (!dispositivo) {
    dispositivo = 'd-' + crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 12);
    await db.escribirMeta('dispositivo', dispositivo);
  }
  return dispositivo;
}

// Ids ordenables por fecha de creación y sin choques entre dispositivos.
export function nuevoId() {
  const tiempo = Date.now().toString(36).padStart(9, '0');
  const azar = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).padStart(7, '0');
  return `${tiempo}-${azar}`;
}

// Hora "siempre creciente": si el reloj retrocede, igual avanza.
let ultimaHora = 0;
function ahora() {
  ultimaHora = Math.max(Date.now(), ultimaHora + 1);
  return ultimaHora;
}

export async function marcarPendiente(grupo) {
  const pendientes = new Set(await db.leerMeta('pendientes', []));
  pendientes.add(grupo);
  await db.escribirMeta('pendientes', [...pendientes]);
  emitir('pendientes', pendientes.size);
}

// Vista pública de un registro: los datos más id y fechas.
function vista(r) {
  return { ...r.datos, id: r.id, creado: r.creado, modificado: r.modificado };
}

export function coleccion(modulo, nombre) {
  if (!NOMBRE_VALIDO.test(modulo)) throw new Error(`Id de módulo inválido: "${modulo}"`);
  if (!NOMBRE_VALIDO.test(nombre)) throw new Error(`Nombre de colección inválido: "${nombre}" (usar minúsculas, números y guiones)`);
  const grupo = `${modulo}/${nombre}`;

  async function cambiar(lista) {
    await db.guardarRegistros(lista);
    await marcarPendiente(grupo);
    emitir('datos', { grupo, modulo, coleccion: nombre });
  }

  return {
    async listar() {
      const todos = await db.registrosDeGrupo(grupo);
      return todos.filter(r => !r.borrado).map(vista);
    },

    async obtener(id) {
      const todos = await db.registrosDeGrupo(grupo);
      const r = todos.find(x => x.id === id && !x.borrado);
      return r ? vista(r) : null;
    },

    crear(datos) {
      return enCola(async () => {
        const t = ahora();
        const id = nuevoId();
        const r = {
          clave: `${grupo}/${id}`, grupo, modulo, coleccion: nombre,
          id, datos: limpiar(datos), creado: t, modificado: t,
          borrado: false, dispositivo: await idDispositivo(),
        };
        await cambiar([r]);
        return r.id;
      });
    },

    actualizar(id, cambios) {
      return enCola(async () => {
        const todos = await db.registrosDeGrupo(grupo);
        const r = todos.find(x => x.id === id && !x.borrado);
        if (!r) throw new Error('No existe el registro que querés modificar');
        r.datos = limpiar({ ...r.datos, ...cambios });
        r.modificado = ahora();
        r.dispositivo = await idDispositivo();
        await cambiar([r]);
      });
    },

    // Nada se borra de verdad: queda marcado para que la
    // sincronización no lo resucite desde otro dispositivo.
    borrar(id) {
      return enCola(async () => {
        const todos = await db.registrosDeGrupo(grupo);
        const r = todos.find(x => x.id === id);
        if (!r || r.borrado) return;
        r.borrado = true;
        r.datos = {};
        r.modificado = ahora();
        r.dispositivo = await idDispositivo();
        await cambiar([r]);
      });
    },
  };
}

// ── Usado por la sincronización (pasa por la misma cola que las
//    escrituras, así nunca pisa un cambio que estés haciendo) ──

export function aplicarRemoto(grupo, remotos, fusionar, sonIguales) {
  return enCola(async () => {
    const [modulo, coleccionNombre] = grupo.split('/');
    const locales = await db.registrosDeGrupo(grupo);
    const fusionados = fusionar(locales, remotos).map(r => ({
      id: r.id, datos: r.datos ?? {}, creado: r.creado, modificado: r.modificado,
      borrado: !!r.borrado, dispositivo: r.dispositivo || '',
      clave: `${grupo}/${r.id}`, grupo, modulo, coleccion: coleccionNombre,
    }));
    const cambioLocal = !sonIguales(fusionados, locales);
    if (cambioLocal) {
      await db.guardarRegistros(fusionados);
      emitir('datos', { grupo, modulo, coleccion: coleccionNombre });
    }
    const remotoDesactualizado = !sonIguales(fusionados, remotos);
    if (remotoDesactualizado) await marcarPendiente(grupo);
    return { fusionados, cambioLocal, remotoDesactualizado };
  });
}

// Si la carpeta de Drive desapareció, todo lo local se vuelve a subir.
export function marcarTodoPendiente() {
  return enCola(async () => {
    const pendientes = new Set([...(await db.leerMeta('pendientes', [])), ...(await db.todosLosGrupos())]);
    await db.escribirMeta('pendientes', [...pendientes]);
    emitir('pendientes', pendientes.size);
  });
}

export function quitarPendienteSiNoCambio(grupo, subidos, sonIguales) {
  return enCola(async () => {
    const locales = await db.registrosDeGrupo(grupo);
    if (!sonIguales(locales, subidos)) return false;
    const pendientes = new Set(await db.leerMeta('pendientes', []));
    pendientes.delete(grupo);
    await db.escribirMeta('pendientes', [...pendientes]);
    emitir('pendientes', pendientes.size);
    return true;
  });
}

// Los datos deben poder guardarse como JSON. Se quitan campos reservados.
function limpiar(datos) {
  const copia = JSON.parse(JSON.stringify(datos ?? {}));
  for (const k of ['id', 'creado', 'modificado']) delete copia[k];
  return copia;
}
