// ─────────────────────────────────────────────────────────────
// Ajustes: conexión con Drive, estado de la sincronización,
// datos de este dispositivo e instalación de la app.
// Es parte del núcleo, no un módulo.
// ─────────────────────────────────────────────────────────────

import * as drive from './drive.js';
import * as db from './db.js';
import { sincronizar, estadoSync } from './sincronizacion.js';
import { escuchar } from './eventos.js';
import { h, icono, aviso, confirmar, fechaRelativa } from './ui.js';
import { idDispositivo } from './datos.js';
import { CARPETA_DRIVE } from '../config.js';
import { VERSION } from '../modulos.js';
import { listaModulos } from './registro.js';
import { navegacion, guardarNavegacion, ordenBarra, MAX_BARRA } from './preferencias.js';
import { seccionInicio } from './ajustes-inicio.js';

let pedidoInstalacion = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalacion = e; });

export function pantallaAjustes(contenedor) {
  const seccionDrive = h('section', { class: 'tarjeta' });
  const seccionDispositivo = h('section', { class: 'tarjeta' });
  const seccionModulos = h('section', { class: 'tarjeta' });
  const seccionBarra = h('section', { class: 'tarjeta' });
  const seccionIni = h('section', { class: 'tarjeta aj-inicio', id: 'ajustes-inicio' });

  // ── Módulos: visible u oculto, por separado en PC y celular ──
  const NOMBRES = { ajustes: 'Ajustes' };
  const ICONOS = { ajustes: 'ajustes' };
  for (const m of listaModulos()) { NOMBRES[m.id] = m.nombre; ICONOS[m.id] = m.icono; }
  const delMenu = () => listaModulos().filter(m => !m.oculto);

  function dibujarModulos() {
    const nav = navegacion();
    const segmento = (id, disp) => {
      const oculto = nav.ocultos[disp].includes(id);
      const elegir = async (ocultar) => {
        if (ocultar === oculto) return;
        nav.ocultos[disp] = ocultar ? [...nav.ocultos[disp], id] : nav.ocultos[disp].filter(x => x !== id);
        await guardarNavegacion(nav);
        aviso(`${NOMBRES[id]} ${ocultar ? 'oculto' : 'visible'} en ${disp === 'pc' ? 'la PC' : 'el celular'}`);
      };
      return h('span', { class: 'seg-vis', role: 'group', 'aria-label': `${NOMBRES[id]} en ${disp === 'pc' ? 'PC' : 'celular'}` },
        h('button', { type: 'button', class: oculto ? '' : 'activo', 'aria-pressed': String(!oculto), onclick: () => elegir(false) }, 'Visible'),
        h('button', { type: 'button', class: oculto ? 'activo oculto' : '', 'aria-pressed': String(oculto), onclick: () => elegir(true) }, 'Oculto'));
    };
    seccionModulos.replaceChildren(
      h('h2', {}, 'Módulos'),
      h('p', { class: 'nota' }, 'Ocultar no borra nada: el módulo sigue guardando sus datos y vuelve tal cual al mostrarlo. Se elige por separado en PC y en celular.'),
      h('div', { class: 'aj-tabla' },
        h('div', { class: 'aj-fila aj-enc' }, h('span', {}), h('span', { class: 'aj-col' }, 'PC'), h('span', { class: 'aj-col' }, 'Celular')),
        delMenu().map(m => h('div', { class: 'aj-fila' },
          h('span', { class: 'aj-nombre' }, icono(m.icono), m.nombre),
          m.id === 'home'
            ? h('span', { class: 'nota aj-siempre' }, 'siempre visible')
            : [h('span', { class: 'aj-col' }, segmento(m.id, 'pc')), h('span', { class: 'aj-col' }, segmento(m.id, 'cel'))]))));
  }

  // ── Barra de abajo del celular ──
  function dibujarBarra() {
    const nav = navegacion();
    const todos = [...delMenu().map(m => m.id), 'ajustes'];
    const lista = ordenBarra(todos);
    const ocultoCel = (id) => id !== 'ajustes' && nav.ocultos.cel.includes(id);
    const prendidos = () => lista.filter(x => x.on && !ocultoCel(x.id)).length;
    const guardar = async () => { nav.barra = lista.map(x => ({ id: x.id, on: x.on })); await guardarNavegacion(nav); };
    seccionBarra.replaceChildren(
      h('h2', {}, 'Barra de abajo ', h('span', { class: 'nota' }, '(celular)')),
      h('p', { class: 'nota' }, `Elegí qué aparece y en qué orden. Hasta ${MAX_BARRA}. Si sacás Ajustes, lo tenés tocando el logo de arriba.`),
      h('div', { class: 'aj-tabla' }, lista.map((x, i) => {
        const oculto = ocultoCel(x.id);
        const fijo = x.id === 'home';
        const lleno = !x.on && prendidos() >= MAX_BARRA;
        return h('div', { class: 'aj-fila' },
          h('span', { class: 'aj-nombre' }, icono(ICONOS[x.id] || 'ajustes'), NOMBRES[x.id] || x.id, oculto ? h('small', { class: 'nota' }, ' (oculto en celular)') : null),
          h('span', { class: 'aj-acciones' },
            h('button', { type: 'button', class: 'aj-flecha', 'aria-label': `Subir ${NOMBRES[x.id]}`, disabled: i === 0, onclick: async () => { [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; await guardar(); } }, '↑'),
            h('button', { type: 'button', class: 'aj-flecha', 'aria-label': `Bajar ${NOMBRES[x.id]}`, disabled: i === lista.length - 1, onclick: async () => { [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]]; await guardar(); } }, '↓'),
            h('button', {
              type: 'button', role: 'switch', class: `aj-switch${x.on && !oculto ? ' on' : ''}`, 'aria-checked': String(x.on && !oculto),
              'aria-label': `${NOMBRES[x.id]} en la barra`, disabled: fijo || oculto || lleno,
              title: fijo ? 'Inicio está siempre' : lleno ? `Ya hay ${MAX_BARRA}` : '',
              onclick: async () => { x.on = !x.on; await guardar(); },
            })));
      })));
  }

  async function dibujarDrive() {
    const s = estadoSync();
    const e = drive.estado();
    const filas = [];

    if (e === 'sin-configurar') {
      filas.push(
        h('p', {}, 'La app todavía no está vinculada a Google. Por ahora todo se guarda solo en este dispositivo.'),
        h('p', { class: 'nota' }, 'Para activarlo hay que completar GOOGLE_CLIENT_ID en js/config.js. Es el próximo paso de la guía.'));
    } else {
      const textoEstado = {
        conectado: 'Conectada',
        desconectado: 'Sin conectar',
      }[e];
      filas.push(h('dl', { class: 'datos' },
        h('dt', {}, 'Cuenta de Google'), h('dd', {}, textoEstado),
        h('dt', {}, 'Carpeta en Drive'), h('dd', {}, CARPETA_DRIVE),
        h('dt', {}, 'Última sincronización'), h('dd', {}, fechaRelativa(s.ultima)),
        h('dt', {}, 'Cambios sin subir'), h('dd', {}, String(s.pendientes)),
        s.archivos ? [h('dt', {}, 'Archivos sin subir'), h('dd', {}, String(s.archivos))] : null,
      ));
      if (s.fase === 'error') filas.push(h('p', { class: 'nota error' }, icono('alerta'), ' ', s.error));
      if (s.fase === 'sin-internet') filas.push(h('p', { class: 'nota' }, 'Sin internet. Los cambios se suben solos cuando vuelva la conexión.'));

      const botones = h('div', { class: 'botonera' });
      if (e === 'conectado') {
        botones.append(
          h('button', { class: 'boton principal', disabled: s.fase === 'sincronizando', onclick: () => sincronizar() },
            icono('girar'), s.fase === 'sincronizando' ? 'Sincronizando…' : 'Sincronizar ahora'),
          h('button', {
            class: 'boton', onclick: async () => {
              if (await confirmar('¿Desconectar la cuenta de Google? Tus datos siguen en Drive y en este dispositivo.', { si: 'Desconectar' })) drive.desconectar();
            },
          }, 'Desconectar'));
      } else {
        botones.append(h('button', {
          class: 'boton principal', onclick: async () => {
            try { await drive.conectar(); aviso('Cuenta conectada'); } catch (err) { aviso(err.message); }
          },
        }, icono('nube'), s.ultima ? 'Reconectar' : 'Conectar con Google'));
      }
      filas.push(botones);
    }
    seccionDrive.replaceChildren(h('h2', {}, 'Google Drive'), ...filas);
  }

  // ── Actualizar la app ──
  const botonBuscar = h('button', { type: 'button', class: 'boton chico', onclick: buscarActualizacion }, 'Buscar actualización');
  async function buscarActualizacion() {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) { aviso('En este navegador la app no se guarda para usar sin conexión: siempre abre la última versión.'); return; }
    botonBuscar.disabled = true; botonBuscar.textContent = 'Buscando…';
    try {
      await reg.update();
      // Si se está bajando, esperar a que termine.
      const nuevo = reg.installing;
      if (nuevo) await new Promise((ok) => { const ver = () => { if (nuevo.state === 'installed' || nuevo.state === 'redundant') ok(); }; nuevo.addEventListener('statechange', ver); ver(); });
      if (reg.waiting) { aviso('Instalando la versión nueva…'); reg.waiting.postMessage('actualizar'); return; }   // la app se recarga sola
      aviso(`Ya tenés la última versión (${VERSION}).`);
    } catch {
      aviso('No se pudo buscar (¿sin internet?). Probá de nuevo en un rato.');
    } finally {
      botonBuscar.disabled = false; botonBuscar.textContent = 'Buscar actualización';
    }
  }
  // Borra la copia guardada de la app y la vuelve a bajar. Los datos no se tocan.
  async function forzarActualizacion() {
    if (!navigator.onLine) { aviso('Necesitás internet para forzar la actualización.'); return; }
    if (!await confirmar('Se borra la copia guardada de la app y se vuelve a bajar de internet. Tus datos no se tocan.', { si: 'Forzar actualización' })) return;
    try {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      for (const k of await caches.keys()) if (k !== 'sc-imagenes' && k !== 'sc-fuentes' && k !== 'sc-compartido') await caches.delete(k);
    } catch (e) { console.warn(e); }
    location.reload();
  }

  async function dibujarDispositivo() {
    const total = await db.contarRegistros();
    const instalada = matchMedia('(display-mode: standalone)').matches;
    seccionDispositivo.replaceChildren(
      h('h2', {}, 'Este dispositivo'),
      h('dl', { class: 'datos' },
        h('dt', {}, 'Registros guardados'), h('dd', {}, String(total)),
        h('dt', {}, 'Módulos instalados'), h('dd', {}, listaModulos().map(m => m.nombre).join(', ')),
        h('dt', {}, 'Identificador'), h('dd', {}, await idDispositivo()),
        h('dt', {}, 'Versión de la app'), h('dd', {}, h('span', { class: 'aj-version' }, VERSION, botonBuscar)),
      ),
      'serviceWorker' in navigator ? h('p', { class: 'aj-forzar' }, h('button', { type: 'button', class: 'aj-link', onclick: forzarActualizacion }, 'Forzar actualización')) : null,
      h('div', { class: 'botonera' },
        !instalada && pedidoInstalacion ? h('button', {
          class: 'boton principal', onclick: async () => {
            pedidoInstalacion.prompt();
            await pedidoInstalacion.userChoice;
            pedidoInstalacion = null;
            dibujarDispositivo();
          },
        }, icono('descargar'), 'Instalar la app') : null,
        h('button', {
          class: 'boton peligro', onclick: async () => {
            const s = estadoSync();
            const aviso1 = s.pendientes
              ? `Hay ${s.pendientes} cambios que todavía no se subieron a Drive y se van a perder.`
              : 'Lo que ya está en Drive no se toca y vuelve a bajar al conectar.';
            if (!await confirmar(`¿Borrar todos los datos de este dispositivo? ${aviso1}`, { si: 'Borrar datos', peligro: true })) return;
            await db.borrarTodo();
            drive.desconectar();
            location.reload();
          },
        }, 'Borrar datos de este dispositivo')),
    );
  }

  contenedor.replaceChildren(
    h('header', { class: 'cabecera-pantalla' }, h('h1', {}, 'Ajustes')),
    seccionDrive,
    seccionModulos,
    seccionBarra,
    seccionIni,
    seccionDispositivo,
  );
  const quitarInicio = seccionInicio(seccionIni);
  // #/ajustes/inicio (o un link desde el Inicio) lleva directo a esta sección.
  if (/inicio$/.test(location.hash)) setTimeout(() => seccionIni.scrollIntoView({ block: 'start' }), 300);
  dibujarDrive();
  dibujarModulos();
  dibujarBarra();
  dibujarDispositivo();

  const quitar = [
    escuchar('sync', dibujarDrive),
    escuchar('sesion', dibujarDrive),
    escuchar('datos', dibujarDispositivo),
    escuchar('preferencias', () => { dibujarModulos(); dibujarBarra(); }),
  ];
  return () => { quitar.forEach(q => q()); quitarInicio(); };
}
