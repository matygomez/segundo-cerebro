// ─────────────────────────────────────────────────────────────
// Compras: en el súper (escanear, carrito, "te falta") y terminar
// la compra (descuentos, gasto a Finanzas, productos a la Despensa).
//
// Lo que escaneás cuenta para el tipo de la lista aunque sea otra marca
// u otro tamaño: una Sancor de 750 ml suma 0,75 L a "Leche entera".
// ─────────────────────────────────────────────────────────────

import { plata, num, hoyISO, cant, LUGARES } from './modelo.js';
import { poner, productoDeCodigo, fila, grupo, hoja, tipoDeTexto } from './comun.js';
import { escanear, precioReferencia } from './externos.js';
import { iconoScan, empezarCompra } from './vistas.js';

let panel = null;   // producto que se está por agregar al carrito
const opciones = { aFinanzas: true, aDespensa: true, descTarjeta: '' };

function abrirPanel(d, producto, repintar) {
  const tipo = d.tipo(producto.tipoId);
  const item = d.lista.find(x => x.tipoId === producto.tipoId) || null;
  const ult = d.ultimoPrecio(producto.id);
  // Suelto = sin código y por peso o volumen (fruta, verdura, fiambre): se pone cuánto llevás.
  const suelto = !producto.codigo && tipo?.base !== 'u.';
  const falta = item ? d.falta(item) : 0;
  panel = {
    producto, tipo, item, ult, suelto, ref: producto.codigo ? 'cargando' : null, sel: ult ? 'ult' : 'otro', otro: '',
    cantidad: suelto ? (falta || 1) : Math.max(1, item ? Math.ceil(falta / (producto.contenido || 1) - 1e-9) : 1),
    vence: '', lugar: tipo?.lugar || 'Alacena',
  };
  if (producto.codigo) {
    const este = panel;
    precioReferencia(producto.codigo, d.ajustes.compraEnCurso?.super || '').then((ref) => {
      if (panel !== este) return;
      este.ref = ref;
      if (ref && este.sel !== 'otro') este.sel = 'ref';
      repintar();
    });
  }
  repintar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const precioElegido = (p) => p.sel === 'ref' && p.ref?.precio ? p.ref.precio : p.sel === 'ult' && p.ult ? p.ult.precio : num(p.otro);

async function agregarAlCarrito(ctx, m, d) {
  const p = panel, precio = precioElegido(p);
  if (!precio) { ctx.aviso('Poné el precio'); return; }
  if (!p.cantidad) { ctx.aviso('Poné cuánto llevás'); return; }
  await m.col.carrito.crear({
    productoId: p.producto.id, tipoId: p.producto.tipoId, nombre: p.producto.nombre, precio,
    cantidad: p.cantidad, contenido: p.suelto ? 1 : (p.producto.contenido || 1), descuento: 0, vence: p.vence, lugar: p.lugar, fueraDeLista: !p.item,
  });
  panel = null;
}

function dibujarPanel(ctx, d, m, repintar) {
  const { h } = ctx;
  const p = panel, pr = p.producto, base = p.tipo?.base || 'u.';
  const enBase = () => p.suelto ? p.cantidad : p.cantidad * (pr.contenido || 1);
  const porBase = (precio) => p.suelto ? precio : precio / (pr.contenido || 1);
  const etqBase = base === 'u.' ? 'u.' : base;
  const totalEl = h('b', {}), cuentaEl = h('span', {}), compara = h('div', { class: 'cp-aviso-p' }), cubre = h('div', {});
  const pref = d.preferido(pr.tipoId), prefU = pref && pref.id !== pr.id ? d.ultimoPrecio(pref.id) : null;
  const refrescar = () => {
    const precio = precioElegido(p);
    cuentaEl.textContent = p.suelto ? `${cant(p.cantidad, base)} × ${plata(precio)}/${etqBase}` : `${p.cantidad} × ${cant(pr.contenido || 1, base)} = ${cant(enBase(), base)}`;
    totalEl.textContent = plata(precio * p.cantidad);
    if (prefU && pref.contenido && precio && base !== 'u.') {
      const a = prefU.precio / pref.contenido, b = porBase(precio), dif = Math.round((b / a - 1) * 100);
      poner(compara, `Tu ${pref.nombre} la pagaste ${plata(prefU.precio)} → `, h('b', {}, `${plata(a)}/${etqBase}`), '. Esta sale ', h('b', {}, `${plata(b)}/${etqBase}`), ': ',
        h('span', { class: dif > 0 ? 'rojo' : 'verde' }, dif > 0 ? `${dif}% más cara por ${base === 'L' ? 'litro' : 'kilo'}` : dif < 0 ? `${-dif}% más barata por ${base === 'L' ? 'litro' : 'kilo'}` : 'igual por litro'), '.');
      compara.hidden = false;
    } else compara.hidden = true;
    if (p.item) {
      const falta = d.falta(p.item), ok = enBase() >= falta - 1e-9;
      cubre.className = ok ? 'ahorro' : 'lat';
      const resto = falta - enBase();
      poner(cubre, h('span', {}, ok ? '✓ Cubre lo de la lista' : `Te faltarían ${cant(resto, base)}${!p.suelto && pr.contenido ? ` → ${Math.ceil(resto / pr.contenido - 1e-9)} más` : ''}`), h('span', {}, cant(falta, base)));
    }
  };
  const opcion = (id, cont, tag = null) => h('div', { class: `cp-pr${p.sel === id ? ' sel' : ''}`, onclick: (e) => { if (e.target.tagName === 'INPUT') return; p.sel = id; repintar(); } },
    h('span', { class: 'r' }), h('span', { class: 't' }, cont), tag);
  const sufijo = (precio) => !p.suelto && base !== 'u.' && pr.contenido ? h('span', { class: 'cp-gris' }, ` · ${plata(porBase(precio))}/${etqBase}`) : null;
  const pct = p.ref?.precio && p.ult ? Math.round((p.ref.precio / p.ult.precio - 1) * 100) : null;
  const otro = h('input', { id: 'cp-otro', inputmode: 'decimal', placeholder: p.suelto ? `$ por ${etqBase}` : '$', value: p.otro, oninput: (e) => {
    p.otro = e.target.value; p.sel = 'otro';
    e.target.closest('.cp-precios').querySelectorAll('.cp-pr').forEach(x => x.classList.toggle('sel', x.contains(e.target)));
    refrescar();
  } });
  const cantidadCtl = p.suelto
    ? h('label', {}, `Cuánto llevás (${etqBase})`, h('input', { id: 'cp-cuanto', inputmode: 'decimal', value: String(p.cantidad).replace('.', ','), oninput: (e) => { p.cantidad = num(e.target.value); refrescar(); } }))
    : h('label', {}, 'Cantidad', h('span', { class: 'cp-stp' },
      h('button', { type: 'button', onclick: () => { p.cantidad = Math.max(1, p.cantidad - 1); repintar(); } }, '−'), h('b', {}, String(p.cantidad)),
      h('button', { type: 'button', onclick: () => { p.cantidad++; repintar(); } }, '+')));
  const lugar = h('select', { id: 'cp-lugar', onchange: (e) => { p.lugar = e.target.value; } }, LUGARES.map(([l]) => h('option', { value: l }, l)));
  lugar.value = p.lugar;

  const nodo = h('div', { class: 'cp-encontrado' },
    h('div', { class: 'cp-enc-top' }, h('span', { class: 'cp-foto' }, p.tipo?.emoji || '🛒'),
      h('span', {}, h('b', {}, pr.nombre), h('small', {}, [pr.marca, pr.contenido && !p.suelto ? cant(pr.contenido, base) : '', pr.codigo ? `código ${pr.codigo}` : 'sin código'].filter(Boolean).join(' · ')))),
    h('p', { class: 'cp-sub' }, p.item ? ['✓ Cuenta para ', h('b', {}, p.tipo?.nombre), ` de tu lista (faltan ${cant(d.falta(p.item), base)}).`] : 'No estaba en la lista: va al carrito como "fuera de lista".'),
    h('span', { class: 'cp-et lat' }, p.suelto ? `¿Cuánto sale el ${etqBase}?` : '¿Qué precio tiene?'),
    h('div', { class: 'cp-precios' },
      p.ref === 'cargando' ? h('div', { class: 'cp-pr apagado' }, h('span', { class: 'r' }), h('span', { class: 't' }, 'Buscando precio de referencia…')) : null,
      p.ref && p.ref !== 'cargando' ? opcion('ref', [plata(p.ref.precio), sufijo(p.ref.precio), h('small', {}, p.ref.texto)]) : null,
      p.ult ? opcion('ult', [plata(p.ult.precio), sufijo(p.ult.precio), h('small', {}, `Pagaste el ${p.ult.fecha.split('-').reverse().slice(0, 2).join('/')}${p.ult.super ? ` en ${p.ult.super}` : ''}`)],
        pct ? h('span', { class: `cp-tag ${pct > 0 ? 'rojo' : 'verde'}` }, `${pct > 0 ? '+' : ''}${pct}% desde entonces`) : null) : null,
      opcion('otro', ['Otro precio', h('small', {}, 'El que ves en la góndola')], otro)),
    compara,
    h('div', { class: 'cp-fila' }, cantidadCtl,
      h('label', {}, 'Vence (opcional)', h('input', { type: 'date', id: 'cp-vence', value: p.vence, onchange: (e) => { p.vence = e.target.value; } })),
      h('label', {}, 'Va a', lugar)),
    h('div', { class: 'cp-cuenta' }, h('div', {}, cuentaEl, totalEl), p.item ? cubre : null),
    h('div', { class: 'cp-fila' },
      h('button', { type: 'button', class: 'cp-bt', onclick: () => { panel = null; repintar(); } }, 'Cancelar'),
      h('button', { type: 'button', class: 'cp-bt p crece', onclick: async () => { await agregarAlCarrito(ctx, m, d); repintar(); } }, 'Agregar al carrito')));
  refrescar();
  return nodo;
}

// Lo que no tiene código: elegís cuál de ese tipo (o suelto).
async function elegirProductoDeTipo(ctx, m, d, tipo) {
  const ps = d.productosDe(tipo.id);
  if (!ps.length) return m.productoSuelto(d, tipo);
  const { h } = ctx;
  const sel = h('select', { id: 'cp-cual' }, ps.map(p => h('option', { value: p.id }, `${p.nombre}${p.contenido && tipo.base !== 'u.' && p.marca ? ` (${cant(p.contenido, tipo.base)})` : ''}`)),
    h('option', { value: '' }, tipo.base === 'u.' ? 'Otro, sin marca' : 'Suelto (por peso)'));
  sel.value = d.preferido(tipo.id)?.id || '';
  const r = await hoja(ctx, tipo.nombre, h('div', { class: 'formulario-campos' }, h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, '¿Cuál agarraste?'), sel)),
    [{ texto: 'Cancelar' }, { texto: 'Seguir', clase: 'boton principal', valor: () => ({ id: sel.value }) }]);
  if (!r) return null;
  return r.id ? d.producto(r.id) : m.productoSuelto(d, tipo);
}

