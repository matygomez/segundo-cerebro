// ─────────────────────────────────────────────────────────────
// Bitácora: bases de datos.
//   Una carpeta con base=true tiene campos (columnas) y vistas
//   guardadas (tabla o tarjetas, con filtros, orden, agrupar y totales).
//   Acá están también los controles para cargar cada tipo de campo,
//   que usan la ficha de la nota y las notas rápidas.
// ─────────────────────────────────────────────────────────────

import {
  TIPOS, tipo, NUMERICOS, COLORES_OPCION, valorCampo, textoValor, vacioV, aplicarVista, operadoresDe, necesitaValor,
  totalesDe, totalPorDefecto, calcularTotal, nuevoIdCorto, comparar, fechaCorta,
} from './modelo.js';
import { simboloTipo, ic, ventana, menu, pedirTexto, tiposOcultos, vacio, cabecera, marcaCarpeta, poner } from './vistas.js';

const colorClase = (c) => `bt-op c-${COLORES_OPCION.includes(c) ? c : 'gris'}`;

// ── Mostrar un valor (tabla, tarjetas) ──
export function mostrarValor(ctx, campo, v, d) {
  const { h } = ctx;
  if (campo.tipo === 'sino') return h('span', { class: v ? 'bt-si' : 'bt-no' }, v ? '✓' : '✗');
  if (vacioV(v) && campo.tipo !== 'auto') return h('span', { class: 'bt-vacio' }, '—');
  switch (campo.tipo) {
    case 'opcion': { const o = (campo.opciones || []).find(x => x.id === v); return o ? h('span', { class: colorClase(o.color) }, o.nombre) : h('span', { class: 'bt-vacio' }, '—'); }
    case 'opciones': return h('span', { class: 'bt-ops' }, (v || []).map(id => (campo.opciones || []).find(x => x.id === id)).filter(Boolean).map(o => h('span', { class: colorClase(o.color) }, o.nombre)));
    case 'relacion': { const n = d.nota(v); return n ? h('a', { href: `#/bitacora/n/${n.id}`, class: 'bt-wl', onclick: (e) => e.stopPropagation() }, n.titulo) : h('span', { class: 'bt-vacio' }, '—'); }
    case 'link': return h('a', { href: /^https?:/i.test(v) ? v : `https://${v}`, target: '_blank', rel: 'noopener', class: 'bt-link', onclick: (e) => e.stopPropagation() }, String(v).replace(/^https?:\/\/(www\.)?/, '').slice(0, 40));
    case 'mail': return h('a', { href: `mailto:${v}`, class: 'bt-link', onclick: (e) => e.stopPropagation() }, v);
    case 'telefono': return h('a', { href: `tel:${String(v).replace(/[^\d+]/g, '')}`, class: 'bt-link', onclick: (e) => e.stopPropagation() }, v);
    case 'archivo': return v?.url ? h('a', { href: v.url, target: '_blank', rel: 'noopener', class: 'bt-link', onclick: (e) => e.stopPropagation() }, ic('clip'), v.nombre) : h('span', {}, ic('clip'), v?.nombre || '');
    case 'calificacion': return h('span', { class: 'bt-estrellas' }, '★'.repeat(Number(v) || 0), h('span', { class: 'bt-estrellas-off' }, '★'.repeat(5 - (Number(v) || 0))));
    case 'progreso': return h('span', { class: 'bt-prog' }, h('span', { class: 'bt-prog-barra' }, h('span', { style: `width:${Math.max(0, Math.min(100, Number(v) || 0))}%` })), `${Number(v) || 0}%`);
    case 'numero': return h('span', { class: 'bt-num' }, textoValor(campo, v, d));
    default: return h('span', {}, textoValor(campo, v, d));
  }
}

