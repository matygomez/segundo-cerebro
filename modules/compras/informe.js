// ─────────────────────────────────────────────────────────────
// Compras › Informe del mes (gastos, promos, lo tirado, precios,
// dónde conviene) con un resumen escrito por Gemini.
// Acá también vive la tarjeta "Lista del mes" que se muestra en Lista.
// ─────────────────────────────────────────────────────────────

import { plata, cant, hoyISO, num, aBase, baseDeUnidad, MESES, sumarDias } from './modelo.js';
import { poner, fila, hoja } from './comun.js';

const ui = { mes: '', verMes: false, acepto: {}, guardarBase: true, tipoGrafico: '' };
const mesDe = (iso) => iso.slice(0, 7);
const nombreMes = (ym) => { const [a, mm] = ym.split('-').map(Number); return `${MESES[mm - 1]} ${a}`; };
const correrMes = (ym, k) => { const [a, mm] = ym.split('-').map(Number); const f = new Date(a, mm - 1 + k, 1); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; };
const neto = (it) => Math.max(0, it.precio * it.cantidad - (it.descuento || 0));

// ── Lista del mes (lista base) ──

export function tarjetaBase(ctx, m, d, repintar) {
  const { h } = ctx;
  const mes = hoyISO().slice(0, 7), nMes = MESES[Number(mes.slice(5)) - 1];
  if (!d.base.length) {
    if (!d.compras.length) return null;
    return h('section', { class: 'cp-card cp-mes' }, h('h3', {}, 'Lista del mes'),
      h('p', { class: 'cp-sub' }, 'Armá tu lista base: lo que comprás todos los meses. Cada mes la app la ajusta con lo que consumiste, te queda y tiraste.'),
      h('button', { type: 'button', class: 'cp-bt', onclick: () => editarBase(ctx, m, d) }, 'Armar la lista base'));
  }
  if (d.ajustes.mesArmado === mes && !ui.verMes) {
    return h('div', { class: 'cp-fila cp-mes-listo' }, h('span', { class: 'cp-sub crece' }, `✓ Lista de ${nMes} sumada`),
      h('button', { type: 'button', class: 'cp-bt ch', onclick: () => editarBase(ctx, m, d) }, 'Editar la base'));
  }
  const rev = d.revisionBase();
  const nuevos = d.faltaComidas().filter(f => !d.base.some(b => b.tipoId === f.tipoId)).map(f => ({ tipo: d.tipo(f.tipoId), base: 0, nuevo: f.cantidad, motivo: 'Para las comidas del mes', esNuevo: true }));
  const filas = [...rev, ...nuevos].filter(x => x.tipo);
  const cambios = filas.filter(x => Math.abs(x.nuevo - x.base) > 1e-9).length;
  const acepta = (x) => ui.acepto[x.tipo.id] !== false;

  if (!ui.verMes) {
    return h('section', { class: 'cp-card cp-mes' }, h('h3', {}, `Lista del mes · ${nMes}`, h('small', {}, `${cambios} cambio${cambios === 1 ? '' : 's'} sugerido${cambios === 1 ? '' : 's'}`)),
      h('p', { class: 'cp-sub' }, 'Tu lista base de todos los meses, ajustada con lo que consumiste, te queda, tiraste y tus comidas.'),
      h('div', { class: 'cp-fila' }, h('button', { type: 'button', class: 'cp-bt p crece', onclick: () => { ui.verMes = true; repintar(); } }, 'Revisar y sumar a la lista'),
        h('button', { type: 'button', class: 'cp-bt', onclick: () => editarBase(ctx, m, d) }, 'Editar la base')));
  }
  const sumar = async () => {
    for (const x of filas) {
      const c = acepta(x) ? x.nuevo : x.base;
      if (c > 1e-9) await m.agregarALista(d, x.tipo, { cantidad: c });
      if (ui.guardarBase && acepta(x) && !x.esNuevo && Math.abs(x.nuevo - x.base) > 1e-9) {
        if (x.nuevo > 0) await m.col.base.actualizar(x.item.id, { cantidad: x.nuevo }); else await m.col.base.borrar(x.item.id);
      }
    }
    ui.verMes = false;
    await m.guardarAjustes(d, { mesArmado: mes });
    ctx.aviso(`Lista de ${nMes} sumada`);
  };
  return h('section', { class: 'cp-card cp-mes apretada' }, h('h3', {}, `Lista del mes · ${nMes}`, h('small', {}, `${cambios} cambios sugeridos`)),
    h('div', { class: 'cp-grupo' }, 'Tipo', h('span', {}, 'Base → Este mes')),
    filas.map(x => {
      const b = x.tipo.base, igual = Math.abs(x.nuevo - x.base) < 1e-9;
      const color = x.nuevo === 0 ? 'rojo' : x.nuevo > x.base ? 'verde' : 'lat';
      return h('label', { class: 'cp-rev' },
        h('input', { type: 'checkbox', checked: acepta(x), disabled: igual, onchange: (e) => { ui.acepto[x.tipo.id] = e.target.checked; } }),
        h('span', { class: 'cp-em' }, x.tipo.emoji), h('span', { class: 'cp-n' }, x.tipo.nombre, x.motivo ? h('small', {}, x.motivo) : null),
        igual ? h('span', { class: 'nuevo' }, cant(x.base, b)) : [x.base ? h('span', { class: 'base' }, cant(x.base, b)) : null, h('span', { class: `nuevo ${color}` }, x.nuevo === 0 ? 'sacar' : cant(x.nuevo, b))]);
    }),
    h('p', { class: 'cp-sub' }, 'Destildá los cambios que no querés: queda lo de la base.'),
    h('label', { class: 'cp-fila sin-salto cp-casilla' }, h('input', { type: 'checkbox', checked: ui.guardarBase, onchange: (e) => { ui.guardarBase = e.target.checked; } }), h('span', {}, 'Guardar los cambios aceptados también en la lista base')),
    h('div', { class: 'cp-fila' }, h('button', { type: 'button', class: 'cp-bt p crece', onclick: sumar }, 'Sumar a la lista'),
      h('button', { type: 'button', class: 'cp-bt', onclick: () => { ui.verMes = false; repintar(); } }, 'Cerrar')));
}

