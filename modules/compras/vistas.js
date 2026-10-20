// ─────────────────────────────────────────────────────────────
// Compras: pantallas.
//   #/compras                    Lista de pendientes (con la lista del mes arriba)
//   #/compras/despensa           Despensa por lugar
//   #/compras/comidas            Programadas + lo que falta + Recetario
//   #/compras/comidas/<id>       Receta, sola en la pantalla (…/nueva para cargar una)
//   #/compras/informe            Informe del mes
//   #/compras/ajustes            ⚙ Productos y orden de sectores (…/ajustes/<id> ficha)
//   #/compras/super              Comprando: escanear, carrito, "te falta"
//   #/compras/terminar           Descuentos y guardar
//   #/compras/recuento           Recontar la despensa por lugar
// ─────────────────────────────────────────────────────────────

import { crearModelo, plata, cant, LUGARES, MOTIVOS_TIRO, num, aBase } from './modelo.js';
import { cargarEstilos, poner, productoDeCodigo, fila, grupo, hoja, tipoDeTexto } from './comun.js';
import { escanear } from './externos.js';
import { pintarSuper, pintarTerminar } from './super.js';
import { pintarRecuento } from './recuento.js';
import { pintarAjustes } from './ajustes.js';
import { pintarComidas } from './comidas.js';
import { pintarInforme, tarjetaBase } from './informe.js';

const PESTANAS = [['lista', 'Lista', ''], ['despensa', 'Despensa', '/despensa'], ['comidas', 'Comidas', '/comidas'], ['informe', 'Informe', '/informe']];
const APARTE = {
  super: ['En el súper', 'Escaneá lo que agarrás.', '#/compras'],
  terminar: ['Terminar la compra', 'Descuento de cada producto y de la tarjeta.', '#/compras/super'],
  recuento: ['Recuento', 'Elegí un lugar, contá lo que hay y se ajusta.', '#/compras/despensa'],
};
const SUBTITULO = { lista: 'Lo que hay que comprar.', despensa: 'Lo que tenés en casa.', comidas: 'Comidas del mes y recetas.', informe: 'Cómo fue el mes.', ajustes: 'Productos y sectores.' };

const ui = { abiertoLista: null, filtroDesp: 'Todo', abiertoDesp: null };
let sugeridoHoy = '';

export async function pantallaCompras(contenedor, ctx, sub = []) {
  cargarEstilos();
  const { h } = ctx;
  const m = crearModelo(ctx);
  const ruta = sub[0] || 'lista';
  const cuerpo = h('div', { class: 'cp-cuerpo' });
  const aparte = APARTE[ruta];
  // Las fichas (receta, producto) se abren solas: sin pestañas arriba.
  const ficha = (ruta === 'comidas' || ruta === 'ajustes') && sub[1];

  contenedor.replaceChildren(h('div', { class: 'cp' },
    aparte ? h('header', { class: 'cp-cab' }, h('a', { href: aparte[2], class: 'cp-volver', 'aria-label': 'Volver' }, '‹'), h('div', {}, h('h1', {}, aparte[0]), h('p', {}, aparte[1])))
      : ficha ? null
        : h('header', { class: 'cp-cab' }, h('div', {}, h('h1', {}, 'Compras'), h('p', {}, SUBTITULO[ruta] || '')),
          h('div', { class: 'cp-der' },
            h('nav', { class: 'cp-pest' }, PESTANAS.map(([id, t, r]) => h('a', { href: `#/compras${r}`, class: ruta === id ? 'sel' : '' }, t))),
            h('a', { href: '#/compras/ajustes', class: `boton-icono${ruta === 'ajustes' ? ' activo' : ''}`, 'aria-label': 'Ajustes de Compras', title: 'Ajustes de Compras' }, ctx.icono('ajustes')))),
    cuerpo));

  let turno = 0;
  async function pintar() {
    const mio = ++turno;
    const d = await m.cargar();
    if (mio !== turno) return;
    const foco = document.activeElement;
    if (cuerpo.contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) return;   // no pisar lo que estás escribiendo
    const args = [cuerpo, ctx, m, d, pintar, sub];
    const p = { despensa: pintarDespensa, super: pintarSuper, terminar: pintarTerminar, recuento: pintarRecuento, ajustes: pintarAjustes, comidas: pintarComidas, informe: pintarInforme }[ruta] || pintarLista;
    return p(...args);
  }

  // Una vez por día, al abrir la lista, se suman las sugerencias nuevas.
  if (ruta === 'lista' && sugeridoHoy !== new Date().toDateString()) {
    sugeridoHoy = new Date().toDateString();
    try { await m.sumarSugerencias(await m.cargar()); } catch (e) { console.error(e); }
  }
  await pintar();
  let espera = null;
  const quitar = ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(pintar, 80); });
  return () => { turno++; quitar(); clearTimeout(espera); };
}

