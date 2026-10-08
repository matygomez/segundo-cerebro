// ─────────────────────────────────────────────────────────────
// Finanzas: Configurar Finanzas.
// Crear, editar y eliminar cuentas, grupos, crédito, categorías e
// inversiones. Lo que ya tiene movimientos se archiva en vez de
// borrarse, así no se pierde el historial.
// ─────────────────────────────────────────────────────────────

import { plata, mesActual, redondear } from './modelo.js';
import { poner, hoja, campo, inputImporte, hacerOrdenable, ic } from './comun.js';

export function vistaConfig(cuerpo, ctx, m, d) {
  const { h } = ctx;
  const leer = (input) => redondear(Number(String(input.value || 0).replace(',', '.')));
  const nombreInput = (valor = '', placeholder = '') => h('input', { type: 'text', value: valor, placeholder, autocomplete: 'off' });

  async function eliminar(coleccion, item, nombre) {
    const usado = d.usadoEnMovimientos(coleccion, item.id);
    const texto = usado
      ? `"${nombre}" tiene movimientos, así que se va a archivar: deja de aparecer en los formularios y en el panel, pero su historial se conserva y la podés restaurar.`
      : `¿Eliminar "${nombre}"?`;
    if (!await ctx.confirmar(texto, { si: usado ? 'Archivar' : 'Eliminar', peligro: !usado })) return;
    const r = await m.eliminarOArchivar(d, coleccion, item);
    ctx.aviso(r === 'archivado' ? `"${nombre}" archivado` : `"${nombre}" eliminado`);
  }

  const asa = (nombre) => h('button', { type: 'button', class: 'fz-asa-ord', 'aria-label': `Mover ${nombre} (arrastrá, o usá las flechas)`, title: 'Arrastrá para cambiar el orden' }, ic('asa'));
  const fila = (titulo, detalle, alEditar, alEliminar, clase = '', id = null) => h('div', { class: `fz-conf-fila ${clase}`, 'data-id': id },
    id ? asa(titulo) : null,
    h('span', { class: 'fz-conf-nombre' }, h('b', {}, titulo), detalle ? [h('br'), h('span', { class: 'nota' }, detalle)] : null),
    h('span', { class: 'fz-conf-acc' },
      h('button', { type: 'button', class: 'boton chico', onclick: alEditar }, 'Editar'),
      h('button', { type: 'button', class: 'boton chico peligro', onclick: alEliminar }, 'Eliminar')));

  const listaOrd = (coleccion, items) => h('div', { class: 'fz-lista-ord', 'data-coleccion': coleccion }, items);
  const seccion = (titulo, boton, ...contenido) => h('section', { class: 'fz-tarjeta-det' },
    h('div', { class: 'fz-cab-flex' }, h('h2', {}, titulo), boton), contenido);

  // ── Formularios ──

  function formGrupo(g = null) {
    const nombre = nombreInput(g?.nombre, 'Ej. Banco');
    return hoja(ctx, {
      titulo: g ? 'Editar grupo' : 'Nuevo grupo', cuerpo: [campo(ctx, 'Nombre', nombre)],
      alGuardar: async () => {
        if (!nombre.value.trim()) return 'Escribí un nombre.';
        if (g) await m.actualizar('grupos', g.id, { nombre: nombre.value.trim() });
        else await m.crear('grupos', { nombre: nombre.value.trim() });
      },
    });
  }

  function formCuenta(c = null, tipoInicial = 'cuenta') {
    const tipo = c?.tipo || tipoInicial;
    const nombre = nombreInput(c?.nombre, tipo === 'inversion' ? 'Ej. Fondo de emergencia' : 'Ej. Mercado Pago');
    const grupo = h('select', {}, h('option', { value: '' }, 'Sin grupo'), d.grupos.map(g => h('option', { value: g.id, selected: g.id === c?.grupoId }, g.nombre)));
    const clase = h('select', {}, h('option', { value: 'cuenta', selected: tipo === 'cuenta' }, 'Cuenta (suma al Disponible)'), h('option', { value: 'reserva', selected: tipo === 'reserva' }, 'Reserva (no suma al Disponible)'));
    const saldo = inputImporte(ctx, c ? c.saldoInicial : '');
    saldo.removeAttribute('min');
    const fondo = h('input', { type: 'checkbox', checked: !!c?.fondoCredito });
    const filaFondo = h('label', { class: 'fila-campo casilla' }, fondo, h('span', { class: 'etiqueta-campo' }, 'Es el fondo para pagar el crédito'));
    const ajustarFondo = () => { filaFondo.hidden = clase.value !== 'reserva'; };
    clase.addEventListener('change', ajustarFondo); ajustarFondo();
    const esInv = tipo === 'inversion';
    return hoja(ctx, {
      titulo: c ? `Editar ${c.nombre}` : esInv ? 'Nueva inversión' : 'Nueva cuenta',
      cuerpo: [campo(ctx, 'Nombre', nombre),
        esInv ? null : campo(ctx, 'Grupo', grupo),
        esInv ? null : campo(ctx, 'Tipo', clase),
        campo(ctx, esInv ? 'Saldo inicial' : 'Saldo inicial', saldo, c ? 'Es el saldo con el que arrancó. Para corregir el saldo de hoy usá "Ajustar".' : 'Lo que tiene hoy.'),
        esInv ? null : filaFondo],
      alGuardar: async () => {
        if (!nombre.value.trim()) return 'Escribí un nombre.';
        const datos = { nombre: nombre.value.trim(), saldoInicial: leer(saldo) };
        if (!esInv) Object.assign(datos, { grupoId: grupo.value, tipo: clase.value, fondoCredito: clase.value === 'reserva' && fondo.checked });
        else datos.tipo = 'inversion';
        if (datos.fondoCredito) {
          for (const otra of d.cuentas.filter(x => x.fondoCredito && x.id !== c?.id)) await m.actualizar('cuentas', otra.id, { fondoCredito: false });
        }
        if (c) await m.actualizar('cuentas', c.id, datos);
        else await m.crear('cuentas', { ...datos, archivada: false });
      },
    });
  }

  function formCredito(c = null) {
    const nombre = nombreInput(c?.nombre, 'Ej. Naranja');
    const cierre = h('input', { type: 'number', min: 1, max: 31, inputmode: 'numeric', value: c?.diaCierre || '', placeholder: '27' });
    const vence = h('input', { type: 'number', min: 1, max: 31, inputmode: 'numeric', value: c?.diaVencimiento || '', placeholder: '10' });
    return hoja(ctx, {
      titulo: c ? `Editar ${d.nombreCredito(c)}` : 'Nueva tarjeta de crédito',
      cuerpo: [campo(ctx, 'Nombre', nombre), h('div', { class: 'fz-dos' }, campo(ctx, 'Día de cierre', cierre), campo(ctx, 'Día de vencimiento', vence)),
        h('p', { class: 'nota' }, 'Son aproximados: cada mes la app los sugiere y los podés corregir desde el resumen. Aunque se llame igual que una cuenta (por ejemplo Mercado Pago), la tarjeta siempre aparece como "(crédito)".')],
      alGuardar: async () => {
        if (!nombre.value.trim()) return 'Escribí un nombre.';
        const dc = Number(cierre.value), dv = Number(vence.value);
        if (!(dc >= 1 && dc <= 31) || !(dv >= 1 && dv <= 31)) return 'Completá los días de cierre y vencimiento (del 1 al 31).';
        const datos = { nombre: nombre.value.trim(), diaCierre: dc, diaVencimiento: dv };
        if (c) await m.actualizar('creditos', c.id, datos);
        else await m.crear('creditos', { ...datos, fechas: {}, archivado: false });
      },
    });
  }

  function formCategoria(tipo, cat = null, padre = null) {
    const nombre = nombreInput(cat?.nombre, padre ? 'Ej. Remedios' : tipo === 'fijo' ? 'Ej. Alquiler' : tipo === 'ingreso' ? 'Ej. Sueldo' : 'Ej. Bebé');
    const filas = [campo(ctx, 'Nombre', nombre)];
    let presupuesto, dia, automatico, grupoFijo;
    if (tipo === 'fijo') {
      grupoFijo = h('select', {}, h('option', { value: 'familia', selected: cat?.grupoFijo !== 'personal' }, 'Familia'), h('option', { value: 'personal', selected: cat?.grupoFijo === 'personal' }, 'Personal'));
      filas.push(campo(ctx, 'Grupo', grupoFijo));
      presupuesto = inputImporte(ctx, cat ? d.presupuesto(cat, mesActual()) : '');
      dia = h('input', { type: 'number', min: 1, max: 31, inputmode: 'numeric', value: cat?.dia || '', placeholder: '10' });
      automatico = h('input', { type: 'checkbox', checked: !!cat?.automatico });
      filas.push(h('div', { class: 'fz-dos' }, campo(ctx, cat ? 'Presupuesto desde este mes' : 'Presupuesto mensual', presupuesto), campo(ctx, 'Día de vencimiento', dia)),
        h('label', { class: 'fila-campo casilla' }, automatico, h('span', { class: 'etiqueta-campo' }, 'Se paga automático')),
        cat ? h('p', { class: 'nota' }, 'Si cambiás el presupuesto, el anterior queda en el historial y los meses pasados conservan el suyo.') : null);
    }
    const titulos = { fijo: 'gasto fijo', variable: padre ? 'subcategoría' : 'categoría de gasto', ingreso: 'categoría de ingreso' };
    return hoja(ctx, {
      titulo: `${cat ? 'Editar' : 'Nueva'} ${titulos[tipo]}${padre ? ` en ${padre.nombre}` : ''}`,
      cuerpo: filas,
      alGuardar: async () => {
        if (!nombre.value.trim()) return 'Escribí un nombre.';
        const datos = { nombre: nombre.value.trim() };
        if (tipo === 'fijo') Object.assign(datos, { dia: Number(dia.value) || '', automatico: automatico.checked, grupoFijo: grupoFijo.value });
        if (cat) {
          if (tipo === 'fijo' && presupuesto.value !== '' && leer(presupuesto) !== d.presupuesto(cat, mesActual())) await m.cambiarPresupuesto(cat, leer(presupuesto), mesActual());
          return void await m.actualizar('categorias', cat.id, datos);
        }
        Object.assign(datos, { tipo, padreId: padre?.id || '', archivada: false });
        if (tipo === 'fijo') datos.presupuestos = presupuesto.value === '' ? [] : [{ desde: mesActual(), monto: leer(presupuesto) }];
        await m.crear('categorias', datos);
      },
    });
  }

  // ── Secciones ──

  const nuevoBoton = (texto, accion) => h('button', { type: 'button', class: 'boton chico', onclick: accion }, texto);

  function seccionCuentas() {
    const cuentas = d.cuentas.filter(c => !c.archivada && c.tipo !== 'inversion');
    const filaCuenta = (c) => fila(c.nombre,
      [c.tipo === 'reserva' ? 'Reserva' : 'Cuenta', `saldo inicial ${plata(c.saldoInicial || 0)}`, c.fondoCredito ? 'fondo para crédito' : null].filter(Boolean).join(' · '),
      () => formCuenta(c), () => eliminar('cuentas', c, c.nombre), 'fz-conf-sub', c.id);
    const bloques = d.grupos.map(g => h('div', { class: 'fz-conf-bloque', 'data-id': g.id },
      h('div', { class: 'fz-conf-grupo' }, asa(g.nombre), h('span', { class: 'fz-conf-nombre' }, g.nombre),
        h('span', { class: 'fz-conf-acc' }, nuevoBoton('Editar', () => formGrupo(g)),
          h('button', { type: 'button', class: 'boton chico peligro', onclick: () => eliminar('grupos', g, g.nombre) }, 'Eliminar'))),
      listaOrd('cuentas', cuentas.filter(c => c.grupoId === g.id).map(filaCuenta))));
    const sueltas = cuentas.filter(c => !d.grupo(c.grupoId));
    return seccion('Cuentas y grupos', h('span', { class: 'botonera' }, nuevoBoton('+ Cuenta', () => formCuenta()), nuevoBoton('+ Grupo', () => formGrupo())),
      listaOrd('grupos', bloques),
      sueltas.length ? [d.grupos.length ? h('div', { class: 'fz-conf-grupo' }, h('span', {}, 'Sin grupo')) : null, listaOrd('cuentas', sueltas.map(filaCuenta))] : null,
      !cuentas.length ? h('p', { class: 'nota' }, 'Creá tus cuentas (bancos, billeteras, efectivo) y, si querés, agrupalas. Para el fondo con el que pagás las tarjetas, creá una cuenta tipo Reserva y marcala como fondo para crédito.') : null);
  }

  function seccionCredito() {
    const lista = d.creditosActivos();
    return seccion('Crédito', nuevoBoton('+ Tarjeta', () => formCredito()),
      listaOrd('creditos', lista.map(c => fila(d.nombreCredito(c), `Cierre cerca del ${c.diaCierre} · vence cerca del ${c.diaVencimiento}`, () => formCredito(c), () => eliminar('creditos', c, d.nombreCredito(c)), '', c.id))),
      lista.length ? null : h('p', { class: 'nota' }, 'Sin tarjetas todavía.'),
      d.fondo() ? h('p', { class: 'nota' }, `El crédito se paga con el fondo "${d.fondo().nombre}". Se cambia editando las cuentas.`) : h('p', { class: 'nota' }, 'Todavía no elegiste un fondo para pagar el crédito.'));
  }

  function seccionFijos() {
    const lista = d.categoriasDe('fijo');
    const filaFijo = (c) => fila(c.nombre, `Presupuesto ${plata(d.presupuesto(c, mesActual()))}${c.dia ? ` · día ${c.dia}` : ''} · ${c.automatico ? '✓ automático' : '✗ manual'}`,
      () => formCategoria('fijo', c), () => eliminar('categorias', c, c.nombre), 'fz-conf-sub', c.id);
    const grupos = [['Familia', lista.filter(c => c.grupoFijo !== 'personal')], ['Personal', lista.filter(c => c.grupoFijo === 'personal')]].filter(([, l]) => l.length);
    return seccion('Gastos fijos', nuevoBoton('+ Gasto fijo', () => formCategoria('fijo')),
      grupos.map(([titulo, l]) => [h('div', { class: 'fz-conf-grupo' }, h('span', {}, titulo)), listaOrd('categorias', l.map(filaFijo))]),
      lista.length ? null : h('p', { class: 'nota' }, 'Sin gastos fijos todavía.'));
  }

  function seccionVariables() {
    const lista = d.categoriasDe('variable');
    return seccion('Gastos variables', nuevoBoton('+ Categoría', () => formCategoria('variable')),
      listaOrd('categorias', lista.map(c => {
        const subs = d.subcategorias(c.id);
        return h('div', { class: 'fz-conf-cat', 'data-id': c.id },
          fila(c.nombre, subs.length ? `${subs.length} subcategoría${subs.length === 1 ? '' : 's'}` : 'Sin subcategorías', () => formCategoria('variable', c), () => eliminar('categorias', c, c.nombre), '', c.id),
          listaOrd('categorias', subs.map(sb => fila(sb.nombre, null, () => formCategoria('variable', sb, c), () => eliminar('categorias', sb, sb.nombre), 'fz-conf-sub', sb.id))),
          h('div', { class: 'fz-conf-sub fz-conf-nueva' }, nuevoBoton(`+ Subcategoría en ${c.nombre}`, () => formCategoria('variable', null, c))));
      })),
      lista.length ? null : h('p', { class: 'nota' }, 'Sin categorías todavía. Por ejemplo: Bebé, con subcategorías Remedios, Ropa y Pañales.'));
  }

  function seccionIngresos() {
    const lista = d.categoriasDe('ingreso');
    return seccion('Categorías de ingreso', nuevoBoton('+ Categoría', () => formCategoria('ingreso')),
      listaOrd('categorias', lista.map(c => fila(c.nombre, null, () => formCategoria('ingreso', c), () => eliminar('categorias', c, c.nombre), '', c.id))),
      lista.length ? null : h('p', { class: 'nota' }, 'Sin categorías todavía. Por ejemplo: Sueldo, Extra.'));
  }

  function seccionInversiones() {
    const lista = d.cuentasActivas('inversion');
    return seccion('Inversiones', nuevoBoton('+ Inversión', () => formCuenta(null, 'inversion')),
      listaOrd('cuentas', lista.map(c => fila(c.nombre, `Saldo actual ${plata(d.saldo(c.id))}`, () => formCuenta(c), () => eliminar('cuentas', c, c.nombre), '', c.id))),
      lista.length ? null : h('p', { class: 'nota' }, 'Sin inversiones todavía.'));
  }

  function seccionArchivados() {
    const items = [
      ...d.cuentas.filter(c => c.archivada).map(c => [c.nombre, 'cuentas', c, { archivada: false }]),
      ...d.creditos.filter(c => c.archivado).map(c => [d.nombreCredito(c), 'creditos', c, { archivado: false }]),
      ...d.categorias.filter(c => c.archivada).map(c => [d.nombreCategoria(c.id), 'categorias', c, { archivada: false }]),
    ];
    if (!items.length) return null;
    return h('details', { class: 'fz-archivados' }, h('summary', {}, `Archivados (${items.length})`),
      items.map(([n, col, item, cambios]) => h('div', { class: 'fz-conf-fila' }, h('span', {}, n),
        h('button', { type: 'button', class: 'boton chico', onclick: () => m.actualizar(col, item.id, cambios) }, 'Restaurar'))));
  }

  const grilla = h('div', { class: 'fz-det-grilla' }, seccionCuentas(), seccionCredito(), seccionFijos(), seccionVariables(), seccionIngresos(), seccionInversiones());
  hacerOrdenable(grilla, (lista, ids) => m.reordenar(lista.dataset.coleccion, ids));
  poner(cuerpo,
    h('a', { href: '#/finanzas', class: 'fz-volver' }, '← Panel'),
    h('h2', { class: 'fz-det-titulo' }, 'Configurar Finanzas'),
    h('p', { class: 'nota' }, 'Acá se crean, modifican y eliminan las cuentas, el crédito, las categorías y las inversiones. Con la manija ⋮⋮ cambiás el orden dentro de cada lista. Si algo ya tiene movimientos, en lugar de eliminarse se archiva, así no se pierde el historial.'),
    grilla,
    seccionArchivados());
}