// Editor de la lista base: cantidades, quitar y agregar.
async function editarBase(ctx, m, d) {
  const { h } = ctx;
  const filas = d.base.map(b => ({ id: b.id, tipoId: b.tipoId, cantidad: b.cantidad, quitar: false }));
  // Si está vacía, se propone con lo más comprado de los últimos 60 días.
  if (!filas.length) {
    const desde = sumarDias(hoyISO(), -60), tot = new Map();
    for (const c of d.compras) if (c.fecha >= desde) for (const it of c.items || []) tot.set(it.tipoId, (tot.get(it.tipoId) || 0) + it.cantidad * (it.contenido || 1));
    for (const [tipoId, c] of [...tot].sort((a, b) => b[1] - a[1]).slice(0, 25)) if (d.tipo(tipoId)) filas.push({ tipoId, cantidad: Math.round(c / 2 * 1000) / 1000, nueva: true });
  }
  const cont = h('div', { class: 'cp-elegir' });
  const nombre = h('input', { type: 'text', placeholder: 'Agregar… (ej.: Yerba)', list: 'cp-tipos-base', 'aria-label': 'Agregar a la base' });
  const cantidad = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Cant.', 'aria-label': 'Cantidad', class: 'corto' });
  const unidad = h('select', { 'aria-label': 'Unidad' }, ['u.', 'kg', 'g', 'L', 'ml'].map(u => h('option', { value: u }, u)));
  const dibujar = () => poner(cont, filas.filter(f => !f.quitar).map(f => h('div', { class: 'cp-lc fija' },
    h('span', { class: 'cp-em' }, d.emojiDe(f.tipoId)), h('span', { class: 'cp-n' }, d.nombreDe(f.tipoId)),
    h('input', { class: 'corto', inputmode: 'decimal', value: String(f.cantidad).replace('.', ','), 'aria-label': `Cantidad de ${d.nombreDe(f.tipoId)}`, oninput: (e) => { f.cantidad = num(e.target.value); } }),
    h('span', { class: 'cp-q' }, d.baseDe(f.tipoId)),
    h('button', { type: 'button', class: 'cp-x', 'aria-label': 'Quitar', onclick: () => { f.quitar = true; dibujar(); } }, '✕'))));
  dibujar();
  const agregar = async () => {
    if (!nombre.value.trim()) return;
    const t = d.tipoPorNombre(nombre.value) || await m.asegurarTipo(d, nombre.value.trim(), { base: baseDeUnidad(unidad.value) });
    filas.push({ tipoId: t.id, cantidad: aBase(num(cantidad.value) || 1, unidad.value), nueva: true });
    nombre.value = ''; cantidad.value = '';
    dibujar();
  };
  const ok = await hoja(ctx, 'Lista base del mes', h('div', { class: 'formulario-campos' },
    h('p', { class: 'cp-sub' }, filas.some(f => f.nueva) && !d.base.length ? 'Te la propongo con lo que más compraste. Ajustá las cantidades (por mes).' : 'Lo que comprás todos los meses, en kilos, litros o unidades.'),
    cont,
    h('div', { class: 'cp-fila sin-salto' }, nombre, h('datalist', { id: 'cp-tipos-base' }, d.tipos.map(t => h('option', { value: t.nombre }))), cantidad, unidad,
      h('button', { type: 'button', class: 'cp-bt ch', onclick: agregar }, '+'))),
  [{ texto: 'Cancelar' }, { texto: 'Guardar', clase: 'boton principal', valor: () => true }]);
  if (!ok) return;
  for (const f of filas) {
    if (f.id && (f.quitar || !f.cantidad)) await m.col.base.borrar(f.id);
    else if (f.id) await m.col.base.actualizar(f.id, { cantidad: f.cantidad });
    else if (!f.quitar && f.cantidad) await m.col.base.crear({ tipoId: f.tipoId, cantidad: f.cantidad });
  }
  ctx.aviso('Lista base guardada');
}

