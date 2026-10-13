// ─────────────────────────────────────────────────────────────
// Finanzas → Tareas: recordatorios de pago.
//
// Cada gasto fijo con día de vencimiento y cada tarjeta pueden tener
// un recordatorio { on, dias }. Con el recordatorio prendido, Finanzas
// le pide a Tareas (por mensaje, sin tocar su código) una tarea en el
// área "Sistemas":
//   "Pagar Luz · $ 25.000"  fecha = vencimiento, aparece X días antes.
// Cuando el pago queda registrado en Finanzas, la tarea se completa sola.
//
// Clave de cada tarea: finanzas:fijo:<categoría>:<AAAA-MM>
//                      finanzas:tarjeta:<tarjeta>:<AAAA-MM del resumen>
// Se mira el mes actual y el siguiente (y los meses viejos que todavía
// tengan su tarea pendiente, por si se pagan tarde).
// ─────────────────────────────────────────────────────────────

import { crearModelo, plata, mesActual, sumarMeses, diaDelMes, mesDe, redondear } from './modelo.js';
import { abrirMovimiento } from './formularios.js';
import { cargarEstilos } from './comun.js';

const PREFIJO = 'finanzas:';
export const DIAS_POR_DEFECTO = 3;

// Recordatorio de un gasto fijo: los de débito automático arrancan apagados.
export function recordatorioFijo(cat) {
  const r = cat.recordatorio;
  if (r && typeof r === 'object') return { on: !!r.on, dias: Number.isFinite(Number(r.dias)) ? Number(r.dias) : DIAS_POR_DEFECTO };
  return { on: !cat.automatico, dias: DIAS_POR_DEFECTO };
}
export function recordatorioTarjeta(cr) {
  const r = cr.recordatorio;
  if (r && typeof r === 'object') return { on: !!r.on, dias: Number.isFinite(Number(r.dias)) ? Number(r.dias) : DIAS_POR_DEFECTO };
  return { on: true, dias: DIAS_POR_DEFECTO };
}

