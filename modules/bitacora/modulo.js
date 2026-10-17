// ─────────────────────────────────────────────────────────────
// Módulo Bitácora: tu segundo cerebro (notas, carpetas, etiquetas,
// enlaces entre notas y bases de datos).
//
// Rutas:
//   #/bitacora                 Inicio del módulo
//   #/bitacora/n/<id>          una nota
//   #/bitacora/c/<id>          una carpeta (o base de datos)
//   #/bitacora/c/<id>/campos   campos de una base de datos
//   #/bitacora/bandeja         la Bandeja
//   #/bitacora/e/<etiqueta>    notas con una #etiqueta
//   #/bitacora/buscar · /papelera · /ajustes
//   #/bitacora/compartir       lo que llega desde "Compartir" de Android
//
// En Drive: los datos en Segundo Cerebro/bitacora/*.json y, además,
// una copia legible de cada nota (.md) en Segundo Cerebro/Bitácora.
// ─────────────────────────────────────────────────────────────

import { crearModelo, espejoDe, sincronizarRecordatorios, BANDEJA, hoyISO } from './modelo.js';
import {
  cargarEstilos, esPC, arbol, pantallaInicio, pantallaCarpeta, pantallaEtiqueta, pantallaBuscar,
  pantallaPapelera, pantallaAjustes, recibirCompartido, ic, crearYAbrir,
} from './vistas.js';
import { vistaNota, cuerpoLectura } from './nota.js';
import { renderBase, pantallaCampos } from './base.js';
import { pantallaFilmoteca, pantallaLista, pantallaAgregar, pantallaStats, pantallaPrevia, actualizarEnFondo, sincronizarAvisos, listaViendo, subtituloViendo, progreso, vivo, poster, items as itemsCine } from './filmoteca.js';

// En el celular, el teclado solo se abre si el foco se pide en el mismo toque.
function abrirTecladoYa() {
  const i = document.createElement('input');
  i.setAttribute('aria-hidden', 'true');
  i.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.append(i);
  i.focus();
  setTimeout(() => i.remove(), 2500);
}

// ── Inicio: botones y cuadros ──
const diaCorto = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace(/\./g, ''); };
function cuadroNotas(ctx, contenedor, op) {
  const { h } = ctx;
  const m = crearModelo(ctx);
  async function pintar() {
    const d = await m.cargar();
    const hoy = hoyISO();
    const filas = [];
    const fila = (icono, titulo, der, href) => h('a', { href, class: 'bt-ini-fila' }, ic(icono), h('span', { class: 'bt-ini-t' }, titulo), der ? h('span', { class: 'bt-ini-der' }, der) : null);
    if (op.fijadas !== false) for (const n of d.notas.filter(x => x.fijada).sort((a, b) => b.modificado - a.modificado)) filas.push(fila('pin', n.titulo, 'fijada', `#/bitacora/n/${n.id}`));
    if (op.bandeja !== false) { const nB = d.notasDe(BANDEJA).length; if (nB) filas.push(fila('bandeja', 'Bandeja', `${nB} para ordenar`, '#/bitacora/bandeja')); }
    if (op.recordatorios !== false) {
      for (const r of d.recordatorios.filter(x => x.fecha && x.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
        const n = d.nota(r.notaId);
        if (n && !n.papelera) filas.push(fila('reloj', n.titulo, r.fecha === hoy ? 'recordar hoy' : `desde el ${diaCorto(r.fecha)}`, `#/bitacora/n/${n.id}`));
      }
    }
    if (op.recientes) for (const n of d.notas.filter(x => !x.cine && !x.fijada).sort((a, b) => b.modificado - a.modificado).slice(0, 3)) filas.push(fila('nota', n.titulo, '', `#/bitacora/n/${n.id}`));
    contenedor.replaceChildren(filas.length ? h('div', { class: 'bt-ini-lista' }, filas) : h('p', { class: 'nota' }, 'Nada fijado ni pendiente. Fijá notas con el pin para tenerlas acá.'));
  }
  let espera = null;
  const quitar = ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(pintar, 80); });
  return pintar().then(() => () => { quitar(); clearTimeout(espera); });
}
function cuadroViendo(ctx, contenedor, op) {
  const { h } = ctx;
  const m = crearModelo(ctx);
  async function pintar() {
    const d = await m.cargar();
    const hoy = hoyISO();
    let lista = listaViendo(d);
    const max = op.max3 === false ? 9 : 3;
    lista = lista.slice(0, max);
    const estrenos = op.estrenos ? itemsCine(d)
      .map(n => ({ n, f: n.cine.tipo === 'movie' && n.cine.estado === 'paraver' ? vivo(d, n.cine)?.estreno : n.cine.estado === 'viendo' ? vivo(d, n.cine)?.proximo?.fecha : '' }))
      .filter(x => x.f && x.f >= hoy).sort((a, b) => a.f.localeCompare(b.f)).slice(0, 3) : [];
    contenedor.replaceChildren(...[
      lista.length ? h('div', { class: 'bt-ini-sv' }, lista.map(n => {
        const p = progreso(n.cine, vivo(d, n.cine));
        return h('a', { href: `#/bitacora/n/${n.id}`, class: 'bt-ini-sv-it' },
          poster(ctx, n.cine, { tam: 'w185', clase: 'chico' }),
          h('span', { class: 'bt-ini-sv-tx' },
            h('span', { class: 'bt-ini-sv-t' }, n.cine.titulo),
            h('span', { class: 'bt-ini-sv-s' }, subtituloViendo(d, n.cine).replace(' próximo', '')),
            h('span', { class: 'bt-ini-sv-p' }, h('i', { style: `width:${p.pct}%` }))));
      })) : h('p', { class: 'nota' }, 'No estás viendo ninguna serie. ', h('a', { href: '#/bitacora/f', class: 'bt-link-chico' }, 'Abrir la Filmoteca')),
      estrenos.length ? h('div', { class: 'bt-ini-lista bt-ini-estrenos' }, estrenos.map(x => h('a', { href: `#/bitacora/n/${x.n.id}`, class: 'bt-ini-fila' }, ic('calendario'),
        h('span', { class: 'bt-ini-t' }, x.n.cine.titulo), h('span', { class: 'bt-ini-der' }, x.f === hoy ? 'hoy' : diaCorto(x.f))))) : null,
    ].filter(Boolean));
  }
  let espera = null;
  const quitar = ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(pintar, 80); });
  return pintar().then(() => () => { quitar(); clearTimeout(espera); });
}

