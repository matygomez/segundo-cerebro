// ─────────────────────────────────────────────────────────────
// Módulo Calendario.
//
// Es un módulo más, pero no guarda tareas ni eventos propios: le
// pregunta a Tareas qué hay en cada día (tareas, pagos de Finanzas,
// reuniones, eventos y feriados que llegan de Google Calendar) y lo
// muestra en un mes. Solo guarda su configuración.
//
// Arranca oculto (no está en el menú): se abre tocando la fecha en
// Inicio. Desde Ajustes › Módulos se puede mostrar en el menú.
//
// Dos vistas: "Semana" (el Planificador semanal, en semana.js) y "Mes".
// Rutas: #/calendario (la última vista usada)  ·  #/calendario/semana
//        #/calendario/mes  ·  #/calendario/AAAA-MM-DD (el mes, en ese día)
// ─────────────────────────────────────────────────────────────

import { pantallaSemana } from './semana.js';

const pad = (n) => String(n).padStart(2, '0');
// Última vista usada en este dispositivo.
const vistaGuardada = () => { try { return localStorage.getItem('sc-cal-vista') || 'semana'; } catch { return 'semana'; } };
const guardarVista = (v) => { try { localStorage.setItem('sc-cal-vista', v); } catch { /* nada */ } };
const aISO = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const deISO = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const hoyISO = () => aISO(new Date());
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TIPOS = {
  tarea: 'Tareas', venc: 'Vencidas', fin: 'Pagos', reu: 'Reuniones', ev: 'Eventos', fer: 'Feriados',
};
const esPC = () => matchMedia('(min-width: 900px)').matches;

// Lo que se ve: el mes y el día elegido (se recuerdan mientras la app está abierta).
let mesVista = null;    // Date del día 1
let diaElegido = null;  // 'AAAA-MM-DD'

function cargarEstilos() {
  if (document.getElementById('estilos-calendario')) return;
  const l = document.createElement('link');
  l.id = 'estilos-calendario';
  l.rel = 'stylesheet';
  l.href = new URL('./calendario.css', import.meta.url).href;
  document.head.append(l);
}

const CONFIG_INICIAL = { semana: 'lunes', repetidas: true, completadas: true, leyenda: true };
async function leerConfig(ctx) {
  const lista = await ctx.datos('ajustes').listar();
  const r = lista.find(x => x.clave === (esPC() ? 'config-pc' : 'config-cel'));
  return { ...CONFIG_INICIAL, ...(r || {}), _id: r?.id || null };
}
async function guardarConfig(ctx, cfg, cambios) {
  const datos = { clave: esPC() ? 'config-pc' : 'config-cel', semana: cfg.semana, repetidas: cfg.repetidas, completadas: cfg.completadas, leyenda: cfg.leyenda, ...cambios };
  if (cfg._id) await ctx.datos('ajustes').actualizar(cfg._id, datos);
  else await ctx.datos('ajustes').crear(datos);
}

// En el celular, el teclado solo se abre si el foco se pide en el mismo toque.
// Como la ventana de la tarea se abre un instante después, se enfoca antes un
// campo invisible y la ventana le pasa el foco al título.
function abrirTecladoYa() {
  const i = document.createElement('input');
  i.setAttribute('aria-hidden', 'true');
  i.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.append(i);
  i.focus();
  setTimeout(() => i.remove(), 2500);
}

// Configuración del Calendario (vale para Semana y Mes).
async function abrirConfigCal(ctx, alCerrar) {
  const { h, icono } = ctx;
  const cfg = await leerConfig(ctx);
  const fila = (texto, opciones, actual, clave) => h('div', { class: 'cl-cfg-fila' }, h('span', {}, texto),
    h('span', { class: 'cl-seg', role: 'group', 'aria-label': texto }, opciones.map(([v, t]) => h('button', {
      type: 'button', class: v === actual ? 'activo' : '', 'aria-pressed': String(v === actual),
      onclick: async () => { await guardarConfig(ctx, cfg, { [clave]: v }); dlg.close(); abrirConfigCal(ctx, alCerrar); },
    }, t))));
  const dlg = h('dialog', { class: 'hoja cl-config' },
    h('header', { class: 'hoja-cabecera' }, h('h2', {}, 'Configurar Calendario'),
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, icono('cerrar'))),
    fila('La semana empieza el', [['lunes', 'Lunes'], ['domingo', 'Domingo']], cfg.semana, 'semana'),
    fila('Tareas que se repiten', [[true, 'Mostrar'], [false, 'No']], cfg.repetidas, 'repetidas'),
    fila('Completadas en días pasados', [[true, 'Mostrar'], [false, 'No']], cfg.completadas, 'completadas'),
    fila('Leyenda de colores', [[true, 'Mostrar'], [false, 'No']], cfg.leyenda, 'leyenda'),
    h('p', { class: 'nota' }, `Se guarda por separado en la PC y en el celular (ahora estás en ${esPC() ? 'la PC' : 'el celular'}). Qué calendarios de Google llegan, y a dónde, se elige en Tareas › ⚙.`));
  dlg.addEventListener('close', () => { dlg.remove(); alCerrar?.(); });
  document.body.append(dlg);
  dlg.showModal();
}

