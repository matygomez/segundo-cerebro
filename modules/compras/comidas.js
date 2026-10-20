// ─────────────────────────────────────────────────────────────
// Compras › Comidas: programadas del mes, lo que falta para hacerlas
// (de la más próxima a la última) y el Recetario.
//   #/compras/comidas          todo junto
//   #/compras/comidas/<id>     receta, sola en la pantalla
//   #/compras/comidas/nueva    cargar una receta (escribirla o pegarla)
// ─────────────────────────────────────────────────────────────

import { cant, cuando, hoyISO, normal, num, aBase, baseDeUnidad, UNIDADES_RECETA, MESES, adivinar } from './modelo.js';
import { poner, fila, hoja } from './comun.js';

const ui = { texto: '', programando: null, faltaAbierto: null, sacados: new Set(), porciones: {}, modo: 'mano', pegado: '', armada: null };

export function pintarComidas(cuerpo, ctx, m, d, repintar, sub) {
  if (sub[1] === 'nueva') return pintarNueva(cuerpo, ctx, m, d, repintar);
  if (sub[1]) return pintarReceta(cuerpo, ctx, m, d, repintar, sub[1]);
  const { h } = ctx;
  const hoy = hoyISO(), mes = hoy.slice(0, 7);
  const delMes = d.comidas.filter(c => c.fecha.slice(0, 7) === mes || (c.fecha >= hoy && !c.hecha));
  const falta = d.faltaComidas();

  const hice = async (c) => {
    const rec = d.receta(c.recetaId);
    if (!rec) return;
    const ings = d.necesita(rec, c.porciones);
    // Se puede corregir cuánto se usó de cada cosa antes de descontarlo.
    const r = ings.length ? await ctx.formulario({ titulo: `La hice: ${rec.nombre}`, textoGuardar: 'Descontar de la despensa',
      campos: ings.map((i, k) => ({ id: `i${k}`, etiqueta: `${d.nombreDe(i.tipoId)} (${d.baseDe(i.tipoId) === 'u.' ? 'unidades' : d.baseDe(i.tipoId)})`, tipo: 'numero', valor: Math.round(i.enBase * 1000) / 1000 })) }) : {};
    if (!r) return;
    for (const [k, i] of ings.entries()) if (r[`i${k}`]) await m.descontar(d, i.tipoId, r[`i${k}`]);
    await m.col.comidas.actualizar(c.id, { hecha: true });
    await m.col.recetas.actualizar(rec.id, { veces: (Number(rec.veces) || 0) + 1 });
    ctx.aviso(`${rec.nombre}: descontado de la despensa`);
  };
  // Copia las comidas del mes pasado al mismo día de este mes (solo las que quedan por delante).
  const repetir = async () => {
    const f = new Date(); f.setMonth(f.getMonth() - 1);
    const pasado = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    let n = 0;
    for (const c of d.comidas.filter(c => c.fecha.slice(0, 7) === pasado)) {
      const fecha = `${mes}-${c.fecha.slice(8)}`;
      if (fecha < hoy || d.comidas.some(x => x.fecha === fecha && x.recetaId === c.recetaId)) continue;
      await m.col.comidas.crear({ fecha, recetaId: c.recetaId, porciones: c.porciones, hecha: false }); n++;
    }
    ctx.aviso(n ? `${n} comidas copiadas` : 'No había comidas para copiar');
  };
  const sumarFaltantes = async () => {
    let n = 0;
    for (const f of falta) { if (ui.sacados.has(f.tipoId)) continue; await m.agregarALista(d, d.tipo(f.tipoId), { cantidad: f.cantidad }); n++; }
    ctx.aviso(`${n} cosas sumadas a la lista`);
  };
  const programar = async (rec, fecha, porciones) => {
    if (!fecha) { ctx.aviso('Elegí la fecha'); return; }
    await m.col.comidas.crear({ fecha, recetaId: rec.id, porciones, hecha: false });
    ui.programando = null;
    ctx.aviso(`${rec.nombre} programada para ${cuando(fecha)}`);
  };

  const t = normal(ui.texto);
  const recetas = [...d.recetas].sort((a, b) => (Number(b.veces) || 0) - (Number(a.veces) || 0) || a.nombre.localeCompare(b.nombre))
    .filter(r => !t || normal(`${r.nombre} ${(r.ingredientes || []).map(i => i.nombre).join(' ')}`).includes(t));
  const listaRecetas = h('div', {});
  const dibujarRecetas = () => poner(listaRecetas, recetas.length ? recetas.map(r => {
    const prog = ui.programando === r.id;
    const fecha = h('input', { type: 'date', value: hoy, 'aria-label': 'Fecha' });
    let porciones = r.porciones || 2;
    const nP = h('b', {}, String(porciones));
    return [
      h('div', { class: 'cp-rec' }, h('span', { class: 'cp-em2' }, r.emoji || '🍽️'),
        h('a', { class: 'tx', href: `#/compras/comidas/${r.id}` }, h('b', {}, r.nombre), h('small', {}, `${r.porciones || '?'} porciones · ${(r.ingredientes || []).length} ingredientes · la hiciste ${r.veces || 0} ${Number(r.veces) === 1 ? 'vez' : 'veces'}`)),
        h('button', { type: 'button', class: 'cp-bt ch', onclick: () => { ui.programando = prog ? null : r.id; repintar(); } }, '📅 Programar')),
      prog ? h('div', { class: 'cp-prog' }, fecha,
        h('span', { class: 'cp-stp chico' }, h('button', { type: 'button', onclick: () => { porciones = Math.max(1, porciones - 1); nP.textContent = porciones; } }, '−'), nP, h('button', { type: 'button', onclick: () => { porciones++; nP.textContent = porciones; } }, '+')),
        h('button', { type: 'button', class: 'cp-bt ch p', onclick: () => programar(r, fecha.value, porciones) }, 'Agregar')) : null,
    ];
  }) : h('p', { class: 'cp-sub' }, d.recetas.length ? 'Ninguna receta con eso.' : 'Todavía no hay recetas. Cargá la primera con "+ Receta nueva".'));
  dibujarRecetas();
  const f0 = new Date();

  poner(cuerpo, h('div', { class: 'cp-cols' },
    h('div', { class: 'cp-col' },
      h('section', { class: 'cp-card apretada' }, h('h3', {}, `Programadas · ${MESES[f0.getMonth()]}`, h('small', {}, `${delMes.length} comidas`)),
        delMes.length ? delMes.map(c => {
          const rec = d.receta(c.recetaId), f = c.fecha.split('-');
          return h('div', { class: `cp-plato${c.hecha ? ' hecho' : ''}` },
            h('span', { class: 'dia' }, cuando(c.fecha).split(' ')[0], h('b', {}, String(Number(f[2])))),
            h('a', { class: 'tx', href: rec ? `#/compras/comidas/${rec.id}` : null }, h('b', {}, rec?.nombre || 'Receta borrada'), h('small', {}, `${c.porciones} porciones${c.hecha ? ' · hecha, se descontó de la despensa' : ''}`)),
            c.hecha ? h('span', { class: 'cp-tagc gris' }, '✓')
              : [h('button', { type: 'button', class: 'cp-bt ch', onclick: () => hice(c) }, 'La hice'),
                h('button', { type: 'button', class: 'cp-x', 'aria-label': 'Sacar', title: 'Sacar', onclick: () => m.col.comidas.borrar(c.id) }, '✕')]);
        }) : h('p', { class: 'cp-sub' }, 'No hay comidas programadas. Elegí una receta y tocá "📅 Programar".'),
        h('button', { type: 'button', class: 'cp-bt ch izq', onclick: repetir }, `Repetir las de ${MESES[(f0.getMonth() + 11) % 12]}`)),
      h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Para las programadas te falta', h('small', {}, 'de la más próxima a la última')),
        falta.length ? falta.map(f => {
          const ab = ui.faltaAbierto === f.tipoId, c0 = f.comidas[0], mas = f.comidas.length - 1;
          return [
            fila(ctx, {
              emoji: d.emojiDe(f.tipoId), nombre: d.nombreDe(f.tipoId),
              chico: [`${cuando(c0.fecha)} · ${c0.nombre}`, mas ? h('span', { class: 'lat' }, ` y ${mas} comida${mas > 1 ? 's' : ''} más`) : null],
              antes: h('input', { type: 'checkbox', checked: !ui.sacados.has(f.tipoId), 'aria-label': 'Sumar a la lista', onclick: (e) => e.stopPropagation(), onchange: (e) => { e.target.checked ? ui.sacados.delete(f.tipoId) : ui.sacados.add(f.tipoId); } }),
              der: h('span', { class: 'cp-q' }, cant(f.cantidad, d.baseDe(f.tipoId))),
              alTocar: mas ? () => { ui.faltaAbierto = ab ? null : f.tipoId; repintar(); } : null,
            }),
            ab ? h('div', { class: 'cp-razon col' }, f.comidas.map(c => h('span', {}, `${cuando(c.fecha)} · ${c.nombre}`))) : null,
          ];
        }) : h('p', { class: 'cp-sub' }, d.proximas().length ? '¡Tenés todo para las comidas programadas!' : 'Cuando programes comidas, acá ves lo que te falta.'),
        falta.length ? h('button', { type: 'button', class: 'cp-bt p', onclick: sumarFaltantes }, 'Sumar a la lista de compras') : null)),
    h('div', { class: 'cp-col' },
      h('section', { class: 'cp-card apretada' }, h('h3', {}, 'Recetario', h('small', {}, `${d.recetas.length} recetas`)),
        h('input', { type: 'search', id: 'cp-buscar-rec', class: 'cp-buscar', placeholder: 'Buscar receta o ingrediente…', value: ui.texto, oninput: (e) => { ui.texto = e.target.value; repintar(); } }),
        listaRecetas,
        h('a', { class: 'cp-bt ch p izq', href: '#/compras/comidas/nueva' }, '+ Receta nueva')))));
}