// ── Informe ──

function numerosDelMes(d, ym) {
  const compras = d.compras.filter(c => mesDe(c.fecha) === ym);
  const items = compras.flatMap(c => (c.items || []).map(it => ({ ...it, super: c.super })));
  const tiros = d.consumo.filter(x => x.tipo === 'tiro' && mesDe(x.fecha) === ym);
  const porSector = new Map(), porSuper = new Map(), porTipo = new Map();
  for (const it of items) {
    porSector.set(d.sectorDe(it.tipoId), (porSector.get(d.sectorDe(it.tipoId)) || 0) + neto(it));
    porTipo.set(it.tipoId, (porTipo.get(it.tipoId) || 0) + it.cantidad * (it.contenido || 1));
  }
  for (const c of compras) porSuper.set(c.super || 'Sin nombre', (porSuper.get(c.super || 'Sin nombre') || 0) + (c.total || 0));
  const fuera = items.filter(i => i.fueraDeLista);
  return {
    compras, gastado: compras.reduce((a, c) => a + (c.total || 0), 0), ahorro: compras.reduce((a, c) => a + (c.ahorro || 0), 0),
    bruto: compras.reduce((a, c) => a + (c.bruto || 0), 0), tirado: tiros.reduce((a, x) => a + (x.valor || 0), 0), tiros,
    fuera: fuera.reduce((a, i) => a + neto(i), 0), nFuera: fuera.length,
    porSector: [...porSector].sort((a, b) => b[1] - a[1]), porSuper: [...porSuper].sort((a, b) => b[1] - a[1]), porTipo: [...porTipo].sort((a, b) => b[1] - a[1]),
  };
}

// Lo que más subió: último precio por L/kg del mes contra el último de antes.
function subas(d, ym) {
  const r = [];
  for (const t of d.tipos) {
    const p = d.preciosBase(t.id);
    // Se compara el más barato por L/kg de cada período, así cambiar de marca o tamaño no cuenta como suba.
    const min = (l) => l.length ? l.reduce((m, x) => (x.porBase < m.porBase ? x : m)) : null;
    const ultimoAntes = p.find(x => mesDe(x.fecha) < ym);
    const ahora = min(p.filter(x => mesDe(x.fecha) === ym)), antes = ultimoAntes && min(p.filter(x => mesDe(x.fecha) === mesDe(ultimoAntes.fecha)));
    if (!ahora || !antes || !antes.porBase) continue;
    const pct = Math.round((ahora.porBase / antes.porBase - 1) * 100);
    if (pct) r.push({ t, antes: antes.porBase, ahora: ahora.porBase, pct });
  }
  return r.sort((a, b) => b.pct - a.pct);
}

