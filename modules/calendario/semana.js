// ─────────────────────────────────────────────────────────────
// Calendario › Semana: el Planificador semanal.
//
// No guarda tareas propias: le pregunta a Tareas qué hay cada día y qué
// está sin fecha, y le pide los cambios (completar, cambiar de día).
// Lo único propio son los premios de cada día (colección "premios").
//
// PC: "Para planificar" + 7 columnas; las tareas se arrastran entre ellas.
// Celular: tira de días, el día elegido y "Para planificar" debajo;
// tocando una tarea aparecen los días para moverla.
// ─────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
const aISO = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const deISO = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const hoyISO = () => aISO(new Date());
const DN = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const esPC = () => matchMedia('(min-width: 900px)').matches;
const ES_TAREA = new Set(['tarea', 'venc', 'fin']);

const TRAZOS = {
  izq: '<path d="m15 6-6 6 6 6"/>', der: '<path d="m9 6 6 6-6 6"/>', mas: '<path d="M12 5v14M5 12h14"/>',
  premio: '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/>',
  repetir: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 16M4 20v-4h4"/>',
};
function ic(nombre, clase = 'icono') {
  const s = document.createElement('span');
  s.className = clase;
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre]}</svg>`;
  return s;
}
function anillo(p) {
  const r = 18, c = 2 * Math.PI * r;
  const s = document.createElement('span');
  s.className = 'pl-anillo-svg';
  s.innerHTML = `<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--linea)" stroke-width="4"/><circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--laton)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 22 22)"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="var(--tinta)" font-size="10.5" font-weight="600">${Math.round(p * 100)}%</text></svg>`;
  return s;
}
function abrirTecladoYa() {
  const i = document.createElement('input');
  i.setAttribute('aria-hidden', 'true');
  i.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.append(i);
  i.focus();
  setTimeout(() => i.remove(), 2500);
}

// Semana que se está viendo (se recuerda mientras la app está abierta).
let lunesVista = null;
let diaCel = null;   // índice 0-6 del día elegido en el celular

export async function pantallaSemana(contenedor, ctx, { leerConfig, cabecera }) {
  const { h } = ctx;
  let cfg = await leerConfig();
  const inicioSemana = (f) => { const d = new Date(f.getFullYear(), f.getMonth(), f.getDate()); d.setDate(d.getDate() - (cfg.semana === 'domingo' ? d.getDay() : (d.getDay() + 6) % 7)); return d; };
  if (!lunesVista) lunesVista = inicioSemana(new Date());
  const zona = h('div', { class: 'pl' });
  contenedor.replaceChildren(cabecera('semana'), zona);

  let abierta = null;      // tarea con los días a la vista (celular)
  let arrastrando = null;  // id de la tarea que se arrastra (PC)

  const premios = () => ctx.datos('premios');
  async function guardarPremio(fecha, actual) {
    const r = await ctx.formulario({
      titulo: actual ? 'Premio del día' : 'Agregar un premio',
      textoGuardar: 'Guardar',
      campos: [{ id: 'texto', etiqueta: '¿Qué te das si completás todo ese día?', tipo: 'texto', ayuda: actual ? 'Dejalo vacío para quitarlo.' : '' }],
    }, { texto: actual?.texto || '' });
    if (!r) return;
    const texto = String(r.texto || '').trim();
    if (actual && !texto) await premios().borrar(actual.id);
    else if (actual) await premios().actualizar(actual.id, { texto });
    else if (texto) await premios().crear({ fecha, texto });
  }

  async function mover(id, fecha) {
    try { await ctx.pedir('tarea-fecha', { id, fecha }); }
    catch (e) { ctx.aviso(e.message); }
  }
  async function completar(id) {
    try { await ctx.pedir('tarea-completar', { id }); }
    catch (e) { ctx.aviso(e.message); }
  }

  async function pintar() {
    cfg = await leerConfig();
    const dias = Array.from({ length: 7 }, (_, i) => new Date(lunesVista.getFullYear(), lunesVista.getMonth(), lunesVista.getDate() + i));
    const claves = dias.map(aISO), hoy = hoyISO();
    if (diaCel === null || diaCel > 6) { const i = claves.indexOf(hoy); diaCel = i >= 0 ? i : 0; }
    let items = [], sinFecha = [], hayTareas = true;
    try {
      [items, sinFecha] = await Promise.all([
        ctx.pedir('calendario-items', { desde: claves[0], hasta: claves[6], repetidas: cfg.repetidas }),
        ctx.pedir('tareas-sin-fecha', {}),
      ]);
    } catch { hayTareas = false; }
    const listaPremios = await premios().listar();
    // Foco de la semana (lo escribís en la revisión del módulo Resumen).
    let foco = '';
    try { if (await ctx.existeAccion('resumen-foco')) foco = await ctx.pedir('resumen-foco', { lunes: claves[0] }); } catch { /* nada */ }
    items = items || []; sinFecha = sinFecha || [];
    const delDia = (k) => items.filter(x => x.fecha === k);
    const tareasDe = (k) => delDia(k).filter(x => ES_TAREA.has(x.tipo));
    const cuenta = (k) => { const l = tareasDe(k).filter(x => !x.repite); return [l.filter(x => x.hecha).length, l.length]; };
    const total = claves.reduce((a, k) => { const [hh, n] = cuenta(k); return [a[0] + hh, a[1] + n]; }, [0, 0]);
    const esEstaSemana = claves.includes(hoy);

    // ── Cabecera de la semana ──
    const ini = dias[0], fin = dias[6];
    const titulo = ini.getMonth() === fin.getMonth() ? `${ini.getDate()} al ${fin.getDate()} de ${MS[fin.getMonth()]}` : `${ini.getDate()} ${MS[ini.getMonth()]} al ${fin.getDate()} ${MS[fin.getMonth()]}`;
    const irSemana = (n) => { lunesVista = new Date(lunesVista.getFullYear(), lunesVista.getMonth(), lunesVista.getDate() + 7 * n); diaCel = null; abierta = null; pintar(); };
    const semana = h('section', { class: 'pl-semana' },
      h('div', { class: 'pl-sem-top' },
        h('button', { type: 'button', class: 'pl-flecha', 'aria-label': 'Semana anterior', onclick: () => irSemana(-1) }, ic('izq')),
        h('div', { class: 'pl-sem-tit' }, h('b', {}, titulo),
          esEstaSemana ? h('small', {}, 'Esta semana')
            : h('button', { type: 'button', class: 'pl-volver', onclick: () => { lunesVista = inicioSemana(new Date()); diaCel = null; pintar(); } }, 'Volver a hoy')),
        h('button', { type: 'button', class: 'pl-flecha', 'aria-label': 'Semana siguiente', onclick: () => irSemana(1) }, ic('der')),
        h('div', { class: 'pl-anillo' }, anillo(total[1] ? total[0] / total[1] : 0),
          h('span', {}, h('b', {}, `${total[0]} de ${total[1]}`), h('small', {}, 'tareas hechas')))),
      foco ? h('div', { class: 'pl-foco' }, h('span', {}, 'Foco de la semana'), h('b', {}, foco)) : null,
      h('div', { class: 'pl-dias' }, dias.map((f, i) => {
        const [hh, n] = cuenta(claves[i]);
        return h('button', {
          type: 'button', class: `pl-dia${claves[i] === hoy ? ' hoy' : ''}${!esPC() && i === diaCel ? ' sel' : ''}`,
          onclick: () => { if (esPC()) irAColumna(i, true); else { diaCel = i; abierta = null; pintar(); } },
        },
        h('small', {}, DN[f.getDay()]),
        h('b', {}, String(f.getDate()), n && hh === n ? h('span', { class: 'pl-tilde' }, '✓') : null),
        h('span', { class: 'pl-pbar' }, h('i', { style: `width:${n ? (hh / n) * 100 : 0}%` })));
      })));

    // ── Una tarea ──
    function fila(x, { fechaActual = '' } = {}) {
      const movible = !x.repite && !x.clave;
      const chk = h('button', {
        type: 'button', class: `pl-chk${x.hecha ? ' on' : ''}${x.repite ? ' suave' : ''}`, disabled: !!x.repite,
        'aria-label': x.hecha ? `Reabrir "${x.titulo}"` : `Completar "${x.titulo}"`, title: x.repite ? 'Se repite: se completa en su fecha' : '',
        onclick: (e) => { e.stopPropagation(); completar(x.id); },
      });
      const fila1 = h('div', {
        class: `pl-tar${x.hecha ? ' hecha' : ''}${x.repite ? ' suave' : ''}${x.tipo === 'venc' ? ' venc' : ''}${movible ? ' movible' : ''}`,
        draggable: movible && esPC() ? 'true' : null, 'data-id': x.id,
      }, chk,
      h('button', {
        type: 'button', class: 'pl-tar-t',
        onclick: () => { if (esPC() || !movible) ctx.pedir('abrir-tarea', { id: x.id }).catch(e => ctx.aviso(e.message)); else { abierta = abierta === x.id ? null : x.id; pintar(); } },
      }, x.titulo, h('small', {}, x.repite ? [ic('repetir', 'icono pl-rep'), ' se repite'] : x.lugar || '')));
      if (movible && esPC()) {
        fila1.addEventListener('dragstart', (e) => { arrastrando = x.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', x.id); fila1.classList.add('arrastrando'); });
        fila1.addEventListener('dragend', () => { arrastrando = null; fila1.classList.remove('arrastrando'); });
      }
      if (abierta !== x.id || esPC()) return fila1;
      const chips = h('div', { class: 'pl-mover' },
        dias.map((f, i) => claves[i] === fechaActual ? null : h('button', { type: 'button', onclick: () => { abierta = null; mover(x.id, claves[i]); } }, `${DN[f.getDay()]} ${f.getDate()}`)),
        fechaActual ? h('button', { type: 'button', onclick: () => { abierta = null; mover(x.id, ''); } }, 'Sin fecha') : null,
        h('button', { type: 'button', class: 'pl-abrir', onclick: () => ctx.pedir('abrir-tarea', { id: x.id }).catch(e => ctx.aviso(e.message)) }, 'Abrir'));
      return h('div', {}, fila1, chips);
    }
    const soltable = (el, fecha) => {
      el.addEventListener('dragover', (e) => { if (!arrastrando) return; e.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop'); });
      el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('drop'); const id = arrastrando || e.dataTransfer.getData('text/plain'); arrastrando = null; if (id) mover(id, fecha); });
    };

    // ── Un día ──
    function columna(i) {
      const f = dias[i], k = claves[i];
      const [hh, n] = cuenta(k);
      const eventos = delDia(k).filter(x => !ES_TAREA.has(x.tipo) && x.tipo !== 'fer');
      const feriado = delDia(k).find(x => x.tipo === 'fer');
      const premio = listaPremios.find(p => p.fecha === k);
      const ganado = premio && n > 0 && hh === n;
      const col = h('section', { class: `pl-col${k === hoy ? ' hoy' : ''}`, id: `pl-col-${i}` },
        h('div', { class: 'pl-col-cab' },
          h('span', { class: 'pl-num' }, h('b', {}, String(f.getDate())), h('small', {}, MS[f.getMonth()].toUpperCase())),
          h('span', { class: 'pl-col-t' }, h('b', {}, DL[f.getDay()], k === hoy ? ' · hoy' : ''), h('small', {}, `${hh} de ${n} tareas`))),
        h('span', { class: 'pl-prog' }, h('i', { style: `width:${n ? (hh / n) * 100 : 0}%` })),
        feriado ? h('div', { class: 'pl-feriado' }, `Feriado: ${feriado.titulo}`) : null,
        eventos.map(x => h('button', { type: 'button', class: `pl-ev t-${x.tipo}`, onclick: () => ctx.pedir('abrir-tarea', { id: x.id }).catch(e => ctx.aviso(e.message)) }, x.hora ? h('span', {}, x.hora) : null, x.titulo)),
        tareasDe(k).map(x => fila(x, { fechaActual: k })),
        h('button', { type: 'button', class: 'pl-agregar', onclick: () => { abrirTecladoYa(); ctx.pedir('nueva-tarea', { fecha: k }).catch(e => ctx.aviso(e.message)); } }, ic('mas'), 'Agregar tarea'),
        h('button', { type: 'button', class: `pl-premio${premio ? ' puesto' : ''}${ganado ? ' ganado' : ''}`, onclick: () => guardarPremio(k, premio) },
          ic('premio'), premio ? (ganado ? `¡Premio ganado! ${premio.texto}` : `Premio: ${premio.texto}`) : 'Agregar un premio'));
      if (esPC()) soltable(col, k);
      return col;
    }
    function paraPlanificar() {
      const col = h('section', { class: 'pl-col pl-sinfecha' },
        h('div', { class: 'pl-col-cab' }, h('span', { class: 'pl-col-t' }, h('b', {}, 'Para planificar'),
          h('small', {}, esPC() ? 'Bandeja y tareas sin fecha · arrastralas a un día' : 'Bandeja y tareas sin fecha · tocá una para elegirle el día'))),
        sinFecha.length ? sinFecha.map(x => fila({ ...x, tipo: 'tarea', hecha: false })) : h('p', { class: 'nota pl-nada' }, 'Nada sin fecha. Todo planificado.'),
        h('button', { type: 'button', class: 'pl-agregar', onclick: () => { abrirTecladoYa(); ctx.pedir('nueva-tarea', {}).catch(e => ctx.aviso(e.message)); } }, ic('mas'), 'Agregar tarea'));
      if (esPC()) soltable(col, '');
      return col;
    }

    if (!hayTareas) {
      zona.replaceChildren(semana, h('p', { class: 'nota' }, 'El Planificador usa las tareas del módulo Tareas, y no está disponible.'));
      return;
    }
    const cuerpo = esPC()
      ? h('div', { class: 'pl-pc' }, paraPlanificar(), h('div', { class: 'pl-tablero' }, dias.map((_, i) => columna(i))))
      : h('div', { class: 'pl-cel' }, columna(diaCel), paraPlanificar());
    const scroll = zona.querySelector('.pl-tablero')?.scrollLeft || 0;
    zona.replaceChildren(semana, cuerpo);
    if (esPC()) {
      const t = zona.querySelector('.pl-tablero');
      if (scroll) t.scrollLeft = scroll;
      else if (esEstaSemana) { const i = claves.indexOf(hoy); if (i > 1) irAColumna(i - 1); }
    }
  }

  // Lleva una columna al principio del tablero ("Para planificar" queda aparte, fija a la izquierda).
  function irAColumna(i, suave = false) {
    const t = zona.querySelector('.pl-tablero'), col = document.getElementById(`pl-col-${i}`);
    if (!t || !col) return;
    const left = col.getBoundingClientRect().left - t.getBoundingClientRect().left + t.scrollLeft;
    t.scrollTo({ left, behavior: suave ? 'smooth' : 'auto' });
  }

  let espera = null;
  const refrescar = () => { clearTimeout(espera); espera = setTimeout(pintar, 120); };
  const quitar1 = ctx.alCambiarDatosDe?.('tareas', refrescar);
  const quitar2 = ctx.alCambiarDatos(refrescar);
  const mq = matchMedia('(min-width: 900px)');
  mq.addEventListener('change', refrescar);
  await pintar();
  return () => { quitar1?.(); quitar2?.(); mq.removeEventListener('change', refrescar); clearTimeout(espera); };
}
