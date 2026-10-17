// ─────────────────────────────────────────────────────────────
// Módulo Resumen: revisión de la semana, resumen del mes y estadísticas.
//
// No guarda datos de los otros módulos: se los pide (ctx.pedir) a
// Tareas, Hábitos, Finanzas y Bitácora. Solo guarda tus revisiones.
// En el Inicio aparece un aviso una vez al terminar la semana (domingo)
// y otra al terminar el mes (día 1), hasta que lo abrís o lo cerrás.
// ─────────────────────────────────────────────────────────────

import { pantallaResumen, dibujarAviso, cargarEstilos } from './vistas.js';
import { crearModelo } from './datos.js';

export default {
  id: 'resumen',
  nombre: 'Resumen',

  bloquesInicio(ctx) {
    return [{
      id: 'aviso',
      titulo: 'Aviso de revisión (semana y mes)',
      ancho: 'completo',
      sinMarco: true,
      async dibujar(contenedor) {
        cargarEstilos();
        await dibujarAviso(ctx, contenedor);
        const quitar = ctx.alCambiarDatos(() => dibujarAviso(ctx, contenedor).then(() => {
          contenedor.closest('.ini-pieza')?.toggleAttribute('hidden', !contenedor.childElementCount);
        }));
        return quitar;
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
