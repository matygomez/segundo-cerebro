// ─────────────────────────────────────────────────────────────
// Bitácora: datos y reglas (sin pantallas).
//
// Colecciones (Segundo Cerebro/bitacora/*.json):
//   carpetas     { nombre, padreId, color, icono, orden, base, campos[], vistas[] }
//   notas        { titulo, carpetaId ('' = Bandeja), texto (Markdown), props{},
//                  etiquetas[], fijada, papelera (ms o 0), adjuntos[],
//                  archivo? { que, de, fecha, vence, monto, contenido, huella } }
//                  (archivo: la nota es un documento ordenado; su adjunto
//                  "principal" va en Drive junto a la nota, con el mismo nombre)
//   plantillas   { nombre, icono, carpetaId, titulo, texto, rapida, orden }
//   recordatorios{ notaId, titulo, fecha, creada }
//   pendientes   archivos esperando que confirmes dónde van (ver ordenar.js)
//   ajustes      { clave, ... }  (inicio y plegados por dispositivo, tipos ocultos)
//   espejo       lo usa el núcleo para la copia .md en Drive
//
// Una carpeta con base=true es una base de datos: sus notas tienen los
// campos de la carpeta (props[campoId]) y se ven como tabla o tarjetas.
// ─────────────────────────────────────────────────────────────

export const BANDEJA = '';
export const DIAS_PAPELERA = 30;

// ── Tipos de campo ──
export const TIPOS = [
  { id: 'texto', nombre: 'Texto', sym: 'Aa' },
  { id: 'numero', nombre: 'Número', sym: '#' },
  { id: 'fecha', nombre: 'Fecha', sym: '', icono: 'calendario' },
  { id: 'sino', nombre: 'Sí / No', sym: '✓' },
  { id: 'opcion', nombre: 'Opción única', sym: '◉' },
  { id: 'opciones', nombre: 'Varias opciones', sym: '☰' },
  { id: 'link', nombre: 'Link', sym: '', icono: 'link' },
  { id: 'telefono', nombre: 'Teléfono', sym: '', icono: 'telefono' },
  { id: 'mail', nombre: 'Mail', sym: '@' },
  { id: 'relacion', nombre: 'Relación con nota', sym: '↗' },
  { id: 'archivo', nombre: 'Archivo', sym: '', icono: 'clip' },
  { id: 'calificacion', nombre: 'Calificación', sym: '★' },
  { id: 'progreso', nombre: 'Progreso', sym: '%' },
  { id: 'auto', nombre: 'Creada / editada', sym: '', icono: 'reloj' },
];
export const tipo = (id) => TIPOS.find(t => t.id === id) || TIPOS[0];
export const NUMERICOS = ['numero', 'calificacion', 'progreso'];
export const COLORES_OPCION = ['verde', 'azul', 'laton', 'violeta', 'rojo', 'gris'];
export const COLORES_CARPETA = ['#2F5E8C', '#A3423A', '#2C6A5A', '#6B4E9B', '#93702A', '#3E7C8C', '#B0654A', '#7D888C'];

