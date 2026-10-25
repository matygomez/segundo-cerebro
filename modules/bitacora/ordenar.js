// ─────────────────────────────────────────────────────────────
// Archivos para ordenar.
//
// Le pasás archivos a la Bitácora (Compartir en el celular, o elegirlos
// o arrastrarlos en la PC). Gemini
// los lee y propone nombre, carpeta y datos (de quién es, monto,
// vencimiento). Nada se guarda hasta que lo confirmás: mientras tanto
// quedan en "Para revisar" (colección "pendientes"):
//   { estado: 'leyendo' | 'listo' | 'error', original, tipo, via,
//     adjunto { driveId | pendiente, nombre, tipo, url }, huella (SHA-256),
//     repetidoDe (id de la nota con el mismo archivo), propuesta, error }
// Al confirmar se crea una nota con "archivo" y el documento como
// adjunto principal (en Drive queda al lado de la nota, en su carpeta).
//
// Cargas mensuales (ajuste "mensuales"): carpetas donde esperás un
// archivo por mes. Si llega el día y no subiste nada ese mes, aparece
// una tarea en Tareas › Sistemas › Bitácora.
// ─────────────────────────────────────────────────────────────

import { hoyISO, sumarDias, fechaCorta, comparar, BANDEJA } from './modelo.js';
import { poner, ic, ventana, cabecera, elegirCarpeta, vacio, haceCuanto } from './vistas.js';
import { portada } from './visor.js';

const MODELOS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.0-flash'];
const MODELOS_BUSCAR = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
const MAX_LEER = 15 * 1024 * 1024;   // Gemini acepta hasta ~20 MB por pedido
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const plata = (n) => `$ ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const extension = (nombre) => (String(nombre || '').match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase();
const sinExtension = (nombre) => String(nombre || '').replace(/\.[a-z0-9]{1,5}$/i, '');
const mesDe = (ms) => { const f = new Date(ms); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; };
const restarMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const f = new Date(a, m - 1 - n, 1); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; };
const nombreMes = (mes) => MESES[Number(mes.slice(5, 7)) - 1];

// ── Huella: para reconocer el mismo archivo subido dos veces ──
async function huellaDe(blob) {
  try {
    const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${blob.size}-${blob.type}`;   // sin crypto (no debería pasar): algo es algo
  }
}

const enBase64 = (blob) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => mal(new Error('No se pudo leer el archivo'));
  r.readAsDataURL(blob);
});

// ── Gemini ──
// Las carpetas van con ejemplos de nombres ya guardados, así copia tu estilo.
function listaCarpetas(d) {
  return d.carpetas.filter(c => !c.sistema).map(c => {
    const ejemplos = d.notasDe(c.id).filter(n => n.archivo).sort((a, b) => b.creado - a.creado).slice(0, 2).map(n => `"${n.titulo}"`);
    return `${c.id} | ${d.nombreRuta(c.id)}${ejemplos.length ? ` | ej.: ${ejemplos.join(', ')}` : ''}`;
  }).join('\n') || '(todavía no hay carpetas)';
}

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    nombre: { type: 'STRING' }, carpetaId: { type: 'STRING' }, seguro: { type: 'BOOLEAN' },
    alternativas: { type: 'ARRAY', items: { type: 'STRING' } }, carpetaNueva: { type: 'STRING' },
    que: { type: 'STRING' }, de: { type: 'STRING' }, fecha: { type: 'STRING' }, vence: { type: 'STRING' },
    monto: { type: 'NUMBER' }, contenido: { type: 'STRING' },
  },
  required: ['nombre', 'carpetaId', 'seguro', 'que', 'de', 'fecha', 'vence', 'monto', 'contenido'],
};

function instrucciones(nombre, d, carpetaFija = null) {
  return `${carpetaFija ? `El archivo ya tiene carpeta decidida: "${d.nombreRuta(carpetaFija)}" (id ${carpetaFija}). Poné ese id en carpetaId y seguí el estilo de nombre de sus ejemplos.\n` : ''}Sos quien ordena los documentos personales de una persona que vive en Argentina. Hoy es ${hoyISO()}.
Leé el archivo adjunto (nombre original: "${nombre}") y completá:
- nombre: nombre corto y claro para guardarlo, sin extensión, que empiece con el año y mes del documento (AAAA-MM), por ejemplo "2026-10 Gas Metrogas". Si la carpeta tiene ejemplos, seguí ese mismo estilo.
- carpetaId: el id de la carpeta donde va, elegido SOLO de la lista de abajo. Si ninguna encaja bien, dejalo vacío.
- seguro: true solo si estás muy seguro de esa carpeta.
- alternativas: hasta 3 ids de otras carpetas de la lista que también podrían ser.
- carpetaNueva: si ninguna carpeta encaja, una ruta para crear, con " › " entre niveles (ej. "Casa › Servicios › Gas"). Si alguna encaja, vacío.
- que: qué es, en pocas palabras (ej. "Factura de gas de septiembre").
- de: quién lo emite (empresa, organismo o persona).
- fecha: fecha del documento en formato AAAA-MM-DD, o vacío.
- vence: fecha de vencimiento o de pago en formato AAAA-MM-DD si tiene, o vacío.
- monto: el total a pagar o importe principal, solo el número, o 0 si no tiene.
- contenido: el texto del documento transcripto (hasta 3000 caracteres), para poder buscarlo después.
Carpetas (id | ruta | ejemplos):
${listaCarpetas(d)}`;
}