const restarDias = (fecha, n) => {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(a, m - 1, d - n);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

// Estado de un gasto fijo en un mes.
function estadoFijo(d, cat, mes) {
  const f = d.fijosDelMes(mes).find(x => x.cat.id === cat.id);
  const presupuesto = f?.presupuesto || 0;
  const pagado = presupuesto > 0 ? (f?.falta || 0) <= 0 : (f?.gastado || 0) > 0;
  return { presupuesto, falta: f?.falta ?? presupuesto, pagado };
}

// Lo que tiene que existir en Tareas para un ítem y un mes (o null).
function tareaFijo(d, cat, mes) {
  if (!cat.dia) return null;
  const rec = recordatorioFijo(cat);
  const fecha = diaDelMes(mes, cat.dia);
  const e = estadoFijo(d, cat, mes);
  return {
    clave: `${PREFIJO}fijo:${cat.id}:${mes}`,
    titulo: `Pagar ${cat.nombre}${e.presupuesto ? ` · ${plata(e.presupuesto)}` : ''}`,
    fecha, inicio: rec.dias > 0 ? restarDias(fecha, rec.dias) : '',
    hecha: e.pagado,
  };
}

function tareaTarjeta(d, cr, resumen) {
  const rec = recordatorioTarjeta(cr);
  const fecha = resumen.vencimiento;
  return {
    clave: `${PREFIJO}tarjeta:${cr.id}:${resumen.mes}`,
    titulo: `Pagar ${d.nombreCredito ? d.nombreCredito(cr) : cr.nombre} · ${plata(resumen.total)}`,
    fecha, inicio: rec.dias > 0 ? restarDias(fecha, rec.dias) : '',
    hecha: resumen.pendiente <= 0,
  };
}

// Busca el ítem de una clave. Devuelve { tipo, item, mes } o null.
function deClave(d, clave) {
  const [, tipo, id, mes] = String(clave).split(':');
  if (tipo === 'fijo') { const cat = d.categoria(id); return cat ? { tipo, item: cat, mes } : null; }
  if (tipo === 'tarjeta') { const cr = d.credito(id); return cr ? { tipo, item: cr, mes } : null; }
  return null;
}

function tareaDeClave(d, clave) {
  const x = deClave(d, clave);
  if (!x) return null;
  if (x.tipo === 'fijo') {
    if (x.item.archivada || x.item.tipo !== 'fijo' || !recordatorioFijo(x.item).on) return null;
    return tareaFijo(d, x.item, x.mes);
  }
  if (x.item.archivado || !recordatorioTarjeta(x.item).on) return null;
  const r = d.resumenes(x.item.id).find(y => y.mes === x.mes);
  return r && r.total > 0 ? tareaTarjeta(d, x.item, r) : null;
}

// Arma la lista completa de tareas que tienen que existir.
function tareasDeseadas(d, pendientes) {
  const meses = [mesActual(), sumarMeses(mesActual(), 1)];
  const lista = new Map();
  for (const cat of d.categoriasDe('fijo')) {
    if (!recordatorioFijo(cat).on) continue;
    for (const mes of meses) { const t = tareaFijo(d, cat, mes); if (t) lista.set(t.clave, t); }
  }
  for (const cr of d.creditosActivos()) {
    if (!recordatorioTarjeta(cr).on) continue;
    for (const r of d.resumenes(cr.id)) {
      if (!meses.includes(mesDe(r.vencimiento)) || r.total <= 0) continue;
      const t = tareaTarjeta(d, cr, r);
      lista.set(t.clave, t);
    }
  }
  // Tareas viejas que siguen pendientes: se mantienen (y se completan si ya se pagó).
  for (const clave of pendientes) {
    if (lista.has(clave)) continue;
    const t = tareaDeClave(d, clave);
    if (t) lista.set(clave, t);
  }
  return [...lista.values()];
}

// ── Sincronizar con Tareas ──
let corriendo = false;
let otraVez = false;

export async function sincronizarRecordatorios(ctx) {
  if (corriendo) { otraVez = true; return; }
  corriendo = true;
  try {
    if (!await ctx.existeAccion?.('sistema-sincronizar')) return;   // sin Tareas, no hay nada que hacer
    const d = await crearModelo(ctx).cargar();
    const pendientes = (await ctx.pedir('sistema-pendientes', { prefijo: PREFIJO })) || [];
    const tareas = tareasDeseadas(d, pendientes);
    await ctx.pedir('sistema-sincronizar', { modulo: 'finanzas', prefijo: PREFIJO, tareas });
  } catch (e) {
    console.warn('No se pudieron actualizar los recordatorios de Finanzas', e);
  } finally {
    corriendo = false;
    if (otraVez) { otraVez = false; setTimeout(() => sincronizarRecordatorios(ctx), 300); }
  }
}

// ── Lo que Tareas le pregunta a Finanzas ──

export async function estadoRecordatorio(ctx, { clave }) {
  const d = await crearModelo(ctx).cargar();
  const t = tareaDeClave(d, clave);
  const x = deClave(d, clave);
  if (!x) return { existe: false, pagado: true };
  return { existe: true, pagado: t ? t.hecha : true };
}

// Abre el formulario de pago con todo completo. Devuelve true si se guardó.
export async function pagarRecordatorio(ctx, { clave }) {
  cargarEstilos();
  const m = crearModelo(ctx);
  const d = await m.cargar();
  const x = deClave(d, clave);
  if (!x) throw new Error('Ese gasto ya no existe en Finanzas.');
  if (x.tipo === 'fijo') {
    const e = estadoFijo(d, x.item, x.mes);
    return !!(await abrirMovimiento(ctx, m, d, 'gasto', null, { categoriaId: x.item.id, importe: e.falta > 0 ? e.falta : '' }));
  }
  const r = d.resumenes(x.item.id).find(y => y.mes === x.mes);
  const fondo = d.fondo();
  return !!(await abrirMovimiento(ctx, m, d, 'transferencia', null, {
    cuentaId: fondo?.id || '', destinoCreditoId: x.item.id, importe: r ? redondear(r.pendiente) : '',
  }));
}