// ── Utilidades ──
const pad = (n) => String(n).padStart(2, '0');
export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const sumarDias = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); const f = new Date(a, m - 1, d + n); return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`; };
export const fechaCorta = (iso) => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); const f = new Date(a, m - 1, d); return f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', ...(a !== new Date().getFullYear() ? { year: 'numeric' } : {}) }).replace('.', ''); };
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const comparar = (a, b) => sinTildes(a).localeCompare(sinTildes(b), 'es', { numeric: true });
export const nuevoIdCorto = () => Math.random().toString(36).slice(2, 9);
export const escaparRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function plantillaTitulo(patron) {
  const d = new Date();
  return String(patron || '')
    .replace(/\{fecha\}/g, `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`)
    .replace(/\{hora\}/g, `${pad(d.getHours())}:${pad(d.getMinutes())}`)
    .trim();
}

// ── Texto: etiquetas y enlaces ──
const RE_ETIQUETA = /(^|[\s(])#([\p{L}\p{N}_\-/]*[\p{L}_\-][\p{L}\p{N}_\-/]*)/gu;
const RE_ENLACE = /(!?)\[\[([^\]|#\n]+)(#[^\]|\n]*)?(\|[^\]\n]*)?\]\]/g;
const sinCodigo = (t) => String(t || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');

export function etiquetasDeTexto(texto) {
  const salida = new Set();
  for (const m of sinCodigo(texto).matchAll(RE_ETIQUETA)) salida.add(m[2].replace(/\/+$/, '').toLowerCase());
  return [...salida].filter(Boolean);
}
export function etiquetasDe(n) {
  return [...new Set([...(n.etiquetas || []).map(e => String(e).replace(/^#/, '').toLowerCase()), ...etiquetasDeTexto(n.texto)])].filter(Boolean);
}
// Enlaces [[...]] (sin los ![[...]] de imágenes).
export function enlacesDe(texto) {
  const salida = [];
  for (const m of sinCodigo(texto).matchAll(RE_ENLACE)) if (!m[1]) salida.push(m[2].trim());
  return salida;
}
// Cambia [[Viejo]] por [[Nuevo]] (también [[Viejo|alias]] y [[Viejo#título]]).
export function renombrarEnlaces(texto, viejo, nuevo) {
  const re = new RegExp(`(!?)\\[\\[\\s*${escaparRegex(viejo)}\\s*(#[^\\]|\\n]*)?(\\|[^\\]\\n]*)?\\]\\]`, 'gi');
  return String(texto || '').replace(re, (_, emb, anc = '', ali = '') => `${emb}[[${nuevo}${anc || ''}${ali || ''}]]`);
}

// Lo que se puede buscar de un documento ordenado (datos y lo que dice adentro).
export const textoArchivo = (n) => (n.archivo ? [n.archivo.que, n.archivo.de, n.archivo.contenido].filter(Boolean).join(' ') : '');

// Primer pedacito del texto, para listas.
export function resumen(texto, largo = 120) {
  const limpio = String(texto || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[\[[^\]]*\]\]/g, '[imagen]')
    .replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_, a, __, b) => b || a)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '').replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/[*_~=`]/g, '').replace(/\s+/g, ' ').trim();
  return limpio.length > largo ? limpio.slice(0, largo - 1) + '…' : limpio;
}

// ── Archivo .md (copia en Drive, formato Obsidian) ──
const claveYaml = (k) => (/^[\p{L}\p{N} _-]+$/u.test(k) ? k : JSON.stringify(k));
export const nombreArchivo = (titulo) => (String(titulo || 'Sin título').replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Sin título');

export function valorYaml(campo, v, d) {
  if (campo.tipo === 'auto') return null;
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
  switch (campo.tipo) {
    case 'numero': case 'calificacion': case 'progreso': return Number.isFinite(Number(v)) ? String(Number(v)) : null;
    case 'sino': return v ? 'true' : 'false';
    case 'fecha': return String(v).slice(0, 10);
    case 'opcion': { const o = (campo.opciones || []).find(x => x.id === v); return o ? JSON.stringify(o.nombre) : null; }
    case 'opciones': { const ns = (Array.isArray(v) ? v : []).map(id => (campo.opciones || []).find(x => x.id === id)?.nombre).filter(Boolean); return ns.length ? `[${ns.map(x => JSON.stringify(x)).join(', ')}]` : null; }
    case 'relacion': { const n = d?.nota(v); return n ? JSON.stringify(`[[${n.titulo}]]`) : null; }
    case 'archivo': return v?.nombre ? JSON.stringify(v.nombre) : null;
    default: return JSON.stringify(String(v));
  }
}

export function aMarkdown(n, d) {
  const lineas = [];
  const c = d.carpeta(n.carpetaId);
  if (c?.base) {
    for (const campo of c.campos || []) {
      const v = valorYaml(campo, n.props?.[campo.id], d);
      if (v !== null) lineas.push(`${claveYaml(campo.nombre)}: ${v}`);
    }
  }
  if (n.cine) {
    const ci = n.cine, est = { paraver: 'Para ver', viendo: 'Viendo', vista: 'Vista', abandonada: 'Abandonada', volver: 'Volver a ver' };
    lineas.push(`tipo: ${ci.tipo === 'tv' ? 'Serie' : 'Película'}`);
    if (ci.original) lineas.push(`titulo_original: ${JSON.stringify(ci.original)}`);
    if (ci.anio) lineas.push(`año: ${ci.anio}`);
    lineas.push(`estado: ${JSON.stringify(est[ci.estado] || ci.estado)}`);
    if (ci.calificacion) lineas.push(`calificación: ${ci.calificacion}`);
    if (ci.recomendada) lineas.push(`recomendada_por: ${JSON.stringify(ci.recomendada)}`);
    if (ci.generos?.length) lineas.push(`géneros: [${ci.generos.map(g => JSON.stringify(g)).join(', ')}]`);
    if (ci.vistas?.length) lineas.push(`vista: [${ci.vistas.join(', ')}]`);
    if (ci.tipo === 'tv') lineas.push(`episodios_vistos: ${Object.keys(ci.vistos || {}).length}`);
    if (ci.tmdb) lineas.push(`tmdb: https://www.themoviedb.org/${ci.tipo}/${ci.tmdb}`);
  }
  if (n.archivo) {
    const a = n.archivo;
    for (const [k, v] of [['qué_es', a.que], ['de', a.de], ['fecha', a.fecha], ['vence', a.vence]]) if (v) lineas.push(`${k}: ${JSON.stringify(String(v))}`);
    if (a.monto) lineas.push(`monto: ${Number(a.monto)}`);
    const p = (n.adjuntos || []).find(x => x.principal);
    if (p) lineas.push(`archivo: ${JSON.stringify(`[[${p.nombre}]]`)}`);
  }
  const tags = (n.etiquetas || []).map(e => String(e).replace(/^#/, '')).filter(Boolean);
  if (tags.length) lineas.push(`tags: [${tags.map(t => JSON.stringify(t)).join(', ')}]`);
  const cabecera = lineas.length ? `---\n${lineas.join('\n')}\n---\n` : '';
  return cabecera + String(n.texto || '');
}

// ── Valores de campos ──
export function valorCampo(n, campo) {
  if (campo.tipo === 'auto') return campo.auto === 'creada' ? n.creado : n.modificado;
  return n.props?.[campo.id];
}
export const vacioV = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !v.nombre && !v.driveId && !v.pendiente);

