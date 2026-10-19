// ─────────────────────────────────────────────────────────────
// Módulo Resumen: revisión de la semana, resumen del mes y estadísticas.
//
// No guarda datos de los otros módulos: se los pide (ctx.pedir) a
// Tareas, Hábitos, Finanzas y Bitácora. Solo guarda tus revisiones.
// En el Inicio, arriba de todo, un cuadro que se desliza: el aviso del mes,
// el de la semana y el resumen del día (desde la hora de Configurar).
// ─────────────────────────────────────────────────────────────

import { pantallaResumen, dibujarAviso, cargarEstilos } from './vistas.js';
import { crearModelo } from './datos.js';

export default {
  id: 'resumen',
  nombre: 'Resumen',

  bloquesInicio(ctx) {
    return [{
      id: 'aviso',
      titulo: 'Resumen (día, semana y mes)',
      ancho: 'completo',
      sinMarco: true,
      fijo: true, arriba: true,   // siempre se muestra, primero, debajo de la fecha
      async dibujar(contenedor) {
        cargarEstilos();
        await dibujarAviso(ctx, contenedor);
        // Se redibuja si cambian tus revisiones o lo de hoy (tareas, hábitos).
        let espera = null;
        const redibujar = () => { clearTimeout(espera); espera = setTimeout(() => dibujarAviso(ctx, contenedor).then(() => {
          contenedor.closest('.ini-pieza')?.toggleAttribute('hidden', !contenedor.childElementCount);
        }), 300); };
        const quitar = [ctx.alCambiarDatos(redibujar), ctx.alCambiarDatosDe('tareas', redibujar), ctx.alCambiarDatosDe('habitos', redibujar)];
        return () => { quitar.forEach(q => q?.()); clearTimeout(espera); contenedor._limpiar?.(); };
      },
    }];
  },

  acciones: {
    // El foco que escribiste en la revisión, para la semana que empieza en "lunes".
    async 'resumen-foco'({ lunes } = {}, ctx) {
      const [a, m, d] = String(lunes).split('-').map(Number);
      const f = new Date(a, m - 1, d - 7);
      const anterior = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
      return (await crearModelo(ctx).leer('semana', anterior))?.foco || '';
    },
  },

  pantalla(contenedor, ctx, sub = []) {
    return pantallaResumen(contenedor, ctx, sub);
  },
};
