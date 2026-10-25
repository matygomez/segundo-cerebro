// ─────────────────────────────────────────────────────────────
// Módulo Inicio.
//
// No tiene datos propios. Arriba la fecha (tocándola se abre el
// Calendario) y debajo, en el orden elegido en Ajustes › Inicio:
// el memento mori, los botones rápidos, la captura y los cuadros que
// ofrece cada módulo. No conoce a ningún módulo: le pide todo al
// núcleo con ctx.inicio.armar().
// ─────────────────────────────────────────────────────────────

// Frases estoicas cortas (para que entren en una línea).
const CITAS = [
  ['No es que tengamos poco tiempo, es que perdemos mucho.', 'Séneca'],
  ['Cada día es una vida aparte.', 'Séneca'],
  ['No actúes como si fueras a vivir diez mil años.', 'Marco Aurelio'],
  ['Hacé cada cosa como si fuera la última.', 'Marco Aurelio'],
  ['Mientras se posterga, la vida pasa.', 'Séneca'],
  ['Nada es nuestro, excepto el tiempo.', 'Séneca'],
  ['Tené la muerte presente cada día.', 'Epicteto'],
  ['Perdemos la vida esperando el mañana.', 'Séneca'],
  ['Hoy podés irte de la vida: actuá en consecuencia.', 'Marco Aurelio'],
  ['Empezá a vivir ahora mismo.', 'Séneca'],
];
// Años totales de vida que cuenta el memento mori (se elige en Configurar Inicio).
const vidaDe = (cfg) => Math.min(120, Math.max(50, Math.round(Number(cfg?.vida) || 100)));
const esPC = () => matchMedia('(min-width: 900px)').matches;
const fmt = (n) => Math.max(0, Math.round(n)).toLocaleString('es-AR');
const pct = (p) => `${Math.round(Math.max(0, Math.min(1, p)) * 100)} %`;

function datosVida(nacimiento, VIDA) {
  const hoy = new Date();
  const nac = new Date(`${nacimiento}T00:00`);
  if (Number.isNaN(nac.getTime()) || nac > hoy) return null;
  const fin = new Date(nac); fin.setFullYear(nac.getFullYear() + VIDA);
  const total = (fin - nac) / 864e5, vividos = (hoy - nac) / 864e5;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const cumple = new Date(nac); cumple.setFullYear(hoy.getFullYear()); if (cumple > hoy) edad--;
  const ultimo = new Date(nac); ultimo.setFullYear(nac.getFullYear() + edad);
  const proximo = new Date(nac); proximo.setFullYear(nac.getFullYear() + edad + 1);
  return {
    vividos, quedan: Math.max(0, total - vividos), edad, anios: Math.max(0, VIDA - 1 - edad),
    p: Math.min(1, vividos / total), pAnio: (hoy - ultimo) / (proximo - ultimo),
  };
}
function porcentajes() {
  const ahora = new Date();
  const ini = new Date(ahora); ini.setHours(0, 0, 0, 0);
  const pDia = (ahora - ini) / 864e5;
  const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  const ia = new Date(ahora.getFullYear(), 0, 1), fa = new Date(ahora.getFullYear() + 1, 0, 1);
  return { dia: pDia, semana: (((ahora.getDay() + 6) % 7) + pDia) / 7, mes: (ahora.getDate() - 1 + pDia) / diasMes, anio: (ahora - ia) / (fa - ia) };
}

