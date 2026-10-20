// Compras: piezas que usan varias pantallas.

import { buscarCodigo } from './externos.js';
import { normal, num, cant, adivinar, tipoDesdeNombre, leerContenido, BASES } from './modelo.js';

export function cargarEstilos() {
  if (document.getElementById('estilos-compras')) return;
  const l = document.createElement('link');
  l.id = 'estilos-compras'; l.rel = 'stylesheet';
  l.href = new URL('./compras.css', import.meta.url).href;
  document.head.append(l);
}

export const poner = (el, ...hijos) => el.replaceChildren(...hijos.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));

// Fila de un listado compacto: emoji, nombre (con una línea chica abajo) y lo de la derecha.
export function fila(ctx, { clase = '', emoji = '', nombre, chico = '', der = [], alTocar, antes = null }) {
  const { h } = ctx;
  return h('div', { class: `cp-lc ${clase}`, onclick: alTocar || null },
    antes, h('span', { class: 'cp-em' }, emoji || '🛒'),
    h('span', { class: 'cp-n' }, nombre, chico ? h('small', {}, chico) : null), der);
}

export function grupo(ctx, texto, der = '') {
  return ctx.h('div', { class: 'cp-grupo' }, texto, der !== '' ? ctx.h('span', {}, String(der)) : null);
}

