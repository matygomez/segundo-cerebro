// ─────────────────────────────────────────────────────────────
// Finanzas: hoja de movimientos.
// Columnas: fecha, tipo, importe, cuenta, categoría, cuotas, descripción.
// En la PC es una tabla ordenable; en el celular, una lista.
// ─────────────────────────────────────────────────────────────

import { plata, fechaCorta, nombreMes, mesDe, sumarMeses } from './modelo.js';
import { poner, ic, hoja, campo, inputImporte } from './comun.js';
import { abrirMovimiento } from './formularios.js';

// Se conservan mientras la app está abierta.
const estado = { texto: '', tipo: '', cuenta: '', mes: null, orden: { campo: 'fecha', desc: true }, elegido: null };

const TIPOS = {
  gasto: { texto: 'Gasto', clase: 'gasto' },
  ingreso: { texto: 'Ingreso', clase: 'ingreso' },
  transferencia: { texto: '⇄ Transferencia', clase: 'transferencia' },
  rendimiento: { texto: 'Rendimiento', clase: 'ingreso' },
  prestamo: { texto: 'Préstamo', clase: 'transferencia' },
  inicial: { texto: 'Saldo inicial', clase: 'inicial' },
};

export function vistaMovimientos(cuerpo, ctx, m, d, { mes }) {
  const { h } = ctx;
  if (estado.mes === null) estado.mes = mes;

  const tipoDe = (x) => (x.ajuste ? { texto: 'Ajuste', clase: 'ajuste' } : TIPOS[x.tipo] || { texto: x.tipo, clase: '' });
  const cuentaTexto = (x) => (x.tipo === 'transferencia' ? `${d.nombreCuenta(x.cuentaId)} → ${d.destino(x)}` : d.origen(x));
  const categoriaTexto = (x) => (x.categoriaId ? d.nombreCategoria(x.categoriaId) : x.tipo === 'prestamo' ? d.prestamo(x.prestamoId)?.persona || '—' : '—');
  const cuotasTexto = (x) => (x.creditoId && x.cuotas > 1 ? `${x.cuotas} cuotas` : '');

  // Importe con signo según el tipo (y según la cuenta filtrada en las transferencias).
  function importe(x) {
    const [t, id] = estado.cuenta ? [estado.cuenta.slice(0, 1), estado.cuenta.slice(2)] : ['', ''];
    if (x.tipo === 'inicial') return { txt: `${x.importe < 0 ? '−' : '+'} ${plata(Math.abs(x.importe))}`, clase: '', valor: x.importe };
    if (x.tipo === 'gasto') return { txt: `− ${plata(x.importe)}`, clase: 'neg', valor: -x.importe };
    if (x.tipo === 'ingreso') return { txt: `+ ${plata(x.importe)}`, clase: 'pos', valor: x.importe };
    if (x.tipo === 'rendimiento') return { txt: `${x.importe < 0 ? '−' : '+'} ${plata(Math.abs(x.importe))}`, clase: x.importe < 0 ? 'neg' : 'pos', valor: x.importe };
    if (x.tipo === 'prestamo') return { txt: `${x.sentido === 'entra' ? '+' : '−'} ${plata(x.importe)}`, clase: 'transf', valor: x.sentido === 'entra' ? x.importe : -x.importe };
    if (t === 'c' && x.cuentaId === id) return { txt: `− ${plata(x.importe)}`, clase: 'transf', valor: -x.importe };
    if ((t === 'c' && x.destinoId === id) || (t === 't' && x.destinoCreditoId === id)) return { txt: `+ ${plata(x.importe)}`, clase: 'transf', valor: x.importe };
    return { txt: `⇄ ${plata(x.importe)}`, clase: 'transf', valor: 0 };
  }

  function filtrados() {
    const q = estado.texto.toLowerCase().trim();
    const [t, id] = estado.cuenta ? [estado.cuenta.slice(0, 1), estado.cuenta.slice(2)] : ['', ''];
    const lista = d.movimientosTodos().filter(x =>
      (estado.mes === 'todos' || mesDe(x.fecha) === estado.mes) &&
      (!estado.tipo || (estado.tipo === 'ajuste' ? x.ajuste : x.tipo === estado.tipo && !x.ajuste)) &&
      (!t || (t === 'c' ? ((x.cuentaId === id && !x.creditoId) || x.destinoId === id) : (x.creditoId === id || x.destinoCreditoId === id))) &&
      (!q || `${x.descripcion || ''} ${categoriaTexto(x)} ${cuentaTexto(x)}`.toLowerCase().includes(q)));
    const { campo, desc } = estado.orden;
    const valor = (x) => ({ fecha: x.fecha + String(x.creado).padStart(15, '0'), tipo: tipoDe(x).texto, importe: importe(x).valor || x.importe, cuenta: cuentaTexto(x), categoria: categoriaTexto(x), cuotas: x.cuotas || 1, descripcion: x.descripcion || '' }[campo]);
    lista.sort((a, b) => { const va = valor(a), vb = valor(b); const r = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb)); return desc ? -r : r; });
    return lista;
  }

  function detalle(x) {
    const dl = (pares) => h('dl', { class: 'fz-dl' }, pares.filter(Boolean).map(([a, b]) => [h('dt', {}, a), h('dd', {}, b)]));
    const piernas = x.tipo === 'transferencia' ? [
      h('div', { class: 'fz-pierna' }, h('span', {}, `Sale de ${d.nombreCuenta(x.cuentaId)}`), h('b', { class: 'num transf' }, `− ${plata(x.importe)}`)),
      h('div', { class: 'fz-pierna' }, h('span', {}, `Entra a ${d.destino(x)}`), h('b', { class: 'num transf' }, `+ ${plata(x.importe)}`)),
      h('p', { class: 'nota' }, x.destinoCreditoId ? 'Pago de tarjeta: no cuenta como gasto (los gastos se anotaron al comprar).' : 'No cuenta como gasto ni como ingreso del mes.'),
    ] : [h('p', { class: `fz-detalle-importe num ${importe(x).clase}` }, importe(x).txt)];
    let cuotas = null;
    if (x.creditoId && x.cuotas > 1) {
      const lista = d.cuotas().filter(q => q.mov.id === x.id);
      cuotas = ['Cuotas', `${x.cuotas} de ${plata(lista[0]?.importe || 0)}, de ${nombreMes(lista[0].mes, false).toLowerCase()} a ${nombreMes(lista.at(-1).mes).toLowerCase()}`];
    }
    if (x.tipo === 'inicial') {
      const cuenta = d.cuenta(x.cuentaId);
      return [
        h('h2', {}, 'Detalle'),
        h('p', { class: 'fz-detalle-importe num' }, importe(x).txt),
        dl([['Tipo', h('span', { class: 'fz-tipo inicial' }, 'Saldo inicial')], ['Cuenta', d.nombreCuenta(x.cuentaId)], ['Fecha', fechaCorta(x.fecha) + '/' + x.fecha.slice(0, 4)]]),
        h('p', { class: 'nota' }, 'Es el saldo con el que arrancó la cuenta. No cuenta como ingreso del mes, porque es plata que ya tenías.'),
        h('div', { class: 'botonera' }, h('button', { type: 'button', class: 'boton chico', onclick: () => editarInicial(cuenta) }, 'Editar')),
      ];
    }
    const esInicial = x.tipo === 'prestamo' && x.inicial;
    return [
      h('h2', {}, 'Detalle'),
      ...piernas,
      dl([
        ['Tipo', h('span', { class: `fz-tipo ${tipoDe(x).clase}` }, tipoDe(x).texto)],
        ['Fecha', fechaCorta(x.fecha) + '/' + x.fecha.slice(0, 4)],
        x.tipo !== 'transferencia' ? [x.creditoId ? 'Crédito' : 'Cuenta', d.origen(x)] : null,
        x.tipo !== 'transferencia' && x.tipo !== 'rendimiento' ? ['Categoría', categoriaTexto(x)] : null,
        cuotas,
        ['Descripción', x.descripcion || '—'],
      ]),
      h('div', { class: 'botonera' },
        h('button', { type: 'button', class: 'boton chico', disabled: esInicial, onclick: () => abrirMovimiento(ctx, m, d, x.tipo, x) }, 'Editar'),
        h('button', {
          type: 'button', class: 'boton chico peligro', disabled: esInicial, onclick: async () => {
            if (!await ctx.confirmar('¿Borrar este movimiento? Los saldos se recalculan solos.', { si: 'Borrar', peligro: true })) return;
            await m.borrar('movimientos', x.id);
            estado.elegido = null;
            ctx.aviso('Movimiento borrado');
          },
        }, 'Borrar')),
      esInicial ? h('p', { class: 'nota' }, 'Es el movimiento que creó el préstamo: se maneja desde la vista de Préstamos.') : null,
    ];
  }

  function editarInicial(cuenta) {
    const valor = inputImporte(ctx, cuenta.saldoInicial);
    valor.removeAttribute('min');
    hoja(ctx, {
      titulo: `Saldo inicial de ${cuenta.nombre}`,
      cuerpo: [campo(ctx, 'Saldo inicial', valor, 'Cambia el punto de partida de la cuenta y, con él, su saldo actual. Para corregir el saldo de hoy usá "Ajustar".')],
      alGuardar: async () => {
        if (valor.value === '') return 'Escribí el saldo inicial.';
        await m.actualizar('cuentas', cuenta.id, { saldoInicial: Math.round(Number(valor.value) * 100) / 100 });
        ctx.aviso('Saldo inicial guardado');
      },
    });
  }

  // ── Filtros ──
  const meses = [...new Set([...d.movimientosTodos().map(x => mesDe(x.fecha)), mes])].sort().reverse();
  const op = (v, t, actual) => h('option', { value: v, selected: v === actual }, t);
  const buscador = h('input', { type: 'search', value: estado.texto, placeholder: 'Buscar por descripción, categoría o cuenta', 'aria-label': 'Buscar movimientos' });
  const selMes = h('select', { 'aria-label': 'Mes' }, op('todos', 'Todos los meses', estado.mes), meses.map(x => op(x, nombreMes(x), estado.mes)));
  const selTipo = h('select', { 'aria-label': 'Tipo' }, op('', 'Todos los tipos', estado.tipo),
    op('gasto', 'Gastos', estado.tipo), op('ingreso', 'Ingresos', estado.tipo), op('transferencia', 'Transferencias', estado.tipo),
    op('ajuste', 'Ajustes', estado.tipo), op('rendimiento', 'Rendimientos', estado.tipo), op('prestamo', 'Préstamos', estado.tipo),
    op('inicial', 'Saldos iniciales', estado.tipo));
  const selCuenta = h('select', { 'aria-label': 'Cuenta' }, op('', 'Todas las cuentas', estado.cuenta),
    d.cuentas.length ? h('optgroup', { label: 'Cuentas' }, d.cuentas.map(c => op(`c:${c.id}`, c.nombre + (c.archivada ? ' (archivada)' : ''), estado.cuenta))) : null,
    d.creditos.length ? h('optgroup', { label: 'Crédito' }, d.creditos.map(c => op(`t:${c.id}`, d.nombreCredito(c), estado.cuenta))) : null);

  const zonaTabla = h('div', { class: 'fz-tabla-caja fz-solo-pc' });
  const zonaLista = h('div', { class: 'fz-lista-mov fz-solo-cel' });
  const zonaDetalle = h('aside', { class: 'fz-tarjeta-det fz-detalle-mov fz-solo-pc' });
  const contador = h('p', { class: 'nota' });

  const COLUMNAS = [['fecha', 'Fecha'], ['tipo', 'Tipo'], ['importe', 'Importe', 'der'], ['cuenta', 'Cuenta'], ['categoria', 'Categoría'], ['cuotas', 'Cuotas'], ['descripcion', 'Descripción']];

  function pintar() {
    const lista = filtrados();
    const elegido = lista.find(x => x.id === estado.elegido) || null;
    contador.textContent = `${lista.length} movimiento${lista.length === 1 ? '' : 's'}`;
    const vacio = h('p', { class: 'nota fz-vacio-mov' }, d.movimientosTodos().length ? 'No hay movimientos con esos filtros.' : 'Todavía no hay movimientos. Cargá el primero con Gasto, Ingreso o Transferencia.');

    poner(zonaTabla, lista.length ? h('table', { class: 'fz-tabla fz-tabla-mov' },
      h('thead', {}, h('tr', {}, COLUMNAS.map(([k, t, cl]) => h('th', {
        class: `ordenable ${cl || ''}`, onclick: () => {
          estado.orden = { campo: k, desc: estado.orden.campo === k ? !estado.orden.desc : ['fecha', 'importe'].includes(k) };
          pintar();
        },
      }, t, estado.orden.campo === k ? (estado.orden.desc ? ' ↓' : ' ↑') : '')))),
      h('tbody', {}, lista.map(x => {
        const imp = importe(x);
        return h('tr', { class: x.id === estado.elegido ? 'sel' : '', onclick: () => { estado.elegido = x.id; pintar(); } },
          h('td', { class: 'num' }, fechaCorta(x.fecha)),
          h('td', {}, h('span', { class: `fz-tipo ${tipoDe(x).clase}` }, tipoDe(x).texto)),
          h('td', { class: `der num ${imp.clase}` }, imp.txt),
          h('td', {}, cuentaTexto(x)),
          h('td', { class: x.categoriaId ? '' : 'nota' }, categoriaTexto(x)),
          h('td', { class: 'nota' }, cuotasTexto(x)),
          h('td', {}, x.descripcion || ''));
      }))) : vacio);

    poner(zonaDetalle, elegido ? detalle(elegido) : h('p', { class: 'nota' }, 'Tocá un movimiento para ver el detalle.'));

    poner(zonaLista, lista.length ? lista.map(x => {
      const imp = importe(x);
      const abierto = x.id === estado.elegido;
      return [
        h('button', { type: 'button', class: `fz-mov${abierto ? ' sel' : ''}`, onclick: () => { estado.elegido = abierto ? null : x.id; pintar(); } },
          h('span', { class: 'fz-mov-l1' }, h('span', {}, h('span', { class: 'nota num' }, fechaCorta(x.fecha)), ' ', h('span', { class: `fz-tipo ${tipoDe(x).clase}` }, tipoDe(x).texto)), h('b', { class: `num ${imp.clase}` }, imp.txt)),
          h('span', { class: 'fz-mov-l2' }, [cuentaTexto(x), x.categoriaId ? categoriaTexto(x) : null, cuotasTexto(x) || null].filter(Boolean).join(' · ')),
          x.descripcion ? h('span', { class: 'fz-mov-l3' }, x.descripcion) : null),
        abierto ? h('div', { class: 'fz-detalle-cel' }, detalle(x)) : null,
      ];
    }) : vacio);
  }

  buscador.addEventListener('input', () => { estado.texto = buscador.value; estado.elegido = null; pintar(); });
  selMes.addEventListener('change', () => { estado.mes = selMes.value; estado.elegido = null; pintar(); });
  selTipo.addEventListener('change', () => { estado.tipo = selTipo.value; estado.elegido = null; pintar(); });
  selCuenta.addEventListener('change', () => { estado.cuenta = selCuenta.value; pintar(); });

  poner(cuerpo,
    h('div', { class: 'fz-filtros' }, buscador, selMes, selTipo, selCuenta),
    contador,
    h('div', { class: 'fz-hoja-mov' }, zonaTabla, zonaLista, zonaDetalle),
    h('p', { class: 'nota' }, 'Con una cuenta elegida en el filtro, las transferencias muestran − si salieron de esa cuenta y + si entraron.'));
  pintar();
}