// ── Memento mori ──
function memento(ctx, cfg) {
  const { h } = ctx;
  const d = cfg.nacimiento ? datosVida(cfg.nacimiento, vidaDe(cfg)) : null;
  if (!d) {
    return h('section', { class: 'tarjeta mm' },
      h('span', { class: 'mm-etq' }, 'Memento mori'),
      h('p', { class: 'nota' }, 'Cargá tu fecha de nacimiento para ver cuánto tiempo tenés por delante.'),
      h('a', { href: '#/ajustes/inicio', class: 'bloque-enlace mm-link' }, 'Cargarla en Ajustes › Inicio'));
  }
  const q = porcentajes();
  const pc = esPC();
  const prog = (p) => h('span', { class: 'mm-prog' }, h('i', { style: `width:${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}%` }));
  const mini = (n, p, clase = '') => h('div', { class: `mm-mini ${clase}` }, h('span', {}, h('em', {}, n), h('b', {}, pct(p))), prog(p));
  const minis = () => h('div', { class: 'mm-minis' },
    mini('Día', q.dia), mini(pc ? 'Semana' : 'Sem.', q.semana), mini('Mes', q.mes), mini('Año', q.anio), mini('Vida', d.p, 'vida'));
  const fila = (n, p, clase = '') => h('div', { class: `mm-fila ${clase}` }, h('span', {}, n), prog(p), h('b', {}, pct(p)));
  const cab = (t, der = '') => h('div', { class: 'mm-cab' }, h('span', { class: 'mm-etq' }, t ? `Memento mori · ${t}` : 'Memento mori'), der ? h('span', { class: 'nota' }, der) : null);
  const grande = (txt) => h('span', { class: 'mm-num' }, txt);

  let cuerpo;
  if (cfg.estilo === 'barras') {
    cuerpo = [cab('Lo que ya pasó'),
      h('div', { class: 'mm-filas' }, fila('Día', q.dia), fila('Semana', q.semana), fila('Mes', q.mes), fila('Año', q.anio), fila('Vida', d.p, 'vida')),
      h('p', { class: 'nota' }, `Te quedan ${fmt(d.quedan)} días, ${fmt(d.quedan / 7)} semanas, ${d.anios} años enteros.`)];
  } else if (cfg.estilo === 'contador') {
    cuerpo = [cab('Recordá que vas a morir'),
      h('div', { class: 'mm-linea' }, grande(fmt(d.quedan)), h('span', { class: 'mm-txt' }, 'días por delante')),
      prog(d.p),
      h('div', { class: 'mm-tres' },
        h('div', {}, h('span', { class: 'nota' }, 'Vividos'), h('b', {}, fmt(d.vividos))),
        h('div', {}, h('span', { class: 'nota' }, 'Fines de semana'), h('b', {}, fmt(d.quedan / 7))),
        h('div', {}, h('span', { class: 'nota' }, 'Veranos'), h('b', {}, String(d.anios))))];
  } else if (cfg.estilo === 'anios') {
    cuerpo = [cab(`${vidaDe(cfg)} años`, `${d.edad} vividos · ${d.anios} por delante`),
      h('div', { class: 'mm-anios' }, Array.from({ length: vidaDe(cfg) }, (_, i) => h('i', {
        class: i < d.edad ? 'v' : i === d.edad ? 'a' : i % 10 === 9 ? 'd' : '',
        style: i === d.edad ? `--p:${Math.round(d.pAnio * 100)}%` : null, title: `${i} años`,
      })))];
  } else if (pc) {   // Barras + Contador, en la PC
    cuerpo = [h('span', { class: 'mm-etq' }, 'Memento mori'),
      h('div', { class: 'mm-linea' }, grande(fmt(d.quedan)), h('span', { class: 'mm-txt' }, 'días por delante'),
        h('span', { class: 'nota mm-der' }, `${d.edad} años · ${fmt(d.quedan / 7)} fines de semana · ${d.anios} veranos`)),
      minis()];
  } else {           // Barras + Contador, en el celular
    cuerpo = [h('span', { class: 'mm-etq' }, 'Memento mori'),
      h('div', { class: 'mm-linea' }, grande(fmt(d.quedan)), h('span', { class: 'mm-txt dos' }, 'días por', h('br'), 'delante'),
        h('span', { class: 'nota mm-der' }, `${fmt(d.quedan / 7)} findes · ${d.anios} años`)),
      minis()];
  }
  return h('section', { class: `tarjeta mm mm-${cfg.estilo || 'mezcla'}` }, cuerpo, frase(ctx, cfg));
}

function frase(ctx, cfg) {
  const { h } = ctx;
  if (cfg.frase === 'no') return null;
  let texto, autor;
  if (cfg.frase === 'fija') { texto = (cfg.fraseTexto || '').trim(); autor = (cfg.fraseAutor || '').trim(); }
  else { const hoy = new Date(); const n = Math.floor(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() / 864e5); [texto, autor] = CITAS[n % CITAS.length]; }
  if (!texto) return null;
  return h('div', { class: `mm-cita${cfg.unaLinea !== false ? ' una-linea' : ''}` },
    h('span', { class: 'mm-cita-txt' }, `“${texto}”`),
    autor ? h('small', {}, `— ${autor}`) : null);
}

// La frase se achica lo justo para entrar en una línea.
function ajustarFrases(raiz) {
  for (const t of raiz.querySelectorAll('.mm-cita.una-linea .mm-cita-txt')) {
    t.style.fontSize = '';
    let tam = parseFloat(getComputedStyle(t).fontSize);
    while (t.scrollWidth > t.clientWidth + 1 && tam > 8) { tam -= 0.25; t.style.fontSize = `${tam}px`; }
  }
}

