// ─────────────────────────────────────────────────────────────
// Inicio en la PC: todo en una pantalla, sin columna.
//
// Arriba una franja fina: la fecha, el tiempo y el memento mori. El aviso
// del Resumen (fin de mes, fin de semana, buen día) ocupa el lugar del
// memento hasta que lo sacás. Abajo, una cuadrícula fija con los paneles
// que ofrece cada módulo (panelesPC). El Inicio no conoce a los módulos:
// pide los paneles al núcleo y los pone en su lugar.
// ─────────────────────────────────────────────────────────────

// Lugar de cada panel en la cuadrícula de 12 columnas: [lugar, columnas, filas].
// Mi día ocupa todo el alto a la izquierda; arriba tres paneles, abajo la semana y Seguir viendo.
const LUGARES = [['dia', 3, 5], ['habitos', 3, 3], ['mes', 3, 3], ['bitacora', 3, 3], ['semana', 6, 2], ['viendo', 3, 2]];
// En el celular van una debajo de otra; la semana entra en Mi día como una tira de 7 días.
const LUGARES_CEL = [['dia'], ['habitos'], ['mes'], ['bitacora'], ['viendo']];

export function cargarEstilosPC() {
  if (document.getElementById('estilos-inicio-pc')) return;
  const l = document.createElement('link');
  l.id = 'estilos-inicio-pc'; l.rel = 'stylesheet';
  l.href = new URL('./pc.css', import.meta.url).href;
  document.head.append(l);
}

const pctTxt = (p) => `${Math.round(Math.max(0, Math.min(1, p)) * 100)} %`;

