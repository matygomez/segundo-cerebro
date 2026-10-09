// ─────────────────────────────────────────────────────────────
// Registro de módulos.
//
// Cada módulo es una carpeta en /modules con un archivo modulo.js
// que exporta un objeto así (solo "id", "nombre" y "pantalla" son
// obligatorios):
//
// export default {
//   id: 'tareas',
//   nombre: 'Tareas',
//
//   // Pantalla del módulo. Puede devolver una función de limpieza.
//   pantalla(contenedor, ctx, subruta) { ... },
//
//   // Bloques que el módulo ofrece para Inicio.
//   bloquesInicio(ctx) { return [{ id, titulo, dibujar(contenedor) {} }]; },
//
//   // Botones que el módulo ofrece para Inicio.
//   botonesInicio(ctx) { return [{ id, texto, icono, alTocar() {} }]; },
//
//   // Recibe lo que escribís en la captura rápida.
//   capturar(texto, ctx) { ... },
//
//   // Acciones que otros módulos pueden pedir por mensaje.
//   acciones: { 'crear-tarea': (datos, ctx) => { ... } },
//
//   // Aviso de que un adjunto que estaba en espera ya se subió a Drive.
//   archivoSubido({ pendiente, archivo }, ctx) { ... },
//
//   // Lo que el módulo publica para el widget (a futuro).
//   resumen(ctx) { return { ... }; },
// }
//
// Reglas: un módulo nunca importa código de otro módulo. Solo usa
// lo que recibe en "ctx". Si quiere algo de otro, lo pide con
// ctx.pedir('nombre-de-accion', datos).
// ─────────────────────────────────────────────────────────────

import { MODULOS } from '../modulos.js';
import { coleccion } from './datos.js';
import { abrirFormulario } from './formularios.js';
import { aviso, confirmar, h, icono } from './ui.js';
import { escuchar } from './eventos.js';
import * as archivos from './archivos.js';

const cargados = new Map();

export const listaModulos = () => MODULOS.map(m => ({ id: m.id, nombre: m.nombre, icono: m.icono }));

export async function cargar(id) {
  if (cargados.has(id)) return cargados.get(id);
  const fila = MODULOS.find(m => m.id === id);
  if (!fila) return null;
  const promesa = import(new URL(fila.archivo, document.baseURI).href)
    .then(m => {
      const def = m.default;
      if (!def || def.id !== id || typeof def.pantalla !== 'function') {
        throw new Error(`El módulo "${id}" no cumple el formato (id, nombre y pantalla)`);
      }
      return def;
    });
  cargados.set(id, promesa);
  promesa.catch(() => cargados.delete(id));
  return promesa;
}

// Carga todos los módulos; si alguno falla, los demás siguen.
export async function cargarTodos() {
  const res = await Promise.allSettled(MODULOS.map(m => cargar(m.id)));
  return res.map((r, i) => {
    if (r.status === 'rejected') console.error(`No se pudo cargar "${MODULOS[i].id}"`, r.reason);
    return r.status === 'fulfilled' ? r.value : null;
  }).filter(Boolean);
}

// Contexto que recibe cada módulo: solo sus datos y servicios generales.
export function contexto(moduloId) {
  return {
    modulo: moduloId,
    datos: (nombre) => coleccion(moduloId, nombre),
    alCambiarDatos: (fn) => escuchar('datos', (e) => { if (e.modulo === moduloId) fn(e); }),
    formulario: abrirFormulario,
    aviso,
    confirmar,
    h,
    icono,
    navegar: (ruta) => { location.hash = '#/' + ruta.replace(/^#?\/?/, ''); },
    pedir,
    capturar,
    archivos: {
      subir: (archivo) => archivos.subir(moduloId, archivo),
      elegirDeDrive: archivos.elegirDeDrive,
      resolver: archivos.resolver,
      urlImagen: archivos.urlImagen,
      esImagen: archivos.esImagen,
      selectorDisponible: archivos.selectorDisponible,
    },
    inicio: {
      bloques: () => juntar('bloquesInicio'),
      botones: () => juntar('botonesInicio'),
      quienCaptura: async () => (await receptorCaptura())?.nombre || null,
    },
  };
}

// Junta lo que cada módulo ofrece para Inicio. Si un módulo falla,
// se lo saltea y el resto se muestra igual.
async function juntar(funcion) {
  const salida = [];
  for (const def of await cargarTodos()) {
    if (typeof def[funcion] !== 'function') continue;
    try {
      const items = (await def[funcion](contexto(def.id))) || [];
      for (const it of items) salida.push({ ...it, modulo: def.id, nombreModulo: def.nombre });
    } catch (e) {
      console.error(`"${def.id}" falló al armar ${funcion}`, e);
    }
  }
  return salida;
}

// Cuando un adjunto que estaba en espera se sube, se avisa a su módulo.
escuchar('archivo-subido', async (info) => {
  try {
    const def = await cargar(info.modulo);
    await def?.archivoSubido?.(info, contexto(info.modulo));
  } catch (e) {
    console.error('No se pudo avisar del archivo subido', e);
  }
});

// Mensaje a otro módulo, sin conocer su código.
export async function pedir(accion, datos) {
  for (const def of await cargarTodos()) {
    const fn = def.acciones?.[accion];
    if (typeof fn === 'function') return fn(datos, contexto(def.id));
  }
  throw new Error(`Ningún módulo ofrece la acción "${accion}"`);
}

export async function existeAccion(accion) {
  return (await cargarTodos()).some(d => typeof d.acciones?.[accion] === 'function');
}

// Captura rápida: la recibe el primer módulo de la lista que sepa hacerlo.
export async function receptorCaptura() {
  return (await cargarTodos()).find(d => typeof d.capturar === 'function') || null;
}

export async function capturar(texto) {
  const r = await receptorCaptura();
  if (!r) throw new Error('Todavía no hay un módulo que reciba capturas.');
  await r.capturar(texto, contexto(r.id));
  return r.nombre;
}
