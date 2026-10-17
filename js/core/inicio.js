// ─────────────────────────────────────────────────────────────
// Inicio: arma la lista de lo que se ve, según Ajustes › Inicio.
//
// Cada cosa del Inicio es una "pieza" con una clave:
//   mm                Memento mori
//   busqueda          "Buscar en todo…"
//   botones           la fila de botones rápidos (+ Tarea, + Gasto…)
//   captura           "Anotá algo para no olvidarlo"
//   <modulo>:<id>     un cuadro que ofrece un módulo (bloquesInicio)
// Los botones también tienen clave <modulo>:<id> (botonesInicio).
//
// La configuración se guarda en las preferencias de la app (Drive) y
// vale para todos los dispositivos. Lo de un módulo oculto en este
// dispositivo no se muestra, pero no se pierde su lugar.
// ─────────────────────────────────────────────────────────────

import { juntar, receptorCaptura } from './registro.js';
import { configInicio, visible } from './preferencias.js';

// Orden de fábrica. Lo que no está acá va al final, en el orden de los módulos.
const ORDEN_INICIAL = ['mm', 'resumen:aviso', 'botones', 'busqueda', 'captura', 'tareas:hoy', 'calendario:semana', 'finanzas:disponible', 'bitacora:notas', 'bitacora:viendo'];
const BOTONES_INICIALES = ['tareas:nueva-tarea', 'finanzas:gasto', 'bitacora:nota'];

export const MEMENTO_INICIAL = { nacimiento: '', estilo: 'mezcla', frase: 'auto', fraseTexto: '', fraseAutor: '', unaLinea: true };

const opcionesDe = (lista = [], guardadas = {}) => Object.fromEntries(lista.map(o => [o.id, guardadas?.[o.id] ?? o.defecto !== false]));

// Devuelve { cfg, piezas, botones }.
//   piezas: [{ clave, nombre, nombreModulo, on, ancho, op, opciones, bloque?, oculto, fijo }]
//   botones: [{ clave, texto, icono, alTocar, on, nombreModulo, oculto }]
export async function armarInicio({ incluirOcultos = false } = {}) {
  const guardada = configInicio();
  const cfg = { ...MEMENTO_INICIAL, ...guardada };
  const [bloques, botones, receptor] = await Promise.all([
    juntar('bloquesInicio', { incluirOcultos: true }),
    juntar('botonesInicio', { incluirOcultos: true }),
    receptorCaptura(),
  ]);

  const disponibles = [
    { clave: 'mm', nombre: 'Memento mori', nombreModulo: 'Inicio', ancho: 'completo' },
    { clave: 'busqueda', nombre: 'Buscar en todo', nombreModulo: 'Varios', ancho: 'completo' },
    { clave: 'botones', nombre: 'Botones rápidos', nombreModulo: 'Varios', ancho: 'completo' },
    receptor ? { clave: 'captura', nombre: 'Anotá algo para no olvidarlo', nombreModulo: receptor.nombre, ancho: 'completo', oculto: !visible(receptor.id) } : null,
    ...bloques.map(b => ({
      clave: `${b.modulo}:${b.id}`, nombre: b.titulo || b.nombreModulo, nombreModulo: b.nombreModulo,
      ancho: b.ancho || 'mitad', opciones: b.opciones || [], bloque: b, oculto: b.oculto, defecto: b.defecto,
    })),
  ].filter(Boolean);

  const porClave = new Map(disponibles.map(x => [x.clave, x]));
  const guardadas = Array.isArray(cfg.items) ? cfg.items.filter(x => porClave.has(x.clave)) : [];
  const vistas = new Set(guardadas.map(x => x.clave));
  const nuevas = disponibles.filter(x => !vistas.has(x.clave))
    .sort((a, b) => (ORDEN_INICIAL.indexOf(a.clave) + 1 || 999) - (ORDEN_INICIAL.indexOf(b.clave) + 1 || 999));
  // Lo nuevo de fábrica se ubica según el orden inicial; lo que aparece después (un módulo nuevo) va al final.
  const lista = [...guardadas.map(g => ({ g, d: porClave.get(g.clave) })), ...nuevas.map(d => ({ g: null, d }))];
  // La búsqueda llegó después: si ya tenías el Inicio ordenado, se ubica arriba de "Anotá algo".
  // Lo mismo con el aviso del Resumen: va abajo del memento mori.
  const ubicar = (clave, antesDe, despuesDe) => {
    if (!guardadas.length || vistas.has(clave)) return;
    const i = lista.findIndex(x => x.d.clave === clave);
    if (i < 0) return;
    const [x] = lista.splice(i, 1);
    let j = antesDe ? lista.findIndex(y => y.d.clave === antesDe) : -1;
    if (j < 0 && despuesDe) { j = lista.findIndex(y => y.d.clave === despuesDe); if (j > -1) j++; }
    lista.splice(j > -1 ? j : 0, 0, x);
  };
  ubicar('busqueda', 'captura', 'botones');
  ubicar('resumen:aviso', null, 'mm');
  if (!guardadas.length) lista.sort((a, b) => (ORDEN_INICIAL.indexOf(a.d.clave) + 1 || 999) - (ORDEN_INICIAL.indexOf(b.d.clave) + 1 || 999));

  const piezas = lista.map(({ g, d }) => ({
    ...d,
    on: d.fijo ? true : (g ? g.on !== false : d.defecto !== false),
    ancho: g?.ancho || d.ancho,
    op: opcionesDe(d.opciones, g?.op),
  }));

  // Botones: los guardados en su orden, después los nuevos.
  const dispB = botones.map(b => ({ ...b, clave: `${b.modulo}:${b.id}` }));
  const porB = new Map(dispB.map(b => [b.clave, b]));
  const gB = Array.isArray(cfg.botones) ? cfg.botones.filter(x => porB.has(x.clave)) : [];
  const vistosB = new Set(gB.map(x => x.clave));
  const nuevosB = dispB.filter(b => !vistosB.has(b.clave))
    .sort((a, b) => (BOTONES_INICIALES.indexOf(a.clave) + 1 || 999) - (BOTONES_INICIALES.indexOf(b.clave) + 1 || 999));
  const listaB = [
    ...gB.map(g => ({ ...porB.get(g.clave), on: g.on !== false })),
    ...nuevosB.map(b => ({ ...b, on: !cfg.botones ? BOTONES_INICIALES.includes(b.clave) : b.defecto === true })),
  ];

  const filtrar = (l) => (incluirOcultos ? l : l.filter(x => !x.oculto));
  return { cfg, piezas: filtrar(piezas), botones: filtrar(listaB) };
}

// Pasa lo armado a lo que se guarda.
export function aGuardar(cfg, piezas, botones) {
  const { items, botones: _b, ...memento } = cfg;
  return {
    ...memento,
    items: piezas.map(p => ({ clave: p.clave, on: p.fijo ? true : !!p.on, ancho: p.ancho, op: p.op })),
    botones: botones.map(b => ({ clave: b.clave, on: !!b.on })),
  };
}