// ── Empezar la compra ──
// Se elige dónde y qué parte de la lista se compra ahí (ej.: en la
// carnicería, solo la carne). Se recuerda qué sectores van a cada súper.
export async function empezarCompra(ctx, m, d, { cambiar = false } = {}) {
  if (d.ajustes.compraEnCurso && !cambiar) { ctx.navegar('compras/super'); return; }
  const { h } = ctx;
  const enCurso = d.ajustes.compraEnCurso;
  const pend = d.lista;
  const sectores = d.sectores.filter(s => pend.some(x => d.sectorDe(x.tipoId) === s));
  const elegidos = new Set(enCurso?.items || pend.map(x => x.id));
  const superIn = h('input', { type: 'text', id: 'cp-super', value: enCurso?.super ?? d.ajustes.ultimoSuper ?? '', placeholder: 'Ej.: Coto Caballito, la carnicería', autocomplete: 'off', list: 'cp-supers' });
  const supers = h('datalist', { id: 'cp-supers' }, Object.keys(d.ajustes.sectoresPorSuper || {}).map(s => h('option', { value: s })));
  const cuerpo = h('div', { class: 'cp-elegir' });
  const pie = h('p', { class: 'cp-sub' });
  const recordar = () => {
    const s = (d.ajustes.sectoresPorSuper || {})[superIn.value.trim().toLowerCase()];
    if (!s) return;
    elegidos.clear();
    for (const x of pend) if (s.includes(d.sectorDe(x.tipoId))) elegidos.add(x.id);
    dibujar();
  };
  superIn.addEventListener('change', recordar);
  const dibujar = () => {
    poner(cuerpo, sectores.map(s => {
      const l = pend.filter(x => d.sectorDe(x.tipoId) === s);
      const todos = l.every(x => elegidos.has(x.id)), alguno = l.some(x => elegidos.has(x.id));
      const chk = h('input', { type: 'checkbox', checked: todos, onchange: (e) => { l.forEach(x => e.target.checked ? elegidos.add(x.id) : elegidos.delete(x.id)); dibujar(); } });
      chk.indeterminate = alguno && !todos;
      return [h('label', { class: 'cp-grupo toca' }, chk, s, h('span', {}, `${l.filter(x => elegidos.has(x.id)).length} de ${l.length}`)),
        l.map(x => h('label', { class: 'cp-lc' }, h('input', { type: 'checkbox', checked: elegidos.has(x.id), onchange: (e) => { e.target.checked ? elegidos.add(x.id) : elegidos.delete(x.id); dibujar(); } }),
          h('span', { class: 'cp-em' }, d.emojiDe(x.tipoId)), h('span', { class: 'cp-n' }, d.nombreDe(x.tipoId)), h('span', { class: 'cp-q' }, cant(x.cantidad, d.baseDe(x.tipoId)))))];
    }));
    pie.textContent = pend.length ? `Vas a comprar ${elegidos.size} de ${pend.length}. Lo demás queda en la lista para otra compra.` : 'La lista está vacía: agregás lo que escanees.';
  };
  dibujar();
  const r = await hoja(ctx, enCurso ? 'Qué comprás ahora' : 'Empezar la compra', h('div', { class: 'formulario-campos' },
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, '¿Dónde comprás?'), superIn, supers),
    pend.length ? h('div', { class: 'cp-fila' }, h('span', { class: 'etiqueta-campo crece' }, '¿Qué vas a comprar acá?'),
      h('button', { type: 'button', class: 'cp-bt ch', onclick: () => { pend.forEach(x => elegidos.add(x.id)); dibujar(); } }, 'Todo'),
      h('button', { type: 'button', class: 'cp-bt ch', onclick: () => { elegidos.clear(); dibujar(); } }, 'Nada')) : null,
    cuerpo, pie),
  [{ texto: 'Cancelar' }, { texto: enCurso ? 'Listo' : 'Empezar', clase: 'boton principal', valor: () => ({ super: superIn.value.trim(), items: [...elegidos] }) }]);
  if (!r) return;
  const porSuper = { ...(d.ajustes.sectoresPorSuper || {}) };
  if (r.super) porSuper[r.super.toLowerCase()] = sectores.filter(s => pend.some(x => d.sectorDe(x.tipoId) === s && elegidos.has(x.id)));
  await m.guardarAjustes(d, { compraEnCurso: { super: r.super, desde: enCurso?.desde || Date.now(), items: r.items }, sectoresPorSuper: porSuper });
  ctx.navegar('compras/super');
}

