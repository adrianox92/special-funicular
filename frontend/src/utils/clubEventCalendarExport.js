/**
 * Enlaces y fichero .ics para un evento del calendario del club (Google Calendar, Apple, Outlook…).
 */

function addOneDayYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function icsEscape(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  if (rest.length) parts.push(rest);
  return parts.join('\r\n ');
}

function dtstampNow() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function eventDescriptionLines(ev, origin) {
  const slug = ev.competitions?.public_slug;
  let body = ev.description ? String(ev.description).trim() : '';
  if (slug && origin) {
    const signup = `${origin.replace(/\/$/, '')}/competitions/signup/${encodeURIComponent(slug)}`;
    const line = `Inscripción: ${signup}`;
    body = body ? `${body}\n\n${line}` : line;
  }
  return body;
}

/**
 * URL para crear evento en Google Calendar (día completo).
 * @returns {string|null}
 */
export function googleCalendarUrlForClubEvent(ev, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const title = ev.title || 'Evento';
  const dateStr = String(ev.event_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const start = dateStr.replace(/-/g, '');
  const end = addOneDayYmd(dateStr);
  if (!end) return null;

  const details = eventDescriptionLines(ev, origin);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
  });
  if (details) params.set('details', details);
  if (ev.location && String(ev.location).trim()) {
    params.set('location', String(ev.location).trim());
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Genera un Blob text/calendar con un único VEVENT (día completo).
 */
export function clubEventToIcsBlob(ev, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const dateStr = String(ev.event_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const dt = dateStr.replace(/-/g, '');
  const dtEnd = addOneDayYmd(dateStr);
  if (!dtEnd) return null;

  const desc = eventDescriptionLines(ev, origin);
  const uidDomain = 'slotdatabase.app';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scalextric Collection//Club Event//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:club-event-member-${ev.id}@${uidDomain}`,
    `DTSTAMP:${dtstampNow()}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    foldLine(`SUMMARY:${icsEscape(ev.title || 'Evento')}`),
  ];
  if (desc) lines.push(foldLine(`DESCRIPTION:${icsEscape(desc)}`));
  if (ev.location && String(ev.location).trim()) {
    lines.push(foldLine(`LOCATION:${icsEscape(String(ev.location).trim())}`));
  }
  lines.push('END:VEVENT', 'END:VCALENDAR', '');
  const body = lines.join('\r\n');
  return new Blob([body], { type: 'text/calendar;charset=utf-8' });
}

export function downloadClubEventIcs(ev) {
  const blob = clubEventToIcsBlob(ev);
  if (!blob) return false;
  const safe = String(ev.title || 'evento')
    .slice(0, 60)
    .replace(/[^\w\u00C0-\u024f\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'evento';
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `${safe}-${String(ev.event_date).slice(0, 10)}.ics`;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