async function editarDelCarrito(ctx, m, d, x) {
  const base = d.baseDe(x.tipoId);
  const r = await ctx.formulario({
    titulo: x.nombre, textoGuardar: 'Guardar',
    campos: [
      { id: 'cantidad', etiqueta: x.contenido === 1 && base !== 'u.' ? `Cuánto (${base})` : 'Cantidad', tipo: 'numero', valor: x.cantidad },
      { id: 'precio', etiqueta: 'Precio', tipo: 'numero', valor: x.precio },
      { id: 'vence', etiqueta: 'Vence', tipo: 'fecha', valor: x.vence || '' },
      { id: 'lugar', etiqueta: 'Va a', tipo: 'seleccion', opciones: LUGARES.map(l => l[0]), valor: x.lugar || 'Alacena' },
      { id: 'sacar', etiqueta: 'Sacarlo del carrito', tipo: 'casilla' },
    ],
  });
  if (!r) return;
  if (r.sacar) return m.col.carrito.borrar(x.id);
  await m.col.carrito.actualizar(x.id, { cantidad: r.cantidad || 1, precio: r.precio || 0, vence: r.vence, lugar: r.lugar });
}

async function cancelarCompra(ctx, m, d) {
  if (!(await ctx.confirmar('¿Cancelar la compra? Se vacía el carrito y la lista queda como estaba.', { si: 'Cancelar la compra', no: 'Seguir', peligro: true }))) return;
  for (const x of d.carrito) await m.col.carrito.borrar(x.id);
  await m.guardarAjustes(d, { compraEnCurso: null });
  panel = null;
  ctx.navegar('compras');
}

