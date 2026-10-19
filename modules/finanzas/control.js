// ─────────────────────────────────────────────────────────────
// Finanzas: controlar un resumen de crédito contra el del banco.
// Se tilda cada gasto (o cuota) que aparece en el resumen del banco y se
// agregan los que faltan; esos van al resumen que les toca por su fecha.
//
// Se guarda:
//   movimientos.controlado  ['AAAA-MM', ...]  resúmenes donde esa compra ya se tildó
//                           (una compra en cuotas se tilda mes a mes)
//   creditos.totalBanco     { 'AAAA-MM': monto }  el total que dice el resumen del banco
// ─────────────────────────────────────────────────────────────

import { plata, redondear, nombreMes, fechaCorta, hoy } from './modelo.js';
import { hoja, campo, inputImporte, poner } from './comun.js';
import { abrirMovimiento } from './formularios.js';

const leerImporte = (input) => redondear(Number(String(input.value).replace(',', '.')));

export function abrirControlResumen(ctx, m, d, credito, mesInicial) {
  const { h } = ctx;
  let mes = mesInicial;
  let soloFaltan = false;
  let cr = credito;

  const meses = h('div', { class: 'fz-ctrl-meses', role: 'tablist' });
  const fechas = h('p', { class: 'nota fz-ctrl-fechas' });
  const cuenta = h('span', { class: 'nota' });
  const montos = h('span', { class: 'num' });
  const barra = h('i');
  const banco = inputImporte(ctx, '', '$ 0');
  const dif = h('p', { class: 'fz-ctrl-dif' });
  const filtro = h('input', { type: 'checkbox' });
  const lista = h('div', { class: 'fz-ctrl-lista' });
  const agregar = h('button', { type: 'button', class: 'fz-ctrl-agregar' }, '+ Me falta un gasto');

  const resumen = () => d.resumenes(cr.id).find(r => r.mes === mes);
  const tildado = (q) => (q.mov.controlado || []).includes(q.mes);

  // El total del banco se guarda al salir del campo, para no escribir en cada tecla.
  banco.addEventListener('input', () => dibujarTotales());
  banco.addEventListener('change', async () => {
    const totalBanco = { ...(cr.totalBanco || {}) };
    const v = leerImporte(banco);
    if (v > 0) totalBanco[mes] = v; else delete totalBanco[mes];
    cr = { ...cr, totalBanco };
    await m.actualizar('creditos', cr.id, { totalBanco });
  });
  filtro.addEventListener('change', () => { soloFaltan = filtro.checked; dibujarLista(); });
  agregar.addEventListener('click', agregarFaltante);

  function dibujar() {
    const todos = d.resumenes(cr.id).map(r => r.mes);
    if (!todos.includes(mes)) todos.push(mes);
    todos.sort();
    poner(meses, todos.map(x => h('button', {
      type: 'button', role: 'tab', class: x === mes ? 'sel' : '', 'aria-selected': String(x === mes),
      onclick: () => { mes = x; dibujar(); },
    }, nombreMes(x, false))));
    meses.querySelector('.sel')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    const f = d.fechasResumen(cr, mes);
    fechas.textContent = `Cierra el ${fechaCorta(f.cierre)} · vence el ${fechaCorta(f.vencimiento)}`;
    const guardado = cr.totalBanco?.[mes];
    banco.value = guardado ? String(guardado).replace('.', ',') : '';
    dibujarTotales();
    dibujarLista();
  }

  function dibujarTotales() {
    const items = resumen()?.items || [];
    const ok = items.filter(tildado);
    const total = redondear(items.reduce((a, q) => a + q.importe, 0));
    cuenta.textContent = `Tildados ${ok.length} de ${items.length}`;
    montos.textContent = `${plata(ok.reduce((a, q) => a + q.importe, 0))} de ${plata(total)}`;
    barra.style.width = `${items.length ? (ok.length / items.length) * 100 : 0}%`;
    const b = leerImporte(banco);
    dif.hidden = !(b > 0);
    if (b > 0) {
      const x = redondear(b - total);
      dif.className = `fz-ctrl-dif ${Math.abs(x) < 1 ? 'ok' : 'mal'}`;
      dif.textContent = Math.abs(x) < 1 ? 'Coincide con el banco.'
        : x > 0 ? `Al banco le da ${plata(x)} más: te falta anotar algo.` : `Anotaste ${plata(-x)} más que el banco.`;
    }
  }

  function dibujarLista() {
    const items = [...(resumen()?.items || [])].sort((a, b) => a.mov.fecha.localeCompare(b.mov.fecha));
    const ver = soloFaltan ? items.filter(q => !tildado(q)) : items;
    if (!ver.length) {
      poner(lista, h('p', { class: 'nota' }, items.length ? 'Ya tildaste todo.' : 'No hay gastos en este resumen.'));
      return;
    }
    poner(lista, ver.map(q => {
      const fila = h('div', { class: `fz-ctrl-item${tildado(q) ? ' ok' : ''}`, role: 'checkbox', tabindex: '0', 'aria-checked': String(tildado(q)) },
        h('span', { class: 'fz-ctrl-tilde' }),
        h('span', { class: 'fz-ctrl-desc' },
          h('b', {}, q.mov.descripcion || d.nombreCategoria(q.mov.categoriaId)),
          h('small', {}, fechaCorta(q.mov.fecha), q.total > 1 ? ` · cuota ${q.numero}/${q.total}` : '')),
        h('span', { class: 'num' }, plata(q.importe)));
      const cambiar = () => tildar(q);
      fila.addEventListener('click', cambiar);
      fila.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cambiar(); } });
      return fila;
    }));
  }

  async function tildar(q) {
    const actual = q.mov.controlado || [];
    const nuevo = actual.includes(q.mes) ? actual.filter(x => x !== q.mes) : [...actual, q.mes];
    q.mov.controlado = nuevo;   // se ve al instante; el guardado va por detrás
    dibujarTotales();
    dibujarLista();
    await m.actualizar('movimientos', q.mov.id, { controlado: nuevo });
  }

  // Gasto que falta: el formulario de siempre, con esta tarjeta y una fecha
  // que cae en este resumen. Si se cambia la fecha, va al resumen que le toque.
  async function agregarFaltante() {
    const f = d.fechasResumen(cr, mes);
    const fecha = d.mesResumenDe(cr, hoy()) === mes ? hoy() : f.cierre;
    const antes = new Set(d.movimientos.map(x => x.id));
    const ok = await abrirMovimiento(ctx, m, d, 'gasto', null, { creditoId: cr.id, fecha });
    if (!ok) return;
    d = await m.cargar();
    cr = d.credito(cr.id) || cr;
    const nuevo = d.movimientos.find(x => !antes.has(x.id) && x.creditoId === cr.id);
    if (nuevo) {
      const destino = d.mesResumenDe(cr, nuevo.fecha);
      if (destino === mes) {
        nuevo.controlado = [mes];
        await m.actualizar('movimientos', nuevo.id, { controlado: [mes] });
      } else {
        ctx.aviso(`Quedó en el resumen de ${nombreMes(destino, false).toLowerCase()}, por su fecha.`);
      }
    }
    dibujar();
  }

  dibujar();
  const listo = hoja(ctx, {
    titulo: `${cr.nombre}: controlar resumen`,
    ancho: 'fz-ctrl',
    alGuardar: null,
    cuerpo: [
      meses, fechas,
      h('div', { class: 'fz-ctrl-panel' },
        h('div', { class: 'fz-ctrl-fila' }, cuenta, montos),
        h('div', { class: 'fz-ctrl-prog' }, barra),
        campo(ctx, 'Total que dice el resumen del banco', banco),
        dif),
      h('label', { class: 'fila-campo casilla fz-ctrl-filtro' }, filtro, h('span', { class: 'etiqueta-campo' }, 'Ver solo los que no tildé')),
      lista,
      agregar,
    ],
  });
  // La hoja enfoca el primer campo; acá eso abriría el teclado del celular sin motivo.
  document.activeElement?.blur();
  return listo;
}
