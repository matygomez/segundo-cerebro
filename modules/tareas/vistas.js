// ─────────────────────────────────────────────────────────────
// Tareas: pantallas.
//
// Arriba, una fila de "hojas" (como en Finanzas): Inicio, Hoy,
// Bandeja, cada área y los proyectos que elijas. Cuáles se ven, en qué
// orden, si muestran ícono, nombre o ambos, el modo compacto y el
// límite se configuran con el engranaje, por separado en PC y celular.
//
// Rutas:
//   #/tareas                      Inicio (resumen)
//   #/tareas/hoy[/vencidas|hoy|proximos]   Vencidas, Hoy y Próximos
//   #/tareas/proximos             igual que /hoy/proximos
//   #/tareas/bandeja              #/tareas/area/<id>
//   #/tareas/proyecto/<id>        #/tareas/seccion/<id>
//   #/tareas/buscar               #/tareas/filtro/<id>
// ─────────────────────────────────────────────────────────────

import { crearModelo, hoy, sumarDias, diasEntre, hecha, vencida, deHoy, ordenar, ordenarManual, aplicarFiltro, textoFecha, textoRepeticion, textoDuracion } from './modelo.js';
import { abrirEditor, menu, pedirNombre, pedirFiltro, poner } from './editor.js';
import { hacerOrdenable } from './arrastre.js';

// Íconos propios del módulo (mismo estilo de línea que el resto de la app).
const TRAZOS = {
  buscar: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  filtro: '<path d="M4 5.5h16l-6 7.5v5l-4 1.5v-6.5Z"/>',
  engranaje: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  repetir: '<path d="M4 12a7 7 0 0 1 12-5l2 2"/><path d="M18 5v4h-4"/><path d="M20 12a7 7 0 0 1-12 5l-2-2"/><path d="M6 19v-4h4"/>',
  campana: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  puntos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  carpeta: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"/>',
  proyecto: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M8 10h8M8 14h5"/>',
  seccion: '<path d="M6 8h12M6 12h12M6 16h7"/>',
  bandeja: '<path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M5.5 6h13L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  reloj: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  clip: '<path d="M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7.3 7.2a6 6 0 0 0 8.5 8.5L20 14.5"/>',
  asa: '<circle cx="9" cy="6.5" r="1.2"/><circle cx="15" cy="6.5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="17.5" r="1.2"/><circle cx="15" cy="17.5" r="1.2"/>',
  comentario: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z"/>',
  papelera: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  archivo: '<rect x="3.5" y="5" width="17" height="4" rx="1"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  ordenar: '<path d="M7 5v14M4 16l3 3 3-3"/><path d="M17 19V5M14 8l3-3 3 3"/>',
  alerta: '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17v.01"/>',
  circulo: '<circle cx="12" cy="12" r="7.5"/>',
  nota: '<path d="M6 3.5h8.5L18 7v13.5H6Z"/><path d="M9 11h6M9 14.5h6M9 18h3.5"/>',
  subtareas: '<path d="m4 6.5 1.5 1.5L8 5.5"/><path d="M11 7h9"/><path d="m4 15.5 1.5 1.5L8 14.5"/><path d="M11 16h9"/>',
  // Para Inicio, Hoy y para elegir el ícono de áreas y proyectos.
  inicio: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  sol: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
  persona: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5a7 7 0 0 1 14 0"/>',
  maletin: '<rect x="3.5" y="7.5" width="17" height="11.5" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17"/>',
  casa: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/>',
  diana: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  libro: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5Z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
  corazon: '<path d="M12 19s-7-4.3-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.7 12 19 12 19Z"/>',
  auto: '<path d="M5 16.5V12l1.8-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.8 1.3L19 12v4.5"/><path d="M4 12h16v4.5H4Z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>',
  carrito: '<path d="M4 5h2l2 10h10l2-7H7"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
  plata: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/>',
  estrella: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z"/>',
  avion: '<path d="M10 14 4 12l1-1.5 6 .5 4-5a1.6 1.6 0 0 1 2.4 2l-4 5 .5 6-1.5 1-2-6Z"/>',
  calendario: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  hoja: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19l7-7"/>',
  herramienta: '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5L15 12l-3-3Z"/>',
  musica: '<path d="M9 17V6l10-2v11"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="15" r="2"/>',
  grafico: '<path d="M5 19V5M5 19h14"/><path d="M8.5 15l3.5-4 3 2.5 4-5.5"/>',
  regalo: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 12.5h16M12 9v11M12 9c-1.5-3-5-3-5-1s3.5 1 5 1c1.5 0 5 1 5-1s-3.5-2-5 1"/>',
  escuela: '<path d="m3 9 9-4.5L21 9l-9 4.5Z"/><path d="M7 11v4.5c3 2 7 2 10 0V11"/>',
};
const ICONOS_ELEGIBLES = ['carpeta', 'proyecto', 'persona', 'maletin', 'casa', 'diana', 'libro', 'escuela', 'corazon', 'auto', 'carrito', 'plata', 'estrella', 'avion', 'calendario', 'hoja', 'herramienta', 'musica', 'grafico', 'regalo'];

