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
let registro = null;
// Módulos que arrancan ocultos (ej. Calendario) hasta que los muestres.
let ocultosPorDefecto = [];
export function definirOcultosPorDefecto(ids) { ocultosPorDefecto = [...ids]; }
// Módulos que arrancan fuera de la barra del celular (ej. Calendario).
let fueraDeBarra = [];
export function definirFueraDeBarra(ids) { fueraDeBarra = [...ids]; }   // { id, clave: 'navegacion', ocultos: { pc: [], cel: [] }, barra: [{ id, on }] }

export const esPC = () => matchMedia('(min-width: 900px)').matches;
export const dispositivoActual = () => (esPC() ? 'pc' : 'cel');

export async function cargarPreferencias() {
  try {
    registro = (await col().listar()).find(x => x.clave === 'navegacion') || null;
    // 0.15.1: Calendario dejó de arrancar oculto (pasa a ser un módulo más).
    if (registro && !registro.calendarioComun) {
      const sacar = (l) => (l || []).filter(id => id !== 'calendario');
      const barra = Array.isArray(registro.barra) ? registro.barra.map(x => (x.id === 'calendario' ? { ...x, on: false } : x)) : registro.barra;
      registro = { ...registro, ocultos: { pc: sacar(registro.ocultos?.pc), cel: sacar(registro.ocultos?.cel) }, barra, calendarioComun: true };
      await col().actualizar(registro.id, { ocultos: registro.ocultos, barra: barra ?? null, calendarioComun: true });
    }
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

// Los ocultos por defecto que todavía no tocaste en Ajustes.
const nuevosOcultos = () => ocultosPorDefecto.filter(id => !(registro?.conocidos || []).includes(id));

export function navegacion() {
  return {
    ocultos: {
      pc: [...new Set([...(registro?.ocultos?.pc || []), ...nuevosOcultos()])],
      cel: [...new Set([...(registro?.ocultos?.cel || []), ...nuevosOcultos()])],
    },
    barra: Array.isArray(registro?.barra) ? registro.barra.map(x => ({ id: x.id, on: x.on !== false })) : null,   // null = la de siempre
  };
}

export async function guardarNavegacion(nav) {
  const datos = { clave: 'navegacion', calendarioComun: true, ocultos: nav.ocultos, barra: nav.barra, conocidos: [...new Set([...(registro?.conocidos || []), ...ocultosPorDefecto])] };
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
  const lista = guardada.length ? guardada : todos.map(id => ({ id, on: !fueraDeBarra.includes(id) }));
  for (const id of todos) if (!lista.some(x => x.id === id)) lista.push({ id, on: !fueraDeBarra.includes(id) && lista.filter(x => x.on).length < MAX_BARRA });
  const inicio = lista.find(x => x.id === 'home');
  if (inicio) inicio.on = true;
  return lista;
}

// Lo que se ve en la barra del celular, en orden (máximo 5).
export function barraCelular(todos) {
  return ordenBarra(todos).filter(x => x.on && visible(x.id, 'cel')).map(x => x.id).slice(0, MAX_BARRA);
}

export { MAX_BARRA };