// Si un modelo está saturado (500/503) se reintenta un par de veces y después
// se prueba el siguiente; si ninguno responde, se avisa.
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
// Un error que se arregla solo con el tiempo (límite, saturación, sin conexión):
// el archivo queda "En espera" y la app lo vuelve a intentar sola.
const reintentable = (texto) => Object.assign(new Error(texto), { reintentable: true });
// seguirSiLimite: si un modelo llegó a su límite, prueba el siguiente (cada modelo tiene su propio cupo gratis).
async function pedirGemini(clave, cuerpo, { modelos = MODELOS, seguirSiLimite = false } = {}) {
  let saturado = false, ultimo = 0, limite = '';
  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave }, body: JSON.stringify(cuerpo),
      }).catch(() => { throw reintentable('Sin conexión con Gemini.'); });
      ultimo = r.status;
      if (r.ok) return r.json();
      if (r.status === 400 || r.status === 403) {
        const t = await r.text();
        if (/API key|API_KEY|permission/i.test(t)) throw reintentable('La clave de Gemini no es válida. Revisala en Configurar Bitácora.');
        throw new Error('Gemini no pudo leer este archivo.');
      }
      if (r.status === 429) {
        if (!seguirSiLimite) throw reintentable('Gemini llegó al límite gratis por ahora.');
        limite = modelo; break;
      }
      if (r.status === 404) break;   // ese modelo ya no existe: el siguiente
      if (r.status >= 500) { saturado = true; await esperar(1500 * (intento + 1)); continue; }
      throw reintentable(`Gemini no respondió (${r.status}).`);
    }
  }
  if (limite) throw reintentable('Gemini llegó al límite gratis en todos los modelos.');
  throw reintentable(saturado ? 'Gemini está saturado en este momento.' : `Gemini no respondió (${ultimo || '?'}).`);
}

