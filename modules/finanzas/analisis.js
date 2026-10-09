// ─────────────────────────────────────────────────────────────
// Finanzas: pestaña Análisis (#/finanzas/analisis).
//
// Todo sale de lo que ya está cargado: movimientos, categorías,
// cuentas y crédito. Los gráficos son SVG simples, con detalle al
// pasar el mouse o tocar.
//
// Colores de los gráficos: azul y dorado (se distinguen aunque se
// vean mal los colores). Verde y rojo quedan para "bien" y "mal".
// ─────────────────────────────────────────────────────────────

import { plata, mesActual, sumarMeses, nombreMes, mesCorto, mesDe, hoy, finDeMes, redondear, AJUSTE } from './modelo.js';
import { poner, hoja } from './comun.js';

const PERIODOS = [[1, 'Este mes'], [3, '3 meses'], [6, '6 meses'], [12, '12 meses']];
const META_COLCHON = 6;   // meses de gastos fijos

function leerPeriodo() { try { const v = Number(localStorage.getItem('fz-analisis-periodo')); return [1, 3, 6, 12].includes(v) ? v : 3; } catch { return 3; } }
function guardarPeriodo(v) { try { localStorage.setItem('fz-analisis-periodo', String(v)); } catch { /* sin almacenamiento */ } }

// ── Cálculos ────────────────────────────────────────────────

const suma = (l, f = (x) => x) => redondear(l.reduce((a, x) => a + f(x), 0));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const diasDelMes = (mes) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();

// Primer mes con algo cargado.
function primerMes(d) {
  const fechas = d.movimientosTodos().map(m => m.fecha).filter(Boolean).sort();
  return fechas.length ? mesDe(fechas[0]) : mesActual();
}

// Necesidad o gusto de cada categoría (las subcategorías siguen a su categoría salvo que se marquen aparte).
export function clasificacion(d) {
  const guardado = d.ajustes.find(a => a.clave === 'clasificacion')?.cats || {};
  const de = (id) => {
    if (guardado[id]) return guardado[id];
    const c = d.categoria(id);
    if (!c) return 'gus';
    if (c.padreId) return de(c.padreId);
    return c.tipo === 'fijo' ? 'nec' : 'gus';
  };
  return { de, guardado };
}

// Gasto del mes por categoría principal (sin separar fijo/variable).
function gastoPorCategoria(d, mes, soloVariables = true) {
  const mapa = new Map();
  for (const g of d.gastosDelMes(mes)) {
    const c = d.categoria(g.categoriaId);
    if (soloVariables && c?.tipo === 'fijo') continue;
    const p = d.categoriaPrincipal(g.categoriaId) || { id: 'sin', nombre: 'Sin categoría' };
    if (!mapa.has(p.id)) mapa.set(p.id, { cat: p, total: 0, subs: new Map() });
    const x = mapa.get(p.id);
    x.total = redondear(x.total + g.importe);
    const clave = c?.padreId ? c.id : 'general';
    const nombre = c?.padreId ? c.nombre : 'General';
    x.subs.set(clave, { nombre, total: redondear((x.subs.get(clave)?.total || 0) + g.importe) });
  }
  return mapa;
}

// Gasto acumulado día a día de un mes (las cuotas de crédito cuentan el día de la compra si fue ese mes; si no, el día 1).
function acumuladoPorDia(d, mes) {
  const dias = new Array(diasDelMes(mes)).fill(0);
  for (const g of d.gastosDelMes(mes)) {
    const f = g.mov.fecha || '';
    const dia = mesDe(f) === mes ? Number(f.slice(8, 10)) : 1;
    dias[Math.max(0, Math.min(dias.length - 1, dia - 1))] += g.importe;
  }
  let a = 0;
  return dias.map(v => (a = redondear(a + v)));
}

// Deuda de tarjetas al cierre de una fecha.
function deudaCreditoAl(d, fecha) {
  let deuda = 0;
  for (const q of d.cuotas()) {
    if (q.mov.fecha > fecha) continue;
    if (q.yaPagada && d.fechasResumen(d.credito(q.creditoId), q.mes).vencimiento <= fecha) continue;
    deuda += q.importe;
  }
  const pagos = d.movimientos.filter(m => m.tipo === 'transferencia' && m.destinoCreditoId && m.fecha <= fecha);
  return Math.max(0, redondear(deuda - suma(pagos, m => m.importe)));
}

// Préstamos al cierre de una fecha: lo que te deben suma, lo que debés resta.
function prestamosAl(d, fecha) {
  let neto = 0;
  for (const p of d.prestamos) {
    if (!p.fecha || p.fecha > fecha) continue;
    const pagado = suma(d.movimientos.filter(m => m.tipo === 'prestamo' && m.prestamoId === p.id && !m.inicial && m.fecha <= fecha), m => m.importe);
    const falta = Math.max(0, p.monto - pagado);
    neto += p.sentido === 'me-deben' ? falta : -falta;
  }
  return redondear(neto);
}