export function pintarSuper(cuerpo, ctx, m, d, repintar) {
  const { h } = ctx;
  const enCurso = d.ajustes.compraEnCurso;
  if (!enCurso && !d.carrito.length) {
    poner(cuerpo, h('div', { class: 'vacio' }, h('h2', {}, 'No hay una compra en curso'),
      h('p', {}, 'Empezala desde la lista: así sabe qué te falta.'),
      h('button', { type: 'button', class: 'cp-bt p', onclick: () => empezarCompra(ctx, m, d) }, 'Empezar la compra')));
    return;
  }
  if (panel && !d.producto(panel.producto.id)) panel = null;
  const tot = d.carrito.reduce((a, x) => a + x.precio * x.cantidad, 0);
  const elegidos = enCurso?.items ? new Set(enCurso.items) : null;
  const faltan = d.lista.filter(x => (!elegidos || elegidos.has(x.id)) && d.falta(x) > 0);
  const quedan = d.lista.filter(x => elegidos && !elegidos.has(x.id)).length;
  const sectores = d.sectores.filter(s => faltan.some(x => d.sectorDe(x.tipoId) === s));

  const escanearUno = async () => {
    const c = await escanear(ctx);
    if (!c) return;
    const p = await productoDeCodigo(ctx, m, d, c);
    if (p) abrirPanel(await m.cargar(), p, repintar);
  };
  const sinCodigo = async () => {
    const r = await ctx.formulario({ titulo: 'Agregar sin código', textoGuardar: 'Seguir', campos: [{ id: 'nombre', etiqueta: '¿Qué agarraste?', tipo: 'texto', requerido: true, ayuda: 'Ej.: tomate, jamón cocido' }] });
    if (!r) return;
    const t = await tipoDeTexto(m, d, r.nombre[0].toUpperCase() + r.nombre.slice(1));
    const p = await elegirProductoDeTipo(ctx, m, d, t);
    if (p) abrirPanel(await m.cargar(), p, repintar);
  };
  const filaFalta = (x) => {
    const base = d.baseDe(x.tipoId), llevo = d.llevo(x.tipoId), env = d.envases(x.tipoId, d.falta(x));
    return fila(ctx, {
      emoji: d.emojiDe(x.tipoId), nombre: d.nombreDe(x.tipoId),
      chico: llevo ? `llevás ${cant(llevo, base)} · faltan ${cant(d.falta(x), base)}` : env ? `${env.n} de ${env.producto.nombre}` : '',
      clase: llevo ? 'a-medias' : '',
      der: h('span', { class: 'cp-q' }, cant(d.falta(x), base)),
      alTocar: async () => { const p = await elegirProductoDeTipo(ctx, m, d, d.tipo(x.tipoId)); if (p) abrirPanel(await m.cargar(), p, repintar); },
    });
  };

  poner(cuerpo,
    h('div', { class: 'cp-total' },
      h('div', {}, h('small', {}, `${enCurso?.super ? enCurso.super + ' · ' : ''}${d.carrito.length} productos`), h('b', {}, plata(tot))),
      h('div', { class: 'der' }, h('small', {}, 'Antes de descuentos'), h('a', { class: 'cp-bt ch', href: '#/compras/terminar' }, 'Terminar ›'))),
    h('div', { class: 'cp-cols' },
      h('div', { class: 'cp-col' },
        panel ? dibujarPanel(ctx, d, m, repintar) : [
          h('button', { type: 'button', class: 'cp-bt p grande', onclick: escanearUno }, iconoScan(ctx), 'Escanear un producto'),
          h('button', { type: 'button', class: 'cp-bt', onclick: sinCodigo }, 'Agregar sin código (fruta, verdura, fiambre…)'),
          h('p', { class: 'cp-sub' }, 'Si escaneás algo que no estaba en la lista, va directo al carrito como "fuera de lista".')],
        h('section', { class: 'cp-card apretada' }, h('h3', {}, 'En el carrito', h('small', {}, String(d.carrito.length))),
          d.carrito.length ? [...d.carrito].sort((a, b) => (b.creado || 0) - (a.creado || 0)).map(x => {
            const base = d.baseDe(x.tipoId), suelto = x.contenido === 1 && base !== 'u.' && !d.producto(x.productoId)?.codigo;
            return fila(ctx, { emoji: d.emojiDe(x.tipoId), nombre: x.nombre, chico: x.fueraDeLista ? 'fuera de lista' : '', alTocar: () => editarDelCarrito(ctx, m, d, x),
              der: [h('span', { class: 'cp-q' }, suelto ? `${cant(x.cantidad, base)} × ${plata(x.precio)}` : `${x.cantidad} × ${plata(x.precio)}`), h('b', { class: 'cp-imp' }, plata(x.precio * x.cantidad))] });
          }) : h('p', { class: 'cp-sub' }, 'Todavía nada. Escaneá lo primero que agarres.'))),
      h('div', { class: 'cp-col' },
        h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Te falta de la lista', h('small', {}, String(faltan.length))),
          faltan.length ? sectores.map(s => [grupo(ctx, s), faltan.filter(x => d.sectorDe(x.tipoId) === s).map(filaFalta)]) : h('p', { class: 'cp-sub' }, '¡Ya tenés todo!'),
          h('p', { class: 'cp-sub' }, 'Lo que no tiene código (fruta, verdura, fiambre) lo tocás acá y te pide el precio y cuánto llevás.'),
          h('div', { class: 'cp-fila' }, quedan ? h('span', { class: 'cp-sub crece' }, `${quedan} más quedan en la lista para otra compra.`) : null,
            h('button', { type: 'button', class: 'cp-bt ch', onclick: () => empezarCompra(ctx, m, d, { cambiar: true }) }, 'Cambiar qué compro acá'))),
        h('button', { type: 'button', class: 'cp-bt ch izq peligro', onclick: () => cancelarCompra(ctx, m, d) }, 'Cancelar la compra'))));
}

