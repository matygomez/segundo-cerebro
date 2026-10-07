// ─────────────────────────────────────────────────────────────
// Finanzas: pantallas.
//
// Rutas:
//   #/finanzas                    panel
//   #/finanzas/movimientos        hoja de movimientos
//   #/finanzas/detalle/<cuadro>   vista completa de un cuadro
//   #/finanzas/config             configurar cuentas, crédito, categorías…
// ─────────────────────────────────────────────────────────────

import { crearModelo, plata, mesActual, sumarMeses, nombreMes, mesCorto, fechaCorta, fechaLarga, AJUSTE, mesDe } from './modelo.js';
import { poner, ic, cargarEstilos, hojaInfo, linea, barras, conSigno } from './comun.js';
import { abrirMovimiento, abrirAjuste, abrirPresupuesto, abrirActualizarInversion, abrirPrestamo, abrirPagoPrestamo, abrirFechasResumen } from './formularios.js';
import { vistaMovimientos } from './movimientos.js';
import { vistaConfig } from './config.js';

let mesVista = mesActual();
const ORDEN_INICIAL = ['cuentas', 'fijos', 'credito', 'variables', 'inversiones', 'prestamos'];

function leerPlegados() {
  try { return new Set(JSON.parse(localStorage.getItem('fz-plegados') || 'null') || ['fijos', 'variables', 'inversiones', 'prestamos']); }
  catch { return new Set(['fijos', 'variables', 'inversiones', 'prestamos']); }
}
function guardarPlegados(s) { try { localStorage.setItem('fz-plegados', JSON.stringify([...s])); } catch { /* sin almacenamiento */ } }

