// ─────────────────────────────────────────────────────────────
// Configuración general de la app.
//
// Lo único que vas a completar a mano es GOOGLE_CLIENT_ID
// (te guío paso a paso). Mientras esté vacío, la app funciona
// igual, pero guarda todo solo en el dispositivo.
// ─────────────────────────────────────────────────────────────

export const GOOGLE_CLIENT_ID = '732759481417-3vdaji6jru6dp2ggbrfhds8tjvt2b8dt.apps.googleusercontent.com';

// Selector de archivos de Google (para adjuntar archivos que ya están en tu Drive).
// GOOGLE_API_KEY se crea en Google Cloud (te guío). GOOGLE_APP_ID es el número
// de tu proyecto: la parte numérica del principio del GOOGLE_CLIENT_ID.
export const GOOGLE_API_KEY = 'AIzaSyCYCTPwpQn8kk4IdXxrPRe-ovXELsR-QtQ';
export const GOOGLE_APP_ID = '732759481417';

// Carpeta que la app crea en tu Drive.
export const CARPETA_DRIVE = 'Segundo Cerebro';

// Versión visible en Ajustes. Se sube en cada actualización.
export const VERSION = '0.3.0';

// Registro de módulos.
// Para sumar un módulo: crear su carpeta en /modules y agregar una línea acá.
// El orden de la lista es el orden del menú. Las rutas son relativas a index.html.
export const MODULOS = [
  { id: 'home', nombre: 'Inicio', icono: 'inicio', archivo: './modules/home/modulo.js' },
  { id: 'tareas', nombre: 'Tareas', icono: 'tareas', archivo: './modules/tareas/modulo.js' },
];
