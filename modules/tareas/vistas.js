// ─────────────────────────────────────────────────────────────
// Tareas: pantallas.
//
// Pantalla principal (#/tareas): Hoy (con las vencidas) o Próximos,
// y debajo, separado por una línea, el árbol de Áreas
// (Bandeja de entrada → áreas → proyectos → secciones).
//
// Rutas:
//   #/tareas  o  #/tareas/hoy      #/tareas/proximos
//   #/tareas/bandeja               #/tareas/area/<id>
//   #/tareas/proyecto/<id>         #/tareas/seccion/<id>
//   #/tareas/buscar                #/tareas/filtro/<id>
// ─────────────────────────────────────────────────────────────

import { crearModelo, hoy, hecha, vencida, deHoy, ordenar, ordenarManual, aplicarFiltro, textoFecha, textoRepeticion, textoDuracion } from './modelo.js';
import { abrirEditor, menu, pedirNombre, pedirFiltro, poner } from './editor.js';
import { hacerOrdenable } from './arrastre.js';

// Íconos propios del módulo.
const TRAZOS = {
  buscar: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  filtro: '<path d="M4 5.5h16l-6 7.5v5l-4 1.5v-6.5Z"/>',
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

const mostrarHechas = new Set();     // vistas donde se pidió ver las hechas
const subPlegadas = new Set();       // tareas con las subtareas plegadas

// ── Fila de una tarea (se usa también en el bloque de Inicio) ──

export function filaTarea(ctx, m, d, t, { ubicacion = true, ordenable = false } = {}) {
  const { h } = ctx;
  const subs = t.subtareas || [];
  const nComentarios = d.comentariosDe ? d.comentariosDe(t.id).length : 0;
  const plegada = subPlegadas.has(t.id);

  const meta = [];
  if (t.fecha) meta.push(h('span', { class: vencida(t) ? 'tr-meta vencida' : 'tr-meta' }, textoFecha(t.fecha), t.hora ? ` ${t.hora}` : ''));
  if (t.repeticion?.tipo) meta.push(h('span', { class: 'tr-meta' }, ic('repetir'), textoRepeticion(t.repeticion)));
  if (t.duracion) meta.push(h('span', { class: 'tr-meta' }, ic('reloj'), textoDuracion(t.duracion)));
  if (t.recordatorio) meta.push(h('span', { class: 'tr-meta', title: 'Recordatorio' }, ic('campana'), textoFecha(t.recordatorio.slice(0, 10)), ' ', t.recordatorio.slice(11, 16)));
  if (t.adjuntos?.length) meta.push(h('span', { class: 'tr-meta', title: 'Adjuntos' }, ic('clip'), String(t.adjuntos.length)));
  if (nComentarios) meta.push(h('span', { class: 'tr-meta', title: 'Comentarios' }, ic('comentario'), String(nComentarios)));
  if (ubicacion) {
    const partes = [d.area(t.areaId)?.nombre, d.proyecto(t.proyectoId)?.nombre].filter(Boolean);
    meta.push(h('span', { class: 'tr-meta tr-ubic' }, partes.length ? partes.join(' / ') : 'Bandeja'));
  }
  for (const e of t.etiquetas || []) meta.push(h('span', { class: 'tr-etiqueta' }, `#${e}`));

  const check = h('button', {
    type: 'button', class: `tr-check${hecha(t) ? ' hecha' : ''}`,
    'aria-label': hecha(t) ? `Reabrir "${t.titulo}"` : `Completar "${t.titulo}"`,
    onclick: async (e) => {
      e.currentTarget.disabled = true;
      if (hecha(t)) { await m.reabrir(t); return; }
      const prox = await m.completar(t);
      if (prox) ctx.aviso(`Hecha. Vuelve ${textoFecha(prox).toLowerCase()}.`);
      else ctx.aviso('Tarea hecha', { accion: 'Deshacer', alTocar: () => m.reabrir({ ...t, estado: 'hecha' }) });
    },
  }, h('span', { class: 'tr-check-marca' }));

  // Subtareas: desplegadas por defecto; con un toque se pliegan.
  let bloqueSub = null;
  if (subs.length) {
    const hechas = subs.filter(s => s.hecha).length;
    const lista = h('ul', { class: 'tr-sub-lista', hidden: plegada },
      subs.map(s => h('li', {},
        h('label', {},
          h('input', { type: 'checkbox', checked: !!s.hecha, onchange: () => m.alternarSubtarea(t, s.id) }),
          h('span', { class: s.hecha ? 'tr-sub-texto hecha' : 'tr-sub-texto' }, s.texto)))));
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
    bloqueSub = h('div', { class: 'tr-sub' }, alternar, lista);
  }

  return h('li', { class: `tr-tarea${hecha(t) ? ' hecha' : ''}${ordenable ? ' ordenable' : ''}`, 'data-id': t.id },
    ordenable ? h('button', { type: 'button', class: 'tr-asa', 'aria-label': `Mover "${t.titulo}" (arrastrá, o usá las flechas)` }, ic('asa')) : null,
    check,
    h('div', { class: 'tr-contenido' },
      h('button', { type: 'button', class: 'tr-cuerpo', onclick: () => abrirEditor(ctx, m, d, t) },
        h('span', { class: 'tr-titulo' }, t.titulo),
        meta.length ? h('span', { class: 'tr-metas' }, meta) : null),
      bloqueSub));
}

// ── Pantalla ──

export async function pantallaTareas(contenedor, ctx, sub = []) {
  cargarEstilos();
  const { h, icono } = ctx;
  const m = crearModelo(ctx);
  let vista = sub[0] || 'hoy';
  if (vista === 'vencidas') vista = 'hoy';
  if (vista === 'sin-area') vista = 'bandeja';
  const idRuta = sub[1] || '';
  let d = await m.cargar();
  let consulta = '';

  const cuerpo = h('div', { class: 'tr-cuerpo-vista' });
  const nueva = h('button', { type: 'button', class: 'tr-fab', 'aria-label': 'Nueva tarea', onclick: () => abrirEditor(ctx, m, d, null, valoresPorDefecto()) }, icono('mas'), h('span', {}, 'Nueva tarea'));

  contenedor.replaceChildren(
    h('header', { class: 'cabecera-pantalla tr-cabecera' },
      h('h1', {}, 'Tareas'),
      h('div', { class: 'tr-herramientas' },
        h('a', { href: '#/tareas/buscar', class: 'boton-icono', 'aria-label': 'Buscar tareas' }, ic('buscar')),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Filtros guardados', onclick: abrirFiltros }, ic('filtro')))),
    cuerpo, nueva);

  function valoresPorDefecto() {
    if (vista === 'hoy') return { fecha: hoy() };
    if (vista === 'area') return { areaId: idRuta };
    if (vista === 'proyecto') { const p = d.proyecto(idRuta); return { areaId: p?.areaId || '', proyectoId: idRuta }; }
    if (vista === 'seccion') { const s = d.seccion(idRuta); const p = d.proyecto(s?.proyectoId); return { areaId: p?.areaId || '', proyectoId: p?.id || '', seccionId: idRuta }; }
    return {};
  }

  const pendientes = () => d.tareas.filter(t => !hecha(t));
  const cuenta = (filtro) => pendientes().filter(filtro).length;
  // Lista común: ordenada por fecha. Con { manual: true } se ordena a mano y se puede arrastrar.
  function lista(tareas, opciones = {}) {
    if (!opciones.manual) return h('ul', { class: 'tr-lista' }, ordenar(tareas).map(t => filaTarea(ctx, m, d, t, opciones)));
    const ordenadas = ordenarManual(tareas);
    const ul = h('ul', { class: 'tr-lista' }, ordenadas.map(t => filaTarea(ctx, m, d, t, { ...opciones, ordenable: true })));
    hacerOrdenable(ul, (id, antes, despues) => {
      const buscar = (x) => (x ? d.tareas.find(t => t.id === x) : null);
      m.moverTarea(id, buscar(antes), buscar(despues));
    });
    return ul;
  }

  function grupo(titulo, tareas, { clase = '', opciones } = {}) {
    return h('section', { class: `tr-grupo ${clase}` },
      h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, titulo, h('span', { class: 'tr-grupo-n' }, String(tareas.length)))),
      tareas.length ? lista(tareas, opciones) : null);
  }

  const vacio = (titulo, texto, ...botones) => h('div', { class: 'vacio' }, h('h2', {}, titulo), texto ? h('p', {}, texto) : null, botones.length ? h('div', { class: 'botonera' }, botones) : null);
  const volver = (href, texto) => h('a', { href, class: 'tr-miga' }, `← ${texto}`);

  function interruptorHechas(clave, n) {
    if (!n) return null;
    const visible = mostrarHechas.has(clave);
    return h('button', { type: 'button', class: 'tr-link', onclick: () => { visible ? mostrarHechas.delete(clave) : mostrarHechas.add(clave); dibujar(); } },
      visible ? 'Ocultar hechas' : `Mostrar hechas (${n})`);
  }

  function tituloVista(texto, opciones, extra = null) {
    return h('div', { class: 'tr-titulo-vista' }, h('h2', {}, texto, extra),
      opciones ? h('button', { type: 'button', class: 'boton-icono', 'aria-label': `Opciones de ${texto}`, onclick: opciones }, ic('puntos')) : null);
  }

  // ── Filtros guardados (ícono arriba a la derecha) ──

  function abrirFiltros() {
    menu(ctx, 'Filtros guardados', [
      ...d.filtros.map(f => ({ texto: f.nombre, accion: () => ctx.navegar(`tareas/filtro/${f.id}`) })),
      { texto: '+ Nuevo filtro', accion: async () => {
        const f = await pedirFiltro(ctx, d);
        if (f) { const id = await m.crearFiltro(f); ctx.navegar(`tareas/filtro/${id}`); }
      } },
    ]);
  }

  // ── Principal: Hoy o Próximos + árbol de Áreas ──

  function principal(modo) {
    const nVenc = cuenta(vencida);
    const nHoy = cuenta(deHoy) + nVenc;
    const selector = h('div', { class: 'tr-selector', role: 'tablist' },
      h('a', { href: '#/tareas/hoy', role: 'tab', class: 'tr-sel', 'aria-selected': String(modo === 'hoy') },
        'Hoy', nHoy ? h('span', { class: nVenc ? 'tr-cuenta alerta' : 'tr-cuenta' }, String(nHoy)) : null),
      h('a', { href: '#/tareas/proximos', role: 'tab', class: 'tr-sel', 'aria-selected': String(modo === 'proximos') }, 'Próximos'));

    const contenido = [];
    if (modo === 'hoy') {
      const venc = pendientes().filter(vencida);
      const deHoyL = pendientes().filter(deHoy);
      const hechasHoy = d.tareas.filter(t => hecha(t) && t.completada && new Date(t.completada).toDateString() === new Date().toDateString());
      if (venc.length) contenido.push(grupo('Vencidas', venc, { clase: 'tr-grupo-vencidas' }));
      if (deHoyL.length) contenido.push(venc.length ? grupo('Hoy', deHoyL) : lista(deHoyL));
      if (!venc.length && !deHoyL.length) contenido.push(h('p', { class: 'nota tr-nada' }, 'Nada pendiente para hoy.'));
      if (hechasHoy.length) contenido.push(h('details', { class: 'tr-hechas' }, h('summary', {}, `Hechas hoy (${hechasHoy.length})`), lista(hechasHoy)));
    } else {
      const futuras = pendientes().filter(t => t.fecha && t.fecha > hoy());
      if (!futuras.length) contenido.push(h('p', { class: 'nota tr-nada' }, 'Sin tareas con fecha a partir de mañana.'));
      for (const f of [...new Set(futuras.map(t => t.fecha))].sort()) contenido.push(grupo(textoFecha(f), futuras.filter(t => t.fecha === f)));
    }

    return [selector, h('div', { class: 'tr-dia' }, contenido), h('hr', { class: 'tr-separador' }), ...arbolAreas()];
  }

  function arbolAreas() {
    const nodo = (href, icNombre, nombre, n, clase, extra = null) => h('a', { href, class: `tr-nodo ${clase}` },
      ic(icNombre), h('span', { class: 'tr-nodo-nombre' }, nombre, extra), n ? h('span', { class: 'tr-cuenta' }, String(n)) : null);

    const crear = async () => {
      const nombre = await pedirNombre(ctx, 'Nueva área', '', 'Crear área');
      if (nombre) { await m.crearArea(nombre); ctx.aviso(`Área "${nombre}" creada`); }
    };
    const activas = d.areas.filter(a => !a.archivada);
    const archivadas = d.areas.filter(a => a.archivada);

    const arbol = h('nav', { class: 'tr-arbol', 'aria-label': 'Áreas' },
      nodo('#/tareas/bandeja', 'bandeja', 'Bandeja de entrada', cuenta(t => !t.areaId), 'tr-nodo-area tr-nodo-bandeja', h('span', { class: 'tr-predeterminada' }, 'por defecto')),
      activas.map(a => [
        nodo(`#/tareas/area/${a.id}`, 'carpeta', a.nombre, cuenta(t => t.areaId === a.id), 'tr-nodo-area'),
        d.proyectos.filter(p => p.areaId === a.id && !p.archivado).map(p => [
          nodo(`#/tareas/proyecto/${p.id}`, 'proyecto', p.nombre, cuenta(t => t.proyectoId === p.id), 'tr-nodo-proyecto'),
          d.secciones.filter(s => s.proyectoId === p.id).map(s =>
            nodo(`#/tareas/seccion/${s.id}`, 'seccion', s.nombre, cuenta(t => t.seccionId === s.id), 'tr-nodo-seccion')),
        ]),
      ]));

    return [
      h('div', { class: 'tr-grupo-cabecera tr-areas-cabecera' },
        h('h2', {}, 'Áreas'),
        h('button', { type: 'button', class: 'boton-icono chico', 'aria-label': 'Nueva área', onclick: crear }, icono('mas'))),
      arbol,
      activas.length ? null : h('p', { class: 'nota' }, 'Creá tu primera área con el botón +. Un área es una parte permanente de tu vida, como el trabajo o la casa.'),
      archivadas.length ? h('details', { class: 'tr-hechas' }, h('summary', {}, `Áreas archivadas (${archivadas.length})`),
        h('ul', { class: 'tr-archivo' }, archivadas.map(a => h('li', {}, h('span', {}, a.nombre),
          h('button', { class: 'tr-link', onclick: () => m.archivarArea(a.id, false) }, 'Restaurar'))))) : null,
    ];
  }

  // ── Bandeja ──

  function vistaBandeja() {
    const todas = d.tareas.filter(t => !t.areaId);
    const pend = todas.filter(t => !hecha(t)), hechas = todas.filter(hecha);
    return [
      volver('#/tareas', 'Tareas'),
      tituloVista('Bandeja de entrada'),
      h('p', { class: 'nota' }, 'Lo que capturás desde Inicio llega acá. Abrí cada tarea y asignale un área cuando puedas.'),
      pend.length ? lista(pend, { ubicacion: false, manual: true }) : vacio('Bandeja vacía', null),
      interruptorHechas('bandeja', hechas.length),
      mostrarHechas.has('bandeja') ? lista(hechas, { ubicacion: false, manual: true }) : null,
    ];
  }

  // ── Área: tareas sueltas y un grupo por proyecto ──

  function vistaArea() {
    const a = d.area(idRuta);
    if (!a) return [vacio('Esta área no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/tareas', class: 'boton' }, 'Volver a Tareas'))];
    const hermanas = d.areas.filter(x => !x.archivada);
    const opciones = () => menu(ctx, a.nombre, [
      { texto: 'Nuevo proyecto', accion: async () => { const n = await pedirNombre(ctx, 'Nuevo proyecto', '', 'Crear proyecto'); if (n) { await m.crearProyecto(a.id, n); ctx.aviso(`Proyecto "${n}" creado`); } } },
      { texto: 'Renombrar área', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar área', a.nombre); if (n) await m.renombrarArea(a.id, n); } },
      { texto: 'Subir en la lista', desactivado: hermanas[0]?.id === a.id, accion: () => m.mover('areas', a.id, -1, hermanas) },
      { texto: 'Bajar en la lista', desactivado: hermanas.at(-1)?.id === a.id, accion: () => m.mover('areas', a.id, 1, hermanas) },
      a.archivada
        ? { texto: 'Restaurar área', accion: () => m.archivarArea(a.id, false) }
        : { texto: 'Archivar área', peligro: true, accion: async () => { if (await ctx.confirmar(`¿Archivar "${a.nombre}"? Deja de verse en la lista, pero sus tareas con fecha siguen apareciendo en Hoy y Próximos. Podés restaurarla cuando quieras.`, { si: 'Archivar' })) { await m.archivarArea(a.id); ctx.navegar('tareas'); } } },
    ]);
    const clave = `area-${a.id}`;
    const delArea = d.tareas.filter(t => t.areaId === a.id);
    const visibles = mostrarHechas.has(clave) ? delArea : delArea.filter(t => !hecha(t));
    const proys = d.proyectos.filter(p => p.areaId === a.id && !p.archivado);
    const proysArch = d.proyectos.filter(p => p.areaId === a.id && p.archivado);
    const sueltas = visibles.filter(t => !t.proyectoId || !d.proyecto(t.proyectoId) || d.proyecto(t.proyectoId).archivado);

    const partes = [
      volver('#/tareas', 'Tareas'),
      tituloVista(a.nombre, opciones, a.archivada ? h('span', { class: 'tr-archivada' }, ' (archivada)') : null),
      h('div', { class: 'tr-acciones-vista' }, interruptorHechas(clave, delArea.filter(hecha).length)),
    ];
    if (sueltas.length || !proys.length) {
      partes.push(h('section', { class: 'tr-grupo' },
        proys.length ? h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, 'Sin proyecto')) : null,
        sueltas.length ? lista(sueltas, { ubicacion: false, manual: true }) : h('p', { class: 'nota' }, 'Sin tareas todavía. Tocá "Nueva tarea", o creá un proyecto desde el menú (···).')));
    }
    for (const p of proys) {
      const ts = visibles.filter(t => t.proyectoId === p.id);
      partes.push(h('section', { class: 'tr-grupo tr-seccion' },
        h('div', { class: 'tr-grupo-cabecera' },
          h('a', { href: `#/tareas/proyecto/${p.id}`, class: 'tr-grupo-link' }, h('h2', {}, p.nombre, h('span', { class: 'tr-grupo-n' }, String(ts.filter(t => !hecha(t)).length))), ic('flecha'))),
        ts.length ? lista(ts, { ubicacion: false, manual: true }) : h('p', { class: 'nota' }, 'Sin tareas pendientes.')));
    }
    if (proysArch.length) {
      partes.push(h('details', { class: 'tr-hechas' }, h('summary', {}, `Proyectos archivados (${proysArch.length})`),
        h('ul', { class: 'tr-archivo' }, proysArch.map(p => h('li', {}, h('span', {}, p.nombre),
          h('button', { class: 'tr-link', onclick: () => m.archivarProyecto(p.id, false) }, 'Restaurar'))))));
    }
    return partes;
  }

  // ── Proyecto: un grupo por sección ──

  const opcionesSeccion = (s, secciones) => menu(ctx, s.nombre, [
    { texto: 'Renombrar sección', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar sección', s.nombre); if (n) await m.renombrarSeccion(s.id, n); } },
    { texto: 'Subir', desactivado: secciones[0]?.id === s.id, accion: () => m.mover('secciones', s.id, -1, secciones) },
    { texto: 'Bajar', desactivado: secciones.at(-1)?.id === s.id, accion: () => m.mover('secciones', s.id, 1, secciones) },
    { texto: 'Borrar sección', peligro: true, accion: async () => {
      if (await ctx.confirmar(`¿Borrar la sección "${s.nombre}"? Sus tareas no se borran: quedan en el proyecto sin sección.`, { si: 'Borrar sección', peligro: true })) {
        await m.borrarSeccion(s.id);
        if (vista === 'seccion') ctx.navegar(`tareas/proyecto/${s.proyectoId}`);
      }
    } },
  ]);

  const agregarEn = (base) => h('button', { type: 'button', class: 'tr-agregar', onclick: () => abrirEditor(ctx, m, d, null, base) }, icono('mas'), 'Agregar tarea');

  function vistaProyecto() {
    const p = d.proyecto(idRuta);
    if (!p) return [vacio('Este proyecto no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/tareas', class: 'boton' }, 'Volver a Tareas'))];
    const a = d.area(p.areaId);
    const hermanos = d.proyectos.filter(x => x.areaId === p.areaId && !x.archivado);
    const secciones = d.secciones.filter(s => s.proyectoId === p.id);
    const tareas = d.tareas.filter(t => t.proyectoId === p.id);
    const clave = `proyecto-${p.id}`;
    const visibles = mostrarHechas.has(clave) ? tareas : tareas.filter(t => !hecha(t));

    const opciones = () => menu(ctx, p.nombre, [
      { texto: 'Nueva sección', accion: async () => { const n = await pedirNombre(ctx, 'Nueva sección', '', 'Crear sección'); if (n) await m.crearSeccion(p.id, n); } },
      { texto: 'Renombrar proyecto', accion: async () => { const n = await pedirNombre(ctx, 'Renombrar proyecto', p.nombre); if (n) await m.renombrarProyecto(p.id, n); } },
      { texto: 'Subir en la lista', desactivado: hermanos[0]?.id === p.id, accion: () => m.mover('proyectos', p.id, -1, hermanos) },
      { texto: 'Bajar en la lista', desactivado: hermanos.at(-1)?.id === p.id, accion: () => m.mover('proyectos', p.id, 1, hermanos) },
      p.archivado
        ? { texto: 'Restaurar proyecto', accion: () => m.archivarProyecto(p.id, false) }
        : { texto: 'Archivar proyecto', peligro: true, accion: async () => { if (await ctx.confirmar(`¿Archivar "${p.nombre}"? Deja de verse en el área, pero sus tareas con fecha siguen en Hoy y Próximos.`, { si: 'Archivar' })) { await m.archivarProyecto(p.id); ctx.navegar(`tareas/area/${p.areaId}`); } } },
    ]);

    const base = { areaId: p.areaId, proyectoId: p.id };
    const sinSeccion = visibles.filter(t => !t.seccionId || !d.seccion(t.seccionId));
    const partes = [
      volver(a ? `#/tareas/area/${a.id}` : '#/tareas', a?.nombre || 'Tareas'),
      tituloVista(p.nombre, opciones, p.archivado ? h('span', { class: 'tr-archivada' }, ' (archivado)') : null),
      h('div', { class: 'tr-acciones-vista' }, interruptorHechas(clave, tareas.filter(hecha).length)),
    ];
    if (sinSeccion.length || !secciones.length) {
      partes.push(h('section', { class: 'tr-grupo' },
        secciones.length ? h('div', { class: 'tr-grupo-cabecera' }, h('h2', {}, 'Sin sección')) : null,
        sinSeccion.length ? lista(sinSeccion, { ubicacion: false, manual: true }) : null,
        agregarEn({ ...base, seccionId: '' })));
    }
    for (const s of secciones) {
      const ts = visibles.filter(t => t.seccionId === s.id);
      partes.push(h('section', { class: 'tr-grupo tr-seccion' },
        h('div', { class: 'tr-grupo-cabecera' },
          h('a', { href: `#/tareas/seccion/${s.id}`, class: 'tr-grupo-link' }, h('h2', {}, s.nombre, h('span', { class: 'tr-grupo-n' }, String(ts.filter(t => !hecha(t)).length)))),
          h('button', { type: 'button', class: 'boton-icono chico', 'aria-label': `Opciones de la sección ${s.nombre}`, onclick: () => opcionesSeccion(s, secciones) }, ic('puntos'))),
        ts.length ? lista(ts, { ubicacion: false, manual: true }) : null,
        agregarEn({ ...base, seccionId: s.id })));
    }
    if (!secciones.length) partes.push(h('p', { class: 'nota' }, 'Podés dividir el proyecto en secciones desde el menú (···).'));
    return partes;
  }

  // ── Sección ──

  function vistaSeccion() {
    const s = d.seccion(idRuta);
    const p = s && d.proyecto(s.proyectoId);
    if (!s || !p) return [vacio('Esta sección no existe', 'Puede que se haya borrado en otro dispositivo.', h('a', { href: '#/tareas', class: 'boton' }, 'Volver a Tareas'))];
    const secciones = d.secciones.filter(x => x.proyectoId === p.id);
    const tareas = d.tareas.filter(t => t.seccionId === s.id);
    const clave = `seccion-${s.id}`;
    const visibles = mostrarHechas.has(clave) ? tareas : tareas.filter(t => !hecha(t));
    return [
      volver(`#/tareas/proyecto/${p.id}`, p.nombre),
      tituloVista(s.nombre, () => opcionesSeccion(s, secciones)),
      h('div', { class: 'tr-acciones-vista' }, interruptorHechas(clave, tareas.filter(hecha).length)),
      visibles.length ? lista(visibles, { ubicacion: false, manual: true }) : h('p', { class: 'nota' }, 'Sin tareas pendientes en esta sección.'),
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
      tituloVista(f.nombre, opciones),
      resultado.length ? null : h('p', { class: 'nota' }, 'Ninguna tarea cumple este filtro por ahora.'),
      pend.length ? lista(pend) : null,
      hechas.length ? h('details', { class: 'tr-hechas' }, h('summary', {}, `Hechas (${hechas.length})`), lista(hechas)) : null,
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
      hechas.length ? h('details', { class: 'tr-hechas' }, h('summary', {}, `Hechas (${hechas.length})`), lista(hechas)) : null);
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
    hoy: () => principal('hoy'), proximos: () => principal('proximos'),
    bandeja: vistaBandeja, area: vistaArea, proyecto: vistaProyecto, seccion: vistaSeccion,
    filtro: vistaFiltro, buscar: vistaBuscar,
  };

  let primeraVez = true;
  function dibujar() {
    if (vista === 'buscar' && !primeraVez) { dibujarResultados(); return; }
    primeraVez = false;
    poner(cuerpo, (VISTAS[vista] || VISTAS.hoy)());
  }

  let espera = null;
  const quitar = ctx.alCambiarDatos(() => {
    clearTimeout(espera);
    espera = setTimeout(async () => { d = await m.cargar(); dibujar(); }, 60);
  });

  dibujar();
  return () => { quitar(); clearTimeout(espera); };
}
