// ─────────────────────────────────────────────────────────────
// Finanzas: formularios.
// ─────────────────────────────────────────────────────────────

import { hoy, plata, redondear, AJUSTE, mesActual, sumarMeses, nombreMes, mesDe } from './modelo.js';
import { hoja, campo, inputImporte, selectCuentas, selectorCategoria } from './comun.js';

const leerImporte = (input) => redondear(Number(String(input.value).replace(',', '.')));
const separar = (v) => (v ? { tipo: v.slice(0, 1), id: v.slice(2) } : { tipo: '', id: '' });

// Gasto, ingreso o transferencia (nuevo o editando uno existente).
export function abrirMovimiento(ctx, m, d, tipo, mov = null, base = {}) {
  const { h } = ctx;
  const v = { fecha: hoy(), importe: '', descripcion: '', ...base, ...(mov || {}) };
  if (mov) tipo = mov.tipo;
  const esAjuste = !!v.ajuste;

  const importe = inputImporte(ctx, v.importe);
  const fecha = h('input', { type: 'date', value: v.fecha });
  const descripcion = h('input', { type: 'text', value: v.descripcion || '', placeholder: 'Opcional', autocomplete: 'off' });
  const filas = [campo(ctx, 'Importe', importe)];
  let validar, armar;

  if (tipo === 'gasto') {
    const medio = selectCuentas(ctx, d, { tipos: ['cuenta', 'reserva'], creditos: true, valor: v.creditoId ? `t:${v.creditoId}` : v.cuentaId ? `c:${v.cuentaId}` : '' });
    const cuotas = h('input', { type: 'number', min: 1, max: 60, step: 1, inputmode: 'numeric', value: v.cuotas || 1 });
    const ayudaCuotas = h('span', { class: 'nota' });
    const filaCuotas = h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Cuotas'), cuotas, ayudaCuotas);
    const cat = esAjuste ? null : selectorCategoria(ctx, d, ['fijo', 'variable'], v.categoriaId || '');
    const actualizar = () => {
      const credito = medio.value.startsWith('t:');
      filaCuotas.hidden = !credito;
      const n = Math.max(1, Number(cuotas.value) || 1), imp = leerImporte(importe);
      ayudaCuotas.textContent = credito && n > 1 && imp > 0 ? `${n} cuotas de ${plata(imp / n)}, desde el resumen donde cae la compra` : '';
    };
    [medio, cuotas, importe].forEach(x => x.addEventListener('input', actualizar));
    filas.push(campo(ctx, 'Pagado con', medio), filaCuotas,
      esAjuste ? h('p', { class: 'nota' }, 'Categoría: Ajuste sin detalle') : h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Categoría'), cat.elemento));
    setTimeout(actualizar);
    validar = () => {
      if (!medio.value) return 'Elegí con qué se pagó. Si no hay cuentas, crealas desde Configurar Finanzas (⚙).';
      if (!esAjuste && !cat.valor()) return 'Elegí una categoría.';
    };
    armar = () => {
      const s = separar(medio.value);
      return {
        cuentaId: s.tipo === 'c' ? s.id : '', creditoId: s.tipo === 't' ? s.id : '',
        cuotas: s.tipo === 't' ? Math.max(1, Number(cuotas.value) || 1) : 1,
        categoriaId: esAjuste ? AJUSTE : cat.valor(),
      };
    };
  } else if (tipo === 'ingreso') {
    const cuenta = selectCuentas(ctx, d, { valor: v.cuentaId ? `c:${v.cuentaId}` : '' });
    const cat = esAjuste ? null : selectorCategoria(ctx, d, ['ingreso'], v.categoriaId || '');
    filas.push(campo(ctx, 'Entra a', cuenta),
      esAjuste ? h('p', { class: 'nota' }, 'Categoría: Ajuste sin detalle') : h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Categoría'), cat.elemento));
    validar = () => {
      if (!cuenta.value) return 'Elegí la cuenta. Si no hay, creala desde Configurar Finanzas (⚙).';
      if (!esAjuste && !cat.valor()) return 'Elegí una categoría.';
    };
    armar = () => ({ cuentaId: separar(cuenta.value).id, categoriaId: esAjuste ? AJUSTE : cat.valor() });
  } else if (tipo === 'transferencia') {
    const desde = selectCuentas(ctx, d, { valor: v.cuentaId ? `c:${v.cuentaId}` : '' });
    const hacia = selectCuentas(ctx, d, { creditos: true, pagarCredito: true, valor: v.destinoCreditoId ? `t:${v.destinoCreditoId}` : v.destinoId ? `c:${v.destinoId}` : '' });
    filas.push(h('div', { class: 'fz-dos' }, campo(ctx, 'Desde', desde), campo(ctx, 'Hacia', hacia)),
      h('p', { class: 'nota' }, 'Para pagar una tarjeta elegí "Pagar crédito" en Hacia. No cuenta como gasto: los gastos ya se anotaron al comprar.'));
    validar = () => {
      if (!desde.value || !hacia.value) return 'Elegí las dos cuentas.';
      if (desde.value === hacia.value) return 'Elegí cuentas distintas en Desde y Hacia.';
    };
    armar = () => {
      const s = separar(hacia.value);
      return { cuentaId: separar(desde.value).id, destinoId: s.tipo === 'c' ? s.id : '', destinoCreditoId: s.tipo === 't' ? s.id : '' };
    };
  } else {
    // Rendimiento o préstamo: solo se corrigen importe, fecha y descripción.
    validar = () => {};
    armar = () => ({});
    if (tipo === 'rendimiento') filas.push(h('p', { class: 'nota' }, 'Rendimiento de una inversión. Usá un importe negativo si fue una pérdida.'));
  }

  filas.push(h('div', { class: 'fz-dos' }, campo(ctx, 'Fecha', fecha), campo(ctx, 'Descripción', descripcion)));

  const TITULOS = { gasto: 'gasto', ingreso: 'ingreso', transferencia: 'transferencia', rendimiento: 'rendimiento', prestamo: 'movimiento de préstamo' };
  if (tipo === 'rendimiento') importe.removeAttribute('min');

  return hoja(ctx, {
    titulo: `${mov ? 'Editar' : 'Nuevo'} ${esAjuste ? 'ajuste' : TITULOS[tipo]}`,
    cuerpo: filas,
    alGuardar: async () => {
      const imp = leerImporte(importe);
      if (tipo === 'rendimiento' ? !imp : !(imp > 0)) return 'Escribí un importe mayor a cero.';
      if (!fecha.value) return 'Elegí una fecha.';
      const error = validar();
      if (error) return error;
      const datos = { tipo, fecha: fecha.value, importe: imp, descripcion: descripcion.value.trim(), ...armar() };
      if (mov) {
        await m.actualizar('movimientos', mov.id, datos);
        ctx.aviso('Movimiento guardado');
      } else {
        await m.col.movimientos.crear(datos);
        ctx.aviso({ gasto: 'Gasto guardado', ingreso: 'Ingreso guardado', transferencia: 'Transferencia guardada' }[tipo] || 'Guardado');
      }
    },
  });
}

// Ajustar el saldo de una cuenta al valor real.
export function abrirAjuste(ctx, m, d, cuenta) {
  const { h } = ctx;
  const saldo = d.saldo(cuenta.id);
  const real = inputImporte(ctx, '', String(saldo));
  real.removeAttribute('min');
  const resultado = h('p', { class: 'nota fz-resultado' });
  real.addEventListener('input', () => {
    if (real.value === '') { resultado.textContent = ''; return; }
    const dif = redondear(leerImporte(real) - saldo);
    resultado.textContent = !dif ? 'No hay diferencia: no se crea ningún movimiento.'
      : dif < 0 ? `Se crea un gasto de ${plata(-dif)} con motivo "Ajuste".` : `Se crea un ingreso de ${plata(dif)} con motivo "Ajuste".`;
  });
  return hoja(ctx, {
    titulo: `Ajustar ${cuenta.nombre}`,
    cuerpo: [h('p', {}, 'Saldo en la app: ', h('b', { class: 'num' }, plata(saldo))), campo(ctx, '¿Cuánto tenés realmente?', real), resultado],
    textoGuardar: 'Ajustar',
    alGuardar: async () => {
      if (real.value === '') return 'Escribí el saldo real.';
      const dif = await m.ajustarSaldo(d, cuenta, leerImporte(real));
      ctx.aviso(dif ? `Ajuste de ${plata(Math.abs(dif))} guardado` : 'Sin diferencia');
    },
  });
}

// Presupuesto de un gasto fijo, con historial.
export function abrirPresupuesto(ctx, m, d, cat, mesVista) {
  const { h } = ctx;
  const monto = inputImporte(ctx, d.presupuesto(cat, mesVista) || '');
  const actual = mesActual();
  const desde = h('select', {}, h('option', { value: actual }, `Este mes (${nombreMes(actual, false).toLowerCase()})`),
    h('option', { value: sumarMeses(actual, 1) }, `El mes que viene (${nombreMes(sumarMeses(actual, 1), false).toLowerCase()})`));
  return hoja(ctx, {
    titulo: `Presupuesto de ${cat.nombre}`,
    cuerpo: [campo(ctx, 'Nuevo presupuesto mensual', monto), campo(ctx, 'Aplica desde', desde),
      h('p', { class: 'nota' }, 'El valor anterior queda en el historial y los meses pasados conservan el suyo.')],
    alGuardar: async () => {
      if (!(leerImporte(monto) >= 0) || monto.value === '') return 'Escribí el presupuesto.';
      await m.cambiarPresupuesto(cat, leerImporte(monto), desde.value);
      ctx.aviso('Presupuesto actualizado');
    },
  });
}

export function abrirActualizarInversion(ctx, m, d, cuenta) {
  const { h } = ctx;
  const saldo = inputImporte(ctx, '', String(d.saldo(cuenta.id)));
  return hoja(ctx, {
    titulo: `Actualizar ${cuenta.nombre}`,
    cuerpo: [h('p', {}, 'Saldo en la app: ', h('b', { class: 'num' }, plata(d.saldo(cuenta.id)))), campo(ctx, 'Saldo actual de la inversión', saldo),
      h('p', { class: 'nota' }, 'La diferencia se registra como rendimiento (ganancia o pérdida), no como ingreso.')],
    textoGuardar: 'Actualizar',
    alGuardar: async () => {
      if (saldo.value === '') return 'Escribí el saldo actual.';
      const dif = await m.actualizarInversion(d, cuenta, leerImporte(saldo));
      ctx.aviso(dif ? `Rendimiento de ${dif > 0 ? '+' : '−'}${plata(Math.abs(dif))} guardado` : 'Sin cambios');
    },
  });
}

export function abrirPrestamo(ctx, m, d) {
  const { h } = ctx;
  const persona = h('input', { type: 'text', placeholder: 'Ej. Juan, Banco Nación', autocomplete: 'off' });
  const sentido = h('select', {}, h('option', { value: 'me-deben' }, 'Presté plata (me deben)'), h('option', { value: 'debo' }, 'Me prestaron (debo)'));
  const monto = inputImporte(ctx);
  const cuenta = selectCuentas(ctx, d, { tipos: ['cuenta', 'reserva'] });
  const etiquetaCuenta = h('span', { class: 'etiqueta-campo' }, 'Sale de');
  sentido.addEventListener('change', () => { etiquetaCuenta.textContent = sentido.value === 'me-deben' ? 'Sale de' : 'Entra a'; });
  const fecha = h('input', { type: 'date', value: hoy() });
  const notas = h('input', { type: 'text', placeholder: 'Opcional: cuotas, interés…', autocomplete: 'off' });
  return hoja(ctx, {
    titulo: 'Nuevo préstamo',
    cuerpo: [campo(ctx, 'Persona o entidad', persona), campo(ctx, 'Tipo', sentido), campo(ctx, 'Monto', monto),
      h('label', { class: 'fila-campo' }, etiquetaCuenta, cuenta), h('div', { class: 'fz-dos' }, campo(ctx, 'Fecha', fecha), campo(ctx, 'Notas', notas)),
      h('p', { class: 'nota' }, 'Mueve la plata de la cuenta, pero no cuenta como gasto ni como ingreso del mes.')],
    alGuardar: async () => {
      if (!persona.value.trim()) return 'Escribí la persona o entidad.';
      if (!(leerImporte(monto) > 0)) return 'Escribí el monto.';
      if (!cuenta.value) return 'Elegí la cuenta.';
      await m.crearPrestamo({ persona: persona.value.trim(), sentido: sentido.value, monto: leerImporte(monto), cuentaId: cuenta.value.slice(2), fecha: fecha.value || hoy(), notas: notas.value.trim() });
      ctx.aviso('Préstamo guardado');
    },
  });
}

export function abrirPagoPrestamo(ctx, m, d, p) {
  const { h } = ctx;
  const { falta } = d.estadoPrestamo(p);
  const importe = inputImporte(ctx, '', String(falta));
  const cuenta = selectCuentas(ctx, d, { tipos: ['cuenta', 'reserva'], valor: `c:${p.cuentaId}` });
  const fecha = h('input', { type: 'date', value: hoy() });
  const cobro = p.sentido === 'me-deben';
  return hoja(ctx, {
    titulo: cobro ? `Cobro de ${p.persona}` : `Pago a ${p.persona}`,
    cuerpo: [h('p', {}, 'Falta: ', h('b', { class: 'num' }, plata(falta))), campo(ctx, 'Importe', importe),
      campo(ctx, cobro ? 'Entra a' : 'Sale de', cuenta), campo(ctx, 'Fecha', fecha)],
    alGuardar: async () => {
      if (!(leerImporte(importe) > 0)) return 'Escribí el importe.';
      if (!cuenta.value) return 'Elegí la cuenta.';
      await m.registrarPagoPrestamo(p, leerImporte(importe), cuenta.value.slice(2), fecha.value || hoy());
      ctx.aviso(cobro ? 'Cobro registrado' : 'Pago registrado');
    },
  });
}

// Corregir las fechas de cierre y vencimiento de un resumen.
export function abrirFechasResumen(ctx, m, d, credito, mes) {
  const { h } = ctx;
  const f = d.fechasResumen(credito, mes);
  const cierre = h('input', { type: 'date', value: f.cierre });
  const vencimiento = h('input', { type: 'date', value: f.vencimiento });
  return hoja(ctx, {
    titulo: `${d.nombreCredito(credito)}: resumen de ${nombreMes(mes, false).toLowerCase()}`,
    cuerpo: [h('div', { class: 'fz-dos' }, campo(ctx, 'Cierre', cierre), campo(ctx, 'Vencimiento', vencimiento)),
      h('p', { class: 'nota' }, f.sugeridas ? 'Son fechas sugeridas. Al corregirlas, los meses siguientes se sugieren a partir de estas.' : 'Fechas corregidas por vos.')],
    alGuardar: async () => {
      if (!cierre.value || !vencimiento.value) return 'Completá las dos fechas.';
      if (vencimiento.value < cierre.value) return 'El vencimiento tiene que ser después del cierre.';
      if (mesDe(cierre.value) !== mes) return `El cierre tiene que caer en ${nombreMes(mes, false).toLowerCase()}.`;
      await m.actualizar('creditos', credito.id, { fechas: { ...(credito.fechas || {}), [mes]: { cierre: cierre.value, vencimiento: vencimiento.value } } });
      ctx.aviso('Fechas guardadas');
    },
  });
}
