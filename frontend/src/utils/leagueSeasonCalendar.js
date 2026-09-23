/**
 * Calendario de temporada de liga (G3).
 * Ordena por fecha si existe; si no, por order_index. No inventa fechas.
 */

export const CALENDAR_PHASES = ['upcoming', 'running', 'completed'];

export function calendarPhase(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'closed') return 'completed';
  if (s === 'running') return 'running';
  return 'upcoming';
}

export function isPublicCalendarCompetition(comp) {
  const s = String(comp?.status || '').toLowerCase();
  return s === 'published' || s === 'running' || s === 'closed';
}

export function normalizeDateKey(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function parseLeagueDate(value) {
  const key = normalizeDateKey(value);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function compareLeagueCalendarItems(a, b) {
  const da = normalizeDateKey(a?.event_date);
  const db = normalizeDateKey(b?.event_date);
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!da && db) return 1;
  const oa = Number(a?.order_index);
  const ob = Number(b?.order_index);
  const na = Number.isFinite(oa) ? oa : 0;
  const nb = Number.isFinite(ob) ? ob : 0;
  if (na !== nb) return na - nb;
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'es');
}

export function sortLeagueCalendarItems(items) {
  return [...(items || [])].sort(compareLeagueCalendarItems);
}

export function decorateLeagueCalendarItem(comp) {
  return {
    ...comp,
    event_date: normalizeDateKey(comp?.event_date) || null,
    calendar_phase: comp?.calendar_phase || calendarPhase(comp?.status),
  };
}

export function groupLeagueCalendarItems(items, { publicOnly = false } = {}) {
  const sorted = sortLeagueCalendarItems(items)
    .map(decorateLeagueCalendarItem)
    .filter((c) => (publicOnly ? isPublicCalendarCompetition(c) : Boolean(c)));
  return {
    upcoming: sorted.filter((c) => c.calendar_phase === 'upcoming'),
    running: sorted.filter((c) => c.calendar_phase === 'running'),
    completed: sorted.filter((c) => c.calendar_phase === 'completed'),
    items: sorted,
    hasDates: sorted.some((c) => Boolean(c.event_date)),
  };
}
