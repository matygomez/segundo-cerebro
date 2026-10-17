// ─────────────────────────────────────────────────────────────
// Resumen: pantallas.
//   Semana: revisión guiada en 7 pasos.
//   Mes: cómo te fue en el mes.
//   Estadísticas: tendencias, récords y "qué va con qué".
// Rutas: #/resumen (semana) · /semana/<lunes> · /mes/<AAAA-MM> · /est
// ─────────────────────────────────────────────────────────────

import {
  crearModelo, numeros, pedirSeguro, hoyISO, sumarDias, lunesDe, deISO, sumarMeses, finDeMes,
  semanaARevisar, textoSemana, textoMes, MESES, MES_CORTO, DIAS, DIA_CORTO, plata,
} from './datos.js';

export function cargarEstilos() {
  if (document.getElementById('estilos-resumen')) return;
  const l = document.createElement('link');
  l.id = 'estilos-resumen'; l.rel = 'stylesheet';
  l.href = new URL('./resumen.css', import.meta.url).href;
  document.head.append(l);
}
const poner = (el, ...hijos) => el.replaceChildren(...hijos.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));
const esPC = () => matchMedia('(min-width: 900px)').matches;
const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

// Diferencia contra el período anterior. inverso: subir es malo (gastos).
function delta(h, a, b, { inverso = false, plataT = false, puntos = false } = {}) {
  if (a === null || a === undefined || b === null || b === undefined) return h('em', { class: 'rs-neutro' }, 'sin datos antes');
  const x = a - b;
  if (Math.abs(x) < (puntos ? 0.005 : 0.5)) return h('em', { class: 'rs-neutro' }, '= igual');
  const bien = inverso ? x < 0 : x > 0;
  const txt = puntos ? `${Math.round(Math.abs(x) * 100)} puntos` : plataT ? (b ? `${Math.round(Math.abs(x) / b * 100)}% ${x > 0 ? 'más' : 'menos'}` : plata(Math.abs(x))) : `${Math.round(Math.abs(x))} ${x > 0 ? 'más' : 'menos'}`;
  return h('em', { class: bien ? 'rs-up' : 'rs-down' }, `${x > 0 ? '▲' : '▼'} ${txt}`);
}
const kpi = (h, titulo, valor, extra) => h('div', { class: 'rs-kpi' }, h('small', {}, titulo), h('b', {}, valor), extra);
const destacado = (h, signo, contenido, nota, malo = false) => h('div', {}, h('span', { class: `rs-e${malo ? ' malo' : ''}` }, signo), h('span', {}, contenido, nota ? h('small', {}, nota) : null));
function barras(h, filas, { max, color = '', limite = false } = {}) {
  const mx = max || Math.max(1, ...filas.map(f => Math.max(f.valor, f.limite || 0)));
  return h('div', { class: 'rs-hb' }, filas.map(f => h('div', { class: 'rs-hb-f' },
    h('span', {}, f.nombre),
    h('span', { class: `rs-pista${limite && f.limite ? ' lim' : ''}`, style: limite && f.limite ? `--l:${Math.min(100, f.limite / mx * 100)}%` : '' },
      h('i', { class: `${color}${limite && f.limite && f.valor > f.limite ? ' pasado' : ''}`, style: `width:${Math.min(100, f.valor / mx * 100)}%` })),
    h('b', {}, f.texto))));
}
const reflexion = (h, etiqueta, valor, alGuardar, placeholder = '') => {
  const t = h('textarea', { rows: 2, placeholder }, valor || '');
  let espera = null;
  t.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => alGuardar(t.value), 600); });
  t.addEventListener('blur', () => { clearTimeout(espera); alGuardar(t.value); });
  return h('label', { class: 'rs-refl' }, h('span', {}, etiqueta), t);
};

