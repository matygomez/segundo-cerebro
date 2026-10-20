// ─────────────────────────────────────────────────────────────
// Módulo Compras: lista, súper con escáner, despensa, comidas e informe.
//
// Guarda todo en sus propias colecciones (ver modelo.js). Del resto de
// la app solo pide cosas por mensaje: el gasto a Finanzas ('nuevo-gasto')
// y Gemini a Bitácora ('gemini-preguntar').
// ─────────────────────────────────────────────────────────────

import { crearModelo, cant, normal } from './modelo.js';
import { pantallaCompras, etiquetaVence } from './vistas.js';
import { cargarEstilos, fila } from './comun.js';

export default {
  id: 'compras',
  nombre: 'Compras',

  bloquesInicio(ctx) {
    return [{
      id: 'despensa',
      titulo: 'Compras',
      enlace: { texto: 'Compras ›', href: '#/compras' },
      ancho: 'mitad',
      async dibujar(contenedor) {
        cargarEstilos();
        const m = crearModelo(ctx);
        let turno = 0;
        const pintar = async () => {
          const mio = ++turno;
          const d = await m.cargar();
          if (mio !== turno) return;
          const vencen = d.porVencer(5).slice(0, 4);
          const { h } = ctx;
          contenedor.replaceChildren(h('div', { class: 'cp cp-ini' },
            vencen.length ? [h('div', { class: 'cp-grupo' }, 'Por vencer'), vencen.map(x => fila(ctx, { emoji: d.emojiDe(x.tipoId), nombre: d.nombreDe(x.tipoId), chico: cant(x.cantidad, d.baseDe(x.tipoId)), der: etiquetaVence(ctx, d.venceEn(x)), alTocar: () => ctx.navegar('compras/despensa') }))]
              : h('p', { class: 'cp-sub' }, 'Nada por vencer.'),
            h('a', { class: 'cp-ini-lista', href: '#/compras' }, d.lista.length ? `🛒 ${d.lista.length} cosa${d.lista.length === 1 ? '' : 's'} en la lista` : '🛒 La lista está vacía',
              d.ajustes.compraEnCurso ? h('b', {}, ' · compra en curso') : null)));
        };
        await pintar();
        let espera = null;
        const quitar = ctx.alCambiarDatos(() => { clearTimeout(espera); espera = setTimeout(pintar, 80); });
        return () => { turno++; quitar(); clearTimeout(espera); };
      },
    }];
  },

  botonesInicio(ctx) {
    return [{ id: 'lista', texto: 'Compras', icono: 'compras', alTocar: () => ctx.navegar('compras'), defecto: false }];
  },

  // Búsqueda general: tipos (lista / despensa), productos y recetas.
  async buscar(texto, ctx, { coincide }) {
    const d = await crearModelo(ctx).cargar();
    const r = [];
    for (const t of d.tipos) {
      if (!coincide(t.nombre)) continue;
      const enLista = d.lista.find(x => x.tipoId === t.id), stock = d.stock(t.id);
      r.push({ grupo: 'Compras', icono: 'compras', titulo: t.nombre, sub: [enLista ? `en la lista: ${cant(enLista.cantidad, t.base)}` : '', stock ? `en casa: ${cant(stock, t.base)}` : ''].filter(Boolean).join(' · ') || 'Compras', der: '', fecha: t.modificado,
        abrir: () => ctx.navegar(stock && !enLista ? 'compras/despensa' : 'compras') });
    }
    for (const p of d.productos) if (coincide(`${p.nombre} ${p.marca} ${p.codigo}`) && normal(p.nombre) !== normal(d.nombreDe(p.tipoId))) {
      r.push({ grupo: 'Compras', icono: 'compras', titulo: p.nombre, sub: `Producto · ${d.nombreDe(p.tipoId)}`, der: '', fecha: p.modificado, abrir: () => ctx.navegar(`compras/ajustes/${p.id}`) });
    }
    for (const x of d.recetas) if (coincide(x.nombre)) r.push({ grupo: 'Recetas', icono: 'compras', titulo: x.nombre, sub: `Receta · ${x.porciones || '?'} porciones`, der: '', fecha: x.modificado, abrir: () => ctx.navegar(`compras/comidas/${x.id}`) });
    return r;
  },

  acciones: {
    // Para el Resumen u otros: lo que vence pronto y cuántas cosas hay en la lista.
    async 'compras-resumen'(_, ctx) {
      const d = await crearModelo(ctx).cargar();
      return { enLista: d.lista.length, porVencer: d.porVencer(3).map(x => ({ nombre: d.nombreDe(x.tipoId), vence: x.vence })) };
    },
  },

  pantalla(contenedor, ctx, sub = []) {
    return pantallaCompras(contenedor, ctx, sub);
  },
};