// ── Control para cargar un valor. alCambiar(v) se llama con cada cambio. ──
export function controlCampo(ctx, m, d, campo, valor, alCambiar) {
  const { h } = ctx;
  switch (campo.tipo) {
    case 'numero': {
      const i = h('input', { type: 'text', inputmode: 'decimal', value: vacioV(valor) ? '' : String(valor).replace('.', ','), 'aria-label': campo.nombre });
      i.addEventListener('change', () => { const t = i.value.trim().replace(/\./g, '').replace(',', '.'); alCambiar(t === '' || !Number.isFinite(Number(t)) ? null : Number(t)); });
      return i;
    }
    case 'fecha': { const i = h('input', { type: 'date', value: valor || '', 'aria-label': campo.nombre }); i.addEventListener('change', () => alCambiar(i.value)); return i; }
    case 'sino': { const i = h('input', { type: 'checkbox', checked: !!valor, 'aria-label': campo.nombre }); i.addEventListener('change', () => alCambiar(i.checked)); return h('label', { class: 'bt-sino' }, i, h('span', {}, 'Sí')); }
    case 'opcion': {
      const s = h('select', { 'aria-label': campo.nombre }, h('option', { value: '' }, '—'), (campo.opciones || []).map(o => h('option', { value: o.id, selected: o.id === valor }, o.nombre)), h('option', { value: '@nueva' }, '+ Nueva opción…'));
      s.addEventListener('change', async () => {
        if (s.value !== '@nueva') { alCambiar(s.value); return; }
        const id = await nuevaOpcion(ctx, m, d, campo);
        if (id) { s.insertBefore(h('option', { value: id }, campo.opciones.find(o => o.id === id).nombre), s.lastElementChild); s.value = id; alCambiar(id); } else s.value = valor || '';
      });
      return s;
    }
    case 'opciones': {
      let sel = new Set(Array.isArray(valor) ? valor : []);
      const caja = h('div', { class: 'bt-chips' });
      const pintar = () => poner(caja, ...(campo.opciones || []).map(o => h('button', { type: 'button', class: `${colorClase(o.color)} bt-chip-op${sel.has(o.id) ? ' sel' : ''}`, 'aria-pressed': String(sel.has(o.id)), onclick: () => { if (sel.has(o.id)) sel.delete(o.id); else sel.add(o.id); pintar(); alCambiar([...sel]); } }, o.nombre)),
        h('button', { type: 'button', class: 'bt-chip-mas', onclick: async () => { const id = await nuevaOpcion(ctx, m, d, campo); if (id) { sel.add(id); pintar(); alCambiar([...sel]); } } }, '+'));
      pintar();
      return caja;
    }
    case 'relacion': {
      const lista = d.notas.filter(n => !campo.carpetaRel || n.carpetaId === campo.carpetaRel).sort((a, b) => comparar(a.titulo, b.titulo));
      const s = h('select', { 'aria-label': campo.nombre }, h('option', { value: '' }, '—'), lista.map(n => h('option', { value: n.id, selected: n.id === valor }, n.titulo)));
      s.addEventListener('change', () => alCambiar(s.value));
      return s;
    }
    case 'calificacion': {
      let v = Number(valor) || 0;
      const caja = h('div', { class: 'bt-estrellas-ctrl', role: 'radiogroup', 'aria-label': campo.nombre });
      const pintar = () => poner(caja, ...[1, 2, 3, 4, 5].map(k => h('button', { type: 'button', class: k <= v ? 'on' : '', 'aria-label': `${k} de 5`, onclick: () => { v = v === k ? 0 : k; pintar(); alCambiar(v || null); } }, '★')));
      pintar();
      return caja;
    }
    case 'progreso': {
      const r = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Number(valor) || 0), 'aria-label': campo.nombre });
      const t = h('span', { class: 'bt-prog-num' }, `${Number(valor) || 0}%`);
      r.addEventListener('input', () => { t.textContent = `${r.value}%`; });
      r.addEventListener('change', () => alCambiar(Number(r.value)));
      return h('div', { class: 'bt-prog-ctrl' }, r, t);
    }
    case 'archivo': {
      let v = valor || null;
      const caja = h('div', { class: 'bt-archivo-ctrl' });
      const elegir = h('input', { type: 'file', hidden: true });
      elegir.addEventListener('change', async () => {
        const f = elegir.files[0]; elegir.value = '';
        if (!f) return;
        try { v = { ...(await ctx.archivos.subir(f)), nombre: f.name }; pintar(); alCambiar(v); } catch (e) { ctx.aviso(e.message); }
      });
      const pintar = () => poner(caja, 
        v ? mostrarValor(ctx, campo, v, d) : h('span', { class: 'bt-vacio' }, 'Sin archivo'),
        h('button', { type: 'button', class: 'boton bt-chico', onclick: () => elegir.click() }, ic('clip'), v ? 'Cambiar' : 'Subir'),
        ctx.archivos.selectorDisponible() ? h('button', { type: 'button', class: 'boton bt-chico', onclick: async () => { try { const [a] = await ctx.archivos.elegirDeDrive(); if (a) { v = a; pintar(); alCambiar(v); } } catch (e) { ctx.aviso(e.message); } } }, ic('drive'), 'Drive') : null,
        v ? h('button', { type: 'button', class: 'boton-icono bt-chico', 'aria-label': 'Quitar archivo', onclick: () => { v = null; pintar(); alCambiar(null); } }, ctx.icono('cerrar')) : null,
        elegir);
      pintar();
      return caja;
    }
    case 'auto': return h('span', { class: 'bt-auto' }, valor ? new Date(valor).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
    case 'telefono': case 'mail': case 'link': {
      const i = h('input', { type: campo.tipo === 'telefono' ? 'tel' : campo.tipo === 'mail' ? 'email' : 'url', value: valor || '', inputmode: campo.tipo === 'telefono' ? 'tel' : null, 'aria-label': campo.nombre, placeholder: campo.tipo === 'link' ? 'https://' : '' });
      const acciones = h('span', { class: 'bt-ctrl-acc' });
      const pintarAcc = () => {
        const x = i.value.trim();
        if (!x) { poner(acciones, ); return; }
        if (campo.tipo === 'telefono') {
          const num = x.replace(/[^\d+]/g, '');
          poner(acciones, h('a', { href: `tel:${num}`, class: 'boton bt-chico', title: 'Llamar', 'aria-label': 'Llamar' }, ic('telefono')), h('a', { href: `https://wa.me/${num.replace(/^\+/, '')}`, target: '_blank', rel: 'noopener', class: 'boton bt-chico', title: 'WhatsApp' }, 'WhatsApp'));
        } else if (campo.tipo === 'mail') poner(acciones, h('a', { href: `mailto:${x}`, class: 'boton bt-chico', 'aria-label': 'Escribir mail' }, ic('mail')));
        else poner(acciones, h('a', { href: /^https?:/i.test(x) ? x : `https://${x}`, target: '_blank', rel: 'noopener', class: 'boton bt-chico' }, 'Abrir'));
      };
      i.addEventListener('change', () => { pintarAcc(); alCambiar(i.value.trim()); });
      pintarAcc();
      return h('div', { class: 'bt-ctrl-con-acc' }, i, acciones);
    }
    default: { const i = h('input', { type: 'text', value: valor || '', 'aria-label': campo.nombre }); i.addEventListener('change', () => alCambiar(i.value)); return i; }
  }
}

