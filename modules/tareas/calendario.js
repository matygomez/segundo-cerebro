// ─────────────────────────────────────────────────────────────
// Tareas ← Google Calendar (solo lectura).
//
// Cada calendario tiene un destino (Configurar Tareas):
//   'no'                → no se muestra
//   'area:<id>'         → como tarea en esa área (ej. Muchtek)
//   'sistema:eventos'   → Sistemas › Eventos
//   'sistema:feriados'  → Sistemas › Feriados
// y un modo: 'tarea' (con casilla, queda vencida) o 'aviso' (sin casilla,
// desaparece al día siguiente). Los feriados van siempre como aviso.
//
// Se traen los eventos de hoy en adelante (lo viejo no se carga). Las
// reuniones rechazadas no llegan. Si una reunión cambia en Calendar, la
// tarea se actualiza; si se cancela, se borra (o queda "(cancelada)" si
// le agregaste algo tuyo).
// ─────────────────────────────────────────────────────────────

import { crearModelo, hoy, sumarDias } from './modelo.js';

export const CLAVE_AJUSTE = 'calendarios';
const DIAS_EVENTOS = 60;       // cuánto hacia adelante se traen reuniones y eventos
const DIAS_FERIADOS = 370;     // los feriados: todo el año que viene

// Configuración guardada: { cals: { [id]: { destino, modo, anticipacion, nombre, color } }, conocidos: [ids] }
export function configCalendarios(d) {
  const a = d.ajuste(CLAVE_AJUSTE) || {};
  return { cals: { ...(a.cals || {}) }, conocidos: [...(a.conocidos || [])], ultima: a.ultima || 0, error: a.error || '' };
}

// Valores iniciales para un calendario que aparece por primera vez.
export function porDefecto(c) {
  if (c.feriados) return { destino: 'sistema:feriados', modo: 'aviso', anticipacion: 'todo' };
  if (c.principal) return { destino: 'sistema:eventos', modo: 'aviso', anticipacion: 0 };
  return { destino: 'no', modo: 'tarea', anticipacion: 0 };
}

const dosDig = (n) => String(n).padStart(2, '0');
const fechaLocal = (d) => `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`;
const horaLocal = (d) => `${dosDig(d.getHours())}:${dosDig(d.getMinutes())}`;

function aTarea(calId, conf, ev) {
  const feriados = conf.destino === 'sistema:feriados';
  let fecha, hora = '', duracion = '';
  if (ev.start?.date) fecha = ev.start.date;
  else {
    const ini = new Date(ev.start.dateTime), fin = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
    fecha = fechaLocal(ini); hora = horaLocal(ini);
    if (fin) duracion = Math.max(0, Math.round((fin - ini) / 60000)) || '';
  }
  const meet = ev.hangoutLink || ev.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri || '';
  const organiza = ev.organizer && !ev.organizer.self ? (ev.organizer.displayName || ev.organizer.email) : '';
  const notas = feriados ? '' : [
    ev.location ? `📍 ${ev.location}` : '',
    meet ? `🎥 ${meet}` : '',
    organiza ? `👤 Organiza: ${organiza}` : '',
  ].filter(Boolean).join('\n');
  const ant = conf.anticipacion;
  return {
    clave: `cal:${calId}:${ev.id}`,
    titulo: ev.summary || '(sin título)',
    fecha, hora, duracion, notas,
    // Feriados: 'todo' = se ven todos los del año; un número = aparecen esos días antes.
    inicio: feriados && ant !== 'todo' ? sumarDias(fecha, -(Number(ant) || 0)) : '',
    aviso: feriados || conf.modo === 'aviso',
    destino: conf.destino,
  };
}

// ¿La rechacé? En un calendario compartido desde otra cuenta, "yo" es el
// asistente con el mismo mail que el calendario.
function rechazada(calId, ev) {
  const yo = (ev.attendees || []).find(a => a.self || a.email === calId);
  return yo?.responseStatus === 'declined';
}

let corriendo = false;
export async function sincronizarCalendario(ctx, { forzar = false } = {}) {
  if (corriendo || !ctx.calendario?.disponible?.()) return;
  corriendo = true;
  const m = crearModelo(ctx);
  try {
    const d = await m.cargar();
    const conf = configCalendarios(d);
    if (!forzar && Date.now() - conf.ultima < 5 * 60_000) return;   // como mucho cada 5 minutos
    // Calendarios nuevos: se agregan con sus valores iniciales.
    const lista = await ctx.calendario.calendarios();
    for (const c of lista) {
      if (!conf.cals[c.id]) conf.cals[c.id] = { ...porDefecto(c) };
      Object.assign(conf.cals[c.id], { nombre: c.nombre, color: c.color, feriados: !!c.feriados, principal: !!c.principal, porDefecto: !!c.porDefecto });
    }
    const desde = hoy();
    for (const [id, cfg] of Object.entries(conf.cals)) {
      const prefijo = `cal:${id}:`;
      if (cfg.destino === 'no' || !lista.some(c => c.id === id)) {
        await m.sincronizarSistema({ modulo: 'calendario', prefijo, tareas: [], conservarAntesDe: desde });
        continue;
      }
      const feriados = cfg.destino === 'sistema:feriados';
      const hasta = sumarDias(desde, feriados ? DIAS_FERIADOS : DIAS_EVENTOS);
      try {
        const evs = await ctx.calendario.eventos(id, desde, hasta);
        const tareas = evs.filter(ev => ev.status !== 'cancelled' && ev.start && !rechazada(id, ev)).map(ev => aTarea(id, cfg, ev));
        await m.sincronizarSistema({ modulo: 'calendario', prefijo, tareas, conservarAntesDe: desde });
      } catch (e) {
        console.warn(`No se pudo leer el calendario ${cfg.nombre || id}`, e);
        if (e.estado === 403 || e.estado === 401) throw e;
      }
    }
    await m.guardarHojas(CLAVE_AJUSTE, { cals: conf.cals, conocidos: Object.keys(conf.cals), ultima: Date.now(), error: '' });
  } catch (e) {
    const texto = e.estado === 403
      ? 'Google no deja leer el calendario. Revisá que esté activada "Google Calendar API" en Google Cloud.'
      : e.message;
    try { await m.guardarHojas(CLAVE_AJUSTE, { error: texto, ultima: Date.now() }); } catch { /* nada */ }
  } finally {
    corriendo = false;
  }
}
