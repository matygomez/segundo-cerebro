// ─────────────────────────────────────────────────────────────
// Paneles del Inicio en la PC: "Mi día" (hora por hora, de 0 a 24, con la
// línea de ahora que baja sola) y "Esta semana" (tocar un día lo muestra en
// Mi día). Lo de cada día se lo pide a Tareas (calendario-items); la
// temperatura de cada hora, al Resumen (resumen-clima), si está.
// ─────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
const aISO = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
const deISO = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const hoyISO = () => aISO(new Date());
const aMin = (hora) => { const [hh, mm] = String(hora).split(':').map(Number); return (hh || 0) * 60 + (mm || 0); };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const diaCorto = (iso) => { const f = deISO(iso); return `${CORTO[f.getDay()]} ${f.getDate()}`; };
const durTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);
const CLASE = { tarea: '', venc: 'r', fin: 'v', reu: 'z', ev: 'z', fer: 'a' };

// estado: el día elegido, compartido por los dos paneles.
export function panelesCalendario(ctx, { leerConfig, cargarEstilos }) {
  const { h, icono } = ctx;
  const estado = { dia: hoyISO(), oyentes: new Set() };
  const elegir = (f) => { estado.dia = f; estado.oyentes.forEach(fn => fn()); };
  const abrir = (x) => ctx.pedir('abrir-tarea', { id: x.id }).catch(e => ctx.aviso(e.message));
  const items = async (desde, hasta) => {
    const cfg = await leerConfig(ctx);
    try { return (await ctx.pedir('calendario-items', { desde, hasta, repetidas: cfg.repetidas })) || []; } catch { return null; }
  };
  // Escucha cambios en Tareas (y en el propio calendario) para redibujar.
  const escuchar = (pintar) => {
    let espera = null;
    const otra = () => { clearTimeout(espera); espera = setTimeout(pintar, 120); };
    const q = [ctx.alCambiarDatosDe?.('tareas', otra), ctx.alCambiarDatos(otra)];
    estado.oyentes.add(pintar);
    return () => { clearTimeout(espera); q.forEach(x => x?.()); estado.oyentes.delete(pintar); };
  };

  return [
    {
      lugar: 'dia', titulo: 'Mi día',
      async dibujar(cont, { cambiar, cel = false } = {}) {
        cargarEstilos();
        // Celular (0.44): en vez del horario dibujado va una lista con hora y título (sin desplazamiento propio,
        // que trababa el deslizar de la pantalla) y una línea roja donde está "ahora".
        let temps = null;
        try { if (await ctx.existeAccion('resumen-clima')) temps = (await ctx.pedir('resumen-clima', {}))?.horas24 || null; } catch { temps = null; }
        async function pintar() {
          const dia = estado.dia, hoy = hoyISO(), esHoy = dia === hoy;
          const f = deISO(dia);
          cambiar?.({
            titulo: esHoy ? 'Mi día' : `${DIAS[f.getDay()].replace(/^./, c => c.toUpperCase())} ${f.getDate()}`,
            enlace: esHoy ? null : { texto: 'Hoy', alTocar: () => elegir(hoy) },
          });
          const l = await items(dia, dia);
          if (l === null) { cont.replaceChildren(h('p', { class: 'ip-nota' }, 'Mi día muestra lo de Tareas, y Tareas no está disponible.')); return; }
          const atrasadas = esHoy ? ((await ctx.pedir('resumen-vencidas', {}).catch(() => [])) || []) : [];
          const conHora = l.filter(x => x.hora && x.tipo !== 'fer' && x.tipo !== 'fin').sort((a, b) => a.hora.localeCompare(b.hora));
          const sinHora = l.filter(x => !conHora.includes(x));
          const ahora = new Date(), mins = ahora.getHours() * 60 + ahora.getMinutes();

          // ── Hora por hora ──
          const linea = h('div', { class: 'clp-d24' });
          for (let x = 0; x < 24; x += 2) {
            linea.append(h('div', { class: `clp-hr${esHoy && (x + 1) * 60 < mins ? ' pasada' : ''}`, style: `top:${(x / 24) * 100}%` },
              pad(x), esHoy && temps?.[x] !== undefined ? h('em', {}, `${temps[x]}°`) : null));
          }
          // Lo que se superpone va en dos carriles (mitad y mitad) para que no se tape.
          const bloques = conHora.map(x => { const ini = aMin(x.hora), dur = Math.max(Number(x.duracion) || 30, 15); return { x, ini, dur, fin: ini + Math.max(dur, 50) }; });
          const finCarril = [-1, -1];
          for (const b of bloques) { b.carril = b.ini >= finCarril[0] ? 0 : 1; finCarril[b.carril] = Math.max(finCarril[b.carril], b.fin); }
          for (const b of bloques) {
            const junto = bloques.some(o => o !== b && o.ini < b.fin && b.ini < o.fin);
            const { x } = b;
            const pasada = x.hecha || (esHoy && b.ini + b.dur < mins);
            linea.append(h('button', {
              type: 'button', class: `clp-blq ${CLASE[x.tipo] || ''}${pasada ? ' pasada' : ''}${junto ? (b.carril ? ' c2' : ' c1') : ''}`,
              style: `top:${(b.ini / 1440) * 100}%;height:${((b.fin - b.ini) / 1440) * 100}%`, title: `${x.hora} ${x.titulo}${x.lugar ? ` · ${x.lugar}` : ''}`,
              onclick: () => abrir(x),
            }, `${x.hora} ${x.titulo}`, x.lugar ? h('small', {}, x.lugar.split(' › ')[0]) : null));
          }
          if (esHoy) linea.append(h('div', { class: 'clp-ahora', style: `top:${(mins / 1440) * 100}%` }, h('span', {}, `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`)));

          // ── Detalle: sin hora, vencimientos, feriados y atrasadas ──
          const fila = (x, tag, cls) => h('button', { type: 'button', class: `ip-fila${x.hecha ? ' clp-hecha' : ''}`, onclick: () => abrir(x) },
            icono(x.tipo === 'fin' ? 'finanzas' : x.tipo === 'fer' ? 'calendario' : 'tareas'),
            h('span', { class: 'ip-tx' }, x.titulo || 'Sin título', h('small', {}, x.lugar || '')),
            tag ? h('span', { class: `ip-tag ${cls || ''}` }, tag) : null);
          const detalle = [
            ...sinHora.map(x => fila(x, x.tipo === 'fin' ? (x.hecha ? 'pagado' : esHoy ? 'vence hoy' : 'vence') : x.tipo === 'fer' ? 'feriado' : x.hecha ? 'hecha' : '', x.tipo === 'fin' ? 'v' : 'a')),
            ...atrasadas.map(x => fila({ ...x, tipo: 'tarea' }, x.fecha === aISO(new Date(Date.now() - 864e5)) ? 'ayer' : diaCorto(x.fecha), 'r')),
          ];
          let agenda = null;
          if (cel) {
            const filas = [];
            let ahoraPuesta = !esHoy;
            const lineaAhora = () => h('div', { class: 'clp-ahora-l' }, h('span', {}, `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`));
            for (const b of bloques) {
              if (!ahoraPuesta && b.ini > mins) { filas.push(lineaAhora()); ahoraPuesta = true; }
              const { x } = b;
              const pasada = x.hecha || (esHoy && b.ini + b.dur < mins);
              filas.push(h('button', { type: 'button', class: `clp-ag ${CLASE[x.tipo] || ''}${pasada ? ' pasada' : ''}`, onclick: () => abrir(x) },
                h('span', { class: 'clp-ag-h' }, x.hora, Number(x.duracion) ? h('small', {}, durTxt(Number(x.duracion))) : null),
                h('span', { class: 'ip-tx' }, x.titulo || 'Sin título', x.lugar ? h('small', {}, x.lugar) : null)));
            }
            if (!ahoraPuesta && bloques.length) filas.push(lineaAhora());
            agenda = h('div', { class: 'clp-agenda' }, filas.length ? filas : h('p', { class: 'ip-nota' }, 'Nada con hora este día.'));
          }
          cont.replaceChildren(
            cel ? agenda : linea,
            h('div', { class: 'ip-sec' }, 'Detalle', h('span', {}, String(detalle.length))),
            h('div', { class: 'clp-lista' }, detalle.length ? detalle : h('p', { class: 'ip-nota' }, esHoy ? 'Nada sin hora ni atrasado.' : 'Nada sin hora este día.')));
        }
        await pintar();
        // La línea de ahora baja sola (y lo que ya pasó se apaga).
        const reloj = setInterval(() => { if (estado.dia === hoyISO()) pintar(); }, 60_000);
        const quitar = escuchar(pintar);
        return () => { clearInterval(reloj); quitar(); };
      },
    },
    {
      lugar: 'semana', titulo: 'Esta semana', enlace: { texto: 'Calendario', href: '#/calendario' },
      async dibujar(cont) {
        cargarEstilos();
        async function pintar() {
          const cfg = await leerConfig(ctx);
          const hoyD = new Date(); hoyD.setHours(0, 0, 0, 0);
          const ini = new Date(hoyD);
          ini.setDate(hoyD.getDate() - (cfg.semana === 'domingo' ? hoyD.getDay() : (hoyD.getDay() + 6) % 7));
          const dias = Array.from({ length: 7 }, (_, i) => aISO(new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i)));
          const l = await items(dias[0], dias[6]);
          if (l === null) { cont.replaceChildren(h('p', { class: 'ip-nota' }, 'La semana muestra lo de Tareas, y Tareas no está disponible.')); return; }
          const hoy = hoyISO();
          cont.replaceChildren(h('div', { class: 'clp-sem' }, dias.map(dia => {
            const del = l.filter(x => x.fecha === dia).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
            const max = 4;
            return h('div', { class: `clp-dia${dia === hoy ? ' hoy' : ''}${dia === estado.dia ? ' sel' : ''}`, role: 'button', tabindex: '0', title: 'Ver este día en Mi día',
              onclick: () => elegir(dia), onkeydown: (e) => { if (e.key === 'Enter') elegir(dia); } },
            h('span', { class: 'clp-dn' }, CORTO[deISO(dia).getDay()], h('b', {}, String(deISO(dia).getDate()))),
            del.slice(0, max).map(x => h('span', { class: `clp-ev ${CLASE[x.tipo] || ''}${x.hecha ? ' hecha' : ''}` }, x.hora ? h('small', {}, x.hora) : null, x.titulo)),
            del.length > max ? h('span', { class: 'clp-mas' }, `+${del.length - max} más`) : null);
          })));
        }
        await pintar();
        return escuchar(pintar);
      },
    },
  ];
}
