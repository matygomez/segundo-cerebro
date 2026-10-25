// ─────────────────────────────────────────────────────────────
// Ajustes › Inicio: todo lo que se ve en el Inicio se arma acá.
//   - Memento mori: estilo, fecha de nacimiento y frase.
//   - Qué aparece y en qué orden (mezclado como quieras), el ancho en la
//     PC, qué botones van en la fila de botones y las opciones de cada cuadro.
// Vale para todos los dispositivos.
// ─────────────────────────────────────────────────────────────

import { h, confirmar, aviso } from './ui.js';
import { escuchar } from './eventos.js';
import { guardarConfigInicio } from './preferencias.js';
import { armarInicio, aGuardar, MEMENTO_INICIAL } from './inicio.js';

const ESTILOS = [
  ['mezcla', 'Barras + Contador'],
  ['barras', 'Barras'],
  ['contador', 'Contador'],
  ['anios', 'Años'],
];
const barrita = (pct, alto = 3) => h('span', { class: 'ai-prog', style: `height:${alto}px` }, h('i', { style: `width:${pct}%` }));
const MINI = {
  mezcla: () => h('span', { class: 'ai-mini' }, h('b', {}, '23.252'), h('span', { class: 'ai-mini-5' }, [80, 70, 50, 78, 36].map(p => barrita(p)))),
  barras: () => h('span', { class: 'ai-mini ai-mini-col' }, barrita(80, 4), barrita(52, 4), barrita(36, 4)),
  contador: () => h('span', { class: 'ai-mini ai-mini-col' }, h('b', {}, '23.252'), barrita(36)),
  anios: () => h('span', { class: 'ai-mini ai-mini-anios' }, Array.from({ length: 20 }, (_, i) => h('i', { class: i < 7 ? 'v' : i === 7 ? 'a' : '' }))),
};

