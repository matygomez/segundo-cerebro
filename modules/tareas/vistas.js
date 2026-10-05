// ─────────────────────────────────────────────────────────────
// Tareas: pantallas.
//
// Rutas:
//   #/tareas               → Hoy
//   #/tareas/proximos      → próximos días
//   #/tareas/vencidas
//   #/tareas/areas         → áreas y proyectos
//   #/tareas/sin-area      → lo capturado sin clasificar
//   #/tareas/area/<id>
//   #/tareas/proyecto/<id>
//   #/tareas/buscar
// ─────────────────────────────────────────────────────────────

import {
  crearModelo, hoy, hecha, vencida, deHoy, ordenar,
  textoFecha, textoRepeticion, textoDuracion, PRIORIDADES,
} from './modelo.js';
import { abrirEditor, menu, pedirNombre, poner } from './editor.js';

// Íconos propios del módulo.
const TRAZOS = {
  buscar: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  repetir: '<path d="M4 12a7 7 0 0 1 12-5l2 2"/><path d="M18 5v4h-4"/><path d="M20 12a7 7 0 0 1-12 5l-2-2"/><path d="M6 19v-4h4"/>',
  campana: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  lista: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="m4 7 1 1 2-2M4 12l1 1 2-2M4 17l1 1 2-2"/>',
  puntos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  carpeta: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"/>',
  bandeja: '<path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M5.5 6h13L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  reloj: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
};

function ic(nombre) {
  const s = document.createElement('span');
  s.className = 'icono';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre]}</svg>`;
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

const mostrarHechas = new Set();   // vistas donde el usuario pidió ver las hechas

// ── Fila de una tarea (se usa también en el bloque de Inicio) ──

export function filaTarea(ctx, m, d, t, { ubicacion = true } = {}) {
  const { h } = ctx;
  const meta = [];
  if (t.fecha) meta.push(h('span', { class: vencida(t) ? 'tr-meta vencida' : 'tr-meta' }, textoFecha(t.fecha), t.hora ? ` ${t.hora}` : ''));
  if (t.repeticion?.tipo) meta.push(h('span', { class: 'tr-meta', title: textoRepeticion(t.repeticion) }, ic('repetir'), textoRepeticion(t.repeticion)));
  if (t.estado === 'en-curso') meta.push(h('span', { class: 'tr-meta tr-en-curso' }, 'En curso'));
  if (t.subtareas?.length) meta.push(h('span', { class: 'tr-meta' }, ic('lista'), `${t.subtareas.filter(s => s.hecha).length}/${t.subtareas.length}`));
  if (t.duracion) meta.push(h('span', { class: 'tr-meta' }, ic('reloj'), textoDuracion(t.duracion)));
  if (t.recordatorio) meta.push(h('span', { class: 'tr-meta', title: 'Recordatorio' }, ic('campana'), textoFecha(t.recordatorio.slice(0, 10)), ' ', t.recordatorio.slice(11, 16)));
  if (ubicacion) {
    const partes = [d.area(t.areaId)?.nombre, d.proyecto(t.proyectoId)?.nombre].filter(Boolean);
    if (partes.length) meta.push(h('span', { class: 'tr-meta tr-ubic' }, partes.join(' / ')));
  }
  for (const e of t.etiquetas || []) meta.push(h('span', { class: 'tr-etiqueta' }, `#${e}`));

  const prio = PRIORIDADES.find(p => p.valor === (t.prioridad || 1));
  const check = h('button', {
    type: 'button', class: `tr-check prio-${t.prioridad || 1}${hecha(t) ? ' hecha' : ''}${t.estado === 'en-curso' ? ' en-curso' : ''}`,
    'aria-label': hecha(t) ? `Reabrir "${t.titulo}"` : `Completar "${t.titulo}" (prioridad ${prio.nombre})`,
    onclick: async (e) => {
      e.currentTarget.disabled = true;
      if (hecha(t)) { await m.reabrir(t); return; }
      const prox = await m.completar(t);
      if (prox) ctx.aviso(`Hecha. Vuelve ${textoFecha(prox).toLowerCase()}.`);
      else ctx.aviso('Tarea hecha', { accion: 'Deshacer', alTocar: () => m.reabrir({ ...t, estado: 'hecha' }) });
    },
  }, h('span', { class: 'tr-check-marca' }));

  return h('li', { class: hecha(t) ? 'tr-tarea hecha' : 'tr-tarea' },
    check,
    h('button', { type: 'button', class: 'tr-cuerpo', onclick: () => abrirEditor(ctx, m, d, t) },
      h('span', { class: 'tr-titulo' }, t.titulo),
      meta.length ? h('span', { class: 'tr-metas' }, meta) : null));
}