async function nuevaOpcion(ctx, m, d, campo) {
  const nombre = await pedirTexto(ctx, `Nueva opción en "${campo.nombre}"`);
  if (!nombre) return null;
  const c = d.carpetas.find(x => (x.campos || []).some(f => f.id === campo.id));
  if (!c) return null;
  const op = { id: nuevoIdCorto(), nombre, color: COLORES_OPCION[(campo.opciones || []).length % COLORES_OPCION.length] };
  campo.opciones = [...(campo.opciones || []), op];
  await m.guardarCarpeta(c.id, { campos: c.campos.map(f => (f.id === campo.id ? { ...f, opciones: campo.opciones } : f)) });
  return op.id;
}

// ── Vistas guardadas ──
const VISTA_INICIAL = { nombre: 'Todos', forma: 'tabla', filtros: [], orden: { campo: '_editada', dir: 'desc' }, agrupar: '', totales: true, tot: {} };
const activas = new Map();   // carpeta → id de vista (mientras la app está abierta)
export function vistasDe(c) { return (c.vistas || []).length ? c.vistas : [{ id: 'todos', ...VISTA_INICIAL }]; }

export function renderBase(ctx, m, d, c, zona) {
  const { h } = ctx;
  const vistas = vistasDe(c);
  let vista = vistas.find(v => v.id === activas.get(c.id)) || vistas[0];
  const guardarVista = async (cambios) => {
    const nueva = { ...vista, ...cambios };
    const lista = (c.vistas || []).length ? c.vistas.map(v => (v.id === vista.id ? nueva : v)) : [nueva];
    await m.guardarCarpeta(c.id, { vistas: lista });
  };
  const campos = (c.campos || []);
  const visibles = campos.filter(f => f.visible !== false);
  const notas = d.notasDe(c.id);
  const grupos = aplicarVista(notas, vista, c, d);
  const total = grupos.reduce((s, g) => s + g.notas.length, 0);

  // Pestañas de vistas
  const tabs = h('div', { class: 'bt-vistas', role: 'tablist' },
    vistas.map(v => h('button', {
      type: 'button', role: 'tab', class: `bt-vista${v.id === vista.id ? ' sel' : ''}`, 'aria-selected': String(v.id === vista.id),
      onclick: () => { if (v.id === vista.id) menuVista(); else { activas.set(c.id, v.id); renderBase(ctx, m, d, c, zona); } },
    }, v.nombre, v.id === vista.id ? h('span', { class: 'bt-vista-fl' }, '▾') : null)),
    h('button', { type: 'button', class: 'bt-vista bt-vista-mas', onclick: async () => {
      const nombre = await pedirTexto(ctx, 'Nueva vista', `Vista ${vistas.length + 1}`);
      if (!nombre) return;
      const id = nuevoIdCorto();
      const base = (c.vistas || []).length ? c.vistas : [{ ...vista, id: nuevoIdCorto() }];
      activas.set(c.id, id);
      await m.guardarCarpeta(c.id, { vistas: [...base, { ...VISTA_INICIAL, forma: vista.forma, id, nombre }] });
    } }, '+ vista'));

  function menuVista() {
    menu(ctx, `Vista "${vista.nombre}"`, [
      { icono: 'editar', texto: 'Renombrar', accion: async () => { const n = await pedirTexto(ctx, 'Renombrar vista', vista.nombre); if (n) await guardarVista({ nombre: n }); } },
      { icono: 'tarjetas', texto: 'Duplicar', accion: async () => { const id = nuevoIdCorto(); activas.set(c.id, id); const base = (c.vistas || []).length ? c.vistas : [vista]; await m.guardarCarpeta(c.id, { vistas: [...base, { ...vista, id, nombre: `${vista.nombre} (copia)` }] }); } },
      vistas.length > 1 ? { icono: 'papelera', texto: 'Borrar vista', peligro: true, accion: async () => { if (await ctx.confirmar(`¿Borrar la vista "${vista.nombre}"? Las notas no se tocan.`, { si: 'Borrar', peligro: true })) { activas.delete(c.id); await m.guardarCarpeta(c.id, { vistas: c.vistas.filter(v => v.id !== vista.id) }); } } } : null,
    ]);
  }

  // Herramientas
  const nombreCampo = (id) => ({ _titulo: 'Nombre', _editada: 'Editada', _creada: 'Creada' }[id] || campos.find(f => f.id === id)?.nombre || '—');
  const chipsFiltro = (vista.filtros || []).map((f, i) => {
    const campo = campos.find(x => x.id === f.campo);
    if (!campo) return null;
    const op = operadoresDe(campo.tipo).find(o => o[0] === f.op)?.[1] || f.op;
    let val = '';
    if (necesitaValor(f.op)) val = campo.tipo === 'opcion' || campo.tipo === 'opciones' ? (campo.opciones || []).find(o => o.id === f.valor)?.nombre || '' : campo.tipo === 'relacion' ? d.nota(f.valor)?.titulo || '' : campo.tipo === 'fecha' ? fechaCorta(f.valor) : f.valor;
    return h('button', { type: 'button', class: 'bt-chipf on', onclick: () => editarFiltro(i) }, `${campo.nombre} ${op} ${val}`.trim(), h('span', { class: 'bt-chipf-x', role: 'button', 'aria-label': 'Quitar filtro', onclick: (e) => { e.stopPropagation(); guardarVista({ filtros: vista.filtros.filter((_, k) => k !== i) }); } }, '✕'));
  }).filter(Boolean);

  const herramientas = h('div', { class: 'bt-herr' },
    h('div', { class: 'bt-seg' },
      h('button', { type: 'button', class: vista.forma !== 'tarjetas' ? 'sel' : '', onclick: () => guardarVista({ forma: 'tabla' }) }, ic('tabla'), 'Tabla'),
      h('button', { type: 'button', class: vista.forma === 'tarjetas' ? 'sel' : '', onclick: () => guardarVista({ forma: 'tarjetas' }) }, ic('tarjetas'), 'Tarjetas')),
    h('span', { class: 'bt-espacio' }),
    ...chipsFiltro,
    h('button', { type: 'button', class: 'bt-chipf', onclick: () => editarFiltro(-1) }, ic('filtro'), 'Filtro'),
    h('button', { type: 'button', class: 'bt-chipf', onclick: editarOrden }, ic('orden'), `${nombreCampo(vista.orden?.campo || '_editada')} ${vista.orden?.dir === 'asc' ? '↑' : '↓'}`),
    h('button', { type: 'button', class: `bt-chipf${vista.agrupar ? ' on' : ''}`, onclick: editarAgrupar }, ic('grupo'), vista.agrupar ? `Agrupar: ${nombreCampo(vista.agrupar)}` : 'Agrupar'),
    h('button', { type: 'button', class: `bt-chipf${vista.totales ? ' on' : ''}`, onclick: () => guardarVista({ totales: !vista.totales }) }, ic('suma'), vista.totales ? 'Totales: sí' : 'Totales: no'));

  function editarFiltro(i) {
    const f = i >= 0 ? vista.filtros[i] : { campo: campos.find(x => x.tipo !== 'auto')?.id || campos[0]?.id, op: '', valor: '' };
    if (!campos.length) { ctx.aviso('Primero agregá campos a la base.'); return; }
    const sCampo = h('select', { 'aria-label': 'Campo' }, campos.map(x => h('option', { value: x.id, selected: x.id === f.campo }, x.nombre)));
    const sOp = h('select', { 'aria-label': 'Condición' });
    const zonaValor = h('div', {});
    let valor = f.valor;
    const pintar = () => {
      const campo = campos.find(x => x.id === sCampo.value);
      const ops = operadoresDe(campo.tipo);
      const opActual = ops.some(o => o[0] === sOp.value) ? sOp.value : (ops.some(o => o[0] === f.op) ? f.op : ops[0][0]);
      poner(sOp, ...ops.map(o => h('option', { value: o[0], selected: o[0] === opActual }, o[1])));
      sOp.value = opActual;
      if (!necesitaValor(opActual)) { poner(zonaValor, ); return; }
      if (campo.tipo === 'opcion' || campo.tipo === 'opciones') {
        const s = h('select', {}, (campo.opciones || []).map(o => h('option', { value: o.id, selected: o.id === valor }, o.nombre)));
        valor = s.value; s.addEventListener('change', () => { valor = s.value; });
        poner(zonaValor, s);
      } else if (campo.tipo === 'relacion') {
        const s = h('select', {}, d.notas.filter(n => !campo.carpetaRel || n.carpetaId === campo.carpetaRel).map(n => h('option', { value: n.id, selected: n.id === valor }, n.titulo)));
        valor = s.value; s.addEventListener('change', () => { valor = s.value; });
        poner(zonaValor, s);
      } else {
        const tipoInput = campo.tipo === 'fecha' || campo.tipo === 'auto' ? 'date' : 'text';
        const inp = h('input', { type: tipoInput, value: valor || '', inputmode: NUMERICOS.includes(campo.tipo) ? 'decimal' : null });
        inp.addEventListener('input', () => { valor = inp.value; });
        poner(zonaValor, inp);
      }
    };
    sCampo.addEventListener('change', () => { valor = ''; sOp.value = ''; pintar(); });
    sOp.addEventListener('change', pintar);
    pintar();
    const dlg = ventana(ctx, i >= 0 ? 'Editar filtro' : 'Nuevo filtro', h('div', { class: 'formulario-campos' }, sCampo, sOp, zonaValor), {
      botones: [
        i >= 0 ? h('button', { type: 'button', class: 'boton peligro', onclick: () => { guardarVista({ filtros: vista.filtros.filter((_, k) => k !== i) }); dlg.close(); } }, 'Quitar') : null,
        h('span', { class: 'bt-espacio' }),
        h('button', { type: 'button', class: 'boton principal', onclick: () => {
          const nuevo = { campo: sCampo.value, op: sOp.value, valor: necesitaValor(sOp.value) ? valor : '' };
          const filtros = [...(vista.filtros || [])];
          if (i >= 0) filtros[i] = nuevo; else filtros.push(nuevo);
          guardarVista({ filtros });
          dlg.close();
        } }, 'Aplicar')],
    });
  }

  function editarOrden() {
    const ops = [['_editada', 'Editada'], ['_creada', 'Creada'], ['_titulo', 'Nombre'], ...campos.filter(f => !['opciones', 'archivo'].includes(f.tipo)).map(f => [f.id, f.nombre])];
    menu(ctx, 'Ordenar por', ops.flatMap(([id, nom]) => [
      { texto: `${nom} ↑`, nota: id === '_titulo' || !['_editada', '_creada'].includes(id) ? 'A → Z / menor a mayor' : 'más viejas primero', accion: () => guardarVista({ orden: { campo: id, dir: 'asc' } }) },
      { texto: `${nom} ↓`, nota: id === '_titulo' || !['_editada', '_creada'].includes(id) ? 'Z → A / mayor a menor' : 'más nuevas primero', accion: () => guardarVista({ orden: { campo: id, dir: 'desc' } }) },
    ]));
  }

  function editarAgrupar() {
    menu(ctx, 'Agrupar por', [
      { texto: 'Sin agrupar', accion: () => guardarVista({ agrupar: '' }) },
      ...campos.filter(f => ['opcion', 'opciones', 'sino', 'fecha', 'relacion', 'texto'].includes(f.tipo)).map(f => ({ texto: f.nombre, nota: tipo(f.tipo).nombre, accion: () => guardarVista({ agrupar: f.id }) })),
    ]);
  }

  // Cuerpo
  let cuerpo;
  if (!campos.length) {
    cuerpo = vacio(ctx, 'Esta base todavía no tiene campos', 'Agregá las columnas que quieras (texto, número, fecha, opciones…).', h('a', { href: `#/bitacora/c/${c.id}/campos`, class: 'boton principal' }, 'Agregar campos'));
  } else if (!notas.length) {
    cuerpo = vacio(ctx, 'Todavía no hay nada cargado', 'Tocá "+ Nueva" para cargar el primero.');
  } else if (vista.forma === 'tarjetas') {
    cuerpo = h('div', { class: 'bt-tarjetas-zona' }, grupos.map(g => [
      g.titulo ? h('div', { class: 'bt-grupo-tit' }, g.titulo, h('small', {}, String(g.notas.length))) : null,
      h('div', { class: 'bt-tarjetas' }, g.notas.map(n => h('a', { href: `#/bitacora/n/${n.id}`, class: 'bt-tarj' },
        h('b', {}, n.titulo),
        visibles.map(f => { const v = valorCampo(n, f); if (vacioV(v) && f.tipo !== 'sino') return null; return h('div', { class: 'bt-kv' }, h('span', {}, f.nombre), mostrarValor(ctx, f, v, d)); })))),
    ]),
    vista.totales ? h('p', { class: 'nota bt-tot-tarj' }, [`${total} en total`, ...visibles.map(f => { const t = calcularTotal(grupos.flatMap(g => g.notas), f, vista.tot?.[f.id] ?? totalPorDefecto(f)); return t && t !== '—' ? `${f.nombre}: ${t}` : null; })].filter(Boolean).join(' · ')) : null);
  } else {
    const ordenar = (id) => guardarVista({ orden: { campo: id, dir: vista.orden?.campo === id && vista.orden?.dir === 'asc' ? 'desc' : 'asc' } });
    const flechaOrden = (id) => (vista.orden?.campo === id ? (vista.orden.dir === 'asc' ? ' ↑' : ' ↓') : '');
    const todasLas = grupos.flatMap(g => g.notas);
    cuerpo = h('div', { class: 'bt-tabla-w' }, h('table', { class: 'bt-tabla' },
      h('thead', {}, h('tr', {},
        h('th', { onclick: () => ordenar('_titulo') }, 'Nombre', flechaOrden('_titulo')),
        visibles.map(f => h('th', { class: NUMERICOS.includes(f.tipo) ? 'num' : '', onclick: () => ordenar(f.id) }, h('span', { class: 'bt-th-sym' }, simboloTipo(tipo(f.tipo))), f.nombre, flechaOrden(f.id))))),
      h('tbody', {}, grupos.map(g => [
        g.titulo ? h('tr', { class: 'bt-tr-grupo' }, h('td', { colspan: String(visibles.length + 1) }, g.titulo, h('small', {}, ` ${g.notas.length}`))) : null,
        g.notas.map(n => h('tr', {},
          h('td', { class: 'bt-td-nombre' }, h('a', { href: `#/bitacora/n/${n.id}` }, n.titulo)),
          visibles.map(f => h('td', {
            class: `${NUMERICOS.includes(f.tipo) ? 'num' : ''}${f.tipo === 'auto' ? '' : ' editable'}`,
            onclick: f.tipo === 'auto' ? null : () => editarCelda(n, f),
          }, mostrarValor(ctx, f, valorCampo(n, f), d))))),
      ])),
      vista.totales ? h('tfoot', {}, h('tr', {},
        h('td', {}, `${total} en total`),
        visibles.map(f => {
          const modo = vista.tot?.[f.id] ?? totalPorDefecto(f);
          const opciones = totalesDe(f);
          const s = h('select', { class: 'bt-tot-sel', 'aria-label': `Total de ${f.nombre}`, onchange: (e) => guardarVista({ tot: { ...(vista.tot || {}), [f.id]: e.target.value } }) },
            opciones.map(o => h('option', { value: o[0], selected: o[0] === modo }, o[1])));
          return h('td', { class: NUMERICOS.includes(f.tipo) ? 'num' : '' }, s, modo ? h('span', { class: 'bt-tot-val' }, calcularTotal(todasLas, f, modo)) : null);
        }))) : null));
  }

  function editarCelda(n, f) {
    if (f.tipo === 'sino') { m.guardarNota(n.id, { props: { ...(n.props || {}), [f.id]: !n.props?.[f.id] } }); return; }
    let nuevo = valorCampo(n, f), cambio = false;
    const ctrl = controlCampo(ctx, m, d, f, nuevo, (v) => { nuevo = v; cambio = true; });
    const dlg = ventana(ctx, `${f.nombre} · ${n.titulo}`, h('div', { class: 'formulario-campos' }, ctrl), {
      botones: [h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
        h('button', { type: 'button', class: 'boton principal', onclick: async () => {
          document.activeElement?.blur?.();   // dispara el "change" del campo
          await new Promise(r => setTimeout(r, 30));
          if (cambio) await m.guardarNota(n.id, { props: { ...(n.props || {}), [f.id]: nuevo } });
          dlg.close();
        } }, 'Listo')],
    });
    setTimeout(() => ctrl.querySelector?.('input,select')?.focus?.() || ctrl.focus?.(), 50);
  }

  poner(zona, tabs, herramientas, cuerpo);
}

