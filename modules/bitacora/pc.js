// ─────────────────────────────────────────────────────────────
// Bitácora en la PC: Inicio tipo tablero (variante A de la maqueta
// vistas-previas/bitacora-pc.html). Solo desde 900 px; el celular no cambia.
// Cuadros: Para revisar, Bandeja, Fijadas, Para recordar, Recientes y
// Seguir viendo, en una cuadrícula que entra en una pantalla.
// ─────────────────────────────────────────────────────────────

import { BANDEJA, etiquetasDe, hoyISO, fechaCorta } from './modelo.js';
import { poner, ic, haceCuanto, elegirCarpeta } from './vistas.js';
import { listaViendo, subtituloViendo, progreso, vivo, poster } from './filmoteca.js';

const extension = (nombre) => (String(nombre || '').match(/\.([a-z0-9]{1,5})$/i) || ['', ''])[1].toUpperCase();
const plata = (n) => `$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

// Una tarjeta del tablero: título, bajada, enlace a la derecha y cuerpo que se desplaza adentro.
function cuadro(h, { col, fil, titulo, sub = '', enlace = null, cuerpo, clase = '' }) {
  return h('section', { class: `bp-card ${clase}`.trim(), style: `grid-column:span ${col};grid-row:span ${fil}` },
    h('div', { class: 'bp-cab' }, h('div', {}, h('b', {}, titulo), sub ? h('small', {}, sub) : null),
      enlace ? h('a', { href: enlace.href, class: 'bp-link' }, enlace.texto, ' →') : null),
    h('div', { class: 'bp-cuerpo' }, cuerpo));
}

// Fila compacta (como las de Tareas en la PC): ícono, título con una línea gris abajo, y algo a la derecha.
export function filaPC(h, { href, icono, archivo = false, titulo, sub = '', der = null, pin = false, extra = null }) {
  return h('a', { href, class: 'bp-f' },
    h('span', { class: `bp-ico${archivo ? ' ar' : ''}` }, ic(icono)),
    h('span', { class: 'bp-tx' }, h('span', { class: 'bp-t' }, pin ? ic('pin', 'icono bp-pin') : null, titulo), sub ? h('small', {}, sub) : null),
    der, extra);
}
const iconoNota = (n) => (n.archivo ? (/\.(jpe?g|png|webp|heic|gif)$/i.test(n.archivo.original || '') ? 'imagen' : 'nota') : 'nota');
export function filaNotaPC(ctx, d, n, { ruta = true, der = undefined, extra = null } = {}) {
  const { h } = ctx;
  const tags = etiquetasDe(n).slice(0, 3).map(t => '#' + t);
  return filaPC(h, {
    href: `#/bitacora/n/${n.id}`, icono: iconoNota(n), archivo: !!n.archivo, titulo: n.titulo || 'Sin título', pin: n.fijada,
    sub: [ruta ? d.rutaCorta(n.carpetaId) : '', ...tags].filter(Boolean).join(' · '),
    der: der === undefined ? h('span', { class: 'bp-der' }, haceCuanto(n.modificado)) : der, extra,
  });
}

function botonMover(ctx, m, d, n) {
  return ctx.h('button', { type: 'button', class: 'bp-mv', title: 'Mover a una carpeta', 'aria-label': 'Mover a una carpeta', onclick: async (e) => {
    e.preventDefault(); e.stopPropagation();
    const id = await elegirCarpeta(ctx, d, { actual: BANDEJA });
    if (id !== null && id !== BANDEJA) { await m.guardarNota(n.id, { carpetaId: id }); ctx.aviso(`Movida a ${d.nombreRuta(id)}`); }
  } }, ic('carpeta'));
}

