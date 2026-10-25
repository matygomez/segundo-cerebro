// ─────────────────────────────────────────────────────────────
// Lo que la app de Android le pide a la app web: las ventanitas del
// panel de arriba, las tareas para el widget y los avisos, los pedidos
// que llegan del widget y de las notificaciones, "Compartir" y la
// sección de Ajustes. En el navegador nada de esto se activa.
// ─────────────────────────────────────────────────────────────

import * as android from './android.js';
import * as drive from './drive.js';
import { pedir, capturar, existeAccion } from './registro.js';
import { sincronizar } from './sincronizacion.js';
import { escuchar } from './eventos.js';
import { abrirFormulario } from './formularios.js';
import { h, aviso } from './ui.js';

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Antes de cerrar algo, que lo nuevo llegue a Drive (sin esperar para siempre).
async function subirADrive(maximo) {
  if (!drive.conectado()) return;
  await Promise.race([sincronizar(), esperar(maximo)]).catch(() => {});
}

// ── Ventanitas del panel (Finanzas, Nueva tarea, Anotar) ──
// Se abren encima de lo que estés haciendo: la página queda transparente
// y solo se ve el formulario. Al cerrarlo, Android cierra la ventanita.
export async function abrirVentana(cual) {
  const estilo = document.createElement('style');
  estilo.textContent = 'html, body { background: transparent !important; } #app { display: none !important; }';
  document.head.append(estilo);
  let guardado = false;
  try {
    if (cual === 'finanzas') guardado = await pedir('movimiento-rapido', { tipo: 'gasto' });
    else if (cual === 'tarea') guardado = await pedir('nueva-tarea-ventana');
    else if (cual === 'anotar') {
      const r = await abrirFormulario({ titulo: 'Anotar', textoGuardar: 'Guardar', campos: [{ id: 'texto', etiqueta: 'Anotá algo', tipo: 'parrafo', requerido: true }] });
      const texto = String(r?.texto || '').trim();
      if (texto) { aviso(`Guardado en ${await capturar(texto)}`); guardado = true; }
    }
  } catch (e) {
    aviso(e.message);
    await esperar(2500);
  }
  if (guardado) {
    await esperar(900);   // que se llegue a leer "Guardado"
    await enviarTareas().catch(() => {});   // el widget muestra la tarea nueva al instante
    await subirADrive(8000);
  }
  android.cerrarVentana(guardado);
}

// ── Tareas para el widget y los avisos ──
// Android guarda esta lista: con ella arma el widget y los avisos aunque la app esté cerrada.
function momentoAviso(t) {
  const texto = t.recordatorio || (t.fecha && t.hora ? `${t.fecha}T${t.hora}` : '');
  const ms = texto ? new Date(texto).getTime() : 0;   // hora del teléfono
  return Number.isFinite(ms) ? ms : 0;
}

async function enviarTareas() {
  if (!await existeAccion('tareas-android')) return;
  const { areas, tareas } = await pedir('tareas-android');
  for (const t of tareas) t.aviso = momentoAviso(t);
  android.guardarTareas({ areas, tareas });
}

let espera = null;
const programarEnvio = () => {
  clearTimeout(espera);
  espera = setTimeout(() => enviarTareas().catch(e => console.warn('Widget:', e)), 1500);
};

// ── Pedidos del widget y de las notificaciones ──
async function atenderAccion() {
  const pedido = android.tomarAccion();
  if (!pedido) return;
  const corte = pedido.indexOf(':');
  const tipo = corte < 0 ? pedido : pedido.slice(0, corte);
  const id = corte < 0 ? '' : pedido.slice(corte + 1);
  try {
    if (tipo === 'abrir-tarea') await pedir('abrir-tarea', { id });
    else if (tipo === 'completar') { location.hash = '#/tareas'; await pedir('tarea-completar', { id }); }
    else if (tipo === 'tareas') location.hash = '#/tareas';
    else if (tipo === 'compartir') await recibirCompartido();
    else if (tipo === 'actualizar') {
      aviso('Actualizando…');
      await subirADrive(15000);
      await enviarTareas();
      android.volver();   // vuelve a donde estabas
    }
  } catch (e) {
    aviso(e.message);
  }
}