// ── Gráficos (SVG simple) ──
function svg(ancho, alto, contenido) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  s.setAttribute('role', 'img');
  s.innerHTML = contenido;
  return s;
}
function grafBarras(h, series, etiquetas, { alto = 160 } = {}) {
  const W = esPC() ? 600 : 360, H = alto, p = 6, n = etiquetas.length, bw = (W - 2 * p) / n;
  const mx = Math.max(1, ...series.flatMap(s => s.v)) * 1.12;
  const fs = esPC() ? 13 : 12;
  let g = '';
  const k = series.length, ancho = bw * (k > 1 ? 0.36 : 0.6);
  etiquetas.forEach((e, i) => {
    series.forEach((s, j) => {
      const v = s.v[i] || 0, hh = (v / mx) * (H - 30);
      const x0 = p + i * bw + (bw - ancho * k - (k - 1) * 3) / 2 + j * (ancho + 3);
      g += `<rect x="${x0}" y="${H - 20 - hh}" width="${ancho}" height="${Math.max(0, hh)}" rx="3" fill="${s.c}"><title>${e}: ${s.fmt ? s.fmt(v) : v}</title></rect>`;
    });
    if (n <= 12 || i % 2 === 0) g += `<text x="${p + i * bw + bw / 2}" y="${H - 5}" fill="var(--tinta-2)" font-size="${fs}" text-anchor="middle">${e}</text>`;
  });
  return h('div', { class: 'rs-graf' }, svg(W, H, g));
}
function grafLinea(h, series, etiquetas, { alto = 160, max = null, porcentaje = false } = {}) {
  const W = esPC() ? 600 : 360, H = alto, p = 40, n = etiquetas.length;
  const vals = series.flatMap(s => s.v.filter(v => v !== null));
  const mx = max || Math.max(3, ...vals) * 1.15;
  const fs = esPC() ? 13 : 12;
  const x = (i) => p + (n === 1 ? 0 : i * (W - p - 10) / (n - 1)), y = (v) => H - 24 - (v / mx) * (H - 40);
  let g = '';
  for (let k = 0; k <= 3; k++) {
    const v = mx * k / 3;
    g += `<line x1="${p}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linea)"/><text x="${p - 6}" y="${y(v) + 4}" fill="var(--tinta-2)" font-size="${fs}" text-anchor="end">${porcentaje ? `${Math.round(v * 100)}%` : Math.round(v)}</text>`;
  }
  etiquetas.forEach((e, i) => { if (n <= 12 || i % 2 === 0) g += `<text x="${x(i)}" y="${H - 5}" fill="var(--tinta-2)" font-size="${fs}" text-anchor="middle">${e}</text>`; });
  for (const s of series) {
    const pts = s.v.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) continue;
    g += `<path d="${pts.map((q, i) => `${i ? 'L' : 'M'}${q[0]} ${q[1]}`).join('')}" fill="none" stroke="${s.c}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    const u = pts[pts.length - 1];
    g += `<circle cx="${u[0]}" cy="${u[1]}" r="4" fill="${s.c}"/>`;
  }
  return h('div', { class: 'rs-graf' }, svg(W, H, g));
}
const leyenda = (h, l) => h('div', { class: 'rs-ley' }, l.map(([c, t]) => h('span', {}, h('i', { style: `background:${c}` }), t)));

// ─────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────
export async function pantallaResumen(contenedor, ctx, sub = []) {
  cargarEstilos();
  const { h } = ctx;
  const m = crearModelo(ctx);
  const pestana = sub[0] === 'mes' ? 'mes' : sub[0] === 'est' ? 'est' : 'semana';
  const cuerpo = h('div', { class: 'rs-cuerpo' }, h('p', { class: 'nota' }, 'Juntando los números…'));
  const tab = (id, texto, ruta) => h('a', { href: `#/resumen${ruta}`, class: pestana === id ? 'sel' : '' }, texto);
  contenedor.replaceChildren(h('div', { class: 'rs' },
    h('header', { class: 'rs-cab' },
      h('div', {}, h('h1', {}, 'Resumen'), h('p', { class: 'nota' }, 'Cómo te fue, en qué estás y hacia dónde vas.')),
      h('nav', { class: 'rs-pest' }, tab('semana', 'Semana', ''), tab('mes', 'Mes', '/mes'), tab('est', 'Estadísticas', '/est'))),
    cuerpo));

  if (pestana === 'semana') return pantallaSemana(cuerpo, ctx, m, /^\d{4}-\d{2}-\d{2}$/.test(sub[1] || '') ? lunesDe(sub[1]) : semanaARevisar());
  if (pestana === 'mes') return pantallaMes(cuerpo, ctx, m, /^\d{4}-\d{2}$/.test(sub[1] || '') ? sub[1] : sumarMeses(hoyISO().slice(0, 7), deISO(hoyISO()).getDate() <= 3 ? -1 : 0));
  return pantallaEst(cuerpo, ctx);
}

// ── Semana: revisión guiada ──
const PASOS = ['Cómo te fue', 'Tareas vencidas', 'Hábitos', 'Plata', 'Metas', 'Próxima semana', 'Reflexión'];
let pasoActual = 0;