// ay: ayudas del memento que vienen de modulo.js (datosVida, porcentajes, vidaDe, textoFrase).
// cel: la misma pantalla adaptada al celular (franja arriba y paneles uno debajo de otro).
export async function pantallaPC(contenedor, ctx, ay, { cel = false } = {}) {
  cargarEstilosPC();
  const { h } = ctx;
  const franja = h('header', { class: 'ip-franja' });
  const grilla = h('div', { class: 'ip-grilla' });
  contenedor.replaceChildren(h('div', { class: `ip${cel ? ' ip-cel' : ''}` }, franja, grilla));

  let limpiezas = [];
  let turno = 0;
  const limpiar = () => { limpiezas.forEach(l => { try { l(); } catch { /* nada */ } }); limpiezas = []; };
  const guardar = (l) => { if (typeof l === 'function') limpiezas.push(l); };

  function memento(cfg) {
    const d = cfg.nacimiento ? ay.datosVida(cfg.nacimiento, ay.vidaDe(cfg)) : null;
    if (!d) return h('a', { href: '#/ajustes/inicio', class: 'ip-mm-cargar' }, 'Memento mori: cargá tu fecha de nacimiento ›');
    const q = ay.porcentajes();
    const lin = (n, p) => h('span', { class: 'ip-mm-lin' }, n, h('span', { class: 'ip-barra' }, h('i', { style: `width:${(Math.min(1, p) * 100).toFixed(1)}%` })), pctTxt(p));
    const [texto, autor] = ay.textoFrase(cfg);
    return [
      h('span', { class: 'ip-mm-n', title: `${d.edad} años · ${Math.round(d.quedan / 7).toLocaleString('es-AR')} fines de semana · ${d.anios} veranos` },
        Math.round(d.quedan).toLocaleString('es-AR'), h('small', {}, 'días por delante')),
      lin('Año', q.anio), lin('Vida', d.p),
      texto ? h('q', { class: 'ip-mm-q', title: texto }, `“${texto}”${autor ? ` — ${autor}` : ''}`) : null,
    ].filter(Boolean);
  }

  async function dibujar() {
    const mio = ++turno;
    const [{ cfg }, paneles] = await Promise.all([ctx.inicio.armar(), ctx.inicio.paneles()]);
    if (mio !== turno) return;
    limpiar();
    const de = (lugar) => paneles.find(p => p.lugar === lugar && !p.oculto);

    // ── Franja de arriba ──
    const hoy = new Date();
    const diaTxt = hoy.toLocaleDateString('es-AR', { weekday: 'long' });
    const fechaTxt = hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const fecha = h(ctx.hayModulo?.('calendario') ? 'a' : 'div', { class: 'ip-fecha', href: ctx.hayModulo?.('calendario') ? '#/calendario' : null, title: 'Abrir el Calendario' },
      h('small', {}, diaTxt), fechaTxt);
    const zonaClima = h('div', { class: 'ip-clima' });
    const zonaMm = h('div', { class: 'ip-mm' }, memento(cfg));
    const zonaAviso = h('div', { class: 'ip-aviso' });
    // En el celular la fecha y el tiempo van en una fila, y el memento (o el aviso) abajo, a todo el ancho.
    if (cel) franja.replaceChildren(h('div', { class: 'ip-f1' }, fecha, zonaClima), zonaMm, zonaAviso);
    else franja.replaceChildren(fecha, zonaClima, zonaMm, zonaAviso);
    const correr = async (p, zona, extra) => { try { guardar(await p.dibujar(zona, extra)); } catch (e) { console.error(e); } };
    const clima = de('clima');
    if (clima) correr(clima, zonaClima); else zonaClima.hidden = true;
    const aviso = de('aviso');
    // El aviso, mientras haya uno, ocupa el lugar del memento mori.
    const mostrar = (si) => { zonaMm.hidden = !!si; zonaAviso.classList.toggle('lleno', !!si); };
    if (aviso) correr(aviso, zonaAviso, { mostrar });

    // ── Cuadrícula ──
    const tarjetas = [];
    grilla.replaceChildren();
    for (const [lugar, c, r] of (cel ? LUGARES_CEL : LUGARES)) {
      const p = de(lugar);
      if (!p) continue;
      const titulo = h('h2', {}, p.titulo || p.nombreModulo);
      const enlace = h('a', { class: 'ip-enlace', href: p.enlace?.href || '#', hidden: !p.enlace }, p.enlace ? `${p.enlace.texto} ›` : '');
      const cuerpo = h('div', { class: 'ip-cuerpo' });
      // Celular: la tira de la semana va arriba de Mi día (tocar un día lo muestra abajo).
      const semana = cel && lugar === 'dia' ? de('semana') : null;
      const tira = semana ? h('div', { class: 'ip-tira' }) : null;
      const tarjeta = h('section', { class: `ip-card ip-${lugar}`, style: cel ? null : `grid-column:span ${c};grid-row:span ${r}` },
        h('div', { class: 'ip-cab' }, titulo, enlace), tira, cuerpo);
      if (semana) tarjetas.push([semana, tira, () => {}]);
      grilla.append(tarjeta);
      // El panel puede cambiar su título o su enlace (Mi día muestra otro día, por ejemplo).
      const cambiar = ({ titulo: t, enlace: e } = {}) => {
        if (t !== undefined) titulo.textContent = t;
        if (e !== undefined) {
          enlace.hidden = !e;
          if (e) { enlace.href = e.href || '#'; enlace.textContent = `${e.texto} ›`; enlace.onclick = e.alTocar ? (ev) => { ev.preventDefault(); e.alTocar(); } : null; }
        }
      };
      tarjetas.push([p, cuerpo, cambiar]);
    }
    await Promise.all(tarjetas.map(([p, cuerpo, cambiar]) => correr(p, cuerpo, { cambiar, cel }).catch(() => {})));
    if (mio !== turno) return;
    for (const [, cuerpo] of tarjetas) if (!cuerpo.childElementCount) cuerpo.append(h('p', { class: 'ip-nota' }, 'No se pudo mostrar.'));
  }

  await dibujar();
  // Si cambia la configuración del Inicio (fecha de nacimiento, frase) o qué módulos se ven, se rearma.
  const quitar = ctx.inicio.alCambiar?.(() => dibujar());
  return () => { turno++; quitar?.(); limpiar(); };
}
