// ─────────────────────────────────────────────────────────────
// Compras: datos y cálculos.
//
// Todo se cuenta por TIPO ("Leche entera"), sin marca ni tamaño.
// Cada PRODUCTO (Serenísima 1 L, Sancor 750 ml) pertenece a un tipo y
// dice cuánto trae. Así la lista, la despensa, el consumo y las recetas
// van en litros, kilos o unidades, y cualquier marca o tamaño sirve.
//
// Colecciones:
//   tipos      nombre, base ('L' | 'kg' | 'u.'), emoji, sector, lugar, preferidoId, gusto
//   productos  nombre, marca, codigo, tipoId, contenido (en la base del tipo), origen, duracion
//   lista      tipoId, cantidad (en la base), sugerida, motivo
//   carrito    lo que vas agregando en el súper (sobrevive si cerrás la app)
//   compras    compras guardadas, con sus productos y descuentos
//   despensa   tipoId, lugar, cantidad (en la base), vence, nota
//   consumo    anotaciones: uso, se terminó, se tiró, ajuste de recuento
//   recetas    nombre, porciones, ingredientes [{ tipoId, nombre, cantidad, unidad }], preparacion, veces
//   comidas    fecha, recetaId, porciones, hecha
//   base       lista base mensual: tipoId, cantidad
//   ajustes    un registro: sectores, compra en curso, súpers, descartadas, mes armado
// ─────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');
export const aISO = (f) => `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
export const deISO = (s) => { const [a, m, d] = String(s).split('-').map(Number); return new Date(a, m - 1, d); };
export const hoyISO = () => aISO(new Date());
export const sumarDias = (iso, n) => { const f = deISO(iso); f.setDate(f.getDate() + n); return aISO(f); };
export const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 864e5);
export const fechaCorta = (iso) => iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '';
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function cuando(iso) {
  const k = diasEntre(hoyISO(), iso);
  if (k === 0) return 'hoy';
  if (k === 1) return 'mañana';
  const f = deISO(iso);
  return `${DIAS[f.getDay()]} ${f.getDate()}`;
}

export const plata = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
export const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export const num = (v) => { const t = String(v ?? '').trim(); const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t); return Number.isFinite(n) ? n : 0; };
const redondear = (n) => Math.round(n * 1000) / 1000;

export const LUGARES = [['Heladera', '🧊'], ['Alacena', '🗄️'], ['Freezer', '❄️'], ['Limpieza', '🧽'], ['Baño', '🛁'], ['Otros', '📦']];
export const SECTORES = ['Lácteos', 'Almacén', 'Verdulería', 'Carnes y freezer', 'Panadería', 'Bebidas', 'Limpieza', 'Baño', 'Otros'];
export const BASES = [['u.', 'unidades'], ['kg', 'kilos'], ['L', 'litros']];
export const UNIDADES_RECETA = ['g', 'kg', 'ml', 'L', 'u.'];
export const MOTIVOS_TIRO = ['Venció', 'Se echó a perder', 'No gustó'];
const LUGARES_PERECEDEROS = ['Heladera', 'Freezer'];

// ── Cantidades ──
// Muestra una cantidad en su base: 0,75 L → "750 ml", 0,2 kg → "200 g".
export function cant(c, base = 'u.') {
  const n = Number(c) || 0;
  const f = (x, d = 2) => x.toLocaleString('es-AR', { maximumFractionDigits: d });
  if (base === 'L') return n < 1 && n > 0 ? `${f(n * 1000, 0)} ml` : `${f(n)} L`;
  if (base === 'kg') return n < 1 && n > 0 ? `${f(n * 1000, 0)} g` : `${f(n)} kg`;
  return `${f(n)} u.`;
}
// Pasa una cantidad con unidad (g, ml…) a la base del tipo.
export function aBase(c, unidad) {
  const n = Number(c) || 0;
  if (unidad === 'g' || unidad === 'ml') return n / 1000;
  return n;
}
export const baseDeUnidad = (u) => (u === 'g' || u === 'kg') ? 'kg' : (u === 'ml' || u === 'L') ? 'L' : 'u.';
// "750 ml", "1,5 L", "500 g", "x4" → { contenido, base }
export function leerContenido(texto) {
  const t = normal(texto).replace(',', '.');
  let m = t.match(/(\d+(?:\.\d+)?)\s*(ml|cc|l|lt|litros?|g|gr|grs|gramos|kg|kilos?)\b/);
  if (m) {
    const n = Number(m[1]), u = m[2];
    if (['ml', 'cc'].includes(u)) return { contenido: n / 1000, base: 'L' };
    if (/^l/.test(u)) return { contenido: n, base: 'L' };
    if (['g', 'gr', 'grs', 'gramos'].includes(u)) return { contenido: n / 1000, base: 'kg' };
    return { contenido: n, base: 'kg' };
  }
  m = t.match(/\bx\s?(\d+)\b|(\d+)\s?(u|unidades|rollos)\b/);
  if (m) return { contenido: Number(m[1] || m[2]), base: 'u.' };
  return null;
}

// Emoji, sector y lugar adivinados por el nombre, para no pedirlos a mano.
const PISTAS = [
  [/leche|yogur|queso|manteca|crema|dulce de leche/, '🥛', 'Lácteos', 'Heladera'], [/huevo/, '🥚', 'Lácteos', 'Heladera'],
  [/jamon|fiambre|salame|mortadela/, '🥓', 'Lácteos', 'Heladera'], [/pollo|milanesa|pechuga/, '🍗', 'Carnes y freezer', 'Freezer'],
  [/carne|asado|picada|bife|chorizo|nalga|vacio/, '🥩', 'Carnes y freezer', 'Freezer'], [/pescado|merluza|atun/, '🐟', 'Carnes y freezer', 'Freezer'],
  [/pan\b|lactal|factura|galleta|galletita|bizcocho/, '🍞', 'Panadería', 'Alacena'],
  [/cafe/, '☕', 'Almacén', 'Alacena'], [/yerba/, '🧉', 'Almacén', 'Alacena'], [/\bte\b|saquito/, '🍵', 'Almacén', 'Alacena'],
  [/fideo|tallarin|spaghetti|ravioles|pasta\b/, '🍝', 'Almacén', 'Alacena'], [/arroz/, '🍚', 'Almacén', 'Alacena'],
  [/aceite|oliva/, '🫒', 'Almacén', 'Alacena'], [/pure de tomate|tomate triturado|salsa/, '🥫', 'Almacén', 'Alacena'],
  [/\bsal\b|azucar|harina|polenta/, '🧂', 'Almacén', 'Alacena'], [/lenteja|poroto|garbanzo/, '🫘', 'Almacén', 'Alacena'],
  [/tomate/, '🍅', 'Verdulería', 'Heladera'], [/papa\b|papas\b/, '🥔', 'Verdulería', 'Alacena'], [/cebolla/, '🧅', 'Verdulería', 'Alacena'],
  [/banana/, '🍌', 'Verdulería', 'Alacena'], [/manzana/, '🍎', 'Verdulería', 'Heladera'], [/naranja|mandarina/, '🍊', 'Verdulería', 'Alacena'],
  [/limon/, '🍋', 'Verdulería', 'Heladera'], [/lechuga|acelga|espinaca|rucula/, '🥬', 'Verdulería', 'Heladera'],
  [/zanahoria/, '🥕', 'Verdulería', 'Heladera'], [/\bajo\b/, '🧄', 'Verdulería', 'Alacena'], [/palta/, '🥑', 'Verdulería', 'Heladera'],
  [/agua|gaseosa|coca|jugo|soda/, '🥤', 'Bebidas', 'Alacena'], [/cerveza/, '🍺', 'Bebidas', 'Heladera'], [/vino/, '🍷', 'Bebidas', 'Alacena'],
  [/detergente|lavandina|limpiador|desengrasante|suavizante|jabon (en polvo|liquido)|esponja|trapo|bolsa/, '🧴', 'Limpieza', 'Limpieza'],
  [/papel higienico|shampoo|acondicionador|pasta dental|cepillo|desodorante|jabon/, '🧻', 'Baño', 'Baño'],
];
const VERDU = /tomate|papa|cebolla|banana|manzana|naranja|mandarina|limon|zanahoria|palta|zapallo|batata/;
export function adivinar(nombre) {
  const n = normal(nombre);
  const p = PISTAS.find(([re]) => re.test(n));
  const g = p ? { emoji: p[1], sector: p[2], lugar: p[3] } : { emoji: '🛒', sector: 'Almacén', lugar: 'Alacena' };
  const c = leerContenido(nombre);
  g.base = c?.base || (VERDU.test(n) || /pollo|carne|asado|picada|queso|jamon/.test(n) ? 'kg' : /leche|aceite|agua|gaseosa|jugo|lavandina|detergente/.test(n) ? 'L' : 'u.');
  return g;
}
// Nombre del tipo a partir del nombre de un producto: le saca marca y tamaño.
export function tipoDesdeNombre(nombre, marca = '') {
  let t = String(nombre || '');
  if (marca) t = t.replace(new RegExp(marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*(ml|cc|l|lt|litros?|g|gr|grs|gramos|kg|kilos?)\b/ig, '').replace(/\bx\s?\d+\b/ig, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : String(nombre || '').trim();
}

export function crearModelo(ctx) {
  const NOMBRES = ['tipos', 'productos', 'lista', 'carrito', 'compras', 'despensa', 'consumo', 'recetas', 'comidas', 'base', 'ajustes'];
  const col = Object.fromEntries(NOMBRES.map(n => [n, ctx.datos(n)]));

  async function cargar() {
    const r = await Promise.all(NOMBRES.map(n => col[n].listar()));
    const [tipos, productos, lista, carrito, compras, despensa, consumo, recetas, comidas, base, ajustesL] = r;
    const ajustes = ajustesL[0] || { id: null };
    const tipoPorId = new Map(tipos.map(t => [t.id, t]));
    const prodPorId = new Map(productos.map(p => [p.id, p]));
    compras.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.creado || 0) - (a.creado || 0)));
    comidas.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const sectores = [...(ajustes.sectores || SECTORES)];
    for (const t of tipos) if (t.sector && !sectores.includes(t.sector)) sectores.push(t.sector);

    const d = {
      tipos, productos, lista, carrito, compras, despensa, consumo, recetas, comidas, base, ajustes, sectores,
      tipo: (id) => tipoPorId.get(id) || null,
      producto: (id) => prodPorId.get(id) || null,
      receta: (id) => recetas.find(x => x.id === id) || null,
      porCodigo: (codigo) => codigo ? productos.find(p => p.codigo === String(codigo)) || null : null,
      tipoPorNombre: (nombre) => tipos.find(t => normal(t.nombre) === normal(nombre)) || null,
      productosDe: (tipoId) => productos.filter(p => p.tipoId === tipoId),
      baseDe: (tipoId) => tipoPorId.get(tipoId)?.base || 'u.',
      emojiDe: (tipoId) => tipoPorId.get(tipoId)?.emoji || '🛒',
      nombreDe: (tipoId) => tipoPorId.get(tipoId)?.nombre || '?',
      sectorDe: (tipoId) => { const s = tipoPorId.get(tipoId)?.sector || 'Otros'; return sectores.includes(s) ? s : 'Otros'; },

      // Producto de siempre de un tipo: el elegido, o el más comprado.
      preferido(tipoId) {
        const t = tipoPorId.get(tipoId);
        if (t?.preferidoId && prodPorId.get(t.preferidoId)) return prodPorId.get(t.preferidoId);
        const ps = d.productosDe(tipoId);
        if (!ps.length) return null;
        const veces = (p) => compras.reduce((a, c) => a + (c.items || []).filter(i => i.productoId === p.id).length, 0);
        return [...ps].sort((a, b) => veces(b) - veces(a))[0];
      },

      // Precios pagados de un producto (del más nuevo al más viejo).
      precios(prodId) {
        const r = [];
        for (const c of compras) for (const it of c.items || []) if (it.productoId === prodId && it.precio) r.push({ fecha: c.fecha, super: c.super, precio: it.precio });
        return r;
      },
      ultimoPrecio: (prodId) => d.precios(prodId)[0] || null,
      // Precios de un tipo por litro / kilo / unidad.
      preciosBase(tipoId) {
        const r = [];
        for (const c of compras) for (const it of c.items || []) {
          if (it.tipoId !== tipoId || !it.precio || !it.contenido) continue;
          r.push({ fecha: c.fecha, super: c.super, porBase: it.precio / it.contenido, productoId: it.productoId });
        }
        return r;
      },
      // Lo que cuesta, más o menos, una cantidad de un tipo.
      estimado(tipoId, cantidad) {
        const p = d.preferido(tipoId), u = p && d.ultimoPrecio(p.id);
        if (u && p.contenido) return Math.ceil(cantidad / p.contenido - 1e-9) * u.precio;
        const pb = d.preciosBase(tipoId)[0];
        return pb ? pb.porBase * cantidad : 0;
      },
      // "6 de Serenísima 1 L"
      envases(tipoId, cantidad) {
        const p = d.preferido(tipoId);
        if (!p?.contenido || (!p.codigo && !p.marca)) return null;   // suelto: no hay envase
        return { n: Math.ceil(cantidad / p.contenido - 1e-9), producto: p };
      },

      stock: (tipoId) => despensa.filter(x => x.tipoId === tipoId).reduce((a, x) => a + (Number(x.cantidad) || 0), 0),

      // Consumo por día (en la base) de los últimos 90 días: comprado menos lo que queda.
      consumoDiario(tipoId) {
        const desde = sumarDias(hoyISO(), -90);
        let comprado = 0, primera = null;
        for (const c of compras) {
          if (c.fecha < desde) continue;
          for (const it of c.items || []) if (it.tipoId === tipoId) { comprado += (Number(it.cantidad) || 0) * (Number(it.contenido) || 1); primera = !primera || c.fecha < primera ? c.fecha : primera; }
        }
        if (!primera) return 0;
        const dias = Math.max(14, diasEntre(primera, hoyISO()));
        return Math.max(0, comprado - d.stock(tipoId)) / dias;
      },
      tirados(tipoId, dias = 60) {
        const desde = sumarDias(hoyISO(), -dias);
        return consumo.filter(x => x.tipo === 'tiro' && x.tipoId === tipoId && x.fecha >= desde).length;
      },

      venceEn: (x) => x.vence ? diasEntre(hoyISO(), x.vence) : null,
      porVencer(dias = 7) { return despensa.filter(x => x.vence && diasEntre(hoyISO(), x.vence) <= dias).sort((a, b) => (a.vence < b.vence ? -1 : 1)); },
      faltaVencimiento: (x) => !x.vence && LUGARES_PERECEDEROS.includes(x.lugar),

      // Cuánto llevás en el carrito de un tipo (en la base).
      llevo: (tipoId) => carrito.filter(x => x.tipoId === tipoId).reduce((a, x) => a + (Number(x.cantidad) || 0) * (Number(x.contenido) || 1), 0),
      falta: (item) => Math.max(0, redondear((Number(item.cantidad) || 0) - d.llevo(item.tipoId))),

      // Lo que la app propone comprar, con el motivo.
      sugerencias() {
        const enLista = new Set(lista.map(x => x.tipoId));
        const mesArmado = ajustes.mesArmado === hoyISO().slice(0, 7);
        if (!mesArmado) for (const b of base) enLista.add(b.tipoId);   // eso se propone en la revisión del mes
        const descartadas = ajustes.descartadas || {};
        const hoy = hoyISO(), r = [];
        for (const t of tipos) {
          if (enLista.has(t.id) || t.gusto === 'feo') continue;
          if (descartadas[t.id] && diasEntre(descartadas[t.id], hoy) < 14) continue;
          const stock = d.stock(t.id), cd = d.consumoDiario(t.id);
          let motivo = '';
          const termino = consumo.some(x => x.tipoId === t.id && x.tipo === 'termino' && diasEntre(x.fecha, hoy) <= 30);
          if (stock <= 0 && termino) motivo = 'Se terminó';
          else if (cd > 0 && stock / cd <= 10) motivo = stock <= 0 ? 'Se terminó' : `Se termina en ~${Math.max(1, Math.round(stock / cd))} días`;
          else if (t.gusto === 'mas' && stock <= 0) motivo = '👍 Comprar más';
          if (!motivo) continue;
          if (cd > 0) motivo += ` · usás ~${cant(cd * 30, t.base)} por mes`;
          const k = d.tirados(t.id);
          if (k >= 2) motivo += ` · ojo: se tiró ${k} veces`;
          const p = d.preferido(t.id);
          const cantidad = cd > 0 ? Math.max(p?.contenido || 1, redondear(cd * 14)) : (p?.contenido || 1);
          r.push({ tipo: t, cantidad, motivo });
        }
        return r;
      },

      // Revisión de la lista base del mes: cuánto conviene comprar de cada cosa.
      revisionBase() {
        const r = [];
        for (const b of base) {
          const t = tipoPorId.get(b.tipoId);
          if (!t) continue;
          const cd = d.consumoDiario(t.id), stock = d.stock(t.id), k = d.tirados(t.id);
          let nuevo = Number(b.cantidad) || 0, motivo = '';
          if (t.gusto === 'feo') { nuevo = 0; motivo = '👎 No les gustó'; }
          else if (cd > 0) {
            const mes = cd * 30;
            nuevo = Math.max(0, redondear(mes - stock));
            const p = d.preferido(t.id);
            if (p?.contenido) nuevo = Math.ceil(nuevo / p.contenido - 1e-9) * p.contenido;
            motivo = `Usás ~${cant(mes, t.base)} por mes${stock > 0 ? ` y te quedan ${cant(stock, t.base)}` : ''}`;
            if (k >= 2) { nuevo = redondear(nuevo / 2); motivo += ` · tiraste ${k} en 2 meses`; }
          } else if (t.gusto === 'mas') { nuevo = redondear(nuevo * 1.5); motivo = 'Marcaste "comprar más"'; }
          r.push({ item: b, tipo: t, base: Number(b.cantidad) || 0, nuevo: redondear(nuevo), motivo });
        }
        return r;
      },

      // Comidas que vienen (sin hacer), de la más próxima a la última.
      proximas() { const hoy = hoyISO(); return comidas.filter(c => !c.hecha && c.fecha >= hoy); },
      // Ingredientes en la base del tipo, escalados a las porciones de la comida.
      necesita(receta, porciones) {
        const k = (Number(porciones) || receta.porciones || 1) / (receta.porciones || 1);
        // compatible: la unidad de la receta se puede comparar con cómo se cuenta el tipo (ej.: 1 cebolla vs. cebolla en kilos, no).
        return (receta.ingredientes || []).filter(i => i.tipoId).map(i => ({ ...i, enBase: redondear(aBase(i.cantidad, i.unidad) * k), compatible: baseDeUnidad(i.unidad) === d.baseDe(i.tipoId) }));
      },
      // Lo que falta para las comidas programadas: se va gastando lo de la
      // despensa en orden de fecha; cada faltante dice para qué comidas es.
      faltaComidas() {
        const disponible = new Map(), r = new Map();
        for (const c of d.proximas()) {
          const rec = d.receta(c.recetaId);
          if (!rec) continue;
          for (const i of d.necesita(rec, c.porciones)) {
            // Si no se puede comparar, falta solo si no hay nada: se pide un envase.
            if (!i.compatible) {
              if (d.stock(i.tipoId) > 0 || lista.some(x => x.tipoId === i.tipoId)) continue;
              const f = r.get(i.tipoId) || { tipoId: i.tipoId, cantidad: d.preferido(i.tipoId)?.contenido || 1, comidas: [] };
              f.comidas.push({ fecha: c.fecha, nombre: rec.nombre });
              r.set(i.tipoId, f);
              continue;
            }
            if (!disponible.has(i.tipoId)) disponible.set(i.tipoId, d.stock(i.tipoId) + lista.filter(x => x.tipoId === i.tipoId).reduce((a, x) => a + (Number(x.cantidad) || 0), 0));
            const hay = disponible.get(i.tipoId), usa = Math.min(hay, i.enBase);
            disponible.set(i.tipoId, hay - usa);
            if (i.enBase - usa <= 1e-9) continue;
            const f = r.get(i.tipoId) || { tipoId: i.tipoId, cantidad: 0, comidas: [] };
            f.cantidad = redondear(f.cantidad + i.enBase - usa);
            f.comidas.push({ fecha: c.fecha, nombre: rec.nombre });
            r.set(i.tipoId, f);
          }
        }
        return [...r.values()];
      },
    };
    return d;
  }

  // ── Escrituras ──

  async function guardarAjustes(d, cambios) {
    if (d.ajustes.id) await col.ajustes.actualizar(d.ajustes.id, cambios);
    else d.ajustes.id = await col.ajustes.crear(cambios);
    Object.assign(d.ajustes, cambios);
  }

  async function asegurarTipo(d, nombre, extra = {}) {
    const ya = d.tipoPorNombre(nombre);
    if (ya) return ya;
    const g = adivinar(nombre);
    const t = { nombre: nombre.trim(), base: extra.base || g.base, emoji: extra.emoji || g.emoji, sector: extra.sector || g.sector, lugar: extra.lugar || g.lugar, preferidoId: '', gusto: '' };
    const id = await col.tipos.crear(t);
    const nuevo = { id, ...t };
    d.tipos.push(nuevo);
    return nuevo;
  }

  // Crea un producto. "datos" trae nombre, marca, codigo, tipoId, contenido, origen.
  async function crearProducto(d, datos) {
    const p = { nombre: datos.nombre.trim(), marca: datos.marca || '', codigo: datos.codigo ? String(datos.codigo) : '', tipoId: datos.tipoId, contenido: Number(datos.contenido) || 1, origen: datos.origen || 'mio', duracion: datos.duracion || '' };
    const id = await col.productos.crear(p);
    const nuevo = { id, ...p };
    d.productos.push(nuevo);
    return nuevo;
  }

  // Producto genérico de un tipo (para lo que no tiene código: verdura, fiambre…).
  async function productoSuelto(d, tipo) {
    const ya = d.productosDe(tipo.id).find(p => !p.codigo && !p.marca);
    if (ya) return ya;
    return crearProducto(d, { nombre: tipo.nombre, tipoId: tipo.id, contenido: 1, origen: 'mio' });
  }

  async function agregarALista(d, tipo, { cantidad, sugerida = false, motivo = '' } = {}) {
    const c = cantidad ?? (d.preferido(tipo.id)?.contenido || 1);
    const ya = d.lista.find(x => x.tipoId === tipo.id);
    if (ya) { ya.cantidad = redondear((Number(ya.cantidad) || 0) + c); await col.lista.actualizar(ya.id, { cantidad: ya.cantidad }); return ya.id; }
    const fila = { tipoId: tipo.id, cantidad: redondear(c), sugerida, motivo };
    const id = await col.lista.crear(fila);
    d.lista.push({ id, ...fila });
    return id;
  }

  async function sumarSugerencias(d) {
    const s = d.sugerencias();
    for (const x of s) await agregarALista(d, x.tipo, { cantidad: x.cantidad, sugerida: true, motivo: x.motivo });
    return s.length;
  }

  async function quitarDeLista(d, item) {
    await col.lista.borrar(item.id);
    if (item.sugerida) await guardarAjustes(d, { descartadas: { ...(d.ajustes.descartadas || {}), [item.tipoId]: hoyISO() } });
  }

  async function anotar(datos) { return col.consumo.crear({ fecha: hoyISO(), ...datos }); }

  // Pone una fila de la despensa en una cantidad; en 0 se borra y queda anotado.
  async function ponerCantidad(x, cantidad, tipo = 'uso') {
    const antes = Number(x.cantidad) || 0;
    const ahora = Math.max(0, redondear(cantidad));
    if (ahora === antes) return;
    if (tipo === 'ajuste') await anotar({ tipoId: x.tipoId, tipo: 'ajuste', cantidad: redondear(ahora - antes) });
    else if (ahora < antes) await anotar({ tipoId: x.tipoId, tipo: ahora === 0 ? 'termino' : 'uso', cantidad: redondear(antes - ahora) });
    if (ahora === 0) await col.despensa.borrar(x.id);
    else await col.despensa.actualizar(x.id, { cantidad: ahora });
    x.cantidad = ahora;
  }

  // Descuenta de la despensa (lo que vence antes primero). Devuelve lo que no alcanzó.
  async function descontar(d, tipoId, cantidad) {
    let resto = cantidad;
    const filas = d.despensa.filter(x => x.tipoId === tipoId).sort((a, b) => ((a.vence || '9999') < (b.vence || '9999') ? -1 : 1));
    for (const x of filas) {
      if (resto <= 1e-9) break;
      const usa = Math.min(Number(x.cantidad) || 0, resto);
      await ponerCantidad(x, (Number(x.cantidad) || 0) - usa);
      resto = redondear(resto - usa);
    }
    return resto;
  }

  async function tirar(d, x, { cantidad, motivo }) {
    const c = Math.min(Number(x.cantidad) || 0, cantidad || Number(x.cantidad) || 0);
    const pb = d.preciosBase(x.tipoId)[0];
    await anotar({ tipoId: x.tipoId, tipo: 'tiro', cantidad: c, motivo, valor: pb ? Math.round(pb.porBase * c) : 0 });
    const resto = redondear((Number(x.cantidad) || 0) - c);
    if (resto <= 0) await col.despensa.borrar(x.id); else await col.despensa.actualizar(x.id, { cantidad: resto });
    if (motivo === 'No gustó') await col.tipos.actualizar(x.tipoId, { gusto: 'feo' });
  }

  // Suma a la despensa: mismo tipo, lugar y vencimiento → una sola fila.
  async function sumarADespensa(d, { tipoId, cantidad, lugar, vence = '' }) {
    const ya = d.despensa.find(x => x.tipoId === tipoId && x.lugar === lugar && (x.vence || '') === (vence || ''));
    if (ya) { ya.cantidad = redondear((Number(ya.cantidad) || 0) + cantidad); return col.despensa.actualizar(ya.id, { cantidad: ya.cantidad }); }
    const fila = { tipoId, lugar, cantidad: redondear(cantidad), vence: vence || '', nota: '' };
    const id = await col.despensa.crear(fila);
    d.despensa.push({ id, ...fila });
  }

  // Cierra la compra: la guarda, pasa todo a la despensa, descuenta de la
  // lista lo que llevaste y vacía el carrito.
  async function guardarCompra(d, { descTarjeta = 0, aDespensa = true } = {}) {
    const items = d.carrito.map(x => ({ productoId: x.productoId, tipoId: x.tipoId, nombre: x.nombre, precio: Number(x.precio) || 0, cantidad: Number(x.cantidad) || 1, contenido: Number(x.contenido) || 1, descuento: Number(x.descuento) || 0, vence: x.vence || '', lugar: x.lugar || '', fueraDeLista: !!x.fueraDeLista }));
    const bruto = items.reduce((a, x) => a + x.precio * x.cantidad, 0);
    const conDesc = items.reduce((a, x) => a + Math.max(0, x.precio * x.cantidad - x.descuento), 0);
    const total = Math.max(0, conDesc - (Number(descTarjeta) || 0));
    const compra = { fecha: hoyISO(), super: d.ajustes.compraEnCurso?.super || '', items, bruto, descTarjeta: Number(descTarjeta) || 0, total, ahorro: bruto - total };
    const id = await col.compras.crear(compra);
    const llevo = new Map();
    for (const it of items) {
      const c = it.cantidad * it.contenido;
      llevo.set(it.tipoId, (llevo.get(it.tipoId) || 0) + c);
      if (aDespensa) await sumarADespensa(d, { tipoId: it.tipoId, cantidad: c, lugar: it.lugar || d.tipo(it.tipoId)?.lugar || 'Alacena', vence: it.vence });
    }
    for (const x of d.lista) {
      if (!llevo.has(x.tipoId)) continue;
      const resto = redondear((Number(x.cantidad) || 0) - llevo.get(x.tipoId));
      if (resto <= 0) await col.lista.borrar(x.id); else await col.lista.actualizar(x.id, { cantidad: resto });
    }
    for (const x of d.carrito) await col.carrito.borrar(x.id);
    await guardarAjustes(d, { compraEnCurso: null, ultimoSuper: compra.super });
    return { id, ...compra };
  }

  // Une dos productos: todo lo del viejo pasa al que queda.
  async function unir(d, viejoId, quedaId) {
    const q = d.producto(quedaId), v = d.producto(viejoId);
    for (const x of d.carrito.filter(x => x.productoId === viejoId)) await col.carrito.actualizar(x.id, { productoId: quedaId, tipoId: q.tipoId });
    for (const c of d.compras.filter(c => (c.items || []).some(it => it.productoId === viejoId))) {
      await col.compras.actualizar(c.id, { items: c.items.map(it => it.productoId === viejoId ? { ...it, productoId: quedaId, tipoId: q.tipoId } : it) });
    }
    const completar = {};
    for (const k of ['codigo', 'marca', 'duracion']) if (!q[k] && v?.[k]) completar[k] = v[k];
    if (Object.keys(completar).length) await col.productos.actualizar(quedaId, completar);
    for (const t of d.tipos.filter(t => t.preferidoId === viejoId)) await col.tipos.actualizar(t.id, { preferidoId: quedaId });
    await col.productos.borrar(viejoId);
  }

  return { col, cargar, guardarAjustes, asegurarTipo, crearProducto, productoSuelto, agregarALista, sumarSugerencias, quitarDeLista, anotar, ponerCantidad, descontar, tirar, sumarADespensa, guardarCompra, unir };
}