// ── Lista ──

// "2 kg papa", "3 leche", "papa" → tipo y cantidad.
async function agregarTexto(ctx, m, d, texto) {
  const t = texto.trim();
  if (!t) return;
  if (/^\d{8,14}$/.test(t)) { const p = await productoDeCodigo(ctx, m, d, t); if (p) await m.agregarALista(d, d.tipo(p.tipoId)); return; }
  const r = t.match(/^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr|gramos|l|lt|litros?|ml|u|unidades)?\.?\s+(?:de\s+)?(.+)$/i);
  const nombre = r ? r[3] : t;
  const tipo = await tipoDeTexto(m, d, nombre[0].toUpperCase() + nombre.slice(1));
  let cantidad;
  if (r) {
    const n = num(r[1]), u = (r[2] || '').toLowerCase();
    cantidad = u.startsWith('g') ? n / 1000 : u === 'ml' ? n / 1000 : n;
    // "3 leche" sin unidad = 3 envases de tu producto de siempre
    if (!u && tipo.base !== 'u.') cantidad = n * (d.preferido(tipo.id)?.contenido || 1);
  }
  await m.agregarALista(d, tipo, { cantidad });
}

function pintarLista(cuerpo, ctx, m, d, repintar) {
  const { h } = ctx;
  const items = d.lista;
  const estimado = items.reduce((a, x) => a + d.estimado(x.tipoId, Number(x.cantidad) || 0), 0);
  const entrada = h('input', { type: 'text', id: 'cp-agregar', placeholder: 'Agregar… (ej.: 2 kg papa)', list: 'cp-tipos', autocomplete: 'off' });
  const form = h('form', { class: 'cp-fila sin-salto cp-agregar', onsubmit: async (e) => { e.preventDefault(); const v = entrada.value; entrada.value = ''; entrada.blur(); await agregarTexto(ctx, m, d, v); repintar(); } },
    entrada, h('datalist', { id: 'cp-tipos' }, d.tipos.map(t => h('option', { value: t.nombre }))),
    h('button', { type: 'button', class: 'cp-bt', 'aria-label': 'Escanear', title: 'Escanear', onclick: async () => {
      const c = await escanear(ctx);
      if (!c) return;
      const p = await productoDeCodigo(ctx, m, d, c);
      if (p) { await m.agregarALista(d, d.tipo(p.tipoId)); ctx.aviso(`${d.nombreDe(p.tipoId)} a la lista`); }
    } }, iconoScan(ctx)));

  const filaLista = (x) => {
    const base = d.baseDe(x.tipoId), env = d.envases(x.tipoId, x.cantidad), est = d.estimado(x.tipoId, x.cantidad);
    const abierto = ui.abiertoLista === x.id;
    const paso = d.preferido(x.tipoId)?.contenido || (base === 'u.' ? 1 : 0.5);
    return [
      fila(ctx, {
        emoji: d.emojiDe(x.tipoId), nombre: [d.nombreDe(x.tipoId), x.sugerida ? h('i', { class: 'cp-sug' }, '✦') : null],
        chico: env ? `${env.n} de ${env.producto.nombre}` : '',
        der: h('span', { class: 'cp-q' }, `${cant(x.cantidad, base)}${est ? ` · ${plata(est)}` : ''}`),
        alTocar: () => { ui.abiertoLista = abierto ? null : x.id; repintar(); },
      }),
      abierto ? h('div', { class: 'cp-razon' },
        h('span', { class: 'crece' }, (x.sugerida && x.motivo) || 'Agregado por vos'),
        h('span', { class: 'cp-stp chico' },
          h('button', { type: 'button', onclick: () => m.col.lista.actualizar(x.id, { cantidad: Math.max(paso, Math.round(((Number(x.cantidad) || 0) - paso) * 1000) / 1000) }) }, '−'),
          h('b', {}, cant(x.cantidad, base)),
          h('button', { type: 'button', onclick: () => m.col.lista.actualizar(x.id, { cantidad: Math.round(((Number(x.cantidad) || 0) + paso) * 1000) / 1000 }) }, '+')),
        h('button', { type: 'button', class: 'cp-bt ch', onclick: async () => { ui.abiertoLista = null; await m.quitarDeLista(d, x); } }, x.sugerida ? 'No, gracias' : 'Quitar')) : null,
    ];
  };

  const sectores = d.sectores.filter(s => items.some(x => d.sectorDe(x.tipoId) === s));
  const vencen = d.porVencer(7).slice(0, 6);
  const enCurso = d.ajustes.compraEnCurso;

  poner(cuerpo, h('div', { class: 'cp-cols' },
    h('div', { class: 'cp-col' },
      tarjetaBase(ctx, m, d, repintar),
      h('section', { class: 'cp-card apretada' },
        form,
        h('div', { class: 'cp-leyenda' }, h('span', {}, h('b', {}, '✦'), ' sugerida por la app (tocá para ver por qué)'), h('span', {}, `${items.length} por comprar`)),
        items.length ? sectores.map(s => { const l = items.filter(x => d.sectorDe(x.tipoId) === s); return [grupo(ctx, s, l.length), l.map(filaLista)]; })
          : h('p', { class: 'cp-sub' }, 'Tu lista está vacía. Escribí arriba o escaneá un código.')),
      h('div', { class: 'cp-barra-lista' },
        h('span', {}, h('small', {}, `${items.length} productos · estimado`), h('b', {}, plata(estimado))),
        h('button', { type: 'button', class: 'cp-bt p', onclick: () => empezarCompra(ctx, m, d) }, iconoCarro(ctx), enCurso ? 'Seguir la compra' : 'Empezar la compra'))),
    h('div', { class: 'cp-col solo-pc' },
      h('section', { class: 'cp-card' }, h('h3', {}, 'Por vencer'),
        vencen.length ? vencen.map(x => fila(ctx, { emoji: d.emojiDe(x.tipoId), nombre: `${d.nombreDe(x.tipoId)} · ${cant(x.cantidad, d.baseDe(x.tipoId))}`, der: etiquetaVence(ctx, d.venceEn(x)), alTocar: () => ctx.navegar('compras/despensa') }))
          : h('p', { class: 'cp-sub' }, 'Nada vence esta semana.')),
      h('section', { class: 'cp-card' }, h('h3', {}, 'Cómo funciona'),
        h('p', { class: 'cp-sub' }, 'Acá armás lo que falta, por tipo y cantidad ("Leche entera · 6 L"). Abajo ves tu producto de siempre. En el súper se tilda solo cuando escaneás, aunque sea otra marca u otro tamaño.')))));
}

