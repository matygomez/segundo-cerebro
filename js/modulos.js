// ─────────────────────────────────────────────────────────────
// Registro de módulos y versión de la app.
// (Separado de config.js para que las actualizaciones no pisen
// tus claves de Google.)
//
// Para sumar un módulo: crear su carpeta en /modules y agregar una
// línea acá. El orden de la lista es el orden del menú.
// ─────────────────────────────────────────────────────────────

export const VERSION = '0.10.3';

export const MODULOS = [
  { id: 'home', nombre: 'Inicio', icono: 'inicio', archivo: './modules/home/modulo.js' },
  { id: 'tareas', nombre: 'Tareas', icono: 'tareas', archivo: './modules/tareas/modulo.js' },
  { id: 'finanzas', nombre: 'Finanzas', icono: 'finanzas', archivo: './modules/finanzas/modulo.js' },
];
