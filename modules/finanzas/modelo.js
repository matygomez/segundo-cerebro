// ─────────────────────────────────────────────────────────────
// Finanzas: datos y cálculos.
//
// Colecciones (cada una es un archivo en Drive, dentro de /finanzas):
//   grupos      { nombre, orden }
//   cuentas     { nombre, tipo: 'cuenta' | 'reserva' | 'inversion', grupoId,
//                 saldoInicial, fondoCredito, archivada, orden }
//   creditos    { nombre, diaCierre, diaVencimiento, fechas: { 'AAAA-MM': { cierre, vencimiento } },
//                 archivado, orden }
//   categorias  { nombre, tipo: 'fijo' | 'variable' | 'ingreso', padreId,
//                 dia, automatico, presupuestos: [{ desde: 'AAAA-MM', monto }], archivada, orden }
//   movimientos { tipo, fecha, importe, cuentaId, creditoId, cuotas, cuotasPagadas, destinoId,
//                 destinoCreditoId, categoriaId, descripcion, ajuste, prestamoId, sinDescontar }
//     sinDescontar: gasto o ingreso cargado después, que ya estaba reflejado en el
//                   saldo de la cuenta. Cuenta para el mes, pero no mueve el saldo.
//     pagadasHasta: en una compra con crédito cargada después, las cuotas que
//                   vencieron antes de esta fecha (la del día en que se cargó)
//                   se toman como pagadas. Las que vencen después siguen siendo
//                   deuda hasta que se registre el pago.
//     (cuotasPagadas: versión anterior, por cantidad; se sigue respetando.)
//     tipo: 'gasto' | 'ingreso' | 'transferencia' | 'rendimiento' | 'prestamo'
//   prestamos   { persona, sentido: 'me-deben' | 'debo', monto, fecha, cuentaId, notas, archivado }
//   ajustes     { clave: 'panel', orden: [...], columnas: [[...], [...], [...]] }
//               { clave: 'credito-reparto', meses: { 'AAAA-MM': monto } }
//               (cuánto del vencimiento de ese mes se paga con la plata de ese mes
//                y no con la del mes anterior)
//
// Todos los importes en pesos. Fechas 'AAAA-MM-DD', meses 'AAAA-MM'.
// ─────────────────────────────────────────────────────────────

export const AJUSTE = 'ajuste';   // categoría virtual "Ajuste sin detalle"

// ── Fechas y formato ────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
export const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const mesDe = (fecha) => fecha.slice(0, 7);
export const mesActual = () => mesDe(hoy());
export function sumarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function diaDelMes(mes, dia) {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return `${mes}-${pad(Math.min(Math.max(1, Number(dia) || 1), ultimo))}`;
}
export const finDeMes = (mes) => diaDelMes(mes, 31);

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (mes, conAnio = true) => {
  const [a, m] = mes.split('-').map(Number);
  const n = NOMBRES_MES[m - 1];
  return (conAnio ? `${n} ${a}` : n).replace(/^./, c => c.toUpperCase());
};
export const mesCorto = (mes) => NOMBRES_MES[Number(mes.slice(5, 7)) - 1].slice(0, 3).replace(/^./, c => c.toUpperCase());
export const fechaCorta = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
export const fechaLarga = (f) => `${Number(f.slice(8, 10))} ${NOMBRES_MES[Number(f.slice(5, 7)) - 1].slice(0, 3)}`;

const formato = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const plata = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  // Espacios que no se cortan: el importe nunca se parte en dos renglones.
  return v < 0 ? `−\u00A0$\u00A0${formato.format(-v)}` : `$\u00A0${formato.format(v)}`;
};
export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── Carga ───────────────────────────────────────────────────

const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.creado - b.creado;