export default {
  id: 'bitacora',
  nombre: 'Bitácora',

  botonesInicio(ctx) {
    return [
      { id: 'nota', texto: 'Nota', icono: 'mas', alTocar: async () => { abrirTecladoYa(); const m = crearModelo(ctx); await crearYAbrir(ctx, m, await m.cargar(), { carpetaId: BANDEJA }); } },
      { id: 'pelicula', texto: 'Película o serie', icono: 'mas', alTocar: () => ctx.navegar('bitacora/f/agregar'), defecto: false },
    ];
  },

  bloquesInicio(ctx) {
    return [
      {
        id: 'notas', titulo: 'Bitácora', enlace: { texto: 'Abrir ›', href: '#/bitacora' }, ancho: 'mitad',
        opciones: [
          { id: 'fijadas', texto: 'Fijadas', defecto: true },
          { id: 'bandeja', texto: 'Bandeja', defecto: true },
          { id: 'recordatorios', texto: 'Recordatorios', defecto: true },
          { id: 'recientes', texto: 'Recientes', defecto: false },
        ],
        dibujar(contenedor, { opciones = {} } = {}) { cargarEstilos(); return cuadroNotas(ctx, contenedor, opciones); },
      },
      {
        id: 'viendo', titulo: 'Seguir viendo', enlace: { texto: 'Filmoteca ›', href: '#/bitacora/f' }, ancho: 'mitad',
        opciones: [
          { id: 'max3', texto: 'Máx. 3', defecto: true },
          { id: 'estrenos', texto: 'Próximos estrenos', defecto: false },
        ],
        dibujar(contenedor, { opciones = {} } = {}) { cargarEstilos(); return cuadroViendo(ctx, contenedor, opciones); },
      },
    ];
  },

  async pantalla(contenedor, ctx, sub = []) {
    cargarEstilos();
    const { h } = ctx;
    const m = crearModelo(ctx);
    let d = await m.cargar();

    const lado = h('aside', { class: 'bt-lado' });
    const main = h('div', { class: 'bt-main' });
    const raiz = h('div', { class: 'bt' }, lado, main);
    contenedor.replaceChildren(raiz);

    const [que, ...resto] = sub;
    let actual = 'inicio';
    let vista = null;

    function abrir() {
      vista?.limpiar?.();
      vista = null;
      if (que === 'n' && resto[0]) { actual = `n:${resto[0]}`; vista = vistaNota(ctx, m, d, resto[0], main); }
      else if (que === 'c' && resto[0] && resto[1] === 'campos') { actual = `c:${resto[0]}`; pantallaCampos(ctx, m, d, d.carpeta(resto[0]), main); }
      else if (que === 'f') {
        actual = 'f';
        if (resto[0] === 'l' && resto[1]) pantallaLista(ctx, m, d, resto[1], main);
        else if (resto[0] === 'agregar') pantallaAgregar(ctx, m, d, main);
        else if (resto[0] === 'stats') pantallaStats(ctx, m, d, main);
        else if (resto[0] === 'v' && resto[1] && resto[2]) pantallaPrevia(ctx, m, d, resto[1], resto[2], main);
        else pantallaFilmoteca(ctx, m, d, main);
      }
      else if (que === 'c' && resto[0] && d.carpeta(resto[0])?.sistema === 'filmoteca') { actual = 'f'; pantallaFilmoteca(ctx, m, d, main); }
      else if (que === 'c' && resto[0]) { actual = `c:${resto[0]}`; pantallaCarpeta(ctx, m, d, resto[0], main, { renderBase: (zona, c) => renderBase(ctx, m, d, c, zona) }); }
      else if (que === 'bandeja') { actual = 'c:'; pantallaCarpeta(ctx, m, d, '', main, {}); }
      else if (que === 'e' && resto.length) { const tag = decodeURIComponent(resto.join('/')); actual = `e:${tag}`; pantallaEtiqueta(ctx, m, d, tag, main); }
      else if (que === 'buscar') { actual = 'buscar'; vista = pantallaBuscar(ctx, m, d, main); }
      else if (que === 'papelera') { actual = 'papelera'; pantallaPapelera(ctx, m, d, main); }
      else if (que === 'ajustes') { actual = 'ajustes'; pantallaAjustes(ctx, m, d, main); }
      else { actual = 'inicio'; pantallaInicio(ctx, m, d, main); }
      if (actual.startsWith('n:')) { const n = d.nota(actual.slice(2)); actual = n?.cine ? 'f' : n ? `c:${n.carpetaId || ''}` : actual; }
    }
    function pintarLado() {
      raiz.classList.toggle('con-arbol', esPC());
      lado.replaceChildren(esPC() ? arbol(ctx, m, d, actual) : '');
    }

    if (que === 'compartir') {
      history.replaceState(null, '', '#/bitacora');
      recibirCompartido(ctx, m);
    }
    abrir();
    pintarLado();

    // Cambios (tuyos o de otro dispositivo): se redibuja sin perder lo que estás escribiendo.
    let espera = null;
    const quitar = ctx.alCambiarDatos((e) => {
      if (e.coleccion === 'espejo') return;
      clearTimeout(espera);
      espera = setTimeout(async () => {
        d = await m.cargar();
        if (vista?.actualizar) vista.actualizar(d);
        else if (!(main.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]), textarea, select'))) abrir();
        pintarLado();
      }, 120);
    });
    const alCambiarTamano = () => pintarLado();
    const mq = matchMedia('(min-width: 900px)');
    mq.addEventListener('change', alCambiarTamano);
    return () => { quitar(); clearTimeout(espera); mq.removeEventListener('change', alCambiarTamano); vista?.limpiar?.(); };
  },

  alIniciar(ctx) {
    const m = crearModelo(ctx);
    // Filmoteca: poner al día episodios y estrenos (y los avisos en Tareas).
    setTimeout(() => actualizarEnFondo(ctx, m), 6000);
    let esperaCine = null;
    ctx.alCambiarDatos((e) => { if (e.coleccion === 'notas' || e.coleccion === 'cine') { clearTimeout(esperaCine); esperaCine = setTimeout(() => sincronizarAvisos(ctx, m), 2500); } });
    // Copia legible en Drive: un .md por nota, en carpetas reales.
    ctx.espejo?.definir('Bitácora', async () => espejoDe(await m.cargar()));
    // Papelera: lo de más de 30 días se borra solo.
    setTimeout(() => m.limpiarPapelera().catch(() => {}), 4000);
    // Recordatorios en Tareas.
    setTimeout(() => sincronizarRecordatorios(ctx), 2500);
    let espera = null;
    ctx.alCambiarDatosDe?.('tareas', () => { clearTimeout(espera); espera = setTimeout(() => sincronizarRecordatorios(ctx), 3000); });
    ctx.alCambiarDatos((e) => { if (e.coleccion === 'recordatorios') { clearTimeout(espera); espera = setTimeout(() => sincronizarRecordatorios(ctx), 800); } });
  },

  acciones: {
    // Otros módulos pueden abrir una nota: ctx.pedir('abrir-nota', { id })
    'abrir-nota': ({ id } = {}, ctx) => ctx.navegar(`bitacora/n/${id}`),
  },

  // Un adjunto que estaba en espera ya se subió.
  async archivoSubido({ pendiente, archivo }, ctx) {
    await crearModelo(ctx).actualizarAdjunto(pendiente, archivo);
  },
};
