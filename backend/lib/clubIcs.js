/**
 * Genera un calendario iCalendar (text/calendar) para eventos del club.
 * @param {Array<object>} events - Filas club_events con competición opcional anidada
 * @param {{ signupBaseUrl?: string, uidDomain?: string }} options
 */
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

function formatIcsDate(dStr) {
  const s = String(dStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s.replace(/-/g, '');
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
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

function buildClubEventsIcs(events, options = {}) {
  const uidDomain = options.uidDomain || 'slotdatabase.app';
  const signupBase = (options.signupBaseUrl || '').replace(/\/+$/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scalextric Collection//Club Calendar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const ev of events || []) {
    const dt = formatIcsDate(ev.event_date);
    if (!dt) continue;
    const dtEnd = addDaysYmd(String(ev.event_date).slice(0, 10), 1);
    const slug = ev.competitions?.public_slug;
    let desc = ev.description || '';
    if (slug && signupBase) {
      const signupLine = `Inscripción: ${signupBase}/competitions/signup/${slug}`;
      desc = desc ? `${desc}\n\n${signupLine}` : signupLine;
    }
    const descFolded = foldLine(`DESCRIPTION:${icsEscape(desc)}`);
    const locFolded = ev.location ? foldLine(`LOCATION:${icsEscape(ev.location)}`) : null;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:club-event-${ev.id}@${uidDomain}`);
    lines.push(`DTSTAMP:${dtstampNow()}`);
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(ev.title || 'Evento')}`));
    if (locFolded) lines.push(locFolded);
    lines.push(descFolded);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

module.exports = { buildClubEventsIcs, icsEscape };
