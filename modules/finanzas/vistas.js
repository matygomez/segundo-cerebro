// ─────────────────────────────────────────────────────────────
// Finanzas: pantallas.
//
// Rutas:
//   #/finanzas                    panel
//   #/finanzas/movimientos        hoja de movimientos
//   #/finanzas/detalle/<cuadro>   vista completa de un cuadro
//   #/finanzas/config             configurar cuentas, crédito, categorías…
// ─────────────────────────────────────────────────────────────

import { crearModelo, plata, mesActual, sumarMeses, nombreMes, mesCorto, fechaCorta, fechaLarga, AJUSTE, mesDe, hoy, redondear } from './modelo.js';
import { poner, ic, cargarEstilos, hojaInfo, linea, barras, conSigno, hoja, campo, inputImporte } from './comun.js';
import { abrirMovimiento, abrirAjuste, abrirPresupuesto, abrirActualizarInversion, abrirPrestamo, abrirPagoPrestamo, abrirFechasResumen } from './formularios.js';
import { vistaMovimientos } from './movimientos.js';
import { vistaConfig } from './config.js';

let mesVista = mesActual();

// Cuadros plegados: en el celular y en la PC se recuerdan por separado.
const esPC = () => window.matchMedia('(min-width: 900px)').matches;
function leerPlegados() {
  const porDefecto = esPC() ? [] : ['fijos', 'variables', 'inversiones', 'prestamos'];
  try { return new Set(JSON.parse(localStorage.getItem(esPC() ? 'fz-plegados-pc' : 'fz-plegados') || 'null') || porDefecto); }
  catch { return new Set(porDefecto); }
}
function guardarPlegados(s) { try { localStorage.setItem(esPC() ? 'fz-plegados-pc' : 'fz-plegados', JSON.stringify([...s])); } catch { /* sin almacenamiento */ } }