// ── Esta semana (Inicio) ──
const DSEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const LEYENDA_SEMANA = [['tarea', 'Tareas'], ['reu', 'Reuniones'], ['fin', 'Vencimientos'], ['fer', 'Feriados']];
function abrirItem(ctx, x) {
  if (x.tipo === 'fin' && x.clave.startsWith('finanzas:fijo:')) return ctx.navegar('finanzas/detalle/fijos');
  if (x.tipo === 'fin' && x.clave.startsWith('finanzas:tarjeta:')) return ctx.navegar('finanzas/detalle/credito');
  ctx.pedir('abrir-tarea', { id: x.id }).catch(e => ctx.aviso(e.message));
}
async function dibujarSemana(ctx, contenedor, op) {
  const { h } = ctx;
  const vale = (x) => {
    if (x.tipo === 'reu' || x.tipo === 'ev') return op.reuniones !== false;
    if (x.tipo === 'fin') return op.pagos !== false;
    if (x.tipo === 'fer') return op.feriados !== false;
    return true;
  };
  async function pintar() {
    const cfg = await leerConfig(ctx);
    const hoyD = new Date(); hoyD.setHours(0, 0, 0, 0);
    const ini = new Date(hoyD);
    if (!op.desdeHoy) ini.setDate(hoyD.getDate() - (cfg.semana === 'domingo' ? hoyD.getDay() : (hoyD.getDay() + 6) % 7));
    const dias = Array.from({ length: 7 }, (_, i) => new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i));
    const desde = aISO(dias[0]), hasta = aISO(dias[6]), hoy = hoyISO();
    let items = [];
    try { items = ((await ctx.pedir('calendario-items', { desde, hasta, repetidas: cfg.repetidas })) || []).filter(vale); }
    catch { contenedor.replaceChildren(h('p', { class: 'nota' }, 'El calendario muestra lo que hay en Tareas, y Tareas no está disponible.')); return; }
    const porDia = new Map();
    for (const x of items) { if (!porDia.has(x.fecha)) porDia.set(x.fecha, []); porDia.get(x.fecha).push(x); }
    const proximos = items.filter(x => !x.hecha && x.fecha >= hoy);
    const fila = (x) => {
      const f = deISO(x.fecha);
      const der = x.hora || (x.tipo === 'fer' ? 'Feriado' : x.lugar || '');
      return h('button', { type: 'button', class: `cl-sem-it t-${x.tipo}`, 'data-fecha': x.fecha, onclick: () => abrirItem(ctx, x) },
        h('span', { class: 'cl-sem-d' }, x.fecha === hoy ? 'Hoy' : DSEM[f.getDay()]),
        h('span', { class: 'cl-sem-t' }, x.titulo),
        der ? h('span', { class: 'cl-sem-der' }, der) : null);
    };
    const lista = h('div', { class: 'cl-sem-lista' }, proximos.map(fila));
    const riel = h('span', { class: 'cl-sem-riel', 'aria-hidden': 'true' }, h('i'));
    contenedor.replaceChildren(...[
      h('div', { class: 'cl-sem-dias' }, dias.map(f => {
        const k = aISO(f), del = porDia.get(k) || [];
        return h('button', {
          type: 'button', 'data-fecha': k, class: `cl-sem-dia${k === hoy ? ' hoy' : ''}${del.some(x => x.tipo === 'fer') ? ' feriado' : ''}`,
          'aria-label': `${f.getDate()}${del.length ? `, ${del.length} cosa${del.length > 1 ? 's' : ''}` : ''}`,
          onclick: () => irAlDia(k),
        },
        h('small', {}, DSEM[f.getDay()]), h('b', {}, String(f.getDate())),
        h('span', { class: 'cl-puntos' }, del.slice(0, 5).map(x => h('i', { class: `cl-p t-${x.tipo}${x.repite || x.hecha ? ' suave' : ''}` }))));
      })),
      cfg.leyenda !== false ? h('div', { class: 'cl-sem-leyenda' }, LEYENDA_SEMANA.filter(([t]) => vale({ tipo: t })).map(([t, n]) => h('span', {}, h('i', { class: `cl-p t-${t}` }), n))) : null,
      op.lista !== false ? (proximos.length ? h('div', { class: 'cl-sem-caja' }, lista, riel) : h('p', { class: 'nota cl-sem-nada' }, 'Nada más por esta semana.')) : null,
    ].filter(Boolean));
    // Barrita al costado: siempre visible si hay más de lo que entra (en Android la del sistema se esconde).
    const moverRiel = () => {
      const sobra = lista.scrollHeight - lista.clientHeight;
      riel.hidden = sobra <= 1;
      if (sobra <= 1) return;
      const alto = Math.max(14, riel.clientHeight * lista.clientHeight / lista.scrollHeight);
      riel.firstChild.style.height = `${alto}px`;
      riel.firstChild.style.top = `${(riel.clientHeight - alto) * lista.scrollTop / sobra}px`;
    };
    // Tocar un día: la lista baja hasta lo de ese día y lo resalta.
    function irAlDia(k) {
      contenedor.querySelectorAll('.cl-sem-dia.sel').forEach(b => b.classList.remove('sel'));
      contenedor.querySelector(`.cl-sem-dia[data-fecha="${k}"]`)?.classList.add('sel');
      lista.querySelectorAll('.cl-sem-it.marcado').forEach(b => b.classList.remove('marcado'));
      const filas = [...lista.querySelectorAll(`.cl-sem-it[data-fecha="${k}"]`)];
      if (!filas.length) {
        const f = deISO(k);
        ctx.aviso(k < hoy ? `El ${DSEM[f.getDay()].toLowerCase()} ${f.getDate()} ya pasó.` : `Nada pendiente el ${DSEM[f.getDay()].toLowerCase()} ${f.getDate()}.`, { duracion: 2200 });
        return;
      }
      lista.scrollTo({ top: filas[0].offsetTop, behavior: 'smooth' });
      filas.forEach(b => b.classList.add('marcado'));
      setTimeout(() => filas.forEach(b => b.classList.remove('marcado')), 1600);
    }
    lista.addEventListener('scroll', moverRiel, { passive: true });
    requestAnimationFrame(moverRiel);
  }
  let espera = null;
  const refrescar = () => { clearTimeout(espera); espera = setTimeout(pintar, 120); };
  const quitar1 = ctx.alCambiarDatosDe?.('tareas', refrescar);
  const quitar2 = ctx.alCambiarDatos(refrescar);
  await pintar();
  return () => { quitar1?.(); quitar2?.(); clearTimeout(espera); };
}