// ── Terminar la compra ──

export async function pintarTerminar(cuerpo, ctx, m, d) {
  const { h } = ctx;
  if (!d.carrito.length) {
    poner(cuerpo, h('div', { class: 'vacio' }, h('h2', {}, 'El carrito está vacío'), h('a', { class: 'cp-bt', href: '#/compras/super' }, '‹ Volver al súper')));
    return;
  }
  const hayFinanzas = await ctx.existeAccion('nuevo-gasto');
  const items = d.carrito.map(x => ({ ...x, descuento: Number(x.descuento) || 0 }));
  const bruto = items.reduce((a, x) => a + x.precio * x.cantidad, 0);
  const conDesc = () => items.reduce((a, x) => a + Math.max(0, x.precio * x.cantidad - x.descuento), 0);
  const tarjeta = () => num(opciones.descTarjeta);
  const final = () => Math.max(0, conDesc() - tarjeta());

  const vDescProd = h('span', {}), vDescTar = h('span', {}), vFinal = h('span', {}), vAhorro = h('span', { class: 'cp-tag verde izq' }), vFinanzas = h('span', {});
  const recalcular = () => {
    vDescProd.textContent = `− ${plata(bruto - conDesc())}`;
    vDescTar.textContent = `− ${plata(tarjeta())}`;
    vFinal.textContent = plata(final());
    vAhorro.textContent = `Ahorraste ${plata(bruto - final())}`;
    vFinanzas.textContent = `Cargar ${plata(final())} en Finanzas (elegís cuenta y categoría)`;
  };
  const filaDesc = (x) => {
    const det = h('small', {});
    const pintarDet = () => { const b = x.precio * x.cantidad; det.textContent = x.descuento ? `${plata(b)} − ${plata(x.descuento)} = ${plata(Math.max(0, b - x.descuento))}` : `${x.cantidad} × ${plata(x.precio)} = ${plata(b)}`; det.classList.toggle('verde', !!x.descuento); };
    pintarDet();
    return h('div', { class: 'cp-dsc' }, h('span', { class: 'cp-em' }, d.emojiDe(x.tipoId)), h('span', { class: 'cp-n' }, x.nombre, det),
      h('label', { class: 'cp-dsc-in' }, '− $', h('input', { inputmode: 'decimal', placeholder: '0', value: x.descuento || '', 'aria-label': `Descuento de ${x.nombre}`,
        oninput: (e) => { x.descuento = num(e.target.value); pintarDet(); recalcular(); },
        onchange: (e) => m.col.carrito.actualizar(x.id, { descuento: num(e.target.value) }) })));
  };

  let guardando = false;
  const guardar = async () => {
    if (guardando) return;
    guardando = true;
    try {
      for (const x of items) await m.col.carrito.actualizar(x.id, { descuento: x.descuento });
      d.carrito = items;
      const c = await m.guardarCompra(d, { descTarjeta: tarjeta(), aDespensa: opciones.aDespensa });
      opciones.descTarjeta = '';
      ctx.navegar('compras');
      ctx.aviso(`Compra guardada: ${plata(c.total)}`);
      if (hayFinanzas && opciones.aFinanzas && c.total > 0) {
        await ctx.pedir('nuevo-gasto', { importe: c.total, descripcion: `Súper${c.super ? ' · ' + c.super : ''}`, fecha: hoyISO() });
      }
    } finally { guardando = false; }
  };

  poner(cuerpo, h('div', { class: 'cp-cols' },
    h('div', { class: 'cp-col' },
      h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Descuentos por producto', h('small', {}, 'poné cuánto te descontaron')),
        items.map(filaDesc),
        h('p', { class: 'cp-sub' }, 'Mirá el ticket: si dice 2x1, 2da al 50% o lo que sea, poné el monto que te descontaron.'))),
    h('div', { class: 'cp-col' },
      h('section', { class: 'cp-card' }, h('h3', {}, 'Descuento de la tarjeta'),
        h('p', { class: 'cp-sub' }, 'Del banco, billetera o tarjeta de la cadena: el total que te descontaron.'),
        h('label', { class: 'cp-dsc-in grande' }, '− $', h('input', { id: 'cp-dtar', inputmode: 'decimal', placeholder: '0', value: opciones.descTarjeta, oninput: (e) => { opciones.descTarjeta = e.target.value; recalcular(); } })),
        h('div', { class: 'cp-cuenta' },
          h('div', {}, h('span', {}, 'Subtotal'), h('span', {}, plata(bruto))),
          h('div', { class: 'ahorro' }, h('span', {}, 'Descuentos de productos'), vDescProd),
          h('div', { class: 'ahorro' }, h('span', {}, 'Descuento de la tarjeta'), vDescTar),
          h('div', { class: 'tot' }, h('span', {}, 'Total pagado'), vFinal)),
        vAhorro,
        hayFinanzas ? h('label', { class: 'cp-fila sin-salto cp-casilla' }, h('input', { type: 'checkbox', checked: opciones.aFinanzas, onchange: (e) => { opciones.aFinanzas = e.target.checked; } }), vFinanzas) : null,
        h('label', { class: 'cp-fila sin-salto cp-casilla' }, h('input', { type: 'checkbox', checked: opciones.aDespensa, onchange: (e) => { opciones.aDespensa = e.target.checked; } }), h('span', {}, 'Sumar los productos a la Despensa (con sus vencimientos)')),
        h('button', { type: 'button', class: 'cp-bt p grande', onclick: guardar }, 'Guardar la compra')))));
  recalcular();
}
