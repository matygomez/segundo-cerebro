// ─────────────────────────────────────────────────────────────
// Preferencias de la app (núcleo): qué módulos se ven en la PC y en
// el celular, y qué va en la barra de abajo del celular.
//
// Se guardan en Drive (Segundo Cerebro/app/preferencias.json), así
// valen en todos tus dispositivos. "Ocultar" no borra nada: el módulo
// sigue guardando sus datos y se puede abrir por su ruta.
// ─────────────────────────────────────────────────────────────

import { coleccion } from './datos.js';
import { escuchar, emitir } from './eventos.js';

const MAX_BARRA = 5;
const col = () => coleccion('app', 'preferencias');
let registro = null;   // { id, clave: 'navegacion', ocultos: { pc: [], cel: [] }, barra: [{ id, on }] }

export const esPC = () => matchMedia('(min-width: 900px)').matches;
export const dispositivoActual = () => (esPC() ? 'pc' : 'cel');

export async function cargarPreferencias() {
  try {
    registro = (await col().listar()).find(x => x.clave === 'navegacion') || null;
  } catch (e) {
    console.warn('No se pudieron leer las preferencias', e);
    registro = null;
  }
  return navegacion();
}

// Si cambian en otro dispositivo (llega por la sincronización), se recargan.
escuchar('datos', async (e) => {
  if (e.modulo !== 'app' || e.coleccion !== 'preferencias') return;
  await cargarPreferencias();
  emitir('preferencias', navegacion());
});

export function navegacion() {
  return {
    ocultos: { pc: [...(registro?.ocultos?.pc || [])], cel: [...(registro?.ocultos?.cel || [])] },
    barra: Array.isArray(registro?.barra) ? registro.barra.map(x => ({ id: x.id, on: x.on !== false })) : null,   // null = la de siempre
  };
}

export async function guardarNavegacion(nav) {
  const datos = { clave: 'navegacion', ocultos: nav.ocultos, barra: nav.barra };
  if (registro?.id) await col().actualizar(registro.id, datos);
  else await col().crear(datos);
  await cargarPreferencias();
  emitir('preferencias', navegacion());
}

// ¿Se ve este módulo en este dispositivo? (Inicio y Ajustes siempre)
export function visible(id, disp = dispositivoActual()) {
  if (id === 'home' || id === 'ajustes') return true;
  return !navegacion().ocultos[disp].includes(id);
}

// Lista completa para configurar la barra del celular: [{ id, on }] en
// orden. "todos" son los ids posibles en su orden normal (módulos +
// ajustes). Lo nuevo que no estaba guardado se suma al final.
export function ordenBarra(todos) {
  const guardada = (navegacion().barra || []).filter(x => todos.includes(x.id));
  const lista = guardada.length ? guardada : todos.map(id => ({ id, on: true }));
  for (const id of todos) if (!lista.some(x => x.id === id)) lista.push({ id, on: lista.filter(x => x.on).length < MAX_BARRA });
  const inicio = lista.find(x => x.id === 'home');
  if (inicio) inicio.on = true;
  return lista;
}

// Lo que se ve en la barra del celular, en orden (máximo 5).
export function barraCelular(todos) {
  return ordenBarra(todos).filter(x => x.on && visible(x.id, 'cel')).map(x => x.id).slice(0, MAX_BARRA);
}

export { MAX_BARRA };