export function textoValor(campo, v, d) {
  if (vacioV(v) && campo.tipo !== 'sino') return '';
  switch (campo.tipo) {
    case 'numero': return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 });
    case 'fecha': return fechaCorta(v);
    case 'auto': return v ? new Date(v).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '';
    case 'sino': return v ? 'Sí' : 'No';
    case 'opcion': return (campo.opciones || []).find(o => o.id === v)?.nombre || '';
    case 'opciones': return (v || []).map(id => (campo.opciones || []).find(o => o.id === id)?.nombre).filter(Boolean).join(', ');
    case 'relacion': return d?.nota(v)?.titulo || '';
    case 'archivo': return v?.nombre || '';
    case 'calificacion': return '★'.repeat(Number(v) || 0);
    case 'progreso': return `${Number(v) || 0}%`;
    default: return String(v);
  }
}

// Clave para ordenar.
function claveOrden(n, campoId, carpeta, d) {
  if (campoId === '_titulo') return sinTildes(n.titulo);
  if (campoId === '_creada') return n.creado;
  if (campoId === '_editada' || !campoId) return n.modificado;
  const campo = (carpeta?.campos || []).find(c => c.id === campoId);
  if (!campo) return n.modificado;
  const v = valorCampo(n, campo);
  if (NUMERICOS.includes(campo.tipo)) return vacioV(v) ? null : Number(v);
  if (campo.tipo === 'sino') return v ? 1 : 0;
  if (campo.tipo === 'opcion') { const i = (campo.opciones || []).findIndex(o => o.id === v); return i < 0 ? null : i; }
  if (campo.tipo === 'fecha') return v || null;
  if (campo.tipo === 'auto') return v;
  const t = textoValor(campo, v, d);
  return t ? sinTildes(t) : null;
}

// ── Filtros ──
export const OPERADORES = {
  texto: [['contiene', 'contiene'], ['no-contiene', 'no contiene'], ['es', 'es'], ['vacio', 'está vacío'], ['no-vacio', 'no está vacío']],
  numero: [['igual', '='], ['distinto', '≠'], ['mayor', '>'], ['menor', '<'], ['vacio', 'está vacío'], ['no-vacio', 'no está vacío']],
  fecha: [['es', 'es'], ['antes', 'antes de'], ['despues', 'después de'], ['este-mes', 'este mes'], ['pasada', 'ya pasó'], ['futura', 'de hoy en adelante'], ['vacio', 'está vacía'], ['no-vacio', 'tiene fecha']],
  sino: [['si', 'es Sí'], ['no', 'es No']],
  opcion: [['es', 'es'], ['no-es', 'no es'], ['vacio', 'está vacío'], ['no-vacio', 'no está vacío']],
  opciones: [['tiene', 'incluye'], ['no-tiene', 'no incluye'], ['vacio', 'está vacío'], ['no-vacio', 'no está vacío']],
  relacion: [['es', 'es'], ['vacio', 'está vacío'], ['no-vacio', 'no está vacío']],
};
export function operadoresDe(t) {
  if (NUMERICOS.includes(t)) return OPERADORES.numero;
  if (t === 'fecha' || t === 'auto') return OPERADORES.fecha;
  return OPERADORES[t] || OPERADORES.texto;
}
export const necesitaValor = (op) => !['vacio', 'no-vacio', 'si', 'no', 'este-mes', 'pasada', 'futura'].includes(op);