async function pantallaSemana(cuerpo, ctx, m, lunes) {
  const { h } = ctx;
  const domingo = sumarDias(lunes, 6);
  const esActual = lunes === lunesDe(hoyISO());
  const proxLunes = sumarDias(lunes, 7);
  let sel = null;   // tarea elegida para planificar
  const [[sem, ant], rev, rachas, metas] = await Promise.all([
    numeros(ctx, [{ desde: lunes, hasta: domingo }, { desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -1) }]),
    m.leer('semana', lunes),
    pedirSeguro(ctx, 'resumen-rachas', {}),
    pedirSeguro(ctx, 'resumen-metas', {}, []),
  ]);
  let vencidas = await pedirSeguro(ctx, 'resumen-vencidas', {}, []);
  let sinFecha = await pedirSeguro(ctx, 'tareas-sin-fecha', {}, []);
  let proxItems = await pedirSeguro(ctx, 'calendario-items', { desde: proxLunes, hasta: sumarDias(proxLunes, 6) }, []);
  const resp = { ...(rev || {}) };
  const guardar = (cambios) => { Object.assign(resp, cambios); return m.guardar('semana', lunes, cambios); };
  const hechoAhora = new Map();   // id → texto de lo que se hizo

  async function recargar() {
    [vencidas, sinFecha, proxItems] = await Promise.all([
      pedirSeguro(ctx, 'resumen-vencidas', {}, []), pedirSeguro(ctx, 'tareas-sin-fecha', {}, []),
      pedirSeguro(ctx, 'calendario-items', { desde: proxLunes, hasta: sumarDias(proxLunes, 6) }, []),
    ]);
    pintar();
  }

  function paso0() {
    const t = sem.tareas, ta = ant.tareas, hb = sem.habitos, f = sem.finanzas, b = sem.bitacora;
    const dest = [];
    if (t?.hechas) {
      const mejor = Object.entries(t.porFecha || {}).sort((a, b2) => b2[1] - a[1])[0];
      if (mejor) dest.push(destacado(h, '★', ['Tu mejor día fue el ', h('b', {}, DIAS[deISO(mejor[0]).getDay()]), `: ${mejor[1]} tarea${mejor[1] === 1 ? '' : 's'} hecha${mejor[1] === 1 ? '' : 's'}.`]));
    }
    if (rachas?.actual?.actual >= 3) dest.push(destacado(h, '🔥', [`"${rachas.actual.nombre}" va `, h('b', {}, `${rachas.actual.actual} ${rachas.actual.semanal ? 'semanas' : 'días'} seguidos`), rachas.actual.actual >= rachas.actual.mejor ? ', tu mejor racha.' : '.']));
    const flojo = (hb?.porHabito || []).filter(x => x.pct !== null && x.total >= 2).sort((a, b2) => a.pct - b2.pct)[0];
    if (vencidas.length || (flojo && flojo.pct < 0.6)) {
      dest.push(destacado(h, '!', [vencidas.length ? ['Quedan ', h('b', {}, `${vencidas.length} tarea${vencidas.length === 1 ? '' : 's'} vencida${vencidas.length === 1 ? '' : 's'}`)] : '', vencidas.length && flojo && flojo.pct < 0.6 ? ' y ' : vencidas.length ? '.' : '', flojo && flojo.pct < 0.6 ? `"${flojo.nombre}" quedó en ${flojo.hechos} de ${flojo.total}.` : ''], 'Lo vemos en los próximos pasos.', true));
    }
    return h('section', { class: 'tarjeta rs-card' },
      h('h3', {}, `La semana del ${textoSemana(lunes)}`),
      h('div', { class: 'rs-kpis cuatro' },
        kpi(h, 'Tareas hechas', String(t?.hechas ?? '—'), delta(h, t?.hechas, ta?.hechas)),
        kpi(h, 'Hábitos', pct(hb?.pct), delta(h, hb?.pct, ant.habitos?.pct, { puntos: true })),
        kpi(h, 'Gastado', f ? plata(f.gastado) : '—', delta(h, f?.gastado, ant.finanzas?.gastado, { inverso: true, plataT: true })),
        kpi(h, 'Notas nuevas', String(b?.notas ?? '—'), delta(h, b?.notas, ant.bitacora?.notas))),
      dest.length ? h('div', { class: 'rs-dest' }, dest) : null);
  }

  function paso1() {
    const lunesProx = esActual || lunes < lunesDe(hoyISO()) ? sumarDias(lunesDe(hoyISO()), 7) : proxLunes;
    const accion = async (x, que) => {
      try {
        if (que === 'hecha') await ctx.pedir('tarea-completar', { id: x.id });
        if (que === 'lunes') await ctx.pedir('tarea-fecha', { id: x.id, fecha: lunesProx });
        if (que === 'sin') await ctx.pedir('tarea-fecha', { id: x.id, fecha: '' });
        if (que === 'borrar') { if (!(await ctx.confirmar(`¿Borrar "${x.titulo}"? Va a la papelera de Tareas.`, { si: 'Borrar', peligro: true }))) return; await ctx.pedir('tarea-borrar', { id: x.id }); }
        hechoAhora.set(x.id, { hecha: 'Hecha', lunes: `Pasada al lunes ${deISO(lunesProx).getDate()}`, sin: 'Sin fecha', borrar: 'Borrada' }[que]);
        await recargar();
      } catch (e) { ctx.aviso(e.message); }
    };
    const resueltas = [...hechoAhora.entries()];
    return h('section', { class: 'tarjeta rs-card' },
      h('h3', {}, 'Tareas vencidas', h('small', {}, vencidas.length ? 'Decidí qué hacer con cada una' : '')),
      !vencidas.length && !resueltas.length ? h('p', { class: 'nota' }, 'No tenés tareas vencidas. 👌') : null,
      vencidas.map(x => h('div', { class: 'rs-fila' },
        h('span', { class: 'rs-t' }, x.titulo, h('small', {}, `${x.lugar} · `, h('span', { class: 'rs-vence' }, `venció el ${deISO(x.fecha).getDate()} de ${MES_CORTO[deISO(x.fecha).getMonth()]}`))),
        h('span', { class: 'rs-acc' },
          h('button', { type: 'button', class: 'rs-bt ch', onclick: () => accion(x, 'hecha') }, '✓ Hecha'),
          h('button', { type: 'button', class: 'rs-bt ch', onclick: () => accion(x, 'lunes') }, `Lunes ${deISO(lunesProx).getDate()}`),
          x.repite ? null : h('button', { type: 'button', class: 'rs-bt ch', onclick: () => accion(x, 'sin') }, 'Sin fecha'),
          h('button', { type: 'button', class: 'rs-bt ch', onclick: () => accion(x, 'borrar') }, 'Borrar')))),
      resueltas.length ? h('div', { class: 'rs-hechas' }, `Resueltas ahora: ${resueltas.length}`) : null,
      vencidas.length ? h('span', { class: 'nota' }, 'Lo que pases a "Sin fecha" lo vas a encontrar en el paso 6, para planificarlo.') : null);
  }

  function paso2() {
    const hb = sem.habitos;
    if (!hb) return h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Hábitos'), h('p', { class: 'nota' }, 'El módulo Hábitos no está disponible.'));
    const flojo = hb.porHabito.filter(x => x.pct !== null && x.total >= 2).sort((a, b) => a.pct - b.pct)[0];
    return h('section', { class: 'tarjeta rs-card' },
      h('h3', {}, 'Hábitos de la semana', h('small', {}, hb.pct === null ? '' : `${pct(hb.pct)} cumplido`)),
      hb.porHabito.length ? hb.porHabito.map(x => h('a', { class: 'rs-fila', href: `#/habitos/h/${x.id}` },
        h('span', { class: 'rs-t' }, x.nombre, h('small', {}, x.total ? `${x.hechos} de ${x.total}${x.semanal && x.hechos >= x.semanal ? ' · ✓ cumplido' : ''}` : 'no tocaba')),
        h('span', { class: 'rs-sem7' }, (x.dias || []).map(e => h('i', { class: { s: 'on', x: 'x', d: 'd', p: 'p' }[e] || '' }))))) : h('p', { class: 'nota' }, 'Todavía no tenés hábitos.'),
      flojo && flojo.pct < 0.6 ? h('div', { class: 'rs-dest' }, destacado(h, '?', `"${flojo.nombre}" fue el que más costó.`, '¿Le cambiarías los días o el momento? Lo podés editar tocándolo.', true)) : null);
  }

  function paso3() {
    const f = sem.finanzas;
    if (!f) return h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Plata'), h('p', { class: 'nota' }, 'El módulo Finanzas no está disponible.'));
    const pasadas = f.categorias.filter(c => c.presupuesto && c.monto > c.presupuesto);
    return h('section', { class: 'tarjeta rs-card' },
      h('h3', {}, 'Plata de la semana', h('small', {}, `Gastado ${plata(f.gastado)}`)),
      f.categorias.length ? barras(h, f.categorias.slice(0, 8).map(c => ({ nombre: c.nombre, valor: c.monto, limite: c.presupuesto, texto: plata(c.monto) })), { limite: true }) : h('p', { class: 'nota' }, 'No hubo gastos esta semana.'),
      f.categorias.some(c => c.presupuesto) ? h('span', { class: 'nota' }, `La rayita es lo que te corresponde por semana según el presupuesto.${pasadas.length ? ` ${pasadas.map(c => c.nombre).join(' y ')} se pas${pasadas.length === 1 ? 'ó' : 'aron'}.` : ''}`) : null,
      f.ingresado ? h('div', { class: 'rs-dest' }, destacado(h, '$', ['Ingresaste ', h('b', {}, plata(f.ingresado)), ' esta semana.'])) : null);
  }

  function paso4() {
    return h('section', { class: 'tarjeta rs-card' },
      h('h3', {}, 'Metas', h('a', { href: '#/habitos/metas', class: 'rs-link' }, 'Ver metas ›')),
      metas?.length ? metas.map(x => h('div', { class: 'rs-fila col' },
        h('span', { class: 'rs-t' }, x.nombre, h('small', {}, [x.texto, x.ritmo].filter(Boolean).join(' · '))),
        h('span', { class: 'rs-barra' }, h('i', { style: `width:${x.pct * 100}%` })))) : h('p', { class: 'nota' }, 'No tenés metas activas.'));
  }

  function paso5() {
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(proxLunes, i));
    const cuenta = (f) => (proxItems || []).filter(x => x.fecha === f && ['tarea', 'venc'].includes(x.tipo) && !x.hecha).length;
    const elegir = async (f) => {
      if (!sel) { ctx.aviso('Primero tocá una tarea de la lista.'); return; }
      try { await ctx.pedir('tarea-fecha', { id: sel, fecha: f }); sel = null; await recargar(); } catch (e) { ctx.aviso(e.message); }
    };
    return h('section', { class: 'tarjeta rs-card' },
      h('h3', {}, `Armá la semana del ${textoSemana(proxLunes, { corto: true })}`, h('small', {}, 'Tocá una tarea y después un día')),
      h('div', { class: 'rs-dias' }, dias.map(f => h('button', { type: 'button', class: `rs-dp${sel ? ' activo' : ''}`, onclick: () => elegir(f) },
        DIA_CORTO[deISO(f).getDay()], h('b', {}, String(deISO(f).getDate())), h('span', { title: 'tareas ese día' }, cuenta(f) ? `${cuenta(f)} ✓` : '—')))),
      h('span', { class: 'nota' }, 'Debajo de cada día, cuántas tareas tiene ya.'),
      h('span', { class: 'rs-sub' }, 'Para planificar'),
      sinFecha?.length ? sinFecha.slice(0, 30).map(x => h('button', { type: 'button', class: `rs-fila rs-elegible${sel === x.id ? ' sel' : ''}`, onclick: () => { sel = sel === x.id ? null : x.id; pintar(); } },
        h('span', { class: 'rs-t' }, x.titulo, h('small', {}, x.lugar)))) : h('p', { class: 'nota' }, 'No hay tareas sin fecha.'),
      h('a', { href: '#/calendario/semana', class: 'rs-link izq' }, 'Abrir el Planificador semanal ›'));
  }

  function paso6() {
    return h('section', { class: 'tarjeta rs-card' },
      h('h3', {}, 'Reflexión', h('small', {}, 'Opcional · queda guardada')),
      reflexion(h, '¿Qué salió bien?', resp.bien, v => guardar({ bien: v }), 'Ej: terminé el procedimiento de recepción'),
      reflexion(h, '¿Qué te trabó?', resp.trabo, v => guardar({ trabo: v }), 'Ej: la mudanza me comió las tardes'),
      reflexion(h, 'Tu foco para la semana que viene', resp.foco, v => guardar({ foco: v }), 'Una sola cosa'),
      h('span', { class: 'nota' }, 'El foco aparece arriba del Planificador semanal toda la semana.'));
  }
  const PANTALLAS = [paso0, paso1, paso2, paso3, paso4, paso5, paso6];

  let pintar = function () {
    const anterior = sumarDias(lunes, -7), siguiente = sumarDias(lunes, 7);
    const hayAdelante = siguiente <= semanaARevisar();
    poner(cuerpo,
      h('div', { class: 'rs-nav' },
        h('a', { class: 'rs-flecha', href: `#/resumen/semana/${anterior}`, 'aria-label': 'Semana anterior' }, '‹'),
        h('b', {}, textoSemana(lunes)),
        hayAdelante ? h('a', { class: 'rs-flecha', href: `#/resumen/semana/${siguiente}`, 'aria-label': 'Semana siguiente' }, '›') : h('span', { class: 'rs-flecha off' }, '›'),
        esActual ? h('span', { class: 'nota' }, '· en curso') : null),
      h('div', { class: 'rs-banda' }, h('span', { class: 'rs-banda-i' }, '🗓️'),
        h('span', {}, h('b', {}, resp.hecha ? 'Revisión hecha ✓' : 'Revisión de la semana'), h('small', {}, `Paso ${pasoActual + 1} de ${PASOS.length} · unos 5 minutos`))),
      h('div', { class: 'rs-rev' },
        h('div', { class: 'rs-pasos' }, PASOS.map((p, i) => h('button', { type: 'button', class: `rs-paso${i < pasoActual || resp.hecha ? ' ok' : ''}${i === pasoActual ? ' sel' : ''}`, onclick: () => { pasoActual = i; pintar(); } },
          h('span', { class: 'n' }, i < pasoActual || (resp.hecha && i !== pasoActual) ? '✓' : String(i + 1)), h('span', { class: 'tx' }, p)))),
        h('div', { class: 'rs-paso-cuerpo' }, PANTALLAS[pasoActual](),
          h('div', { class: 'rs-pie' },
            h('button', { type: 'button', class: 'rs-bt', style: pasoActual ? '' : 'visibility:hidden', onclick: () => { pasoActual--; pintar(); scrollTo({ top: 0 }); } }, '‹ Anterior'),
            h('button', {
              type: 'button', class: 'rs-bt p', onclick: async () => {
                if (pasoActual < PASOS.length - 1) { pasoActual++; pintar(); scrollTo({ top: 0 }); return; }
                await guardar({ hecha: true, vista: true });
                ctx.aviso('Revisión guardada. ¡Buena semana!');
                pasoActual = 0; pintar(); scrollTo({ top: 0 });
              },
            }, pasoActual === PASOS.length - 1 ? (resp.hecha ? 'Guardar' : 'Terminar revisión') : 'Siguiente ›')))));
  }
  // En el celular, que el paso elegido quede a la vista en la fila de pasos.
  const verPaso = () => requestAnimationFrame(() => { const c = cuerpo.querySelector('.rs-pasos'), el = c?.querySelector('.rs-paso.sel'); if (c && el && c.scrollWidth > c.clientWidth) c.scrollLeft = el.offsetLeft - c.offsetLeft - (c.clientWidth - el.offsetWidth) / 2; });
  const pintarBase = pintar;
  pintar = () => { pintarBase(); verPaso(); };
  // Abrir la revisión cuenta como "vista": el aviso del Inicio se va.
  if (!resp.vista && lunes === semanaARevisar()) guardar({ vista: true });
  pintar();
  let espera = null;
  const enEdicion = () => cuerpo.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA';
  const quitar = ['tareas', 'habitos', 'finanzas'].map(x => ctx.alCambiarDatosDe(x, () => { clearTimeout(espera); espera = setTimeout(() => { if (!enEdicion()) recargar(); }, 300); }));
  return () => { quitar.forEach(q => q?.()); clearTimeout(espera); };
}