export function crearModelo(ctx) {
  const col = {};
  for (const n of ['grupos', 'cuentas', 'creditos', 'categorias', 'movimientos', 'prestamos', 'ajustes']) col[n] = ctx.datos(n);

  async function cargar() {
    const [grupos, cuentas, creditos, categorias, movimientos, prestamos, ajustes] =
      await Promise.all(['grupos', 'cuentas', 'creditos', 'categorias', 'movimientos', 'prestamos', 'ajustes'].map(n => col[n].listar()));
    [grupos, cuentas, creditos, categorias].forEach(l => l.sort(porOrden));
    movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
    return new Datos({ grupos, cuentas, creditos, categorias, movimientos, prestamos, ajustes });
  }

  const siguienteOrden = (lista) => Math.max(0, ...lista.map(x => x.orden ?? 0)) + 1;

  return {
    cargar,
    col,
    async crear(coleccion, datos) {
      const lista = await col[coleccion].listar();
      return col[coleccion].crear({ ...datos, orden: siguienteOrden(lista) });
    },
    actualizar: (coleccion, id, cambios) => col[coleccion].actualizar(id, cambios),
    borrar: (coleccion, id) => col[coleccion].borrar(id),

    // Guarda el orden de una lista (ids en el orden nuevo). Solo cambia los que se movieron.
    async reordenar(coleccion, ids) {
      const actuales = new Map((await col[coleccion].listar()).map(x => [x.id, x]));
      for (const [i, id] of ids.entries()) {
        if (actuales.get(id) && actuales.get(id).orden !== i + 1) await col[coleccion].actualizar(id, { orden: i + 1 });
      }
    },

    // Reparto del pago de la tarjeta: cuánto del vencimiento de "mes" se paga
    // con lo que se cobra ese mes. 0 lo saca.
    async guardarReparto(mes, monto) {
      const existente = (await col.ajustes.listar()).find(a => a.clave === 'credito-reparto');
      const meses = { ...(existente?.meses || {}) };
      if (monto > 0) meses[mes] = redondear(monto); else delete meses[mes];
      if (existente) return col.ajustes.actualizar(existente.id, { meses });
      return col.ajustes.crear({ clave: 'credito-reparto', meses });
    },

    async guardarOrdenPanel(orden, columnas = null) {
      const existente = (await col.ajustes.listar()).find(a => a.clave === 'panel');
      const cambios = columnas ? { orden, columnas } : { orden };
      if (existente) return col.ajustes.actualizar(existente.id, cambios);
      return col.ajustes.crear({ clave: 'panel', ...cambios });
    },

    // Nuevo presupuesto para un gasto fijo: queda en el historial.
    async cambiarPresupuesto(cat, monto, desde) {
      const otros = (cat.presupuestos || []).filter(p => p.desde !== desde);
      const presupuestos = [...otros, { desde, monto: redondear(monto) }].sort((a, b) => a.desde.localeCompare(b.desde));
      return col.categorias.actualizar(cat.id, { presupuestos });
    },

    // Ajuste de saldo: crea el movimiento por la diferencia.
    async ajustarSaldo(d, cuenta, saldoReal) {
      const dif = redondear(saldoReal - d.saldo(cuenta.id));
      if (!dif) return 0;
      await col.movimientos.crear({
        tipo: dif < 0 ? 'gasto' : 'ingreso', fecha: hoy(), importe: Math.abs(dif), cuentaId: cuenta.id,
        categoriaId: AJUSTE, ajuste: true, descripcion: 'Ajuste de saldo',
      });
      return dif;
    },

    // Inversión: la diferencia con el saldo real es rendimiento (ganancia o pérdida).
    async actualizarInversion(d, cuenta, saldoReal) {
      const dif = redondear(saldoReal - d.saldo(cuenta.id));
      if (!dif) return 0;
      await col.movimientos.crear({ tipo: 'rendimiento', fecha: hoy(), importe: dif, cuentaId: cuenta.id, descripcion: dif > 0 ? 'Ganancia' : 'Pérdida' });
      return dif;
    },

    // Préstamo nuevo: mueve la plata de entrada.
    async crearPrestamo(datos) {
      const id = await col.prestamos.crear({ ...datos, archivado: false });
      await col.movimientos.crear({
        tipo: 'prestamo', prestamoId: id, fecha: datos.fecha, importe: datos.monto, cuentaId: datos.cuentaId,
        sentido: datos.sentido === 'me-deben' ? 'sale' : 'entra', inicial: true,
        descripcion: datos.sentido === 'me-deben' ? `Préstamo a ${datos.persona}` : `Préstamo de ${datos.persona}`,
      });
      return id;
    },
    async registrarPagoPrestamo(p, importe, cuentaId, fecha) {
      return col.movimientos.crear({
        tipo: 'prestamo', prestamoId: p.id, fecha, importe, cuentaId,
        sentido: p.sentido === 'me-deben' ? 'entra' : 'sale',
        descripcion: p.sentido === 'me-deben' ? `Cobro a ${p.persona}` : `Pago a ${p.persona}`,
      });
    },

    // Eliminar: si tiene movimientos se archiva, para no perder el historial.
    async eliminarOArchivar(d, coleccion, item) {
      const usado = d.usadoEnMovimientos(coleccion, item.id);
      if (usado) {
        await col[coleccion].actualizar(item.id, coleccion === 'creditos' || coleccion === 'prestamos' ? { archivado: true } : { archivada: true });
        return 'archivado';
      }
      if (coleccion === 'categorias') {
        for (const sub of d.categorias.filter(c => c.padreId === item.id)) {
          if (d.usadoEnMovimientos('categorias', sub.id)) await col.categorias.actualizar(sub.id, { archivada: true });
          else await col.categorias.borrar(sub.id);
        }
      }
      if (coleccion === 'grupos') {
        for (const c of d.cuentas.filter(c => c.grupoId === item.id)) await col.cuentas.actualizar(c.id, { grupoId: '' });
      }
      await col[coleccion].borrar(item.id);
      return 'borrado';
    },
  };
}

