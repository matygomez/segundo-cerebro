// ─────────────────────────────────────────────────────────────
// Compras › ⚙ Ajustes: catálogo de productos, orden de los sectores
// y los súpers que usás.
//   #/compras/ajustes        lista
//   #/compras/ajustes/<id>   ficha de un producto, sola en la pantalla
// ─────────────────────────────────────────────────────────────

import { plata, normal, fechaCorta, cant, num, LUGARES } from './modelo.js';
import { poner, fila, grupo, elegirTipo } from './comun.js';

const ui = { filtro: 'Todos', texto: '' };
const FILTROS = ['Todos', 'Míos', 'Del sistema', 'Sin precio', 'Sin tamaño'];

export function pintarAjustes(cuerpo, ctx, m, d, repintar, sub) {
  if (sub[1]) return pintarFicha(cuerpo, ctx, m, d, sub[1]);
  const { h } = ctx;
  const lista = h('div', {});
  const dibujarLista = () => {
    let l = [...d.productos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (ui.filtro === 'Míos') l = l.filter(p => p.origen !== 'off');
    if (ui.filtro === 'Del sistema') l = l.filter(p => p.origen === 'off');
    if (ui.filtro === 'Sin precio') l = l.filter(p => !d.ultimoPrecio(p.id));
    if (ui.filtro === 'Sin tamaño') l = l.filter(p => !p.contenido || (p.contenido === 1 && d.baseDe(p.tipoId) !== 'u.' && p.codigo));
    const t = normal(ui.texto);
    if (t) l = l.filter(p => normal(`${p.nombre} ${p.marca} ${p.codigo} ${d.nombreDe(p.tipoId)}`).includes(t));
    poner(lista, grupo(ctx, `${l.length} productos`, 'último precio'),
      l.length ? l.map(p => fila(ctx, {
        emoji: d.emojiDe(p.tipoId), nombre: p.nombre, chico: `${d.nombreDe(p.tipoId)} · ${p.codigo || d.baseDe(p.tipoId) === 'u.' ? cant(p.contenido || 1, d.baseDe(p.tipoId)) : 'suelto'}`,
        alTocar: () => ctx.navegar(`compras/ajustes/${p.id}`),
        der: [h('span', { class: `cp-tagc ${p.origen === 'off' ? 'gris' : 'lat'}` }, p.origen === 'off' ? 'sistema' : 'mío'),
          h('span', { class: 'cp-q' }, d.ultimoPrecio(p.id) ? plata(d.ultimoPrecio(p.id).precio) : '—')],
      })) : h('p', { class: 'cp-sub' }, d.productos.length ? 'Nada con ese filtro.' : 'Todavía no hay productos. Se cargan solos al escanear.'));
  };
  dibujarLista();

  const nuevo = async () => {
    const r = await ctx.formulario({ titulo: 'Producto nuevo', textoGuardar: 'Seguir', campos: [
      { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ayuda: 'Ej.: Leche Sancor Entera 750 ml' }, { id: 'marca', etiqueta: 'Marca', tipo: 'texto' },
      { id: 'codigo', etiqueta: 'Código de barras', tipo: 'texto' }] });
    if (!r) return;
    const p = await elegirTipo(ctx, m, d, { ...r, origen: 'mio' });
    if (p) ctx.navegar(`compras/ajustes/${p.id}`);
  };

  // Orden de los sectores: como recorrés el súper.
  const orden = [...d.sectores];
  const mover = async (i, k) => { [orden[i], orden[i + k]] = [orden[i + k], orden[i]]; await m.guardarAjustes(d, { sectores: orden }); };
  const supers = Object.entries(d.ajustes.sectoresPorSuper || {});

  poner(cuerpo, h('div', { class: 'cp-cols' },
    h('div', { class: 'cp-col' },
      h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Productos', h('small', {}, String(d.productos.length))),
        h('input', { type: 'search', id: 'cp-buscar-prod', class: 'cp-buscar', placeholder: 'Buscar producto, marca, tipo o código…', value: ui.texto, oninput: (e) => { ui.texto = e.target.value; dibujarLista(); } }),
        h('div', { class: 'cp-filtros' }, FILTROS.map(x => h('button', { type: 'button', class: ui.filtro === x ? 'sel' : '', onclick: () => { ui.filtro = x; repintar(); } }, x))),
        lista, h('button', { type: 'button', class: 'cp-bt ch izq', onclick: nuevo }, '+ Producto nuevo'))),
    h('div', { class: 'cp-col' },
      h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Orden de los sectores', h('small', {}, 'como recorrés el súper')),
        orden.map((s, i) => h('div', { class: 'cp-lc fija' }, h('span', { class: 'cp-n' }, s),
          h('button', { type: 'button', class: 'cp-menos', disabled: i === 0, 'aria-label': `Subir ${s}`, onclick: () => mover(i, -1) }, '↑'),
          h('button', { type: 'button', class: 'cp-menos', disabled: i === orden.length - 1, 'aria-label': `Bajar ${s}`, onclick: () => mover(i, 1) }, '↓')))),
      h('section', { class: 'cp-card' }, h('h3', {}, 'Súpers que usás'),
        supers.length ? supers.map(([n, s]) => h('div', { class: 'cp-lc fija' }, h('span', { class: 'cp-n' }, n[0].toUpperCase() + n.slice(1), h('small', {}, s.length ? s.join(', ') : '—')),
          h('button', { type: 'button', class: 'cp-bt ch', onclick: async () => { const x = { ...d.ajustes.sectoresPorSuper }; delete x[n]; await m.guardarAjustes(d, { sectoresPorSuper: x }); } }, 'Olvidar')))
          : h('p', { class: 'cp-sub' }, 'Se arma solo: al empezar cada compra se acuerda qué sectores comprás en cada lugar.')))));
}