// ── Mes ──
async function pantallaMes(cuerpo, ctx, m, mes) {
  const { h } = ctx;
  const desde = `${mes}-01`, hasta = finDeMes(mes), mesAnt = sumarMeses(mes, -1);
  const [[a, b], rev, rachas] = await Promise.all([
    numeros(ctx, [{ desde, hasta }, { desde: `${mesAnt}-01`, hasta: finDeMes(mesAnt) }]),
    m.leer('mes', mes),
    pedirSeguro(ctx, 'resumen-rachas', {}),
  ]);
  // Semanas del mes, para "tu mejor semana".
  const semanas = [];
  for (let l = lunesDe(desde); l <= hasta; l = sumarDias(l, 7)) semanas.push({ desde: l, hasta: sumarDias(l, 6) });
  const porSemana = await pedirSeguro(ctx, 'resumen-tareas', { periodos: semanas }, []);
  const resp = { ...(rev || {}) };
  const guardar = (c) => { Object.assign(resp, c); return m.guardar('mes', mes, c); };
  if (!resp.vista && mes === sumarMeses(hoyISO().slice(0, 7), -1)) guardar({ vista: true });

  const enCurso = mes === hoyISO().slice(0, 7);
  const faltan = enCurso ? deISO(hasta).getDate() - deISO(hoyISO()).getDate() : 0;
  const ahorro = (x) => (x?.finanzas?.ingresado ? (x.finanzas.ingresado - x.finanzas.gastado) / x.finanzas.ingresado : null);
  const t = a.tareas, f = a.finanzas, hb = a.habitos, bi = a.bitacora;

  const mejores = [];
  if (rachas?.mejor?.mejor >= 5) mejores.push(destacado(h, '🔥', `Mejor racha de siempre: "${rachas.mejor.nombre}", ${rachas.mejor.mejor} ${rachas.mejor.semanal ? 'semanas' : 'días'}.`));
  const ms = (porSemana || []).map((x, i) => ({ ...x, i })).sort((x, y) => y.hechas - x.hechas)[0];
  if (ms?.hechas) mejores.push(destacado(h, '✓', ['Tu mejor semana: ', h('b', {}, `${ms.hechas} tareas`), ` (del ${textoSemana(semanas[ms.i].desde, { corto: true })}).`]));
  if (f && b.finanzas?.gastado) { const x = (f.gastado - b.finanzas.gastado) / b.finanzas.gastado; if (Math.abs(x) >= 0.03) mejores.push(destacado(h, '$', `Gastaste ${Math.round(Math.abs(x) * 100)}% ${x < 0 ? 'menos' : 'más'} que en ${MESES[deISO(`${mesAnt}-01`).getMonth()]}${enCurso ? ' (y el mes sigue)' : ''}.`, null, x > 0)); }
  if (bi?.mejor) mejores.push(destacado(h, '🎬', ['Mejor calificada: ', h('b', {}, bi.mejor.titulo), ` · ${bi.mejor.calificacion}/10`]));
  const topH = (hb?.porHabito || []).filter(x => x.pct !== null).sort((x, y) => y.pct - x.pct)[0];
  if (topH && topH.pct >= 0.8) mejores.push(destacado(h, '★', `"${topH.nombre}" se cumplió el ${pct(topH.pct)} de las veces.`));

  const ant = sumarMeses(mes, -1), sig = sumarMeses(mes, 1);
  poner(cuerpo,
    h('div', { class: 'rs-nav' },
      h('a', { class: 'rs-flecha', href: `#/resumen/mes/${ant}`, 'aria-label': 'Mes anterior' }, '‹'),
      h('b', {}, textoMes(mes)),
      !enCurso ? h('a', { class: 'rs-flecha', href: `#/resumen/mes/${sig}`, 'aria-label': 'Mes siguiente' }, '›') : h('span', { class: 'rs-flecha off' }, '›'),
      enCurso ? h('span', { class: 'nota' }, `· en curso, falta${faltan === 1 ? '' : 'n'} ${faltan} día${faltan === 1 ? '' : 's'}`) : null),
    h('div', { class: 'rs-kpis seis' },
      kpi(h, 'Tareas hechas', String(t?.hechas ?? '—'), delta(h, t?.hechas, b.tareas?.hechas)),
      kpi(h, 'Hábitos cumplidos', pct(hb?.pct), delta(h, hb?.pct, b.habitos?.pct, { puntos: true })),
      kpi(h, 'Gastado', f ? plata(f.gastado) : '—', delta(h, f?.gastado, b.finanzas?.gastado, { inverso: true, plataT: true })),
      kpi(h, 'Ahorrado', ahorro(a) === null ? '—' : pct(ahorro(a)), h('em', { class: 'rs-neutro' }, 'del ingreso')),
      kpi(h, 'Películas y series', String(bi?.peliculas ?? '—'), delta(h, bi?.peliculas, b.bitacora?.peliculas)),
      kpi(h, 'Notas nuevas', String(bi?.notas ?? '—'), delta(h, bi?.notas, b.bitacora?.notas))),
    h('div', { class: 'rs-grid3' },
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Lo mejor del mes'), mejores.length ? h('div', { class: 'rs-dest' }, mejores) : h('p', { class: 'nota' }, 'Todavía no hay mucho para destacar.')),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Gastos por categoría', h('small', {}, 'vs presupuesto')),
        f?.categorias?.length ? barras(h, f.categorias.slice(0, 8).map(c => ({ nombre: c.nombre, valor: c.monto, limite: c.presupuesto, texto: plata(c.monto) })), { limite: true }) : h('p', { class: 'nota' }, 'Sin gastos.')),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Hábitos del mes'),
        hb?.porHabito?.some(x => x.pct !== null) ? barras(h, hb.porHabito.filter(x => x.pct !== null).sort((x, y) => y.pct - x.pct).map(x => ({ nombre: x.nombre, valor: x.pct, texto: pct(x.pct) })), { max: 1 }) : h('p', { class: 'nota' }, 'Sin datos de hábitos.'))),
    h('div', { class: 'rs-grid2' },
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Dónde pusiste el tiempo', h('small', {}, 'tareas hechas')),
        t?.porArea?.length ? barras(h, t.porArea.slice(0, 7).map(([n, v]) => ({ nombre: n, valor: v, texto: String(v) })), { color: 'azul' }) : h('p', { class: 'nota' }, 'Sin tareas hechas.')),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Cierre del mes', h('small', {}, 'Opcional')),
        reflexion(h, `¿Qué te llevás de ${MESES[deISO(desde).getMonth()]}?`, resp.llevo, v => guardar({ llevo: v })),
        reflexion(h, '¿Qué cambiás para el mes que viene?', resp.cambio, v => guardar({ cambio: v })))));
}