// Para otros módulos (el Resumen del día): una pregunta de texto, con búsqueda
// en Google si hace falta. Devuelve { texto, fuentes: [{ titulo, url }] }.
export async function preguntarGemini(clave, texto, { buscar = false } = {}) {
  // La búsqueda en Google no tiene cupo gratis en todos los modelos: primero los que sí suelen tenerlo.
  const r = await pedirGemini(clave, {
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    ...(buscar ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { temperature: 0.3 },
  }, { modelos: buscar ? MODELOS_BUSCAR : MODELOS, seguirSiLimite: true });
  const c = r?.candidates?.[0];
  const fuentes = (c?.groundingMetadata?.groundingChunks || []).map(x => x.web).filter(Boolean).map(w => ({ titulo: w.title || '', url: w.uri || '' }));
  return { texto: c?.content?.parts?.map(p => p.text || '').join('') || '', fuentes };
}

// Devuelve la propuesta { nombre, carpetaId, seguro, alternativas, carpetaNueva, que, de, fecha, vence, monto, contenido }.
export async function leerConGemini(clave, blob, nombre, d, { carpetaFija = null } = {}) {
  const tipo = blob.type || '';
  const partes = [{ text: instrucciones(nombre, d, carpetaFija) }];
  if (blob.size > MAX_LEER) partes.push({ text: 'El archivo es muy grande para mandarlo: usá solo el nombre.' });
  else if (/^text\//.test(tipo) || /\.(txt|csv|md)$/i.test(nombre)) partes.push({ text: (await blob.text()).slice(0, 30000) });
  else if (/^image\//.test(tipo) || tipo === 'application/pdf' || /\.pdf$/i.test(nombre)) partes.push({ inline_data: { mime_type: tipo || 'application/pdf', data: await enBase64(blob) } });
  else partes.push({ text: 'Este tipo de archivo no se puede leer: usá solo el nombre.' });
  const r = await pedirGemini(clave, {
    contents: [{ role: 'user', parts: partes }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0.1 },
  });
  const texto = r?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  let x;
  try { x = JSON.parse(texto); } catch { throw reintentable('Gemini no devolvió los datos.'); }
  const fechaOk = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const existe = (id) => !!d.carpeta(id) && !d.carpeta(id).sistema;
  return {
    nombre: String(x.nombre || '').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 100),
    carpetaId: existe(x.carpetaId) ? x.carpetaId : '',
    seguro: !!x.seguro && existe(x.carpetaId),
    alternativas: [...new Set((x.alternativas || []).filter(id => existe(id) && id !== x.carpetaId))].slice(0, 3),
    carpetaNueva: existe(x.carpetaId) ? '' : String(x.carpetaNueva || '').trim(),
    que: String(x.que || '').trim(), de: String(x.de || '').trim(),
    fecha: fechaOk(x.fecha), vence: fechaOk(x.vence),
    monto: Number(x.monto) > 0 ? Math.round(Number(x.monto) * 100) / 100 : 0,
    contenido: String(x.contenido || '').slice(0, 4000),
  };
}

// ── Entrada de archivos ──
// De a uno por vez: el plan gratis de Gemini acepta pocos pedidos por minuto.
let cola = Promise.resolve();
const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

// Cuánto esperar antes de cada nuevo intento (minutos); después, cada una hora.
const ESPERAS = [1, 2, 5, 15, 30, 60];
const enCurso = new Set();

async function leerPendiente(ctx, m, id, blob) {
  const col = m.col.pendientes;
  const p = await col.obtener(id);
  if (!p || p.estado === 'listo') return;
  const d = await m.cargar();
  const clave = d.ajuste('gemini')?.api;
  const enEspera = async (texto) => {
    const intentos = (p.intentos || 0) + 1;
    if (await col.obtener(id)) await col.actualizar(id, { estado: 'espera', error: texto, intentos, proximo: Date.now() + ESPERAS[Math.min(intentos, ESPERAS.length) - 1] * 60000 });
  };
  if (!clave) { await enEspera('Falta la clave de Gemini (en Configurar Bitácora).'); return; }
  await col.actualizar(id, { estado: 'leyendo', error: '' });
  try {
    const propuesta = await leerConGemini(clave, blob || await ctx.archivos.descargar(p.adjunto), p.original, d);
    if (await col.obtener(id)) await col.actualizar(id, { estado: 'listo', propuesta, error: '', intentos: 0 });   // si no lo ordenaste a mano mientras tanto
  } catch (e) {
    if (e.reintentable || !navigator.onLine) await enEspera(e.message || String(e));
    else if (await col.obtener(id)) await col.actualizar(id, { estado: 'error', error: e.message || String(e) });
  }
}

function aLaCola(ctx, m, id, blob = null) {
  if (enCurso.has(id)) return;
  enCurso.add(id);
  enCola(() => leerPendiente(ctx, m, id, blob)).finally(() => enCurso.delete(id));
}

// Mientras la app está abierta, revisa cada medio minuto si hay archivos
// en espera a los que ya les toca otro intento (o que quedaron a medio leer).
export function reintentarSolo(ctx, m) {
  const revisar = async () => {
    const ahora = Date.now();
    for (const p of await m.col.pendientes.listar()) {
      const colgado = p.estado === 'leyendo' && ahora - (p.modificado || p.creado) > 180000;
      if ((p.estado === 'espera' && (p.proximo || 0) <= ahora) || colgado) aLaCola(ctx, m, p.id);
    }
    // Los subidos directo a una carpeta que Gemini todavía no pudo leer.
    for (const n of await m.col.notas.listar()) {
      const a = n.archivo;
      if (!a || n.papelera || !a.lectura || a.lectura === 'lista' || a.lectura === 'error') continue;
      const colgado = a.lectura === 'leyendo' && ahora - (n.modificado || n.creado) > 180000;
      if ((a.lectura === 'espera' && (a.proximo || 0) <= ahora) || colgado) aLaColaNota(ctx, m, n.id);
    }
  };
  setTimeout(revisar, 5000);
  setInterval(revisar, 30000);
}

// ── Subir directo a una carpeta ──
// Se guarda al toque como nota con el nombre del archivo; Gemini lo lee de
// fondo (con la carpeta ya decidida) y completa nombre, datos y lo que dice
// adentro. Si encuentra vencimiento o monto, la nota ofrece crear la tarea
// o cargar el gasto ("sugerir").
async function leerNota(ctx, m, id, blob) {
  const d = await m.cargar();
  const n = d.nota(id);
  const a = n?.archivo;
  if (!a || n.papelera || a.lectura === 'lista' || !a.lectura) return;
  const guardarLectura = async (cambios) => { const x = (await m.cargar()).nota(id); if (x?.archivo) await m.guardarNota(id, { archivo: { ...x.archivo, ...cambios } }); };
  const enEspera = async (texto) => {
    const intentos = (a.intentos || 0) + 1;
    await guardarLectura({ lectura: 'espera', error: texto, intentos, proximo: Date.now() + ESPERAS[Math.min(intentos, ESPERAS.length) - 1] * 60000 });
  };
  const clave = d.ajuste('gemini')?.api;
  if (!clave) { await enEspera('Falta la clave de Gemini (en Configurar Bitácora).'); return; }
  await guardarLectura({ lectura: 'leyendo', error: '' });
  try {
    const principal = (n.adjuntos || []).find(x => x.principal);
    const pr = await leerConGemini(clave, blob || await ctx.archivos.descargar(principal), a.original || n.titulo, d, { carpetaFija: n.carpetaId || null });
    const ahora = (await m.cargar()).nota(id);
    if (!ahora?.archivo) return;
    const x = ahora.archivo;
    // Lo que ya completaste a mano no se pisa.
    const cambios = { archivo: { ...x, que: x.que || pr.que, de: x.de || pr.de, fecha: x.fecha || pr.fecha, vence: x.vence || pr.vence, monto: x.monto || pr.monto,
      contenido: pr.contenido, lectura: 'lista', error: '', intentos: 0, sugerir: { tarea: !!(x.vence || pr.vence), gasto: !!(x.monto || pr.monto) } } };
    if (pr.nombre && ahora.titulo === sinExtension(x.original || '')) {
      cambios.titulo = pr.nombre;
      cambios.adjuntos = (ahora.adjuntos || []).map(y => (y.principal ? { ...y, nombre: pr.nombre + extension(y.nombre) } : y));
    }
    await m.guardarNota(id, cambios);
  } catch (e) {
    if (e.reintentable || !navigator.onLine) await enEspera(e.message || String(e));
    else await guardarLectura({ lectura: 'error', error: e.message || String(e) });
  }
}

export function aLaColaNota(ctx, m, id, blob = null) {
  const k = `nota:${id}`;
  if (enCurso.has(k)) return;
  enCurso.add(k);
  enCola(() => leerNota(ctx, m, id, blob)).finally(() => enCurso.delete(k));
}

export async function subirACarpeta(ctx, m, lista, carpetaId) {
  const d = await m.cargar();
  let guardados = 0, ultimo = '';
  for (const x of lista) {
    const nombre = x.nombre || x.blob.name || 'archivo';
    try {
      const tipo = x.blob.type || '';
      const huella = await huellaDe(x.blob);
      const rep = d.notas.find(z => z.archivo?.huella === huella);
      if (rep && !await ctx.confirmar(`"${nombre}" ya lo tenés: ${rep.titulo} (${d.nombreRuta(rep.carpetaId)}). ¿Lo subo igual?`, { si: 'Subir igual' })) continue;
      const adjunto = await ctx.archivos.subir(x.blob instanceof File ? x.blob : new File([x.blob], nombre, { type: tipo }));
      ultimo = await m.crearNota({
        titulo: sinExtension(nombre), carpetaId,
        archivo: { que: '', de: '', fecha: '', vence: '', monto: 0, contenido: '', huella, original: nombre, lectura: 'leyendo' },
        adjuntos: [{ ...adjunto, nombre, origen: 'subido', principal: true }],
      });
      guardados++;
      aLaColaNota(ctx, m, ultimo, x.blob);
    } catch (e) { ctx.aviso(`No se pudo subir ${nombre}: ${e.message}`); }
  }
  if (guardados) ctx.aviso(`${guardados === 1 ? 'Guardado' : `${guardados} archivos guardados`} en ${d.nombreRuta(carpetaId)}. Gemini completa los datos.`,
    guardados === 1 ? { accion: 'Abrir', alTocar: () => ctx.navegar(`bitacora/n/${ultimo}`) } : {});
}

// "+ Nueva › Subir archivo acá".
export function elegirParaCarpeta(ctx, m, carpetaId) {
  const input = ctx.h('input', { type: 'file', multiple: true, hidden: true });
  input.addEventListener('change', () => {
    const lista = [...input.files].map(f => ({ blob: f, nombre: f.name }));
    input.remove();
    if (lista.length) subirACarpeta(ctx, m, lista, carpetaId);
  });
  document.body.append(input);
  input.click();
}

// Arrastrar archivos arriba de una carpeta abierta (o la Bandeja) en la PC.
export function soltarEnCarpeta(ctx, m, main) {
  if (main.dataset.soltar) return;
  main.dataset.soltar = '1';
  const destino = () => {
    const r = location.hash.match(/^#\/bitacora\/(?:c\/([^/]+)|(bandeja))$/);
    return r ? (r[1] || '') : null;
  };
  const conArchivos = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  main.addEventListener('dragover', (e) => { if (destino() === null || !conArchivos(e)) return; e.preventDefault(); main.classList.add('bt-soltando'); });
  main.addEventListener('dragleave', (e) => { if (!main.contains(e.relatedTarget)) main.classList.remove('bt-soltando'); });
  main.addEventListener('drop', async (e) => {
    const id = destino();
    main.classList.remove('bt-soltando');
    if (id === null || !conArchivos(e)) return;
    e.preventDefault();
    const d = await m.cargar();
    if (id && (!d.carpeta(id) || d.carpeta(id).sistema)) return;
    const lista = [...e.dataTransfer.files].map(f => ({ blob: f, nombre: f.name }));
    if (lista.length) subirACarpeta(ctx, m, lista, id);
  });
}

// Recibe archivos: [{ blob, nombre }]. Devuelve cuántos quedaron para revisar.
export async function recibirArchivos(ctx, m, lista, via) {
  const col = m.col.pendientes;
  let nuevos = 0;
  for (const x of lista) {
    try {
      const nombre = x.nombre || x.blob.name || 'archivo';
      const tipo = x.blob.type || x.tipo || '';
      const huella = await huellaDe(x.blob);
      if ((await col.listar()).some(p => p.huella === huella)) { ctx.aviso(`"${nombre}" ya está para revisar`); continue; }
      const repetida = (await m.cargar()).notas.find(n => n.archivo?.huella === huella);
      const adjunto = await ctx.archivos.subir(x.blob instanceof File ? x.blob : new File([x.blob], nombre, { type: tipo }));
      const id = await col.crear({ estado: 'leyendo', original: nombre, tipo, via, adjunto: { ...adjunto, nombre }, huella, repetidoDe: repetida?.id || '', propuesta: null, error: '' });
      nuevos++;
      aLaCola(ctx, m, id, x.blob);
    } catch (e) {
      ctx.aviso(`No se pudo recibir ${x.nombre || 'un archivo'}: ${e.message}`);
    }
  }
  return nuevos;
}

export const reintentar = (ctx, m, p) => aLaCola(ctx, m, p.id);

// Elegir archivos del dispositivo.
function elegirDelDispositivo(ctx, m) {
  const input = ctx.h('input', { type: 'file', multiple: true, hidden: true });
  input.addEventListener('change', async () => {
    const lista = [...input.files].map(f => ({ blob: f, nombre: f.name }));
    input.remove();
    if (lista.length) await recibirArchivos(ctx, m, lista, 'Subido desde este dispositivo');
  });
  document.body.append(input);
  input.click();
}

// ── Pantalla "Para revisar" ──
const ESTADOS = { leyendo: ['Leyendo…', 'leyendo'], espera: ['En espera', 'leyendo'], error: ['Revisar a mano', 'error'] };
const hora = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
function estadoDe(p) {
  if (p.estado === 'leyendo') return ESTADOS.leyendo;
  if (p.estado === 'espera') return ESTADOS.espera;
  if (p.estado === 'error') return ESTADOS.error;
  if (p.repetidoDe) return ['Repetido', 'repetido'];
  if (!p.propuesta?.carpetaId || !p.propuesta?.seguro) return ['No sé dónde va', 'duda'];
  return ['Para confirmar', 'confirmar'];
}

export async function pendientesOrdenados(m) {
  return (await m.col.pendientes.listar()).sort((a, b) => a.creado - b.creado);
}

export async function pantallaPendientes(ctx, m, d, main) {
  const { h } = ctx;
  const lista = await pendientesOrdenados(m);
  const zona = h('div', { class: 'bt-or-zona', onclick: () => elegirDelDispositivo(ctx, m) },
    ic('clip'), h('span', {}, h('b', {}, 'Subir archivos'),
      h('small', {}, 'Tocá para elegir, arrastralos acá o compartilos desde cualquier app con "Compartir › Segundo Cerebro".')));
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('encima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault(); zona.classList.remove('encima');
    const archivos = [...(e.dataTransfer?.files || [])].map(f => ({ blob: f, nombre: f.name }));
    if (archivos.length) recibirArchivos(ctx, m, archivos, 'Arrastrado a la app');
  });
  poner(main,
    cabecera(ctx, { titulo: 'Para revisar', marca: ic('clip'), volver: { href: '#/bitacora', texto: 'Bitácora' } }),
    zona,
    !d.ajuste('gemini')?.api ? h('p', { class: 'nota bt-or-aviso' }, 'Para que la app lea los archivos sola, poné tu clave de Gemini en ', h('a', { href: '#/bitacora/ajustes' }, 'Configurar Bitácora'), '. Sin clave igual podés ordenarlos a mano.') : null,
    lista.length
      ? h('div', { class: 'bt-or-lista' }, lista.map(p => {
        const [texto, clase] = estadoDe(p);
        const pr = p.propuesta;
        const sub = p.estado === 'error' ? p.error : p.estado === 'espera' ? `${p.error} La app lo reintenta sola a las ${hora(p.proximo)}. Si estás apurado, tocalo y ordenalo a mano.` : p.estado === 'leyendo' ? 'Leyendo el archivo… (tocalo si querés ordenarlo a mano)' : [pr?.carpetaId ? d.nombreRuta(pr.carpetaId) : '¿Dónde lo guardo?', pr?.vence ? `vence ${fechaCorta(pr.vence)}` : ''].filter(Boolean).join(' · ');
        return h('div', { class: 'bt-or-item', role: 'button', tabindex: 0, onclick: () => revisar(ctx, m, p) },
          h('span', { class: 'bt-or-ext' }, (extension(p.original).slice(1) || 'arch').toUpperCase()),
          h('span', { class: 'bt-or-t' }, h('b', {}, pr?.nombre || p.original), h('small', {}, sub), h('small', {}, `${p.via} · ${haceCuanto(p.creado)}`)),
          h('span', { class: `bt-or-est ${clase}` }, texto),
          p.estado === 'error' || p.estado === 'espera' ? h('button', { type: 'button', class: 'boton bt-chico', onclick: (e) => { e.stopPropagation(); reintentar(ctx, m, p); } }, 'Reintentar ahora') : null);
      }))
      : vacio(ctx, 'No hay nada para revisar', 'Todo ordenado.'));
}

// ── Revisar y confirmar un archivo ──
const VENTANAS = [['0', 'El mismo día'], ['1', '1 día antes'], ['3', '3 días antes'], ['7', '1 semana antes']];

function interruptor(ctx, on) {
  const b = ctx.h('button', { type: 'button', class: `aj-switch${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on) });
  b.addEventListener('click', () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); });
  b.valor = () => b.classList.contains('on');
  return b;
}

// Crea (si faltan) las carpetas de una ruta "A › B › C". Devuelve el id de la última.
async function crearRuta(m, ruta) {
  let padre = '';
  for (const nombre of ruta.split('›').map(x => x.trim()).filter(Boolean)) {
    const d = await m.cargar();
    const ya = d.hijas(padre).find(c => comparar(c.nombre, nombre) === 0);
    padre = ya ? ya.id : await m.crearCarpeta({ nombre, padreId: padre });
  }
  return padre;
}

export async function revisar(ctx, m, p) {
  const { h } = ctx;
  const d = await m.cargar();
  const pr = p.propuesta || {};
  const ext = extension(p.original);
  const campo = (etiqueta, el) => h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, etiqueta), el);
  const nombre = h('input', { type: 'text', value: pr.nombre || sinExtension(p.original), autocomplete: 'off' });
  const que = h('input', { type: 'text', value: pr.que || '', placeholder: 'Ej. Factura de gas', autocomplete: 'off' });
  const de = h('input', { type: 'text', value: pr.de || '', placeholder: 'Empresa o persona', autocomplete: 'off' });
  const fecha = h('input', { type: 'date', value: pr.fecha || '' });
  const vence = h('input', { type: 'date', value: pr.vence || '' });
  const monto = h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, value: pr.monto || '' });

  // Dónde va: si está seguro, una sola carpeta (con "Cambiar"); si no, opciones para elegir.
  let actualizarMensual = null;
  let destino = pr.seguro ? pr.carpetaId : null;   // id ('' = Bandeja), 'nueva:<ruta>' o null
  let seguro = !!pr.seguro;
  const zonaLugar = h('div', { class: 'bt-or-lugar' });
  const nombreDestino = (x) => (x.startsWith('nueva:') ? `${x.slice(6)} (carpeta nueva)` : d.nombreRuta(x));
  const opciones = [...new Set([pr.carpetaId, ...(pr.alternativas || [])].filter(Boolean)).values()].map(id => [id, d.nombreRuta(id), 'carpeta']);
  if (pr.carpetaNueva) opciones.push([`nueva:${pr.carpetaNueva}`, `Crear "${pr.carpetaNueva}"`, 'mas']);
  function pintarLugar() {
    const otra = h('button', { type: 'button', class: 'boton bt-elegir-boton', onclick: async () => {
      const x = await elegirCarpeta(ctx, d, { titulo: 'Guardar en…', actual: destino });
      if (x !== null) { destino = x; seguro = false; pintarLugar(); }
    } }, ic('carpeta'), seguro ? 'Cambiar' : 'Otra carpeta…');
    if (seguro) { poner(zonaLugar, h('div', { class: 'bt-or-elegida' }, ic('carpeta'), h('b', {}, nombreDestino(destino)), otra)); return; }
    const elegidaAparte = destino !== null && !opciones.some(o => o[0] === destino);
    poner(zonaLugar,
      p.estado === 'listo' ? h('p', { class: 'bt-or-duda' }, opciones.length ? 'No estoy seguro de dónde va. ¿Es alguna de estas?' : 'No sé dónde va. Elegí una carpeta.') : null,
      opciones.length ? h('div', { class: 'bt-or-ops' }, opciones.map(([id, texto, icono]) => h('button', { type: 'button', class: `bt-or-op${destino === id ? ' sel' : ''}`, onclick: () => { destino = id; pintarLugar(); } }, ic(icono), texto))) : null,
      elegidaAparte ? h('div', { class: 'bt-or-elegida' }, ic('carpeta'), h('b', {}, nombreDestino(destino))) : null,
      otra);
    actualizarMensual?.();
  }
  pintarLugar();

  // Sugerencias.
  const tarea = interruptor(ctx, !!pr.vence);
  const dias = h('select', { 'aria-label': 'Cuándo avisar' }, VENTANAS.map(([v, t]) => h('option', { value: v }, t)));
  dias.value = d.ajuste('ordenar')?.dias ?? '3';
  const fin = interruptor(ctx, !!pr.monto);
  const hayFinanzas = await ctx.existeAccion?.('nuevo-gasto');
  const mensuales = listaMensuales(d);
  const mensual = interruptor(ctx, false);
  const filaSug = (sw, texto, nota, extra = null) => h('div', { class: 'bt-or-sug' }, sw, h('span', {}, texto, nota ? h('small', {}, nota) : null), extra);
  const repetida = p.repetidoDe ? d.nota(p.repetidoDe) : null;

  let dlg;
  const confirmar = async () => {
    if (destino === null) { ctx.aviso('Elegí primero dónde va.'); return; }
    const titulo = nombre.value.trim() || sinExtension(p.original);
    try {
      const carpetaId = destino.startsWith('nueva:') ? await crearRuta(m, destino.slice(6)) : destino;
      const archivo = { que: que.value.trim(), de: de.value.trim(), fecha: fecha.value, vence: vence.value, monto: Number(monto.value) || 0, contenido: pr.contenido || '', huella: p.huella };
      const notaId = await m.crearNota({ titulo, carpetaId, archivo, adjuntos: [{ ...p.adjunto, nombre: titulo + ext, origen: 'subido', principal: true }] });
      if (tarea.valor() && archivo.vence) {
        const cuando = sumarDias(archivo.vence, -Number(dias.value));
        await m.crearRecordatorio({ notaId, titulo: archivo.monto ? `Pagar ${archivo.que || titulo} (${plata(archivo.monto)})` : `Vence: ${titulo}`, fecha: cuando < hoyISO() ? hoyISO() : cuando });
        await m.guardarAjuste('ordenar', { dias: dias.value });
      }
      if (mensual.valor() && carpetaId) await agregarMensual(m, await m.cargar(), { carpetaId });
      await m.col.pendientes.borrar(p.id);
      dlg.close();
      ctx.aviso(`Guardado en ${(await m.cargar()).nombreRuta(carpetaId)}`, { accion: 'Abrir', alTocar: () => ctx.navegar(`bitacora/n/${notaId}`) });
      if (hayFinanzas && fin.valor() && archivo.monto) ctx.pedir('nuevo-gasto', { importe: archivo.monto, descripcion: [archivo.que, archivo.de].filter(Boolean).join(' · ') }).catch(e => ctx.aviso(e.message));
    } catch (e) { ctx.aviso(`No se pudo guardar: ${e.message}`); }
  };
  const descartar = async () => {
    if (!await ctx.confirmar(`¿Descartar "${p.original}"? El archivo va a la papelera de Drive.`, { si: 'Descartar', peligro: true })) return;
    await m.col.pendientes.borrar(p.id);
    ctx.archivos.borrar(p.adjunto).catch(() => {});
    dlg.close();
    ctx.aviso('Descartado');
  };

  dlg = ventana(ctx, 'Revisar archivo', h('div', { class: 'formulario-campos bt-or-rev' },
    h('p', { class: 'nota' }, p.original, ' · ', p.via, p.adjunto?.url ? [' · ', h('a', { href: p.adjunto.url, target: '_blank', rel: 'noopener' }, 'Ver archivo')] : null),
    repetida ? h('p', { class: 'bt-or-rep' }, 'Parece que ya lo tenés: ', h('a', { href: `#/bitacora/n/${repetida.id}`, onclick: () => dlg.close() }, repetida.titulo), ` (${d.nombreRuta(repetida.carpetaId)}). ¿Lo guardo igual?`) : null,
    p.estado === 'error' || p.estado === 'espera' ? h('p', { class: 'bt-or-duda' }, p.error, p.estado === 'espera' ? ' Completalo a mano, o cerrá esto y la app lo reintenta sola.' : '') : null,
    p.estado === 'leyendo' ? h('p', { class: 'bt-or-duda' }, 'Gemini todavía lo está leyendo. Podés completarlo a mano igual.') : null,
    campo('Nombre', nombre),
    h('div', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Dónde va'), zonaLugar),
    campo('Qué es', que), campo('De', de),
    h('div', { class: 'bt-or-dos' }, campo('Fecha', fecha), campo('Vence', vence)),
    campo('Monto', monto),
    h('div', { class: 'bt-or-sugs' },
      filaSug(tarea, 'Crear tarea por el vencimiento', 'En Tareas › Sistemas › Bitácora.', dias),
      hayFinanzas ? filaSug(fin, 'Cargar el gasto en Finanzas', 'Se abre el formulario de gasto con el monto, para que elijas cuenta y categoría.') : null,
      filaSug(mensual, '¿Llega todos los meses? Sumarlo a Cargas mensuales', 'Si un mes falta, te aviso con una tarea.'))),
  { botones: [
    h('button', { type: 'button', class: 'boton peligro', onclick: descartar }, repetida ? 'No guardar' : 'Descartar'),
    h('span', { class: 'bt-espacio' }),
    h('button', { type: 'button', class: 'boton principal', onclick: confirmar }, repetida ? 'Guardar igual' : 'Confirmar')] });
  // La casilla de mensual solo tiene sentido si la carpeta elegida no es ya mensual.
  actualizarMensual = () => { mensual.parentElement.hidden = !!destino && mensuales.some(x => x.carpetaId === destino); };
  actualizarMensual();
  vence.addEventListener('change', () => { if (vence.value && !tarea.valor()) tarea.click(); });
}

// ── Cargas mensuales ──
export const listaMensuales = (d) => d.ajuste('mensuales')?.lista || [];

// La nota "archivo" subida en esa carpeta (o sus subcarpetas) en ese mes, si hay.
export function subidoEnMes(d, carpetaId, mes) {
  const ids = new Set([carpetaId, ...d.descendientes(carpetaId).map(c => c.id)]);
  return d.notas.filter(n => n.archivo && ids.has(n.carpetaId) && mesDe(n.creado) === mes).sort((a, b) => a.creado - b.creado)[0] || null;
}

export async function agregarMensual(m, d, { carpetaId, dia = null }) {
  const lista = listaMensuales(d);
  if (lista.some(x => x.carpetaId === carpetaId)) return;
  const hoy = new Date().getDate();
  lista.push({ id: Math.random().toString(36).slice(2, 9), carpetaId, dia: dia || Math.min(28, hoy + 5) });
  await m.guardarAjuste('mensuales', { lista });
}

// Carpetas donde subiste un archivo los dos meses anteriores y que todavía no son mensuales.
export function sugerenciasMensuales(d) {
  const mes = mesDe(Date.now());
  const ya = new Set([...listaMensuales(d).map(x => x.carpetaId), ...(d.ajuste('mensuales')?.descartadas || [])]);
  const porCarpeta = new Map();
  for (const n of d.notas) if (n.archivo && n.carpetaId && !ya.has(n.carpetaId)) {
    if (!porCarpeta.has(n.carpetaId)) porCarpeta.set(n.carpetaId, new Set());
    porCarpeta.get(n.carpetaId).add(mesDe(n.creado));
  }
  return [...porCarpeta].filter(([, meses]) => meses.has(restarMes(mes, 1)) && meses.has(restarMes(mes, 2))).map(([id]) => id).filter(id => d.carpeta(id));
}

export function seccionMensuales(ctx, m, d) {
  const { h } = ctx;
  const mes = mesDe(Date.now());
  const lista = listaMensuales(d).filter(x => d.carpeta(x.carpetaId));
  const guardar = (cambios) => m.guardarAjuste('mensuales', { lista: listaMensuales(d), descartadas: d.ajuste('mensuales')?.descartadas || [], ...cambios });
  const editar = async (x) => {
    const r = await ctx.formulario({ titulo: x ? 'Carga mensual' : 'Nueva carga mensual', textoGuardar: 'Guardar', campos: [
      { id: 'carpetaId', etiqueta: 'Carpeta', tipo: 'seleccion', requerido: true, valor: x?.carpetaId || '', opciones: d.carpetas.filter(c => !c.sistema).map(c => ({ valor: c.id, texto: d.nombreRuta(c.id) })) },
      { id: 'dia', etiqueta: 'Si falta, avisarme el día', tipo: 'numero', requerido: true, valor: x?.dia || 10 },
    ] });
    if (!r) return;
    const dia = Math.max(1, Math.min(28, Math.round(Number(r.dia) || 10)));
    const otra = listaMensuales(d).filter(y => y.id !== x?.id && y.carpetaId !== r.carpetaId);
    await guardar({ lista: [...otra, { id: x?.id || Math.random().toString(36).slice(2, 9), carpetaId: r.carpetaId, dia }] });
  };
  const sugeridas = sugerenciasMensuales(d);
  return h('section', { class: 'tarjeta' },
    h('div', { class: 'bt-bloque-tit' }, h('h2', {}, 'Cargas mensuales'), h('button', { type: 'button', class: 'boton', onclick: () => editar(null) }, ic('mas'), 'Agregar')),
    h('p', { class: 'nota' }, `Lo que esperás subir todos los meses. Si llega el día y en ${nombreMes(mes)} no subiste nada en esa carpeta, aparece una tarea en Tareas › Sistemas › Bitácora.`),
    sugeridas.map(id => h('div', { class: 'bt-or-sugm' },
      h('span', {}, 'Subiste algo en ', h('b', {}, d.nombreRuta(id)), ` en ${nombreMes(restarMes(mes, 2))} y ${nombreMes(restarMes(mes, 1))}. ¿Lo agrego a las cargas mensuales?`),
      h('span', { class: 'bt-or-sugm-b' },
        h('button', { type: 'button', class: 'boton', onclick: () => guardar({ descartadas: [...(d.ajuste('mensuales')?.descartadas || []), id] }) }, 'No'),
        h('button', { type: 'button', class: 'boton principal', onclick: () => agregarMensual(m, d, { carpetaId: id }) }, 'Sí, agregar')))),
    lista.length
      ? h('div', { class: 'aj-tabla' }, lista.map(x => {
        const n = subidoEnMes(d, x.carpetaId, mes);
        return h('div', { class: 'aj-fila' },
          h('span', { class: 'aj-nombre' }, d.nombreRuta(x.carpetaId), h('small', { class: 'bt-nota-chica' }, `si falta, aviso el día ${x.dia}`)),
          h('span', { class: 'aj-acciones' },
            n ? h('a', { href: `#/bitacora/n/${n.id}`, class: 'bt-or-ok' }, `Subido ${new Date(n.creado).getDate()}/${new Date(n.creado).getMonth() + 1}`) : h('span', { class: 'bt-or-falta' }, 'Falta'),
            h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Editar', onclick: () => editar(x) }, ic('editar')),
            h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Quitar', onclick: async () => { if (await ctx.confirmar(`¿Dejar de esperar "${d.nombreRuta(x.carpetaId)}" todos los meses?`, { si: 'Quitar' })) await guardar({ lista: listaMensuales(d).filter(y => y.id !== x.id) }); } }, ic('papelera'))));
      }))
      : h('p', { class: 'nota' }, 'Todavía no hay cargas mensuales.'));
}

// Las tareas "Falta subir…" en Tareas › Sistemas › Bitácora.
let corriendo = false;
export async function sincronizarMensuales(ctx, m) {
  if (corriendo) return;
  corriendo = true;
  try {
    if (!await ctx.existeAccion?.('sistema-sincronizar')) return;
    const d = await m.cargar();
    const hoy = hoyISO(), mes = hoy.slice(0, 7), dia = Number(hoy.slice(8, 10));
    const tareas = [];
    for (const x of listaMensuales(d)) {
      if (!d.carpeta(x.carpetaId) || dia < x.dia || subidoEnMes(d, x.carpetaId, mes)) continue;
      tareas.push({
        clave: `bitacora-mes:${x.id}:${mes}`, titulo: `Falta subir: ${d.carpeta(x.carpetaId).nombre} de ${nombreMes(mes)}`,
        fecha: `${mes}-${String(x.dia).padStart(2, '0')}`, destino: 'sistema:bitacora',
        notas: `Carga mensual de la Bitácora (${d.nombreRuta(x.carpetaId)}). Se tilda sola cuando lo subas.`, enlace: 'bitacora/pendientes',
      });
    }
    await ctx.pedir('sistema-sincronizar', { modulo: 'bitacora', prefijo: 'bitacora-mes:', tareas });
  } catch (e) {
    console.warn('No se pudieron actualizar las cargas mensuales', e);
  } finally {
    corriendo = false;
  }
}

// ── Configurar: clave de Gemini y carpeta de Drive ──
export function seccionArchivos(ctx, m, d) {
  const { h } = ctx;
  const clave = h('input', { type: 'password', value: d.ajuste('gemini')?.api || '', placeholder: 'Pegá tu clave acá', autocomplete: 'off', 'aria-label': 'Clave de Gemini' });
  // Lo guardado se ve siempre; el resultado de la prueba va como aviso
  // (al guardar, la pantalla se redibuja y un texto acá se perdería).
  const guardada = d.ajuste('gemini')?.api;
  const estado = h('p', { class: 'nota' }, guardada ? `Clave guardada${d.ajuste('gemini')?.ok ? ' y funcionando' : ''}.` : 'Sin clave: los archivos se ordenan a mano.');
  const probar = async () => {
    const v = clave.value.trim();
    if (!v) { await m.guardarAjuste('gemini', { api: '', ok: false }); ctx.aviso('Clave borrada.'); return; }
    const espera = ctx.aviso('Probando la clave…', { duracion: 0 });
    try {
      await pedirGemini(v, { contents: [{ role: 'user', parts: [{ text: 'Respondé solo: ok' }] }] });
      espera.remove();
      await m.guardarAjuste('gemini', { api: v, ok: true });
      ctx.aviso('Clave guardada y funcionando.');
    } catch (e) {
      espera.remove();
      await m.guardarAjuste('gemini', { api: v, ok: false });
      ctx.aviso(`Clave guardada, pero falló la prueba: ${e.message}`, { duracion: 8000 });
    }
  };
  return h('section', { class: 'tarjeta' }, h('h2', {}, 'Archivos para ordenar'),
    h('p', { class: 'nota' }, 'La app lee cada archivo con Gemini y te propone nombre, carpeta y datos. La clave se saca gratis en ', h('a', { href: 'https://aistudio.google.com/app/apikey', target: '_blank', rel: 'noopener' }, 'Google AI Studio'), ' (botón "Create API key") y se guarda en tu cuenta.'),
    h('label', { class: 'fila-campo' }, h('span', { class: 'etiqueta-campo' }, 'Clave de Gemini'), clave),
    h('div', { class: 'botonera' }, h('button', { type: 'button', class: 'boton principal', onclick: probar }, 'Guardar y probar')),
    estado,
    h('p', { class: 'nota' }, 'Para subir: botón "Archivos" en la Bitácora (en la PC también podés arrastrarlos), o en el celular Compartir › Segundo Cerebro.'));
}

// ── Ficha de una nota "archivo" ──
export function fichaArchivo(ctx, m, n) {
  const { h } = ctx;
  const a = n.archivo;
  const p = (n.adjuntos || []).find(x => x.principal);
  const dato = (t, v) => (v ? h('div', {}, h('small', {}, t), v) : null);
  const guardar = (cambios) => m.guardarNota(n.id, { archivo: { ...a, ...cambios } });
  const editar = async () => {
    const r = await ctx.formulario({ titulo: 'Datos del archivo', textoGuardar: 'Guardar', campos: [
      { id: 'que', etiqueta: 'Qué es', tipo: 'texto', valor: a.que || '' },
      { id: 'de', etiqueta: 'De', tipo: 'texto', valor: a.de || '' },
      { id: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', valor: a.fecha || '' },
      { id: 'vence', etiqueta: 'Vence', tipo: 'fecha', valor: a.vence || '' },
      { id: 'monto', etiqueta: 'Monto', tipo: 'numero', valor: a.monto || '' },
    ] });
    if (r) await guardar({ ...r, monto: Number(r.monto) || 0 });
  };

  // Lectura de Gemini (archivos subidos directo a una carpeta).
  const lectura = a.lectura === 'leyendo' ? h('p', { class: 'bt-or-duda' }, 'Gemini está leyendo el archivo para completar los datos…')
    : a.lectura === 'espera' ? h('p', { class: 'bt-or-duda' }, `${a.error || 'Gemini está ocupado.'} La app lo reintenta sola${a.proximo ? ` a las ${hora(a.proximo)}` : ''}. `,
      h('button', { type: 'button', class: 'boton bt-chico', onclick: () => aLaColaNota(ctx, m, n.id) }, 'Reintentar ahora'))
      : a.lectura === 'error' ? h('p', { class: 'bt-or-duda' }, `${a.error} Podés completar los datos a mano.`) : null;

  // Sugerencias: tarea por el vencimiento y gasto en Finanzas.
  const sug = a.sugerir || {};
  const dias = h('select', { 'aria-label': 'Cuándo avisar' }, VENTANAS.map(([v, t]) => h('option', { value: v }, t)));
  dias.value = '3';
  const crearTarea = async () => {
    const cuando = sumarDias(a.vence, -Number(dias.value));
    await m.crearRecordatorio({ notaId: n.id, titulo: a.monto ? `Pagar ${a.que || n.titulo} (${plata(a.monto)})` : `Vence: ${n.titulo}`, fecha: cuando < hoyISO() ? hoyISO() : cuando });
    await guardar({ sugerir: { ...sug, tarea: false } });
    ctx.aviso('Tarea creada en Tareas › Sistemas › Bitácora.');
  };
  const cargarGasto = async () => {
    await guardar({ sugerir: { ...sug, gasto: false } });
    ctx.pedir('nuevo-gasto', { importe: a.monto, descripcion: [a.que, a.de].filter(Boolean).join(' · ') }).catch(e => ctx.aviso(e.message));
  };
  const sugerencias = (sug.tarea && a.vence) || (sug.gasto && a.monto) ? h('div', { class: 'bt-ficha-sug' },
    sug.tarea && a.vence ? h('div', { class: 'bt-or-sug' }, h('span', {}, `Vence el ${fechaCorta(a.vence)}. ¿Creo la tarea?`), dias, h('button', { type: 'button', class: 'boton principal', onclick: crearTarea }, 'Crear tarea')) : null,
    sug.gasto && a.monto ? h('div', { class: 'bt-or-sug' }, h('span', {}, `Monto ${plata(a.monto)}. ¿Lo cargo en Finanzas?`), h('button', { type: 'button', class: 'boton principal', onclick: cargarGasto }, 'Cargar gasto')) : null,
    h('button', { type: 'button', class: 'bt-link-chico bt-ficha-no', onclick: () => guardar({ sugerir: {} }) }, 'No, gracias')) : null;

  return h('div', { class: 'bt-ficha' },
    p ? portada(ctx, p) : null,
    lectura,
    sugerencias,
    h('div', { class: 'bt-ficha-datos' }, dato('Qué es', a.que), dato('De', a.de), dato('Fecha', a.fecha ? fechaCorta(a.fecha) : ''), dato('Monto', a.monto ? plata(a.monto) : ''), dato('Vence', a.vence ? fechaCorta(a.vence) : '')),
    h('div', { class: 'bt-ficha-bot' },
      p?.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener', class: 'boton' }, ic('drive'), 'Abrir en Drive') : p?.pendiente ? h('span', { class: 'nota' }, 'El archivo se está subiendo…') : null,
      h('button', { type: 'button', class: 'boton', onclick: editar }, ic('editar'), 'Editar datos')),
    a.contenido ? h('details', { class: 'bt-ficha-txt' }, h('summary', {}, 'Qué dice adentro'), h('p', {}, a.contenido)) : null);
}

export { BANDEJA };
