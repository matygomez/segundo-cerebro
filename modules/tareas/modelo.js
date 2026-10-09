// ─────────────────────────────────────────────────────────────
// Tareas: modelo de datos.
//
// Colecciones (cada una es un archivo en Drive, dentro de /tareas):
//   areas      { nombre, icono, orden, archivada }
//   proyectos  { nombre, icono, areaId, orden, archivado }
//   secciones  { nombre, proyectoId, orden, archivada }
//   tareas     { titulo, notas, fecha, hora, inicio, estado ('pendiente' | 'hecha'),
//                repeticion: { tipo, cada }, etiquetas: [], subtareas: [],
//                adjuntos: [], duracion, recordatorio, areaId, proyectoId,
//                seccionId, completada, ultimaCompletada, padreId }
//                padreId: si es una subtarea, la tarea madre. Las subtareas son
//                tareas completas (fecha, notas, adjuntos, comentarios…).
//                (subtareas: lista simple de la versión anterior; al cargar se
//                 convierten en subtareas de verdad y la lista queda vacía.)
//   comentarios { tareaId, texto, editado }   (uno por registro: no se pisan)
//   filtros     { nombre, texto, areaId, proyectoId, fecha, incluirHechas }
//   ajustes     { clave: 'hojas-pc' | 'hojas-cel', lista: [{ id, vis, modo }], compacto, limite }
//
// Papelera: lo eliminado no se borra enseguida. Queda marcado con
// enPapelera (cuándo) y papeleraGrupo (todo lo que se eliminó junto),
// se puede recuperar, y a los 30 días se borra de verdad.
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

// Orden a mano (dentro de áreas, proyectos, secciones y bandeja).
// Las tareas sin orden propio usan su fecha de creación.
export const ordenEfectivo = (t) => (typeof t.orden === 'number' ? t.orden : t.creado);
export const ordenarManual = (lista) => [...lista].sort((a, b) => ordenEfectivo(a) - ordenEfectivo(b));

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

const migrandoAhora = new Set();   // evita convertir dos veces si se carga en paralelo