function ic(nombre) {
  const s = document.createElement('span');
  s.className = 'icono';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre] || TRAZOS.carpeta}</svg>`;
  return s;
}

export function cargarEstilos() {
  if (document.getElementById('estilos-tareas')) return;
  const l = document.createElement('link');
  l.id = 'estilos-tareas';
  l.rel = 'stylesheet';
  l.href = new URL('./tareas.css', import.meta.url).href;
  document.head.append(l);
}

// Quién abre el detalle de una tarea. Dentro de Tareas (en la PC) lo abre al
// costado; en el resto de la app, como ventana.
let abridor = null;
const abrirTarea = (ctx, m, d, t) => (abridor ? abridor(t) : abrirEditor(ctx, m, d, t));

// Color de la fecha: vencida (rojo), hoy (verde), mañana (dorado),
// esta semana (azul), más adelante (gris). El texto dice lo mismo.
function claseFecha(t) {
  if (hecha(t) || !t.fecha) return 'lejos';
  const n = diasEntre(hoy(), t.fecha);
  return n < 0 ? 'vencida' : n === 0 ? 'hoy' : n === 1 ? 'manana' : n <= 7 ? 'semana' : 'lejos';
}

// Orden de las tareas dentro de una hoja (área, proyecto, sección, bandeja).
const CRITERIOS = [
  ['manual', 'Manual (arrastrando)'], ['fecha', 'Fecha de vencimiento'], ['creado', 'Fecha de creación'],
  ['alfabetico', 'Alfabético'], ['modificado', 'Última modificación'],
];
function ordenarPor(lista, por, sentido = 'asc') {
  const s = sentido === 'desc' ? -1 : 1;
  const cmp = {
    fecha: (a, b) => (!a.fecha - !b.fecha) || s * ((a.fecha || '').localeCompare(b.fecha || '') || (a.hora || '99').localeCompare(b.hora || '99')) || a.creado - b.creado,
    creado: (a, b) => s * (a.creado - b.creado),
    alfabetico: (a, b) => s * a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }),
    modificado: (a, b) => s * ((a.modificado || 0) - (b.modificado || 0)),
  }[por];
  return cmp ? [...lista].sort(cmp) : lista;
}

// Repetición para las columnas del modo compacto: largo (PC) y corto (celular).
const UNIDAD_CORTA = { diaria: 'días', semanal: 'sem.', mensual: 'meses', anual: 'años' };
const NOMBRE_CORTO = { diaria: 'Diaria', 'dias-habiles': 'Hábiles', semanal: 'Semanal', mensual: 'Mensual', anual: 'Anual' };
function repeticionCaja(rep) {
  const cada = Number(rep.cada) || 1;
  const largo = rep.tipo === 'dias-habiles' ? 'Días hábiles' : textoRepeticion(rep);
  const corto = cada > 1 && UNIDAD_CORTA[rep.tipo] ? `c/${cada} ${UNIDAD_CORTA[rep.tipo]}` : (NOMBRE_CORTO[rep.tipo] || largo);
  return { largo, corto };
}

const mostrarHechas = new Set();     // vistas donde se pidió ver las completadas
const subPlegadas = new Set();       // tareas con las subtareas plegadas
let verMasAdelante = false;          // en Hoy: mostrar también lo que viene después de 7 días

// ── Fila de una tarea (se usa también en el bloque de Inicio) ──

export function filaTarea(ctx, m, d, t, { ubicacion = true, ordenable = false, nivel = 0, marcaMadre = false } = {}) {
  const { h } = ctx;
  const subs = d.hijas ? d.hijas(t.id) : [];
  const madre = d.padre ? d.padre(t) : null;
  const nComentarios = d.comentariosDe ? d.comentariosDe(t.id).length : 0;
  const plegada = subPlegadas.has(t.id);

  const meta = [];
  if (t.fecha) meta.push(h('span', { class: `tr-meta tr-fecha ${claseFecha(t)}` }, textoFecha(t.fecha), t.hora ? ` ${t.hora}` : ''));
  if (t.repeticion?.tipo) meta.push(h('span', { class: 'tr-meta tr-rep' }, ic('repetir'), textoRepeticion(t.repeticion)));
  if (t.duracion) meta.push(h('span', { class: 'tr-meta' }, ic('reloj'), textoDuracion(t.duracion)));

  // Íconos justo después del título (como en Asana): notas, subtareas,
  // adjuntos, comentarios y recordatorio.
  const indic = [];
  const ind = (icono, titulo, num = '', clase = '') => h('span', { class: `tr-ind ${clase}`, title: titulo }, ic(icono), num !== '' ? h('span', { class: 'tr-ind-num' }, String(num)) : null);
  if (t.notas) indic.push(ind('nota', 'Tiene notas'));
  if (subs.length) indic.push(ind('subtareas', `Subtareas: ${subs.filter(hecha).length} de ${subs.length} hechas`, `${subs.filter(hecha).length}/${subs.length}`, 'tr-ind-sub'));
  if (t.adjuntos?.length) indic.push(ind('clip', `${t.adjuntos.length} adjunto${t.adjuntos.length > 1 ? 's' : ''}`, t.adjuntos.length));
  if (nComentarios) indic.push(ind('comentario', `${nComentarios} comentario${nComentarios > 1 ? 's' : ''}`, nComentarios));
  if (t.recordatorio) indic.push(ind('campana', `Recordatorio: ${textoFecha(t.recordatorio.slice(0, 10))} ${t.recordatorio.slice(11, 16)}`));

  // Columnas del modo compacto: Repetición y Fecha.
  const rc = t.repeticion?.tipo ? repeticionCaja(t.repeticion) : null;
  const columnas = [
    h('span', { class: 'tr-col tr-col-rep' }, rc ? h('span', { class: 'tr-caja tr-caja-rep', title: textoRepeticion(t.repeticion) },
      h('span', { class: 'largo' }, rc.largo), h('span', { class: 'corto' }, rc.corto)) : null),
    h('span', { class: 'tr-col tr-col-fecha' }, t.fecha ? h('span', { class: `tr-caja tr-caja-fecha ${claseFecha(t)}`, title: `${textoFecha(t.fecha)}${t.hora ? ` ${t.hora}` : ''}` },
      textoFecha(t.fecha), t.hora ? h('span', { class: 'tr-caja-hora' }, ` ${t.hora}`) : null) : null),
  ];
  if (ubicacion && !(ubicacion === 'proyecto' && !d.proyecto?.(t.proyectoId))) {
    const a = d.area?.(t.areaId), p = d.proyecto?.(t.proyectoId);
    meta.push(h('span', { class: 'tr-meta tr-ubic' }, ic(p?.icono || (p ? 'proyecto' : a?.icono || (a ? 'carpeta' : 'bandeja'))), p?.nombre || a?.nombre || 'Bandeja'));
  }
  if (marcaMadre && madre) meta.push(h('span', { class: 'tr-meta tr-de-madre', title: 'Es subtarea de' }, '↳ ', madre.titulo));
  for (const e of t.etiquetas || []) meta.push(h('span', { class: 'tr-etiqueta' }, `#${e}`));

  const completar = async () => {
    if (hecha(t)) { await m.reabrir(t); return; }
    // Si tiene subtareas sin terminar, pregunta qué hacer con ellas.
    const pendientes = subs.filter(x => !hecha(x)).length;
    if (pendientes) {
      const r = await preguntarSubtareas(ctx, t, pendientes);
      if (!r) return false;
      if (r === 'todas') await m.completarSubtareas(t);
    }
    const prox = await m.completar(t);
    if (prox) ctx.aviso(`Hecha. Vuelve ${textoFecha(prox).toLowerCase()}.`);
    else ctx.aviso(`Completada: "${t.titulo}"`, { accion: 'Deshacer', alTocar: () => m.reabrir({ ...t, estado: 'hecha' }), duracion: 6000 });
  };
  const aManana = async () => {
    const antes = t.fecha || '';
    await m.cambiarFecha(t, sumarDias(hoy(), 1));
    ctx.aviso(`"${t.titulo}" pasó a mañana`, { accion: 'Deshacer', alTocar: () => m.cambiarFecha(t, antes), duracion: 6000 });
  };

  const check = h('button', {
    type: 'button', class: `tr-check${hecha(t) ? ' hecha' : ''}`,
    'aria-label': hecha(t) ? `Reabrir "${t.titulo}"` : `Completar "${t.titulo}"`,
    onclick: async (e) => { const b = e.currentTarget; b.disabled = true; if (await completar() === false) b.disabled = false; },
  }, h('span', { class: 'tr-check-marca' }));

  // Subtareas: tareas completas debajo de su madre. Desplegadas por defecto;
  // con un toque se pliegan. Tocando una se abre su detalle.
  let bloqueSub = null;
  if (subs.length) {
    const hechas = subs.filter(hecha).length;
    const lista = h('ul', { class: 'tr-lista tr-hijas', hidden: plegada },
      subs.map(x => filaTarea(ctx, m, d, x, { ubicacion: false, nivel: nivel + 1 })));
    const alternar = h('button', {
      type: 'button', class: plegada ? 'tr-sub-alternar plegada' : 'tr-sub-alternar', 'aria-expanded': String(!plegada),
      onclick: () => {
        const ocultar = !lista.hidden;
        lista.hidden = ocultar;
        ocultar ? subPlegadas.add(t.id) : subPlegadas.delete(t.id);
        alternar.classList.toggle('plegada', ocultar);
        alternar.setAttribute('aria-expanded', String(!ocultar));
      },
    }, ic('abajo'), `Subtareas ${hechas}/${subs.length}`);
    bloqueSub = { alternar, lista };
  }

  const fila = h('div', { class: 'tr-fila' },
    ordenable ? h('button', { type: 'button', class: 'tr-asa', 'aria-label': `Mover "${t.titulo}" (arrastrá, o usá las flechas)` }, ic('asa')) : null,
    check,
    h('div', { class: 'tr-contenido' },
      h('button', { type: 'button', class: 'tr-cuerpo', onclick: (e) => { if (fila.dataset.deslizado) { e.preventDefault(); return; } abrirTarea(ctx, m, d, t); } },
        h('span', { class: 'tr-tit-ic' }, h('span', { class: 'tr-titulo' }, t.titulo),
          indic.length ? h('span', { class: 'tr-indic' }, indic) : null),
        meta.length ? h('span', { class: 'tr-metas' }, meta) : null,
        columnas),
      bloqueSub ? bloqueSub.alternar : null));
  const fondo = h('div', { class: 'tr-desliza', 'aria-hidden': 'true' }, h('span', { class: 'izq' }, '✓ Completar'), h('span', { class: 'der' }, 'Mañana →'));
  const li = h('li', { class: `tr-tarea${hecha(t) ? ' hecha' : ''}${ordenable ? ' ordenable' : ''}${nivel ? ' hija' : ''}`, 'data-id': t.id }, fondo, fila, bloqueSub ? bloqueSub.lista : null);

  // Deslizar con el dedo: a la derecha completa, a la izquierda pasa a mañana.
  if (!hecha(t)) {
    let x0 = null, y0 = 0, dx = 0, horizontal = false;
    fila.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || e.target.closest('.tr-asa, .tr-check, .tr-sub-alternar')) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; horizontal = false; delete fila.dataset.deslizado;
    });
    fila.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      if (!horizontal) {
        if (Math.abs(e.clientY - y0) > 12) { x0 = null; return; }   // es un scroll
        if (Math.abs(dx) < 12) return;
        horizontal = true;
        li.classList.add('deslizando');
      }
      fila.style.transform = `translateX(${dx}px)`;
      li.classList.toggle('a-la-derecha', dx > 0);
    });
    const soltar = async () => {
      if (x0 === null) return;
      x0 = null;
      if (!horizontal) return;
      fila.dataset.deslizado = '1';
      setTimeout(() => delete fila.dataset.deslizado, 300);
      fila.style.transition = 'transform 0.15s';
      fila.style.transform = '';
      setTimeout(() => { fila.style.transition = ''; li.classList.remove('deslizando'); }, 160);
      if (dx > 80) { await completar(); }
      else if (dx < -80) await aManana();
    };
    fila.addEventListener('pointerup', soltar);
    fila.addEventListener('pointercancel', () => { x0 = null; fila.style.transform = ''; li.classList.remove('deslizando'); });
  }
  return li;
}