export function inicioPC(ctx, m, d, main) {
  const { h } = ctx;
  const hoy = hoyISO();
  const vacio = (t) => h('p', { class: 'bp-vacio' }, t);

  // Para revisar: los que falta ubicar y los ya ubicados sin confirmar.
  const sinLeer = d.notas.filter(n => n.archivo?.lectura && !n.archivo.revisado).sort((a, b) => a.creado - b.creado);
  const revisar = [
    ...d.pendientes.map(p => filaPC(h, {
      href: '#/bitacora/pendientes', icono: 'clip', archivo: true, titulo: p.propuesta?.nombre || p.original,
      sub: [p.propuesta?.carpetaId ? `→ ${d.rutaCorta(p.propuesta.carpetaId)}` : '¿Dónde va?', (p.via || '').toLowerCase()].filter(Boolean).join(' · '),
      der: h('span', { class: `bp-tag ${p.estado === 'error' ? 'r' : 'a'}` }, p.estado === 'error' ? 'a mano' : p.estado === 'leyendo' || p.estado === 'cola' ? 'leyendo' : 'ubicar'),
    })),
    ...sinLeer.map(n => filaPC(h, {
      href: '#/bitacora/pendientes', icono: iconoNota(n), archivo: true, titulo: n.titulo, sub: `ya guardado en ${d.rutaCorta(n.carpetaId)}`,
      der: h('span', { class: 'bp-tag z' }, 'confirmar'),
    })),
  ];

  const bandeja = d.notasDe(BANDEJA).sort((a, b) => b.modificado - a.modificado);
  const fijadas = d.notas.filter(n => n.fijada && !n.cine).sort((a, b) => b.modificado - a.modificado);

  // Para recordar: recordatorios y archivos con vencimiento (lo vencido y lo de los próximos 30 días).
  const en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const recordar = [
    ...d.recordatorios.filter(r => r.fecha && d.nota(r.notaId) && !d.nota(r.notaId).papelera)
      .map(r => ({ n: d.nota(r.notaId), f: r.fecha, icono: 'reloj', que: '' })),
    ...d.notas.filter(n => n.archivo?.vence && n.archivo.vence <= en30).map(n => ({ n, f: n.archivo.vence, icono: 'calendario', que: 'vence' })),
  ].sort((a, b) => a.f.localeCompare(b.f)).slice(0, 12);

  const recientes = d.notas.filter(n => !n.cine).sort((a, b) => b.modificado - a.modificado).slice(0, 14);
  const viendo = listaViendo(d).slice(0, 3);

  poner(main, h('div', { class: 'bp-bento bp-inicio' },
    cuadro(h, { col: 4, fil: 3, titulo: 'Para revisar', sub: revisar.length ? 'Archivos que falta ubicar o confirmar' : '', enlace: { texto: revisar.length ? 'Revisar todo' : 'Subir', href: '#/bitacora/pendientes' },
      cuerpo: revisar.length ? revisar : vacio('Nada para revisar. Lo que subas o compartas aparece acá.') }),
    cuadro(h, { col: 4, fil: 3, titulo: 'Bandeja', sub: bandeja.length ? `${bandeja.length} sin carpeta` : '', enlace: bandeja.length ? { texto: 'Ver', href: '#/bitacora/bandeja' } : null,
      cuerpo: bandeja.length ? bandeja.slice(0, 12).map(n => filaNotaPC(ctx, d, n, { ruta: false, extra: botonMover(ctx, m, d, n) })) : vacio('La Bandeja está vacía.') }),
    cuadro(h, { col: 4, fil: 2, titulo: 'Fijadas',
      cuerpo: fijadas.length ? fijadas.map(n => filaNotaPC(ctx, d, n, { der: null })) : vacio('Fijá notas con el pin para tenerlas acá.') }),
    cuadro(h, { col: 4, fil: 2, titulo: 'Para recordar', sub: 'Recordatorios y vencimientos',
      cuerpo: recordar.length ? recordar.map(x => filaPC(h, { href: `#/bitacora/n/${x.n.id}`, icono: x.icono, titulo: x.n.titulo, sub: [x.que, d.rutaCorta(x.n.carpetaId)].filter(Boolean).join(' · '),
        der: h('span', { class: `bp-tag ${x.f < hoy ? 'r' : x.f === hoy ? 'a' : 'g'}` }, x.f === hoy ? 'hoy' : fechaCorta(x.f)) })) : vacio('Sin recordatorios ni vencimientos cerca.') }),
    cuadro(h, { col: 8, fil: 3, titulo: 'Recientes', sub: 'Lo último que creaste o tocaste',
      cuerpo: recientes.length ? recientes.map(n => filaNotaPC(ctx, d, n)) : vacio('Todavía no hay notas.') }),
    cuadro(h, { col: 4, fil: 2, titulo: 'Seguir viendo', sub: 'Filmoteca', enlace: { texto: 'Filmoteca', href: '#/bitacora/f' }, clase: 'bp-cine',
      cuerpo: viendo.length ? h('div', { class: 'bp-posters' }, viendo.map(n => {
        const p = progreso(n.cine, vivo(d, n.cine));
        return h('a', { href: `#/bitacora/n/${n.id}`, class: 'bp-poster' }, poster(ctx, n.cine, { tam: 'w185', clase: 'chico' }),
          h('span', { class: 'bp-poster-t' }, h('b', {}, n.cine.titulo), h('small', {}, subtituloViendo(d, n.cine).replace(' próximo', ''))),
          h('span', { class: 'bp-prog' }, h('i', { style: `width:${p.pct}%` })));
      })) : vacio('No estás viendo ninguna serie.') }),
  ));
  // Animación de entrada, como Tareas y Finanzas.
  const b = main.querySelector('.bp-bento');
  b.classList.add('entra');
}

export { plata, extension };
