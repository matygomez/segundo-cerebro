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

import { crearModelo, espejoDe, sincronizarRecordatorios } from './modelo.js';
import {
  cargarEstilos, esPC, arbol, pantallaInicio, pantallaCarpeta, pantallaEtiqueta, pantallaBuscar,
  pantallaPapelera, pantallaAjustes, recibirCompartido,
} from './vistas.js';
import { vistaNota, cuerpoLectura } from './nota.js';
import { renderBase, pantallaCampos } from './base.js';

export default {
  id: 'bitacora',
  nombre: 'Bitácora',

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
      else if (que === 'c' && resto[0]) { actual = `c:${resto[0]}`; pantallaCarpeta(ctx, m, d, resto[0], main, { renderBase: (zona, c) => renderBase(ctx, m, d, c, zona) }); }
      else if (que === 'bandeja') { actual = 'c:'; pantallaCarpeta(ctx, m, d, '', main, {}); }
      else if (que === 'e' && resto.length) { const tag = decodeURIComponent(resto.join('/')); actual = `e:${tag}`; pantallaEtiqueta(ctx, m, d, tag, main); }
      else if (que === 'buscar') { actual = 'buscar'; vista = pantallaBuscar(ctx, m, d, main); }
      else if (que === 'papelera') { actual = 'papelera'; pantallaPapelera(ctx, m, d, main); }
      else if (que === 'ajustes') { actual = 'ajustes'; pantallaAjustes(ctx, m, d, main); }
      else { actual = 'inicio'; pantallaInicio(ctx, m, d, main, { renderNota: (n) => cuerpoLectura(ctx, m, d, n) }); }
      if (actual.startsWith('n:')) { const n = d.nota(actual.slice(2)); actual = n ? `c:${n.carpetaId || ''}` : actual; }
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