// ── Compartir desde otra app ──
// Se guarda igual que lo que recibe la versión web (ver js/core/compartido.js)
// y se abre la Bitácora para ordenarlo.
async function recibirCompartido() {
  const d = android.tomarCompartido();
  if (!d) return;
  const c = await caches.open('sc-compartido');
  const base = new URL('./__compartido/', location.href).href;
  const archivos = [];
  for (const [i, a] of (d.archivos || []).entries()) {
    const bytes = Uint8Array.from(atob(a.base64 || ''), (x) => x.charCodeAt(0));
    if (!bytes.length) continue;
    const clave = `archivo-${i}`;
    await c.put(base + clave, new Response(new Blob([bytes], { type: a.tipo || '' })));
    archivos.push({ clave, nombre: a.nombre || `compartido-${Date.now()}`, tipo: a.tipo || '' });
  }
  const info = { titulo: d.titulo || '', texto: d.texto || '', url: d.url || '', archivos, llegada: Date.now() };
  await c.put(base + 'datos', new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json' } }));
  const destino = '#/bitacora/compartir';
  if (location.hash === destino) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = destino;
}

export function iniciarAndroid() {
  if (!android.esAndroid()) return;
  window.__cerebroAndroid.accion = () => atenderAccion();
  escuchar('datos', (e) => { if (e.modulo === 'tareas') programarEnvio(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') atenderAccion(); });
  programarEnvio();
  atenderAccion();
}

// ── Ajustes › App de Android ──
// Devuelve [sección, quitar] (quitar se llama al salir de Ajustes).
export function seccionAjustes() {
  const seccion = h('section', { class: 'tarjeta', hidden: !android.esAndroid() });
  if (!android.esAndroid()) return [seccion, () => {}];
  const interruptor = (on, etiqueta, alTocar) => h('button', {
    type: 'button', role: 'switch', class: `aj-switch${on ? ' on' : ''}`, 'aria-checked': String(on), 'aria-label': etiqueta, onclick: alTocar,
  });
  const fila = (nombre, nota, derecha) => h('div', { class: 'aj-fila' },
    h('span', { class: 'aj-nombre' }, nombre, nota ? h('small', { class: 'nota', style: 'display:block' }, nota) : null), derecha);
  const estadoTexto = (ok, si, no) => h('span', { class: ok ? 'aj-estado-ok' : 'aj-estado-mal' }, ok ? si : no);

  function dibujar() {
    const est = android.estadoAvisos();
    const aj = android.ajustesAvisos();
    if (!est || !aj) {
      seccion.replaceChildren(h('h2', {}, 'App de Android'),
        h('p', { class: 'nota' }, 'Para los avisos y los botones del panel hace falta la app nueva: tocá "Buscar actualización", más abajo.'));
      return;
    }
    const cambiar = (clave, valor) => { android.guardarAjustesAvisos({ ...aj, [clave]: valor }); dibujar(); };
    const hora = h('input', { type: 'time', value: aj.horaDiaria || '09:00', 'aria-label': 'Hora del aviso diario', onchange: (e) => cambiar('horaDiaria', e.target.value || '09:00') });
    seccion.replaceChildren(
      h('h2', {}, 'App de Android'),
      fila('Permiso de notificaciones', 'Sin él no llega ningún aviso', est.permiso
        ? estadoTexto(true, 'Activado')
        : h('button', { type: 'button', class: 'boton chico', onclick: () => android.pedirPermisoNotificaciones() }, 'Activar')),
      fila('Ahorro de batería', 'Puede atrasar los avisos', est.bateria
        ? estadoTexto(true, 'Sin límite')
        : h('button', { type: 'button', class: 'boton chico', onclick: () => android.abrirAjuste('bateria') }, 'Arreglar')),
      fila('Probar notificación', 'Manda una ahora', h('button', { type: 'button', class: 'boton chico', onclick: probar }, 'Probar')),
      fila('Aviso diario', 'Lo que vence hoy y lo vencido', h('span', { class: 'aj-dos' }, hora, interruptor(aj.diario, 'Aviso diario', () => cambiar('diario', !aj.diario)))),
      fila('Aviso a la hora de cada tarea', 'Solo las que tienen hora o recordatorio', interruptor(aj.porTarea, 'Aviso por tarea', () => cambiar('porTarea', !aj.porTarea))),
      fila('Notificación fija', 'Finanzas, Nueva tarea y Anotar siempre arriba', interruptor(aj.fija, 'Notificación fija', () => cambiar('fija', !aj.fija))),
      h('p', { class: 'nota' }, 'Botones del panel: bajá el panel de arriba, tocá el lápiz y arrastrá Finanzas, Nueva tarea y Anotar. ',
        'Widget: mantené apretada la pantalla de inicio › Widgets › Cerebro.'),
    );
  }

  function probar() {
    const r = android.probarNotificacion();
    if (r === 'ok') aviso('Listo: tendría que haber llegado "Las notificaciones funcionan".');
    else if (r === 'sin-permiso') { aviso('Falta el permiso de notificaciones.'); android.pedirPermisoNotificaciones(); }
    else if (r === 'apagadas') { aviso('Las notificaciones de Cerebro están apagadas en Android. Te llevo a prenderlas.'); android.abrirAjuste('notificaciones'); }
    else aviso('Para esto hace falta la app nueva: tocá "Buscar actualización".');
  }

  dibujar();
  // Al volver de los ajustes de Android, se muestra el estado nuevo.
  const alVolver = () => { if (document.visibilityState === 'visible') dibujar(); };
  document.addEventListener('visibilitychange', alVolver);
  return [seccion, () => document.removeEventListener('visibilitychange', alVolver)];
}