export function seccionInicio(seccion) {
  let estado = null;   // { cfg, piezas, botones }
  let ocupado = false;

  async function cargar() {
    estado = await armarInicio({ incluirOcultos: true });
    dibujar();
  }
  async function guardar() {
    ocupado = true;
    try { await guardarConfigInicio(aGuardar(estado.cfg, estado.piezas, estado.botones)); }
    catch (e) { aviso(`No se pudo guardar: ${e.message}`); }
    finally { ocupado = false; }
    dibujar();
  }
  const mover = (lista, i, d) => { const j = i + d; if (j < 0 || j >= lista.length) return; [lista[i], lista[j]] = [lista[j], lista[i]]; guardar(); };
  const sw = (on, etiqueta, alTocar, extra = {}) => h('button', { type: 'button', role: 'switch', class: `aj-switch${on ? ' on' : ''}`, 'aria-checked': String(on), 'aria-label': etiqueta, onclick: alTocar, ...extra });

  function dibujar() {
    if (!estado) return;
    const { cfg, piezas, botones } = estado;

    // ── Memento mori ──
    const fecha = h('input', { type: 'date', value: cfg.nacimiento || '', 'aria-label': 'Fecha de nacimiento', class: 'ai-fecha' });
    fecha.addEventListener('change', () => { cfg.nacimiento = fecha.value; guardar(); });
    const textoFrase = h('textarea', { rows: 2, placeholder: 'Tu frase (mejor corta: menos de 60 letras)', 'aria-label': 'Frase' }, cfg.fraseTexto || '');
    const autorFrase = h('input', { type: 'text', value: cfg.fraseAutor || '', placeholder: 'Autor (opcional)', 'aria-label': 'Autor de la frase' });
    const vida = h('input', { type: 'number', min: 50, max: 120, step: 1, inputmode: 'numeric', value: cfg.vida || 100, 'aria-label': 'Años de vida', class: 'ai-vida' });
    vida.addEventListener('change', () => {
      const n = Math.round(Number(vida.value));
      // Fuera de rango o vacío: se ajusta al límite más cercano en vez de ignorarlo.
      cfg.vida = Math.min(120, Math.max(50, Number.isFinite(n) && vida.value !== '' ? n : 100));
      guardar();
    });
    textoFrase.addEventListener('change', () => { cfg.fraseTexto = textoFrase.value.trim(); guardar(); });
    autorFrase.addEventListener('change', () => { cfg.fraseAutor = autorFrase.value.trim(); guardar(); });

    const memento = [
      h('h3', { class: 'ai-sub' }, 'Memento mori'),
      h('div', { class: 'ai-estilos' }, ESTILOS.map(([v, n]) => h('button', {
        type: 'button', class: `ai-estilo${cfg.estilo === v ? ' sel' : ''}`, 'aria-pressed': String(cfg.estilo === v),
        onclick: () => { cfg.estilo = v; guardar(); },
      }, MINI[v](), h('b', {}, n)))),
      h('div', { class: 'aj-fila' }, h('span', { class: 'aj-nombre' }, 'Fecha de nacimiento'), fecha),
      h('div', { class: 'aj-fila ai-envuelve' }, h('span', { class: 'aj-nombre' }, 'Frase'),
        h('span', { class: 'seg-vis ai-seg' }, [['auto', 'Automática'], ['fija', 'Fija'], ['no', 'Sin frase']].map(([v, t]) => h('button', {
          type: 'button', class: cfg.frase === v ? 'activo' : '', 'aria-pressed': String(cfg.frase === v), onclick: () => { cfg.frase = v; guardar(); },
        }, t))),
        cfg.frase === 'fija' ? h('div', { class: 'ai-frase' }, textoFrase, autorFrase) : null,
        cfg.frase === 'auto' ? h('p', { class: 'nota ai-ancho' }, 'Una frase estoica distinta cada día (Séneca, Marco Aurelio, Epicteto). El autor va en la línea de abajo.') : null),
      cfg.frase !== 'no' ? h('div', { class: 'aj-fila' }, h('span', { class: 'aj-nombre' }, 'Frase en una sola línea', h('small', { class: 'nota' }, ' (se achica para entrar)')),
        sw(cfg.unaLinea !== false, 'Frase en una sola línea', () => { cfg.unaLinea = cfg.unaLinea === false; guardar(); })) : null,
      h('div', { class: 'aj-fila' }, h('span', { class: 'aj-nombre' }, 'Vida contada hasta', h('small', { class: 'nota' }, ' (entre 50 y 120 años)')),
        h('span', {}, vida, h('span', { class: 'nota' }, ' años'))),
    ];

    // ── Qué aparece y en qué orden ──
    const filas = piezas.map((p, i) => {
      const filaBotones = p.clave === 'botones' && p.on ? h('div', { class: 'ai-chips' }, botones.length ? botones.map((b, bi) => h('span', { class: `ai-chip-b${b.on ? ' on' : ''}${b.oculto ? ' oculto' : ''}` },
        h('button', { type: 'button', class: 'ai-tog', 'aria-pressed': String(b.on), onclick: () => { b.on = !b.on; guardar(); } }, b.on ? '✓ ' : '+ ', b.texto),
        h('button', { type: 'button', 'aria-label': `Mover ${b.texto} antes`, disabled: bi === 0, onclick: () => mover(botones, bi, -1) }, '‹'),
        h('button', { type: 'button', 'aria-label': `Mover ${b.texto} después`, disabled: bi === botones.length - 1, onclick: () => mover(botones, bi, 1) }, '›')))
        : h('span', { class: 'nota' }, 'Ningún módulo ofrece botones.')) : null;
      const filaOpciones = p.opciones?.length && p.on ? h('div', { class: 'ai-chips' }, p.opciones.map(o => h('button', {
        type: 'button', class: `ai-op${p.op[o.id] ? ' on' : ''}`, 'aria-pressed': String(!!p.op[o.id]),
        onclick: () => { p.op[o.id] = !p.op[o.id]; guardar(); },
      }, o.texto))) : null;
      return h('div', { class: `ai-fila${p.on ? '' : ' apagada'}` },
        h('span', { class: 'ai-nombre' }, p.nombre, h('span', { class: 'ai-mod' }, p.nombreModulo),
          p.oculto ? h('small', { class: 'nota' }, ' oculto en este dispositivo') : null),
        h('span', { class: 'ai-ancho-sel', title: 'Ancho en la PC' },
          h('button', { type: 'button', class: p.ancho === 'mitad' ? 'sel' : '', onclick: () => { p.ancho = 'mitad'; guardar(); } }, '½'),
          h('button', { type: 'button', class: p.ancho !== 'mitad' ? 'sel' : '', onclick: () => { p.ancho = 'completo'; guardar(); } }, 'Entero')),
        h('span', { class: 'aj-acciones' },
          h('button', { type: 'button', class: 'aj-flecha', 'aria-label': `Subir ${p.nombre}`, disabled: i === 0, onclick: () => mover(piezas, i, -1) }, '↑'),
          h('button', { type: 'button', class: 'aj-flecha', 'aria-label': `Bajar ${p.nombre}`, disabled: i === piezas.length - 1, onclick: () => mover(piezas, i, 1) }, '↓'),
          p.fijo ? h('span', { class: 'nota ai-siempre' }, 'siempre')
            : sw(p.on, `Mostrar ${p.nombre}`, () => { p.on = !p.on; guardar(); })),
        filaBotones, filaOpciones);
    });

    seccion.replaceChildren(
      h('h2', {}, 'Inicio'),
      h('p', { class: 'nota' }, 'Todo lo del Inicio se arma acá: qué aparece, en qué orden (mezclado como quieras) y las opciones de cada cuadro. Vale para la PC y el celular; lo de un módulo oculto en un dispositivo no aparece ahí.'),
      ...memento,
      h('h3', { class: 'ai-sub' }, 'Qué aparece y en qué orden'),
      h('div', { class: 'ai-lista' }, filas),
      h('p', { class: 'nota ai-pie' }, '“½” pone el cuadro a media pantalla en la PC (dos lado a lado); “Entero” ocupa todo el ancho. En el celular todo va uno abajo del otro.'),
      h('button', {
        type: 'button', class: 'boton chico', onclick: async () => {
          if (!await confirmar('¿Volver el Inicio a como venía de fábrica? Tu fecha de nacimiento, los años y tu frase no se tocan.', { si: 'Volver a fábrica' })) return;
          const { nacimiento, frase, fraseTexto, fraseAutor, unaLinea, vida } = { ...MEMENTO_INICIAL, ...estado.cfg };
          ocupado = true;
          await guardarConfigInicio({ ...MEMENTO_INICIAL, nacimiento, frase, fraseTexto, fraseAutor, unaLinea, vida, items: null, botones: null });
          ocupado = false;
          cargar();
        },
      }, 'Volver al Inicio de fábrica'));
  }

  // Si cambia desde otro dispositivo, se vuelve a leer (salvo que estés escribiendo acá).
  const quitar = escuchar('preferencias', () => {
    if (ocupado || seccion.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    cargar();
  });
  cargar();
  return quitar;
}