// ── Campos de la base ──
export function pantallaCampos(ctx, m, d, c, main) {
  const { h } = ctx;
  if (!c) { poner(main, vacio(ctx, 'Esta carpeta no existe', null)); return; }
  const campos = c.campos || [];
  const guardar = (lista) => m.guardarCarpeta(c.id, { campos: lista });
  const filas = campos.map((f, i) => h('div', { class: 'aj-fila' },
    h('span', { class: 'aj-nombre' }, simboloTipo(tipo(f.tipo)), f.nombre, h('small', { class: 'bt-nota-chica' }, tipo(f.tipo).nombre + (f.tipo === 'auto' ? ` (${f.auto === 'creada' ? 'creada' : 'editada'})` : ''))),
    h('span', { class: 'aj-acciones' },
      h('button', { type: 'button', class: 'aj-flecha', disabled: i === 0, 'aria-label': 'Subir', onclick: () => { const l = [...campos]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; guardar(l); } }, '↑'),
      h('button', { type: 'button', class: 'aj-flecha', disabled: i === campos.length - 1, 'aria-label': 'Bajar', onclick: () => { const l = [...campos]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; guardar(l); } }, '↓'),
      h('button', { type: 'button', class: `boton-icono bt-ojo${f.visible === false ? ' off' : ''}`, title: f.visible === false ? 'Oculto en tabla y tarjetas' : 'Se ve en tabla y tarjetas', 'aria-label': 'Mostrar u ocultar', onclick: () => guardar(campos.map(x => (x.id === f.id ? { ...x, visible: x.visible === false } : x))) }, ic(f.visible === false ? 'ojoNo' : 'ojo')),
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Editar campo', onclick: () => editorCampo(ctx, m, d, c, f) }, ic('editar')))));
  poner(main, 
    cabecera(ctx, { titulo: `Campos de "${c.nombre}"`, marca: marcaCarpeta(h, c), volver: { href: `#/bitacora/c/${c.id}`, texto: c.nombre } }),
    h('section', { class: 'tarjeta' },
      h('p', { class: 'nota' }, 'El nombre de cada nota es la primera columna. Ordená con las flechas; el ojo muestra u oculta el campo en la tabla y las tarjetas (en la ficha siempre se ve).'),
      campos.length ? h('div', { class: 'aj-tabla' }, filas) : h('p', { class: 'nota' }, 'Todavía no hay campos.'),
      h('div', { class: 'botonera' }, h('button', { type: 'button', class: 'boton principal', onclick: () => editorCampo(ctx, m, d, c, null) }, ic('mas'), 'Agregar campo'))),
    h('section', { class: 'tarjeta' },
      h('h2', {}, 'Formulario de carga'),
      h('p', { class: 'nota' }, 'Al tocar "+ Nueva" adentro de esta base se abre un formulario con estos campos. Si querés un texto inicial o que aparezca como nota rápida en toda la Bitácora, creá una plantilla que vaya a esta carpeta (Configurar Bitácora › Plantillas).')),
    h('section', { class: 'tarjeta' },
      h('h2', {}, 'Dejar de ser base de datos'),
      h('p', { class: 'nota' }, 'La carpeta vuelve a ser una carpeta común. Los valores cargados no se borran: si la volvés a convertir, reaparecen.'),
      h('div', { class: 'botonera' }, h('button', { type: 'button', class: 'boton', onclick: async () => { if (await ctx.confirmar(`¿"${c.nombre}" deja de ser base de datos?`, { si: 'Sí, carpeta común' })) { await m.guardarCarpeta(c.id, { base: false }); ctx.navegar(`bitacora/c/${c.id}`); } } }, 'Convertir en carpeta común'))),
  );
}

export function editorCampo(ctx, m, d, c, f) {
  const { h } = ctx;
  const ocultos = tiposOcultos(d);
  let tipoSel = f?.tipo || 'texto';
  let opciones = (f?.opciones || []).map(o => ({ ...o }));
  const nombre = h('input', { type: 'text', value: f?.nombre || '', placeholder: 'Ej: Teléfono, Estado, Pagó', 'aria-label': 'Nombre del campo' });
  const zonaTipos = h('div', { class: 'bt-tipos' });
  const extra = h('div', { class: 'formulario-campos' });
  const pintarTipos = () => poner(zonaTipos, ...TIPOS.filter(t => !ocultos.has(t.id) || t.id === tipoSel).map(t => h('button', { type: 'button', class: `bt-tipo${t.id === tipoSel ? ' sel' : ''}`, onclick: () => { tipoSel = t.id; pintarTipos(); pintarExtra(); } }, simboloTipo(t), t.nombre)));
  const selRel = h('select', { 'aria-label': 'Notas de' }, h('option', { value: '' }, 'Cualquier nota'), d.carpetas.map(x => h('option', { value: x.id, selected: f?.carpetaRel === x.id }, d.nombreRuta(x.id))));
  const selAuto = h('select', { 'aria-label': 'Fecha automática' }, h('option', { value: 'editada', selected: f?.auto !== 'creada' }, 'Última edición'), h('option', { value: 'creada', selected: f?.auto === 'creada' }, 'Creación'));
  function pintarExtra() {
    if (tipoSel === 'opcion' || tipoSel === 'opciones') {
      const lista = h('div', { class: 'bt-opciones-ed' }, opciones.map((o, i) => h('div', { class: 'bt-op-fila' },
        h('button', { type: 'button', class: `${colorClase(o.color)} bt-op-color`, title: 'Cambiar color', onclick: () => { o.color = COLORES_OPCION[(COLORES_OPCION.indexOf(o.color) + 1) % COLORES_OPCION.length]; pintarExtra(); } }, '●'),
        h('input', { type: 'text', value: o.nombre, 'aria-label': 'Opción', oninput: (e) => { o.nombre = e.target.value; } }),
        h('button', { type: 'button', class: 'aj-flecha', disabled: i === 0, 'aria-label': 'Subir', onclick: () => { [opciones[i - 1], opciones[i]] = [opciones[i], opciones[i - 1]]; pintarExtra(); } }, '↑'),
        h('button', { type: 'button', class: 'boton-icono bt-chico', 'aria-label': 'Quitar opción', onclick: () => { opciones.splice(i, 1); pintarExtra(); } }, ctx.icono('cerrar')))));
      poner(extra, h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Opciones (tocá el punto para cambiar el color)'), lista,
        h('button', { type: 'button', class: 'boton', onclick: () => { opciones.push({ id: nuevoIdCorto(), nombre: '', color: COLORES_OPCION[opciones.length % COLORES_OPCION.length] }); pintarExtra(); setTimeout(() => lista.parentElement.querySelectorAll('input')[opciones.length - 1]?.focus(), 30); } }, '+ Opción')));
    } else if (tipoSel === 'relacion') poner(extra, h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Elegir entre notas de'), selRel));
    else if (tipoSel === 'auto') poner(extra, h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Fecha de'), selAuto));
    else poner(extra, );
  }
  pintarTipos(); pintarExtra();
  const error = h('p', { class: 'formulario-error' });
  const dlg = ventana(ctx, f ? 'Editar campo' : 'Nuevo campo', h('div', { class: 'formulario-campos' },
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Nombre'), nombre),
    h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Tipo'), zonaTipos),
    extra, error), {
    botones: [
      f ? h('button', { type: 'button', class: 'boton peligro', onclick: async () => {
        if (!await ctx.confirmar(`¿Borrar el campo "${f.nombre}"? Se dejan de ver sus valores (no se borran de las notas).`, { si: 'Borrar campo', peligro: true })) return;
        await m.guardarCarpeta(c.id, { campos: c.campos.filter(x => x.id !== f.id), vistas: (c.vistas || []).map(v => ({ ...v, filtros: (v.filtros || []).filter(x => x.campo !== f.id), agrupar: v.agrupar === f.id ? '' : v.agrupar })) });
        dlg.close();
      } }, 'Borrar') : null,
      h('span', { class: 'bt-espacio' }),
      h('button', { type: 'button', class: 'boton', onclick: () => dlg.close() }, 'Cancelar'),
      h('button', { type: 'button', class: 'boton principal', onclick: async () => {
        if (!nombre.value.trim()) { error.textContent = 'Poné un nombre.'; nombre.focus(); return; }
        if ((c.campos || []).some(x => x.id !== f?.id && x.nombre.trim().toLowerCase() === nombre.value.trim().toLowerCase())) { error.textContent = 'Ya hay un campo con ese nombre.'; return; }
        const datos = { nombre: nombre.value.trim(), tipo: tipoSel, opciones: opciones.filter(o => o.nombre.trim()).map(o => ({ ...o, nombre: o.nombre.trim() })) };
        if (tipoSel === 'relacion') datos.carpetaRel = selRel.value;
        if (tipoSel === 'auto') datos.auto = selAuto.value;
        const lista = f ? c.campos.map(x => (x.id === f.id ? { ...x, ...datos } : x)) : [...(c.campos || []), { id: nuevoIdCorto(), visible: true, ...datos }];
        await m.guardarCarpeta(c.id, { campos: lista });
        dlg.close();
      } }, f ? 'Guardar' : 'Agregar')],
  });
  setTimeout(() => nombre.focus(), 50);
}