export default {
  id: 'home',
  nombre: 'Inicio',

  async pantalla(contenedor, ctx) {
    const { h, icono } = ctx;
    const hoy = new Date();
    const dia = hoy.toLocaleDateString('es-AR', { weekday: 'long' });
    const fecha = hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const grilla = h('div', { class: 'ini-grilla' });

    contenedor.replaceChildren(h('div', { class: 'ini' },
      h('header', { class: 'portada' },
        h('p', { class: 'portada-dia' }, dia),
        // Tocando la fecha se abre el Calendario (si está instalado).
        ctx.hayModulo?.('calendario')
          ? h('h1', { class: 'portada-fecha' }, h('a', { href: '#/calendario', class: 'portada-enlace', title: 'Abrir Calendario' }, fecha, icono('calendario')))
          : h('h1', { class: 'portada-fecha' }, fecha)),
      grilla));

    let limpiezas = [];
    let cfgActual = null;
    let zonaMemento = null;
    let turno = 0;

    function captura() {
      const campo = h('input', { type: 'text', name: 'captura', autocomplete: 'off', enterkeyhint: 'send', placeholder: 'Anotá algo para no olvidarlo', 'aria-label': 'Captura rápida' });
      const form = h('form', { class: 'captura-form' }, campo,
        h('button', { type: 'submit', class: 'boton-icono principal', 'aria-label': 'Guardar' }, icono('enviar')));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = campo.value.trim();
        if (!texto) return;
        try { const destino = await ctx.capturar(texto); campo.value = ''; ctx.aviso(`Guardado en ${destino}`); } catch (err) { ctx.aviso(err.message); }
      });
      return form;
    }

    function pintarMemento() {
      if (!zonaMemento || !cfgActual) return;
      zonaMemento.replaceChildren(memento(ctx, cfgActual));
      requestAnimationFrame(() => ajustarFrases(zonaMemento));
    }

    async function dibujar() {
      const mio = ++turno;
      const { cfg, piezas, botones } = await ctx.inicio.armar();
      if (mio !== turno) return;
      limpiezas.forEach(l => { try { l(); } catch { /* nada */ } });
      limpiezas = [];
      cfgActual = cfg;
      zonaMemento = null;
      grilla.replaceChildren();

      for (const p of piezas) {
        if (!p.on) continue;
        const caja = h('div', { class: `ini-pieza ${p.ancho === 'mitad' ? 'mitad' : 'completo'}`, 'data-clave': p.clave });
        if (p.clave === 'mm') { zonaMemento = caja; grilla.append(caja); pintarMemento(); continue; }
        if (p.clave === 'botones') {
          const visibles = botones.filter(b => b.on);
          if (!visibles.length) continue;
          caja.append(h('section', { class: 'accesos', 'aria-label': 'Botones rápidos' }, visibles.map(b =>
            h('button', { type: 'button', class: 'acceso', onclick: () => b.alTocar?.() }, icono(b.icono || 'mas'), h('span', {}, b.texto)))));
          grilla.append(caja);
          continue;
        }
        if (p.clave === 'captura') { caja.append(captura()); grilla.append(caja); continue; }
        if (p.clave === 'busqueda') { if (ctx.busqueda) { caja.append(ctx.busqueda.barra()); grilla.append(caja); } continue; }
        const b = p.bloque;
        if (!b) continue;
        const cuerpo = h('div', { class: 'bloque-cuerpo' });
        // sinMarco: el bloque dibuja su propia tarjeta (y puede no mostrar nada).
        if (b.sinMarco) caja.append(cuerpo);
        else {
          caja.append(h('section', { class: 'tarjeta bloque' },
            h('div', { class: 'bloque-cab' }, h('h2', {}, b.titulo || b.nombreModulo),
              b.enlace ? h('a', { href: b.enlace.href, class: 'bloque-enlace' }, b.enlace.texto) : null),
            cuerpo));
        }
        grilla.append(caja);
        try {
          const l = await b.dibujar?.(cuerpo, { opciones: p.op });
          if (typeof l === 'function') limpiezas.push(l);
        } catch (err) {
          cuerpo.replaceChildren(h('p', { class: 'nota error' }, `No se pudo mostrar: ${err.message}`));
        }
        if (b.sinMarco) caja.hidden = !cuerpo.childElementCount;
        if (mio !== turno) return;
      }
    }

    await dibujar();

    // El memento mori se actualiza cada minuto (las barras de día, semana…).
    const reloj = setInterval(pintarMemento, 60_000);
    // Al pasar de celular a PC (o al revés) cambia su forma.
    const mq = matchMedia('(min-width: 900px)');
    const alCambiarTam = () => pintarMemento();
    mq.addEventListener('change', alCambiarTam);
    const alRedimensionar = () => zonaMemento && ajustarFrases(zonaMemento);
    window.addEventListener('resize', alRedimensionar);
    // Si cambia la configuración (acá o en otro dispositivo), se vuelve a armar.
    const quitar = ctx.inicio.alCambiar?.(() => dibujar());

    return () => {
      turno++;
      clearInterval(reloj);
      mq.removeEventListener('change', alCambiarTam);
      window.removeEventListener('resize', alRedimensionar);
      quitar?.();
      limpiezas.forEach(l => { try { l(); } catch { /* nada */ } });
    };
  },
};