export function cumple(n, f, carpeta, d) {
  const campo = (carpeta?.campos || []).find(c => c.id === f.campo);
  if (!campo) return true;
  let v = valorCampo(n, campo);
  if (campo.tipo === 'auto' && v) { const x = new Date(v); v = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; }
  const vacio = vacioV(v);
  switch (f.op) {
    case 'vacio': return campo.tipo === 'sino' ? !v : vacio;
    case 'no-vacio': return campo.tipo === 'sino' ? !!v : !vacio;
    case 'si': return !!v;
    case 'no': return !v;
  }
  if (NUMERICOS.includes(campo.tipo)) {
    if (vacio) return false;
    const a = Number(v), b = Number(String(f.valor).replace(',', '.'));
    return { igual: a === b, distinto: a !== b, mayor: a > b, menor: a < b }[f.op] ?? true;
  }
  if (campo.tipo === 'fecha' || campo.tipo === 'auto') {
    if (vacio) return false;
    const hoy = hoyISO();
    return { es: v === f.valor, antes: v < f.valor, despues: v > f.valor, 'este-mes': v.slice(0, 7) === hoy.slice(0, 7), pasada: v < hoy, futura: v >= hoy }[f.op] ?? true;
  }
  if (campo.tipo === 'opcion' || campo.tipo === 'relacion') return f.op === 'no-es' ? v !== f.valor : v === f.valor;
  if (campo.tipo === 'opciones') { const tiene = (v || []).includes(f.valor); return f.op === 'no-tiene' ? !tiene : tiene; }
  const t = sinTildes(textoValor(campo, v, d)), q = sinTildes(f.valor);
  return { contiene: t.includes(q), 'no-contiene': !t.includes(q), es: t === q }[f.op] ?? true;
}

