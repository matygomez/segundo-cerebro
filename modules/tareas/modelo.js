// ─────────────────────────────────────────────────────────────
// Tareas: modelo de datos.
//
// Colecciones (cada una es un archivo en Drive, dentro de /tareas):
//   areas      { nombre, orden, archivada }
//   proyectos  { nombre, areaId, orden, archivado }
//   secciones  { nombre, proyectoId, orden }
//   tareas     { titulo, notas, fecha, hora, inicio, estado ('pendiente' | 'hecha'),
//                repeticion: { tipo, cada }, etiquetas: [], subtareas: [],
//                adjuntos: [], duracion, recordatorio, areaId, proyectoId,
//                seccionId, completada, ultimaCompletada }
//   comentarios { tareaId, texto, editado }   (uno por registro: no se pisan)
//   filtros     { nombre, texto, areaId, proyectoId, fecha, incluirHechas }
//
// Fechas como texto 'AAAA-MM-DD' (sin zona horaria, como en un calendario).
// ─────────────────────────────────────────────────────────────

export const REPETICIONES = [
  { valor: '', nombre: 'No se repite' },
  { valor: 'diaria', nombre: 'Cada día', unidad: 'días' },
  { valor: 'dias-habiles', nombre: 'Días hábiles (lunes a viernes)' },
  { valor: 'semanal', nombre: 'Cada semana', unidad: 'semanas' },
  { valor: 'mensual', nombre: 'Cada mes', unidad: 'meses' },
  { valor: 'anual', nombre: 'Cada año', unidad: 'años' },
];

// ── Fechas ──────────────────────────────────────────────────

const aFecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

export const hoy = () => aISO(new Date());
export const sumarDias = (iso, n) => { const f = aFecha(iso); f.setDate(f.getDate() + n); return aISO(f); };
export const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86_400_000);

function sumarMeses(iso, n, diaOriginal) {
  const f = aFecha(iso);
  const dia = diaOriginal || f.getDate();
  const destino = new Date(f.getFullYear(), f.getMonth() + n, 1);
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia, ultimo));
  return aISO(destino);
}

// Próxima fecha de una tarea que se repite.
export function siguienteFecha(iso, rep) {
  const cada = Math.max(1, Number(rep?.cada) || 1);
  switch (rep?.tipo) {
    case 'diaria': return sumarDias(iso, cada);
    case 'semanal': return sumarDias(iso, 7 * cada);
    case 'mensual': return sumarMeses(iso, cada, rep.dia);
    case 'anual': return sumarMeses(iso, 12 * cada, rep.dia);
    case 'dias-habiles': {
      let f = sumarDias(iso, 1);
      while ([0, 6].includes(aFecha(f).getDay())) f = sumarDias(f, 1);
      return f;
    }
    default: return null;
  }
}

export function textoFecha(iso) {
  if (!iso) return '';
  const d = diasEntre(hoy(), iso);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  const f = aFecha(iso);
  const opciones = { weekday: 'short', day: 'numeric', month: 'short' };
  if (f.getFullYear() !== new Date().getFullYear()) opciones.year = 'numeric';
  return f.toLocaleDateString('es-AR', opciones).replace(/[.,]/g, '');
}

export function textoRepeticion(rep) {
  if (!rep?.tipo) return '';
  const r = REPETICIONES.find(x => x.valor === rep.tipo);
  const cada = Number(rep.cada) || 1;
  if (cada > 1 && r?.unidad) return `Cada ${cada} ${r.unidad}`;
  return r?.nombre || '';
}

export function textoDuracion(min) {
  const m = Number(min);
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), resto = m % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

// ── Consultas ───────────────────────────────────────────────

export const hecha = (t) => t.estado === 'hecha';
export const vencida = (t) => !hecha(t) && t.fecha && t.fecha < hoy();
export const deHoy = (t) => !hecha(t) && t.fecha === hoy();

// Orden por defecto: fecha y hora, luego creación.
export function ordenar(lista) {
  return [...lista].sort((a, b) =>
    (a.fecha || '9999').localeCompare(b.fecha || '9999')
    || (a.hora || '99').localeCompare(b.hora || '99')
    || a.creado - b.creado);
}

const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.creado - b.creado;

// ── Filtros ─────────────────────────────────────────────────

export const FECHAS_FILTRO = [
  { valor: '', texto: 'Cualquier fecha' },
  { valor: 'vencidas', texto: 'Vencidas' },
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'semana', texto: 'Próximos 7 días' },
  { valor: 'sin-fecha', texto: 'Sin fecha' },
];

