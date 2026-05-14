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

function addDaysYmd(ymdHyphen, delta) {
  const [y, m, d] = ymdHyphen.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Normaliza time desde Postgres/JSON (p. ej. "18:30:00") a HH:mm:ss */
function timeToHms(t) {
  if (t == null || t === '') return null;
  const s = String(t);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
  const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
  const ss = m[3] != null ? String(Math.min(59, parseInt(m[3], 10))).padStart(2, '0') : '00';
  return `${hh}:${mm}:${ss}`;
}

/** Suma segundos a fecha+hora local flotante; devuelve YYYYMMDDTHHmmss para ICS */
function addSecondsToWallFloating(ymdHyphen, hhmmss, deltaSec) {
  const [hh, mi, ss] = hhmmss.split(':').map(Number);
  let sec = hh * 3600 + mi * 60 + ss + deltaSec;
  let days = Math.floor(sec / 86400);
  sec = ((sec % 86400) + 86400) % 86400;
  const nh = Math.floor(sec / 3600);
  const rem = sec % 3600;
  const nmi = Math.floor(rem / 60);
  const nss = rem % 60;
  const newYmdHyphen = addDaysYmd(ymdHyphen, days);
  const dtf = formatIcsDate(newYmdHyphen);
  return `${dtf}T${String(nh).padStart(2, '0')}${String(nmi).padStart(2, '0')}${String(nss).padStart(2, '0')}`;
}

function wallYmdTimeToIcsFloating(ymdHyphen, hhmmss) {
  const d = formatIcsDate(ymdHyphen);
  const [h, m, s] = hhmmss.split(':');
  return `${d}T${h.padStart(2, '0')}${m.padStart(2, '0')}${(s || '00').padStart(2, '0')}`;
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
    const dateYmd = String(ev.event_date || '').slice(0, 10);
    const dt = formatIcsDate(dateYmd);
    if (!dt) continue;

    const slug = ev.competitions?.public_slug;
    let desc = ev.description || '';
    if (slug && signupBase) {
      const signupLine = `Inscripción: ${signupBase}/competitions/signup/${slug}`;
      desc = desc ? `${desc}\n\n${signupLine}` : signupLine;
    }
    const startHms = timeToHms(ev.start_time);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:club-event-${ev.id}@${uidDomain}`);
    lines.push(`DTSTAMP:${dtstampNow()}`);

    if (startHms) {
      const startIcs = wallYmdTimeToIcsFloating(dateYmd, startHms);
      const endHms = timeToHms(ev.end_time);
      const endIcs = endHms
        ? wallYmdTimeToIcsFloating(dateYmd, endHms)
        : addSecondsToWallFloating(dateYmd, startHms, 3600);
      lines.push(`DTSTART:${startIcs}`);
      lines.push(`DTEND:${endIcs}`);
    } else {
      const dtEnd = addDaysYmd(dateYmd, 1);
      const dtEndCompact = formatIcsDate(dtEnd);
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      lines.push(`DTEND;VALUE=DATE:${dtEndCompact}`);
    }

    lines.push(foldLine(`SUMMARY:${icsEscape(ev.title || 'Evento')}`));
    if (ev.location) lines.push(foldLine(`LOCATION:${icsEscape(ev.location)}`));
    if (desc) lines.push(foldLine(`DESCRIPTION:${icsEscape(desc)}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

module.exports = { buildClubEventsIcs, icsEscape };