// Notas de una base según una vista: filtradas, ordenadas y (si corresponde) agrupadas.
export function aplicarVista(notas, vista, carpeta, d) {
  let lista = notas.filter(n => (vista.filtros || []).every(f => cumple(n, f, carpeta, d)));
  const { campo = '_editada', dir = campo === '_titulo' ? 'asc' : 'desc' } = vista.orden || {};
  lista = lista.map(n => [claveOrden(n, campo, carpeta, d), n]).sort((x, y) => {
    const [a, b] = [x[0], y[0]];
    if (a === null && b === null) return comparar(x[1].titulo, y[1].titulo);
    if (a === null) return 1;
    if (b === null) return -1;
    const r = typeof a === 'string' ? comparar(a, b) : a - b;
    return (dir === 'asc' ? r : -r) || comparar(x[1].titulo, y[1].titulo);
  }).map(x => x[1]);
  const grupoCampo = (carpeta?.campos || []).find(c => c.id === vista.agrupar);
  if (!grupoCampo) return [{ clave: '', titulo: '', notas: lista }];
  const grupos = new Map();
  const meter = (clave, titulo, n, orden) => { if (!grupos.has(clave)) grupos.set(clave, { clave, titulo, notas: [], orden }); grupos.get(clave).notas.push(n); };
  for (const n of lista) {
    const v = valorCampo(n, grupoCampo);
    if (grupoCampo.tipo === 'opcion') { const i = (grupoCampo.opciones || []).findIndex(o => o.id === v); meter(i < 0 ? '' : v, i < 0 ? 'Sin valor' : grupoCampo.opciones[i].nombre, n, i < 0 ? 999 : i); }
    else if (grupoCampo.tipo === 'opciones') { const ids = (v || []).filter(id => (grupoCampo.opciones || []).some(o => o.id === id)); if (!ids.length) meter('', 'Sin valor', n, 999); else for (const id of ids) { const i = grupoCampo.opciones.findIndex(o => o.id === id); meter(id, grupoCampo.opciones[i].nombre, n, i); } }
    else if (grupoCampo.tipo === 'sino') meter(v ? 'si' : 'no', v ? 'Sí' : 'No', n, v ? 0 : 1);
    else if (grupoCampo.tipo === 'fecha') { const k = v ? String(v).slice(0, 7) : ''; meter(k, k ? new Date(`${k}-01T12:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'Sin fecha', n, k || '9999'); }
    else { const t = textoValor(grupoCampo, v, d); meter(t, t || 'Sin valor', n, t ? sinTildes(t) : '￿'); }
  }
  return [...grupos.values()].sort((a, b) => (typeof a.orden === 'number' && typeof b.orden === 'number' ? a.orden - b.orden : String(a.orden).localeCompare(String(b.orden))));
}

export const TOTALES = {
  numerico: [['suma', 'Suma'], ['promedio', 'Promedio'], ['min', 'Mínimo'], ['max', 'Máximo'], ['llenos', 'Con valor'], ['', 'Calcular']],
  sino: [['marcados', 'Cantidad Sí'], ['', 'Calcular']],
  otro: [['llenos', 'Con valor'], ['', 'Calcular']],
};
export const totalesDe = (campo) => (NUMERICOS.includes(campo.tipo) ? TOTALES.numerico : campo.tipo === 'sino' ? TOTALES.sino : TOTALES.otro);
export const totalPorDefecto = (campo) => (NUMERICOS.includes(campo.tipo) ? 'suma' : campo.tipo === 'sino' ? 'marcados' : '');
export function calcularTotal(notas, campo, modo) {
  if (!modo) return '';
  const vals = notas.map(n => valorCampo(n, campo));
  if (modo === 'marcados') return `${vals.filter(Boolean).length} sí`;
  if (modo === 'llenos') return `${vals.filter(v => !vacioV(v)).length} con valor`;
  const nums = vals.filter(v => !vacioV(v)).map(Number).filter(Number.isFinite);
  if (!nums.length) return '—';
  const r = { suma: nums.reduce((a, b) => a + b, 0), promedio: nums.reduce((a, b) => a + b, 0) / nums.length, min: Math.min(...nums), max: Math.max(...nums) }[modo];
  const t = r.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return campo.tipo === 'progreso' ? `${t}%` : t;
}

// ── Modelo ──
export function crearModelo(ctx) {
  const col = {
    carpetas: ctx.datos('carpetas'),
    notas: ctx.datos('notas'),
    plantillas: ctx.datos('plantillas'),
    recordatorios: ctx.datos('recordatorios'),
    ajustes: ctx.datos('ajustes'),
    cine: ctx.datos('cine'),   // Filmoteca: datos de TMDB que cambian (plataformas, episodios, estrenos)
    pendientes: ctx.datos('pendientes'),   // archivos para ordenar
  };

  async function cargar() {
    const [carpetas, notasTodas, plantillas, recordatorios, ajustes, cine, pendientes] = await Promise.all([
      col.carpetas.listar(), col.notas.listar(), col.plantillas.listar(), col.recordatorios.listar(), col.ajustes.listar(), col.cine.listar(), col.pendientes.listar(),
    ]);
    const cinePorClave = new Map(cine.sort((a, b) => (a.actualizado || 0) - (b.actualizado || 0)).map(x => [x.clave, x]));
    const porId = new Map(carpetas.map(c => [c.id, c]));
    // Una carpeta cuyo padre ya no existe queda en la raíz.
    for (const c of carpetas) if (c.padreId && !porId.has(c.padreId)) c.padreId = '';
    const ordenar = (l) => l.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || comparar(a.nombre, b.nombre));
    const notas = notasTodas.filter(n => !n.papelera);
    for (const n of notas) if (n.carpetaId && !porId.has(n.carpetaId)) n.carpetaId = BANDEJA;
    const notaPorId = new Map(notasTodas.map(n => [n.id, n]));

    const d = {
      carpetas: ordenar(carpetas),
      notas,
      papelera: notasTodas.filter(n => n.papelera).sort((a, b) => b.papelera - a.papelera),
      plantillas: ordenar(plantillas),
      recordatorios,
      pendientes: pendientes.sort((a, b) => a.creado - b.creado),   // archivos para revisar
      ajustesLista: ajustes,
      carpeta: (id) => (id ? porId.get(id) || null : null),
      nota: (id) => notaPorId.get(id) || null,
      // Carpetas visibles (la de la Filmoteca es especial y no aparece en la lista común).
      hijas: (padreId = '') => d.carpetas.filter(c => (c.padreId || '') === padreId && !c.sistema),
      cineVivo: (clave) => cinePorClave.get(clave) || null,
      ruta(id) {
        const salida = [];
        let c = porId.get(id), vueltas = 0;
        while (c && vueltas++ < 30) { salida.unshift(c); c = porId.get(c.padreId); }
        return salida;
      },
      nombreRuta: (id) => (id ? d.ruta(id).map(c => c.nombre).join(' › ') : 'Bandeja'),
      descendientes(id) {
        const salida = [];
        const ir = (p) => { for (const h of d.hijas(p)) { salida.push(h); ir(h.id); } };
        ir(id);
        return salida;
      },
      notasDe: (carpetaId) => notas.filter(n => (n.carpetaId || '') === (carpetaId || '')),
      cantidad(carpetaId) {
        const ids = new Set([carpetaId, ...d.descendientes(carpetaId).map(c => c.id)]);
        return notas.filter(n => ids.has(n.carpetaId)).length;
      },
      ajuste: (clave) => ajustes.find(a => a.clave === clave) || null,
      // Nota por título (como Obsidian): sin importar mayúsculas; si hay varias, la más cercana.
      porTitulo(titulo, desdeCarpeta = null) {
        const t = sinTildes(titulo).trim();
        const igual = notas.filter(n => sinTildes(n.titulo).trim() === t);
        if (igual.length <= 1) return igual[0] || null;
        return igual.find(n => n.carpetaId === desdeCarpeta) || igual.sort((a, b) => a.creado - b.creado)[0];
      },
      etiquetas() {
        const cuenta = new Map();
        for (const n of notas) for (const e of etiquetasDe(n)) {
          const partes = e.split('/');
          for (let i = 1; i <= partes.length; i++) { const k = partes.slice(0, i).join('/'); cuenta.set(k, (cuenta.get(k) || 0) + (i === partes.length ? 1 : 0)); }
        }
        return [...cuenta.entries()].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => comparar(a.nombre, b.nombre));
      },
      conEtiqueta: (e) => notas.filter(n => etiquetasDe(n).some(x => x === e || x.startsWith(e + '/'))),
      // Notas que enlazan a esta con [[...]].
      menciones(n) {
        const t = sinTildes(n.titulo).trim();
        return notas.filter(x => x.id !== n.id && enlacesDe(x.texto).some(e => sinTildes(e).trim() === t));
      },
      // Notas que nombran el título sin enlace.
      sinEnlace(n) {
        const titulo = String(n.titulo || '').trim();
        if (titulo.length < 3) return [];
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaparRegex(sinTildes(titulo))}(?=$|[^\\p{L}\\p{N}])`, 'u');
        return notas.filter(x => x.id !== n.id && re.test(sinTildes(String(x.texto || '').replace(RE_ENLACE, ' '))));
      },
      buscar(q) {
        const partes = sinTildes(q).split(/\s+/).filter(Boolean);
        if (!partes.length) return [];
        const etiq = partes.filter(p => p.startsWith('#')).map(p => p.slice(1));
        const palabras = partes.filter(p => !p.startsWith('#'));
        const salida = [];
        for (const n of notas) {
          const tags = etiquetasDe(n);
          if (!etiq.every(e => tags.some(t => t === e || t.startsWith(e + '/') || t.startsWith(e)))) continue;
          const tit = sinTildes(n.titulo), txt = sinTildes(n.texto);
          const props = Object.values(n.props || {}).map(v => sinTildes(typeof v === 'object' ? JSON.stringify(v) : v)).join(' ') + ' ' + sinTildes(textoArchivo(n));
          if (!palabras.every(p => tit.includes(p) || txt.includes(p) || props.includes(p))) continue;
          const puntos = palabras.reduce((s, p) => s + (tit.startsWith(p) ? 5 : tit.includes(p) ? 3 : 1), 0);
          salida.push({ nota: n, puntos });
        }
        return salida.sort((a, b) => b.puntos - a.puntos || b.nota.modificado - a.nota.modificado).map(x => x.nota);
      },
    };
    return d;
  }

  const siguienteOrden = async (lista) => Math.max(0, ...lista.map(x => x.orden || 0)) + 1;

  return {
    col,
    cargar,

    // ── Carpetas ──
    async crearCarpeta({ nombre, padreId = '', color = '', icono = '' }) {
      if (!String(nombre || '').trim()) throw new Error('La carpeta necesita un nombre');
      const hermanas = (await col.carpetas.listar()).filter(c => (c.padreId || '') === padreId);
      return col.carpetas.crear({ nombre: nombre.trim(), padreId, color, icono, orden: await siguienteOrden(hermanas), base: false, campos: [], vistas: [] });
    },
    guardarCarpeta: (id, cambios) => col.carpetas.actualizar(id, cambios),
    // Borra una carpeta: sus notas y subcarpetas pasan a la carpeta de arriba (o a la Bandeja).
    async borrarCarpeta(id) {
      const c = await col.carpetas.obtener(id);
      if (!c) return;
      const padre = c.padreId || '';
      for (const h of (await col.carpetas.listar()).filter(x => x.padreId === id)) await col.carpetas.actualizar(h.id, { padreId: padre });
      for (const n of (await col.notas.listar()).filter(x => x.carpetaId === id)) await col.notas.actualizar(n.id, { carpetaId: padre });
      await col.carpetas.borrar(id);
    },
    async moverCarpeta(id, padreId) {
      const d = await cargar();
      if (id === padreId || d.descendientes(id).some(x => x.id === padreId)) throw new Error('No se puede mover una carpeta adentro de sí misma.');
      await col.carpetas.actualizar(id, { padreId, orden: await siguienteOrden(d.hijas(padreId)) });
    },
    async ordenarCarpeta(id, delta) {
      const d = await cargar();
      const c = d.carpeta(id);
      const hermanas = d.hijas(c.padreId || '');
      const i = hermanas.findIndex(x => x.id === id), j = i + delta;
      if (j < 0 || j >= hermanas.length) return;
      [hermanas[i], hermanas[j]] = [hermanas[j], hermanas[i]];
      for (const [k, x] of hermanas.entries()) if (x.orden !== k + 1) await col.carpetas.actualizar(x.id, { orden: k + 1 });
    },

    // ── Notas ──
    async crearNota({ titulo = '', carpetaId = BANDEJA, texto = '', props = {}, etiquetas = [], adjuntos = [], cine = null, archivo = null } = {}) {
      return col.notas.crear({ titulo: String(titulo).trim() || 'Sin título', carpetaId, texto, props, etiquetas, fijada: false, papelera: 0, adjuntos, ...(cine ? { cine } : {}), ...(archivo ? { archivo } : {}) });
    },
    guardarNota: (id, cambios) => col.notas.actualizar(id, cambios),
    // Renombrar: también se actualizan los [[enlaces]] en las otras notas.
    async renombrar(id, nuevo) {
      nuevo = String(nuevo || '').trim() || 'Sin título';
      const d = await cargar();
      const n = d.nota(id);
      if (!n || n.titulo === nuevo) return 0;
      const viejo = n.titulo;
      await col.notas.actualizar(id, { titulo: nuevo });
      let cambiadas = 0;
      if (sinTildes(viejo).trim() && !d.notas.some(x => x.id !== id && sinTildes(x.titulo).trim() === sinTildes(viejo).trim())) {
        for (const x of d.notas) {
          if (x.id === id) continue;
          const t = renombrarEnlaces(x.texto, viejo, nuevo);
          if (t !== x.texto) { await col.notas.actualizar(x.id, { texto: t }); cambiadas++; }
        }
      }
      return cambiadas;
    },
    aPapelera: (id) => col.notas.actualizar(id, { papelera: Date.now(), fijada: false }),
    restaurar: (id) => col.notas.actualizar(id, { papelera: 0 }),
    borrarDefinitivo: (id) => col.notas.borrar(id),
    async limpiarPapelera(todo = false) {
      const limite = Date.now() - DIAS_PAPELERA * 86400000;
      for (const n of await col.notas.listar()) if (n.papelera && (todo || n.papelera < limite)) await col.notas.borrar(n.id);
    },
    async duplicar(id) {
      const n = await col.notas.obtener(id);
      return col.notas.crear({ titulo: `${n.titulo} (copia)`, carpetaId: n.carpetaId || '', texto: n.texto || '', props: { ...(n.props || {}) }, etiquetas: [...(n.etiquetas || [])], fijada: false, papelera: 0, adjuntos: [...(n.adjuntos || [])] });
    },

    // ── Plantillas ──
    async guardarPlantilla(id, datos) {
      if (id) return col.plantillas.actualizar(id, datos);
      return col.plantillas.crear({ ...datos, orden: await siguienteOrden(await col.plantillas.listar()) });
    },
    borrarPlantilla: (id) => col.plantillas.borrar(id),

    // ── Recordatorios (tareas en Tareas › Sistemas › Bitácora) ──
    crearRecordatorio: (datos) => col.recordatorios.crear({ ...datos, creada: false }),

    // ── Ajustes ──
    async guardarAjuste(clave, cambios) {
      const r = (await col.ajustes.listar()).find(a => a.clave === clave);
      if (r) await col.ajustes.actualizar(r.id, cambios);
      else await col.ajustes.crear({ clave, ...cambios });
    },

    // Un adjunto que estaba en espera ya se subió.
    async actualizarAdjunto(pendiente, archivo) {
      for (const n of await col.notas.listar()) {
        let cambio = false;
        // Se conserva lo propio del adjunto (ej. "principal"), sin la marca de espera.
        const adjuntos = (n.adjuntos || []).map(({ pendiente: p, ...a }) => (p === pendiente ? (cambio = true, { ...a, ...archivo, nombre: a.nombre, origen: a.origen || 'subido' }) : p ? { pendiente: p, ...a } : a));
        const props = { ...(n.props || {}) };
        for (const [k, v] of Object.entries(props)) if (v && typeof v === 'object' && v.pendiente === pendiente) { props[k] = { ...archivo, nombre: v.nombre }; cambio = true; }
        if (cambio) await col.notas.actualizar(n.id, { adjuntos, props });
      }
      for (const p of await col.pendientes.listar()) if (p.adjunto?.pendiente === pendiente) await col.pendientes.actualizar(p.id, { adjunto: { ...archivo, nombre: p.adjunto.nombre } });
    },
  };
}

