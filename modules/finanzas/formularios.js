// ─────────────────────────────────────────────────────────────
// Finanzas: formularios.
// ─────────────────────────────────────────────────────────────

import { hoy, plata, redondear, AJUSTE, mesActual, sumarMeses, nombreMes, mesDe } from './modelo.js';
import { hoja, campo, inputImporte, selectCuentas, selectorCategoria, poner } from './comun.js';

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
    const valorMedio = v.creditoId ? `t:${v.creditoId}` : v.sinDescontar ? 'y:' : v.cuentaId ? `c:${v.cuentaId}` : '';
    const medio = selectCuentas(ctx, d, { tipos: ['cuenta', 'reserva'], creditos: true, valor: valorMedio, yaHecho: esAjuste ? null : 'Ya pagado' });
    const cuotas = h('input', { type: 'number', min: 1, max: 60, step: 1, inputmode: 'numeric', value: v.cuotas || 1 });
    const ayudaCuotas = h('span', { class: 'nota' });
    const filaCuotas = h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Cuotas'), cuotas, ayudaCuotas);
    // Compra con tarjeta cargada después: las cuotas que ya vencieron se toman como pagadas.
    const vencidas = h('input', { type: 'checkbox', checked: !!v.pagadasHasta || !!v.cuotasPagadas });
    const filaVencidas = h('label', { class: 'fila-campo casilla' }, vencidas,
      h('span', { class: 'etiqueta-campo' }, 'Las cuotas vencidas ya están pagadas', h('br'),
        h('span', { class: 'nota' }, 'Solo las que vencieron hasta hoy. Las que vencen después siguen siendo deuda hasta que registres el pago.')));
    const cat = esAjuste ? null : selectorCategoria(ctx, d, ['fijo', 'variable'], v.categoriaId || '');
    const actualizar = () => {
      const credito = medio.value.startsWith('t:');
      filaCuotas.hidden = !credito;
      let vieja = false;
      if (credito && fecha.value) {
        const cr = d.credito(medio.value.slice(2));
        vieja = cr && d.mesResumenDe(cr, fecha.value) < d.mesResumenDe(cr, hoy());
      }
      filaVencidas.hidden = !vieja;
      const n = Math.max(1, Number(cuotas.value) || 1), imp = leerImporte(importe);
      ayudaCuotas.textContent = credito && n > 1 && imp > 0 ? `${n} cuotas de ${plata(imp / n)}, desde el resumen donde cae la compra` : '';
    };
    [medio, cuotas, importe, fecha].forEach(x => x.addEventListener('input', actualizar));
    filas.push(campo(ctx, 'Pagado con', medio, esAjuste ? null : '"Ya pagado" (al final de la lista) es para gastos que hiciste antes: suman al mes pero no tocan ninguna cuenta.'),
      filaCuotas, filaVencidas,
      esAjuste ? h('p', { class: 'nota' }, 'Categoría: Ajuste sin detalle') : h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Categoría'), cat.elemento));
    setTimeout(actualizar);
    validar = () => {
      if (!medio.value) return 'Elegí con qué se pagó. Si no hay cuentas, crealas desde Configurar Finanzas (⚙).';
      if (!esAjuste && !cat.valor()) return 'Elegí una categoría.';
    };
    armar = () => {
      const s = separar(medio.value);
      const credito = s.tipo === 't';
      return {
        cuentaId: s.tipo === 'c' ? s.id : '', creditoId: credito ? s.id : '',
        cuotas: credito ? Math.max(1, Number(cuotas.value) || 1) : 1,
        pagadasHasta: credito && !filaVencidas.hidden && vencidas.checked ? (v.pagadasHasta || hoy()) : '',
        cuotasPagadas: 0,
        sinDescontar: s.tipo === 'y',
        categoriaId: esAjuste ? AJUSTE : cat.valor(),
      };
    };
  } else if (tipo === 'ingreso') {
    const cuenta = selectCuentas(ctx, d, { valor: v.sinDescontar ? 'y:' : v.cuentaId ? `c:${v.cuentaId}` : '', yaHecho: esAjuste ? null : 'Ya sumado' });
    const cat = esAjuste ? null : selectorCategoria(ctx, d, ['ingreso'], v.categoriaId || '');
    filas.push(campo(ctx, 'Entra a', cuenta, esAjuste ? null : '"Ya sumado" (al final de la lista) es para ingresos que cobraste antes: suman al mes pero no tocan ninguna cuenta.'),
      esAjuste ? h('p', { class: 'nota' }, 'Categoría: Ajuste sin detalle') : h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Categoría'), cat.elemento));
    validar = () => {
      if (!cuenta.value) return 'Elegí la cuenta. Si no hay, creala desde Configurar Finanzas (⚙).';
      if (!esAjuste && !cat.valor()) return 'Elegí una categoría.';
    };
    armar = () => {
      const s = separar(cuenta.value);
      return { cuentaId: s.tipo === 'c' ? s.id : '', categoriaId: esAjuste ? AJUSTE : cat.valor(), sinDescontar: s.tipo === 'y' };
    };
  } else if (tipo === 'transferencia') {
    const desde = selectCuentas(ctx, d, { valor: v.sinDescontar ? 'y:' : v.cuentaId ? `c:${v.cuentaId}` : '', yaHecho: 'Ya hecha' });
    const hacia = selectCuentas(ctx, d, { creditos: true, pagarCredito: true, valor: v.destinoCreditoId ? `t:${v.destinoCreditoId}` : v.destinoId ? `c:${v.destinoId}` : '' });
    filas.push(h('div', { class: 'fz-dos' }, campo(ctx, 'Desde', desde), campo(ctx, 'Hacia', hacia)),
      h('p', { class: 'nota' }, 'Para pagar una tarjeta elegí "Pagar crédito" en Hacia: no cuenta como gasto, porque los gastos se anotaron al comprar. "Ya hecha" (en Desde) es para transferencias de antes: quedan registradas pero no mueven saldos.'));
    validar = () => {
      if (!desde.value || !hacia.value) return 'Elegí las dos cuentas.';
      if (desde.value === hacia.value) return 'Elegí cuentas distintas en Desde y Hacia.';
    };
    armar = () => {
      const o = separar(desde.value), s = separar(hacia.value);
      return { cuentaId: o.tipo === 'c' ? o.id : '', sinDescontar: o.tipo === 'y', destinoId: s.tipo === 'c' ? s.id : '', destinoCreditoId: s.tipo === 't' ? s.id : '' };
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
// Gasto fijo: su presupuesto, cómo va el mes y el historial de cambios.
// Se abre tocando la línea del gasto en el panel o "Ajustar presupuesto" en el detalle.
export function abrirPresupuesto(ctx, m, d, cat, mesVista) {
  const { h } = ctx;
  const actual = mesActual();
  const mesRef = mesVista && mesVista > actual ? mesVista : actual;
  const valorHoy = d.presupuesto(cat, mesRef);
  const monto = inputImporte(ctx, valorHoy || '');
  const desde = h('select', {}, h('option', { value: actual }, `Este mes (${nombreMes(actual, false).toLowerCase()})`),
    h('option', { value: sumarMeses(actual, 1), selected: mesRef !== actual }, `El mes que viene (${nombreMes(sumarMeses(actual, 1), false).toLowerCase()})`));
  const f = d.fijosDelMes(mesVista || actual).find(x => x.cat.id === cat.id);
  const fila = (a, b, clase = '') => h('div', { class: `fz-linea ${clase}` }, h('span', {}, a), h('span', { class: 'num' }, b));
  const historial = [...(cat.presupuestos || [])].sort((a, b) => b.desde.localeCompare(a.desde));
  return hoja(ctx, {
    titulo: cat.nombre,
    cuerpo: [
      f ? h('div', { class: 'fz-bloque' }, h('h3', {}, nombreMes(mesVista || actual)),
        fila('Presupuesto', plata(f.presupuesto)), fila('Pagado', plata(f.gastado)),
        f.excedido ? fila('Excedido', h('span', { class: 'neg' }, plata(f.excedido))) : fila('Falta pagar', h('span', { class: f.falta ? 'neg' : 'pos' }, f.falta ? plata(f.falta) : 'Nada'), 'fz-total')) : null,
      h('div', { class: 'fz-bloque' }, h('h3', {}, 'Cambiar presupuesto'),
        campo(ctx, 'Nuevo presupuesto mensual', monto), campo(ctx, 'Aplica desde', desde),
        h('p', { class: 'nota' }, 'Si lo bajás, la diferencia vuelve al Disponible. Los meses anteriores conservan su valor.')),
      h('div', { class: 'fz-bloque fz-historial' }, h('h3', {}, 'Historial del presupuesto'),
        historial.length ? historial.map(p => fila(`Desde ${nombreMes(p.desde).toLowerCase()}`, plata(p.monto), 'fz-sub2')) : h('p', { class: 'nota' }, 'Sin presupuesto cargado.')),
    ],
    alGuardar: async () => {
      if (monto.validity?.badInput) return 'Escribí solo números, sin puntos de miles (ej. 150000 o 150000,50).';
      if (monto.value === '' || !(leerImporte(monto) >= 0)) return 'Escribí el presupuesto.';
      const nuevo = leerImporte(monto);
      if (nuevo === d.presupuesto(cat, desde.value)) return;
      await m.cambiarPresupuesto(cat, nuevo, desde.value);
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

// ─────────────────────────────────────────────────────────────
// Clasificar un ajuste: repartir su importe en líneas con categoría.
// Cada línea se vuelve un movimiento normal de la misma cuenta y el
// ajuste se achica en la misma cantidad (el saldo no cambia). Si llega
// a cero, el ajuste desaparece.
// ─────────────────────────────────────────────────────────────
export function abrirClasificar(ctx, m, d, ajuste) {
  const { h } = ctx;
  const tipo = ajuste.tipo;                       // 'gasto' o 'ingreso'
  const total = ajuste.importe;
  let queda = ajuste.importe;
  let ajusteId = ajuste.id;                       // vacío si el ajuste ya llegó a cero
  const lineas = [];

  const avance = h('span', { class: 'nota num' });
  const barra = h('div', { class: 'fz-barra fz-barra-alta' }, h('div', {}));
  const textoQueda = h('p', { class: 'nota' });
  const importe = inputImporte(ctx);
  const fecha = h('input', { type: 'date', value: ajuste.fecha });
  const descripcion = h('input', { type: 'text', placeholder: 'Opcional', autocomplete: 'off' });
  const cat = selectorCategoria(ctx, d, tipo === 'ingreso' ? ['ingreso'] : ['fijo', 'variable'], '');
  const error = h('p', { class: 'formulario-error' });
  const zonaLineas = h('div', {});
  const zonaCarga = h('div', { class: 'formulario-campos' });
  const listo = h('div', { class: 'fz-clasif-listo' }, h('b', {}, 'Todo clasificado'), h('p', { class: 'nota' }, 'El ajuste desapareció: ahora son movimientos normales en la hoja.'));
  const resto = h('p', { class: 'nota' });

  const sug = d.sugerencias(tipo, mesDe(ajuste.fecha));
  const chip = (id, detalle = null) => h('button', { type: 'button', class: 'fz-chip', onclick: () => { cat.fijar(id); error.textContent = ''; importe.focus(); } },
    h('b', {}, d.nombreCategoria(id)), detalle ? [h('br'), h('span', { class: 'nota' }, detalle)] : null);

  poner(zonaCarga,
    sug.bajos.length ? [h('p', { class: 'nota' }, 'Para revisar: este mes llevan menos de lo normal'),
      h('div', { class: 'fz-chips' }, sug.bajos.map(b => chip(b.id, `este mes ${plata(b.actual)}, normalmente ${plata(b.promedio)}`)))] : null,
    sug.usadas.length ? [h('p', { class: 'nota' }, tipo === 'ingreso' ? 'Tus categorías de ingreso' : 'Las que más usás'), h('div', { class: 'fz-chips' }, sug.usadas.map(id => chip(id)))] : null,
    h('div', { class: 'fz-dos' }, campo(ctx, 'Importe', importe), campo(ctx, 'Fecha', fecha)),
    h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Categoría'), cat.elemento),
    campo(ctx, 'Descripción', descripcion),
    error,
    h('button', { type: 'button', class: 'boton principal', onclick: agregar }, 'Agregar línea'));

  function pintar() {
    const hecho = redondear(total - queda);
    avance.textContent = `${plata(hecho)} de ${plata(total)}`;
    barra.firstChild.style.width = `${Math.round(hecho / total * 100)}%`;
    textoQueda.textContent = queda > 0 ? `Quedan ${plata(queda)} sin clasificar` : '';
    importe.placeholder = plata(queda);
    zonaCarga.hidden = queda <= 0;
    listo.hidden = queda > 0;
    resto.textContent = queda > 0 && lineas.length ? `Si cerrás ahora, los ${plata(queda)} que faltan siguen como "Ajuste sin detalle".` : '';
    poner(zonaLineas, lineas.length ? lineas.map((l, i) => h('div', { class: 'fz-linea' },
      h('span', {}, d.nombreCategoria(l.categoriaId), l.descripcion ? h('span', { class: 'nota' }, ` · ${l.descripcion}`) : null, h('br'), h('span', { class: 'nota' }, `${l.fecha.slice(8, 10)}/${l.fecha.slice(5, 7)}`)),
      h('span', { class: 'fz-subcuenta-der' }, h('b', { class: `num ${tipo === 'gasto' ? 'neg' : 'pos'}` }, `${tipo === 'gasto' ? '−' : '+'} ${plata(l.importe)}`),
        h('button', { type: 'button', class: 'boton chico', 'aria-label': 'Quitar línea', onclick: () => quitar(i) }, '✕'))))
      : h('p', { class: 'nota' }, 'Todavía ninguna.'));
  }

  async function agregar() {
    const imp = leerImporte(importe);
    if (!(imp > 0)) { error.textContent = 'Escribí un importe.'; return; }
    if (imp > queda) { error.textContent = `No puede ser más de lo que queda (${plata(queda)}).`; return; }
    if (!cat.valor()) { error.textContent = 'Elegí una categoría (o tocá una sugerencia).'; return; }
    if (!fecha.value) { error.textContent = 'Elegí una fecha.'; return; }
    const linea = { tipo, fecha: fecha.value, importe: imp, cuentaId: ajuste.cuentaId, categoriaId: cat.valor(), descripcion: descripcion.value.trim() };
    linea.id = await m.col.movimientos.crear(linea);
    queda = redondear(queda - imp);
    if (queda > 0) await m.actualizar('movimientos', ajusteId, { importe: queda });
    else { await m.borrar('movimientos', ajusteId); ajusteId = ''; }
    lineas.push(linea);
    importe.value = ''; descripcion.value = ''; cat.fijar(''); fecha.value = ajuste.fecha; error.textContent = '';
    pintar();
  }

  async function quitar(i) {
    const l = lineas[i];
    await m.borrar('movimientos', l.id);
    queda = redondear(queda + l.importe);
    if (ajusteId) await m.actualizar('movimientos', ajusteId, { importe: queda });
    else ajusteId = await m.col.movimientos.crear({ tipo, fecha: ajuste.fecha, importe: queda, cuentaId: ajuste.cuentaId, categoriaId: AJUSTE, ajuste: true, descripcion: ajuste.descripcion || 'Ajuste de saldo' });
    lineas.splice(i, 1);
    pintar();
  }

  // Enter en un campo agrega la línea (en vez de cerrar).
  zonaCarga.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); agregar(); } });

  pintar();
  return hoja(ctx, {
    titulo: 'Clasificar el ajuste',
    cuerpo: [
      h('div', { class: 'fz-linea' }, h('span', { class: 'nota' }, `${d.nombreCuenta(ajuste.cuentaId)} · ${ajuste.fecha.slice(8, 10)}/${ajuste.fecha.slice(5, 7)}`), avance),
      barra, textoQueda, zonaCarga, listo,
      h('p', { class: 'etiqueta-campo' }, 'Líneas clasificadas'), zonaLineas, resto,
    ],
    textoGuardar: 'Listo',
    sinCancelar: true,
    alGuardar: async () => {},
  });
}