// Estado de un ingrediente frente a la despensa: "tenés 2 kg ✓" o "faltan 200 g".
function estado(d, i, enBase) {
  const base = d.baseDe(i.tipoId), stock = d.stock(i.tipoId);
  if (!i.tipoId) return { texto: '', ok: true };
  if (baseDeUnidad(i.unidad) !== base) return stock > 0 ? { texto: `tenés ${cant(stock, base)}`, ok: true } : { texto: 'falta', ok: false };
  if (stock >= enBase - 1e-9) return { texto: `tenés ${cant(stock, base)} ✓`, ok: true };
  return { texto: stock > 0 ? `faltan ${cant(enBase - stock, base)}` : 'falta', ok: false };
}

function pintarReceta(cuerpo, ctx, m, d, repintar, id) {
  const { h } = ctx;
  const r = d.receta(id);
  const volver = h('a', { class: 'cp-bt ch izq', href: '#/compras/comidas' }, '‹ Comidas');
  if (!r) { poner(cuerpo, h('div', { class: 'cp-angosto' }, volver, h('p', { class: 'cp-sub' }, 'Esta receta ya no existe.'))); return; }
  const porciones = ui.porciones[id] || r.porciones || 1;
  const k = porciones / (r.porciones || 1);
  const ings = r.ingredientes || [];
  const guardarIngs = (lista) => m.col.recetas.actualizar(r.id, { ingredientes: lista });

  const agregarIng = async () => {
    const x = await ctx.formulario({ titulo: 'Ingrediente', textoGuardar: 'Agregar', campos: [
      { id: 'nombre', etiqueta: 'Qué (te sugiere tus productos)', tipo: 'texto', requerido: true },
      { id: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', requerido: true },
      { id: 'unidad', etiqueta: 'Unidad', tipo: 'seleccion', opciones: UNIDADES_RECETA, valor: 'g' }] });
    if (!x) return;
    const tipo = d.tipoPorNombre(x.nombre) || await m.asegurarTipo(d, x.nombre[0].toUpperCase() + x.nombre.slice(1), { base: baseDeUnidad(x.unidad) });
    // Se guarda para las porciones originales de la receta.
    await guardarIngs([...ings, { tipoId: tipo.id, nombre: tipo.nombre, cantidad: Math.round(x.cantidad / k * 1000) / 1000, unidad: x.unidad }]);
  };
  const programar = async () => {
    const x = await ctx.formulario({ titulo: `Programar ${r.nombre}`, textoGuardar: 'Programar', campos: [
      { id: 'fecha', etiqueta: 'Día', tipo: 'fecha', valor: 'hoy', requerido: true }, { id: 'porciones', etiqueta: 'Porciones', tipo: 'numero', valor: porciones }] });
    if (!x) return;
    await m.col.comidas.crear({ fecha: x.fecha, recetaId: r.id, porciones: x.porciones || porciones, hecha: false });
    ctx.aviso(`Programada para ${cuando(x.fecha)}`);
  };
  const borrar = async () => {
    if (!(await ctx.confirmar(`¿Borrar la receta "${r.nombre}"?`, { si: 'Borrar', peligro: true }))) return;
    await m.col.recetas.borrar(r.id);
    ctx.navegar('compras/comidas');
  };
  const sumarFalta = async () => {
    let n = 0;
    for (const i of ings) {
      if (!i.tipoId || baseDeUnidad(i.unidad) !== d.baseDe(i.tipoId)) continue;
      const falta = aBase(i.cantidad, i.unidad) * k - d.stock(i.tipoId);
      if (falta > 1e-9) { await m.agregarALista(d, d.tipo(i.tipoId), { cantidad: Math.round(falta * 1000) / 1000 }); n++; }
    }
    ctx.aviso(n ? `${n} cosas sumadas a la lista` : 'Tenés todo');
  };

  poner(cuerpo, h('div', { class: 'cp-angosto' }, volver,
    h('section', { class: 'cp-card' },
      h('h3', {}, h('input', { class: 'cp-emoji', value: r.emoji || '🍽️', maxlength: 4, 'aria-label': 'Emoji', onchange: (e) => m.col.recetas.actualizar(r.id, { emoji: e.target.value.trim() }) }),
        h('input', { class: 'cp-titulo-in', value: r.nombre, 'aria-label': 'Nombre de la receta', onchange: (e) => e.target.value.trim() && m.col.recetas.actualizar(r.id, { nombre: e.target.value.trim() }) })),
      h('div', { class: 'cp-fila' },
        h('label', { class: 'cp-fila sin-salto' }, 'Porciones', h('span', { class: 'cp-stp' },
          h('button', { type: 'button', onclick: () => { ui.porciones[id] = Math.max(1, porciones - 1); repintar(); } }, '−'), h('b', {}, String(porciones)),
          h('button', { type: 'button', onclick: () => { ui.porciones[id] = porciones + 1; repintar(); } }, '+'))),
        h('button', { type: 'button', class: 'cp-bt ch p', onclick: programar }, '📅 Programar')),
      porciones !== (r.porciones || 1) ? h('p', { class: 'cp-sub' }, `La receta es para ${r.porciones}; las cantidades están calculadas para ${porciones}.`) : null,
      h('span', { class: 'cp-et' }, 'Ingredientes'),
      ings.length ? ings.map((i, n) => {
        const enBase = aBase(i.cantidad, i.unidad) * k, e = estado(d, i, enBase);
        return h('div', { class: 'cp-ing' }, h('span', { class: 'cp-em' }, i.tipoId ? d.emojiDe(i.tipoId) : adivinar(i.nombre).emoji),
          h('span', { class: 'cp-n' }, i.tipoId ? d.nombreDe(i.tipoId) : i.nombre),
          h('input', { inputmode: 'decimal', value: String(Math.round(i.cantidad * k * 100) / 100).replace('.', ','), 'aria-label': `Cantidad de ${i.nombre}`,
            onchange: (ev) => guardarIngs(ings.map((x, j) => j === n ? { ...x, cantidad: Math.round(num(ev.target.value) / k * 1000) / 1000 } : x)) }),
          h('span', { class: 'u' }, i.unidad),
          h('span', { class: `est ${e.ok ? 'verde' : 'lat'}` }, e.texto),
          h('button', { type: 'button', class: 'cp-x', 'aria-label': `Quitar ${i.nombre}`, onclick: () => guardarIngs(ings.filter((_, j) => j !== n)) }, '✕'));
      }) : h('p', { class: 'cp-sub' }, 'Sin ingredientes todavía.'),
      h('div', { class: 'cp-fila' },
        h('button', { type: 'button', class: 'cp-bt ch', onclick: agregarIng }, '+ Ingrediente'),
        ings.length ? h('button', { type: 'button', class: 'cp-bt ch', onclick: sumarFalta }, 'Lo que falta → a la lista') : null),
      h('span', { class: 'cp-et' }, 'Preparación'),
      h('textarea', { id: 'cp-prep', rows: 6, placeholder: '1. …', onchange: (e) => m.col.recetas.actualizar(r.id, { preparacion: e.target.value }) }, r.preparacion || ''),
      h('p', { class: 'cp-sub' }, 'Al tocar "La hice" se descuentan estos ingredientes de la despensa (y podés corregir si usaste otra cantidad).'),
      h('button', { type: 'button', class: 'cp-bt ch peligro izq', onclick: borrar }, 'Borrar receta'))));
}

// ── Receta nueva: escribirla, o pegar texto / link y que Gemini la arme ──

const PEDIDO = (texto) => `Sos un asistente de cocina argentino. De este texto sacá la receta y devolvé SOLO un JSON, sin explicaciones, con esta forma:
{"nombre": "…", "porciones": 4, "ingredientes": [{"nombre": "…", "cantidad": 200, "unidad": "g"}], "preparacion": "1. …\\n2. …"}
Reglas: "unidad" es una de g, kg, ml, L, u. (pasá tazas, cucharadas, etc. a g o ml aproximados; "una cebolla" = 1 u.). "nombre" del ingrediente corto y sin marca (ej.: "Leche entera", "Cebolla"). Si no dice porciones, estimalas.
Texto:
${texto.slice(0, 12000)}`;

async function leerLink(url) {
  // La mayoría de las páginas no dejan leerse desde otra web (CORS). Se intenta igual.
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,nav,header,footer').forEach(x => x.remove());
    return doc.body?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 12000) || null;
  } catch { return null; }
}