export async function pantallaFinanzas(contenedor, ctx, sub = []) {
  cargarEstilos();
  const { h } = ctx;
  const m = crearModelo(ctx);
  let d = await m.cargar();
  const vista = sub[0] || 'panel';
  const clave = sub[1] || '';

  const cuerpo = h('div', { class: 'fz-cuerpo' });
  const cabecera = h('header', { class: 'fz-cabecera' });
  contenedor.replaceChildren(cabecera, cuerpo);

  // ── Encabezado: título, mes, botones y pestañas ──
  function dibujarCabecera() {
    const cambiarMes = (n) => { mesVista = sumarMeses(mesVista, n); dibujar(); };
    poner(cabecera,
      h('div', { class: 'fz-titulo' },
        h('h1', {}, 'Finanzas'),
        h('div', { class: 'fz-mes' },
          h('button', { type: 'button', 'aria-label': 'Mes anterior', onclick: () => cambiarMes(-1) }, ic('izquierda')),
          h('span', {}, nombreMes(mesVista)),
          h('button', { type: 'button', 'aria-label': 'Mes siguiente', onclick: () => cambiarMes(1) }, ic('flecha')))),
      h('div', { class: 'fz-acciones' },
        h('button', { type: 'button', class: 'boton principal', onclick: () => abrirMovimiento(ctx, m, d, 'gasto') }, ic('menos'), 'Gasto'),
        h('button', { type: 'button', class: 'boton', onclick: () => abrirMovimiento(ctx, m, d, 'ingreso') }, ic('mas'), 'Ingreso'),
        h('button', { type: 'button', class: 'boton', onclick: () => abrirMovimiento(ctx, m, d, 'transferencia') }, ic('transferir'), 'Transferencia'),
        h('a', { href: '#/finanzas/config', class: 'boton fz-config', 'aria-label': 'Configurar Finanzas', title: 'Cuentas, crédito, categorías e inversiones' }, ic('engranaje'))),
      h('nav', { class: 'fz-pestanas' },
        h('a', { href: '#/finanzas', 'aria-current': vista === 'panel' || vista === 'detalle' ? 'page' : false }, 'Panel'),
        h('a', { href: '#/finanzas/movimientos', 'aria-current': vista === 'movimientos' ? 'page' : false }, 'Movimientos')));
  }

  // ── Panel ──

  const CUADROS = {
    cuentas: {
      titulo: 'Cuentas',
      vacio: () => !d.cuentasActivas('cuenta').length && !d.cuentasActivas('reserva').length,
      textoVacio: 'Sin cuentas',
      derecha: (r) => plata(r.enCuentas),
      cuerpo: () => listaCuentas(true),
    },
    fijos: {
      titulo: 'Gastos fijos',
      vacio: () => !d.categoriasDe('fijo').length,
      textoVacio: 'Sin gastos fijos',
      derecha: (r) => `${plata(r.fijos.reduce((a, f) => a + f.gastado, 0))} de ${plata(r.fijos.reduce((a, f) => a + f.presupuesto, 0))}`,
      cuerpo: (r) => porGrupoFijo(r.fijos).map(([titulo, lista]) => [
        h('div', { class: 'fz-linea fz-grupo' }, h('span', {}, titulo),
          h('span', { class: 'num' }, `${plata(lista.reduce((a, f) => a + f.gastado, 0))} de ${plata(lista.reduce((a, f) => a + f.presupuesto, 0))}`)),
        lista.map(f => filaFijo(f))]),
    },
    credito: {
      titulo: 'Crédito',
      vacio: () => !d.creditosActivos().length,
      textoVacio: 'Sin tarjetas',
      derecha: (r) => h('span', { class: 'neg' }, plata(r.proximo?.total || 0)),
      cuerpo: (r) => [avisoFondo(r.plan), ...d.creditosActivos().map(c => tarjetaCredito(c))],
    },
    variables: {
      titulo: 'Gastos variables',
      vacio: (r) => !d.categoriasDe('variable').length && !d.variablesDelMes(mesVista).length,
      textoVacio: 'Sin gastos variables',
      derecha: () => plata(d.variablesDelMes(mesVista).reduce((a, x) => a + x.total, 0)),
      cuerpo: () => {
        const v = d.variablesDelMes(mesVista);
        return v.length ? v.map(x => linea(ctx, x.cat.nombre, plata(x.total))) : h('p', { class: 'nota' }, 'Sin gastos variables este mes.');
      },
    },
    inversiones: {
      titulo: 'Inversiones',
      vacio: () => !d.cuentasActivas('inversion').length,
      textoVacio: 'Sin inversiones',
      derecha: () => plata(d.cuentasActivas('inversion').reduce((a, c) => a + d.inversionDelMes(c, mesVista).actual, 0)),
      cuerpo: () => d.cuentasActivas('inversion').map(c => {
        const x = d.inversionDelMes(c, mesVista);
        return h('div', { class: 'fz-fila-bloque' }, linea(ctx, h('b', {}, c.nombre), h('b', {}, plata(x.actual))),
          h('p', { class: 'nota' }, `Inicio ${plata(x.inicio)} · aportes ${plata(x.aportes)} · retiros ${plata(x.retiros)}${x.rendimiento ? ` · rindió ${conSigno(x.rendimiento)}` : ''}`));
      }),
    },
    prestamos: {
      titulo: 'Préstamos',
      vacio: () => !prestamosActivos().length,
      textoVacio: 'Sin préstamos',
      derecha: () => `${prestamosActivos().length} activo${prestamosActivos().length === 1 ? '' : 's'}`,
      cuerpo: () => prestamosActivos().map(p => {
        const e = d.estadoPrestamo(p);
        return linea(ctx, `${p.sentido === 'me-deben' ? 'Me debe' : 'Debo a'} ${p.persona}`, h('span', { class: p.sentido === 'debo' ? 'neg' : 'pos' }, plata(e.falta)));
      }),
    },
  };

  // Gastos fijos separados en Familia y Personal (solo los grupos que tienen algo).
  const porGrupoFijo = (fijos) => [['Familia', fijos.filter(f => f.grupo === 'familia')], ['Personal', fijos.filter(f => f.grupo === 'personal')]].filter(([, l]) => l.length);

  const prestamosActivos = () => d.prestamos.filter(p => !p.archivado && d.estadoPrestamo(p).falta > 0);

  function listaCuentas(conAjustar, seleccion = null) {
    const filas = [];
    const cuentas = [...d.cuentasActivas('cuenta'), ...d.cuentasActivas('reserva')];
    const sub = (c) => h('div', { class: `fz-subcuenta${seleccion === c.id ? ' sel' : ''}`, 'data-id': c.id },
      h('b', {}, c.nombre),
      h('span', { class: 'fz-subcuenta-der' }, h('b', { class: 'num' }, plata(d.saldo(c.id, corte()))),
        conAjustar ? h('button', { type: 'button', class: 'boton chico', onclick: () => abrirAjuste(ctx, m, d, c) }, 'Ajustar') : null));
    for (const g of d.grupos) {
      const delGrupo = cuentas.filter(c => c.grupoId === g.id);
      if (!delGrupo.length) continue;
      filas.push(linea(ctx, g.nombre, plata(delGrupo.reduce((a, c) => a + d.saldo(c.id, corte()), 0)), 'fz-grupo'), ...delGrupo.map(sub));
    }
    const sueltas = cuentas.filter(c => !d.grupo(c.grupoId));
    if (sueltas.length) filas.push(...(d.grupos.length ? [h('div', { class: 'fz-linea fz-grupo' }, h('span', {}, 'Sin grupo'))] : []), ...sueltas.map(sub));
    if (d.fondo()) filas.push(h('p', { class: 'nota' }, `${d.fondo().nombre} es el fondo para crédito: no suma al Disponible.`));
    return filas;
  }

  const corte = () => (mesVista === mesActual() ? null : `${mesVista}-31`);

  function filaFijo(f) {
    const pct = f.presupuesto ? Math.min(100, Math.round(f.gastado / f.presupuesto * 100)) : (f.gastado ? 100 : 0);
    return h('div', { class: 'fz-fila-bloque' },
      h('div', { class: 'fz-linea' },
        h('span', {}, h('span', { class: `fz-auto ${f.cat.automatico ? 'si' : 'no'}`, title: f.cat.automatico ? 'Se paga automático' : 'Se paga a mano' }, f.cat.automatico ? '✓' : '✗'),
          f.cat.nombre, f.cat.dia ? h('span', { class: 'nota' }, ` día ${f.cat.dia}`) : null),
        h('span', { class: 'num' }, `${plata(f.gastado)} / ${plata(f.presupuesto)}`)),
      h('div', { class: `fz-barra${f.gastado >= f.presupuesto && f.presupuesto ? ' lleno' : ''}` }, h('div', { style: `width:${pct}%` })));
  }

  function avisoFondo(plan) {
    if (!plan.meses.length) return h('p', { class: 'nota' }, 'No hay nada pendiente de pagar.');
    if (!plan.fondo) return h('p', { class: 'nota' }, 'Elegí una cuenta como fondo para crédito en Configurar Finanzas para ver hasta qué mes tenés pagado.');
    return h('div', { class: plan.pagadoHasta ? 'fz-aviso-fondo ok' : 'fz-aviso-fondo' },
      h('b', {}, plan.pagadoHasta ? `Pagado hasta ${nombreMes(plan.pagadoHasta, false).toLowerCase()}` : 'El fondo no cubre el próximo vencimiento'),
      plan.siguiente ? h('span', { class: 'nota' }, `Para cubrir ${nombreMes(plan.siguiente.mes, false).toLowerCase()} faltan ${plata(plan.siguiente.falta)} en el fondo`) : h('span', { class: 'nota' }, 'Todo lo comprometido está cubierto'));
  }

  function resumenActual(c) {
    const lista = d.resumenes(c.id);
    return lista.find(r => r.pendiente > 0) || lista.find(r => r.mes === mesVista) || null;
  }

  function tarjetaCredito(c) {
    const r = resumenActual(c);
    const futuro = d.resumenes(c.id).filter(x => r && x.mes > r.mes).reduce((a, x) => a + x.pendiente, 0);
    const det = h('details', { class: 'fz-tarjeta' },
      h('summary', {},
        h('span', {}, h('b', {}, c.nombre), ' ', h('span', { class: 'fz-etiqueta-credito' }, 'crédito'),
          h('br'), h('span', { class: 'nota' }, r ? `Cierre ${fechaLarga(r.cierre)} · vence ${fechaLarga(r.vencimiento)}` : 'Sin compras pendientes')),
        h('b', { class: 'num neg' }, plata(r?.pendiente || 0))),
      h('div', { class: 'fz-tarjeta-cuerpo' },
        r ? r.items.map(q => linea(ctx, h('span', {}, q.mov.descripcion || d.nombreCategoria(q.mov.categoriaId), q.total > 1 ? h('span', { class: 'nota' }, ` cuota ${q.numero}/${q.total}`) : null), plata(q.importe))) : null,
        r && r.pagado ? linea(ctx, 'Ya pagado', `− ${plata(r.pagado)}`, 'nota') : null,
        futuro ? h('p', { class: 'nota' }, `Comprometido en próximos resúmenes: ${plata(futuro)}`) : null,
        r ? h('button', { type: 'button', class: 'tr-link fz-link', onclick: () => abrirFechasResumen(ctx, m, d, c, r.mes) }, 'Corregir fechas de este resumen') : null));
    return det;
  }

  function cuadro(claveCuadro, r, plegados) {
    const def = CUADROS[claveCuadro];
    const vacio = def.vacio(r);
    const sec = h('section', { class: `fz-cuadro${vacio ? ' apagado' : ''}${plegados.has(claveCuadro) ? ' plegado' : ''}`, 'data-cuadro': claveCuadro },
      h('div', { class: 'fz-cuadro-cab' },
        h('button', { type: 'button', class: 'fz-asa', 'aria-label': `Mover ${def.titulo}`, title: 'Arrastrá para mover' }, ic('asa')),
        h('a', { href: `#/finanzas/detalle/${claveCuadro}`, class: 'fz-cuadro-titulo' }, def.titulo, ' ›'),
        h('span', { class: 'fz-cuadro-der' }, vacio ? def.textoVacio : def.derecha(r)),
        vacio ? null : h('button', {
          type: 'button', class: 'fz-plegar', 'aria-label': `Desplegar o plegar ${def.titulo}`,
          onclick: () => { sec.classList.toggle('plegado'); sec.classList.contains('plegado') ? plegados.add(claveCuadro) : plegados.delete(claveCuadro); guardarPlegados(plegados); },
        }, ic('abajo'))),
      vacio ? null : h('div', { class: 'fz-cuadro-cuerpo' }, def.cuerpo(r)));
    return sec;
  }

  function hacerMovibles(grilla) {
    grilla.addEventListener('pointerdown', (e) => {
      const asa = e.target.closest('.fz-asa');
      if (!asa || e.button > 0) return;
      e.preventDefault();
      const sec = asa.closest('.fz-cuadro');
      sec.classList.add('moviendo');
      const mover = (ev) => {
        const debajo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.fz-cuadro');
        if (debajo && debajo !== sec && debajo.parentElement === grilla) {
          const r = debajo.getBoundingClientRect();
          const despues = ev.clientY > r.top + r.height / 2 || (ev.clientX > r.left + r.width / 2 && ev.clientY > r.top + r.height / 3);
          if (despues) debajo.after(sec); else debajo.before(sec);
        }
        if (ev.clientY < 70) window.scrollBy(0, -12);
        if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
      };
      // Se escucha en la ventana: al mover el cuadro en la página, el navegador
      // suelta la "captura" del puntero y la manija dejaría de recibir eventos.
      const soltar = async () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);
        sec.classList.remove('moviendo');
        const orden = [...grilla.children].map(x => x.dataset.cuadro);
        if (orden.join() !== ordenPanel().join()) await m.guardarOrdenPanel(orden);
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
      window.addEventListener('pointercancel', soltar);
    });
  }

  const ordenPanel = () => {
    const guardado = (d.panel() || []).filter(k => CUADROS[k]);
    return [...guardado, ...ORDEN_INICIAL.filter(k => !guardado.includes(k))];
  };

  function vistaPanel() {
    const r = d.resumenMes(mesVista);
    const esActual = mesVista === mesActual();
    const metrica = (titulo, valor, clase, explicar) => h('button', { type: 'button', class: 'fz-metrica', onclick: explicar },
      h('span', { class: 'nota' }, titulo), h('span', { class: `fz-valor num ${clase}` }, valor), ic('info'));
    const disponible = h('button', { type: 'button', class: 'fz-disponible', onclick: () => explicarDisponible(r) },
      h('span', { class: 'nota' }, esActual ? 'Disponible' : `Disponible al cierre de ${nombreMes(mesVista, false).toLowerCase()}`),
      h('span', { class: 'fz-disponible-valor num' }, plata(r.disponible)),
      h('span', { class: 'nota' }, `En cuentas ${plata(r.enCuentas)} − fijos pendientes ${plata(r.fijosPendientes)} − faltante para el crédito ${plata(r.faltanteCredito)}`),
      ic('info'));
    const plegados = leerPlegados();
    const grilla = h('div', { class: 'fz-grilla' }, ordenPanel().map(k => cuadro(k, r, plegados)));
    hacerMovibles(grilla);
    const sinNada = !d.cuentas.length && !d.categorias.length && !d.creditos.length;
    return [
      sinNada ? h('div', { class: 'vacio' }, h('h2', {}, 'Empecemos'),
        h('p', {}, 'Creá tus cuentas, tarjetas y categorías desde Configurar Finanzas. Después ya podés cargar gastos e ingresos.'),
        h('a', { href: '#/finanzas/config', class: 'boton principal' }, ic('engranaje'), 'Configurar Finanzas')) : null,
      h('div', { class: 'fz-resumen' }, disponible,
        metrica('Ingresos del mes', plata(r.totalIngresos), 'pos', () => explicarIngresos()),
        metrica('Gastos del mes', plata(r.totalGastos), 'neg', () => explicarGastos(r)),
        h('div', { class: 'fz-metrica fija' }, h('span', { class: 'nota' }, 'Diferencia'), h('span', { class: `fz-valor num ${r.diferencia < 0 ? 'neg' : ''}` }, plata(r.diferencia)))),
      h('p', { class: 'nota fz-ayuda' }, 'Arrastrá un cuadro desde ⋮⋮ para cambiarlo de lugar. Tocá su título para ver el detalle completo.'),
      grilla,
    ];
  }

  // ── Explicaciones de los números ──

  const bloque = (titulo, ...filas) => h('div', { class: 'fz-bloque' }, h('h3', {}, titulo), filas);
  const total = (a, b) => linea(ctx, a, b, 'fz-total');

  function explicarDisponible(r) {
    const fondo = d.fondo();
    hojaInfo(ctx, 'De dónde sale el Disponible', [
      bloque('Dinero en cuentas',
        r.cuentas.length ? r.cuentas.map(x => linea(ctx, x.c.nombre, plata(x.saldo))) : h('p', { class: 'nota' }, 'Sin cuentas.'),
        fondo ? linea(ctx, `${fondo.nombre} (no se cuenta: es reserva)`, plata(d.saldo(fondo.id)), 'fz-sub2') : null,
        total('Subtotal', plata(r.enCuentas))),
      bloque('Menos gastos fijos que faltan pagar',
        r.fijos.filter(f => f.falta > 0).map(f => linea(ctx, f.gastado ? `${f.cat.nombre}: presupuesto ${plata(f.presupuesto)}, gastado ${plata(f.gastado)}` : f.cat.nombre, `− ${plata(f.falta)}`)),
        r.fijos.filter(f => !f.falta).map(f => linea(ctx, `${f.cat.nombre} (ya pagado)`, plata(0), 'fz-sub2')),
        total('Subtotal', `− ${plata(r.fijosPendientes)}`)),
      bloque('Menos lo que falta para el crédito',
        r.proximo ? [linea(ctx, `Próximo vencimiento (${nombreMes(r.proximo.mes, false).toLowerCase()})`, plata(r.proximo.total)),
          linea(ctx, 'Cubre el fondo', `− ${plata(r.proximo.cubierto)}`)] : h('p', { class: 'nota' }, 'No hay vencimientos pendientes.'),
        total('Faltante', plata(r.faltanteCredito))),
      h('div', { class: 'fz-final' }, h('span', {}, 'Disponible'), h('span', { class: 'num' }, plata(r.disponible))),
    ]);
  }

  function explicarIngresos() {
    const ingresos = d.ingresosDelMes(mesVista);
    const porCat = new Map();
    for (const i of ingresos) {
      const k = i.categoriaId;
      if (!porCat.has(k)) porCat.set(k, []);
      porCat.get(k).push(i);
    }
    hojaInfo(ctx, `Ingresos de ${nombreMes(mesVista, false).toLowerCase()}`, [
      ingresos.length ? bloque('Por categoría', [...porCat.entries()].map(([k, lista]) => [
        linea(ctx, d.nombreCategoria(k), plata(lista.reduce((a, x) => a + x.importe, 0))),
        lista.map(x => linea(ctx, `${fechaCorta(x.fecha)} · ${d.nombreCuenta(x.cuentaId)}${x.descripcion ? ' · ' + x.descripcion : ''}`, plata(x.importe), 'fz-sub2'))]),
      total('Total', plata(ingresos.reduce((a, x) => a + x.importe, 0)))) : h('p', { class: 'nota' }, 'Sin ingresos este mes.'),
      h('p', { class: 'nota' }, 'No se cuentan las transferencias, los cobros de préstamos ni el rendimiento de las inversiones.'),
    ]);
  }

  function explicarGastos(r) {
    const variables = d.variablesDelMes(mesVista);
    const fijos = r.fijos.filter(f => f.gastado);
    hojaInfo(ctx, `Gastos de ${nombreMes(mesVista, false).toLowerCase()}`, [
      bloque('Gastos fijos', fijos.length ? fijos.map(f => linea(ctx, f.cat.nombre, plata(f.gastado))) : h('p', { class: 'nota' }, 'Nada todavía.'),
        total('Subtotal', plata(fijos.reduce((a, f) => a + f.gastado, 0)))),
      bloque('Gastos variables', variables.length ? variables.map(x => [linea(ctx, x.cat.nombre, plata(x.total)),
        [...x.subs.values()].map(s => linea(ctx, s.cat.nombre, plata(s.total), 'fz-sub2'))]) : h('p', { class: 'nota' }, 'Nada todavía.'),
        total('Subtotal', plata(variables.reduce((a, x) => a + x.total, 0)))),
      h('div', { class: 'fz-final' }, h('span', {}, 'Total gastos'), h('span', { class: 'num' }, plata(r.totalGastos))),
      h('p', { class: 'nota' }, 'Las compras en cuotas suman la cuota del resumen de este mes. No se cuentan transferencias, pagos de tarjeta ni préstamos.'),
    ]);
  }

  // ── Vistas de detalle ──

  const ultimosMeses = (n) => Array.from({ length: n }, (_, i) => sumarMeses(mesVista, i - n + 1));
  const metricas = (...items) => h('div', { class: 'fz-metricas' }, items.map(([t, v, clase = '', nota = null]) =>
    h('div', { class: 'fz-metrica fija' }, h('span', { class: 'nota' }, t), h('span', { class: `fz-valor num ${clase}` }, v), nota ? h('span', { class: 'nota' }, nota) : null)));
  const tarjeta = (titulo, ...contenido) => h('section', { class: 'fz-tarjeta-det' }, titulo ? h('div', { class: 'fz-det-cab' }, titulo) : null, contenido);
  const volver = () => h('a', { href: '#/finanzas', class: 'fz-volver' }, '← Panel');
  const sinDatos = (texto) => h('div', { class: 'vacio' }, h('p', {}, texto), h('a', { href: '#/finanzas/config', class: 'boton' }, ic('engranaje'), 'Configurar Finanzas'));

  let elegido = null;   // elemento elegido dentro de un detalle (cuenta, gasto fijo, categoría)

  const DETALLES = {
    cuentas() {
      const cuentas = [...d.cuentasActivas('cuenta'), ...d.cuentasActivas('reserva')];
      if (!cuentas.length) return [sinDatos('Todavía no hay cuentas.')];
      const actual = cuentas.find(c => c.id === elegido) || cuentas[0];
      const movs = d.movimientosTodos().filter(x => (x.tipo === 'inicial' ? x.cuentaId === actual.id : d.efecto(x, actual.id) !== 0)).slice(0, 12);
      const ajustes = d.movimientos.filter(x => x.ajuste && x.cuentaId === actual.id).slice(0, 8);
      const r = d.resumenMes(mesVista);
      const ajustesMes = d.movimientos.filter(x => x.ajuste && mesDe(x.fecha) === mesVista).reduce((a, x) => a + (x.tipo === 'gasto' ? -x.importe : x.importe), 0);
      const lista = listaCuentas(true, actual.id);
      return [
        metricas(['Total en cuentas', plata(r.enCuentas), '', 'Sin contar reservas'],
          ['Reservas', plata(d.cuentasActivas('reserva').reduce((a, c) => a + d.saldo(c.id), 0))],
          ['Ajustes del mes', conSigno(ajustesMes), ajustesMes < 0 ? 'neg' : 'pos', 'Gastos sin anotar']),
        h('div', { class: 'fz-det-grilla' },
          tarjeta(h('h2', {}, 'Todas las cuentas'),
            h('div', {
              class: 'fz-seleccionables', onclick: (e) => {
                if (e.target.closest('button')) return;
                const f = e.target.closest('[data-id]');
                if (f) { elegido = f.dataset.id; dibujar(); }
              },
            }, lista),
            h('p', { class: 'nota' }, 'Tocá una cuenta para ver su detalle. Se crean y editan en Configurar Finanzas.')),
          tarjeta(h('h2', {}, actual.nombre, ' ', h('span', { class: 'num' }, plata(d.saldo(actual.id)))),
            h('p', { class: 'nota' }, 'Saldo al final de cada mes'),
            barras(ctx, ultimosMeses(6).map(mes => [mesCorto(mes), d.saldo(actual.id, `${mes}-31`)])),
            h('h3', { class: 'fz-h3' }, 'Últimos movimientos'),
            movs.length ? movs.map(x => x.tipo === 'inicial' ? linea(ctx, `${fechaCorta(x.fecha)} · Saldo inicial`, plata(x.importe)) : linea(ctx, `${fechaCorta(x.fecha)} · ${x.tipo === 'transferencia' ? '⇄ ' + (x.cuentaId === actual.id ? 'a ' + d.destino(x) : 'desde ' + d.nombreCuenta(x.cuentaId)) : x.descripcion || d.nombreCategoria(x.categoriaId)}`,
              h('span', { class: x.tipo === 'transferencia' ? 'transf' : d.efecto(x, actual.id) < 0 ? 'neg' : 'pos' }, conSigno(d.efecto(x, actual.id))))) : h('p', { class: 'nota' }, 'Sin movimientos.'),
            h('h3', { class: 'fz-h3' }, 'Ajustes de saldo'),
            ajustes.length ? ajustes.map(x => linea(ctx, fechaCorta(x.fecha), h('span', { class: x.tipo === 'gasto' ? 'neg' : 'pos' }, conSigno(x.tipo === 'gasto' ? -x.importe : x.importe)))) : h('p', { class: 'nota' }, 'Sin ajustes.'))),
        tarjeta(h('h2', {}, 'Total en cuentas, mes a mes'),
          barras(ctx, ultimosMeses(6).map(mes => [mesCorto(mes), d.cuentasActivas('cuenta').reduce((a, c) => a + d.saldo(c.id, `${mes}-31`), 0)]))),
      ];
    },

    fijos() {
      const fijos = d.fijosDelMes(mesVista);
      if (!fijos.length) return [sinDatos('Todavía no hay gastos fijos.')];
      const actual = fijos.find(f => f.cat.id === elegido) || fijos[0];
      const pres = fijos.reduce((a, f) => a + f.presupuesto, 0), gast = fijos.reduce((a, f) => a + f.gastado, 0);
      const filaTabla = (f) => h('tr', { class: f === actual ? 'sel' : '', onclick: () => { elegido = f.cat.id; dibujar(); } },
        h('td', {}, h('span', { class: `fz-auto ${f.cat.automatico ? 'si' : 'no'}` }, f.cat.automatico ? '✓' : '✗'), f.cat.nombre),
        h('td', { class: 'nota' }, f.cat.dia ? `día ${f.cat.dia}` : '—'),
        h('td', { class: 'der num' }, plata(f.presupuesto)), h('td', { class: 'der num' }, plata(f.gastado)),
        h('td', { class: `der num ${f.falta ? '' : 'pos'}` }, f.falta ? plata(f.falta) : 'Pagado'));
      const filas = porGrupoFijo(fijos).map(([titulo, lista]) => [
        h('tr', { class: 'fz-fila-grupo' }, h('td', {}, titulo), h('td', {}),
          h('td', { class: 'der num' }, plata(lista.reduce((a, f) => a + f.presupuesto, 0))),
          h('td', { class: 'der num' }, plata(lista.reduce((a, f) => a + f.gastado, 0))),
          h('td', { class: 'der num' }, plata(lista.reduce((a, f) => a + f.falta, 0)))),
        lista.map(filaTabla)]);
      return [
        metricas(['Presupuesto del mes', plata(pres)], ['Gastado', plata(gast), '', pres ? `${Math.round(gast / pres * 100)} % del presupuesto` : null],
          ['Falta pagar', plata(fijos.reduce((a, f) => a + f.falta, 0)), 'neg', 'Se resta del Disponible']),
        tarjeta(h('h2', {}, nombreMes(mesVista)),
          h('div', { class: 'fz-tabla-caja' }, h('table', { class: 'fz-tabla' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Gasto'), h('th', {}, 'Vence'), h('th', { class: 'der' }, 'Presupuesto'), h('th', { class: 'der' }, 'Gastado'), h('th', { class: 'der' }, 'Falta'))),
            h('tbody', {}, filas))),
          h('p', { class: 'nota' }, '✓ se paga automático · ✗ hay que pagarlo a mano. Tocá una fila para ver su historial.')),
        h('div', { class: 'fz-det-grilla' },
          tarjeta(h('h2', {}, actual.cat.nombre),
            h('p', { class: 'nota' }, 'Gastado por mes'),
            barras(ctx, ultimosMeses(6).map(mes => [mesCorto(mes), d.fijosDelMes(mes).find(f => f.cat.id === actual.cat.id)?.gastado || 0])),
            h('button', { type: 'button', class: 'boton', onclick: () => abrirPresupuesto(ctx, m, d, actual.cat, mesVista) }, 'Ajustar presupuesto')),
          tarjeta(h('h2', {}, 'Historial del presupuesto'),
            [...(actual.cat.presupuestos || [])].sort((a, b) => b.desde.localeCompare(a.desde)).map(p => linea(ctx, `Desde ${nombreMes(p.desde).toLowerCase()}`, plata(p.monto))),
            (actual.cat.presupuestos || []).length ? null : h('p', { class: 'nota' }, 'Sin presupuesto cargado.'),
            h('p', { class: 'nota' }, 'Cada mes usa el presupuesto que tenía en ese momento.'))),
      ];
    },

    credito() {
      if (!d.creditosActivos().length) return [sinDatos('Todavía no hay tarjetas de crédito.')];
      const plan = d.planCredito();
      const filas = plan.meses.map(x => h('tr', {},
        h('td', {}, nombreMes(x.mes)), h('td', { class: 'der num' }, plata(x.total)), h('td', { class: 'der num' }, plata(x.cubierto)),
        h('td', { class: `der num ${x.falta ? 'neg' : ''}` }, x.falta ? plata(x.falta) : '—'),
        h('td', {}, h('span', { class: `fz-estado ${x.falta === 0 ? 'ok' : x.cubierto > 0 ? 'parcial' : 'falta'}` }, x.falta === 0 ? 'Pagado' : x.cubierto > 0 ? 'Parcial' : 'Falta'))));
      return [
        metricas(
          ['Fondo para crédito', plan.fondo ? plata(plan.saldoFondo) : 'Sin elegir', '', plan.fondo ? plan.fondo.nombre : 'Elegilo en Configurar Finanzas'],
          ['Total para pagar todo', plata(plan.totalTodo), '', plan.faltaTodo ? `Faltan ${plata(plan.faltaTodo)} en el fondo` : 'El fondo cubre todo'],
          ['Pagado hasta', plan.pagadoHasta ? nombreMes(plan.pagadoHasta) : '—', plan.pagadoHasta ? 'pos' : ''],
          [plan.siguiente ? `Para cubrir ${nombreMes(plan.siguiente.mes, false).toLowerCase()} poné` : 'Para cubrir lo que viene', plata(plan.siguiente?.falta || 0), plan.siguiente ? 'neg' : '']),
        h('div', { class: 'fz-det-grilla' },
          tarjeta(h('h2', {}, 'Plan de pago por mes'),
            plan.meses.length ? h('div', { class: 'fz-tabla-caja' }, h('table', { class: 'fz-tabla' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Vence en'), h('th', { class: 'der' }, 'Total'), h('th', { class: 'der' }, 'Cubre el fondo'), h('th', { class: 'der' }, 'Falta poner'), h('th', {}, 'Estado'))),
              h('tbody', {}, filas))) : h('p', { class: 'nota' }, 'No hay nada pendiente de pagar.'),
            h('p', { class: 'nota' }, 'El fondo se aplica primero al vencimiento más cercano.')),
          tarjeta(h('h2', {}, 'Comprometido por mes'),
            plan.meses.length ? barras(ctx, plan.meses.slice(0, 8).map(x => [mesCorto(x.mes), x.total]), { resaltarUltima: false, verdes: plan.meses.slice(0, 8).map(x => x.falta === 0) }) : h('p', { class: 'nota' }, 'Nada comprometido.'),
            h('p', { class: 'nota' }, 'En verde, los meses que el fondo ya cubre.'))),
        h('div', { class: 'fz-det-grilla' }, d.creditosActivos().map(c => {
          const r = resumenActual(c);
          return tarjeta(h('h2', {}, `${d.nombreCredito(c)}`, r ? h('span', { class: 'nota' }, ` · resumen de ${nombreMes(r.mes, false).toLowerCase()}`) : null),
            r ? [h('p', { class: 'nota' }, `Cierre ${fechaLarga(r.cierre)} · vence ${fechaLarga(r.vencimiento)}${r.sugeridas ? ' (sugeridas)' : ''}`),
              r.items.map(q => linea(ctx, h('span', {}, q.mov.descripcion || d.nombreCategoria(q.mov.categoriaId),
                q.total > 1 ? h('span', { class: 'nota' }, ` cuota ${q.numero}/${q.total}${q.total - q.numero ? ` · quedan ${q.total - q.numero} por ${plata(q.importe * (q.total - q.numero))}` : ''}`) : null), plata(q.importe))),
              r.pagado ? linea(ctx, 'Ya pagado', `− ${plata(r.pagado)}`) : null,
              linea(ctx, h('b', {}, 'Total a pagar'), h('b', {}, plata(r.pendiente)), 'fz-total'),
              h('button', { type: 'button', class: 'tr-link fz-link', onclick: () => abrirFechasResumen(ctx, m, d, c, r.mes) }, 'Corregir fechas de este resumen')]
              : h('p', { class: 'nota' }, 'Sin compras pendientes.'));
        })),
      ];
    },

    variables() {
      const v = d.variablesDelMes(mesVista);
      const promedio = ultimosMeses(4).slice(0, 3).map(mes => d.variablesDelMes(mes).reduce((a, x) => a + x.total, 0));
      const prom = promedio.reduce((a, x) => a + x, 0) / 3;
      const totalMes = v.reduce((a, x) => a + x.total, 0);
      const actual = v.find(x => x.cat.id === elegido) || v[0];
      const promCat = (id) => ultimosMeses(4).slice(0, 3).reduce((a, mes) => a + (d.variablesDelMes(mes).find(x => x.cat.id === id)?.total || 0), 0) / 3;
      return [
        metricas(['Total del mes', plata(totalMes)], ['Promedio de los últimos 3 meses', plata(prom), '', totalMes > prom ? `Este mes vas ${plata(totalMes - prom)} por encima` : `Este mes vas ${plata(prom - totalMes)} por debajo`]),
        v.length ? h('div', { class: 'fz-det-grilla' },
          tarjeta(h('h2', {}, 'Por categoría'), v.map(x => h('button', { type: 'button', class: `fz-elegible${x === actual ? ' sel' : ''}`, onclick: () => { elegido = x.cat.id; dibujar(); } },
            linea(ctx, x.cat.nombre, h('b', {}, plata(x.total))),
            [...x.subs.values()].map(s => linea(ctx, s.cat.nombre, plata(s.total), 'fz-sub2')),
            h('span', { class: 'nota' }, `Promedio ${plata(promCat(x.cat.id))}`)))),
          tarjeta(h('h2', {}, actual.cat.nombre, ' ', h('span', { class: 'num' }, plata(actual.total))),
            barras(ctx, ultimosMeses(6).map(mes => [mesCorto(mes), d.variablesDelMes(mes).find(x => x.cat.id === actual.cat.id)?.total || 0])),
            h('h3', { class: 'fz-h3' }, 'Movimientos del mes'),
            actual.gastos.map(g => linea(ctx, `${fechaCorta(g.mov.fecha)} · ${d.origen(g.mov)}${g.mov.descripcion ? ' · ' + g.mov.descripcion : ''}${g.cuota && g.cuota.total > 1 ? ` · cuota ${g.cuota.numero}/${g.cuota.total}` : ''}`, h('span', { class: 'neg' }, `− ${plata(g.importe)}`)))))
          : h('p', { class: 'nota' }, 'Sin gastos variables este mes.'),
      ];
    },

    inversiones() {
      const inv = d.cuentasActivas('inversion');
      if (!inv.length) return [sinDatos('Todavía no hay inversiones.')];
      const datos = inv.map(c => ({ c, x: d.inversionDelMes(c, mesVista) }));
      return [
        metricas(['Total invertido', plata(datos.reduce((a, y) => a + y.x.actual, 0))], ['Aportes del mes', plata(datos.reduce((a, y) => a + y.x.aportes, 0))],
          ['Rendimiento del mes', conSigno(datos.reduce((a, y) => a + y.x.rendimiento, 0)), 'pos']),
        h('div', { class: 'fz-det-grilla' }, datos.map(({ c, x }) => tarjeta(h('h2', {}, c.nombre, ' ', h('span', { class: 'num' }, plata(x.actual))),
          linea(ctx, 'Saldo al inicio del mes', plata(x.inicio)), linea(ctx, 'Aportes', `+ ${plata(x.aportes)}`), linea(ctx, 'Retiros', x.retiros ? `− ${plata(x.retiros)}` : plata(0)),
          linea(ctx, 'Rendimiento', h('span', { class: x.rendimiento < 0 ? 'neg' : x.rendimiento > 0 ? 'pos' : '' }, x.rendimiento ? conSigno(x.rendimiento) : plata(0))),
          h('div', { class: 'botonera' },
            h('button', { type: 'button', class: 'boton chico', onclick: () => abrirActualizarInversion(ctx, m, d, c) }, 'Actualizar saldo'),
            h('button', { type: 'button', class: 'boton chico', onclick: () => abrirMovimiento(ctx, m, d, 'transferencia', null, { destinoId: c.id }) }, 'Aportar o retirar')),
          barras(ctx, ultimosMeses(6).map(mes => [mesCorto(mes), d.saldo(c.id, `${mes}-31`)]))))),
      ];
    },

    prestamos() {
      const activos = d.prestamos.filter(p => !p.archivado);
      const lado = (sentido) => {
        const lista = activos.filter(p => p.sentido === sentido);
        return tarjeta(h('div', { class: 'fz-cab-flex' }, h('h2', {}, sentido === 'me-deben' ? 'Me deben' : 'Debo'),
          h('button', { type: 'button', class: 'boton chico', onclick: () => abrirPrestamo(ctx, m, d) }, '+ Préstamo')),
          lista.length ? lista.map(p => {
            const e = d.estadoPrestamo(p);
            const pct = p.monto ? Math.round(e.pagado / p.monto * 100) : 0;
            return h('div', { class: 'fz-fila-bloque' },
              linea(ctx, h('b', {}, p.persona), h('b', { class: sentido === 'debo' ? 'neg' : '' }, e.falta ? `falta ${plata(e.falta)}` : 'Saldado')),
              h('p', { class: 'nota' }, `${sentido === 'me-deben' ? 'Le prestaste' : 'Te prestaron'} ${plata(p.monto)} el ${fechaCorta(p.fecha)} ${sentido === 'me-deben' ? 'desde' : 'en'} ${d.nombreCuenta(p.cuentaId)}${p.notas ? ' · ' + p.notas : ''}`),
              h('div', { class: 'fz-barra lleno' }, h('div', { style: `width:${pct}%` })),
              e.pagos.map(x => linea(ctx, `${fechaCorta(x.fecha)} · ${x.sentido === 'entra' ? 'entró a' : 'salió de'} ${d.nombreCuenta(x.cuentaId)}`, h('span', { class: x.sentido === 'entra' ? 'pos' : 'neg' }, `${x.sentido === 'entra' ? '+' : '−'} ${plata(x.importe)}`), 'fz-sub2')),
              h('div', { class: 'botonera' },
                e.falta ? h('button', { type: 'button', class: 'boton chico', onclick: () => abrirPagoPrestamo(ctx, m, d, p) }, sentido === 'me-deben' ? 'Registrar cobro' : 'Registrar pago') : null,
                !e.falta ? h('button', { type: 'button', class: 'boton chico', onclick: () => m.actualizar('prestamos', p.id, { archivado: true }) }, 'Archivar') : null));
          }) : h('p', { class: 'nota' }, 'Nada por acá.'));
      };
      const meDeben = activos.filter(p => p.sentido === 'me-deben').reduce((a, p) => a + d.estadoPrestamo(p).falta, 0);
      const debo = activos.filter(p => p.sentido === 'debo').reduce((a, p) => a + d.estadoPrestamo(p).falta, 0);
      return [
        metricas(['Me deben', plata(meDeben), 'pos'], ['Debo', plata(debo), 'neg']),
        h('div', { class: 'fz-det-grilla' }, lado('me-deben'), lado('debo')),
        h('p', { class: 'nota' }, 'Los préstamos mueven plata entre tus cuentas, pero no cuentan como gasto ni como ingreso del mes.'),
      ];
    },
  };

  function vistaDetalle() {
    const def = CUADROS[clave];
    if (!def) return [volver(), h('p', {}, 'Esta vista no existe.')];
    return [volver(), h('h2', { class: 'fz-det-titulo' }, def.titulo), ...DETALLES[clave]()];
  }

  // ── Dibujo ──

  function dibujar() {
    dibujarCabecera();
    if (vista === 'movimientos') return vistaMovimientos(cuerpo, ctx, m, d, { mes: mesVista, alCambiarMes: (mes) => { mesVista = mes; dibujar(); } });
    if (vista === 'config') return vistaConfig(cuerpo, ctx, m, d);
    poner(cuerpo, vista === 'detalle' ? vistaDetalle() : vistaPanel());
  }

  let espera = null;
  const quitar = ctx.alCambiarDatos(() => {
    clearTimeout(espera);
    espera = setTimeout(async () => { d = await m.cargar(); dibujar(); }, 60);
  });

  dibujar();
  return () => { quitar(); clearTimeout(espera); };
}

// Para el bloque de Inicio.
export async function resumenParaInicio(ctx) {
  const d = await crearModelo(ctx).cargar();
  return { d, r: d.resumenMes(mesActual()) };
}