// Cuánto saldría la lista actual en cada súper, con el último precio por L/kg de cada uno.
function dondeConviene(d) {
  const desde = sumarDias(hoyISO(), -120), precio = new Map();
  for (const c of [...d.compras].reverse()) {
    if (c.fecha < desde || !c.super) continue;
    for (const it of c.items || []) if (it.precio && it.contenido) precio.set(`${c.super}|${it.tipoId}`, it.precio / it.contenido);
  }
  const supers = [...new Set(d.compras.filter(c => c.fecha >= desde && c.super).map(c => c.super))];
  const items = d.lista;
  return supers.map(s => {
    let total = 0, tiene = 0;
    for (const x of items) { const p = precio.get(`${s}|${x.tipoId}`); if (p) { total += p * x.cantidad; tiene++; } }
    return { super: s, total, tiene };
  }).filter(x => items.length && x.tiene >= Math.max(1, Math.ceil(items.length * 0.6))).sort((a, b) => a.total - b.total);
}

function grafico(valores, etiquetas) {
  const W = 380, H = 150, P = 50, n = valores.length;
  const ok = valores.filter(v => v != null);
  if (ok.length < 2) return null;
  const mx = Math.max(...ok) * 1.08, mn = Math.min(...ok) * 0.92;
  const x = (i) => P + i * (W - P - 14) / Math.max(1, n - 1), y = (v) => H - 26 - ((v - mn) / (mx - mn || 1)) * (H - 44);
  let g = '';
  for (let k = 0; k <= 2; k++) { const v = mn + (mx - mn) * k / 2; g += `<line x1="${P}" x2="${W - 14}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linea)"/><text x="${P - 6}" y="${y(v) + 4}" fill="var(--tinta-2)" font-size="11" text-anchor="end">${Math.round(v).toLocaleString('es-AR')}</text>`; }
  etiquetas.forEach((e, i) => { g += `<text x="${x(i)}" y="${H - 6}" fill="var(--tinta-2)" font-size="11" text-anchor="middle">${e}</text>`; });
  const pts = valores.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
  g += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('')}" fill="none" stroke="var(--laton)" stroke-width="2.4"/>`;
  const u = pts[pts.length - 1];
  g += `<circle cx="${u[0]}" cy="${u[1]}" r="4" fill="var(--laton)"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Precio en el tiempo">${g}</svg>`;
}

