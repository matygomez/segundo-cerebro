// ─────────────────────────────────────────────────────────────
// Resumen dentro del Inicio de la PC:
//   clima  → el tiempo, al lado de la fecha
//   aviso  → franja que ocupa el lugar del memento mori mientras haya algo
//            para ver (terminó el mes → terminó la semana → buen día).
//            Sin avisos quedan dos botones: Semana y Mes.
//   mes    → "Tu mes y patrimonio": patrimonio con su curva, dónde se fue
//            la plata (las 5 categorías con más gasto + Otros) y el tiempo
//            (% de tareas hechas por área), comparado con el mes anterior.
// Todo se pide a los otros módulos (ctx.pedir); acá no se guarda nada nuevo.
// ─────────────────────────────────────────────────────────────

import { leerAjustes, clima, textoClima, loDeHoy } from './dia.js';
import { crearModelo, numeros, pedirSeguro, hoyISO, sumarDias, sumarMeses, finDeMes, textoSemana, MESES, plata } from './datos.js';

const saludo = () => { const hh = new Date().getHours(); return hh < 13 ? 'Buen día' : hh < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const pctTxt = (x) => `${Math.round(x * 100)} %`;

export function panelesResumen(ctx, { cargarEstilos }) {
  const { h, icono } = ctx;
  const m = crearModelo(ctx);
  // Se redibuja si cambian tus revisiones o lo de hoy.
  const escuchar = (pintar, otros = []) => {
    let espera = null;
    const otra = () => { clearTimeout(espera); espera = setTimeout(pintar, 300); };
    const q = [ctx.alCambiarDatos(otra), ...otros.map(o => ctx.alCambiarDatosDe?.(o, otra))];
    return () => { clearTimeout(espera); q.forEach(x => x?.()); };
  };

  return [
    {
      lugar: 'clima',
      async dibujar(cont) {
        const aj = await leerAjustes(ctx);
        let t = await clima(aj).catch(() => null);
        const pintar = () => {
          if (!t) {
            cont.replaceChildren(h('a', { href: '#', onclick: async (e) => {
              e.preventDefault();
              try { t = await clima(aj, { pedirPermiso: true }); pintar(); } catch (err) { ctx.aviso(err.message); }
            } }, 'Ver el tiempo'));
            return;
          }
          cont.replaceChildren(h('span', { class: 'ip-tmp' }, `${t.temp}°`),
            h('div', {}, h('b', {}, textoClima(t.codigo)[2]),
              h('small', {}, [`máx ${t.max}° · mín ${t.min}°`, t.lluvia !== null ? `lluvia ${t.lluvia} %` : ''].filter(Boolean).join(' · '))));
          cont.title = t.lugar || '';
        };
        pintar();
      },
    },
    {
      lugar: 'aviso',
      async dibujar(cont, { mostrar } = {}) {
        cargarEstilos();
        let turno = 0;
        async function pintar() {
          const mio = ++turno;
          const aj = await leerAjustes(ctx);
          const pend = await m.pendientes({ horaDia: aj.hora });
          if (mio !== turno) return;
          if (!pend.length) {
            // El resto del tiempo: la revisión de la semana y el cierre del mes, cuando quieras.
            mostrar?.(false);
            cont.replaceChildren(
              h('a', { class: 'ip-bt', href: '#/resumen/semana', title: 'La revisión guiada de la semana' }, icono('calendario'), 'Semana'),
              h('a', { class: 'ip-bt', href: '#/resumen/mes', title: 'El cierre del mes, con tendencias y récords' }, icono('resumen'), 'Mes'));
            return;
          }
          const { tipo, clave } = pend[0];
          const num = (v, t) => h('span', {}, h('b', {}, v), t);
          let sup, tit, nums = [], ver, textoVer;
          const cerrar = async () => { await m.guardar(tipo, clave, { vista: true }); pintar(); };
          if (tipo === 'dia') {
            const d = await loDeHoy(ctx);
            const t = await clima(aj).catch(() => null);
            const pendientes = d.tareas.filter(x => !x.hecha), vence = d.vence.filter(x => !x.hecha);
            const vencidas = (await pedirSeguro(ctx, 'resumen-vencidas', {}, [])) || [];
            const porArea = {};
            for (const x of pendientes) { const a = String(x.lugar || 'Bandeja').split(' › ')[0]; porArea[a] = (porArea[a] || 0) + 1; }
            sup = `${saludo()}${aj.nombre ? `, ${aj.nombre}` : ''}`;
            tit = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
            nums = [
              t ? num(`${t.temp}°`, textoClima(t.codigo)[2].toLowerCase()) : null,
              num(String(pendientes.length), `tareas${Object.keys(porArea).length ? ` · ${Object.entries(porArea).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} ${n}`).join(' · ')}` : ''}`),
              vencidas.length ? num(String(vencidas.length), vencidas.length === 1 ? 'atrasada' : 'atrasadas') : null,
              vence.length ? num(String(vence.length), `vence hoy: ${vence.map(x => x.titulo).join(', ')}`) : null,
              d.habitos.total ? num(String(d.habitos.total - d.habitos.hechos), 'hábitos por hacer') : null,
              (d.cumples || []).length ? num('🎂', `cumple de ${d.cumples.map(c => c.nombre).join(', ')}`) : null,
            ];
            textoVer = 'Ver mi día';
            // Mi día ya está en la pantalla: se resalta y el aviso se va.
            ver = async () => { await m.guardar(tipo, clave, { vista: true }); document.querySelector('.ip-dia')?.animate([{ boxShadow: '0 0 0 2px var(--laton)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1400 }); pintar(); };
          } else {
            const sem = tipo === 'semana';
            const desde = sem ? clave : `${clave}-01`, hasta = sem ? sumarDias(clave, 6) : finDeMes(clave);
            const [n] = await numeros(ctx, [{ desde, hasta }]);
            const vencidas = sem ? ((await pedirSeguro(ctx, 'resumen-vencidas', {}, [])) || []).length : 0;
            sup = sem ? 'Terminó la semana' : 'Terminó el mes';
            tit = sem ? `Revisión del ${textoSemana(clave, { corto: true })}` : `Resumen de ${MESES[Number(clave.slice(5, 7)) - 1]}`;
            nums = [
              n.tareas ? num(String(n.tareas.hechas), 'tareas hechas') : null,
              n.habitos?.pct !== null && n.habitos ? num(pctTxt(n.habitos.pct), 'hábitos') : null,
              n.finanzas ? num(plata(n.finanzas.gastado), 'gastado') : null,
              sem && vencidas ? num(String(vencidas), vencidas === 1 ? 'vencida para decidir' : 'vencidas para decidir') : null,
              !sem && n.bitacora ? num(String(n.bitacora.peliculas), 'películas') : null,
              !sem && n.bitacora ? num(String(n.bitacora.notas), 'notas nuevas') : null,
            ];
            textoVer = sem ? 'Hacer la revisión' : 'Ver el cierre del mes';
            ver = async () => { await m.guardar(tipo, clave, { vista: true }); ctx.navegar(sem ? `resumen/semana/${clave}` : `resumen/mes/${clave}`); };
          }
          if (mio !== turno) return;
          mostrar?.(true);
          cont.replaceChildren(h('div', { class: `rsp-aviso ${tipo}` },
            h('i', { class: 'rsp-pto' }),
            h('div', { class: 'rsp-t' }, h('small', {}, sup), h('b', {}, tit)),
            h('div', { class: 'rsp-n' }, nums.filter(Boolean)),
            h('div', { class: 'rsp-b' },
              h('button', { type: 'button', class: 'ip-bt p', onclick: ver }, textoVer),
              h('button', { type: 'button', class: 'ip-bt', onclick: cerrar }, 'Ahora no'),
              pend.length > 1 ? h('span', { class: 'rsp-pts', title: `${pend.length - 1} aviso${pend.length > 2 ? 's' : ''} más` }, pend.map((_, i) => h('i', { class: i ? '' : 'on' }))) : null)));
        }
        await pintar();
        return escuchar(pintar, ['tareas', 'habitos']);
      },
    },
    {
      lugar: 'mes', titulo: 'Tu mes y patrimonio', enlace: { texto: 'Finanzas', href: '#/finanzas' },
      async dibujar(cont, { cambiar } = {}) {
        cargarEstilos();
        async function pintar() {
          const mes = hoyISO().slice(0, 7), ant = sumarMeses(mes, -1);
          const [[a, b], pat] = await Promise.all([
            numeros(ctx, [{ desde: `${mes}-01`, hasta: finDeMes(mes) }, { desde: `${ant}-01`, hasta: finDeMes(ant) }]),
            pedirSeguro(ctx, 'resumen-patrimonio', { meses: 12 }, null),
          ]);
          const nomAnt = MESES[Number(ant.slice(5, 7)) - 1];
          cambiar?.({ titulo: a.finanzas ? 'Tu mes y patrimonio' : 'Tu mes' });
          const partes = [];

          // Patrimonio: lo de hoy y la curva de fin de cada mes.
          if (pat) {
            const hist = [...(pat.historia || []).map(x => x.total), pat.total];
            const previo = pat.historia?.[pat.historia.length - 1]?.total;
            const dif = previo ? (pat.total - previo) / Math.abs(previo) : null;
            partes.push(h('div', { class: 'ip-sec' }, 'Patrimonio', h('span', {}, 'cuentas + inversiones + fondo − tarjeta')),
              h('div', { class: 'rsp-pat' },
                h('div', {}, h('div', { class: 'rsp-pat-n' }, plata(pat.total)),
                  dif !== null ? h('small', { class: dif >= 0 ? 'ip-ok' : 'ip-mal' }, `${dif >= 0 ? '▲' : '▼'} ${Math.abs(dif * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`, h('span', {}, ` vs fin de ${nomAnt}`)) : null),
                curva(h, hist)));
          }

          // Plata: las 5 categorías con más gasto este mes (cambian solas) + Otros, contra el mes anterior.
          if (a.finanzas) {
            const cats = a.finanzas.categorias || [];
            const antes = new Map((b.finanzas?.categorias || []).map(c => [c.nombre, c.monto]));
            const top = cats.slice(0, 5);
            const resto = cats.slice(5).reduce((s, c) => s + c.monto, 0);
            const restoAntes = (b.finanzas?.categorias || []).filter(c => !top.some(t => t.nombre === c.nombre)).reduce((s, c) => s + c.monto, 0);
            const filas = [...top.map(c => ({ nombre: c.nombre, monto: c.monto, antes: antes.get(c.nombre) })), ...(resto ? [{ nombre: 'Otros', monto: resto, antes: restoAntes }] : [])];
            const max = Math.max(1, ...filas.map(x => x.monto));
            partes.push(h('div', { class: 'ip-sec' }, 'Dónde se fue tu plata', h('span', {}, `${plata(a.finanzas.gastado)} · vs ${nomAnt}`)),
              filas.length ? filas.map(x => {
                const d = x.antes ? (x.monto - x.antes) / x.antes : null;
                return h('div', { class: 'rsp-hbar' }, h('span', { class: 'rsp-hn' }, x.nombre, h('small', {}, plata(x.monto))),
                  h('span', { class: 'ip-barra' }, h('i', { style: `width:${(x.monto / max) * 100}%` })),
                  h('span', { class: `rsp-d ${d === null ? '' : d > 0.02 ? 'ip-mal' : d < -0.02 ? 'ip-ok' : ''}` }, d === null ? 'nuevo' : Math.abs(d) <= 0.02 ? '=' : `${d > 0 ? '▲' : '▼'} ${Math.round(Math.abs(d) * 100)} %`));
              }) : h('p', { class: 'ip-nota' }, 'Todavía no hay gastos este mes.'));
          }

          // Tiempo: % de las tareas hechas por área (por cantidad), contra el mes anterior.
          if (a.tareas) {
            const tot = a.tareas.hechas || 0, totAnt = b.tareas?.hechas || 0;
            const antes = new Map(b.tareas?.porArea || []);
            partes.push(h('div', { class: 'ip-sec' }, 'Dónde se fue tu tiempo', h('span', {}, `${tot} tareas hechas · % por área`)),
              tot ? a.tareas.porArea.slice(0, 6).map(([area, n]) => {
                const p = n / tot, pa = totAnt ? (antes.get(area) || 0) / totAnt : null;
                const d = pa === null ? null : Math.round((p - pa) * 100);
                return h('div', { class: 'rsp-hbar' }, h('span', { class: 'rsp-hn' }, area, h('small', {}, `${n} · ${pctTxt(p)}`)),
                  h('span', { class: 'ip-barra' }, h('i', { class: 'z', style: `width:${p * 100}%` })),
                  h('span', { class: 'rsp-d' }, d === null ? '' : d === 0 ? '=' : `${d > 0 ? '+' : ''}${d} pts`));
              }) : h('p', { class: 'ip-nota' }, 'Todavía no hay tareas hechas este mes.'));
          }
          cont.replaceChildren(...(partes.length ? partes.flat() : [h('p', { class: 'ip-nota' }, 'Hace falta Finanzas o Tareas para ver tu mes.')]));
        }
        await pintar();
        return escuchar(pintar, ['finanzas', 'tareas']);
      },
    },
  ];
}

// Curva chiquita (SVG) con el área pintada abajo.
function curva(h, valores) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 30'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'rsp-curva');
  if (valores.length < 2) return svg;
  const max = Math.max(...valores), min = Math.min(...valores);
  const pts = valores.map((v, i) => `${((i / (valores.length - 1)) * 100).toFixed(1)},${(30 - ((v - min) / ((max - min) || 1)) * 26 - 2).toFixed(1)}`).join(' ');
  const area = document.createElementNS(ns, 'polygon'); area.setAttribute('points', `0,30 ${pts} 100,30`); area.setAttribute('class', 'rsp-area');
  const linea = document.createElementNS(ns, 'polyline'); linea.setAttribute('points', pts); linea.setAttribute('class', 'rsp-linea'); linea.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(area, linea);
  return svg;
}
