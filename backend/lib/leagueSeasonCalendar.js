'use strict';

/**
 * Calendario de temporada de una liga (G3).
 * No inventa fechas: solo usa event_date explícito o el del club_event vinculado.
 */

function calendarPhase(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'closed') return 'completed';
  if (s === 'running') return 'running';
  return 'upcoming';
}

function isPublicCalendarCompetition(comp) {
  const s = String(comp?.status || '').toLowerCase();
  return s === 'published' || s === 'running' || s === 'closed';
}

function normalizeDateKey(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function compareLeagueCalendarItems(a, b) {
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

function sortLeagueCalendarItems(items) {
  return [...(items || [])].sort(compareLeagueCalendarItems);
}

function decorateLeagueCalendarItem(comp) {
  const eventDate = normalizeDateKey(comp?.event_date) || null;
  return {
    ...comp,
    event_date: eventDate,
    calendar_phase: calendarPhase(comp?.status),
  };
}

/**
 * Adjunta la fecha más temprana de `club_events` por competición.
 * Si no hay evento vinculado, deja event_date en null (no usa created_at).
 */
async function attachCompetitionEventDates(supabase, competitions) {
  const list = Array.isArray(competitions) ? competitions : [];
  const ids = [...new Set(list.map((c) => c.id).filter(Boolean))];

  const decorateWithoutLookup = () =>
    list.map((c) =>
      decorateLeagueCalendarItem({
        ...c,
        event_date: normalizeDateKey(c.event_date) || null,
        date_source: c.date_source || null,
      }),
    );

  if (!ids.length || !supabase) {
    return decorateWithoutLookup();
  }

  const { data, error } = await supabase
    .from('club_events')
    .select('competition_id, event_date, start_time')
    .in('competition_id', ids)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('attachCompetitionEventDates', error);
    return list.map((c) =>
      decorateLeagueCalendarItem({
        ...c,
        event_date: null,
        event_start_time: null,
        date_source: null,
      }),
    );
  }

  const firstByComp = new Map();
  for (const ev of data || []) {
    if (!ev.competition_id || firstByComp.has(ev.competition_id)) continue;
    const key = normalizeDateKey(ev.event_date);
    if (!key) continue;
    firstByComp.set(ev.competition_id, {
      event_date: key,
      event_start_time: ev.start_time || null,
      date_source: 'club_event',
    });
  }

  return list.map((c) => {
    const extra = firstByComp.get(c.id);
    if (!extra) {
      return decorateLeagueCalendarItem({
        ...c,
        event_date: null,
        event_start_time: null,
        date_source: null,
      });
    }
    return decorateLeagueCalendarItem({
      ...c,
      event_date: extra.event_date,
      event_start_time: extra.event_start_time,
      date_source: extra.date_source,
    });
  });
}

function groupLeagueCalendarItems(items, { publicOnly = false } = {}) {
  const sorted = sortLeagueCalendarItems(items)
    .map(decorateLeagueCalendarItem)
    .filter((c) => (publicOnly ? isPublicCalendarCompetition(c) : Boolean(c)));
  return {
    upcoming: sorted.filter((c) => c.calendar_phase === 'upcoming'),
    running: sorted.filter((c) => c.calendar_phase === 'running'),
    completed: sorted.filter((c) => c.calendar_phase === 'completed'),
    items: sorted,
    has_dates: sorted.some((c) => Boolean(c.event_date)),
  };
}

async function loadPublicClubLeagues(supabase, clubId) {
  if (!supabase || !clubId) return [];

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, name, slug, status')
    .eq('club_id', clubId)
    .in('status', ['published', 'running', 'closed'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('loadPublicClubLeagues', error);
    return [];
  }
  if (!leagues?.length) return [];

  const ids = leagues.map((l) => l.id);
  const { data: links, error: linkErr } = await supabase
    .from('league_competitions')
    .select(
      'league_id, order_index, competitions ( id, name, status, public_slug, circuit_name, registration_deadline )',
    )
    .in('league_id', ids)
    .order('order_index', { ascending: true });

  if (linkErr) {
    console.error('loadPublicClubLeagues links', linkErr);
    return leagues.map((lg) => ({ ...lg, competitions: [] }));
  }

  const byLeague = new Map(ids.map((id) => [id, []]));
  const flat = [];
  for (const row of links || []) {
    if (!row.competitions?.id) continue;
    const item = {
      ...row.competitions,
      order_index: row.order_index,
    };
    const arr = byLeague.get(row.league_id);
    if (arr) arr.push(item);
    flat.push(item);
  }

  const decorated = await attachCompetitionEventDates(supabase, flat);
  const byId = new Map(decorated.map((c) => [c.id, c]));

  return leagues.map((lg) => {
    const comps = (byLeague.get(lg.id) || [])
      .map((c) => byId.get(c.id) || decorateLeagueCalendarItem(c))
      .filter(isPublicCalendarCompetition);
    return {
      id: lg.id,
      name: lg.name,
      slug: lg.slug,
      status: lg.status,
      competitions: groupLeagueCalendarItems(comps).items,
    };
  });
}

module.exports = {
  calendarPhase,
  isPublicCalendarCompetition,
  normalizeDateKey,
  compareLeagueCalendarItems,
  sortLeagueCalendarItems,
  decorateLeagueCalendarItem,
  attachCompetitionEventDates,
  groupLeagueCalendarItems,
  loadPublicClubLeagues,
};