export function crearModelo(ctx) {
  const col = {
    areas: ctx.datos('areas'),
    proyectos: ctx.datos('proyectos'),
    secciones: ctx.datos('secciones'),
    tareas: ctx.datos('tareas'),
    comentarios: ctx.datos('comentarios'),
    filtros: ctx.datos('filtros'),
    ajustes: ctx.datos('ajustes'),
  };
  const DIAS_PAPELERA = 30;
  const enPapelera = (x) => !!x.enPapelera;

  async function cargar() {
    const [todasAreas, todosProyectos, todasSecciones, todasTareas, comentarios, filtros, ajustes] = await Promise.all(
      [col.areas.listar(), col.proyectos.listar(), col.secciones.listar(), col.tareas.listar(),
        col.comentarios.listar(), col.filtros.listar(), col.ajustes.listar()]);
    // Lo que está en la papelera no se ve en ningún lado; lo que pasó los 30 días se borra.
    const vence = Date.now() - DIAS_PAPELERA * 86_400_000;
    const papelera = [];
    for (const [tipo, lista] of [['areas', todasAreas], ['proyectos', todosProyectos], ['secciones', todasSecciones], ['tareas', todasTareas]]) {
      for (const x of lista.filter(enPapelera)) {
        if (x.enPapelera < vence) col[tipo].borrar(x.id).catch(() => {});
        else papelera.push({ tipo, item: x });
      }
    }
    const areas = todasAreas.filter(x => !enPapelera(x));
    const proyectos = todosProyectos.filter(x => !enPapelera(x));
    const secciones = todasSecciones.filter(x => !enPapelera(x));
    let tareas = todasTareas.filter(x => !enPapelera(x));
    // Subtareas viejas (lista simple) → tareas hijas. Si dos dispositivos las
    // convirtieron a la vez, quedan duplicadas: se deja una sola.
    const migradas = new Map();
    for (const t of [...tareas].sort((a, b) => a.creado - b.creado)) {
      if (!t.migradaDe) continue;
      if (migradas.has(t.migradaDe)) { col.tareas.borrar(t.id).catch(() => {}); tareas = tareas.filter(x => x !== t); }
      else migradas.set(t.migradaDe, t);
    }
    for (const t of tareas.filter(t => (t.subtareas || []).length)) {
      let orden = Date.now();
      for (const sub of t.subtareas) {
        const clave = `${t.id}:${sub.id}`;
        if (!migradas.has(clave) && !migrandoAhora.has(clave) && String(sub.texto || '').trim()) {
          migrandoAhora.add(clave);
          const nueva = {
            titulo: String(sub.texto).trim(), estado: sub.hecha ? 'hecha' : 'pendiente', padreId: t.id, migradaDe: clave,
            areaId: t.areaId || '', proyectoId: t.proyectoId || '', seccionId: t.seccionId || '',
            fecha: '', hora: '', notas: '', etiquetas: [], subtareas: [], adjuntos: [], orden: orden++,
            completada: null,
          };
          const id = await col.tareas.crear(nueva);
          migradas.set(clave, true);
          tareas.push({ ...nueva, id, creado: Date.now(), modificado: Date.now() });
        }
      }
      await col.tareas.actualizar(t.id, { subtareas: [] });
      t.subtareas = [];
    }
    areas.sort(porOrden); proyectos.sort(porOrden); secciones.sort(porOrden);
    comentarios.sort((a, b) => a.creado - b.creado);
    filtros.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const d = { areas, proyectos, secciones, tareas, comentarios, filtros, ajustes, papelera };
    d.ajuste = (clave) => ajustes.find(a => a.clave === clave);
    d.comentariosDe = (tareaId) => comentarios.filter(c => c.tareaId === tareaId);
    d.filtro = (id) => filtros.find(f => f.id === id);
    d.area = (id) => areas.find(a => a.id === id);
    d.proyecto = (id) => proyectos.find(p => p.id === id);
    d.seccion = (id) => secciones.find(s => s.id === id);
    d.tarea = (id) => tareas.find(t => t.id === id);
    d.hijas = (id) => ordenarManual(tareas.filter(t => t.padreId === id));
    d.padre = (t) => (t?.padreId ? tareas.find(x => x.id === t.padreId) || null : null);
    return d;
  }

  // Subtareas, subtareas de subtareas, etc.
  async function descendientes(id) {
    const todas = (await col.tareas.listar()).filter(t => !enPapelera(t));
    const salida = [];
    const juntar = (pid) => { for (const t of todas.filter(t => t.padreId === pid)) { salida.push(t); juntar(t.id); } };
    juntar(id);
    return salida;
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
    t.padreId = t.padreId || '';
    return t;
  }

  return {
    cargar,

    async crearTarea(datos) {
      const t = normalizar(datos);
      if (!t.titulo) throw new Error('La tarea necesita un título');
      t.estado = 'pendiente';
      if (typeof t.orden !== 'number') t.orden = Date.now();   // las nuevas van al final
      return col.tareas.crear(t);
    },

    async guardarTarea(id, datos) {
      const t = normalizar(datos);
      if (!t.titulo) throw new Error('La tarea necesita un título');
      const antes = await col.tareas.obtener(id);
      t.estado = antes?.estado === 'hecha' ? 'hecha' : 'pendiente';
      if (antes?.padreId && !datos.padreId) t.padreId = antes.padreId;
      await col.tareas.actualizar(id, t);
      // Si la tarea cambió de lugar, sus subtareas la siguen.
      if (antes && (antes.areaId !== t.areaId || antes.proyectoId !== t.proyectoId || antes.seccionId !== t.seccionId)) {
        for (const h of await descendientes(id)) await col.tareas.actualizar(h.id, { areaId: t.areaId, proyectoId: t.proyectoId, seccionId: t.seccionId });
      }
    },

    async borrarTarea(id) {
      for (const x of [...await descendientes(id), { id }]) {
        for (const c of (await col.comentarios.listar()).filter(c => c.tareaId === x.id)) await col.comentarios.borrar(c.id);
        await col.tareas.borrar(x.id);
      }
    },

    // Subtarea nueva: hereda el lugar de la madre.
    async crearSubtarea(madre, titulo) {
      return this.crearTarea({ titulo, padreId: madre.id, areaId: madre.areaId || '', proyectoId: madre.proyectoId || '', seccionId: madre.seccionId || '' });
    },
    descendientes: (id) => descendientes(id),

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

    // Completa las subtareas pendientes (las que se repiten pasan a su próxima fecha).
    async completarSubtareas(t) {
      for (const x of await descendientes(t.id)) if (!hecha(x)) await this.completar(x);
    },

    // Guarda el nuevo lugar de una tarea: queda entre "antes" y "despues".
    // Solo cambia esa tarea, así la sincronización no choca con nada.
    async moverTarea(id, antes, despues) {
      let orden;
      if (antes && despues) orden = (ordenEfectivo(antes) + ordenEfectivo(despues)) / 2;
      else if (antes) orden = ordenEfectivo(antes) + 1000;
      else if (despues) orden = ordenEfectivo(despues) - 1000;
      else return;
      return col.tareas.actualizar(id, { orden });
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

    // Ícono de un área o proyecto.
    ponerIcono: (tipo, id, icono) => col[tipo].actualizar(id, { icono }),
    archivarSeccion: (id, archivada = true) => col.secciones.actualizar(id, { archivada }),

    // Hojas de arriba, modo compacto y límite: se guardan por dispositivo (PC o celular).
    async guardarHojas(clave, cambios) {
      const existente = (await col.ajustes.listar()).find(a => a.clave === clave);
      if (existente) return col.ajustes.actualizar(existente.id, cambios);
      return col.ajustes.crear({ clave, ...cambios });
    },

    // ── Eliminar con papelera ──
    // tipo: 'areas' | 'proyectos' | 'secciones'.
    // modo: 'todo' (se elimina con todo lo que tiene) o 'reubicar'.
    // destino (si reubica): { areaId, proyectoId, seccionId } donde van las tareas.
    //   Si es un área sin proyecto, los proyectos del área eliminada pasan enteros a esa área.
    // completadas (si reubica): 'mover' o 'eliminar'.
    // Devuelve una función para deshacer.
    async eliminar(tipo, id, { modo = 'todo', destino = null, completadas = 'mover' } = {}) {
      const grupo = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const marca = { enPapelera: Date.now(), papeleraGrupo: grupo };
      const [areas, proyectos, secciones, tareas] = await Promise.all([col.areas.listar(), col.proyectos.listar(), col.secciones.listar(), col.tareas.listar()]);
      const vivos = (l) => l.filter(x => !enPapelera(x));
      // Lo que cuelga del elemento.
      let proys = [], secs = [], ts = [];
      if (tipo === 'areas') {
        proys = vivos(proyectos).filter(p => p.areaId === id);
        secs = vivos(secciones).filter(x => proys.some(p => p.id === x.proyectoId));
        ts = vivos(tareas).filter(t => t.areaId === id);
      } else if (tipo === 'proyectos') {
        secs = vivos(secciones).filter(x => x.proyectoId === id);
        ts = vivos(tareas).filter(t => t.proyectoId === id);
      } else {
        ts = vivos(tareas).filter(t => t.seccionId === id);
      }
      const deshacer = [];
      const papeleraDe = async (coleccion, x) => { await col[coleccion].actualizar(x.id, marca); deshacer.push(() => col[coleccion].actualizar(x.id, { enPapelera: null, papeleraGrupo: null })); };
      const mover = async (t, cambios) => {
        const antes = { areaId: t.areaId || '', proyectoId: t.proyectoId || '', seccionId: t.seccionId || '' };
        await col.tareas.actualizar(t.id, cambios);
        deshacer.push(() => col.tareas.actualizar(t.id, antes));
      };

      await papeleraDe(tipo, { id });
      if (modo === 'todo' || !destino) {
        for (const p of proys) await papeleraDe('proyectos', p);
        for (const x of secs) await papeleraDe('secciones', x);
        for (const t of ts) await papeleraDe('tareas', t);
      } else {
        const d = { areaId: destino.areaId || '', proyectoId: destino.proyectoId || '', seccionId: destino.seccionId || '' };
        // Un área entera a otra área: los proyectos pasan con sus secciones y sus tareas.
        const proyectosPasan = tipo === 'areas' && d.areaId && !d.proyectoId;
        for (const p of proys) {
          if (proyectosPasan) {
            await col.proyectos.actualizar(p.id, { areaId: d.areaId });
            deshacer.push(() => col.proyectos.actualizar(p.id, { areaId: id }));
          } else {
            await papeleraDe('proyectos', p);
            for (const x of secs.filter(x => x.proyectoId === p.id)) await papeleraDe('secciones', x);
          }
        }
        if (!proyectosPasan) for (const x of secs.filter(x => !proys.length || !proys.some(p => p.id === x.proyectoId))) await papeleraDe('secciones', x);
        for (const t of ts) {
          if (hecha(t) && completadas === 'eliminar') { await papeleraDe('tareas', t); continue; }
          if (proyectosPasan && t.proyectoId && proys.some(p => p.id === t.proyectoId)) await mover(t, { areaId: d.areaId });
          else await mover(t, d);
        }
      }
      return async () => { for (const f of deshacer.reverse()) await f(); };
    },

    // Recupera todo lo que se eliminó junto.
    async recuperar(grupo) {
      for (const tipo of ['areas', 'proyectos', 'secciones', 'tareas']) {
        const lista = await col[tipo].listar();
        for (const x of lista.filter(x => x.papeleraGrupo === grupo)) {
          await col[tipo].actualizar(x.id, { enPapelera: null, papeleraGrupo: null });
          // Si su área o proyecto también está en la papelera, vuelve con él.
          const padre = tipo === 'proyectos' ? ['areas', x.areaId] : tipo === 'secciones' ? ['proyectos', x.proyectoId] : null;
          if (padre) {
            const p = (await col[padre[0]].listar()).find(y => y.id === padre[1]);
            if (p?.enPapelera) await col[padre[0]].actualizar(p.id, { enPapelera: null, papeleraGrupo: null });
          }
        }
      }
    },

    // Borra de verdad lo que está en la papelera (todo, o un grupo).
    async vaciarPapelera(grupo = null) {
      for (const tipo of ['tareas', 'secciones', 'proyectos', 'areas']) {
        for (const x of (await col[tipo].listar()).filter(x => x.enPapelera && (!grupo || x.papeleraGrupo === grupo))) await col[tipo].borrar(x.id);
      }
    },

    // Pasa una tarea a otra fecha (deslizar a la izquierda = mañana).
    cambiarFecha: (t, fecha) => col.tareas.actualizar(t.id, { fecha }),

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