// Lo que va a Drive como copia legible: carpetas y un .md por nota (+ imágenes subidas).
export function espejoDe(d) {
  const rutaNombres = (carpetaId) => (carpetaId ? d.ruta(carpetaId).map(c => nombreArchivo(c.nombre)) : ['Bandeja']);
  const carpetas = [['Bandeja'], ...d.carpetas.map(c => rutaNombres(c.id))];
  const archivos = [];
  const usados = new Set();
  const unico = (ruta, nombre, ext) => {
    let n = nombre, i = 2;
    while (usados.has(`${ruta.join('/')}/${n}${ext}`.toLowerCase())) n = `${nombre} (${i++})`;
    usados.add(`${ruta.join('/')}/${n}${ext}`.toLowerCase());
    return n + ext;
  };
  for (const n of [...d.notas].sort((a, b) => a.creado - b.creado)) {
    const ruta = rutaNombres(n.carpetaId);
    archivos.push({ clave: `nota:${n.id}`, ruta, nombre: unico(ruta, nombreArchivo(n.titulo), '.md'), contenido: aMarkdown(n, d) });
    for (const a of n.adjuntos || []) {
      if (a.origen !== 'subido' || !a.driveId) continue;
      const clave = `adj:${a.driveId}`;
      if (archivos.some(x => x.clave === clave)) continue;
      // El documento de una nota "archivo" va al lado de la nota, con su mismo nombre.
      const r = a.principal ? ruta : ['adjuntos'];
      const base = a.principal ? nombreArchivo(n.titulo) : a.nombre.replace(/\.[^.]+$/, '');
      archivos.push({ clave, ruta: r, nombre: unico(r, base, (a.nombre.match(/\.[^.]+$/) || [''])[0]), copiaDe: a.driveId });
    }
  }
  if (archivos.some(x => x.copiaDe && x.ruta.join('/') === 'adjuntos')) carpetas.push(['adjuntos']);
  return { carpetas, archivos };
}

