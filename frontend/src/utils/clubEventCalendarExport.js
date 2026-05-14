/**
 * Enlaces y fichero .ics para un evento del calendario del club (Google Calendar, Apple, Outlook…).
 */

import { addHours } from 'date-fns';
import { toDate, formatInTimeZone } from 'date-fns-tz';

export function defaultClubEventTz() {
  return import.meta.env.VITE_CLUB_EVENTS_TZ || 'Europe/Madrid';
}

export function competitionPublicSignupUrl(slug, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (!slug) return '';
  const o = String(origin || '').replace(/\/$/, '');
  return `${o}/competitions/signup/${encodeURIComponent(slug)}`;
}

function addOneDayYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d + 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

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

function addDaysYmd(ymdHyphen, delta) {
  const [y, m, d] = ymdHyphen.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

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
  const dtf = String(newYmdHyphen).slice(0, 10).replace(/-/g, '');
  return `${dtf}T${String(nh).padStart(2, '0')}${String(nmi).padStart(2, '0')}${String(nss).padStart(2, '0')}`;
}

function wallYmdTimeToIcsFloating(ymdHyphen, hhmmss) {
  const d = String(ymdHyphen).slice(0, 10).replace(/-/g, '');
  const [h, m, s] = hhmmss.split(':');
  return `${d}T${h.padStart(2, '0')}${m.padStart(2, '0')}${(s || '00').padStart(2, '0')}`;
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
    const signup = competitionPublicSignupUrl(slug, origin);
    const line = `Inscripción: ${signup}`;
    body = body ? `${body}\n\n${line}` : line;
  }
  return body;
}

function formatGoogleDatesUtc(startUtc, endUtc) {
  const a = formatInTimeZone(startUtc, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  const b = formatInTimeZone(endUtc, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  return `${a}/${b}`;
}

/**
 * URL para crear evento en Google Calendar (día completo o con hora).
 * @returns {string|null}
 */
export function googleCalendarUrlForClubEvent(ev, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const title = ev.title || 'Evento';
  const dateStr = String(ev.event_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const details = eventDescriptionLines(ev, origin);
  const tz = defaultClubEventTz();
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
  });
  if (details) params.set('details', details);
  if (ev.location && String(ev.location).trim()) {
    params.set('location', String(ev.location).trim());
  }

  const startHms = timeToHms(ev.start_time);
  if (startHms) {
    const [hh, mm, ss] = startHms.split(':');
    const startUtc = toDate(`${dateStr}T${hh}:${mm}:${ss}`, { timeZone: tz });
    let endUtc;
    const endHms = timeToHms(ev.end_time);
    if (endHms) {
      const [eh, em, es] = endHms.split(':');
      endUtc = toDate(`${dateStr}T${eh}:${em}:${es}`, { timeZone: tz });
    } else {
      endUtc = addHours(startUtc, 1);
    }
    if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) return null;
    params.set('dates', formatGoogleDatesUtc(startUtc, endUtc));
  } else {
    const start = dateStr.replace(/-/g, '');
    const end = addOneDayYmd(dateStr);
    if (!end) return null;
    params.set('dates', `${start}/${end}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Genera un Blob text/calendar con un único VEVENT.
 */
export function clubEventToIcsBlob(ev, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const dateStr = String(ev.event_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

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
  ];

  const startHms = timeToHms(ev.start_time);
  if (startHms) {
    const startIcs = wallYmdTimeToIcsFloating(dateStr, startHms);
    const endHms = timeToHms(ev.end_time);
    const endIcs = endHms
      ? wallYmdTimeToIcsFloating(dateStr, endHms)
      : addSecondsToWallFloating(dateStr, startHms, 3600);
    lines.push(`DTSTART:${startIcs}`);
    lines.push(`DTEND:${endIcs}`);
  } else {
    const dt = dateStr.replace(/-/g, '');
    const dtEnd = addOneDayYmd(dateStr);
    if (!dtEnd) return null;
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
  }

  lines.push(foldLine(`SUMMARY:${icsEscape(ev.title || 'Evento')}`));
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

/** Para <input type="time" /> desde valor API "HH:mm:ss" o null */
export function clubEventTimeForInput(t) {
  if (t == null || t === '') return '';
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}
