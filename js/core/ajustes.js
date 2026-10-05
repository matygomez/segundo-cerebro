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
import { VERSION, CARPETA_DRIVE } from '../config.js';
import { listaModulos } from './registro.js';

let pedidoInstalacion = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalacion = e; });

export function pantallaAjustes(contenedor) {
  const seccionDrive = h('section', { class: 'tarjeta' });
  const seccionDispositivo = h('section', { class: 'tarjeta' });

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

  async function dibujarDispositivo() {
    const total = await db.contarRegistros();
    const instalada = matchMedia('(display-mode: standalone)').matches;
    seccionDispositivo.replaceChildren(
      h('h2', {}, 'Este dispositivo'),
      h('dl', { class: 'datos' },
        h('dt', {}, 'Registros guardados'), h('dd', {}, String(total)),
        h('dt', {}, 'Módulos instalados'), h('dd', {}, listaModulos().map(m => m.nombre).join(', ')),
        h('dt', {}, 'Identificador'), h('dd', {}, await idDispositivo()),
        h('dt', {}, 'Versión de la app'), h('dd', {}, VERSION),
      ),
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
    seccionDispositivo,
  );
  dibujarDrive();
  dibujarDispositivo();

  const quitar = [
    escuchar('sync', dibujarDrive),
    escuchar('sesion', dibujarDrive),
    escuchar('datos', dibujarDispositivo),
  ];
  return () => quitar.forEach(q => q());
}
