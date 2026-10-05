// ─────────────────────────────────────────────────────────────
// Módulo Inicio.
//
// No tiene datos propios. Muestra la captura rápida y lo que cada
// módulo ofrece (botones y bloques). No conoce a ningún módulo:
// se lo pregunta al núcleo con ctx.inicio.
// ─────────────────────────────────────────────────────────────

export default {
  id: 'home',
  nombre: 'Inicio',

  async pantalla(contenedor, ctx) {
    const { h, icono } = ctx;
    const hoy = new Date();
    const dia = hoy.toLocaleDateString('es-AR', { weekday: 'long' });
    const fecha = hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

    const zonaCaptura = h('section', { class: 'captura' });
    const zonaBotones = h('section', { class: 'accesos', 'aria-label': 'Accesos rápidos' });
    const zonaBloques = h('div', { class: 'bloques' });

    contenedor.replaceChildren(
      h('header', { class: 'portada' },
        h('p', { class: 'portada-dia' }, dia),
        h('h1', { class: 'portada-fecha' }, fecha)),
      zonaCaptura,
      zonaBotones,
      zonaBloques,
    );

    // ── Captura rápida ──
    const receptor = await ctx.inicio.quienCaptura();
    const campo = h('input', {
      type: 'text', name: 'captura', autocomplete: 'off', enterkeyhint: 'send',
      placeholder: receptor ? 'Anotá algo para no olvidarlo' : 'Se activa con el módulo Tareas',
      disabled: !receptor, 'aria-label': 'Captura rápida',
    });
    const enviar = h('button', { type: 'submit', class: 'boton-icono principal', disabled: !receptor, 'aria-label': 'Guardar' }, icono('enviar'));
    const form = h('form', { class: 'captura-form' }, campo, enviar);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = campo.value.trim();
      if (!texto) return;
      try {
        const destino = await ctx.capturar(texto);
        campo.value = '';
        ctx.aviso(`Guardado en ${destino}`);
      } catch (err) {
        ctx.aviso(err.message);
      }
    });
    zonaCaptura.replaceChildren(form);

    // ── Botones y bloques de los módulos ──
    async function dibujarContenido() {
      const [botones, bloques] = await Promise.all([ctx.inicio.botones(), ctx.inicio.bloques()]);

      zonaBotones.replaceChildren(...botones.map(b =>
        h('button', { class: 'acceso', onclick: () => b.alTocar?.() }, icono(b.icono || 'mas'), h('span', {}, b.texto))));
      zonaBotones.hidden = !botones.length;

      const limpiezas = [];
      zonaBloques.replaceChildren();
      for (const b of bloques) {
        const cuerpo = h('div', { class: 'bloque-cuerpo' });
        zonaBloques.append(h('section', { class: 'tarjeta bloque' },
          h('h2', {}, b.titulo || b.nombreModulo), cuerpo));
        try {
          const l = await b.dibujar?.(cuerpo);
          if (typeof l === 'function') limpiezas.push(l);
        } catch (err) {
          cuerpo.replaceChildren(h('p', { class: 'nota error' }, `No se pudo mostrar: ${err.message}`));
        }
      }

      if (!bloques.length && !botones.length) {
        zonaBloques.append(h('section', { class: 'vacio' },
          h('h2', {}, 'Tu panel está listo'),
          h('p', {}, 'Acá van a aparecer los bloques y accesos de cada módulo. El primero en sumarse es Tareas, con tus pendientes del día.'),
          h('a', { href: '#/ajustes', class: 'boton' }, 'Ver el estado de Drive')));
      }
      return () => limpiezas.forEach(l => l());
    }

    let limpiar = await dibujarContenido();
    return () => limpiar?.();
  },
};