// Preferencias de vista guardadas en este dispositivo.
function leerPref(clave, porDefecto) {
  try { const v = JSON.parse(localStorage.getItem(clave) ?? 'null'); return v === null ? porDefecto : v; } catch { return porDefecto; }
}
function guardarPref(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } }

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
  // En el panel, la cabecera va arriba de la primera columna; en las demás vistas, arriba de todo.
  function dibujarCabecera() {
    const enPanel = vista === 'panel';
    cabecera.hidden = enPanel;
    if (enPanel) cabecera.replaceChildren(); else poner(cabecera, piezasCabecera());
  }

  function piezasCabecera() {
    const cambiarMes = (n) => { mesVista = sumarMeses(mesVista, n); dibujar(); };
    return [
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
        h('a', { href: '#/finanzas/movimientos', 'aria-current': vista === 'movimientos' ? 'page' : false }, 'Movimientos'))];
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
      derecha: (r) => faltaFijos(r.fijos),
      // Botón chico al lado de plegar: muestra u oculta los pagados.
      extra: (r) => {
        const ocultos = leerPref('fz-fijos-panel-ocultos', true);
        const pagados = r.fijos.filter(estaPagado).length;
        return pagados ? h('button', {
          type: 'button', class: `fz-chip-boton${ocultos ? '' : ' activo'}`, title: ocultos ? `Mostrar los ${pagados} pagados` : 'Ocultar los pagados',
          'aria-label': ocultos ? `Mostrar los ${pagados} pagados` : 'Ocultar los pagados',
          onclick: () => { guardarPref('fz-fijos-panel-ocultos', !ocultos); dibujar(); },
        }, ocultos ? `+${pagados} ✓` : `− ${pagados} ✓`) : null;
      },
      cuerpo: (r) => {
        // En el panel los pagados arrancan ocultos.
        const ocultos = leerPref('fz-fijos-panel-ocultos', true);
        return [
          porGrupoFijo(r.fijos).map(([titulo, lista]) => {
            const visibles = ocultos ? lista.filter(f => !estaPagado(f)) : lista;
            return [
              h('div', { class: 'fz-linea fz-grupo' }, h('span', {}, titulo),
                faltaFijos(lista)),
              visibles.length ? visibles.map(f => filaFijo(f)) : h('p', { class: 'nota' }, 'Todos pagados.')];
          })];
      },
    },
    credito: {
      titulo: 'Crédito',
      vacio: () => !d.creditosActivos().length,
      textoVacio: 'Sin tarjetas',
      derecha: (r) => h('span', { class: 'neg' }, plata(r.credito.pendienteAnterior + (r.proximo?.total || 0))),
      cuerpo: (r) => [transferirFondo(r, true), bloqueCreditoMes(r.credito, true), ...d.creditosActivos().map(c => tarjetaCredito(c))],
    },
    variables: {
      titulo: 'Gastos variables',
      vacio: (r) => !d.categoriasDe('variable').length && !d.variablesDelMes(mesVista).length,
      textoVacio: 'Sin gastos variables',
      derecha: () => plata(d.variablesDelMes(mesVista).reduce((a, x) => a + x.total, 0)),
      cuerpo: () => {
        const v = d.variablesDelMes(mesVista);
        if (!v.length) return h('p', { class: 'nota' }, 'Sin gastos variables este mes.');
        // Subcategorías desplegadas; tocando la categoría se pliegan.
        const plegadas = new Set(leerPref('fz-variables-plegadas', []));
        return v.map(x => {
          const subs = [...x.subs.values()];
          const tiene = subs.length > 0;
          const plegada = plegadas.has(x.cat.id);
          return [
            h('button', {
              type: 'button', class: `fz-var-cat${plegada ? ' plegada' : ''}`, disabled: !tiene, 'aria-expanded': tiene ? String(!plegada) : false,
              onclick: () => { plegada ? plegadas.delete(x.cat.id) : plegadas.add(x.cat.id); guardarPref('fz-variables-plegadas', [...plegadas]); dibujar(); },
            }, h('span', {}, tiene ? ic('abajo') : h('span', { class: 'fz-var-hueco' }), x.cat.nombre), h('span', { class: 'num' }, plata(x.total))),
            tiene && !plegada ? h('div', { class: 'fz-var-subs' },
              subs.map(sb => linea(ctx, sb.cat.nombre, plata(sb.total))),
              x.general ? linea(ctx, 'General', plata(x.general)) : null) : null,
          ];
        });
      },
    },
    inversiones: {
      titulo: 'Inversiones',
      // En el panel solo las que tienen saldo; en el detalle están todas.
      vacio: () => !invConSaldo().length,
      textoVacio: 'Sin inversiones',
      derecha: () => plata(invConSaldo().reduce((a, c) => a + d.inversionDelMes(c, mesVista).actual, 0)),
      cuerpo: () => invConSaldo().map(c => {
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

  // Lo que falta pagar de una lista de gastos fijos.
  const faltaFijos = (lista) => {
    const falta = lista.reduce((a, f) => a + f.falta, 0);
    return falta ? h('span', { class: 'num neg' }, `Falta ${plata(falta)}`) : h('span', { class: 'num pos' }, 'Todo pagado');
  };

  // Gastos fijos separados en Familia y Personal (solo los grupos que tienen algo).
  const porGrupoFijo = (fijos) => [['Familia', fijos.filter(f => f.grupo === 'familia')], ['Personal', fijos.filter(f => f.grupo === 'personal')]].filter(([, l]) => l.length);

  const invConSaldo = () => d.cuentasActivas('inversion').filter(c => d.inversionDelMes(c, mesVista).actual !== 0);

  const prestamosActivos = () => d.prestamos.filter(p => !p.archivado && d.estadoPrestamo(p).falta > 0);

  function listaCuentas(conAjustar, seleccion = null) {
    const filas = [];
    const cuentas = [...d.cuentasActivas('cuenta'), ...d.cuentasActivas('reserva')];
    const sub = (c) => h('div', { class: `fz-subcuenta${seleccion === c.id ? ' sel' : ''}`, 'data-id': c.id },
      h('b', {}, c.nombre, c.fondoCredito && !d.grupo(c.grupoId) ? h('span', { class: 'fz-nota-chica' }, ' no suma a Disponible') : null),
      h('span', { class: 'fz-subcuenta-der' }, h('b', { class: 'num' }, plata(d.saldo(c.id, corte()))),
        conAjustar ? h('button', { type: 'button', class: 'boton chico', onclick: () => abrirAjuste(ctx, m, d, c) }, 'Ajustar') : null));
    for (const g of d.grupos) {
      const delGrupo = cuentas.filter(c => c.grupoId === g.id);
      if (!delGrupo.length) continue;
      const esFondo = delGrupo.some(c => c.fondoCredito);
      filas.push(h('div', { class: 'fz-linea fz-grupo' }, h('span', {}, g.nombre, esFondo ? h('span', { class: 'fz-nota-chica' }, ' no suma a Disponible') : null),
        h('span', { class: 'num' }, plata(delGrupo.reduce((a, c) => a + d.saldo(c.id, corte()), 0)))), ...delGrupo.map(sub));
    }
    const sueltas = cuentas.filter(c => !d.grupo(c.grupoId));
    if (sueltas.length) filas.push(...(d.grupos.length ? [h('div', { class: 'fz-linea fz-grupo' }, h('span', {}, 'Sin grupo'))] : []), ...sueltas.map(sub));
    return filas;
  }

  const corte = () => (mesVista === mesActual() ? null : `${mesVista}-31`);

  function filaFijo(f) {
    const pct = f.presupuesto ? Math.min(100, Math.round(f.gastado / f.presupuesto * 100)) : (f.gastado ? 100 : 0);
    return h('div', { class: `fz-fila-bloque fz-tocable${f.excedido ? ' fz-excedido' : ''}`, role: 'button', tabindex: '0', title: 'Ver presupuesto e historial',
      onclick: () => abrirPresupuesto(ctx, m, d, f.cat, mesVista), onkeydown: (e) => { if (e.key === 'Enter') abrirPresupuesto(ctx, m, d, f.cat, mesVista); } },
      h('div', { class: 'fz-linea' },
        h('span', {}, h('span', { class: `fz-auto ${f.cat.automatico ? 'si' : 'no'}`, title: f.cat.automatico ? 'Se paga automático' : 'Se paga a mano' }, f.cat.automatico ? '✓' : '✗'),
          f.cat.nombre, f.cat.dia && !f.excedido ? h('span', { class: 'nota' }, ` día ${f.cat.dia}`) : null,
          f.excedido ? h('span', { class: 'fz-chip-excedido' }, `Excedido ${plata(f.excedido)}`) : null),
        h('span', { class: `num${f.excedido ? ' neg' : ''}` }, `${plata(f.gastado)} / ${plata(f.presupuesto)}`)),
      h('div', { class: `fz-barra${f.excedido ? ' excedida' : f.gastado >= f.presupuesto && f.presupuesto ? ' lleno' : ''}` }, h('div', { style: `width:${pct}%` })));
  }
  // Pagado = llegó justo al presupuesto. Los excedidos no cuentan como pagados: siempre se ven.
  const estaPagado = (f) => f.presupuesto && !f.falta && !f.excedido;

  // Lo pendiente del mes anterior y el próximo vencimiento con su reparto.
  function bloqueCreditoMes(cr, compacto = false) {
    const esActual = mesVista === mesActual();
    const partes = [];
    if (cr.pendienteAnterior > 0) {
      const atrasado = esActual && cr.venceAnterior && cr.venceAnterior < hoy();
      partes.push(h('div', { class: `fz-aviso-credito${atrasado ? ' atrasado' : ''}` },
        h('b', {}, `${atrasado ? 'Atrasado: ' : ''}Te falta pagar ${plata(cr.pendienteAnterior)} del mes anterior`),
        h('span', { class: 'nota' }, atrasado ? `Venció el ${fechaLarga(cr.venceAnterior)}`
          : `${cr.repartido ? `Lo dejaste para pagar con lo de ${nombreMes(mesVista, false).toLowerCase()} · ` : ''}vence el ${fechaLarga(cr.venceAnterior)}`)));
    } else if (cr.hayVencimientoEsteMes) {
      partes.push(h('div', { class: 'fz-aviso-credito ok' }, h('b', {}, `Pagaste lo que vencía en ${nombreMes(mesVista, false).toLowerCase()}`)));
    }
    if (cr.proximo) {
      const mesVence = nombreMes(cr.proximo.mes, false).toLowerCase();
      const venc = cr.proximo.resumenes.map(x => x.vencimiento).sort()[0];
      partes.push(
        linea(ctx, `Próximo: vence el ${fechaLarga(venc)}`, h('b', {}, plata(cr.proximo.total))),
        esActual && !compacto ? h('div', { class: 'fz-reparto' },
          cr.reparto
            ? [h('span', {}, `Con lo de ${mesVence}: `, h('b', { class: 'num' }, plata(cr.reparto))),
              h('button', { type: 'button', class: 'fz-link', onclick: () => abrirReparto(cr) }, 'Cambiar')]
            : [h('span', { class: 'nota' }, 'Todo se paga con la plata de este mes'),
              h('button', { type: 'button', class: 'fz-link', onclick: () => abrirReparto(cr) }, 'Repartir')]) : null);
    }
    return partes.length ? h('div', { class: `fz-credito-mes${compacto ? ' chico' : ''}` }, partes) : null;
  }

  function abrirReparto(cr) {
    const mesVence = nombreMes(cr.proximo.mes, false).toLowerCase();
    const monto = inputImporte(ctx, cr.reparto || '');
    return hoja(ctx, {
      titulo: 'Repartir el pago de la tarjeta',
      cuerpo: [
        h('p', {}, `El ${fechaLarga(cr.proximo.resumenes.map(x => x.vencimiento).sort()[0])} vencen `, h('b', { class: 'num' }, plata(cr.proximo.total)), '.'),
        campo(ctx, `¿Cuánto pagás con lo que cobrás en ${mesVence}?`, monto,
          `El Disponible de este mes solo reserva el resto. Cuando llegue ${mesVence}, lo que falte se resta como "pendiente del mes anterior".`),
      ],
      extraBotones: cr.reparto ? h('button', { type: 'button', class: 'boton peligro', onclick: async (e) => { await m.guardarReparto(cr.proximo.mes, 0); e.target.closest('dialog').close(); ctx.aviso('Reparto quitado'); } }, 'Quitar') : null,
      alGuardar: async () => {
        const v = redondear(Number(String(monto.value || 0).replace(',', '.')));
        if (v < 0 || v > cr.proximo.falta) return `Tiene que ser entre $ 0 y ${plata(cr.proximo.falta)}.`;
        await m.guardarReparto(cr.proximo.mes, v);
        ctx.aviso(v ? `Reparto guardado: ${plata(v)} con lo de ${mesVence}` : 'Reparto quitado');
      },
    });
  }

  // Cuánto pasar al fondo para crédito ahora y cuánto el mes del vencimiento (reparto).
  function transferirFondo(r, compacto = false) {
    const plan = r.plan, cr = r.credito;
    if (!plan.meses.length) return null;
    if (!plan.fondo) return h('p', { class: 'nota' }, 'Elegí una cuenta como fondo para crédito en Configurar Finanzas para saber cuánto transferir.');
    const cuando = mesVista === mesActual() ? 'este mes' : `en ${nombreMes(mesVista, false).toLowerCase()}`;
    const ahora = cr.total;
    const venc = cr.proximo ? cr.proximo.resumenes.map(x => x.vencimiento).sort()[0] : null;
    const mesProx = cr.proximo ? nombreMes(cr.proximo.mes, false).toLowerCase() : '';
    const filas = [];
    if (cr.totalAnteriores) filas.push(linea(ctx, `Pendiente del mes anterior${cr.venceAnterior ? ` (vence ${fechaCorta(cr.venceAnterior)})` : ''}`, h('span', { class: 'neg' }, plata(cr.totalAnteriores))));
    if (cr.proximoEsteMes) filas.push(linea(ctx, `Para el vencimiento del ${fechaCorta(venc)}`, plata(cr.proximoEsteMes)));
    if (cr.reparto) filas.push(linea(ctx, `En ${mesProx}, antes del ${fechaCorta(venc)}`, h('b', {}, plata(cr.reparto))));
    const nota = ahora > 0 ? null : cr.reparto ? `Lo que falta lo dejaste para ${mesProx}.` : plan.pagadoHasta ? `Pagado hasta ${nombreMes(plan.pagadoHasta, false).toLowerCase()}.` : null;
    // Si hay una sola fila y es el mismo número de arriba, no hace falta el desglose.
    const conDetalle = filas.length > 1 || (filas.length === 1 && (cr.reparto || ahora === 0));
    if (compacto) {
      // Panel: una línea con el monto y, abajo en chico, lo que va el mes que viene (con Cambiar / Repartir).
      const partes = [];
      if (cr.totalAnteriores && cr.proximoEsteMes) partes.push(`anterior ${plata(cr.totalAnteriores)} + vence ${fechaCorta(venc)} ${plata(cr.proximoEsteMes)}`);
      if (cr.reparto) partes.push(`${mesProx[0].toUpperCase()}${mesProx.slice(1)}, antes del ${fechaCorta(venc)}: ${plata(cr.reparto)}`);
      else if (!ahora && plan.pagadoHasta) partes.push(`Pagado hasta ${nombreMes(plan.pagadoHasta, false).toLowerCase()}`);
      const esActual = mesVista === mesActual();
      const enlace = esActual && cr.proximo && cr.proximo.falta > 0
        ? h('button', { type: 'button', class: 'fz-link', onclick: () => abrirReparto(cr) }, cr.reparto ? 'Cambiar' : `Pagar parte con lo de ${mesProx}`) : null;
      return h('div', { class: `fz-transferir chico${ahora > 0 ? '' : ' ok'}` },
        h('div', { class: 'fz-transferir-fila' }, h('span', {}, `Transferir al fondo ${cuando}`), h('b', { class: 'num' }, ahora > 0 ? plata(ahora) : 'Nada ✓')),
        partes.length || enlace ? h('div', { class: 'fz-transferir-sub' }, h('span', {}, partes.join(' · ')), enlace) : null);
    }
    return h('div', { class: `fz-transferir${ahora > 0 ? '' : ' ok'}` },
      h('span', { class: 'fz-transferir-t' }, `Transferir al fondo ${cuando}`),
      h('span', { class: 'fz-transferir-v num' }, ahora > 0 ? plata(ahora) : 'Nada ✓'),
      nota ? h('span', { class: 'nota' }, nota) : null,
      conDetalle ? h('div', { class: 'fz-transferir-det' }, filas) : null);
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
      h('summary', { title: r ? `Cierre ${fechaLarga(r.cierre)} · vence ${fechaLarga(r.vencimiento)}` : 'Sin compras pendientes' },
        h('span', { class: 'fz-tarjeta-nombre' }, h('b', {}, c.nombre), h('span', { class: 'fz-etiqueta-credito' }, 'crédito'),
          h('span', { class: 'fz-nota-chica' }, r ? `vence ${fechaLarga(r.vencimiento)}` : 'sin compras')),
        h('b', { class: 'num neg' }, plata(r?.pendiente || 0))),
      h('div', { class: 'fz-tarjeta-cuerpo' },
        r ? h('p', { class: 'nota' }, `Cierre ${fechaLarga(r.cierre)} · vence ${fechaLarga(r.vencimiento)}`) : null,
        r ? r.items.map(q => linea(ctx, h('span', {}, q.mov.descripcion || d.nombreCategoria(q.mov.categoriaId), q.total > 1 ? h('span', { class: 'nota' }, ` cuota ${q.numero}/${q.total}`) : null), plata(q.importe))) : null,
        r && r.pagado ? linea(ctx, 'Ya pagado', `− ${plata(r.pagado)}`, 'nota') : null,
        futuro ? h('p', { class: 'nota' }, `Comprometido en próximos resúmenes: ${plata(futuro)}`) : null,
        r ? h('button', { type: 'button', class: 'tr-link fz-link', onclick: () => abrirFechasResumen(ctx, m, d, c, r.mes) }, 'Corregir fechas de este resumen') : null));
    return det;
  }

  function cuadro(claveCuadro, r, plegados, col = 0) {
    const def = CUADROS[claveCuadro];
    const vacio = def.vacio(r);
    const sec = h('section', { class: `fz-cuadro${vacio ? ' apagado' : ''}${plegados.has(claveCuadro) ? ' plegado' : ''}`, 'data-cuadro': claveCuadro, 'data-col': String(col) },
      h('div', { class: 'fz-cuadro-cab' },
        h('button', { type: 'button', class: 'fz-asa', 'aria-label': `Mover ${def.titulo}`, title: 'Arrastrá para mover' }, ic('asa')),
        h('a', { href: `#/finanzas/detalle/${claveCuadro}`, class: 'fz-cuadro-titulo' }, def.titulo, ' ›'),
        h('span', { class: 'fz-cuadro-der' }, vacio ? def.textoVacio : def.derecha(r)),
        !vacio && def.extra ? def.extra(r) : null,
        vacio ? null : h('button', {
          type: 'button', class: 'fz-plegar', 'aria-label': `Desplegar o plegar ${def.titulo}`,
          onclick: () => { sec.classList.toggle('plegado'); sec.classList.contains('plegado') ? plegados.add(claveCuadro) : plegados.delete(claveCuadro); guardarPlegados(plegados); },
        }, ic('abajo'))),
      vacio ? null : h('div', { class: 'fz-cuadro-cuerpo' }, def.cuerpo(r)));
    return sec;
  }

  // Arrastrar un cuadro desde ⋮⋮ a cualquier columna y posición.
  // Mientras se mueve, un hueco punteado marca dónde va a quedar.
  function hacerMovibles(grilla) {
    grilla.addEventListener('pointerdown', (e) => {
      const asa = e.target.closest('.fz-asa');
      if (!asa || e.button > 0) return;
      e.preventDefault();
      const sec = asa.closest('.fz-cuadro');
      const caja = sec.getBoundingClientRect();
      const hueco = h('div', { class: 'fz-hueco', style: `height:${caja.height}px` });
      sec.after(hueco);
      const dx = e.clientX - caja.left, dy = e.clientY - caja.top;
      Object.assign(sec.style, { width: `${caja.width}px`, left: `${caja.left}px`, top: `${caja.top}px` });
      sec.classList.add('volando');
      document.body.append(sec);
      grilla.classList.add('arrastrando');
      arrastrando = true;
      const columnas = [...grilla.querySelectorAll('.fz-col')];
      const mover = (ev) => {
        sec.style.left = `${ev.clientX - dx}px`;
        sec.style.top = `${ev.clientY - dy}px`;
        const col = columnas.find(c => { const b = c.getBoundingClientRect(); return ev.clientX >= b.left - 8 && ev.clientX <= b.right + 8; })
          || columnas.reduce((a, c) => (Math.abs(c.getBoundingClientRect().left - ev.clientX) < Math.abs(a.getBoundingClientRect().left - ev.clientX) ? c : a));
        const antes = [...col.querySelectorAll(':scope > .fz-cuadro')].find(x => { const b = x.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
        if (antes) antes.before(hueco); else col.append(hueco);
        if (ev.clientY < 70) window.scrollBy(0, -12);
        if (ev.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
      };
      // Se escucha en la ventana: al mover el cuadro, el navegador suelta la
      // "captura" del puntero y la manija dejaría de recibir eventos.
      const soltar = async () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', soltar);
        window.removeEventListener('pointercancel', soltar);
        sec.classList.remove('volando');
        sec.removeAttribute('style');
        hueco.replaceWith(sec);
        grilla.classList.remove('arrastrando');
        arrastrando = false;
        // Columna del cuadro: la del de arriba; si no hay, la del de abajo; si está sola, la de esa columna.
        const vecino = (el, dir) => { let x = el[dir]; while (x && !x.classList?.contains('fz-cuadro')) x = x[dir]; return x; };
        const arriba = vecino(sec, 'previousElementSibling'), abajo = vecino(sec, 'nextElementSibling');
        sec.dataset.col = (arriba || abajo)?.dataset.col ?? sec.parentElement.dataset.logica;
        if (grilla.dataset.n === '1') {
          // Celular: su propio orden, aparte del de la PC.
          const lista = [...grilla.querySelectorAll('.fz-cuadro')].map(x => x.dataset.cuadro);
          if (lista.join() !== d.panelCelular().join()) await m.guardarPanel({ celular: lista });
          return;
        }
        const nuevas = [[], [], []];
        for (const c of grilla.querySelectorAll('.fz-col')) for (const x of c.querySelectorAll(':scope > .fz-cuadro')) nuevas[Number(x.dataset.col)].push(x.dataset.cuadro);
        if (JSON.stringify(nuevas) !== JSON.stringify(d.panelPC())) await m.guardarPanel({ columnas: nuevas });
        if (grilla.dataset.n === '2') dibujar();
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
      window.addEventListener('pointercancel', soltar);
    });
  }

  // Cuántas columnas entran según el ancho: 3 en la PC, 2 en pantallas medianas, 1 en el celular.
  const columnasVisibles = () => { const w = cuerpo.clientWidth || window.innerWidth; return w >= 860 ? 3 : w >= 560 ? 2 : 1; };
  let arrastrando = false;
  let nDibujado = null;

  function vistaPanel() {
    const r = d.resumenMes(mesVista);
    const esActual = mesVista === mesActual();
    const disponible = h('div', { class: 'fz-disponible' },
      h('button', { type: 'button', class: 'fz-disp-boton', onclick: () => explicarDisponible(r) },
        h('span', { class: 'nota' }, esActual ? 'Disponible' : `Disponible al cierre de ${nombreMes(mesVista, false).toLowerCase()}`, ic('info')),
        h('span', { class: 'fz-disponible-valor num' }, plata(r.disponible))),
      h('div', { class: 'fz-mini' },
        h('button', { type: 'button', onclick: () => explicarIngresos() }, 'Ingresos ', h('b', { class: 'num pos' }, plata(r.totalIngresos))),
        h('button', { type: 'button', onclick: () => explicarGastos(r) }, 'Gastos ', h('b', { class: 'num neg' }, plata(r.totalGastos))),
        h('span', {}, 'Diferencia ', h('b', { class: `num ${r.diferencia < 0 ? 'neg' : 'pos'}` }, plata(r.diferencia)))));
    const sinNada = !d.cuentas.length && !d.categorias.length && !d.creditos.length;
    const fija = h('div', { class: 'fz-fija' }, piezasCabecera(), disponible,
      sinNada ? h('div', { class: 'vacio' }, h('h2', {}, 'Empecemos'),
        h('p', {}, 'Creá tus cuentas, tarjetas y categorías desde Configurar Finanzas. Después ya podés cargar gastos e ingresos.'),
        h('a', { href: '#/finanzas/config', class: 'boton principal' }, ic('engranaje'), 'Configurar Finanzas')) : null);
    const plegados = leerPlegados();
    const n = columnasVisibles();
    nDibujado = n;
    // En el celular, su lista propia; en la PC, las tres columnas.
    const cols = n === 1 ? [d.panelCelular(), [], []] : d.panelPC();
    // Columnas que se ven, y qué columnas guardadas muestra cada una.
    const reparto = n === 3 ? [[0], [1], [2]] : n === 2 ? [[0], [1, 2]] : [[0]];
    const grilla = h('div', { class: 'fz-columnas', style: `--n:${n}`, 'data-n': String(n) },
      reparto.map((logicas, i) => h('div', { class: 'fz-col', 'data-logica': String(logicas[0]) },
        i === 0 ? fija : null,
        logicas.map(l => cols[l].map(k => cuadro(k, r, plegados, l))))));
    hacerMovibles(grilla);
    return [grilla];
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
        r.credito.totalAnteriores ? linea(ctx, `${r.credito.venceAnterior && r.credito.venceAnterior < hoy() && mesVista === mesActual() ? 'Atrasado' : 'Pendiente'} del mes anterior${r.credito.venceAnterior ? ` (vence ${fechaLarga(r.credito.venceAnterior)})` : ''}`, h('span', { class: 'neg' }, `− ${plata(r.credito.totalAnteriores)}`)) : null,
        r.proximo ? [linea(ctx, `Próximo vencimiento (${fechaLarga(r.proximo.resumenes.map(x => x.vencimiento).sort()[0])})`, `− ${plata(r.proximo.total)}`),
          r.proximo.cubierto ? linea(ctx, 'Cubre el fondo', `+ ${plata(r.proximo.cubierto)}`) : null,
          r.credito.reparto ? linea(ctx, `Lo pagás con lo de ${nombreMes(r.proximo.mes, false).toLowerCase()}`, `+ ${plata(r.credito.reparto)}`) : null] : null,
        !r.credito.totalAnteriores && !r.proximo ? h('p', { class: 'nota' }, 'No hay vencimientos pendientes.') : null,
        total('Crédito de este mes', `− ${plata(r.faltanteCredito)}`)),
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
        [...x.subs.values()].map(s => linea(ctx, s.cat.nombre, plata(s.total), 'fz-sub2')),
        x.subs.size && x.general ? linea(ctx, 'General', plata(x.general), 'fz-sub2') : null]) : h('p', { class: 'nota' }, 'Nada todavía.'),
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
      const filaTabla = (f) => h('tr', { class: `${f === actual ? 'sel' : ''}${f.excedido ? ' fz-excedido' : ''}`, onclick: () => { elegido = f.cat.id; dibujar(); } },
        h('td', {}, h('span', { class: `fz-auto ${f.cat.automatico ? 'si' : 'no'}` }, f.cat.automatico ? '✓' : '✗'), f.cat.nombre),
        h('td', { class: 'nota' }, f.cat.dia ? `día ${f.cat.dia}` : '—'),
        h('td', { class: 'der num' }, plata(f.presupuesto)), h('td', { class: `der num${f.excedido ? ' neg' : ''}` }, plata(f.gastado)),
        h('td', { class: `der num ${f.excedido ? 'neg' : f.falta ? '' : 'pos'}` }, f.excedido ? `+ ${plata(f.excedido)}` : f.falta ? plata(f.falta) : 'Pagado'));
      const ocultosDet = leerPref('fz-fijos-detalle-ocultos', false);
      const pagadosDet = fijos.filter(estaPagado).length;
      const filas = porGrupoFijo(fijos).map(([titulo, lista]) => [
        h('tr', { class: 'fz-fila-grupo' }, h('td', {}, titulo), h('td', {}),
          h('td', { class: 'der num' }, plata(lista.reduce((a, f) => a + f.presupuesto, 0))),
          h('td', { class: 'der num' }, plata(lista.reduce((a, f) => a + f.gastado, 0))),
          h('td', { class: 'der num' }, plata(lista.reduce((a, f) => a + f.falta, 0)))),
        (ocultosDet ? lista.filter(f => !estaPagado(f)) : lista).map(filaTabla)]);
      return [
        metricas(['Presupuesto del mes', plata(pres)], ['Gastado', plata(gast), '', pres ? `${Math.round(gast / pres * 100)} % del presupuesto` : null],
          ['Falta pagar', plata(fijos.reduce((a, f) => a + f.falta, 0)), 'neg', 'Se resta del Disponible']),
        tarjeta(h('div', { class: 'fz-cab-flex' }, h('h2', {}, nombreMes(mesVista)),
            pagadosDet ? h('button', { type: 'button', class: 'fz-link', onclick: () => { guardarPref('fz-fijos-detalle-ocultos', !ocultosDet); dibujar(); } },
              ocultosDet ? `Mostrar pagados (${pagadosDet})` : 'Ocultar pagados') : null),
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
        (() => { const rm = d.resumenMes(mesVista); const t = transferirFondo(rm); const b = bloqueCreditoMes(rm.credito); return t || b ? tarjeta(h('h2', {}, `Pago de ${nombreMes(mesVista, false).toLowerCase()}`), t, b) : null; })(),
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
            x.subs.size && x.general ? linea(ctx, 'General', plata(x.general), 'fz-sub2') : null,
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

  // Si cambia el ancho y entran más o menos columnas, se vuelve a armar el panel.
  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (vista !== 'panel' || arrastrando) return;
    if (nDibujado !== null && columnasVisibles() !== nDibujado) dibujar();
  }) : null;
  observador?.observe(cuerpo);

  dibujar();
  return () => { quitar(); clearTimeout(espera); observador?.disconnect(); };
}

// Para el bloque de Inicio.
export async function resumenParaInicio(ctx) {
  const d = await crearModelo(ctx).cargar();
  return { d, r: d.resumenMes(mesActual()) };
}