function pintarNueva(cuerpo, ctx, m, d, repintar) {
  const { h } = ctx;
  const volver = h('a', { class: 'cp-bt ch izq', href: '#/compras/comidas' }, '‹ Comidas');
  const tab = (id, t) => h('button', { type: 'button', class: ui.modo === id ? 'sel' : '', onclick: () => { ui.modo = id; repintar(); } }, t);

  const crear = async (datos) => {
    const ingredientes = [];
    for (const i of datos.ingredientes || []) {
      const unidad = UNIDADES_RECETA.includes(i.unidad) ? i.unidad : 'u.';
      const nombre = String(i.nombre || '').trim();
      if (!nombre) continue;
      const tipo = d.tipoPorNombre(nombre) || await m.asegurarTipo(d, nombre[0].toUpperCase() + nombre.slice(1), { base: baseDeUnidad(unidad) });
      ingredientes.push({ tipoId: tipo.id, nombre: tipo.nombre, cantidad: Number(i.cantidad) || 1, unidad });
    }
    const id = await m.col.recetas.crear({ nombre: datos.nombre, emoji: adivinar(datos.nombre).emoji === '🛒' ? '🍽️' : adivinar(datos.nombre).emoji, porciones: Number(datos.porciones) || 2, ingredientes, preparacion: datos.preparacion || '', veces: 0 });
    ui.armada = null; ui.pegado = '';
    ctx.navegar(`compras/comidas/${id}`);
  };

  let contenido;
  if (ui.modo === 'mano') {
    const nombre = h('input', { type: 'text', id: 'cp-rec-nombre', placeholder: 'Ej.: Milanesas con puré' });
    const porciones = h('input', { type: 'number', id: 'cp-rec-porciones', value: 4, min: 1 });
    contenido = h('section', { class: 'cp-card' },
      h('div', { class: 'cp-ficha' }, h('label', {}, 'Nombre', nombre), h('label', {}, 'Porciones', porciones)),
      h('p', { class: 'cp-sub' }, 'Después, en su ficha, vas sumando los ingredientes (te sugiere tus productos para que se descuenten de la despensa) y escribís la preparación.'),
      h('button', { type: 'button', class: 'cp-bt p', onclick: () => { if (!nombre.value.trim()) { ctx.aviso('Poné el nombre'); return; } crear({ nombre: nombre.value.trim(), porciones: num(porciones.value) || 2 }); } }, 'Crear y cargar ingredientes'));
  } else {
    const area = h('textarea', { id: 'cp-pegar', rows: 7, placeholder: 'Pegá la receta como la tengas (de WhatsApp, una web, un PDF) o el link.', oninput: (e) => { ui.pegado = e.target.value; } }, ui.pegado);
    const armar = async (boton) => {
      let texto = ui.pegado.trim();
      if (!texto) { ctx.aviso('Pegá la receta primero'); return; }
      if (!(await ctx.existeAccion('gemini-preguntar')) || !(await ctx.pedir('gemini-hay-clave').catch(() => false))) { ctx.aviso('Falta la clave de Gemini: se carga en Configurar Bitácora.'); return; }
      boton.disabled = true; boton.textContent = 'Armando…';
      try {
        if (/^https?:\/\/\S+$/.test(texto)) {
          const leido = await leerLink(texto);
          if (!leido) { ctx.aviso('Esa página no deja leerse desde la app. Copiá el texto de la receta y pegalo acá.', { duracion: 6000 }); return; }
          texto = leido;
        }
        const r = await ctx.pedir('gemini-preguntar', { texto: PEDIDO(texto) });
        const json = (r?.texto || '').match(/\{[\s\S]*\}/);
        ui.armada = json ? JSON.parse(json[0]) : null;
        if (!ui.armada?.nombre) { ui.armada = null; ctx.aviso('Gemini no encontró una receta en ese texto.'); }
      } catch (e) {
        ctx.aviso(/503|satur|overload/i.test(String(e)) ? 'Gemini está saturado, probá en un rato.' : `No se pudo armar: ${e.message || e}`, { duracion: 6000 });
      } finally { boton.disabled = false; boton.textContent = '✦ Armar con Gemini'; repintar(); }
    };
    const a = ui.armada;
    contenido = h('section', { class: 'cp-card' },
      h('p', { class: 'cp-sub' }, 'Gemini (la clave de Bitácora) arma los ingredientes y los une con tus productos, así después se descuentan de la despensa.'),
      area,
      h('button', { type: 'button', class: 'cp-bt p', onclick: (e) => armar(e.currentTarget) }, '✦ Armar con Gemini'),
      a ? h('div', { class: 'cp-encontrado' },
        h('b', {}, `${a.nombre} · ${a.porciones || '?'} porciones`),
        h('span', { class: 'cp-et' }, 'Ingredientes que encontró'),
        (a.ingredientes || []).map((i, n) => {
          const t = d.tipoPorNombre(i.nombre);
          return h('div', { class: 'cp-ing' }, h('span', { class: 'cp-em' }, t?.emoji || adivinar(i.nombre).emoji), h('span', { class: 'cp-n' }, i.nombre),
            h('input', { inputmode: 'decimal', value: String(i.cantidad ?? '').replace('.', ','), 'aria-label': `Cantidad de ${i.nombre}`, onchange: (e) => { a.ingredientes[n].cantidad = num(e.target.value); } }),
            h('span', { class: 'u' }, i.unidad), h('span', { class: `est ${t ? 'verde' : 'lat'}` }, t ? 'tu producto ✓' : 'nuevo'));
        }),
        h('p', { class: 'cp-sub' }, 'Los "nuevo" se agregan a tus productos. Podés corregir las cantidades antes de guardar.'),
        h('button', { type: 'button', class: 'cp-bt p', onclick: () => crear(a) }, 'Guardar receta')) : null);
  }

  poner(cuerpo, h('div', { class: 'cp-angosto' }, volver,
    h('div', { class: 'cp-cab' }, h('div', {}, h('h1', {}, 'Receta nueva'), h('p', {}, 'Escribila o pegala.'))),
    h('nav', { class: 'cp-pest botones' }, tab('mano', 'Escribirla'), tab('pegar', 'Pegar texto o link')),
    contenido));
}