export function aplicarFiltro(tareas, f) {
  const palabras = String(f.texto || '').toLowerCase().split(/\s+/).filter(Boolean);
  return tareas.filter(t => {
    if (!f.incluirHechas && hecha(t)) return false;
    if (f.areaId && t.areaId !== f.areaId) return false;
    if (f.proyectoId && t.proyectoId !== f.proyectoId) return false;
    if (f.fecha === 'vencidas' && !vencida(t)) return false;
    if (f.fecha === 'hoy' && t.fecha !== hoy()) return false;
    if (f.fecha === 'semana' && !(t.fecha && t.fecha >= hoy() && t.fecha <= sumarDias(hoy(), 7))) return false;
    if (f.fecha === 'sin-fecha' && t.fecha) return false;
    return palabras.every(p => p.startsWith('#')
      ? (t.etiquetas || []).some(e => e.toLowerCase().startsWith(p.slice(1)))
      : `${t.titulo} ${t.notas || ''} ${(t.etiquetas || []).join(' ')}`.toLowerCase().includes(p));
  });
}

// ── Operaciones ─────────────────────────────────────────────

export function crearModelo(ctx) {
  const col = {
    areas: ctx.datos('areas'),
    proyectos: ctx.datos('proyectos'),
    secciones: ctx.datos('secciones'),
    tareas: ctx.datos('tareas'),
    comentarios: ctx.datos('comentarios'),
    filtros: ctx.datos('filtros'),
  };

  async function cargar() {
    const [areas, proyectos, secciones, tareas, comentarios, filtros] = await Promise.all(
      [col.areas.listar(), col.proyectos.listar(), col.secciones.listar(), col.tareas.listar(),
        col.comentarios.listar(), col.filtros.listar()]);
    areas.sort(porOrden); proyectos.sort(porOrden); secciones.sort(porOrden);
    comentarios.sort((a, b) => a.creado - b.creado);
    filtros.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const d = { areas, proyectos, secciones, tareas, comentarios, filtros };
    d.comentariosDe = (tareaId) => comentarios.filter(c => c.tareaId === tareaId);
    d.filtro = (id) => filtros.find(f => f.id === id);
    d.area = (id) => areas.find(a => a.id === id);
    d.proyecto = (id) => proyectos.find(p => p.id === id);
    d.seccion = (id) => secciones.find(s => s.id === id);
    return d;
  }

  const siguienteOrden = async (coleccion, filtro = () => true) =>
    Math.max(0, ...(await coleccion.listar()).filter(filtro).map(x => x.orden ?? 0)) + 1;

  // Normaliza lo que viene del editor o de otros módulos.
  function normalizar(datos) {
    const t = { ...datos };
    t.titulo = String(t.titulo || '').trim();
    t.estado = t.estado === 'hecha' ? 'hecha' : 'pendiente';
    delete t.prioridad;                       // ya no se usa
    t.etiquetas = Array.isArray(t.etiquetas) ? t.etiquetas.filter(Boolean) : [];
    t.subtareas = Array.isArray(t.subtareas) ? t.subtareas.filter(s => s?.texto) : [];
    t.adjuntos = Array.isArray(t.adjuntos) ? t.adjuntos.filter(a => a?.driveId || a?.pendiente) : [];
    if (!t.fecha) { t.fecha = ''; t.hora = ''; }
    if (t.repeticion?.tipo && t.repeticion.tipo !== 'dias-habiles' && t.fecha) {
      t.repeticion = { ...t.repeticion, dia: Number(t.fecha.slice(8, 10)) };
    }
    if (!t.repeticion?.tipo) t.repeticion = null;
    if (!t.areaId) t.proyectoId = '';
    if (!t.proyectoId) t.seccionId = '';
    return t;
  }

  return {
    cargar,

    async crearTarea(datos) {
      const t = normalizar(datos);
      if (!t.titulo) throw new Error('La tarea necesita un título');
      t.estado = 'pendiente';
      return col.tareas.crear(t);
    },

    async guardarTarea(id, datos) {
      const t = normalizar(datos);
      if (!t.titulo) throw new Error('La tarea necesita un título');
      const antes = await col.tareas.obtener(id);
      t.estado = antes?.estado === 'hecha' ? 'hecha' : 'pendiente';
      return col.tareas.actualizar(id, t);
    },

    async borrarTarea(id) {
      for (const c of (await col.comentarios.listar()).filter(c => c.tareaId === id)) await col.comentarios.borrar(c.id);
      return col.tareas.borrar(id);
    },

    // Comentarios
    comentar(tareaId, texto) { return col.comentarios.crear({ tareaId, texto: texto.trim(), editado: false }); },
    editarComentario: (id, texto) => col.comentarios.actualizar(id, { texto: texto.trim(), editado: true }),
    borrarComentario: (id) => col.comentarios.borrar(id),

    // Filtros guardados
    crearFiltro: (f) => col.filtros.crear(f),
    actualizarFiltro: (id, f) => col.filtros.actualizar(id, f),
    borrarFiltro: (id) => col.filtros.borrar(id),

    // Reemplaza adjuntos que estaban en espera por su versión ya subida.
    async actualizarAdjunto(t, pendiente, archivo) {
      if (!(t.adjuntos || []).some(a => a.pendiente === pendiente)) return false;
      await col.tareas.actualizar(t.id, { adjuntos: t.adjuntos.map(a => a.pendiente === pendiente ? archivo : a) });
      return true;
    },

    // Completar. Si se repite, la tarea no se cierra: pasa a la próxima fecha.
    // Devuelve la próxima fecha, o null si quedó hecha.
    async completar(t) {
      if (t.repeticion?.tipo) {
        const base = t.fecha || hoy();
        let prox = siguienteFecha(base, t.repeticion);
        while (prox <= hoy()) prox = siguienteFecha(prox, t.repeticion);
        const corrimiento = diasEntre(base, prox);
        await col.tareas.actualizar(t.id, {
          ...t,
          fecha: prox,
          inicio: t.inicio ? sumarDias(t.inicio, corrimiento) : '',
          recordatorio: t.recordatorio ? `${sumarDias(t.recordatorio.slice(0, 10), corrimiento)}${t.recordatorio.slice(10)}` : '',
          estado: 'pendiente',
          subtareas: (t.subtareas || []).map(s => ({ ...s, hecha: false })),
          ultimaCompletada: Date.now(),
          completada: null,
        });
        return prox;
      }
      await col.tareas.actualizar(t.id, { ...t, estado: 'hecha', completada: Date.now() });
      return null;
    },

    reabrir: (t) => col.tareas.actualizar(t.id, { ...t, estado: 'pendiente', completada: null }),

    async alternarSubtarea(t, subId) {
      const subtareas = (t.subtareas || []).map(s => s.id === subId ? { ...s, hecha: !s.hecha } : s);
      return col.tareas.actualizar(t.id, { ...t, subtareas });
    },

    // Áreas
    async crearArea(nombre) {
      return col.areas.crear({ nombre: nombre.trim(), orden: await siguienteOrden(col.areas), archivada: false });
    },
    renombrarArea: (id, nombre) => col.areas.actualizar(id, { nombre: nombre.trim() }),
    archivarArea: (id, archivada = true) => col.areas.actualizar(id, { archivada }),

    // Proyectos
    async crearProyecto(areaId, nombre) {
      return col.proyectos.crear({
        nombre: nombre.trim(), areaId, archivado: false,
        orden: await siguienteOrden(col.proyectos, p => p.areaId === areaId),
      });
    },
    renombrarProyecto: (id, nombre) => col.proyectos.actualizar(id, { nombre: nombre.trim() }),
    archivarProyecto: (id, archivado = true) => col.proyectos.actualizar(id, { archivado }),

    // Secciones
    async crearSeccion(proyectoId, nombre) {
      return col.secciones.crear({
        nombre: nombre.trim(), proyectoId,
        orden: await siguienteOrden(col.secciones, s => s.proyectoId === proyectoId),
      });
    },
    renombrarSeccion: (id, nombre) => col.secciones.actualizar(id, { nombre: nombre.trim() }),

    // Al borrar una sección, sus tareas quedan en el proyecto, sin sección.
    async borrarSeccion(id) {
      for (const t of (await col.tareas.listar()).filter(t => t.seccionId === id)) {
        await col.tareas.actualizar(t.id, { seccionId: '' });
      }
      return col.secciones.borrar(id);
    },

    // Mueve un elemento un lugar arriba (-1) o abajo (+1) entre sus hermanos.
    async mover(tipo, id, direccion, hermanos) {
      const lista = [...hermanos].sort(porOrden);
      const i = lista.findIndex(x => x.id === id);
      const j = i + direccion;
      if (i < 0 || j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      for (const [n, x] of lista.entries()) {
        if (x.orden !== n + 1) await col[tipo].actualizar(x.id, { orden: n + 1 });
      }
    },
  };
}