function patrimonioAl(d, fecha) {
  const cuentas = d.cuentas.filter(c => !c.archivada);
  return redondear(suma(cuentas, c => d.saldo(c.id, fecha)) - deudaCreditoAl(d, fecha) + prestamosAl(d, fecha));
}

// ── Vista ───────────────────────────────────────────────────

export function vistaAnalisis(cuerpo, ctx, m, d, { mes }) {
  const { h } = ctx;
  const periodo = leerPeriodo();
  const actual = mesActual();
  const inicio = primerMes(d);
  const esActual = mes === actual;
  const nombreCorto = nombreMes(mes, false).toLowerCase();

  // Meses del período (terminando en el mes elegido) y los anteriores para comparar.
  const mesesHasta = (fin, n) => Array.from({ length: n }, (_, i) => sumarMeses(fin, i - n + 1));
  const delPeriodo = mesesHasta(mes, periodo);
  const compara = mesesHasta(sumarMeses(mes, -periodo), periodo === 1 ? 3 : periodo).filter(x => x >= inicio);
  const textoCompara = periodo === 1 ? `promedio de ${compara.length === 1 ? 'el mes anterior' : `los ${compara.length} meses anteriores`}` : `los ${periodo} meses anteriores`;
  const etiquetaPeriodo = periodo === 1 ? nombreCorto : `últimos ${periodo} meses`;

  // ── Piezas ──
  const corto = (v) => {
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1e6) return `${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
    return `${Math.round(v / 1000)} mil`;
  };
  const cuadro = (orden, titulo, aclaracion, ...contenido) => h('section', { class: 'fz-an-cuadro', style: `order:${orden}` },
    h('h2', {}, h('span', {}, titulo), aclaracion ? h('small', {}, aclaracion) : null), contenido);
  const sub = (t) => h('p', { class: 'fz-an-sub' }, t);
  const falta = (t = 'Todavía falta historia: cuando tengas más meses cargados vas a ver la comparación acá.') => h('p', { class: 'fz-an-falta' }, t);
  const estado = (bien, texto) => h('span', { class: `fz-an-estado ${bien ? 'bien' : 'mal'}` }, texto);
  const leyenda = (...items) => h('div', { class: 'fz-an-ley' }, items.map(([clase, t]) => h('span', {}, h('i', { class: clase }), t)));
  const fila = (a, b) => h('div', { class: 'fz-an-fila' }, h('span', {}, a), h('b', { class: 'num' }, b));

  const NS = 'http://www.w3.org/2000/svg';
  const svg = (w, alto) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', `0 -10 ${w} ${alto + 10}`); s.setAttribute('class', 'fz-an-svg'); return s; };
  const el = (p, tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
  const texto = (p, x, y, t, a = {}) => { const e = el(p, 'text', { x, y, ...a }); e.textContent = t; return e; };
  // Barra con el extremo redondeado y la base recta.
  const barra = (p, x, y, w, alto, clase, tip) => {
    if (alto <= 0) return null;
    const r = Math.min(4, w / 2, alto);
    const e = el(p, 'path', { d: `M${x},${y + alto}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + alto}Z`, class: clase });
    if (tip) e.setAttribute('data-tip', tip);
    return e;
  };
  const grilla = (p, W, H, min, max, pasos, izq) => {
    for (let i = 0; i <= pasos; i++) {
      const v = min + (max - min) * i / pasos, y = H - (i / pasos) * H;
      el(p, 'line', { x1: izq, x2: W, y1: y, y2: y, class: 'fz-an-guia' });
      texto(p, izq - 4, y + 3, corto(v), { 'text-anchor': 'end' });
    }
  };
  const techo = (v) => { if (v <= 0) return 1; const e = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / e * 2) / 2 * e; };

  // ── 1. Cómo venís este mes ──
  function cuadroTermometro() {
    const dia = esActual ? Number(hoy().slice(8, 10)) : diasDelMes(mes);
    const este = acumuladoPorDia(d, mes);
    const previos = mesesHasta(sumarMeses(mes, -1), 3).filter(x => x >= inicio && d.gastosDelMes(x).length);
    const titulo = esActual ? 'Cómo venís este mes' : `Cómo cerró ${nombreCorto}`;
    const aclara = esActual ? `al día ${dia}` : null;
    const valor = este[dia - 1] || 0;
    if (!previos.length) return cuadro(1, titulo, aclara, sub('Gastado hasta hoy'), h('div', { class: 'fz-an-hero num' }, plata(valor)), falta());
    const largo = diasDelMes(mes);
    const prom = Array.from({ length: largo }, (_, i) => redondear(suma(previos, x => { const a = acumuladoPorDia(d, x); return a[Math.min(i, a.length - 1)]; }) / previos.length));
    const dif = redondear(valor - prom[dia - 1]);
    const W = 320, H = 105, izq = 40, s = svg(W, H + 16), max = techo(Math.max(...prom, valor));
    grilla(s, W, H, 0, max, 2, izq);
    const x = (i) => izq + i / (largo - 1) * (W - izq), y = (v) => H - v / max * H;
    el(s, 'path', { d: 'M' + prom.map((v, i) => `${x(i)},${y(v)}`).join('L'), class: 'fz-an-linea prom' });
    el(s, 'path', { d: 'M' + este.slice(0, dia).map((v, i) => `${x(i)},${y(v)}`).join('L'), class: 'fz-an-linea s2' });
    el(s, 'circle', { cx: x(dia - 1), cy: y(valor), r: 4, class: 'fz-an-punto s2' });
    for (const n of [1, 10, 20, largo]) texto(s, x(n - 1), H + 13, String(n), { 'text-anchor': 'middle' });
    for (let i = 0; i < largo; i++) el(s, 'rect', { class: 'fz-an-hit', x: x(i) - 4, y: 0, width: 8, height: H, 'data-tip': `Día ${i + 1}: ${i < dia ? `${nombreCorto} ${plata(este[i])} · ` : ''}promedio ${plata(prom[i])}` });
    return cuadro(1, titulo, aclara,
      sub(esActual ? 'Gastado hasta hoy contra lo que solés llevar a esta altura' : 'Gastado en el mes contra tu promedio'),
      h('div', { class: 'fz-an-titular' }, h('span', { class: 'fz-an-hero num' }, plata(valor)),
        Math.abs(dif) < 1 ? estado(true, 'Igual que lo normal') : estado(dif < 0, `${dif > 0 ? '▲' : '▼'} ${plata(Math.abs(dif))} ${dif > 0 ? 'más' : 'menos'} que lo normal`)),
      leyenda(['lin s2', nombreCorto[0].toUpperCase() + nombreCorto.slice(1)], ['lin prom', `Promedio ${previos.length === 1 ? 'del mes anterior' : `últimos ${previos.length} meses`}`]),
      s);
  }

  // ── 2. Proyección a fin de mes ──
  function cuadroProyeccion() {
    if (!esActual) return null;
    const r = d.resumenMes(mes);
    const dia = Number(hoy().slice(8, 10));
    const restan = Math.max(0, diasDelMes(mes) - dia);
    const variables = d.movimientos.filter(x => x.tipo === 'gasto' && mesDe(x.fecha) === mes && d.categoria(x.categoriaId)?.tipo !== 'fijo');
    const porDia = Math.round(suma(variables, x => x.importe) / dia);
    const final = Math.round(r.disponible - porDia * restan);
    const tope = restan ? Math.floor(Math.max(0, r.disponible) / restan) : 0;
    return cuadro(2, 'Proyección a fin de mes', null, sub('Si seguís gastando a este ritmo'),
      h('div', { class: `fz-an-hero num${final < 0 ? ' neg' : ''}` }, plata(final)),
      sub(`de Disponible el ${diasDelMes(mes)}/${mes.slice(5, 7)} (hoy ${plata(r.disponible)})`),
      h('div', { class: 'fz-an-lista' },
        fila('Gasto variable por día', plata(porDia)),
        fila('Días que faltan', String(restan)),
        restan ? fila('Máximo por día para no quedar en rojo', plata(tope)) : null));
  }

  // ── 3. Colchón ──
  function cuadroColchon() {
    const corte = esActual ? null : finDeMes(mes);
    const tengo = suma([...d.cuentasActivas('cuenta'), ...d.cuentasActivas('reserva')], c => d.saldo(c.id, corte));
    const fijos = suma(d.fijosDelMes(mes), f => f.presupuesto);
    if (!fijos) return cuadro(3, 'Colchón', null, sub('Cuántos meses de gastos fijos cubrís con lo que tenés'), falta('Cargá el presupuesto de tus gastos fijos para ver este número.'));
    const meses = Math.max(0, tengo / fijos);
    return cuadro(3, 'Colchón', null, sub('Con lo que tenés en cuentas y reservas, cubrís'),
      h('div', { class: 'fz-an-hero num' }, `${meses.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${meses >= 0.95 && meses < 1.05 ? 'mes' : 'meses'}`),
      sub(`de gastos fijos (${plata(fijos)}/mes)`),
      h('div', { class: 'fz-an-progreso', 'data-tip': `${plata(tengo)} en cuentas y reservas` }, h('span', { style: `width:${Math.min(100, meses / META_COLCHON * 100)}%` })),
      h('div', { class: 'fz-an-ley entre' }, h('span', {}, '0'), h('span', {}, `Meta: ${META_COLCHON} meses`)));
  }

  // ── 4. Regla 50 / 30 / 20 ──
  function cuadro503020() {
    const cl = clasificacion(d);
    const ingreso = suma(delPeriodo, x => suma(d.ingresosDelMes(x), i => i.importe));
    let nec = 0, gus = 0;
    for (const x of delPeriodo) for (const g of d.gastosDelMes(x)) { if (cl.de(g.categoriaId) === 'nec') nec += g.importe; else gus += g.importe; }
    nec = redondear(nec); gus = redondear(gus);
    const ahorro = redondear(ingreso - nec - gus);
    const boton = h('button', { type: 'button', class: 'fz-an-boton', onclick: () => abrirClasificar() }, 'Clasificar categorías');
    if (!ingreso) return cuadro(4, 'Regla 50 / 30 / 20', etiquetaPeriodo, sub('Lo ideal: 50 % a necesidades, 30 % a gustos y 20 % a ahorro'), falta('Hace falta cargar ingresos en este período para calcularla.'), boton);
    const filas = [['Necesidades', nec, 50, 'max'], ['Gustos', gus, 30, 'max'], ['Ahorro', ahorro, 20, 'min']].map(([n, v, meta, tipo]) => {
      const p = pct(v, ingreso);
      const dif = p - meta;
      const bien = tipo === 'max' ? dif <= 0 : dif >= 0;
      return h('div', { class: 'fz-an-r5', 'data-tip': `${n}: ${plata(v)} · ideal ${tipo === 'max' ? 'hasta' : 'desde'} ${plata(ingreso * meta / 100)}` },
        h('span', {}, n),
        h('span', { class: 'fz-an-r5-barra' }, h('span', { style: `width:${Math.max(0, Math.min(100, p))}%` }), h('em', { style: `left:calc(${meta}% - 1px)` })),
        h('span', { class: 'fz-an-r5-v num' }, h('b', {}, `${p} %`), dif ? estado(bien, `${dif > 0 ? '▲' : '▼'} ${Math.abs(dif)}`) : estado(true, '✓')));
    });
    const faltaAhorro = Math.round(ingreso * 0.2 - ahorro);
    return cuadro(4, 'Regla 50 / 30 / 20', etiquetaPeriodo,
      sub(`Sobre ${plata(ingreso)} de ingreso. Lo ideal: 50 % a necesidades, 30 % a gustos y 20 % a ahorro`),
      h('div', { class: 'fz-an-r5s' }, filas),
      leyenda(['s1', periodo === 1 ? 'Tu mes' : 'Tu período'], ['tick', 'Ideal']),
      sub(faltaAhorro > 0 ? `Para llegar al 20 % de ahorro te faltan ${plata(faltaAhorro)}. Lo que pasás a inversiones cuenta como ahorro.` : 'Estás ahorrando el 20 % o más. Lo que pasás a inversiones cuenta como ahorro.'),
      boton);
  }

  // Ventana para pasar categorías entre Necesidades y Gustos.
  function abrirClasificar() {
    const cl = clasificacion(d);
    const cambios = { ...cl.guardado };
    const tipoDe = (id) => {
      if (cambios[id]) return cambios[id];
      const c = d.categoria(id);
      if (c?.padreId) return tipoDe(c.padreId);
      return c?.tipo === 'fijo' ? 'nec' : 'gus';
    };
    const principales = [...d.categoriasDe('fijo'), ...d.categoriasDe('variable')];
    const conAjuste = d.movimientos.some(x => x.categoriaId === AJUSTE);
    const subsDe = (id) => d.categorias.filter(c => c.padreId === id && !c.archivada);
    const columnas = { nec: h('div', { class: 'fz-clas-col', 'data-tipo': 'nec' }), gus: h('div', { class: 'fz-clas-col', 'data-tipo': 'gus' }) };
    const guardar = async () => { await m.guardarClasificacion(cambios); };
    const mover = async (id, destino) => {
      const c = d.categoria(id);
      const antes = tipoDe(id);
      if (antes === destino) return;
      cambios[id] = destino;
      // La categoría arrastra a las subcategorías que estaban con ella.
      if (c && !c.padreId) for (const sc of subsDe(id)) if (tipoDe(sc.id) === antes) cambios[sc.id] = destino;
      dibujarCols();
      await guardar();
    };
    const item = (c, esSub, padre) => {
      const t = tipoDe(c.id);
      const otro = t === 'nec' ? 'gus' : 'nec';
      return h('div', { class: `fz-clas-it${esSub ? ' sub' : ''}`, 'data-id': c.id },
        h('span', {}, c.nombre, padre ? h('small', {}, ` · ${padre}`) : null, !esSub && c.tipo === 'fijo' ? h('em', {}, 'fijo') : null),
        h('button', { type: 'button', title: `Pasar a ${otro === 'nec' ? 'Necesidades' : 'Gustos'}`, 'aria-label': `Pasar ${c.nombre} a ${otro === 'nec' ? 'Necesidades' : 'Gustos'}`, onclick: () => mover(c.id, otro) }, t === 'nec' ? '→' : '←'));
    };
    function dibujarCols() {
      const listas = { nec: [], gus: [] };
      for (const c of principales) {
        const t = tipoDe(c.id);
        listas[t].push(item(c, false));
        for (const sc of subsDe(c.id)) { const ts = tipoDe(sc.id); listas[ts].push(item(sc, true, ts !== t ? c.nombre : null)); }
      }
      if (conAjuste) listas[tipoDe(AJUSTE)].push(item(d.categoria(AJUSTE), false));
      poner(columnas.nec, h('h3', {}, 'Necesidades ', h('small', {}, 'meta 50 %')), listas.nec);
      poner(columnas.gus, h('h3', {}, 'Gustos ', h('small', {}, 'meta 30 %')), listas.gus);
    }
    dibujarCols();
    // Arrastrar de una columna a la otra.
    const zona = h('div', { class: 'fz-clas-cols' }, columnas.nec, columnas.gus);
    zona.addEventListener('pointerdown', (e) => {
      const it = e.target.closest('.fz-clas-it');
      if (!it || e.target.closest('button') || e.button > 0) return;
      e.preventDefault();
      const r = it.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      const copia = it.cloneNode(true);
      copia.classList.add('volando');
      Object.assign(copia.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
      it.closest('dialog').append(copia);
      it.classList.add('origen');
      const cols = [columnas.nec, columnas.gus];
      const sobre = (ev) => cols.find(c => { const b = c.getBoundingClientRect(); return ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top && ev.clientY <= b.bottom; });
      const mv = (ev) => { copia.style.left = `${ev.clientX - dx}px`; copia.style.top = `${ev.clientY - dy}px`; cols.forEach(c => c.classList.toggle('sobre', c === sobre(ev))); };
      const up = (ev) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        copia.remove(); it.classList.remove('origen'); cols.forEach(c => c.classList.remove('sobre'));
        const c = sobre(ev);
        if (c) mover(it.dataset.id, c.dataset.tipo);
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    hoja(ctx, {
      titulo: 'Necesidad o gusto', ancho: 'ancha', textoGuardar: 'Listo', sinCancelar: true,
      cuerpo: [h('p', { class: 'nota' }, 'Arrastrá cada categoría a su columna, o tocá la flecha. Las subcategorías se mueven con su categoría; si una es distinta, movela sola. Se guarda al instante.'), zona],
      alGuardar: async () => {},
    });
  }

  // ── 5. En qué se va la plata ──
  const abiertas = new Set();
  function cuadroCategorias() {
    const sumar = (meses) => {
      const total = new Map();
      for (const x of meses) for (const [id, v] of gastoPorCategoria(d, x)) {
        if (!total.has(id)) total.set(id, { cat: v.cat, total: 0, subs: new Map() });
        const t = total.get(id);
        t.total += v.total;
        for (const [k, s] of v.subs) t.subs.set(k, { nombre: s.nombre, total: (t.subs.get(k)?.total || 0) + s.total });
      }
      return total;
    };
    const ahora = sumar(delPeriodo), antes = sumar(compara);
    const lista = [...ahora.values()].map(x => ({ ...x, prom: compara.length ? (antes.get(x.cat.id)?.total || 0) / compara.length : null, val: x.total / delPeriodo.length }))
      .sort((a, b) => b.val - a.val);
    const titulo = 'En qué se va la plata';
    const aclara = periodo === 1 ? nombreCorto : `por mes · ${etiquetaPeriodo}`;
    if (!lista.length) return cuadro(5, titulo, aclara, falta('No hay gastos variables en este período.'));
    const max = Math.max(...lista.map(x => Math.max(x.val, x.prom || 0)));
    const filas = lista.slice(0, 10).map(x => {
      const dif = x.prom ? Math.round((x.val - x.prom) / x.prom * 100) : null;
      const abierta = abiertas.has(x.cat.id);
      const subs = [...x.subs.values()].filter(s => s.total).sort((a, b) => b.total - a.total);
      return [
        h('button', { type: 'button', class: `fz-an-cat${abierta ? ' abierta' : ''}`, 'aria-expanded': String(abierta), 'data-tip': `${x.cat.nombre}: ${plata(x.val)}${x.prom !== null ? ` · promedio ${plata(x.prom)}` : ''}`, onclick: () => { abierta ? abiertas.delete(x.cat.id) : abiertas.add(x.cat.id); dibujarTodo(); } },
          h('span', { class: 'n' }, x.cat.nombre),
          h('span', { class: 'b' }, h('span', { style: `width:${x.val / max * 100}%` }), x.prom ? h('em', { style: `left:calc(${x.prom / max * 100}% - 1px)` }) : null),
          h('span', { class: 'v num' }, plata(Math.round(x.val)), dif !== null && Math.abs(dif) >= 1 ? h('b', { class: dif > 5 ? 'neg' : dif < -5 ? 'pos' : '' }, ` ${dif > 0 ? '▲' : '▼'} ${Math.abs(dif)} %`) : null)),
        abierta && subs.length > 1 ? h('div', { class: 'fz-an-subs' }, subs.map(s => fila(s.nombre, plata(Math.round(s.total / delPeriodo.length))))) : null];
    });
    return cuadro(5, titulo, aclara,
      leyenda(['s2', periodo === 1 ? 'Este mes' : 'Promedio del período'], ...(compara.length ? [['tick', `Tu promedio (${textoCompara})`]] : [])),
      filas,
      compara.length ? null : falta(),
      h('a', { href: '#/finanzas/detalle/variables', class: 'fz-an-link' }, 'Tocá una categoría para ver sus subcategorías · ver detalle completo ›'));
  }

  // ── 6. Lo que más cambió ──
  function cuadroCambios() {
    const aclara = `vs. ${textoCompara}`;
    if (!compara.length) return cuadro(6, 'Lo que más cambió', null, falta());
    const prom = (meses) => {
      const t = new Map();
      for (const x of meses) for (const [id, v] of gastoPorCategoria(d, x, false)) t.set(id, { cat: v.cat, total: (t.get(id)?.total || 0) + v.total });
      for (const v of t.values()) v.total /= meses.length;
      return t;
    };
    const a = prom(delPeriodo), b = prom(compara);
    const cambios = [];
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const ahora = a.get(id)?.total || 0, antes = b.get(id)?.total || 0;
      if (!antes || Math.abs(ahora - antes) < 1000) continue;
      cambios.push({ nombre: (a.get(id) || b.get(id)).cat.nombre, p: Math.round((ahora - antes) / antes * 100), dif: ahora - antes });
    }
    const suben = cambios.filter(x => x.p > 0).sort((x, y) => y.p - x.p).slice(0, 3);
    const bajan = cambios.filter(x => x.p < 0).sort((x, y) => x.p - y.p).slice(0, 3);
    const col = (titulo, l, clase, flecha) => h('div', {}, h('h3', {}, titulo),
      l.length ? l.map(x => h('div', { class: 'fz-an-fila', 'data-tip': `${x.nombre}: ${x.dif > 0 ? '+' : '−'}${plata(Math.abs(x.dif))} por mes` }, h('span', {}, x.nombre), h('b', { class: `num ${clase}` }, `${flecha} ${Math.abs(x.p)} %`))) : h('p', { class: 'fz-an-sub' }, 'Nada.'));
    return cuadro(6, 'Lo que más cambió', aclara, h('div', { class: 'fz-an-dos' }, col('Subió', suben, 'neg', '▲'), col('Bajó', bajan, 'pos', '▼')));
  }

  // ── 7. Ingresos y gastos, 12 meses ──
  function cuadroIngresosGastos() {
    const meses = mesesHasta(mes, 12).filter(x => x >= inicio);
    const datos = meses.map(x => ({ mes: x, ing: suma(d.ingresosDelMes(x), i => i.importe), gas: suma(d.gastosDelMes(x), g => g.importe) }));
    const W = 360, H = 140, izq = 40, s = svg(W, H + 16), max = techo(Math.max(1, ...datos.flatMap(x => [x.ing, x.gas])));
    grilla(s, W, H, 0, max, 4, izq);
    const paso = (W - izq) / Math.max(datos.length, 6), bw = Math.max(4, Math.min(12, paso / 2 - 3));
    datos.forEach((x, i) => {
      const cx = izq + i * paso + paso / 2;
      barra(s, cx - bw - 1, H - x.ing / max * H, bw, x.ing / max * H, 's1', `${nombreMes(x.mes)}: ingresos ${plata(x.ing)}`);
      barra(s, cx + 1, H - x.gas / max * H, bw, x.gas / max * H, 's2', `${nombreMes(x.mes)}: gastos ${plata(x.gas)}${x.mes === actual ? ' (mes en curso)' : ''}`);
      texto(s, cx, H + 13, mesCorto(x.mes).toLowerCase(), { 'text-anchor': 'middle' });
    });
    const ahorros = datos.map(x => ({ ...x, p: x.ing ? pct(x.ing - x.gas, x.ing) : null }));
    const cerrados = ahorros.filter(x => x.mes !== actual && x.p !== null);
    const promedio = cerrados.length ? Math.round(cerrados.reduce((a, x) => a + x.p, 0) / cerrados.length) : null;
    const fila = h('div', { class: 'fz-an-ahorro', style: `padding-left:${izq / W * 100}%;grid-template-columns:repeat(${Math.max(datos.length, 6)},1fr)` },
      ahorros.map(x => h('span', { class: x.p !== null && x.p < 0 ? 'neg' : '' }, x.mes === actual || x.p === null ? '…' : `${x.p}%`)));
    return cuadro(7, 'Ingresos y gastos', datos.length < 12 ? `${datos.length} ${datos.length === 1 ? 'mes' : 'meses'}` : '12 meses',
      leyenda(['s1', 'Ingresos'], ['s2', 'Gastos']), s, fila,
      sub(`Abajo: porcentaje de lo que te quedó de cada mes.${promedio !== null ? ` Promedio: ${promedio} %` : ''}`));
  }

  // ── 8. Fijos y variables ──
  function cuadroFijosVariables() {
    const meses = mesesHasta(mes, 6).filter(x => x >= inicio);
    const datos = meses.map(x => {
      const gastos = d.gastosDelMes(x);
      const fijos = suma(gastos.filter(g => d.categoria(g.categoriaId)?.tipo === 'fijo'), g => g.importe);
      return { mes: x, fijos, variables: redondear(suma(gastos, g => g.importe) - fijos) };
    });
    const W = 320, H = 110, izq = 40, s = svg(W, H + 16), max = techo(Math.max(1, ...datos.map(x => x.fijos + x.variables)));
    grilla(s, W, H, 0, max, 2, izq);
    const paso = (W - izq) / 6, bw = Math.min(22, paso - 14);
    datos.forEach((x, i) => {
      const bx = izq + i * paso + paso / 2 - bw / 2, hf = x.fijos / max * H, hv = x.variables / max * H;
      if (hf > 0) el(s, 'rect', { x: bx, y: H - hf, width: bw, height: hf, class: 's1', 'data-tip': `${nombreMes(x.mes)}: fijos ${plata(x.fijos)}` });
      barra(s, bx, H - hf - (hf > 0 ? 2 : 0) - hv, bw, hv, 's2', `${nombreMes(x.mes)}: variables ${plata(x.variables)}`);
      texto(s, bx + bw / 2, H + 13, mesCorto(x.mes).toLowerCase(), { 'text-anchor': 'middle' });
    });
    const ult = datos[datos.length - 1];
    const fijosMes = d.fijosDelMes(mes);
    const fam = suma(fijosMes.filter(f => f.grupo === 'familia'), f => f.gastado), per = suma(fijosMes.filter(f => f.grupo === 'personal'), f => f.gastado);
    return cuadro(8, 'Fijos y variables', `${datos.length} ${datos.length === 1 ? 'mes' : 'meses'}`,
      leyenda(['s1', 'Fijos'], ['s2', 'Variables']), s,
      h('div', { class: 'fz-an-lista' },
        ult && ult.fijos + ult.variables ? fila(`${nombreCorto[0].toUpperCase() + nombreCorto.slice(1)}, fijos`, `${pct(ult.fijos, ult.fijos + ult.variables)} %`) : null,
        fam + per ? fila('Familia / Personal (fijos)', `${pct(fam, fam + per)} % / ${100 - pct(fam, fam + per)} %`) : null));
  }

  // ── 9. Crédito comprometido ──
  function cuadroCredito() {
    const porMes = new Map();
    for (const cr of d.creditosActivos()) for (const r of d.resumenes(cr.id)) {
      if (r.pendiente <= 0) continue;
      const mv = mesDe(r.vencimiento);
      if (mv <= mes) continue;
      porMes.set(mv, (porMes.get(mv) || 0) + r.pendiente);
    }
    const meses = Array.from({ length: 6 }, (_, i) => sumarMeses(mes, i + 1));
    const valores = meses.map(x => redondear(porMes.get(x) || 0));
    if (!valores.some(Boolean)) return cuadro(9, 'Crédito ya comprometido', 'cuotas futuras', sub('No tenés nada comprometido para los próximos meses.'));
    const previos = mesesHasta(mes, 3).filter(x => x >= inicio && x !== actual);
    const ingreso = previos.length ? suma(previos, x => suma(d.ingresosDelMes(x), i => i.importe)) / previos.length : suma(d.ingresosDelMes(mes), i => i.importe);
    const W = 320, H = 95, izq = 40, s = svg(W, H + 30), max = techo(Math.max(...valores));
    grilla(s, W, H, 0, max, 2, izq);
    const paso = (W - izq) / 6, bw = Math.min(22, paso - 14);
    meses.forEach((x, i) => {
      const bx = izq + i * paso + paso / 2 - bw / 2, alto = valores[i] / max * H;
      barra(s, bx, H - alto, bw, alto, 's1', `Vence en ${nombreMes(x).toLowerCase()}: ${plata(valores[i])}${ingreso ? ` · ${pct(valores[i], ingreso)} % del ingreso` : ''}`);
      texto(s, bx + bw / 2, H + 13, mesCorto(x).toLowerCase(), { 'text-anchor': 'middle' });
      if (ingreso) texto(s, bx + bw / 2, H + 26, `${pct(valores[i], ingreso)} %`, { 'text-anchor': 'middle', class: 'fuerte' });
    });
    return cuadro(9, 'Crédito ya comprometido', 'cuotas futuras',
      sub(ingreso ? 'Lo que ya debés en los próximos meses, y qué parte de tu ingreso promedio es' : 'Lo que ya debés en los próximos meses'), s);
  }

  // ── 10. Patrimonio ──
  function cuadroPatrimonio() {
    const meses = mesesHasta(mes, 12).filter(x => x >= inicio);
    const corte = (x) => (x === actual ? hoy() : finDeMes(x));
    const datos = meses.map(x => ({ mes: x, v: patrimonioAl(d, corte(x)) }));
    const ultimo = datos[datos.length - 1]?.v || 0;
    const titulo = h('div', { class: 'fz-an-titular' }, h('span', { class: 'fz-an-hero num' }, plata(ultimo)));
    if (datos.length >= 2) {
      const dif = redondear(ultimo - datos[0].v);
      titulo.append(estado(dif >= 0, `${dif >= 0 ? '▲' : '▼'} ${plata(Math.abs(dif))} desde ${mesCorto(datos[0].mes).toLowerCase()}`));
    }
    if (datos.length < 2) return cuadro(10, 'Patrimonio', null, sub('Cuentas + reservas + inversiones − deuda de tarjetas y préstamos'), titulo, falta());
    const vals = datos.map(x => x.v);
    let min = Math.min(...vals), max = Math.max(...vals);
    const margen = (max - min) * 0.15 || Math.abs(max) * 0.1 || 1;
    min -= margen; max += margen;
    const W = 320, H = 95, izq = 44, s = svg(W, H + 16);
    grilla(s, W, H, min, max, 2, izq);
    const x = (i) => izq + i * (W - izq) / (datos.length - 1), y = (v) => H - (v - min) / (max - min) * H;
    el(s, 'path', { d: 'M' + datos.map((p, i) => `${x(i)},${y(p.v)}`).join('L'), class: 'fz-an-linea s1' });
    el(s, 'circle', { cx: x(datos.length - 1), cy: y(ultimo), r: 4, class: 'fz-an-punto s1' });
    const salto = Math.ceil(datos.length / 5);
    datos.forEach((p, i) => {
      el(s, 'rect', { class: 'fz-an-hit', x: x(i) - 10, y: 0, width: 20, height: H, 'data-tip': `${nombreMes(p.mes)}: ${plata(p.v)}` });
      if (i % salto === 0 || i === datos.length - 1) texto(s, x(i), H + 13, mesCorto(p.mes).toLowerCase(), { 'text-anchor': 'middle' });
    });
    return cuadro(10, 'Patrimonio', `${datos.length} meses`, sub('Cuentas + reservas + inversiones − deuda de tarjetas y préstamos'), titulo, s);
  }

  // ── Armado ──
  const tip = h('div', { class: 'fz-an-tip', role: 'status' });
  function dibujarTodo() {
    const filtro = h('div', { class: 'fz-an-filtro' }, h('span', { class: 'nota' }, 'Período:'),
      PERIODOS.map(([v, t]) => h('button', { type: 'button', class: `fz-an-chip${v === periodo ? ' activo' : ''}`, onclick: () => { guardarPeriodo(v); vistaAnalisis(cuerpo, ctx, m, d, { mes }); } }, t)));
    const columnas = [
      [cuadroTermometro(), cuadroIngresosGastos(), cuadroPatrimonio()],
      [cuadroProyeccion(), cuadroCategorias(), cuadroCredito()],
      [cuadroColchon(), cuadro503020(), cuadroCambios(), cuadroFijosVariables()],
    ];
    poner(cuerpo, filtro, h('div', { class: 'fz-an-grilla' }, columnas.map(c => h('div', { class: 'fz-an-col' }, c))),
      h('p', { class: 'nota' }, inicio > sumarMeses(mes, -2) ? 'Con pocos meses cargados, algunos cuadros todavía no pueden comparar. Se completan solos a medida que cargás.' : null),
      tip);
  }

  // Detalle al pasar el mouse o tocar.
  const mostrar = (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t || !cuerpo.contains(t)) { tip.classList.remove('visible'); return; }
    tip.textContent = t.dataset.tip;
    tip.classList.add('visible');
    const x = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, e.clientY - 40)}px`;
  };
  cuerpo.onpointermove = mostrar;
  cuerpo.onpointerdown = mostrar;
  cuerpo.onpointerleave = () => tip.classList.remove('visible');

  dibujarTodo();
}