// ── Despensa ──

export function etiquetaVence(ctx, dias, sinFecha = false) {
  const { h } = ctx;
  if (dias === null) return sinFecha ? h('span', { class: 'cp-tagc lat' }, 'sin fecha') : null;
  if (dias < 0) return h('span', { class: 'cp-tagc rojo' }, dias === -1 ? 'venció ayer' : 'venció');
  if (dias === 0) return h('span', { class: 'cp-tagc rojo' }, 'vence hoy');
  if (dias <= 3) return h('span', { class: 'cp-tagc rojo' }, `${dias}d`);
  if (dias <= 10) return h('span', { class: 'cp-tagc lat' }, `${dias}d`);
  return null;
}

async function agregarADespensaAMano(ctx, m, d) {
  const r = await ctx.formulario({
    titulo: 'Agregar a la despensa', textoGuardar: 'Agregar',
    campos: [
      { id: 'nombre', etiqueta: 'Qué es (ej.: Leche entera)', tipo: 'texto', requerido: true },
      { id: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', valor: 1 },
      { id: 'unidad', etiqueta: 'En', tipo: 'seleccion', opciones: ['u.', 'kg', 'g', 'L', 'ml'], valor: 'u.' },
      { id: 'lugar', etiqueta: 'Lugar', tipo: 'seleccion', opciones: LUGARES.map(l => l[0]), valor: LUGARES.some(l => l[0] === ui.filtroDesp) ? ui.filtroDesp : 'Alacena' },
      { id: 'vence', etiqueta: 'Vence (opcional)', tipo: 'fecha' },
    ],
  });
  if (!r) return;
  const base = r.unidad === 'g' || r.unidad === 'kg' ? 'kg' : r.unidad === 'ml' || r.unidad === 'L' ? 'L' : 'u.';
  const t = d.tipoPorNombre(r.nombre) || await m.asegurarTipo(d, r.nombre, { base });
  await m.sumarADespensa(d, { tipoId: t.id, cantidad: aBase(r.cantidad || 1, r.unidad), lugar: r.lugar || t.lugar || 'Alacena', vence: r.vence });
}

function pintarDespensa(cuerpo, ctx, m, d, repintar) {
  const { h } = ctx;
  const filtros = ['Todo', 'Por vencer', 'Sin vencimiento', ...LUGARES.map(l => l[0])];
  const f = ui.filtroDesp;
  let l = [...d.despensa].sort((a, b) => d.nombreDe(a.tipoId).localeCompare(d.nombreDe(b.tipoId)));
  if (f === 'Por vencer') l = d.porVencer(7);
  else if (f === 'Sin vencimiento') l = l.filter(x => d.faltaVencimiento(x));
  else if (f !== 'Todo') l = l.filter(x => x.lugar === f);
  const sinV = d.despensa.filter(x => d.faltaVencimiento(x)).length;
  const grupos = f === 'Todo' ? LUGARES.map(x => x[0]).filter(g => l.some(x => x.lugar === g)) : [null];

  const accion = async (x, que) => {
    const t = d.tipo(x.tipoId), base = d.baseDe(x.tipoId);
    const paso = d.preferido(x.tipoId)?.contenido || 1;
    if (que === 'mas1') await m.col.despensa.actualizar(x.id, { cantidad: Math.round(((Number(x.cantidad) || 0) + paso) * 1000) / 1000 });
    if (que === 'termino') { await m.ponerCantidad(x, 0); ctx.aviso(`${t?.nombre}: se terminó`, { accion: 'A la lista', alTocar: () => t && m.agregarALista(d, t) }); }
    if (que === 'tiro') {
      const r = await ctx.formulario({ titulo: `Se tiró: ${t?.nombre}`, textoGuardar: 'Anotar', campos: [
        { id: 'motivo', etiqueta: '¿Por qué?', tipo: 'seleccion', opciones: MOTIVOS_TIRO, valor: MOTIVOS_TIRO[0], requerido: true },
        { id: 'cantidad', etiqueta: `Cuánto (${base === 'u.' ? 'unidades' : base})`, tipo: 'numero', valor: x.cantidad }] });
      if (r) await m.tirar(d, x, r);
    }
    if (que === 'vence') {
      const r = await ctx.formulario({ titulo: `Vencimiento: ${t?.nombre}`, campos: [{ id: 'vence', etiqueta: 'Vence el', tipo: 'fecha', valor: x.vence || '' }] });
      if (r) await m.col.despensa.actualizar(x.id, { vence: r.vence });
    }
    if (que === 'lugar') {
      const r = await ctx.formulario({ titulo: `Lugar: ${t?.nombre}`, campos: [{ id: 'lugar', etiqueta: 'Va en', tipo: 'seleccion', opciones: LUGARES.map(l => l[0]), valor: x.lugar, requerido: true }] });
      if (r) await m.col.despensa.actualizar(x.id, { lugar: r.lugar });
    }
    if ((que === 'mas' || que === 'feo') && t) await m.col.tipos.actualizar(t.id, { gusto: t.gusto === que ? '' : que });
    if (que === 'nota') {
      const r = await ctx.formulario({ titulo: `Nota: ${t?.nombre}`, campos: [{ id: 'nota', etiqueta: 'Nota', tipo: 'parrafo', valor: x.nota || '' }] });
      if (r) await m.col.despensa.actualizar(x.id, { nota: r.nota });
    }
  };
  // "−": una unidad, o un envase de tu producto de siempre; si no hay, pregunta cuánto.
  const usar = async (x) => {
    const base = d.baseDe(x.tipoId), env = d.preferido(x.tipoId)?.contenido;
    if (base === 'u.') return m.ponerCantidad(x, (Number(x.cantidad) || 0) - 1);
    const r = await ctx.formulario({ titulo: `Usé ${d.nombreDe(x.tipoId)}`, textoGuardar: 'Descontar', campos: [
      { id: 'c', etiqueta: `¿Cuánto? (te quedan ${cant(x.cantidad, base)})`, tipo: 'numero', valor: env ? (env < 1 ? env * 1000 : env) : '', requerido: true },
      { id: 'u', etiqueta: 'En', tipo: 'seleccion', opciones: base === 'L' ? ['ml', 'L'] : ['g', 'kg'], valor: env && env < 1 ? (base === 'L' ? 'ml' : 'g') : base }] });
    if (r?.c) await m.ponerCantidad(x, (Number(x.cantidad) || 0) - aBase(r.c, r.u));
  };

  const filaD = (x) => {
    const t = d.tipo(x.tipoId), base = d.baseDe(x.tipoId);
    const abierto = ui.abiertoDesp === x.id;
    const gusto = t?.gusto === 'feo' ? h('i', { class: 'cp-feo' }, ' 👎') : t?.gusto === 'mas' ? h('i', {}, ' 👍') : null;
    const q = cant(x.cantidad, base).split(' ');
    return [
      h('div', { class: 'cp-lc fija' },
        h('span', { class: 'cp-em' }, d.emojiDe(x.tipoId)),
        h('span', { class: 'cp-n toca', onclick: () => { ui.abiertoDesp = abierto ? null : x.id; repintar(); } }, t?.nombre || '?', gusto, x.nota ? h('i', { title: x.nota }, ' 📝') : null),
        etiquetaVence(ctx, d.venceEn(x), d.faltaVencimiento(x)),
        h('span', { class: 'cp-qd' }, h('b', {}, q[0]), h('small', {}, q[1] || '')),
        h('button', { type: 'button', class: 'cp-menos', 'aria-label': 'Usé', onclick: () => usar(x) }, '−')),
      abierto ? h('div', { class: 'cp-menu' },
        [['mas1', '+1'], ['termino', 'Se terminó'], ['tiro', '🗑 Se tiró…'], ['vence', 'Vencimiento…'], ['lugar', 'Lugar…'],
          ['mas', t?.gusto === 'mas' ? '👍 Comprar más ✓' : '👍 Comprar más'], ['feo', t?.gusto === 'feo' ? '👎 No nos gustó ✓' : '👎 No nos gustó'], ['nota', 'Nota…']]
          .map(([k, txt]) => h('button', { type: 'button', class: 'cp-bt ch', onclick: () => accion(x, k) }, txt)),
        x.nota ? h('span', { class: 'cp-sub ancho' }, `📝 ${x.nota}`) : null) : null,
    ];
  };

  poner(cuerpo,
    sinV ? h('div', { class: 'cp-alerta' }, h('span', {}, '⚠️'), h('span', { class: 'crece' }, 'A ', h('b', {}, `${sinV} producto${sinV === 1 ? '' : 's'}`), ' les falta la fecha de vencimiento.'),
      h('button', { type: 'button', class: 'cp-bt ch', onclick: () => { ui.filtroDesp = 'Sin vencimiento'; repintar(); } }, 'Cargar')) : null,
    h('div', { class: 'cp-fila sin-salto' },
      h('div', { class: 'cp-filtros crece' }, filtros.map(x => h('button', { type: 'button', class: f === x ? 'sel' : '', onclick: () => { ui.filtroDesp = x; repintar(); } }, x))),
      h('a', { class: 'cp-bt ch', href: '#/compras/recuento' }, '↻ Recontar')),
    h('section', { class: 'cp-card apretada' },
      l.length ? grupos.map(g => [g ? grupo(ctx, g, l.filter(x => x.lugar === g).length) : null, l.filter(x => !g || x.lugar === g).map(filaD)])
        : h('p', { class: 'cp-sub' }, d.despensa.length ? 'No hay nada con este filtro.' : 'La despensa está vacía. Se llena sola al guardar una compra, o agregá a mano.'),
      h('button', { type: 'button', class: 'cp-bt ch izq', onclick: () => agregarADespensaAMano(ctx, m, d) }, '+ Agregar a mano')),
    h('p', { class: 'cp-sub' }, 'El ', h('b', {}, '−'), ' descuenta lo que usaste. Tocá el nombre para más: +1, se terminó, se tiró, vencimiento, comentarios.'));
}

// ── Íconos propios ──
const SVG = (t) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${t}</svg>`;
export const iconoScan = (ctx) => ctx.h('span', { class: 'cp-ic', html: SVG('<path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M7 9v6M10 9v6M13 9v6M16 9v6"/>') });
export const iconoCarro = (ctx) => ctx.h('span', { class: 'cp-ic', html: SVG('<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>') });