// ── Cálculos sobre los datos cargados ───────────────────────

export class Datos {
  constructor(t) {
    Object.assign(this, t);
    this._indice = {};
    for (const n of ['grupos', 'cuentas', 'creditos', 'categorias', 'prestamos']) {
      this._indice[n] = new Map(this[n].map(x => [x.id, x]));
    }
    // Las cuentas siguen el orden de sus grupos y, adentro, el suyo.
    const ordenGrupo = (c) => this._indice.grupos.get(c.grupoId)?.orden ?? 1e9;
    this.cuentas.sort((a, b) => ordenGrupo(a) - ordenGrupo(b) || (a.orden ?? 0) - (b.orden ?? 0) || a.creado - b.creado);
  }

  cuenta(id) { return this._indice.cuentas.get(id); }
  credito(id) { return this._indice.creditos.get(id); }
  categoria(id) { return id === AJUSTE ? { id: AJUSTE, nombre: 'Ajuste sin detalle', tipo: 'variable' } : this._indice.categorias.get(id); }
  grupo(id) { return this._indice.grupos.get(id); }
  prestamo(id) { return this._indice.prestamos.get(id); }
  panel() { return this.ajustes.find(a => a.clave === 'panel')?.orden || null; }
  panelColumnas() { return this.ajustes.find(a => a.clave === 'panel')?.columnas || null; }
  repartos() { return this.ajustes.find(a => a.clave === 'credito-reparto')?.meses || {}; }

  nombreCredito(c) { return c ? `${c.nombre} (crédito)` : '—'; }
  nombreCuenta(id) { return this.cuenta(id)?.nombre || '—'; }
  nombreCategoria(id) {
    const c = this.categoria(id);
    if (!c) return '—';
    const padre = c.padreId ? this.categoria(c.padreId) : null;
    return padre ? `${padre.nombre} › ${c.nombre}` : c.nombre;
  }
  // Categoría principal (para agrupar subcategorías bajo su padre).
  categoriaPrincipal(id) { const c = this.categoria(id); return c?.padreId ? this.categoria(c.padreId) : c; }

  cuentasActivas(tipo) { return this.cuentas.filter(c => !c.archivada && (!tipo || c.tipo === tipo)); }
  creditosActivos() { return this.creditos.filter(c => !c.archivado); }
  categoriasDe(tipo) { return this.categorias.filter(c => c.tipo === tipo && !c.padreId && !c.archivada); }
  subcategorias(padreId) { return this.categorias.filter(c => c.padreId === padreId && !c.archivada); }
  fondo() { return this.cuentasActivas('reserva').find(c => c.fondoCredito) || null; }

  usadoEnMovimientos(coleccion, id) {
    const campos = { cuentas: ['cuentaId', 'destinoId'], creditos: ['creditoId', 'destinoCreditoId'], categorias: ['categoriaId'], prestamos: ['prestamoId'], grupos: [] }[coleccion] || [];
    if (coleccion === 'categorias' && this.categorias.some(c => c.padreId === id && this.usadoEnMovimientos('categorias', c.id))) return true;
    return this.movimientos.some(m => campos.some(c => m[c] === id));
  }