export async function pintarInforme(cuerpo, ctx, m, d, repintar) {
  const { h } = ctx;
  const ym = ui.mes || hoyISO().slice(0, 7);
  const n = numerosDelMes(d, ym), ant = numerosDelMes(d, correrMes(ym, -1));
  const variacion = ant.gastado ? Math.round((n.gastado / ant.gastado - 1) * 100) : null;
  const resumen = (d.ajustes.resumenes || {})[ym];
  const barras = (lista, clase = '') => { const mx = Math.max(1, ...lista.map(x => x[1])); return lista.map(([nom, v]) => h('div', { class: 'cp-barra' }, h('span', { class: 'n' }, nom), h('span', { class: 'b' }, h('i', { class: clase, style: `width:${(v / mx * 100).toFixed(1)}%` })), h('b', {}, plata(v)))); };

  const escribirResumen = async (boton) => {
    if (!(await ctx.existeAccion('gemini-preguntar')) || !(await ctx.pedir('gemini-hay-clave').catch(() => false))) { ctx.aviso('Falta la clave de Gemini: se carga en Configurar Bitácora.'); return; }
    boton.disabled = true; boton.textContent = 'Escribiendo…';
    const datos = {
      mes: nombreMes(ym), gastado: Math.round(n.gastado), mesAnterior: Math.round(ant.gastado), ahorroEnPromos: Math.round(n.ahorro), tirado: Math.round(n.tirado),
      fueraDeLista: Math.round(n.fuera), compras: n.compras.length,
      porSector: n.porSector.map(([s, v]) => ({ s, v: Math.round(v) })), porSectorAnterior: ant.porSector.map(([s, v]) => ({ s, v: Math.round(v) })),
      porSuper: n.porSuper.map(([s, v]) => ({ s, v: Math.round(v) })), tirados: n.tiros.map(x => ({ que: d.nombreDe(x.tipoId), motivo: x.motivo, valor: x.valor })),
      subas: subas(d, ym).slice(0, 5).map(x => ({ que: x.t.nombre, pct: x.pct })), dondeConviene: dondeConviene(d).map(x => ({ s: x.super, total: Math.round(x.total) })),
    };
    try {
      const r = await ctx.pedir('gemini-preguntar', { texto: `Sos un asistente de compras del hogar en Argentina. Con estos datos del mes escribí un resumen corto (4 a 6 oraciones, en español rioplatense, de vos, sin títulos ni viñetas) que diga cómo fue el gasto contra el mes anterior y por qué, qué subió, qué se tiró y un consejo concreto para ahorrar. Usá montos con $ y puntos de miles. Datos: ${JSON.stringify(datos)}` });
      const texto = (r?.texto || '').trim();
      if (texto) await m.guardarAjustes(d, { resumenes: { ...(d.ajustes.resumenes || {}), [ym]: texto } });
    } catch (e) {
      ctx.aviso(/503|satur|overload/i.test(String(e)) ? 'Gemini está saturado, probá en un rato.' : `No se pudo escribir: ${e.message || e}`, { duracion: 6000 });
    } finally { repintar(); }
  };

  // Precio de un tipo en los últimos 6 meses (promedio por L/kg/u.).
  const conPrecios = d.tipos.filter(t => d.preciosBase(t.id).length);
  const masComprado = n.porTipo[0]?.[0] || ant.porTipo[0]?.[0];
  const tg = d.tipo(ui.tipoGrafico) || d.tipo(masComprado) || conPrecios[0];
  let graf = null, notaGraf = '';
  if (tg) {
    const meses = Array.from({ length: 6 }, (_, i) => correrMes(ym, i - 5));
    const p = d.preciosBase(tg.id);
    const vals = meses.map(mm => { const l = p.filter(x => mesDe(x.fecha) === mm); return l.length ? l.reduce((a, x) => a + x.porBase, 0) / l.length : null; });
    graf = grafico(vals, meses.map(mm => MESES[Number(mm.slice(5)) - 1].slice(0, 3)));
    const porProd = new Map();
    for (const x of p) if (!porProd.has(x.productoId)) porProd.set(x.productoId, x.porBase);
    notaGraf = [...porProd].map(([id, v]) => `${d.producto(id)?.nombre || '?'}: ${plata(v)}/${tg.base}`).slice(0, 3).join(' · ');
  }
  const selTipo = h('select', { 'aria-label': 'Producto del gráfico', onchange: (e) => { ui.tipoGrafico = e.target.value; repintar(); } }, conPrecios.map(t => h('option', { value: t.id }, t.nombre)));
  if (tg) selTipo.value = tg.id;
  const sub = subas(d, ym).slice(0, 5), donde = dondeConviene(d);

  poner(cuerpo,
    h('div', { class: 'cp-fila' }, h('div', { class: 'cp-seg' },
      h('button', { type: 'button', 'aria-label': 'Mes anterior', onclick: () => { ui.mes = correrMes(ym, -1); repintar(); } }, '‹'),
      h('b', {}, nombreMes(ym)),
      h('button', { type: 'button', 'aria-label': 'Mes siguiente', disabled: ym >= hoyISO().slice(0, 7), onclick: () => { ui.mes = correrMes(ym, 1); repintar(); } }, '›'))),
    h('div', { class: 'cp-kpis' },
      h('div', { class: 'cp-kpi' }, h('small', {}, 'Gastado en compras'), h('b', {}, plata(n.gastado)), variacion !== null ? h('em', { class: variacion > 0 ? 'rojo' : 'verde' }, `${variacion > 0 ? '▲' : '▼'} ${Math.abs(variacion)}% vs ${MESES[Number(correrMes(ym, -1).slice(5)) - 1]}`) : h('em', {}, `${n.compras.length} compras`)),
      h('div', { class: 'cp-kpi' }, h('small', {}, 'Ahorrado en promos'), h('b', {}, plata(n.ahorro)), h('em', { class: 'verde' }, n.bruto ? `${Math.round(n.ahorro / n.bruto * 100)}% de lo comprado` : '—')),
      h('div', { class: 'cp-kpi' }, h('small', {}, 'Tirado'), h('b', {}, plata(n.tirado)), h('em', { class: n.tiros.length ? 'rojo' : '' }, `${n.tiros.length} producto${n.tiros.length === 1 ? '' : 's'}`)),
      h('div', { class: 'cp-kpi' }, h('small', {}, 'Fuera de lista'), h('b', {}, plata(n.fuera)), h('em', {}, n.gastado ? `${Math.round(n.fuera / n.gastado * 100)}% · ${n.nFuera} productos` : '—'))),
    h('section', { class: 'cp-card cp-mes' }, h('h3', {}, '✦ Resumen del mes', h('small', {}, 'escrito por Gemini')),
      resumen ? h('p', { class: 'cp-resumen' }, resumen) : h('p', { class: 'cp-sub' }, n.compras.length ? 'Gemini lee los números del mes y te lo cuenta en pocas líneas.' : 'Todavía no hay compras este mes.'),
      n.compras.length ? h('button', { type: 'button', class: 'cp-bt ch izq', onclick: (e) => escribirResumen(e.currentTarget) }, resumen ? 'Escribirlo de nuevo' : '✦ Escribir el resumen') : null),
    h('div', { class: 'cp-cols' },
      h('div', { class: 'cp-col' },
        h('section', { class: 'cp-card' }, h('h3', {}, 'Por sector'), n.porSector.length ? barras(n.porSector) : h('p', { class: 'cp-sub' }, 'Sin compras.')),
        h('section', { class: 'cp-card' }, h('h3', {}, 'Por súper', h('small', {}, `${n.compras.length} compras`)), n.porSuper.length ? barras(n.porSuper, 'azul') : h('p', { class: 'cp-sub' }, 'Sin compras.')),
        h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Lo que tiraste'),
          n.tiros.length ? n.tiros.map(x => fila(ctx, { emoji: d.emojiDe(x.tipoId), nombre: d.nombreDe(x.tipoId), chico: `${cant(x.cantidad, d.baseDe(x.tipoId))} · ${x.motivo || ''}`, der: h('b', { class: 'cp-imp' }, plata(x.valor)) }))
            : h('p', { class: 'cp-sub' }, 'Nada. 👏'))),
      h('div', { class: 'cp-col' },
        h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Lo que más subió', h('small', {}, 'precio por L, kg o unidad')),
          sub.length ? sub.map(x => fila(ctx, { emoji: x.t.emoji, nombre: x.t.nombre, chico: `${plata(x.antes)} → ${plata(x.ahora)}/${x.t.base}`, der: h('span', { class: `cp-tag ${x.pct > 0 ? 'rojo' : 'verde'}` }, `${x.pct > 0 ? '+' : ''}${x.pct}%`) }))
            : h('p', { class: 'cp-sub' }, 'Hace falta más de un mes de compras para comparar.')),
        tg ? h('section', { class: 'cp-card' }, h('h3', {}, 'Precio en el tiempo', h('small', {}, `por ${tg.base === 'L' ? 'litro' : tg.base === 'kg' ? 'kilo' : 'unidad'}`)), selTipo,
          graf ? h('div', { class: 'cp-graf', html: graf }) : h('p', { class: 'cp-sub' }, 'Todavía hay un solo mes de precios.'), notaGraf ? h('p', { class: 'cp-sub' }, notaGraf) : null) : null,
        h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Dónde conviene', h('small', {}, 'tu lista, últimos precios')),
          donde.length ? donde.map((x, i) => h('div', { class: 'cp-lc fija' }, h('span', { class: 'cp-n' }, x.super, x.tiene < d.lista.length ? h('small', {}, `con precio para ${x.tiene} de ${d.lista.length}`) : null), h('b', { class: 'cp-imp' }, plata(x.total)),
            i ? h('span', { class: 'cp-dif rojo' }, `+${plata(x.total - donde[0].total)}`) : h('span', { class: 'cp-tagc verde' }, 'más barato')))
            : h('p', { class: 'cp-sub' }, 'Cuando compres en más de un lugar, acá ves dónde te sale más barata tu lista.')),
        h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Lo más comprado'),
          n.porTipo.length ? n.porTipo.slice(0, 6).map(([id, c]) => fila(ctx, { emoji: d.emojiDe(id), nombre: d.nombreDe(id), der: h('span', { class: 'cp-q' }, cant(c, d.baseDe(id))) }))
            : h('p', { class: 'cp-sub' }, 'Sin compras.')))));
}