// Completar una tarea con subtareas sin terminar: ¿también las subtareas?
function preguntarSubtareas(ctx, t, n) {
  const { h } = ctx;
  return new Promise((ok) => {
    let r = null;
    const dlg = h('dialog', { class: 'hoja' },
      h('p', { class: 'hoja-texto' }, `"${t.titulo}" tiene ${n} subtarea${n > 1 ? 's' : ''} sin terminar. ¿Completarlas también?`),
      h('div', { class: 'hoja-botones tr-botones-envolver' },
        h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { type: 'button', class: 'boton', onclick: () => { r = 'sola'; dlg.close(); } }, 'Solo esta tarea'),
        h('button', { type: 'button', class: 'boton principal', onclick: () => { r = 'todas'; dlg.close(); } }, 'Completar todas')));
    dlg.addEventListener('close', () => { dlg.remove(); ok(r); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// ── Pantalla ──

export async function pantallaTareas(contenedor, ctx, sub = []) {
  cargarEstilos();
  const { h, icono } = ctx;
  const m = crearModelo(ctx);
  let vista = sub[0] || 'inicio';
  let ancla = '';
  if (vista === 'proximos') { vista = 'hoy'; ancla = 'proximos'; }
  if (vista === 'vencidas') { vista = 'hoy'; ancla = 'vencidas'; }
  if (vista === 'sin-area') vista = 'bandeja';
  if (vista === 'hoy' && sub[1]) ancla = sub[1];
  const idRuta = vista === 'hoy' ? '' : sub[1] || '';
  let d = await m.cargar();
  let consulta = '';

  const esPC = () => window.matchMedia('(min-width: 900px)').matches;
  const claveHojas = () => (esPC() ? 'hojas-pc' : 'hojas-cel');

  const cuerpo = h('div', { class: 'tr-cuerpo-vista' });
  const barraHojas = h('nav', { class: 'tr-hojas', 'aria-label': 'Hojas de Tareas' });
  // Detalle en la PC: al abrirlo, la lista se achica desde la derecha (el borde
  // izquierdo no se mueve) y el detalle queda al lado, con su propio scroll y
  // una manija para cambiar el ancho.
  const panelContenido = h('div', { class: 'tr-panel-contenido' });
  const asaPanel = h('div', { class: 'tr-panel-asa', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Cambiar el ancho del detalle', title: 'Arrastrá para cambiar el ancho' });
  const panel = h('aside', { class: 'tr-panel', hidden: true, 'aria-label': 'Detalle de la tarea' }, asaPanel, panelContenido);
  const columnaLista = h('div', { class: 'tr-columna' });
  const zona = h('div', { class: 'tr-zona' }, columnaLista, panel);
  const ANCHO_MIN = 360;
  const anchoMax = () => Math.max(ANCHO_MIN, (zona.getBoundingClientRect().width || window.innerWidth) - 420);
  const ponerAncho = (px) => { const w = Math.round(Math.min(anchoMax(), Math.max(ANCHO_MIN, px))); zona.style.setProperty('--tr-ancho-panel', `${w}px`); return w; };
  try { ponerAncho(Number(localStorage.getItem('tr-ancho-panel')) || 520); } catch { ponerAncho(520); }
  asaPanel.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    panel.classList.add('ajustando');
    const borde = panel.getBoundingClientRect().right;
    const mover = (ev) => ponerAncho(borde - ev.clientX);
    const soltar = (ev) => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      panel.classList.remove('ajustando');
      try { localStorage.setItem('tr-ancho-panel', String(ponerAncho(borde - ev.clientX))); } catch { /* sin almacenamiento */ }
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  });
  // Queda fijo justo debajo de la barra de arriba de la app mientras bajás la lista.
  const ubicarPanel = () => { const b = document.querySelector('.barra'); panel.style.setProperty('--tr-arriba', `${b ? Math.max(0, b.getBoundingClientRect().bottom) : 0}px`); };
  let cierrePanel = null;
  function mostrarPanel() {
    clearTimeout(cierrePanel);
    ubicarPanel();
    panel.hidden = false;
    zona.classList.add('con-detalle');
    ponerAncho(parseFloat(zona.style.getPropertyValue('--tr-ancho-panel')) || 520);
  }
  function ocultarPanel() {
    zona.classList.remove('con-detalle');
    panel.hidden = true;
    panelContenido.replaceChildren();
  }
  const nueva = h('button', { type: 'button', class: 'tr-fab', 'aria-label': 'Nueva tarea', onclick: () => abrir(null, valoresPorDefecto()) }, icono('mas'), h('span', {}, 'Nueva tarea'));

  // ── Detalle: al costado en la PC, como ventana en el celular ──
  let editor = null;
  function marcarActiva() {
    for (const el of cuerpo.querySelectorAll('.tr-tarea.abierta')) el.classList.remove('abierta');
    if (editor?.tareaId) cuerpo.querySelector(`.tr-tarea[data-id="${editor.tareaId}"]`)?.classList.add('abierta');
  }
  async function abrir(t, base = {}) {
    if (!esPC()) { abrirEditor(ctx, m, d, t, base, { abrirOtra: (x) => abrir(x) }); return; }
    if (editor && !await editor.intentarCerrar()) return;
    const este = abrirEditor(ctx, m, d, t, base, {
      panel: panelContenido,
      abrirOtra: (x) => abrir(x),
      alCerrar: () => { if (editor === este) { editor = null; ocultarPanel(); marcarActiva(); } },
    });
    editor = este;
    mostrarPanel();
    panelContenido.scrollTop = 0;
    marcarActiva();
  }
  abridor = (t) => abrir(t);
  // Tocar afuera del detalle: igual que cancelar (si hubo cambios, pregunta).
  const alTocarAfuera = (e) => {
    if (!editor || panel.contains(e.target) || e.target.closest('dialog, #avisos')) return;
    if (e.target.closest('.tr-cuerpo, .tr-check, .tr-sub-alternar, .tr-asa, .tr-fab, .tr-nueva-arriba, .tr-rapida')) return;
    if (!editor.sucio()) { editor.cerrar(); return; }
    // Con cambios: se frena el toque (por ejemplo un link) y se pregunta.
    const frenar = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener('click', frenar, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', frenar, { capture: true }), 600);
    editor.intentarCerrar();
  };
  document.addEventListener('pointerdown', alTocarAfuera, true);

  columnaLista.replaceChildren(
    h('header', { class: 'cabecera-pantalla tr-cabecera' },
      h('h1', {}, 'Tareas'),
      h('div', { class: 'tr-herramientas' },
        h('a', { href: '#/tareas/buscar', class: 'boton-icono', 'aria-label': 'Buscar tareas', title: 'Buscar' }, ic('buscar')),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Filtros guardados', title: 'Filtros', onclick: abrirFiltros }, ic('filtro')),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Configurar Tareas', title: 'Configurar Tareas', onclick: abrirConfig }, ic('engranaje')),
        h('button', { type: 'button', class: 'boton principal tr-nueva-arriba', onclick: () => abrir(null, valoresPorDefecto()) }, icono('mas'), 'Nueva tarea'))),
    barraHojas, cuerpo);
  contenedor.replaceChildren(zona, nueva);

  function valoresPorDefecto() {
    if (vista === 'hoy') return { fecha: hoy() };
    if (vista === 'area') return { areaId: idRuta };
    if (vista === 'proyecto') { const p = d.proyecto(idRuta); return { areaId: p?.areaId || '', proyectoId: idRuta }; }
    if (vista === 'seccion') { const s = d.seccion(idRuta); const p = d.proyecto(s?.proyectoId); return { areaId: p?.areaId || '', proyectoId: p?.id || '', seccionId: idRuta }; }
    return {};
  }

  const pendientes = () => d.tareas.filter(t => !hecha(t));
  // En listas por lugar (bandeja, área, proyecto) las subtareas van debajo de su madre.
  const principales = (ts) => ts.filter(t => !t.padreId || !d.tarea(t.padreId));
  // En listas por fecha, una subtarea aparece suelta si su fecha es distinta a la de su madre
  // (o la madre no tiene fecha, o ya está hecha); si no, se ve debajo de la madre.
  const sueltaPorFecha = (t) => {
    const madre = d.padre(t);
    return !madre || hecha(madre) || !madre.fecha || madre.fecha !== t.fecha;
  };
  const porFecha = (ts) => ts.filter(sueltaPorFecha);
  const cuenta = (filtro) => pendientes().filter(filtro).length;
  const areasActivas = () => d.areas.filter(a => !a.archivada);
  const proyectosDe = (areaId) => d.proyectos.filter(p => p.areaId === areaId && !p.archivado);
  const seccionesDe = (proyectoId) => d.secciones.filter(s => s.proyectoId === proyectoId && !s.archivada);
  const iconoArea = (a) => a?.icono || 'carpeta';
  const iconoProyecto = (p) => p?.icono || 'proyecto';
  const finSemana = () => sumarDias(hoy(), 7);

  // Lista común: ordenada por fecha. Con { manual: true } se ordena a mano y se puede arrastrar.
  function lista(tareas, opciones = {}) {
    if (!opciones.manual) return h('ul', { class: 'tr-lista' }, ordenar(tareas).map(t => filaTarea(ctx, m, d, t, { marcaMadre: true, ...opciones })));
    // Orden elegido para esta hoja: si no es manual, no se arrastra.
    if (ordenVista.por !== 'manual' || opciones.sinArrastre) {
      const por = ordenVista.por === 'manual' ? 'fecha' : ordenVista.por;
      const sentido = ordenVista.por === 'manual' ? 'asc' : ordenVista.sentido;
      return h('ul', { class: 'tr-lista' }, ordenarPor(tareas, por, sentido).map(t => filaTarea(ctx, m, d, t, { ...opciones, manual: false })));
    }
    const ordenadas = ordenarManual(tareas);
    const ul = h('ul', { class: 'tr-lista' }, ordenadas.map(t => filaTarea(ctx, m, d, t, { ...opciones, ordenable: true })));
    hacerOrdenable(ul, (id, antes, despues) => {
      const buscar = (x) => (x ? d.tareas.find(t => t.id === x) : null);
      m.moverTarea(id, buscar(antes), buscar(despues));
    });
    return ul;
  }

  const vacio = (titulo, texto, ...botones) => h('div', { class: 'vacio' }, h('h2', {}, titulo), texto ? h('p', {}, texto) : null, botones.length ? h('div', { class: 'botonera' }, botones) : null);
  const volver = (href, texto) => h('a', { href, class: 'tr-miga' }, `← ${texto}`);
  const nada = (texto) => h('p', { class: 'nota tr-nada' }, texto);

  function chipHechas(clave, n) {
    if (!n) return null;
    const visible = mostrarHechas.has(clave);
    return h('button', { type: 'button', class: `tr-chip${visible ? ' activo' : ''}`, onclick: () => { visible ? mostrarHechas.delete(clave) : mostrarHechas.add(clave); dibujar(); } },
      visible ? `Ocultar completadas (${n})` : `Ver completadas (${n})`);
  }

  function tituloVista(icNombre, texto, opciones, ...extra) {
    return h('div', { class: 'tr-titulo-vista' },
      h('h2', {}, icNombre ? ic(icNombre) : null, h('span', {}, texto)),
      h('div', { class: 'tr-titulo-acc' }, extra,
        opciones ? h('button', { type: 'button', class: 'boton-icono chico', 'aria-label': `Opciones de ${texto}`, onclick: opciones }, ic('puntos')) : null));
  }

  // ── Hojas de arriba ──

  function configHojas() {
    const guardado = d.ajuste(claveHojas()) || {};
    const base = [
      { id: 'inicio', nombre: 'Inicio', icono: 'inicio', href: '#/tareas', fija: true, vis: true, modo: 'icono' },
      { id: 'hoy', nombre: 'Hoy', icono: 'sol', href: '#/tareas/hoy', vis: true, modo: 'ambos', filtro: (t) => t.fecha && t.fecha <= hoy() },
      { id: 'bandeja', nombre: 'Bandeja', icono: 'bandeja', href: '#/tareas/bandeja', vis: true, modo: 'icono', filtro: (t) => !t.areaId },
    ];
    for (const a of areasActivas()) {
      base.push({ id: `a:${a.id}`, nombre: a.nombre, icono: iconoArea(a), href: `#/tareas/area/${a.id}`, vis: true, modo: 'ambos', filtro: (t) => t.areaId === a.id });
      for (const p of proyectosDe(a.id)) base.push({ id: `p:${p.id}`, nombre: p.nombre, icono: iconoProyecto(p), href: `#/tareas/proyecto/${p.id}`, vis: false, modo: 'ambos', proyecto: true, filtro: (t) => t.proyectoId === p.id });
    }
    const porId = new Map(base.map(x => [x.id, x]));
    const lista = [porId.get('inicio')];
    for (const g of guardado.lista || []) {
      const x = porId.get(g.id);
      if (!x || x.fija || lista.includes(x)) continue;
      lista.push({ ...x, vis: g.vis !== false, modo: ['icono', 'ambos', 'nombre'].includes(g.modo) ? g.modo : x.modo });
    }
    for (const x of base) if (!lista.some(y => y.id === x.id)) lista.push(x);
    return {
      lista, compacto: !!guardado.compacto, limite: Number(guardado.limite) || 0,
      contador: guardado.contador !== false,                                   // número en las pestañas
      inicioCont: ['simbolo', 'color', 'nada'].includes(guardado.inicioCont) ? guardado.inicioCont : 'simbolo',
      leyenda: guardado.leyenda !== false,
    };
  }
  const guardarConfig = (cfg, cambios = {}) => m.guardarHojas(claveHojas(), {
    lista: cfg.lista.map(x => ({ id: x.id, vis: x.vis, modo: x.modo })), compacto: cfg.compacto, limite: cfg.limite,
    contador: cfg.contador, inicioCont: cfg.inicioCont, leyenda: cfg.leyenda, ...cambios,
  });

  function hojaActual(cfg) {
    const visibles = new Set(cfg.lista.filter(x => x.vis).map(x => x.id));
    if (vista === 'inicio') return 'inicio';
    if (vista === 'hoy' || vista === 'bandeja') return vista;
    const area = vista === 'area' ? idRuta : vista === 'proyecto' ? d.proyecto(idRuta)?.areaId : vista === 'seccion' ? d.proyecto(d.seccion(idRuta)?.proyectoId)?.areaId : null;
    const proy = vista === 'proyecto' ? idRuta : vista === 'seccion' ? d.seccion(idRuta)?.proyectoId : null;
    if (proy && visibles.has(`p:${proy}`)) return `p:${proy}`;
    return area ? `a:${area}` : null;
  }

  function dibujarHojas(cfg) {
    const actual = hojaActual(cfg);
    const vis = cfg.lista.filter(x => x.vis);
    const mostrar = cfg.limite && vis.length > cfg.limite ? vis.slice(0, cfg.limite) : vis;
    const resto = vis.filter(x => !mostrar.includes(x));
    const marca = (x) => {
      if (!x.filtro || !cfg.contador) return null;
      const ts = pendientes().filter(x.filtro);
      const n = x.id === 'hoy' ? ts.length : ts.filter(t => t.fecha && t.fecha <= hoy()).length;
      return n ? h('span', { class: `tr-marca${ts.some(vencida) ? ' alerta' : ''}` }, String(n)) : null;
    };
    const pestaña = (x) => h('a', {
      href: x.href, class: `tr-pest${x.id === actual ? ' activa' : ''}${x.modo === 'icono' ? ' solo-icono' : ''}`,
      'aria-current': x.id === actual ? 'page' : false, title: x.nombre, 'aria-label': x.nombre,
    }, x.modo !== 'nombre' ? ic(x.icono) : null, x.modo !== 'icono' ? h('span', {}, x.nombre) : null, marca(x));
    poner(barraHojas, mostrar.map(pestaña),
      resto.length ? h('button', {
        type: 'button', class: `tr-pest${resto.some(x => x.id === actual) ? ' activa' : ''}`,
        onclick: () => menu(ctx, 'Más hojas', resto.map(x => ({ texto: x.nombre, accion: () => { location.hash = x.href; } }))),
      }, h('span', {}, 'Más'), ic('abajo')) : null);
    // Que la hoja activa quede a la vista si la fila se desliza.
    // (se mueve solo la fila, sin desplazar la página)
    requestAnimationFrame(() => {
      const el = barraHojas.querySelector('.activa');
      if (!el) return;
      const izq = el.offsetLeft - barraHojas.offsetLeft, der = izq + el.offsetWidth;
      if (izq < barraHojas.scrollLeft) barraHojas.scrollLeft = izq - 8;
      else if (der > barraHojas.scrollLeft + barraHojas.clientWidth) barraHojas.scrollLeft = der - barraHojas.clientWidth + 8;
    });
  }

  // ── Filtros guardados ──

  function abrirFiltros() {
    menu(ctx, 'Filtros guardados', [
      ...d.filtros.map(f => ({ texto: f.nombre, accion: () => ctx.navegar(`tareas/filtro/${f.id}`) })),
      { texto: '+ Nuevo filtro', accion: async () => {
        const f = await pedirFiltro(ctx, d);
        if (f) { const id = await m.crearFiltro(f); ctx.navegar(`tareas/filtro/${id}`); }
      } },
    ]);
  }

  // ── Ventana genérica ──

  function ventana(titulo, contenido, { botones = null } = {}) {
    const dlg = h('dialog', { class: 'hoja tr-ventana' },
      h('header', { class: 'hoja-cabecera' }, h('h2', {}, titulo),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
      h('div', { class: 'tr-ventana-cuerpo' }, contenido),
      botones ? h('div', { class: 'hoja-botones' }, botones) : null);
    // Si cambia la pantalla (por ejemplo, con el botón atrás), la ventana se cierra.
    const alNavegar = () => { if (dlg.open) dlg.close(); };
    window.addEventListener('hashchange', alNavegar);
    dlg.addEventListener('close', () => { window.removeEventListener('hashchange', alNavegar); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
    return dlg;
  }

  // ── Configuración (engranaje) ──

  function abrirConfig() {
    let cfg = configHojas();
    const contenido = h('div', { class: 'tr-config' });
    const guardar = async (cambios = {}) => { await guardarConfig(cfg, cambios); };
    const seg = (opciones, actual, alElegir) => h('span', { class: 'tr-seg' }, opciones.map(([v, etiqueta, titulo]) =>
      h('button', { type: 'button', class: v === actual ? 'activo' : '', title: titulo || '', 'aria-label': titulo || (typeof etiqueta === 'string' ? etiqueta : ''), 'aria-pressed': String(v === actual), onclick: () => alElegir(v) }, etiqueta)));
    function pintar() {
      const filas = cfg.lista.map((x, i) => h('div', { class: `tr-cfg-hoja${x.proyecto ? ' proyecto' : ''}${x.vis ? '' : ' oculta'}` },
        h('span', { class: 'tr-cfg-nombre' }, ic(x.icono), h('span', {}, x.nombre)),
        x.fija ? h('small', { class: 'nota' }, 'siempre') : h('button', {
          type: 'button', role: 'switch', 'aria-checked': String(x.vis), 'aria-label': `Mostrar ${x.nombre}`, class: `tr-switch${x.vis ? ' on' : ''}`,
          onclick: async () => { x.vis = !x.vis; pintar(); await guardar(); },
        }),
        seg([['icono', ic(x.icono), 'Solo ícono'], ['ambos', 'Ambos', 'Ícono y nombre'], ['nombre', 'Aa', 'Solo nombre']], x.modo, async (v) => { x.modo = v; pintar(); await guardar(); }),
        h('button', { type: 'button', class: 'tr-mini', 'aria-label': `Subir ${x.nombre}`, disabled: i <= 1, onclick: async () => { [cfg.lista[i - 1], cfg.lista[i]] = [cfg.lista[i], cfg.lista[i - 1]]; pintar(); await guardar(); } }, '↑'),
        h('button', { type: 'button', class: 'tr-mini', 'aria-label': `Bajar ${x.nombre}`, disabled: x.fija || i === cfg.lista.length - 1, onclick: async () => { [cfg.lista[i + 1], cfg.lista[i]] = [cfg.lista[i], cfg.lista[i + 1]]; pintar(); await guardar(); } }, '↓')));
      const limite = h('select', { 'aria-label': 'Hojas visibles a la vez', onchange: async (e) => { cfg.limite = Number(e.target.value); await guardar(); } },
        [0, 3, 4, 5, 6, 8].map(n => h('option', { value: String(n), selected: cfg.limite === n }, n ? `${n} (el resto en "Más")` : 'Sin límite')));
      const enPapelera = gruposPapelera().length;
      const archivados = d.areas.filter(a => a.archivada).length + d.proyectos.filter(p => p.archivado).length + d.secciones.filter(s => s.archivada).length;
      poner(contenido,
        h('h3', {}, 'Vista'),
        h('div', { class: 'tr-cfg-fila' }, h('span', {}, 'Modo de las listas'),
          seg([[false, 'Normal'], [true, 'Compacto']], cfg.compacto, async (v) => { cfg.compacto = v; pintar(); await guardar(); })),
        h('div', { class: 'tr-cfg-fila' }, h('span', {}, 'Hojas visibles a la vez'), limite),
        h('div', { class: 'tr-cfg-fila' }, h('span', {}, 'Contador en las pestañas'),
          h('button', { type: 'button', role: 'switch', 'aria-checked': String(cfg.contador), 'aria-label': 'Contador en las pestañas', class: `tr-switch${cfg.contador ? ' on' : ''}`,
            onclick: async () => { cfg.contador = !cfg.contador; pintar(); await guardar(); } })),
        h('div', { class: 'tr-cfg-fila' }, h('span', {}, 'Contadores en Inicio'),
          seg([['simbolo', 'Símbolo', 'Número con símbolo'], ['color', 'Color', 'Solo número con color'], ['nada', 'Nada', 'Solo el total de pendientes']], cfg.inicioCont, async (v) => { cfg.inicioCont = v; pintar(); await guardar(); })),
        cfg.inicioCont !== 'nada' ? h('div', { class: 'tr-cfg-fila' }, h('span', {}, 'Leyenda en Inicio'),
          h('button', { type: 'button', role: 'switch', 'aria-checked': String(cfg.leyenda), 'aria-label': 'Leyenda en Inicio', class: `tr-switch${cfg.leyenda ? ' on' : ''}`,
            onclick: async () => { cfg.leyenda = !cfg.leyenda; pintar(); await guardar(); } })) : null,
        h('p', { class: 'nota' }, `Esto se guarda por separado en el celular y en la PC (ahora estás en ${esPC() ? 'la PC' : 'el celular'}).`),
        h('h3', {}, 'Hojas'),
        h('p', { class: 'nota' }, 'Prendé las que quieras ver arriba y elegí cómo se muestra cada una: solo ícono, ícono y nombre, o solo nombre.'),
        filas,
        h('h3', {}, 'Más'),
        h('button', { type: 'button', class: 'tr-cfg-item', onclick: () => { dlg.close(); abrirPapelera(); } }, ic('papelera'), h('span', {}, 'Papelera'), h('small', {}, String(enPapelera))),
        h('button', { type: 'button', class: 'tr-cfg-item', onclick: () => { dlg.close(); abrirArchivados(); } }, ic('archivo'), h('span', {}, 'Archivados'), h('small', {}, String(archivados))));
    }
    pintar();
    const dlg = ventana('Configurar Tareas', contenido);
  }

  // ── Papelera y archivados ──

  function gruposPapelera() {
    const grupos = new Map();
    const peso = { areas: 0, proyectos: 1, secciones: 2, tareas: 3 };
    for (const x of d.papelera) {
      const g = x.item.papeleraGrupo || x.item.id;
      if (!grupos.has(g)) grupos.set(g, { grupo: g, items: [] });
      grupos.get(g).items.push(x);
    }
    return [...grupos.values()].map(g => {
      g.items.sort((a, b) => peso[a.tipo] - peso[b.tipo]);
      g.raiz = g.items[0];
      g.cuando = g.raiz.item.enPapelera;
      return g;
    }).sort((a, b) => b.cuando - a.cuando);
  }

  function abrirPapelera() {
    const contenido = h('div', { class: 'tr-config' });
    let dlg;
    function pintar() {
      const grupos = gruposPapelera();
      const icTipo = { areas: (x) => iconoArea(x), proyectos: (x) => iconoProyecto(x), secciones: () => 'seccion', tareas: () => 'proyecto' };
      poner(contenido,
        h('p', { class: 'nota' }, 'Lo eliminado queda acá 30 días y después se borra solo.'),
        grupos.length ? grupos.map(g => {
          const quedan = Math.max(1, 30 - Math.floor((Date.now() - g.cuando) / 86_400_000));
          const nT = g.items.filter(x => x.tipo === 'tareas').length;
          return h('div', { class: 'tr-pap' }, ic(icTipo[g.raiz.tipo](g.raiz.item)),
            h('span', {}, g.raiz.item.nombre || g.raiz.item.titulo, nT && g.raiz.tipo !== 'tareas' ? h('small', {}, ` · con ${nT} tarea${nT > 1 ? 's' : ''}`) : null),
            h('small', {}, `${quedan} día${quedan > 1 ? 's' : ''}`),
            h('button', { type: 'button', class: 'tr-chip', onclick: async () => { await m.recuperar(g.grupo); ctx.aviso('Recuperado'); dlg.close(); } }, 'Recuperar'));
        }) : nada('La papelera está vacía.'));
    }
    pintar();
    dlg = ventana('Papelera', contenido, {
      botones: d.papelera.length ? [h('button', { type: 'button', class: 'boton peligro', onclick: async () => {
        if (await ctx.confirmar('¿Vaciar la papelera? Lo que está ahí se borra para siempre.', { si: 'Vaciar', peligro: true })) { await m.vaciarPapelera(); ctx.aviso('Papelera vacía'); dlg.close(); }
      } }, 'Vaciar papelera')] : null,
    });
  }

  function abrirArchivados() {
    const items = [
      ...d.areas.filter(a => a.archivada).map(a => ({ ic: iconoArea(a), nombre: a.nombre, detalle: 'Área', restaurar: () => m.archivarArea(a.id, false) })),
      ...d.proyectos.filter(p => p.archivado).map(p => ({ ic: iconoProyecto(p), nombre: p.nombre, detalle: `Proyecto de ${d.area(p.areaId)?.nombre || '—'}`, restaurar: () => m.archivarProyecto(p.id, false) })),
      ...d.secciones.filter(s => s.archivada).map(s => ({ ic: 'seccion', nombre: s.nombre, detalle: `Sección de ${d.proyecto(s.proyectoId)?.nombre || '—'}`, restaurar: () => m.archivarSeccion(s.id, false) })),
    ];
    const dlg = ventana('Archivados', h('div', { class: 'tr-config' },
      h('p', { class: 'nota' }, 'Lo archivado no se ve en las listas, pero sus tareas con fecha siguen apareciendo en Hoy.'),
      items.length ? items.map(x => h('div', { class: 'tr-pap' }, ic(x.ic), h('span', {}, x.nombre, h('small', {}, ` · ${x.detalle}`)),
        h('button', { type: 'button', class: 'tr-chip', onclick: async () => { await x.restaurar(); ctx.aviso(`"${x.nombre}" restaurado`); dlg.close(); } }, 'Restaurar'))) : nada('No hay nada archivado.')));
  }

  // ── Menús de área, proyecto y sección ──

  function elegirIcono(tipo, x) {
    const dlg = ventana(`Ícono de ${x.nombre}`, h('div', { class: 'tr-iconos' }, ICONOS_ELEGIBLES.map(n =>
      h('button', { type: 'button', class: (x.icono || (tipo === 'areas' ? 'carpeta' : 'proyecto')) === n ? 'activo' : '', 'aria-label': n, onclick: async () => { await m.ponerIcono(tipo, x.id, n); dlg.close(); } }, ic(n)))));
  }

  function opcionesArea(a) {
    const hermanas = areasActivas();
    menu(ctx, a.nombre, [
      { texto: 'Nuevo proyecto', accion: async () => { const n = await pedirNombre(ctx, 'Nuevo proyecto', '', 'Crear proyecto'); if (n) { await m.crearProyecto(a.id, n); ctx.aviso(`Proyecto "${n}" creado`); } } },
      { texto: 'Renombrar', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar área', a.nombre); if (n) await m.renombrarArea(a.id, n); } },
      { texto: 'Cambiar ícono', accion: () => elegirIcono('areas', a) },
      { texto: 'Subir en la lista', desactivado: a.archivada || hermanas[0]?.id === a.id, accion: () => m.mover('areas', a.id, -1, hermanas) },
      { texto: 'Bajar en la lista', desactivado: a.archivada || hermanas.at(-1)?.id === a.id, accion: () => m.mover('areas', a.id, 1, hermanas) },
      a.archivada
        ? { texto: 'Restaurar', accion: () => m.archivarArea(a.id, false) }
        : { texto: 'Archivar', accion: async () => { await m.archivarArea(a.id); avisoArchivado(a.nombre, () => m.archivarArea(a.id, false)); if (vista === 'area') ctx.navegar('tareas'); } },
      { texto: 'Eliminar', peligro: true, accion: () => eliminar('areas', a) },
    ]);
  }

  function opcionesProyecto(p) {
    const hermanos = proyectosDe(p.areaId);
    menu(ctx, p.nombre, [
      { texto: 'Nueva sección', accion: async () => { const n = await pedirNombre(ctx, 'Nueva sección', '', 'Crear sección'); if (n) await m.crearSeccion(p.id, n); } },
      { texto: 'Renombrar', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar proyecto', p.nombre); if (n) await m.renombrarProyecto(p.id, n); } },
      { texto: 'Cambiar ícono', accion: () => elegirIcono('proyectos', p) },
      { texto: 'Subir en la lista', desactivado: p.archivado || hermanos[0]?.id === p.id, accion: () => m.mover('proyectos', p.id, -1, hermanos) },
      { texto: 'Bajar en la lista', desactivado: p.archivado || hermanos.at(-1)?.id === p.id, accion: () => m.mover('proyectos', p.id, 1, hermanos) },
      p.archivado
        ? { texto: 'Restaurar', accion: () => m.archivarProyecto(p.id, false) }
        : { texto: 'Archivar', accion: async () => { await m.archivarProyecto(p.id); avisoArchivado(p.nombre, () => m.archivarProyecto(p.id, false)); if (vista === 'proyecto') ctx.navegar(`tareas/area/${p.areaId}`); } },
      { texto: 'Eliminar', peligro: true, accion: () => eliminar('proyectos', p) },
    ]);
  }

  function opcionesSeccion(s) {
    const hermanas = seccionesDe(s.proyectoId);
    menu(ctx, s.nombre, [
      { texto: 'Renombrar', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar sección', s.nombre); if (n) await m.renombrarSeccion(s.id, n); } },
      { texto: 'Subir', desactivado: hermanas[0]?.id === s.id, accion: () => m.mover('secciones', s.id, -1, hermanas) },
      { texto: 'Bajar', desactivado: hermanas.at(-1)?.id === s.id, accion: () => m.mover('secciones', s.id, 1, hermanas) },
      { texto: 'Archivar', accion: async () => { await m.archivarSeccion(s.id); avisoArchivado(s.nombre, () => m.archivarSeccion(s.id, false)); if (vista === 'seccion') ctx.navegar(`tareas/proyecto/${s.proyectoId}`); } },
      { texto: 'Eliminar', peligro: true, accion: () => eliminar('secciones', s) },
    ]);
  }

  const avisoArchivado = (nombre, deshacer) => ctx.aviso(`"${nombre}" archivado`, { accion: 'Deshacer', alTocar: deshacer, duracion: 6000 });

  // ── Eliminar: si tiene algo adentro, se elige reubicar o eliminar todo ──

  function eliminar(tipo, x) {
    const tareas = d.tareas.filter(t => (tipo === 'areas' ? t.areaId === x.id : tipo === 'proyectos' ? t.proyectoId === x.id : t.seccionId === x.id));
    const nPend = tareas.filter(t => !hecha(t)).length, nHechas = tareas.filter(hecha).length;
    const nProy = tipo === 'areas' ? d.proyectos.filter(p => p.areaId === x.id).length : 0;
    const nSec = tipo === 'proyectos' ? d.secciones.filter(s => s.proyectoId === x.id).length : 0;
    const despues = async (deshacer) => {
      ctx.aviso(`"${x.nombre}" se fue a la papelera`, { accion: 'Deshacer', alTocar: deshacer, duracion: 7000 });
      if ((vista === 'area' && tipo === 'areas' && idRuta === x.id) || (vista === 'proyecto' && tipo === 'proyectos' && idRuta === x.id) || (vista === 'seccion' && idRuta === x.id)) {
        ctx.navegar(tipo === 'secciones' ? `tareas/proyecto/${x.proyectoId}` : tipo === 'proyectos' ? `tareas/area/${x.areaId}` : 'tareas');
      }
    };
    if (!nPend && !nHechas && !nProy && !nSec) { m.eliminar(tipo, x.id, { modo: 'todo' }).then(despues); return; }

    // A dónde pueden ir las tareas.
    const opciones = [];
    const p = tipo === 'secciones' ? d.proyecto(x.proyectoId) : tipo === 'proyectos' ? x : null;
    const areaPropia = tipo === 'areas' ? null : d.area(tipo === 'proyectos' ? x.areaId : p?.areaId);
    if (tipo === 'secciones' && p) {
      opciones.push(['p:' + p.id, `${p.nombre}, sin sección`]);
      for (const s of seccionesDe(p.id).filter(s => s.id !== x.id)) opciones.push(['s:' + s.id, `${p.nombre} › ${s.nombre}`]);
    }
    if (areaPropia) opciones.push(['a:' + areaPropia.id, `Sueltas en ${areaPropia.nombre}`]);
    opciones.push(['', 'Bandeja de entrada']);
    for (const a of areasActivas().filter(a => a.id !== x.id)) {
      if (a.id !== areaPropia?.id) opciones.push(['a:' + a.id, a.nombre]);
      for (const pr of proyectosDe(a.id).filter(pr => pr.id !== x.id && pr.id !== p?.id)) opciones.push(['p:' + pr.id, `— ${pr.nombre}`]);
    }
    const destino = h('select', { 'aria-label': 'Reubicar en' }, opciones.map(([v, t]) => h('option', { value: v }, t)));
    let modo = 'reubicar', completadas = 'mover';
    const opcion = (valor, titulo, texto, ...extra) => h('label', { class: `tr-opcion${modo === valor ? ' activa' : ''}`, 'data-valor': valor },
      h('input', { type: 'radio', name: 'tr-eliminar', value: valor, checked: modo === valor, onchange: () => { modo = valor; marcar(); } }),
      h('b', {}, titulo), h('small', {}, texto), extra);
    const segHechas = nHechas ? h('div', { class: 'tr-opcion-extra' }, h('small', {}, nHechas > 1 ? `Las ${nHechas} completadas:` : 'La completada:'),
      h('span', { class: 'tr-seg' },
        h('button', { type: 'button', class: 'activo', onclick: (e) => { completadas = 'mover'; e.currentTarget.classList.add('activo'); e.currentTarget.nextElementSibling.classList.remove('activo'); } }, 'Moverlas también'),
        h('button', { type: 'button', onclick: (e) => { completadas = 'eliminar'; e.currentTarget.classList.add('activo'); e.currentTarget.previousElementSibling.classList.remove('activo'); } }, 'Eliminarlas'))) : null;
    const contiene = [
      nProy ? `${nProy} proyecto${nProy > 1 ? 's' : ''}` : '', nSec ? `${nSec} sección${nSec > 1 ? 'es' : ''}` : '',
      nPend ? `${nPend} tarea${nPend > 1 ? 's' : ''} pendiente${nPend > 1 ? 's' : ''}` : '', nHechas ? `${nHechas} completada${nHechas > 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(', ');
    const queMueve = tipo === 'areas' ? 'Las tareas pasan a: (si elegís otra área, los proyectos pasan enteros)' : 'Las tareas pasan a:';
    const op1 = opcion('reubicar', 'Reubicar', queMueve, destino, segHechas);
    const op2 = opcion('todo', 'Eliminar todo', 'Se va a la papelera con todo lo que tiene. Lo podés recuperar durante 30 días.');
    function marcar() { op1.classList.toggle('activa', modo === 'reubicar'); op2.classList.toggle('activa', modo === 'todo'); }
    const dlg = ventana(`Eliminar ${x.nombre}`, [h('p', { class: 'nota' }, `Contiene ${contiene}. ¿Qué hacemos con lo que tiene adentro?`), op1, op2], {
      botones: [
        h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { type: 'button', class: 'boton peligro', onclick: async (e) => {
          e.currentTarget.disabled = true;
          const v = destino.value;
          let dest = {};
          if (v.startsWith('a:')) dest = { areaId: v.slice(2) };
          else if (v.startsWith('p:')) { const pr = d.proyecto(v.slice(2)); dest = { areaId: pr?.areaId, proyectoId: pr?.id }; }
          else if (v.startsWith('s:')) { const s = d.seccion(v.slice(2)); const pr = d.proyecto(s?.proyectoId); dest = { areaId: pr?.areaId, proyectoId: pr?.id, seccionId: s?.id }; }
          const deshacer = await m.eliminar(tipo, x.id, { modo, destino: dest, completadas });
          dlg.close();
          despues(deshacer);
        } }, 'Eliminar'),
      ],
    });
  }

  // ── Inicio: resumen de todo ──

  function vistaInicio() {
    const venc = porFecha(pendientes().filter(vencida)), deHoyL = porFecha(pendientes().filter(deHoy));
    const semana = porFecha(pendientes().filter(t => t.fecha && t.fecha > hoy() && t.fecha <= finSemana()));
    const cuadro = (n, texto, ancla2, clase = '') => h('a', { href: `#/tareas/hoy/${ancla2}`, class: `tr-cuadrito ${clase}` }, h('b', {}, String(n)), h('span', {}, texto));
    // Contadores de cada área/proyecto: vencidas (rojo), para hoy (verde) y total (gris).
    // Cómo se ven se elige en Configuración: con símbolo, solo color o nada (solo el total).
    const cfg = configHojas();
    const modoCont = cfg.inicioCont;
    const contador = (clase, icNombre, n, titulo) => h('span', { class: `tr-cont ${clase}`, title: titulo }, modoCont === 'simbolo' ? ic(icNombre) : null, String(n));
    const nodo = (href, icNombre, nombre, f, clase = '') => {
      const total = cuenta(f), v = cuenta(t => f(t) && vencida(t)), hy = cuenta(t => f(t) && deHoy(t));
      return h('a', { href, class: `tr-nodo ${clase}` },
        ic(icNombre), h('span', { class: 'tr-nodo-nombre' }, nombre),
        h('span', { class: `tr-conts modo-${modoCont}` },
          modoCont !== 'nada' && v ? contador('venc', 'alerta', v, `${v} vencida${v > 1 ? 's' : ''}`) : null,
          modoCont !== 'nada' && hy ? contador('hoy', 'sol', hy, `${hy} para hoy`) : null,
          total ? contador('total', 'circulo', total, `${total} pendiente${total > 1 ? 's' : ''} en total`) : null));
    };
    const leyendaItem = (clase, icNombre, texto) => h('span', { class: `tr-ley ${clase}` }, modoCont === 'simbolo' ? ic(icNombre) : h('i', {}), texto);
    const leyenda = modoCont !== 'nada' && cfg.leyenda
      ? h('div', { class: 'tr-leyenda' }, leyendaItem('venc', 'alerta', 'vencidas'), leyendaItem('hoy', 'sol', 'para hoy'), leyendaItem('total', 'circulo', 'pendientes'))
      : null;
    const crearArea = async () => { const n = await pedirNombre(ctx, 'Nueva área', '', 'Crear área'); if (n) { await m.crearArea(n); ctx.aviso(`Área "${n}" creada`); } };
    return [
      h('div', { class: 'tr-cuadritos' }, cuadro(venc.length, 'Vencidas', 'vencidas', venc.length ? 'alerta' : ''), cuadro(deHoyL.length, 'Para hoy', 'hoy'), cuadro(semana.length, 'Esta semana', 'proximos')),
      h('section', { class: 'tr-tarjeta' },
        h('div', { class: 'tr-tarjeta-cab' }, h('h2', {}, 'Hoy'), h('a', { href: '#/tareas/hoy/hoy', class: 'tr-link' }, 'Ver todo ›')),
        deHoyL.length ? lista(deHoyL) : nada(venc.length ? `Nada para hoy. Tenés ${venc.length} vencida${venc.length > 1 ? 's' : ''}.` : 'Nada para hoy.')),
      h('section', { class: 'tr-tarjeta' },
        h('div', { class: 'tr-tarjeta-cab' }, h('h2', {}, 'Áreas'), h('button', { type: 'button', class: 'boton-icono chico', 'aria-label': 'Nueva área', onclick: crearArea }, icono('mas'))),
        leyenda,
        h('nav', { class: 'tr-arbol', 'aria-label': 'Áreas' },
          nodo('#/tareas/bandeja', 'bandeja', 'Bandeja de entrada', t => !t.areaId, 'tr-nodo-area'),
          areasActivas().map(a => [
            nodo(`#/tareas/area/${a.id}`, iconoArea(a), a.nombre, t => t.areaId === a.id, 'tr-nodo-area'),
            proyectosDe(a.id).map(p => nodo(`#/tareas/proyecto/${p.id}`, iconoProyecto(p), p.nombre, t => t.proyectoId === p.id, 'tr-nodo-proyecto')),
          ])),
        areasActivas().length ? null : h('p', { class: 'nota' }, 'Creá tu primera área con el botón +. Un área es una parte permanente de tu vida, como el trabajo o la casa.')),
    ];
  }

  // ── Hoy: vencidas, hoy y próximos ──

  function vistaHoy() {
    const venc = porFecha(pendientes().filter(vencida)), deHoyL = porFecha(pendientes().filter(deHoy));
    const prox = porFecha(pendientes().filter(t => t.fecha && t.fecha > hoy() && t.fecha <= finSemana()));
    const despues = porFecha(pendientes().filter(t => t.fecha && t.fecha > finSemana()));
    const hechasHoy = porFecha(d.tareas.filter(t => hecha(t) && t.completada && new Date(t.completada).toDateString() === new Date().toDateString()));
    const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const porDia = (ts) => [...new Set(ts.map(t => t.fecha))].sort().map(f => [h('p', { class: 'tr-dia-nombre' }, textoFecha(f)), lista(ts.filter(t => t.fecha === f))]);
    return [
      venc.length ? h('section', { class: 'tr-grupo tr-grupo-vencidas', id: 'tr-ancla-vencidas' },
        h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, 'Vencidas', h('span', { class: 'tr-grupo-n' }, String(venc.length)))), lista(venc)) : h('span', { id: 'tr-ancla-vencidas' }),
      h('section', { class: 'tr-grupo', id: 'tr-ancla-hoy' },
        h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, 'Hoy', h('span', { class: 'tr-grupo-n' }, fechaHoy))),
        deHoyL.length ? lista(deHoyL) : nada('Nada para hoy.'),
        lineaRapida({ fecha: hoy() }, 'Agregar tarea para hoy…'),
        hechasHoy.length ? h('details', { class: 'tr-hechas' }, h('summary', {}, `Completadas hoy (${hechasHoy.length})`), lista(hechasHoy)) : null),
      h('section', { class: 'tr-proximos', id: 'tr-ancla-proximos' },
        h('h2', {}, 'Próximos 7 días'),
        prox.length ? porDia(prox) : nada('Nada en los próximos 7 días.'),
        despues.length ? h('button', { type: 'button', class: 'tr-link', onclick: () => { verMasAdelante = !verMasAdelante; dibujar(); } },
          verMasAdelante ? 'Ocultar lo que viene después' : `Más adelante (${despues.length})`) : null,
        verMasAdelante && despues.length ? porDia(despues) : null),
    ];
  }

  // ── Bandeja ──

  function vistaBandeja() {
    const todas = principales(d.tareas.filter(t => !t.areaId));
    const pend = todas.filter(t => !hecha(t)), hechas = todas.filter(hecha);
    const ver = mostrarHechas.has('bandeja');
    ordenVista = ordenDe('bandeja', 'lista');
    const porFechaG = ordenVista.agrupar === 'fecha';
    return [
      tituloVista('bandeja', 'Bandeja de entrada', null, botonOrden('bandeja', 'lista'), chipHechas('bandeja', hechas.length)),
      h('p', { class: 'nota' }, 'Lo que capturás desde Inicio llega acá. Abrí cada tarea y asignale un área cuando puedas.'),
      pend.length ? (porFechaG ? porGruposDeFecha(pend, { ubicacion: false }) : lista(pend, { ubicacion: false, manual: true })) : nada('Bandeja vacía.'),
      lineaRapida({}),
      ver && hechas.length ? lista(hechas, { ubicacion: false, manual: true }) : null,
    ];
  }

  // ── Ordenar y agrupar (cada hoja recuerda lo suyo, por dispositivo) ──
  let ordenVista = { por: 'manual', sentido: 'asc', agrupar: '' };
  const AGRUPAR = {
    area: [['proyecto', 'Por proyecto'], ['fecha', 'Por fecha'], ['ninguno', 'Sin agrupar']],
    proyecto: [['seccion', 'Por sección'], ['fecha', 'Por fecha'], ['ninguno', 'Sin agrupar']],
    lista: [['ninguno', 'Sin agrupar'], ['fecha', 'Por fecha']],
  };
  function ordenDe(clave, tipo) {
    const g = d.ajuste(claveHojas())?.ordenes?.[clave] || {};
    const agrupables = AGRUPAR[tipo].map(x => x[0]);
    return {
      por: CRITERIOS.some(c => c[0] === g.por) ? g.por : 'manual',
      sentido: g.sentido === 'desc' ? 'desc' : 'asc',
      agrupar: agrupables.includes(g.agrupar) ? g.agrupar : agrupables[0],
    };
  }
  function botonOrden(clave, tipo) {
    const o = ordenDe(clave, tipo);
    const cambiado = o.por !== 'manual' || o.agrupar !== AGRUPAR[tipo][0][0];
    const etiqueta = o.por === 'alfabetico' ? (o.sentido === 'desc' ? 'Z-A' : 'A-Z')
      : o.por !== 'manual' ? `${{ fecha: 'Por fecha', creado: 'Por creación', modificado: 'Por modificación' }[o.por]} ${o.sentido === 'desc' ? '↓' : '↑'}`
        : (cambiado ? AGRUPAR[tipo].find(x => x[0] === o.agrupar)[1] : null);
    return h('button', { type: 'button', class: `tr-orden${cambiado ? ' activo' : ''}`, title: 'Ordenar y agrupar', 'aria-label': 'Ordenar y agrupar', onclick: () => abrirOrden(clave, tipo) },
      ic('ordenar'), etiqueta ? h('span', {}, etiqueta) : null);
  }
  function abrirOrden(clave, tipo) {
    const o = ordenDe(clave, tipo);
    const contenido = h('div', { class: 'tr-config' });
    const guardar = async () => {
      const ordenes = { ...(d.ajuste(claveHojas())?.ordenes || {}), [clave]: { ...o } };
      await m.guardarHojas(claveHojas(), { ordenes });
    };
    const seg = (opciones, actual, alElegir, desactivado = false) => h('span', { class: `tr-seg${desactivado ? ' desactivado' : ''}` }, opciones.map(([v, t]) =>
      h('button', { type: 'button', class: v === actual ? 'activo' : '', disabled: desactivado, 'aria-pressed': String(v === actual), onclick: () => alElegir(v) }, t)));
    function pintar() {
      poner(contenido,
        h('h3', {}, 'Ordenar por'),
        h('div', { class: 'tr-orden-lista' }, CRITERIOS.map(([v, t]) => h('button', {
          type: 'button', class: `tr-orden-opcion${o.por === v ? ' activo' : ''}`, 'aria-pressed': String(o.por === v),
          onclick: async () => { o.por = v; pintar(); await guardar(); },
        }, h('span', { class: 'tr-orden-punto' }), t))),
        h('div', { class: 'tr-cfg-fila' }, h('span', {}, 'Sentido'),
          seg([['asc', o.por === 'alfabetico' ? 'A → Z' : 'Ascendente'], ['desc', o.por === 'alfabetico' ? 'Z → A' : 'Descendente']], o.sentido, async (v) => { o.sentido = v; pintar(); await guardar(); }, o.por === 'manual')),
        o.por === 'manual' ? h('p', { class: 'nota' }, 'En orden manual movés las tareas arrastrando la manija ⋮⋮.') : h('p', { class: 'nota' }, 'Con este orden no se arrastran: se acomodan solas. Las tareas sin fecha van al final.'),
        h('h3', {}, 'Agrupar'),
        seg(AGRUPAR[tipo], o.agrupar, async (v) => { o.agrupar = v; pintar(); await guardar(); }));
    }
    pintar();
    ventana('Ordenar y agrupar', contenido);
  }

  // Grupos por fecha: Vencidas, Hoy, Mañana, Esta semana, Más adelante, Sin fecha.
  function porGruposDeFecha(ts, opciones) {
    const tramos = [['vencida', 'Vencidas'], ['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Esta semana'], ['lejos', 'Más adelante'], ['sin', 'Sin fecha']];
    const tramo = (t) => (!t.fecha ? 'sin' : claseFecha(t));
    return tramos.map(([k, titulo]) => {
      const del = ts.filter(t => tramo(t) === k);
      if (!del.length) return null;
      return h('section', { class: `tr-grupo-fecha ${k}` },
        h('p', { class: 'tr-grupo-fecha-titulo' }, titulo, h('span', { class: 'tr-grupo-n' }, String(del.filter(t => !hecha(t)).length))),
        lista(del, { ...opciones, manual: true, sinArrastre: true }));
    });
  }

  const agregarEn = (base) => h('button', { type: 'button', class: 'tr-agregar', onclick: () => abrir(null, base) }, icono('mas'), 'Agregar tarea');

  // Línea rápida arriba de cada lista (en la PC): se escribe y Enter.
  function lineaRapida(base, ayuda = 'Agregar tarea…') {
    const campo = h('input', { type: 'text', class: 'tr-rapida-campo', placeholder: ayuda, 'aria-label': 'Agregar tarea rápida', autocomplete: 'off', enterkeyhint: 'done' });
    campo.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || !campo.value.trim()) return;
      e.preventDefault();
      const titulo = campo.value.trim();
      campo.value = '';
      await m.crearTarea({ ...base, titulo });
      ctx.aviso(`Tarea creada: "${titulo}"`);
      setTimeout(() => cuerpo.querySelector('.tr-rapida-campo')?.focus(), 150);
    });
    return h('div', { class: 'tr-rapida' }, icono('mas'), campo);
  }

  // Tareas de un proyecto: sin sección primero y después cada sección.
  function cuerpoProyecto(p, visibles, { conMenuSeccion = true } = {}) {
    const secciones = seccionesDe(p.id);
    const base = { areaId: p.areaId, proyectoId: p.id };
    const sinSeccion = visibles.filter(t => !t.seccionId || !secciones.some(s => s.id === t.seccionId));
    return [
      sinSeccion.length ? lista(sinSeccion, { ubicacion: false, manual: true }) : null,
      secciones.map(s => {
        const ts = visibles.filter(t => t.seccionId === s.id);
        return h('section', { class: 'tr-seccion' },
          h('div', { class: 'tr-seccion-cab' },
            h('a', { href: `#/tareas/seccion/${s.id}`, class: 'tr-seccion-nombre' }, s.nombre, h('span', { class: 'tr-grupo-n' }, String(ts.filter(t => !hecha(t)).length))),
            conMenuSeccion ? h('button', { type: 'button', class: 'boton-icono chico', 'aria-label': `Opciones de la sección ${s.nombre}`, onclick: () => opcionesSeccion(s) }, ic('puntos')) : null),
          ts.length ? lista(ts, { ubicacion: false, manual: true }) : null,
          agregarEn({ ...base, seccionId: s.id }));
      }),
    ];
  }

  // ── Área: tareas sueltas y cada proyecto con sus secciones ──

  function vistaArea() {
    const a = d.area(idRuta);
    if (!a) return [vacio('Esta área no existe', 'Puede que se haya eliminado en otro dispositivo.', h('a', { href: '#/tareas', class: 'boton' }, 'Volver a Tareas'))];
    const clave = `area-${a.id}`;
    const delArea = principales(d.tareas.filter(t => t.areaId === a.id));
    const visibles = mostrarHechas.has(clave) ? delArea : delArea.filter(t => !hecha(t));
    const proys = proyectosDe(a.id);
    const sueltas = visibles.filter(t => !t.proyectoId || !proys.some(p => p.id === t.proyectoId));
    ordenVista = ordenDe(clave, 'area');
    const cabecera = [
      tituloVista(iconoArea(a), a.nombre + (a.archivada ? ' (archivada)' : ''), () => opcionesArea(a), botonOrden(clave, 'area'), chipHechas(clave, delArea.filter(hecha).length)),
    ];
    if (ordenVista.agrupar === 'fecha') return [...cabecera, visibles.length ? porGruposDeFecha(visibles, { ubicacion: 'proyecto' }) : nada('Sin tareas pendientes.'), agregarEn({ areaId: a.id })];
    if (ordenVista.agrupar === 'ninguno') return [...cabecera, visibles.length ? lista(visibles, { ubicacion: 'proyecto', manual: true }) : nada('Sin tareas pendientes.'), agregarEn({ areaId: a.id })];
    return [
      ...cabecera,
      sueltas.length ? lista(sueltas, { ubicacion: false, manual: true }) : (proys.length ? null : nada('Sin tareas todavía. Tocá "Nueva tarea", o creá un proyecto desde el menú (···).')),
      agregarEn({ areaId: a.id }),
      proys.map(p => {
        const ts = visibles.filter(t => t.proyectoId === p.id);
        return h('section', { class: 'tr-proyecto' },
          h('div', { class: 'tr-proyecto-cab' },
            h('a', { href: `#/tareas/proyecto/${p.id}`, class: 'tr-proyecto-nombre' }, ic(iconoProyecto(p)), h('span', {}, p.nombre), h('span', { class: 'tr-grupo-n' }, String(ts.filter(t => !hecha(t)).length))),
            h('button', { type: 'button', class: 'boton-icono chico', 'aria-label': `Opciones de ${p.nombre}`, onclick: () => opcionesProyecto(p) }, ic('puntos'))),
          cuerpoProyecto(p, ts),
          seccionesDe(p.id).length ? null : agregarEn({ areaId: a.id, proyectoId: p.id }));
      }),
    ];
  }

  // ── Proyecto ──

  function vistaProyecto() {
    const p = d.proyecto(idRuta);
    if (!p) return [vacio('Este proyecto no existe', 'Puede que se haya eliminado en otro dispositivo.', h('a', { href: '#/tareas', class: 'boton' }, 'Volver a Tareas'))];
    const a = d.area(p.areaId);
    const tareas = principales(d.tareas.filter(t => t.proyectoId === p.id));
    const clave = `proyecto-${p.id}`;
    const visibles = mostrarHechas.has(clave) ? tareas : tareas.filter(t => !hecha(t));
    const cfg = configHojas();
    const esHoja = cfg.lista.some(x => x.id === `p:${p.id}` && x.vis);
    ordenVista = ordenDe(clave, 'proyecto');
    const cuerpoP = ordenVista.agrupar === 'fecha' ? porGruposDeFecha(visibles, { ubicacion: false })
      : ordenVista.agrupar === 'ninguno' ? lista(visibles, { ubicacion: false, manual: true })
        : cuerpoProyecto(p, visibles);
    return [
      esHoja ? null : volver(a ? `#/tareas/area/${a.id}` : '#/tareas', a?.nombre || 'Tareas'),
      tituloVista(iconoProyecto(p), p.nombre + (p.archivado ? ' (archivado)' : ''), () => opcionesProyecto(p), botonOrden(clave, 'proyecto'), chipHechas(clave, tareas.filter(hecha).length)),
      cuerpoP,
      agregarEn({ areaId: p.areaId, proyectoId: p.id }),
      seccionesDe(p.id).length ? null : h('p', { class: 'nota' }, 'Podés dividir el proyecto en secciones desde el menú (···).'),
    ];
  }

  // ── Sección ──

  function vistaSeccion() {
    const s = d.seccion(idRuta);
    const p = s && d.proyecto(s.proyectoId);
    if (!s || !p) return [vacio('Esta sección no existe', 'Puede que se haya eliminado en otro dispositivo.', h('a', { href: '#/tareas', class: 'boton' }, 'Volver a Tareas'))];
    const tareas = principales(d.tareas.filter(t => t.seccionId === s.id));
    const clave = `seccion-${s.id}`;
    ordenVista = ordenDe(clave, 'lista');
    const visibles = mostrarHechas.has(clave) ? tareas : tareas.filter(t => !hecha(t));
    return [
      volver(`#/tareas/proyecto/${p.id}`, p.nombre),
      tituloVista('seccion', s.nombre + (s.archivada ? ' (archivada)' : ''), () => opcionesSeccion(s), botonOrden(clave, 'lista'), chipHechas(clave, tareas.filter(hecha).length)),
      visibles.length ? (ordenVista.agrupar === 'fecha' ? porGruposDeFecha(visibles, { ubicacion: false }) : lista(visibles, { ubicacion: false, manual: true })) : nada('Sin tareas pendientes en esta sección.'),
      agregarEn({ areaId: p.areaId, proyectoId: p.id, seccionId: s.id }),
    ];
  }

  // ── Filtro guardado ──

  function vistaFiltro() {
    const f = d.filtro(idRuta);
    if (!f) return [vacio('Este filtro no existe', null, h('a', { href: '#/tareas', class: 'boton' }, 'Volver a Tareas'))];
    const opciones = () => menu(ctx, f.nombre, [
      { texto: 'Editar filtro', accion: async () => { const nuevo = await pedirFiltro(ctx, d, f); if (nuevo) await m.actualizarFiltro(f.id, nuevo); } },
      { texto: 'Borrar filtro', peligro: true, accion: async () => { if (await ctx.confirmar(`¿Borrar el filtro "${f.nombre}"? Las tareas no se tocan.`, { si: 'Borrar', peligro: true })) { await m.borrarFiltro(f.id); ctx.navegar('tareas'); } } },
    ]);
    const resultado = aplicarFiltro(d.tareas, f);
    const pend = resultado.filter(t => !hecha(t)), hechas = resultado.filter(hecha);
    return [
      volver('#/tareas', 'Tareas'),
      tituloVista('filtro', f.nombre, opciones),
      resultado.length ? null : h('p', { class: 'nota' }, 'Ninguna tarea cumple este filtro por ahora.'),
      pend.length ? lista(pend) : null,
      hechas.length ? h('details', { class: 'tr-hechas' }, h('summary', {}, `Completadas (${hechas.length})`), lista(hechas)) : null,
    ];
  }

  // ── Búsqueda ──

  const zonaResultados = h('div', { class: 'tr-resultados' });
  function dibujarResultados() {
    if (!consulta.trim()) { poner(zonaResultados, h('p', { class: 'nota' }, 'Buscá por título, notas o etiqueta (por ejemplo #compras).')); return; }
    const encontradas = aplicarFiltro(d.tareas, { texto: consulta, incluirHechas: true });
    const pend = encontradas.filter(t => !hecha(t)), hechas = encontradas.filter(hecha);
    poner(zonaResultados,
      encontradas.length ? null : h('p', { class: 'nota' }, 'No hay tareas que coincidan.'),
      pend.length ? lista(pend) : null,
      hechas.length ? h('details', { class: 'tr-hechas' }, h('summary', {}, `Completadas (${hechas.length})`), lista(hechas)) : null);
  }
  function vistaBuscar() {
    const campo = h('input', {
      type: 'search', value: consulta, placeholder: 'Buscar tareas', 'aria-label': 'Buscar tareas', autocomplete: 'off',
      oninput: (e) => { consulta = e.target.value; dibujarResultados(); },
    });
    setTimeout(() => campo.focus(), 0);
    dibujarResultados();
    return [volver('#/tareas', 'Tareas'), campo, zonaResultados];
  }

  // ── Dibujo ──

  const VISTAS = {
    inicio: vistaInicio, hoy: vistaHoy,
    bandeja: vistaBandeja, area: vistaArea, proyecto: vistaProyecto, seccion: vistaSeccion,
    filtro: vistaFiltro, buscar: vistaBuscar,
  };

  // Modo compacto: encabezado "Repetición · Fecha" arriba de la primera lista.
  function ponerEncabezadoColumnas() {
    const fila = cuerpo.querySelector('.tr-tarea');
    if (!fila) return;
    let listaRaiz = fila.closest('.tr-lista');
    while (listaRaiz?.parentElement?.closest('.tr-lista')) listaRaiz = listaRaiz.parentElement.closest('.tr-lista');
    if (!listaRaiz) return;
    const enc = h('span', { class: 'tr-col-enc', 'aria-hidden': 'true' }, h('span', { class: 'tr-col-rep' }, 'Repetición'), h('span', { class: 'tr-col-fecha' }, 'Fecha'));
    const antes = listaRaiz.previousElementSibling;
    if (antes && antes.matches('.tr-grupo-cabecera, .tr-grupo-fecha-titulo, .tr-seccion-cabecera, .tr-proyecto-cabecera')) {
      antes.classList.add('con-columnas'); antes.append(enc);
    } else listaRaiz.before(h('div', { class: 'tr-col-cab' }, enc));
  }

  let primeraVez = true;
  function dibujar() {
    const cfg = configHojas();
    dibujarHojas(cfg);
    cuerpo.classList.toggle('tr-compacto', cfg.compacto);
    if (vista === 'buscar' && !primeraVez) { dibujarResultados(); return; }
    const scroll = window.scrollY;
    ordenVista = { por: 'manual', sentido: 'asc', agrupar: '' };
    poner(cuerpo, (VISTAS[vista] || VISTAS.inicio)());
    if (cfg.compacto) ponerEncabezadoColumnas();
    marcarActiva();
    if (primeraVez && ancla) {
      // Desde Inicio: bajar hasta Vencidas, Hoy o Próximos.
      requestAnimationFrame(() => {
        const el = document.getElementById(`tr-ancla-${ancla}`);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
      });
    } else if (!primeraVez) window.scrollTo(0, scroll);
    primeraVez = false;
  }

  let espera = null;
  const quitar = ctx.alCambiarDatos(() => {
    clearTimeout(espera);
    espera = setTimeout(async () => { d = await m.cargar(); dibujar(); }, 60);
  });
  // Al girar el celular o cambiar el ancho, la configuración puede ser otra (PC o celular).
  let eraPC = esPC();
  const alCambiarAncho = () => {
    if (esPC() === eraPC) return;
    eraPC = esPC();
    // El detalle al costado solo existe en la PC.
    if (!eraPC && editor) editor.cerrar();
    if (eraPC) ponerAncho(parseFloat(zona.style.getPropertyValue('--tr-ancho-panel')) || 520);
    dibujar();
  };
  window.addEventListener('resize', alCambiarAncho);

  dibujar();
  return () => {
    quitar(); clearTimeout(espera); window.removeEventListener('resize', alCambiarAncho);
    document.removeEventListener('pointerdown', alTocarAfuera, true);
    if (abridor) abridor = null;
    clearTimeout(cierrePanel);
  };
}