// ── Pantalla principal ──

export async function pantallaTareas(contenedor, ctx, sub = []) {
  cargarEstilos();
  const { h, icono } = ctx;
  const m = crearModelo(ctx);
  const vista = sub[0] || 'hoy';
  const idRuta = sub[1] || '';
  let d = await m.cargar();
  let consulta = '';

  const cuerpo = h('div', { class: 'tr-cuerpo-vista' });
  const pestanas = h('nav', { class: 'tr-pestanas', 'aria-label': 'Vistas de tareas' });
  const nueva = h('button', { type: 'button', class: 'tr-fab', 'aria-label': 'Nueva tarea', onclick: () => abrirEditor(ctx, m, d, null, valoresPorDefecto()) }, icono('mas'), h('span', {}, 'Nueva tarea'));

  contenedor.replaceChildren(
    h('header', { class: 'cabecera-pantalla tr-cabecera' },
      h('h1', {}, 'Tareas'),
      h('a', { href: '#/tareas/buscar', class: 'boton-icono', 'aria-label': 'Buscar tareas' }, ic('buscar'))),
    pestanas, cuerpo, nueva);

  function valoresPorDefecto() {
    if (vista === 'hoy') return { fecha: hoy() };
    if (vista === 'area') return { areaId: idRuta };
    if (vista === 'proyecto') { const p = d.proyecto(idRuta); return { areaId: p?.areaId || '', proyectoId: idRuta }; }
    return {};
  }

  const pendientes = () => d.tareas.filter(t => !hecha(t));

  function dibujarPestanas() {
    const nVenc = pendientes().filter(vencida).length;
    const nHoy = pendientes().filter(deHoy).length + nVenc;
    const activa = ['area', 'proyecto', 'sin-area'].includes(vista) ? 'areas' : vista;
    const p = (id, texto, n, alerta) => h('a', { href: `#/tareas/${id}`, class: 'tr-pestana', 'aria-current': activa === id ? 'page' : false },
      texto, n ? h('span', { class: alerta ? 'tr-cuenta alerta' : 'tr-cuenta' }, String(n)) : null);
    pestanas.replaceChildren(p('hoy', 'Hoy', nHoy), p('proximos', 'Próximos'), p('vencidas', 'Vencidas', nVenc, true), p('areas', 'Áreas'));
  }

  const lista = (tareas, opciones) => h('ul', { class: 'tr-lista' }, ordenar(tareas).map(t => filaTarea(ctx, m, d, t, opciones)));

  function grupo(titulo, tareas, { clase = '', opciones, extra } = {}) {
    return h('section', { class: `tr-grupo ${clase}` },
      h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, titulo, h('span', { class: 'tr-grupo-n' }, String(tareas.length))), extra || null),
      tareas.length ? lista(tareas, opciones) : null);
  }

  function vacio(titulo, texto, ...botones) {
    return h('div', { class: 'vacio' }, h('h2', {}, titulo), texto ? h('p', {}, texto) : null, botones.length ? h('div', { class: 'botonera' }, botones) : null);
  }

  function interruptorHechas(clave, n) {
    if (!n) return null;
    const visible = mostrarHechas.has(clave);
    return h('button', { type: 'button', class: 'tr-link', onclick: () => { visible ? mostrarHechas.delete(clave) : mostrarHechas.add(clave); dibujar(); } },
      visible ? 'Ocultar hechas' : `Mostrar hechas (${n})`);
  }

  // ── Vistas ──

  function vistaHoy() {
    const venc = pendientes().filter(vencida);
    const deHoyL = pendientes().filter(deHoy);
    const enCurso = pendientes().filter(t => t.estado === 'en-curso' && !vencida(t) && !deHoy(t));
    const hechasHoy = d.tareas.filter(t => hecha(t) && t.completada && new Date(t.completada).toDateString() === new Date().toDateString());
    const partes = [];
    if (venc.length) partes.push(grupo('Vencidas', venc, { clase: 'tr-grupo-vencidas' }));
    partes.push(deHoyL.length || venc.length ? grupo('Hoy', deHoyL) : vacio('Nada para hoy', 'Las tareas con fecha de hoy aparecen acá.', h('button', { class: 'boton principal', onclick: () => abrirEditor(ctx, m, d, null, { fecha: hoy() }) }, icono('mas'), 'Nueva tarea para hoy')));
    if (enCurso.length) partes.push(grupo('En curso', enCurso));
    if (hechasHoy.length) partes.push(h('details', { class: 'tr-hechas' }, h('summary', {}, `Hechas hoy (${hechasHoy.length})`), lista(hechasHoy)));
    return partes;
  }

  function vistaProximos() {
    const futuras = pendientes().filter(t => t.fecha && t.fecha > hoy());
    if (!futuras.length) return [vacio('Sin tareas próximas', 'Las tareas con fecha a partir de mañana aparecen acá, agrupadas por día.')];
    const fechas = [...new Set(futuras.map(t => t.fecha))].sort();
    return fechas.map(f => grupo(textoFecha(f), futuras.filter(t => t.fecha === f)));
  }

  function vistaVencidas() {
    const venc = pendientes().filter(vencida);
    if (!venc.length) return [vacio('No hay tareas vencidas', 'Todo al día.')];
    const fechas = [...new Set(venc.map(t => t.fecha))].sort();
    return fechas.map(f => grupo(textoFecha(f), venc.filter(t => t.fecha === f), { clase: 'tr-grupo-vencidas' }));
  }

  function vistaAreas() {
    const sinArea = pendientes().filter(t => !t.areaId).length;
    const activas = d.areas.filter(a => !a.archivada);
    const archivadas = d.areas.filter(a => a.archivada);
    const cuenta = (filtro) => pendientes().filter(filtro).length;
    const filaNav = (href, icNombre, nombre, n, clase = '') => h('a', { href, class: `tr-nav ${clase}` },
      ic(icNombre), h('span', { class: 'tr-nav-nombre' }, nombre), n ? h('span', { class: 'tr-cuenta' }, String(n)) : null, ic('flecha'));

    const crear = h('button', {
      class: 'boton principal', onclick: async () => {
        const nombre = await pedirNombre(ctx, 'Nueva área', '', 'Crear área');
        if (nombre) { await m.crearArea(nombre); ctx.aviso(`Área "${nombre}" creada`); }
      },
    }, icono('mas'), 'Nueva área');

    const partes = [filaNav('#/tareas/sin-area', 'bandeja', 'Sin área', sinArea, 'tr-nav-bandeja')];
    if (!activas.length) {
      partes.push(vacio('Todavía no hay áreas', 'Un área es una parte permanente de tu vida, como el trabajo o la casa. Adentro podés armar proyectos y secciones.', crear));
    } else {
      partes.push(h('div', { class: 'tr-areas' }, activas.map(a => h('div', { class: 'tr-area' },
        filaNav(`#/tareas/area/${a.id}`, 'carpeta', a.nombre, cuenta(t => t.areaId === a.id)),
        d.proyectos.filter(p => p.areaId === a.id && !p.archivado).map(p =>
          filaNav(`#/tareas/proyecto/${p.id}`, 'lista', p.nombre, cuenta(t => t.proyectoId === p.id), 'tr-nav-proyecto'))))));
      partes.push(h('div', { class: 'botonera' }, crear));
    }
    if (archivadas.length) {
      partes.push(h('details', { class: 'tr-hechas' }, h('summary', {}, `Áreas archivadas (${archivadas.length})`),
        h('ul', { class: 'tr-archivo' }, archivadas.map(a => h('li', {}, h('span', {}, a.nombre),
          h('button', { class: 'tr-link', onclick: () => m.archivarArea(a.id, false) }, 'Restaurar'))))));
    }
    return partes;
  }

  function vistaSinArea() {
    const todas = d.tareas.filter(t => !t.areaId);
    const pend = todas.filter(t => !hecha(t));
    const hechas = todas.filter(hecha);
    const partes = [
      h('a', { href: '#/tareas/areas', class: 'tr-miga' }, '← Áreas'),
      h('div', { class: 'tr-titulo-vista' }, h('h2', {}, 'Sin área')),
      h('p', { class: 'nota' }, 'Lo que capturás desde Inicio llega acá. Abrí cada tarea y asignale un área cuando puedas.'),
      pend.length ? lista(pend, { ubicacion: false }) : vacio('Bandeja vacía', null),
      interruptorHechas('sin-area', hechas.length),
    ];
    if (mostrarHechas.has('sin-area')) partes.push(lista(hechas, { ubicacion: false }));
    return partes;
  }

  function vistaArea() {
    const a = d.area(idRuta);
    if (!a) return [vacio('Esta área no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/tareas/areas', class: 'boton' }, 'Ver áreas'))];
    const hermanas = d.areas.filter(x => !x.archivada);
    const opciones = () => menu(ctx, a.nombre, [
      { texto: 'Nuevo proyecto', accion: async () => { const n = await pedirNombre(ctx, 'Nuevo proyecto', '', 'Crear proyecto'); if (n) { await m.crearProyecto(a.id, n); ctx.aviso(`Proyecto "${n}" creado`); } } },
      { texto: 'Renombrar área', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar área', a.nombre); if (n) await m.renombrarArea(a.id, n); } },
      { texto: 'Subir en la lista', desactivado: hermanas[0]?.id === a.id, accion: () => m.mover('areas', a.id, -1, hermanas) },
      { texto: 'Bajar en la lista', desactivado: hermanas.at(-1)?.id === a.id, accion: () => m.mover('areas', a.id, 1, hermanas) },
      a.archivada
        ? { texto: 'Restaurar área', accion: () => m.archivarArea(a.id, false) }
        : { texto: 'Archivar área', peligro: true, accion: async () => { if (await ctx.confirmar(`¿Archivar "${a.nombre}"? Deja de verse en la lista, pero sus tareas con fecha siguen apareciendo en Hoy y Próximos. Podés restaurarla cuando quieras.`, { si: 'Archivar' })) { await m.archivarArea(a.id); ctx.navegar('tareas/areas'); } } },
    ]);
    const proys = d.proyectos.filter(p => p.areaId === a.id && !p.archivado);
    const proysArch = d.proyectos.filter(p => p.areaId === a.id && p.archivado);
    const sueltas = d.tareas.filter(t => t.areaId === a.id && !t.proyectoId);
    const pend = sueltas.filter(t => !hecha(t));
    const hechas = sueltas.filter(hecha);
    const clave = `area-${a.id}`;

    const partes = [
      h('a', { href: '#/tareas/areas', class: 'tr-miga' }, '← Áreas'),
      h('div', { class: 'tr-titulo-vista' }, h('h2', {}, a.nombre, a.archivada ? h('span', { class: 'tr-archivada' }, ' (archivada)') : null),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': `Opciones de ${a.nombre}`, onclick: opciones }, ic('puntos'))),
    ];
    if (proys.length) {
      partes.push(h('section', { class: 'tr-grupo' },
        h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, 'Proyectos')),
        h('div', { class: 'tr-areas' }, proys.map(p => h('a', { href: `#/tareas/proyecto/${p.id}`, class: 'tr-nav' },
          ic('lista'), h('span', { class: 'tr-nav-nombre' }, p.nombre),
          h('span', { class: 'tr-cuenta' }, String(pendientes().filter(t => t.proyectoId === p.id).length)), ic('flecha'))))));
    }
    partes.push(h('section', { class: 'tr-grupo' },
      h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, proys.length ? 'Tareas sueltas' : 'Tareas'), interruptorHechas(clave, hechas.length)),
      pend.length ? lista(pend, { ubicacion: false }) : h('p', { class: 'nota' }, proys.length ? 'Las tareas del área que no están en un proyecto aparecen acá.' : 'Sin tareas todavía. Tocá "Nueva tarea" o creá un proyecto desde el menú (···).'),
      mostrarHechas.has(clave) ? lista(hechas, { ubicacion: false }) : null));
    if (proysArch.length) {
      partes.push(h('details', { class: 'tr-hechas' }, h('summary', {}, `Proyectos archivados (${proysArch.length})`),
        h('ul', { class: 'tr-archivo' }, proysArch.map(p => h('li', {}, h('span', {}, p.nombre),
          h('button', { class: 'tr-link', onclick: () => m.archivarProyecto(p.id, false) }, 'Restaurar'))))));
    }
    return partes;
  }

  function vistaProyecto() {
    const p = d.proyecto(idRuta);
    if (!p) return [vacio('Este proyecto no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/tareas/areas', class: 'boton' }, 'Ver áreas'))];
    const a = d.area(p.areaId);
    const hermanos = d.proyectos.filter(x => x.areaId === p.areaId && !x.archivado);
    const secciones = d.secciones.filter(s => s.proyectoId === p.id);
    const tareas = d.tareas.filter(t => t.proyectoId === p.id);
    const clave = `proyecto-${p.id}`;
    const verHechas = mostrarHechas.has(clave);
    const visibles = verHechas ? tareas : tareas.filter(t => !hecha(t));

    const opciones = () => menu(ctx, p.nombre, [
      { texto: 'Nueva sección', accion: async () => { const n = await pedirNombre(ctx, 'Nueva sección', '', 'Crear sección'); if (n) await m.crearSeccion(p.id, n); } },
      { texto: 'Renombrar proyecto', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar proyecto', p.nombre); if (n) await m.renombrarProyecto(p.id, n); } },
      { texto: 'Subir en la lista', desactivado: hermanos[0]?.id === p.id, accion: () => m.mover('proyectos', p.id, -1, hermanos) },
      { texto: 'Bajar en la lista', desactivado: hermanos.at(-1)?.id === p.id, accion: () => m.mover('proyectos', p.id, 1, hermanos) },
      p.archivado
        ? { texto: 'Restaurar proyecto', accion: () => m.archivarProyecto(p.id, false) }
        : { texto: 'Archivar proyecto', peligro: true, accion: async () => { if (await ctx.confirmar(`¿Archivar "${p.nombre}"? Deja de verse en el área, pero sus tareas con fecha siguen en Hoy y Próximos.`, { si: 'Archivar' })) { await m.archivarProyecto(p.id); ctx.navegar(`tareas/area/${p.areaId}`); } } },
    ]);

    const opcionesSeccion = (s) => menu(ctx, s.nombre, [
      { texto: 'Renombrar sección', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar sección', s.nombre); if (n) await m.renombrarSeccion(s.id, n); } },
      { texto: 'Subir', desactivado: secciones[0]?.id === s.id, accion: () => m.mover('secciones', s.id, -1, secciones) },
      { texto: 'Bajar', desactivado: secciones.at(-1)?.id === s.id, accion: () => m.mover('secciones', s.id, 1, secciones) },
      { texto: 'Borrar sección', peligro: true, accion: async () => { if (await ctx.confirmar(`¿Borrar la sección "${s.nombre}"? Sus tareas no se borran: quedan en el proyecto sin sección.`, { si: 'Borrar sección', peligro: true })) await m.borrarSeccion(s.id); } },
    ]);

    const agregarEn = (seccionId) => h('button', { type: 'button', class: 'tr-agregar', onclick: () => abrirEditor(ctx, m, d, null, { areaId: p.areaId, proyectoId: p.id, seccionId }) }, icono('mas'), 'Agregar tarea');

    const sinSeccion = visibles.filter(t => !t.seccionId || !d.seccion(t.seccionId));
    const partes = [
      h('a', { href: a ? `#/tareas/area/${a.id}` : '#/tareas/areas', class: 'tr-miga' }, `← ${a?.nombre || 'Áreas'}`),
      h('div', { class: 'tr-titulo-vista' }, h('h2', {}, p.nombre, p.archivado ? h('span', { class: 'tr-archivada' }, ' (archivado)') : null),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': `Opciones de ${p.nombre}`, onclick: opciones }, ic('puntos'))),
      h('div', { class: 'tr-acciones-vista' }, interruptorHechas(clave, tareas.filter(hecha).length)),
    ];
    if (sinSeccion.length || !secciones.length) {
      partes.push(h('section', { class: 'tr-grupo' },
        secciones.length ? h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, 'Sin sección')) : null,
        sinSeccion.length ? lista(sinSeccion, { ubicacion: false }) : null,
        agregarEn('')));
    }
    for (const s of secciones) {
      const ts = visibles.filter(t => t.seccionId === s.id);
      partes.push(h('section', { class: 'tr-grupo tr-seccion' },
        h('div', { class: 'tr-grupo-cabecera' },
          h('h2', {}, s.nombre, h('span', { class: 'tr-grupo-n' }, String(ts.filter(t => !hecha(t)).length))),
          h('button', { type: 'button', class: 'boton-icono chico', 'aria-label': `Opciones de la sección ${s.nombre}`, onclick: () => opcionesSeccion(s) }, ic('puntos'))),
        ts.length ? lista(ts, { ubicacion: false }) : null,
        agregarEn(s.id)));
    }
    if (!secciones.length) partes.push(h('p', { class: 'nota' }, 'Podés dividir el proyecto en secciones desde el menú (···).'));
    return partes;
  }

  const zonaResultados = h('div', { class: 'tr-resultados' });
  function dibujarResultados() {
    const palabras = consulta.toLowerCase().split(/\s+/).filter(Boolean);
    if (!palabras.length) { zonaResultados.replaceChildren(h('p', { class: 'nota' }, 'Buscá por título, notas o etiqueta (por ejemplo #compras).')); return; }
    const coincide = (t) => palabras.every(p => p.startsWith('#')
      ? (t.etiquetas || []).some(e => e.toLowerCase().startsWith(p.slice(1)))
      : `${t.titulo} ${t.notas || ''} ${(t.etiquetas || []).join(' ')}`.toLowerCase().includes(p));
    const encontradas = d.tareas.filter(coincide);
    const pend = encontradas.filter(t => !hecha(t)), hechas = encontradas.filter(hecha);
    poner(zonaResultados,
      encontradas.length ? null : h('p', { class: 'nota' }, 'No hay tareas que coincidan.'),
      pend.length ? lista(pend) : null,
      hechas.length ? h('details', { class: 'tr-hechas' }, h('summary', {}, `Hechas (${hechas.length})`), lista(hechas)) : null);
  }
  function vistaBuscar() {
    const campo = h('input', { type: 'search', value: consulta, placeholder: 'Buscar tareas', 'aria-label': 'Buscar tareas', autocomplete: 'off',
      oninput: (e) => { consulta = e.target.value; dibujarResultados(); } });
    setTimeout(() => campo.focus(), 0);
    dibujarResultados();
    return [campo, zonaResultados];
  }

  // ── Dibujo ──

  const VISTAS = { hoy: vistaHoy, proximos: vistaProximos, vencidas: vistaVencidas, areas: vistaAreas, 'sin-area': vistaSinArea, area: vistaArea, proyecto: vistaProyecto, buscar: vistaBuscar };

  let primeraVez = true;
  function dibujar() {
    dibujarPestanas();
    if (vista === 'buscar' && !primeraVez) { dibujarResultados(); return; }
    primeraVez = false;
    poner(cuerpo, (VISTAS[vista] || vistaHoy)());
  }

  let espera = null;
  const quitar = ctx.alCambiarDatos(() => {
    clearTimeout(espera);
    espera = setTimeout(async () => { d = await m.cargar(); dibujar(); }, 60);
  });

  dibujar();
  return () => { quitar(); clearTimeout(espera); };
}