  // Saldos iniciales como líneas de movimiento (solo para mostrar).
  // No se guardan como movimientos: el saldo inicial vive en la cuenta,
  // así no se cuenta dos veces. Tampoco suman a "Ingresos del mes",
  // porque es plata que ya tenías, no plata que ganaste.
  movimientosIniciales() {
    return this.cuentas.filter(c => Number(c.saldoInicial)).map(c => {
      const f = new Date(c.creado);
      return {
        id: `inicial-${c.id}`, tipo: 'inicial', cuentaId: c.id, importe: Number(c.saldoInicial), creado: c.creado,
        fecha: `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`, descripcion: '',
      };
    });
  }
  movimientosTodos() {
    return [...this.movimientos, ...this.movimientosIniciales()].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);
  }

  // ── Saldos ──

  // Efecto de un movimiento sobre una cuenta (positivo si entra plata).
  efecto(m, cuentaId) {
    let e = 0;
    if (m.sinDescontar) return 0;
    if (m.tipo === 'gasto' && m.cuentaId === cuentaId && !m.creditoId) e -= m.importe;
    if (m.tipo === 'ingreso' && m.cuentaId === cuentaId) e += m.importe;
    if (m.tipo === 'transferencia') {
      if (m.cuentaId === cuentaId) e -= m.importe;
      if (m.destinoId === cuentaId) e += m.importe;
    }
    if (m.tipo === 'rendimiento' && m.cuentaId === cuentaId) e += m.importe;
    if (m.tipo === 'prestamo' && m.cuentaId === cuentaId) e += m.sentido === 'entra' ? m.importe : -m.importe;
    return e;
  }

  saldo(cuentaId, hasta = null) {
    const c = this.cuenta(cuentaId);
    let s = Number(c?.saldoInicial) || 0;
    for (const m of this.movimientos) if (!hasta || m.fecha <= hasta) s += this.efecto(m, cuentaId);
    return redondear(s);
  }

  // ── Crédito: resúmenes y cuotas ──

  // Fechas de cierre y vencimiento del resumen que cierra en "mes".
  fechasResumen(credito, mes) {
    const propias = credito.fechas?.[mes];
    if (propias) return propias;
    // Sugeridas: se toma el mes anterior que tenga fechas corregidas y se corre un mes.
    const ant = credito.fechas?.[sumarMeses(mes, -1)];
    const diaC = ant ? Number(ant.cierre.slice(8, 10)) : credito.diaCierre;
    const diaV = ant ? Number(ant.vencimiento.slice(8, 10)) : credito.diaVencimiento;
    const cierre = diaDelMes(mes, diaC);
    const mesV = Number(diaV) > Number(diaC) ? mes : sumarMeses(mes, 1);
    return { cierre, vencimiento: diaDelMes(mesV, diaV), sugeridas: true };
  }

  // Mes del resumen donde cae una compra hecha en "fecha".
  mesResumenDe(credito, fecha) {
    let mes = mesDe(fecha);
    if (fecha > this.fechasResumen(credito, mes).cierre) mes = sumarMeses(mes, 1);
    return mes;
  }

  // Cada compra con crédito se parte en cuotas, cada una en su resumen.
  cuotas() {
    if (this._cuotas) return this._cuotas;
    const lista = [];
    for (const m of this.movimientos) {
      if (m.tipo !== 'gasto' || !m.creditoId) continue;
      const cr = this.credito(m.creditoId);
      if (!cr) continue;
      const n = Math.max(1, Number(m.cuotas) || 1);
      const primero = this.mesResumenDe(cr, m.fecha);
      const base = Math.floor((m.importe / n) * 100) / 100;
      for (let k = 0; k < n; k++) {
        const importe = k === n - 1 ? redondear(m.importe - base * (n - 1)) : base;
        const mes = sumarMeses(primero, k);
        const vencida = m.pagadasHasta && this.fechasResumen(cr, mes).vencimiento < m.pagadasHasta;
        lista.push({ mov: m, creditoId: cr.id, mes, numero: k + 1, total: n, importe, yaPagada: !!vencida || k < (Number(m.cuotasPagadas) || 0) });
      }
    }
    return (this._cuotas = lista);
  }

  // Resúmenes de una tarjeta, del más viejo al más nuevo, con lo pagado aplicado.
  resumenes(creditoId) {
    const cr = this.credito(creditoId);
    const porMes = new Map();
    for (const q of this.cuotas().filter(q => q.creditoId === creditoId)) {
      if (!porMes.has(q.mes)) porMes.set(q.mes, []);
      porMes.get(q.mes).push(q);
    }
    let pagado = redondear(this.movimientos.filter(m => m.tipo === 'transferencia' && m.destinoCreditoId === creditoId).reduce((a, m) => a + m.importe, 0));
    return [...porMes.keys()].sort().map(mes => {
      const items = porMes.get(mes);
      const total = redondear(items.reduce((a, q) => a + q.importe, 0));
      const previo = redondear(items.filter(q => q.yaPagada).reduce((a, q) => a + q.importe, 0));
      const aplicado = Math.min(pagado, redondear(total - previo));
      pagado = redondear(pagado - aplicado);
      const totalPagado = redondear(previo + aplicado);
      return { creditoId, mes, ...this.fechasResumen(cr, mes), items, total, pagado: totalPagado, pendiente: redondear(total - totalPagado) };
    });
  }

  // Lo que falta pagar de crédito, agrupado por mes de vencimiento.
  planCredito() {
    const porMes = new Map();
    for (const cr of this.creditosActivos()) {
      for (const r of this.resumenes(cr.id)) {
        if (r.pendiente <= 0) continue;
        const mes = mesDe(r.vencimiento);
        if (!porMes.has(mes)) porMes.set(mes, { mes, total: 0, resumenes: [] });
        const x = porMes.get(mes);
        x.total = redondear(x.total + r.pendiente);
        x.resumenes.push(r);
      }
    }
    const fondo = this.fondo();
    let resto = fondo ? Math.max(0, this.saldo(fondo.id)) : 0;
    const meses = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map(x => {
      const cubierto = Math.min(resto, x.total);
      resto = redondear(resto - cubierto);
      return { ...x, cubierto: redondear(cubierto), falta: redondear(x.total - cubierto) };
    });
    // "Pagado hasta": el último mes de la racha cubierta desde el más cercano.
    let pagadoHasta = null;
    for (const x of meses) { if (x.falta > 0) break; pagadoHasta = x.mes; }
    const siguiente = meses.find(x => x.falta > 0) || null;
    return {
      fondo, saldoFondo: fondo ? this.saldo(fondo.id) : 0, meses,
      totalTodo: redondear(meses.reduce((a, x) => a + x.total, 0)),
      faltaTodo: redondear(meses.reduce((a, x) => a + x.falta, 0)),
      pagadoHasta,
      siguiente,
    };
  }

  // ── Mes ──

  // Gastos que cuentan en el mes: los de cuentas por fecha y las cuotas de crédito por resumen.
  gastosDelMes(mes) {
    const lista = [];
    for (const m of this.movimientos) {
      if (m.tipo === 'gasto' && !m.creditoId && mesDe(m.fecha) === mes) lista.push({ mov: m, importe: m.importe, categoriaId: m.categoriaId });
    }
    for (const q of this.cuotas()) {
      if (q.mes === mes) lista.push({ mov: q.mov, importe: q.importe, categoriaId: q.mov.categoriaId, cuota: q });
    }
    return lista;
  }

  ingresosDelMes(mes) {
    return this.movimientos.filter(m => m.tipo === 'ingreso' && mesDe(m.fecha) === mes);
  }

  presupuesto(cat, mes) {
    const p = [...(cat.presupuestos || [])].sort((a, b) => a.desde.localeCompare(b.desde)).filter(x => x.desde <= mes).pop();
    return p ? p.monto : 0;
  }

  fijosDelMes(mes) {
    const gastos = this.gastosDelMes(mes);
    return this.categoriasDe('fijo').map(cat => {
      const gastado = redondear(gastos.filter(g => g.categoriaId === cat.id).reduce((a, g) => a + g.importe, 0));
      const presupuesto = this.presupuesto(cat, mes);
      return {
        cat, grupo: cat.grupoFijo === 'personal' ? 'personal' : 'familia', presupuesto, gastado,
        falta: redondear(Math.max(0, presupuesto - gastado)),
        excedido: presupuesto > 0 && gastado > presupuesto ? redondear(gastado - presupuesto) : 0,
      };
    });
  }

  // Sugerencias para clasificar un ajuste.
  // bajos: categorías que este mes llevan menos que su promedio de los 3 meses anteriores.
  // usadas: las más usadas en los últimos 3 meses.
  sugerencias(tipo, mes) {
    const meses = [1, 2, 3].map(i => sumarMeses(mes, -i));
    if (tipo === 'ingreso') {
      const cuenta = new Map();
      for (const m of this.movimientos) if (m.tipo === 'ingreso' && !m.ajuste && meses.includes(mesDe(m.fecha))) cuenta.set(m.categoriaId, (cuenta.get(m.categoriaId) || 0) + 1);
      const usadas = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter(id => this.categoria(id));
      // Primero las más usadas; después el resto de las categorías de ingreso.
      const resto = this.categoriasDe('ingreso').map(c => c.id).filter(id => !usadas.includes(id));
      return { bajos: [], usadas: [...usadas, ...resto].slice(0, 6) };
    }
    const porCat = (m) => {
      const t = new Map();
      for (const g of this.gastosDelMes(m)) if (g.categoriaId !== AJUSTE) t.set(g.categoriaId, (t.get(g.categoriaId) || 0) + g.importe);
      return t;
    };
    const ahora = porCat(mes);
    const previos = meses.map(porCat);
    const ids = new Set(previos.flatMap(t => [...t.keys()]));
    const bajos = [];
    for (const id of ids) {
      if (!this.categoria(id) || this.categoria(id).archivada) continue;
      const prom = previos.reduce((a, t) => a + (t.get(id) || 0), 0) / 3;
      const actual = ahora.get(id) || 0;
      if (prom > 0 && actual < prom * 0.8) bajos.push({ id, actual: redondear(actual), promedio: redondear(prom), brecha: prom - actual });
    }
    bajos.sort((a, b) => b.brecha - a.brecha);
    const usos = new Map();
    for (const m of this.movimientos) if (m.tipo === 'gasto' && !m.ajuste && meses.concat(mes).includes(mesDe(m.fecha))) usos.set(m.categoriaId, (usos.get(m.categoriaId) || 0) + 1);
    const usadas = [...usos.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter(id => this.categoria(id) && !bajos.slice(0, 4).some(b => b.id === id));
    return { bajos: bajos.slice(0, 4), usadas: usadas.slice(0, 5) };
  }

  variablesDelMes(mes) {
    const gastos = this.gastosDelMes(mes).filter(g => this.categoria(g.categoriaId)?.tipo !== 'fijo');
    const porCat = new Map();
    for (const g of gastos) {
      const principal = this.categoriaPrincipal(g.categoriaId) || { id: 'sin', nombre: 'Sin categoría' };
      if (!porCat.has(principal.id)) porCat.set(principal.id, { cat: principal, total: 0, general: 0, subs: new Map(), gastos: [] });
      const x = porCat.get(principal.id);
      x.total = redondear(x.total + g.importe);
      x.gastos.push(g);
      const sub = this.categoria(g.categoriaId);
      if (sub?.padreId) x.subs.set(sub.id, { cat: sub, total: redondear((x.subs.get(sub.id)?.total || 0) + g.importe) });
      else x.general = redondear(x.general + g.importe);
    }
    // En el orden de Configurar; el ajuste y lo sin categoría van al final.
    const pos = (x) => (x.cat.id === AJUSTE || x.cat.id === 'sin' ? 1e9 : this.categorias.indexOf(this.categoria(x.cat.id)));
    for (const x of porCat.values()) {
      x.subs = new Map([...x.subs.entries()].sort((a, b) => this.categorias.indexOf(a[1].cat) - this.categorias.indexOf(b[1].cat)));
    }
    return [...porCat.values()].sort((a, b) => pos(a) - pos(b));
  }

  resumenMes(mes) {
    const totalGastos = redondear(this.gastosDelMes(mes).reduce((a, g) => a + g.importe, 0));
    const totalIngresos = redondear(this.ingresosDelMes(mes).reduce((a, m) => a + m.importe, 0));
    const corte = mes === mesActual() ? null : finDeMes(mes);
    const cuentas = this.cuentasActivas('cuenta').map(c => ({ c, saldo: this.saldo(c.id, corte) }));
    const enCuentas = redondear(cuentas.reduce((a, x) => a + x.saldo, 0));
    const fijos = this.fijosDelMes(mes);
    const fijosPendientes = redondear(fijos.reduce((a, f) => a + f.falta, 0));
    const plan = this.planCredito();
    const credito = this.creditoDelMes(mes, plan);
    const proximo = credito.proximo;
    const faltanteCredito = credito.total;
    return {
      totalGastos, totalIngresos, diferencia: redondear(totalIngresos - totalGastos),
      cuentas, enCuentas, fijos, fijosPendientes, plan, proximo, credito, faltanteCredito,
      disponible: redondear(enCuentas - fijosPendientes - faltanteCredito),
    };
  }

  // Lo que el Disponible de "mes" tiene que reservar para el crédito:
  //  - lo pendiente de vencimientos de este mes o anteriores ("del mes anterior"),
  //  - el próximo vencimiento, menos lo que se decidió pagar con la plata del mes
  //    en que vence (reparto).
  // En los dos casos, primero cubre el fondo.
  creditoDelMes(mes, plan = this.planCredito()) {
    const anteriores = plan.meses.filter(x => x.mes <= mes);
    const proximo = plan.meses.find(x => x.mes > mes) || null;
    const repartos = this.repartos();
    const reparto = proximo ? Math.min(repartos[proximo.mes] || 0, proximo.falta) : 0;
    const totalAnteriores = redondear(anteriores.reduce((a, x) => a + x.falta, 0));
    const proximoEsteMes = proximo ? redondear(Math.max(0, proximo.falta - reparto)) : 0;
    // El vencimiento de este mes, para avisar si quedó algo o si ya está pagado.
    const resumenesDelMes = this.creditosActivos().flatMap(c => this.resumenes(c.id)).filter(r => mesDe(r.vencimiento) <= mes && (r.pendiente > 0 || mesDe(r.vencimiento) === mes));
    const pendienteAnterior = redondear(resumenesDelMes.reduce((a, r) => a + r.pendiente, 0));
    const vencimientos = resumenesDelMes.filter(r => r.pendiente > 0).map(r => r.vencimiento).sort();
    return {
      anteriores, totalAnteriores, proximo, reparto, proximoEsteMes,
      total: redondear(totalAnteriores + proximoEsteMes),
      pendienteAnterior, hayVencimientoEsteMes: resumenesDelMes.length > 0,
      venceAnterior: vencimientos[0] || null,
      repartido: !!repartos[mes],
    };
  }

  // Inversión en un mes: saldo al inicio, aportes, retiros, rendimiento, saldo actual.
  inversionDelMes(cuenta, mes) {
    const inicioFecha = `${sumarMeses(mes, -1)}-31`;
    const enMes = this.movimientos.filter(m => mesDe(m.fecha) === mes);
    const aportes = enMes.filter(m => m.tipo === 'transferencia' && m.destinoId === cuenta.id).reduce((a, m) => a + m.importe, 0);
    const retiros = enMes.filter(m => m.tipo === 'transferencia' && m.cuentaId === cuenta.id).reduce((a, m) => a + m.importe, 0);
    const rendimiento = enMes.filter(m => m.tipo === 'rendimiento' && m.cuentaId === cuenta.id).reduce((a, m) => a + m.importe, 0);
    return {
      inicio: this.saldo(cuenta.id, inicioFecha), aportes: redondear(aportes), retiros: redondear(retiros),
      rendimiento: redondear(rendimiento), actual: this.saldo(cuenta.id, mes === mesActual() ? null : finDeMes(mes)),
    };
  }

  // Préstamo: cuánto se pagó y cuánto falta.
  estadoPrestamo(p) {
    const pagos = this.movimientos.filter(m => m.tipo === 'prestamo' && m.prestamoId === p.id && !m.inicial);
    const pagado = redondear(pagos.reduce((a, m) => a + m.importe, 0));
    return { pagos, pagado, falta: redondear(Math.max(0, p.monto - pagado)) };
  }

  // Texto de la cuenta o crédito de un movimiento.
  origen(m) {
    if (m.tipo === 'gasto' && m.creditoId) return this.nombreCredito(this.credito(m.creditoId));
    if (m.sinDescontar) return { gasto: 'Ya pagado', ingreso: 'Ya sumado', transferencia: 'Ya hecha' }[m.tipo] || this.nombreCuenta(m.cuentaId);
    return this.nombreCuenta(m.cuentaId);
  }
  destino(m) {
    if (m.destinoCreditoId) return `${this.nombreCredito(this.credito(m.destinoCreditoId))}`;
    return this.nombreCuenta(m.destinoId);
  }
}
