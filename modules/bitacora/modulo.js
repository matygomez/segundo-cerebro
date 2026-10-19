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
//   #/bitacora/pendientes      archivos para revisar (ver ordenar.js)
//
// En Drive: los datos en Segundo Cerebro/bitacora/*.json y, además,
// una copia legible de cada nota (.md) en Segundo Cerebro/Bitácora.
// ─────────────────────────────────────────────────────────────

import { crearModelo, espejoDe, sincronizarRecordatorios, BANDEJA, hoyISO, textoArchivo } from './modelo.js';
import {
  cargarEstilos, esPC, arbol, pantallaInicio, pantallaCarpeta, pantallaEtiqueta, pantallaBuscar,
  pantallaPapelera, pantallaAjustes, recibirCompartido, ic, crearYAbrir,
} from './vistas.js';
import { vistaNota, cuerpoLectura } from './nota.js';
import { renderBase, pantallaCampos } from './base.js';
import { pantallaPendientes, recibirArchivos, sincronizarMensuales, reintentarSolo } from './ordenar.js';
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
    if (d.pendientes.length) filas.push(fila('clip', 'Archivos', `${d.pendientes.length} para revisar`, '#/bitacora/pendientes'));
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

    let [que, ...resto] = sub;
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
      else if (que === 'pendientes') { actual = 'pendientes'; pantallaPendientes(ctx, m, d, main); }
      else { actual = 'inicio'; pantallaInicio(ctx, m, d, main); }
      if (actual.startsWith('n:')) { const n = d.nota(actual.slice(2)); actual = n?.cine ? 'f' : n ? `c:${n.carpetaId || ''}` : actual; }
    }
    function pintarLado() {
      raiz.classList.toggle('con-arbol', esPC());
      lado.replaceChildren(esPC() ? arbol(ctx, m, d, actual) : '');
    }

    if (que === 'compartir') {
      // Archivos compartidos (sin link): a "Para revisar". Links y textos: una nota, como siempre.
      const c = await ctx.compartido?.leer?.();
      if (c?.archivos?.length && !c.url && !/https?:\/\//.test(c.texto)) {
        await ctx.compartido.limpiar();
        history.replaceState(null, '', '#/bitacora/pendientes');
        que = 'pendientes';
        recibirArchivos(ctx, m, c.archivos.map(f => ({ blob: f, nombre: f.name })), 'Compartido desde el celular');
      } else {
        history.replaceState(null, '', '#/bitacora');
        recibirCompartido(ctx, m);
      }
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
    // Cargas mensuales: tareas "Falta subir…" (se revisa al abrir y cuando cambian notas o ajustes).
    setTimeout(() => sincronizarMensuales(ctx, m), 3500);
    // Archivos en espera (Gemini ocupado o sin conexión): se reintentan solos.
    reintentarSolo(ctx, m);
    let esperaMes = null;
    ctx.alCambiarDatos((e) => { if (e.coleccion === 'notas' || e.coleccion === 'ajustes') { clearTimeout(esperaMes); esperaMes = setTimeout(() => sincronizarMensuales(ctx, m), 3000); } });
    let espera = null;
    ctx.alCambiarDatosDe?.('tareas', () => { clearTimeout(espera); espera = setTimeout(() => sincronizarRecordatorios(ctx), 3000); });
    ctx.alCambiarDatos((e) => { if (e.coleccion === 'recordatorios') { clearTimeout(espera); espera = setTimeout(() => sincronizarRecordatorios(ctx), 800); } });
  },

  // Búsqueda general: notas (título, texto, etiquetas) y la Filmoteca.
  async buscar(texto, ctx, { coincide, fragmento }) {
    const d = await crearModelo(ctx).cargar();
    const MS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const cuando = (ms) => { if (!ms) return ''; const f = new Date(ms), dias = Math.floor((Date.now() - ms) / 864e5); return dias < 1 ? 'hoy' : dias === 1 ? 'ayer' : dias < 7 ? `hace ${dias} días` : `${f.getDate()} ${MS[f.getMonth()]}`; };
    const EST = { paraver: 'Para ver', viendo: 'Viendo', vista: 'Vista', volver: 'Vista', abandonada: 'Abandonada' };
    const salida = [];
    for (const n of d.notas) {
      if (n.cine) {
        const c = n.cine;
        if (!coincide(n.titulo, c.original, (c.generos || []).join(' '), n.texto)) continue;
        salida.push({ grupo: 'Películas', icono: 'pelicula', titulo: `${n.titulo}${c.anio ? ` (${c.anio})` : ''}`, sub: `${c.tipo === 'tv' ? 'Serie' : 'Película'} · ${EST[c.estado] || ''}`, der: c.calificacion ? `${c.calificacion}/10` : '', fecha: n.modificado, abrir: () => ctx.navegar(`bitacora/n/${n.id}`) });
        continue;
      }
      const adentro = textoArchivo(n);
      if (!coincide(n.titulo, n.texto, adentro, (n.etiquetas || []).join(' '), Object.values(n.props || {}).map(v => (typeof v === 'object' ? '' : v)).join(' '))) continue;
      const frag = coincide(n.titulo) ? '' : coincide(n.texto) ? fragmento(n.texto) : adentro ? fragmento(adentro) : '';
      if (n.archivo) {
        salida.push({ grupo: 'Archivos', icono: 'bitacora', titulo: n.titulo, sub: [d.nombreRuta(n.carpetaId), frag ? `"${frag}"` : ''].filter(Boolean).join(' · '), der: n.archivo.vence ? `vence ${diaCorto(n.archivo.vence)}` : cuando(n.creado), fecha: n.creado, abrir: () => ctx.navegar(`bitacora/n/${n.id}`) });
        continue;
      }
      salida.push({ grupo: 'Notas', icono: 'bitacora', titulo: n.titulo || 'Sin título', sub: [d.nombreRuta(n.carpetaId), frag ? `"${frag}"` : ''].filter(Boolean).join(' · '), der: cuando(n.modificado), fecha: n.modificado, abrir: () => ctx.navegar(`bitacora/n/${n.id}`) });
    }
    for (const c of d.carpetas.filter(x => !x.sistema && coincide(x.nombre))) {
      salida.push({ grupo: 'Notas', icono: 'bitacora', titulo: c.nombre, sub: `Carpeta · ${d.cantidad(c.id)} notas`, der: '', fecha: c.modificado, abrir: () => ctx.navegar(`bitacora/c/${c.id}`) });
    }
    return salida.slice(0, 80);
  },

  acciones: {
    // Para el Resumen: notas nuevas y películas/series vistas en cada período.
    async 'resumen-bitacora'({ periodos = [] } = {}, ctx) {
      const d = await crearModelo(ctx).cargar();
      const aDia = (ms) => { const f = new Date(ms); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
      return periodos.map(({ desde, hasta }) => {
        const notas = d.notas.filter(n => !n.cine && n.creado && aDia(n.creado) >= desde && aDia(n.creado) <= hasta).length;
        const vistas = d.notas.filter(n => n.cine && (n.cine.vistas || []).some(x => String(x).slice(0, 10) >= desde && String(x).slice(0, 10) <= hasta));
        const mejor = [...vistas].filter(n => n.cine.calificacion).sort((a, b) => b.cine.calificacion - a.cine.calificacion)[0];
        return { notas, peliculas: vistas.length, mejor: mejor ? { titulo: mejor.titulo, calificacion: mejor.cine.calificacion } : null };
      });
    },
    // Otros módulos pueden abrir una nota: ctx.pedir('abrir-nota', { id })
    'abrir-nota': ({ id } = {}, ctx) => ctx.navegar(`bitacora/n/${id}`),

    // Para las metas de Hábitos: qué carpetas hay y qué campos se pueden usar.
    // La Filmoteca aparece como una carpeta más, con campos propios (@estado, @tipo…).
    async 'metas-carpetas'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      const UTILES = ['opcion', 'opciones', 'sino', 'numero', 'calificacion', 'progreso', 'fecha'];
      const lista = d.carpetas.filter(c => !c.sistema).map(c => ({
        id: c.id, nombre: d.nombreRuta(c.id),
        campos: (c.campos || []).filter(f => UTILES.includes(f.tipo)).map(f => ({ id: f.id, nombre: f.nombre, tipo: f.tipo, opciones: (f.opciones || []).map(o => ({ id: o.id, nombre: o.nombre })) })),
      }));
      if (d.carpetas.some(c => c.sistema === 'filmoteca')) {
        lista.unshift({
          id: '@film', nombre: 'Filmoteca',
          fechas: [['@vista', 'En que la vi'], ['@agregada', 'En que la agregué']],
          campos: [
            { id: '@estado', nombre: 'Lista', tipo: 'opcion', opciones: [['paraver', 'Pendientes'], ['viendo', 'Viendo'], ['vista', 'Vista'], ['abandonada', 'Abandonada']].map(([id, nombre]) => ({ id, nombre })) },
            { id: '@tipo', nombre: 'Tipo', tipo: 'opcion', opciones: [{ id: 'movie', nombre: 'Película' }, { id: 'tv', nombre: 'Serie' }] },
            { id: '@calif', nombre: 'Calificación', tipo: 'calificacion' },
          ],
        });
      }
      return lista;
    },

    // Cuenta (o suma un campo de) las notas de una carpeta que cumplen una condición,
    // con fecha entre desde y hasta (AAAA-MM-DD).
    async 'metas-contar'({ carpetaId = '', campoId = '', valor = '', sumarId = '', fechaSegun = 'modificado', desde = '0000', hasta = '9999' } = {}, ctx) {
      const d = await crearModelo(ctx).cargar();
      const aDia = (ms) => { if (!ms) return ''; const f = new Date(ms); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; };
      const enRango = (x) => !!x && x >= desde && x <= hasta;
      if (carpetaId === '@film') {
        const film = new Set(d.carpetas.filter(c => c.sistema === 'filmoteca').map(c => c.id));
        let total = 0;
        for (const n of d.notas) {
          const c = n.cine;
          if (!c || !film.has(n.carpetaId)) continue;
          if (campoId === '@estado' && valor) { if (!(c.estado === valor || (valor === 'vista' && c.estado === 'volver'))) continue; }
          if (campoId === '@tipo' && valor && c.tipo !== valor) continue;
          const fechas = fechaSegun === '@vista' ? (c.vistas || []).map(x => String(x).slice(0, 10))
            : fechaSegun === '@agregada' ? [aDia(c.agregada || n.creado)]
              : [aDia(fechaSegun === 'creado' ? n.creado : n.modificado)];
          if (!fechas.some(enRango)) continue;
          total += sumarId === '@calif' ? (Number(c.calificacion) || 0) : 1;
        }
        return total;
      }
      const c = d.carpeta(carpetaId);
      if (!c) throw new Error('la carpeta ya no existe');
      const ids = new Set([c.id, ...d.descendientes(c.id).map(x => x.id)]);
      const campo = (c.campos || []).find(f => f.id === campoId);
      let total = 0;
      for (const n of d.notas) {
        if (!ids.has(n.carpetaId)) continue;
        const v = n.props?.[campoId];
        if (campo && valor) {
          if (campo.tipo === 'sino' && !!v !== (valor === 'si')) continue;
          if (campo.tipo === 'opcion' && v !== valor) continue;
          if (campo.tipo === 'opciones' && !(Array.isArray(v) && v.includes(valor))) continue;
        }
        const fecha = fechaSegun === 'creado' ? aDia(n.creado) : fechaSegun === 'modificado' || !fechaSegun ? aDia(n.modificado) : String(n.props?.[fechaSegun] || '').slice(0, 10);
        if (!enRango(fecha)) continue;
        total += sumarId ? (Number(n.props?.[sumarId]) || 0) : 1;
      }
      return total;
    },
  },

  // Un adjunto que estaba en espera ya se subió.
  async archivoSubido({ pendiente, archivo }, ctx) {
    await crearModelo(ctx).actualizarAdjunto(pendiente, archivo);
  },
};