function pintarFicha(cuerpo, ctx, m, d, id) {
  const { h } = ctx;
  const p = d.producto(id);
  const volver = h('a', { class: 'cp-bt ch izq', href: '#/compras/ajustes' }, '‹ Ajustes');
  if (!p) { poner(cuerpo, h('div', { class: 'cp-angosto' }, volver, h('p', { class: 'cp-sub' }, 'Este producto ya no existe.'))); return; }
  const t = d.tipo(p.tipoId), base = t?.base || 'u.';

  const guardarP = (k) => (e) => m.col.productos.actualizar(p.id, { [k]: e.target.value.trim() });
  const guardarT = (k) => (e) => t && m.col.tipos.actualizar(t.id, { [k]: e.target.value.trim() });
  const campo = (et, valor, alCambiar, extra = {}) => h('label', {}, et, h('input', { type: 'text', value: valor || '', onchange: alCambiar, ...extra }));
  const selec = (et, valor, opciones, alCambiar) => { const s = h('select', { onchange: alCambiar }, opciones.map(o => Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))); s.value = valor || ''; return h('label', {}, et, s); };
  // El contenido se escribe en la unidad cómoda (750 ml) y se guarda en la base del tipo (0,75 L).
  const chica = base === 'L' ? 'ml' : base === 'kg' ? 'g' : '';
  const enChica = chica && (p.contenido || 1) < 1;
  const contenido = h('input', { type: 'text', inputmode: 'decimal', value: String(enChica ? (p.contenido || 1) * 1000 : (p.contenido || 1)).replace('.', ','), 'aria-label': 'Contenido' });
  const unidad = h('select', { 'aria-label': 'Unidad del contenido' }, (chica ? [chica, base] : ['u.']).map(u => h('option', { value: u }, u)));
  unidad.value = enChica ? chica : base;
  const guardarContenido = () => { const v = num(contenido.value); if (v > 0) m.col.productos.actualizar(p.id, { contenido: unidad.value === chica ? v / 1000 : v }); };
  contenido.addEventListener('change', guardarContenido);
  unidad.addEventListener('change', guardarContenido);
  const tipoIn = h('input', { type: 'text', value: t?.nombre || '', list: 'cp-tipos-ficha', onchange: async (e) => {
    const nombre = e.target.value.trim();
    if (!nombre || nombre === t?.nombre) return;
    const nuevo = await m.asegurarTipo(d, nombre, { base, emoji: t?.emoji, sector: t?.sector, lugar: t?.lugar });
    await m.col.productos.actualizar(p.id, { tipoId: nuevo.id });
  } });

  const precios = d.precios(p.id);
  const porBase = (precio) => base !== 'u.' && p.contenido ? ` · ${plata(precio / p.contenido)}/${base}` : '';
  const hermanos = d.productosDe(p.tipoId).filter(x => x.id !== p.id);
  const cd = t ? d.consumoDiario(t.id) : 0;
  const veces = d.compras.filter(c => (c.items || []).some(it => it.productoId === p.id)).length;
  const esPreferido = d.preferido(p.tipoId)?.id === p.id;

  const unir = async () => {
    const otros = d.productos.filter(x => x.id !== p.id).sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (!otros.length) return;
    const r = await ctx.formulario({ titulo: `Unir ${p.nombre}`, textoGuardar: 'Unir', campos: [
      { id: 'con', etiqueta: 'Es el mismo que…', tipo: 'seleccion', requerido: true, opciones: otros.map(x => ({ valor: x.id, texto: x.nombre })), valor: hermanos[0]?.id || otros[0].id }] });
    if (!r?.con) return;
    const queda = d.producto(r.con);
    if (!(await ctx.confirmar(`Todo lo de "${p.nombre}" (precios y compras) pasa a "${queda.nombre}". ¿Seguimos?`, { si: 'Unir' }))) return;
    await m.unir(d, p.id, queda.id);
    ctx.navegar(`compras/ajustes/${queda.id}`);
  };
  const borrar = async () => {
    if (!(await ctx.confirmar(`¿Borrar "${p.nombre}"? Las compras viejas quedan guardadas.`, { si: 'Borrar', peligro: true }))) return;
    await m.col.productos.borrar(p.id);
    ctx.navegar('compras/ajustes');
  };

  poner(cuerpo, h('div', { class: 'cp-angosto' }, volver,
    h('section', { class: 'cp-card' },
      h('h3', {}, h('input', { class: 'cp-emoji', value: t?.emoji || '', maxlength: 4, 'aria-label': 'Emoji', onchange: guardarT('emoji') }), p.nombre),
      h('div', { class: 'cp-ficha' },
        campo('Nombre', p.nombre, guardarP('nombre')),
        h('label', {}, 'Tipo (sin marca ni tamaño)', tipoIn, h('datalist', { id: 'cp-tipos-ficha' }, d.tipos.map(x => h('option', { value: x.nombre })))),
        h('label', {}, 'Contenido', h('span', { class: 'cp-fila sin-salto' }, contenido, unidad)),
        campo('Marca', p.marca, guardarP('marca')),
        campo('Código de barras', p.codigo, guardarP('codigo'), { inputmode: 'numeric', placeholder: '— (sin código)' }),
        selec('Sector del súper', t?.sector, d.sectores, guardarT('sector')),
        selec('Se guarda en', t?.lugar, LUGARES.map(l => l[0]), guardarT('lugar')),
        campo('Dura abierto / fresco', p.duracion, guardarP('duracion'), { placeholder: 'Ej.: 10 días' }),
        selec('El tipo se cuenta en', base, [['u.', 'unidades'], ['kg', 'kilos'], ['L', 'litros']], guardarT('base')),
        h('label', {}, 'Origen', h('input', { value: p.origen === 'off' ? 'Open Food Facts' : 'Cargado por vos', disabled: true }))),
      h('label', { class: 'cp-fila sin-salto cp-casilla' }, h('input', { type: 'checkbox', checked: esPreferido, onchange: (e) => t && m.col.tipos.actualizar(t.id, { preferidoId: e.target.checked ? p.id : '' }) }),
        h('span', {}, `Es mi ${t?.nombre?.toLowerCase() || 'producto'} de siempre (el que aparece en la lista)`)),
      h('p', { class: 'cp-sub' }, 'El tipo junta todas las marcas y tamaños: la lista, la despensa y las recetas cuentan en litros, kilos o unidades, y los precios se comparan por litro o kilo.'),
      h('span', { class: 'cp-et' }, 'Precios que pagaste'),
      precios.length ? precios.slice(0, 8).map(x => h('div', { class: 'cp-lc fija' }, h('span', { class: 'cp-n' }, `${fechaCorta(x.fecha)}${x.super ? ' · ' + x.super : ''}`), h('b', { class: 'cp-imp' }, plata(x.precio) + porBase(x.precio))))
        : h('p', { class: 'cp-sub' }, 'Todavía no lo compraste.'),
      h('span', { class: 'cp-et' }, 'Otros del mismo tipo'),
      hermanos.length ? hermanos.map(x => { const u = d.ultimoPrecio(x.id); return fila(ctx, { emoji: d.emojiDe(x.tipoId), nombre: x.nombre, alTocar: () => ctx.navegar(`compras/ajustes/${x.id}`),
        der: h('b', { class: 'cp-imp' }, u ? plata(u.precio) + (base !== 'u.' && x.contenido ? ` · ${plata(u.precio / x.contenido)}/${base}` : '') : '—') }); })
        : h('p', { class: 'cp-sub' }, 'Ninguno todavía.'),
      h('span', { class: 'cp-et' }, 'Consumo'),
      h('p', { class: 'cp-sub' }, [cd ? `Unos ${cant(cd * 30, base)} por mes (de este tipo)` : 'Sin datos de consumo todavía', `comprado ${veces} ${veces === 1 ? 'vez' : 'veces'}`, t ? `en casa: ${cant(d.stock(t.id), base)}` : ''].filter(Boolean).join(' · ')),
      h('div', { class: 'cp-fila' },
        t ? h('button', { type: 'button', class: 'cp-bt ch', onclick: async () => { await m.agregarALista(d, t); ctx.aviso('Agregado a la lista'); } }, '+ A la lista') : null,
        h('button', { type: 'button', class: 'cp-bt ch', onclick: unir }, 'Unir con otro producto'),
        h('button', { type: 'button', class: 'cp-bt ch peligro', onclick: borrar }, 'Borrar')))));
}
