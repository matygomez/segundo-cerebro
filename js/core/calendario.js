// ─────────────────────────────────────────────────────────────
// Google Calendar (solo lectura).
//
// La app nunca escribe en tu calendario: solo lee la lista de
// calendarios y los eventos, para que Tareas los muestre.
// Usa la misma sesión de Google que Drive.
// ─────────────────────────────────────────────────────────────

import * as drive from './drive.js';

const API = 'https://www.googleapis.com/calendar/v3';
// Calendario público de feriados de Argentina (de Google).
export const FERIADOS_AR = 'es.ar#holiday@group.v.calendar.google.com';

export const disponible = () => drive.tieneCalendario();
export const configurado = () => drive.configurado();

// Lista de tus calendarios. Si no tenés agregado el de feriados, se suma igual.
export async function calendarios() {
  const salida = [];
  let pagina = '';
  do {
    const p = new URLSearchParams({ maxResults: '250', minAccessRole: 'freeBusyReader' });
    if (pagina) p.set('pageToken', pagina);
    const r = await drive.pedirJSON(`${API}/users/me/calendarList?${p}`);
    for (const c of r.items || []) {
      salida.push({
        id: c.id, nombre: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || '#7D888C',
        principal: !!c.primary, acceso: c.accessRole, feriados: /#holiday@/.test(c.id),
        porDefecto: /#contacts@|#weeknum@|#weather@/.test(c.id),
      });
    }
    pagina = r.nextPageToken || '';
  } while (pagina);
  if (!salida.some(c => c.feriados)) salida.push({ id: FERIADOS_AR, nombre: 'Feriados en Argentina', color: '#6B4E9B', feriados: true, acceso: 'reader', publico: true });
  return salida;
}

// Eventos de un calendario entre dos fechas (AAAA-MM-DD), con las repeticiones ya expandidas.
export async function eventos(calId, desde, hasta) {
  const salida = [];
  let pagina = '';
  do {
    const p = new URLSearchParams({
      singleEvents: 'true', orderBy: 'startTime', maxResults: '250', showDeleted: 'false',
      timeMin: new Date(`${desde}T00:00:00`).toISOString(), timeMax: new Date(`${hasta}T23:59:59`).toISOString(),
      fields: 'nextPageToken,items(id,status,summary,location,start,end,hangoutLink,conferenceData(entryPoints(entryPointType,uri)),organizer(email,displayName,self),attendees(email,self,responseStatus),htmlLink)',
    });
    if (pagina) p.set('pageToken', pagina);
    const r = await drive.pedirJSON(`${API}/calendars/${encodeURIComponent(calId)}/events?${p}`);
    salida.push(...(r.items || []));
    pagina = r.nextPageToken || '';
  } while (pagina);
  return salida;
}