export default {
  id: 'calendario',
  nombre: 'Calendario',

  // Cuadro "Esta semana" para el Inicio.
  bloquesInicio(ctx) {
    return [{
      id: 'semana',
      titulo: 'Esta semana',
      enlace: { texto: 'Calendario ›', href: '#/calendario' },
      ancho: 'mitad',
      opciones: [
        { id: 'lista', texto: 'Lo que viene', defecto: true },
        { id: 'reuniones', texto: 'Reuniones', defecto: true },
        { id: 'pagos', texto: 'Vencimientos', defecto: true },
        { id: 'feriados', texto: 'Feriados', defecto: true },
        { id: 'desdeHoy', texto: 'Empieza hoy (no el lunes)', defecto: false },
      ],
      async dibujar(contenedor, { opciones = {} } = {}) {
        cargarEstilos();
        return dibujarSemana(ctx, contenedor, opciones);
      },
    }];
  },

  async pantalla(contenedor, ctx, sub = []) {
    cargarEstilos();
    const { h, icono } = ctx;
    const vista = sub[0] === 'semana' || sub[0] === 'mes' ? sub[0] : (sub[0] ? 'mes' : vistaGuardada());
    guardarVista(vista);
    // Cabecera común: título, Semana / Mes y configuración.
    const cabecera = (v) => h('header', { class: 'cl-cab' },
      h('div', { class: 'cl-titulos' },
        h('h1', { class: 'cl-titulo' }, icono('calendario'), v === 'semana' ? 'Planificador semanal' : 'Calendario'),
        v === 'semana' ? h('p', { class: 'nota cl-sub' }, 'Repartí tus tareas de la semana y ponete un premio por cumplirlas.') : null),
      h('span', { class: 'cl-vistas', role: 'group', 'aria-label': 'Vista' },
        h('button', { type: 'button', class: v === 'semana' ? 'activo' : '', 'aria-pressed': String(v === 'semana'), onclick: () => ctx.navegar('calendario/semana') }, 'Semana'),
        h('button', { type: 'button', class: v === 'mes' ? 'activo' : '', 'aria-pressed': String(v === 'mes'), onclick: () => ctx.navegar('calendario/mes') }, 'Mes')),
      h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Configurar Calendario', title: 'Configurar Calendario', onclick: () => abrirConfigCal(ctx, () => alCerrarConfig()) }, icono('ajustes')));
    let alCerrarConfig = () => {};
    if (vista === 'semana') {
      return pantallaSemana(contenedor, ctx, { leerConfig: () => leerConfig(ctx), cabecera });
    }
    if (sub[0] && /^\d{4}-\d{2}-\d{2}$/.test(sub[0])) { diaElegido = sub[0]; mesVista = new Date(deISO(sub[0]).getFullYear(), deISO(sub[0]).getMonth(), 1); }
    if (!diaElegido) diaElegido = hoyISO();
    if (!mesVista) { const d = deISO(diaElegido); mesVista = new Date(d.getFullYear(), d.getMonth(), 1); }

    const titMes = h('h2', { class: 'cl-mes-titulo' });
    const grilla = h('div', { class: 'cl-grilla', role: 'grid' });
    const dsem = h('div', { class: 'cl-dsem' });
    const leyenda = h('div', { class: 'cl-leyenda' });
    const listaDia = h('section', { class: 'cl-dia', 'aria-live': 'polite' });
    const mover = (n) => { mesVista = new Date(mesVista.getFullYear(), mesVista.getMonth() + n, 1); pintar(); };

    contenedor.replaceChildren(
      cabecera('mes'),
      h('div', { class: 'cl-barra' }, titMes,
        h('button', { type: 'button', class: 'boton cl-nav', 'aria-label': 'Mes anterior', onclick: () => mover(-1) }, '‹'),
        h('button', { type: 'button', class: 'boton cl-hoy', onclick: () => { diaElegido = hoyISO(); const d = new Date(); mesVista = new Date(d.getFullYear(), d.getMonth(), 1); pintar(); } }, 'Hoy'),
        h('button', { type: 'button', class: 'boton cl-nav', 'aria-label': 'Mes siguiente', onclick: () => mover(1) }, '›')),
      h('div', { class: 'cl-cuerpo' },
        h('div', { class: 'cl-mes' }, dsem, grilla, leyenda),
        listaDia),
    );

    // Deslizar con el dedo: cambia de mes.
    let x0 = null;
    grilla.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') x0 = e.clientX; });
    grilla.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 60) mover(dx < 0 ? 1 : -1); });

    let cfg = await leerConfig(ctx);
    let items = [];
    let hayTareas = true;

    async function pintar() {
      cfg = await leerConfig(ctx);
      const lunes = cfg.semana !== 'domingo';
      const primero = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1);
      const corrimiento = lunes ? (primero.getDay() + 6) % 7 : primero.getDay();
      const diasMes = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0).getDate();
      const celdas = Math.ceil((corrimiento + diasMes) / 7) * 7;
      const dias = Array.from({ length: celdas }, (_, i) => new Date(primero.getFullYear(), primero.getMonth(), 1 - corrimiento + i));
      const desde = aISO(dias[0]), hasta = aISO(dias.at(-1));
      try {
        items = (await ctx.pedir('calendario-items', { desde, hasta: diaElegido > hasta ? diaElegido : hasta, repetidas: cfg.repetidas })) || [];
        hayTareas = true;
      } catch { items = []; hayTareas = false; }
      const hoy = hoyISO();
      if (!cfg.completadas) items = items.filter(x => !(x.hecha && x.fecha < hoy));
      const porDia = new Map();
      for (const x of items) { if (!porDia.has(x.fecha)) porDia.set(x.fecha, []); porDia.get(x.fecha).push(x); }

      titMes.textContent = `${MESES[mesVista.getMonth()]} ${mesVista.getFullYear()}`;
      const nombres = lunes ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
      dsem.replaceChildren(...nombres.map(n => h('span', {}, n)));
      grilla.replaceChildren(...dias.map(f => {
        const k = aISO(f);
        const del = porDia.get(k) || [];
        const clases = ['cl-celda',
          f.getMonth() !== mesVista.getMonth() ? 'fuera' : '', k === hoy ? 'hoy' : '', k === diaElegido ? 'elegido' : '',
          del.some(x => x.tipo === 'fer') ? 'feriado' : ''].filter(Boolean).join(' ');
        return h('button', {
          type: 'button', class: clases, role: 'gridcell', 'aria-selected': String(k === diaElegido),
          'aria-label': `${f.getDate()} de ${MESES[f.getMonth()].toLowerCase()}${del.length ? `, ${del.length} cosa${del.length > 1 ? 's' : ''}` : ''}`,
          onclick: () => { diaElegido = k; if (f.getMonth() !== mesVista.getMonth()) mesVista = new Date(f.getFullYear(), f.getMonth(), 1); pintar(); },
        },
        h('span', { class: 'cl-num' }, String(f.getDate())),
        h('span', { class: 'cl-puntos' }, del.slice(0, 6).map(x => h('i', { class: `cl-p t-${x.tipo}${x.repite || x.hecha ? ' suave' : ''}` }))),
        h('span', { class: 'cl-chips' },
          del.slice(0, 3).map(x => h('span', { class: `cl-chip t-${x.tipo}${x.repite ? ' suave' : ''}${x.hecha ? ' hecha' : ''}` }, x.hora ? `${x.hora} ` : '', x.titulo)),
          del.length > 3 ? h('span', { class: 'cl-chip mas' }, `+${del.length - 3} más`) : null));
      }));
      leyenda.hidden = !cfg.leyenda;
      leyenda.replaceChildren(...Object.entries(TIPOS).map(([k, t]) => h('span', {}, h('i', { class: `cl-p t-${k}` }), t)),
        cfg.repetidas ? h('span', {}, h('i', { class: 'cl-p t-tarea suave' }), 'Se repite') : null);
      pintarDia(porDia.get(diaElegido) || []);
    }

    function pintarDia(del) {
      const f = deISO(diaElegido);
      const titulo = f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
      const feriado = del.find(x => x.tipo === 'fer');
      listaDia.replaceChildren(
        h('h2', { class: 'cl-dia-titulo' }, titulo, feriado ? h('small', {}, 'Feriado') : null),
        !hayTareas ? h('p', { class: 'nota' }, 'El calendario muestra lo que hay en Tareas, y el módulo Tareas no está disponible.')
          : del.length ? h('ul', { class: 'cl-items' }, del.map(x => h('li', {},
            h('button', {
              type: 'button', class: `cl-item t-${x.tipo}${x.hecha ? ' hecha' : ''}${x.repite ? ' suave' : ''}`, onclick: () => abrir(x),
            },
            h('span', { class: 'cl-barrita' }),
            h('span', { class: 'cl-hora' }, x.hora || ''),
            h('span', { class: 'cl-texto' }, h('b', {}, x.titulo),
              h('small', {}, [x.lugar, x.repite ? `se repite (${x.repeticion.toLowerCase()})` : x.repeticion, x.duracion ? durTexto(x.duracion) : '', x.aviso ? 'aviso' : ''].filter(Boolean).join(' · ')))))))
            : h('p', { class: 'nota cl-vacio' }, 'Nada para este día.'),
        hayTareas ? h('button', { type: 'button', class: 'cl-agregar', onclick: () => abrirTecladoYa() || ctx.pedir('nueva-tarea', { fecha: diaElegido }).catch(e => ctx.aviso(e.message)) },
          h('b', {}, '+'), ` Agregar tarea para el ${pad(f.getDate())}/${pad(f.getMonth() + 1)}`) : null);
    }
    const durTexto = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

    function abrir(x) {
      // Pagos: se abre su detalle en Finanzas. Lo demás: el detalle de la tarea.
      if (x.tipo === 'fin' && x.clave.startsWith('finanzas:fijo:')) return ctx.navegar('finanzas/detalle/fijos');
      if (x.tipo === 'fin' && x.clave.startsWith('finanzas:tarjeta:')) return ctx.navegar('finanzas/detalle/credito');
      ctx.pedir('abrir-tarea', { id: x.id }).catch(e => ctx.aviso(e.message));
    }

    alCerrarConfig = () => pintar();
    let espera = null;
    const refrescar = () => { clearTimeout(espera); espera = setTimeout(pintar, 120); };
    const quitar1 = ctx.alCambiarDatosDe?.('tareas', refrescar);
    const quitar2 = ctx.alCambiarDatos(refrescar);
    await pintar();
    return () => { quitar1?.(); quitar2?.(); clearTimeout(espera); };
  },
};