// ── Estadísticas ──
let rango = 6;
async function pantallaEst(cuerpo, ctx) {
  const { h } = ctx;
  async function pintar() {
    poner(cuerpo, h('p', { class: 'nota' }, 'Calculando…'));
    const hoy = hoyISO(), mesHoy = hoy.slice(0, 7);
    const meses = Array.from({ length: rango }, (_, i) => sumarMeses(mesHoy, i - rango + 1));
    const pm = meses.map(x => ({ desde: `${x}-01`, hasta: finDeMes(x) }));
    const semanas = [];
    for (let l = lunesDe(pm[0].desde); l <= hoy; l = sumarDias(l, 7)) semanas.push({ desde: l, hasta: sumarDias(l, 6) });
    const [porMes, tSem, hSem, rachas] = await Promise.all([
      numeros(ctx, pm),
      pedirSeguro(ctx, 'resumen-tareas', { periodos: semanas }, []),
      pedirSeguro(ctx, 'resumen-habitos', { periodos: semanas }, []),
      pedirSeguro(ctx, 'resumen-rachas', {}),
    ]);
    const et = meses.map(x => MES_CORTO[Number(x.slice(5)) - 1]);

    // Récords
    const rec = [];
    if (rachas?.mejor?.mejor) rec.push([`${rachas.mejor.mejor} ${rachas.mejor.semanal ? 'semanas' : 'días'}`, `Mejor racha · ${rachas.mejor.nombre}`]);
    const ms = (tSem || []).map((x, i) => ({ n: x.hechas, i })).sort((a, b) => b.n - a.n)[0];
    if (ms?.n) rec.push([`${ms.n} tareas`, `Semana más productiva · ${textoSemana(semanas[ms.i].desde, { corto: true })}`]);
    const porDia = [0, 0, 0, 0, 0, 0, 0];
    for (const x of tSem || []) x.porDia.forEach((v, i) => { porDia[i] += v; });
    const md = porDia.indexOf(Math.max(...porDia));
    if (porDia[md]) rec.push([`${DIAS[md][0].toUpperCase()}${DIAS[md].slice(1)}`, `Tu día más productivo (promedio ${(porDia[md] / Math.max(1, semanas.length)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} tareas)`]);
    const ah = porMes.map((x, i) => ({ v: x.finanzas?.ingresado ? (x.finanzas.ingresado - x.finanzas.gastado) / x.finanzas.ingresado : null, i })).filter(x => x.v !== null).sort((a, b) => b.v - a.v)[0];
    if (ah && ah.v > 0) rec.push([pct(ah.v), `Mejor mes de ahorro · ${MESES[Number(meses[ah.i].slice(5)) - 1]}`]);

    // Qué va con qué: semanas en que cumpliste un hábito vs. tareas hechas.
    const cruces = [];
    const nombres = new Map();
    for (const s of hSem || []) for (const x of s.porHabito) nombres.set(x.id, x.nombre);
    for (const [id, nombre] of nombres) {
      const si = [], no = [];
      (hSem || []).forEach((s, i) => {
        const x = s.porHabito.find(y => y.id === id);
        if (!x || x.pct === null || x.total < 2 || !tSem?.[i] || semanas[i].hasta > hoy) return;
        (x.pct >= 0.7 ? si : no).push(tSem[i].hechas);
      });
      if (si.length >= 3 && no.length >= 3) {
        const a = si.reduce((p, c) => p + c, 0) / si.length, b = no.reduce((p, c) => p + c, 0) / no.length;
        if (b > 0 && Math.abs(a - b) / b >= 0.15) cruces.push({ nombre, dif: (a - b) / b });
      }
    }
    cruces.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));

    const tareas = porMes.map(x => x.tareas?.hechas || 0);
    const hab = porMes.map(x => (x.habitos?.pct === null || x.habitos?.pct === undefined ? null : x.habitos.pct));
    const gas = porMes.map(x => x.finanzas?.gastado || 0), ing = porMes.map(x => x.finanzas?.ingresado || 0);
    const notas = porMes.map(x => x.bitacora?.notas || 0), pelis = porMes.map(x => x.bitacora?.peliculas || 0);
    const miles = (v) => plata(v);

    poner(cuerpo,
      h('div', { class: 'rs-nav' }, h('span', { class: 'nota' }, 'Período'),
        h('div', { class: 'rs-pest chica' }, [3, 6, 12].map(r => h('button', { type: 'button', class: rango === r ? 'sel' : '', onclick: () => { rango = r; pintar(); } }, r === 12 ? '1 año' : `${r} meses`)))),
      rec.length ? h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Récords'), h('div', { class: 'rs-rec' }, rec.map(([b, s]) => h('div', {}, h('b', {}, b), h('small', {}, s))))) : null,
      h('div', { class: 'rs-grid2' },
        h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Tareas hechas por mes'), grafBarras(h, [{ v: tareas, c: 'var(--laton)' }], et)),
        h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Hábitos cumplidos', h('small', {}, '% por mes')), grafLinea(h, [{ v: hab, c: 'var(--laton)' }], et, { max: 1, porcentaje: true })),
        h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Ingresos y gastos'), grafBarras(h, [{ v: gas, c: 'var(--rojo)', fmt: miles }, { v: ing, c: 'var(--verde)', fmt: miles }], et), leyenda(h, [['var(--rojo)', 'Gastos'], ['var(--verde)', 'Ingresos']])),
        h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Bitácora y Filmoteca'), grafLinea(h, [{ v: notas, c: '#8DB4DC' }, { v: pelis, c: '#B9A2E0' }], et), leyenda(h, [['#8DB4DC', 'Notas nuevas'], ['#B9A2E0', 'Películas y series']]))),
      h('section', { class: 'tarjeta rs-card' }, h('h3', {}, 'Qué va con qué', h('small', {}, 'cruces entre tus hábitos y tus tareas')),
        cruces.length ? h('div', { class: 'rs-dest' }, cruces.slice(0, 4).map(c => destacado(h, c.dif > 0 ? '↗' : '↘',
          ['Las semanas que cumplís "', h('b', {}, c.nombre), '" terminás ', h('b', {}, `${Math.round(Math.abs(c.dif) * 100)}% ${c.dif > 0 ? 'más' : 'menos'} tareas`), '.'], null, c.dif < 0)))
          : h('p', { class: 'nota' }, 'Todavía no hay datos suficientes. Aparecen cuando hay varias semanas con y sin cada hábito.'),
        h('span', { class: 'nota' }, 'Son cruces simples de tus propios datos, no consejos.')));
  }
  await pintar();
}