// Ventana simple hecha a mano (para lo que el formulario común no alcanza).
export function hoja(ctx, titulo, contenido, botones) {
  const { h } = ctx;
  return new Promise((ok) => {
    let res = null;
    const dlg = h('dialog', { class: 'hoja cp' },
      h('header', { class: 'hoja-cabecera' }, h('h2', {}, titulo),
        h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, ctx.icono('cerrar'))),
      contenido,
      h('div', { class: 'hoja-botones' }, botones.map(b => h('button', { type: 'button', class: b.clase || 'boton', onclick: () => { const v = b.valor ? b.valor() : null; if (v === false) return; res = v; dlg.close(); } }, b.texto))));
    dlg.addEventListener('close', () => { dlg.remove(); ok(res); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

// Palabras en común entre dos nombres (para proponer el tipo).
const parecido = (a, b) => { const x = new Set(normal(a).split(' ').filter(w => w.length > 2)); return normal(b).split(' ').filter(w => w.length > 2 && x.has(w)).length; };

// Pregunta a qué tipo pertenece un producto nuevo y cuánto trae.
// Si en la lista hay algo parecido, lo propone primero: "¿Va por la leche de tu lista?".
export async function elegirTipo(ctx, m, d, datos) {
  const { h } = ctx;
  const enLista = d.lista.map(x => d.tipo(x.tipoId)).filter(Boolean);
  const otros = d.tipos.filter(t => !enLista.includes(t)).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const sugerido = [...enLista, ...otros].map(t => ({ t, p: parecido(datos.nombre, t.nombre) })).filter(x => x.p > 0).sort((a, b) => b.p - a.p)[0]?.t || null;
  const nombreTipo = datos.tipoNombre || tipoDesdeNombre(datos.nombre, datos.marca);
  const c0 = datos.contenido ? { contenido: datos.contenido, base: datos.base } : leerContenido(datos.nombre);
  const sel = h('select', { id: 'cp-tipo' },
    enLista.length ? h('optgroup', { label: 'De tu lista' }, enLista.map(t => h('option', { value: t.id }, t.nombre))) : null,
    otros.length ? h('optgroup', { label: 'Otros tipos' }, otros.map(t => h('option', { value: t.id }, t.nombre))) : null,
    h('option', { value: '' }, '+ Tipo nuevo…'));
  sel.value = sugerido?.id || '';
  const nuevo = h('input', { type: 'text', id: 'cp-tipo-nuevo', value: nombreTipo, placeholder: 'Ej.: Leche entera' });
  const contenido = h('input', { type: 'text', id: 'cp-contenido', inputmode: 'decimal', value: c0 ? String(c0.base === 'u.' ? c0.contenido : c0.contenido < 1 ? c0.contenido * 1000 : c0.contenido).replace('.', ',') : '1' });
  const unidad = h('select', { id: 'cp-unidad' }, [['u.', 'unidades'], ['g', 'gramos'], ['kg', 'kilos'], ['ml', 'ml'], ['L', 'litros']].map(([v, t]) => h('option', { value: v }, t)));
  unidad.value = c0 ? (c0.base === 'u.' ? 'u.' : c0.base === 'L' ? (c0.contenido < 1 ? 'ml' : 'L') : (c0.contenido < 1 ? 'g' : 'kg')) : (adivinar(datos.nombre).base === 'kg' ? 'kg' : adivinar(datos.nombre).base === 'L' ? 'L' : 'u.');
  const filaNuevo = h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Nombre del tipo (sin marca ni tamaño)'), nuevo);
  const aviso = h('p', { class: 'cp-sub' });
  const actualizar = () => {
    filaNuevo.hidden = !!sel.value;
    const t = d.tipo(sel.value);
    aviso.textContent = t && enLista.includes(t) ? `✓ Cuenta para "${t.nombre}" de tu lista. La próxima vez lo reconoce solo.` : '';
  };
  sel.addEventListener('change', actualizar);
  actualizar();
  const r = await hoja(ctx, datos.nombre, h('div', { class: 'formulario-campos' },
    h('p', { class: 'cp-sub' }, sugerido && enLista.includes(sugerido) ? `¿Va por "${sugerido.nombre}" de tu lista?` : '¿Qué es? Así se cuenta junto con otras marcas y tamaños.'),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Es'), sel), filaNuevo, aviso,
    h('div', { class: 'cp-fila sin-salto' }, h('label', { class: 'fila-campo crece' }, h('span', { class: 'etiqueta-campo' }, 'Cada uno trae'), contenido), h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, ' '), unidad))),
  [{ texto: 'Cancelar' }, { texto: 'Listo', clase: 'boton principal', valor: () => ({ tipoId: sel.value, nuevo: nuevo.value.trim(), contenido: num(contenido.value), unidad: unidad.value }) }]);
  if (!r) return null;
  const base = r.unidad === 'g' || r.unidad === 'kg' ? 'kg' : r.unidad === 'ml' || r.unidad === 'L' ? 'L' : 'u.';
  const enBase = (r.unidad === 'g' || r.unidad === 'ml') ? r.contenido / 1000 : r.contenido;
  let tipo = d.tipo(r.tipoId);
  if (!tipo) tipo = await m.asegurarTipo(d, r.nuevo || nombreTipo, { base, emoji: datos.emoji, sector: datos.sector, lugar: datos.lugar });
  // Si el tipo cuenta en otra base (ej. el tipo va en kilos y pusiste unidades), se guarda tal cual: manda el tipo.
  return m.crearProducto(d, { ...datos, tipoId: tipo.id, contenido: enBase || 1 });
}

// Del código leído al producto: catálogo propio → Open Food Facts → a mano.
export async function productoDeCodigo(ctx, m, d, codigo) {
  const ya = d.porCodigo(codigo);
  if (ya) return ya;
  const espera = ctx.aviso('Buscando el producto…', { duracion: 0 });
  const off = await buscarCodigo(codigo);
  espera.remove();
  if (off) return elegirTipo(ctx, m, d, off);
  const r = await ctx.formulario({
    titulo: 'Producto nuevo', textoGuardar: 'Seguir',
    campos: [
      { id: 'nombre', etiqueta: `No conozco el código ${codigo}. ¿Qué es?`, tipo: 'texto', requerido: true, ayuda: 'Ej.: Yerba Playadito 1 kg' },
      { id: 'marca', etiqueta: 'Marca (opcional)', tipo: 'texto' },
    ],
  });
  if (!r?.nombre?.trim()) return null;
  const g = adivinar(r.nombre);
  return elegirTipo(ctx, m, d, { nombre: r.nombre.trim(), marca: r.marca, codigo, origen: 'mio', emoji: g.emoji, sector: g.sector, lugar: g.lugar });
}

// "Tipo" a partir de lo que escribís: si existe se usa, si no se crea.
export async function tipoDeTexto(m, d, texto) { return d.tipoPorNombre(texto) || m.asegurarTipo(d, texto); }

export { cant, BASES };