// ── Recordatorios → Tareas (Sistemas › Bitácora) ──
// Cada recordatorio es una tarea con fecha y un link a la nota. Cuando la
// completás en Tareas, el recordatorio se borra solo.
let corriendoRec = false;
export async function sincronizarRecordatorios(ctx) {
  if (corriendoRec) return;
  corriendoRec = true;
  try {
    if (!await ctx.existeAccion?.('sistema-sincronizar')) return;
    const col = ctx.datos('recordatorios');
    const lista = await col.listar();
    const notas = await ctx.datos('notas').listar();
    const pendientes = new Set((await ctx.pedir('sistema-pendientes', { prefijo: 'bitacora:' })) || []);
    const tareas = [];
    for (const r of lista) {
      const clave = `bitacora:rec:${r.id}`;
      const nota = notas.find(x => x.id === r.notaId);
      if ((r.creada && !pendientes.has(clave)) || !nota || nota.papelera) { await col.borrar(r.id); continue; }
      tareas.push({ clave, titulo: r.titulo, fecha: r.fecha, destino: 'sistema:bitacora', notas: `Nota de la Bitácora: ${nota.titulo}`, enlace: `bitacora/n/${nota.id}` });
    }
    await ctx.pedir('sistema-sincronizar', { modulo: 'bitacora', prefijo: 'bitacora:', tareas });
    for (const r of lista) if (!r.creada && tareas.some(t => t.clave === `bitacora:rec:${r.id}`)) await col.actualizar(r.id, { creada: true });
  } catch (e) {
    console.warn('No se pudieron actualizar los recordatorios de la Bitácora', e);
  } finally {
    corriendoRec = false;
  }
}