// ── Aviso para el Inicio ──
export async function dibujarAviso(ctx, contenedor) {
  cargarEstilos();
  const { h } = ctx;
  const m = crearModelo(ctx);
  const pend = await m.pendientes();
  if (!pend.length) { contenedor.replaceChildren(); return; }
  const cajas = await Promise.all(pend.map(async ({ tipo, clave }) => {
    const sem = tipo === 'semana';
    const desde = sem ? clave : `${clave}-01`, hasta = sem ? sumarDias(clave, 6) : finDeMes(clave);
    const [n] = await numeros(ctx, [{ desde, hasta }]);
    const vencidas = sem ? ((await pedirSeguro(ctx, 'resumen-vencidas', {}, [])) || []).length : 0;
    const cerrar = async () => { await m.guardar(tipo, clave, { vista: true }); caja.remove(); if (!contenedor.childElementCount) contenedor.closest('.ini-pieza')?.setAttribute('hidden', ''); };
    const mini = (v, t) => h('span', {}, h('b', {}, v), t);
    const mesTxt = MESES[Number(clave.slice(5, 7)) - 1];
    const caja = h('section', { class: 'rs-aviso' },
      h('button', { type: 'button', class: 'rs-aviso-x', 'aria-label': 'Cerrar hasta la próxima', onclick: cerrar }, '✕'),
      h('span', { class: 'rs-aviso-et' }, sem ? 'Terminó la semana' : 'Terminó el mes'),
      h('b', { class: 'rs-aviso-t' }, sem ? `Revisión del ${textoSemana(clave, { corto: true })}` : `Resumen de ${mesTxt}`),
      h('span', { class: 'rs-aviso-mini' },
        n.tareas ? mini(String(n.tareas.hechas), 'tareas') : null,
        n.habitos?.pct !== null && n.habitos ? mini(pct(n.habitos.pct), 'hábitos') : null,
        n.finanzas ? mini(plata(n.finanzas.gastado), 'gastado') : null,
        sem && vencidas ? mini(String(vencidas), vencidas === 1 ? 'vencida' : 'vencidas') : null,
        !sem && n.bitacora ? mini(String(n.bitacora.peliculas), 'películas') : null),
      h('span', { class: 'rs-aviso-bot' },
        h('button', { type: 'button', class: 'rs-bt p', onclick: () => { m.guardar(tipo, clave, { vista: true }); ctx.navegar(sem ? `resumen/semana/${clave}` : `resumen/mes/${clave}`); } }, sem ? 'Hacer la revisión · 5 min' : 'Ver el resumen'),
        h('button', { type: 'button', class: 'rs-bt', onclick: cerrar }, 'Ahora no')));
    return caja;
  }));
  contenedor.replaceChildren(...cajas);
}
