'use strict';

const {
  calendarPhase,
  isPublicCalendarCompetition,
  normalizeDateKey,
  sortLeagueCalendarItems,
  groupLeagueCalendarItems,
  attachCompetitionEventDates,
} = require('../../lib/leagueSeasonCalendar');

describe('leagueSeasonCalendar', () => {
  it('clasifica estados en próximas / en curso / disputadas', () => {
    expect(calendarPhase('draft')).toBe('upcoming');
    expect(calendarPhase('published')).toBe('upcoming');
    expect(calendarPhase('running')).toBe('running');
    expect(calendarPhase('closed')).toBe('completed');
  });

  it('oculta borradores en el subconjunto público', () => {
    expect(isPublicCalendarCompetition({ status: 'draft' })).toBe(false);
    expect(isPublicCalendarCompetition({ status: 'published' })).toBe(true);
    expect(isPublicCalendarCompetition({ status: 'closed' })).toBe(true);
  });

  it('normaliza fechas YYYY-MM-DD y rechaza vacíos', () => {
    expect(normalizeDateKey('2026-04-12T10:00:00.000Z')).toBe('2026-04-12');
    expect(normalizeDateKey('2026-04-12')).toBe('2026-04-12');
    expect(normalizeDateKey(null)).toBe(null);
    expect(normalizeDateKey('')).toBe(null);
  });

  it('ordena por fecha cuando ambas la tienen; si falta, usa order_index', () => {
    const items = [
      { id: 'c', name: 'C', order_index: 2, event_date: '2026-05-01', status: 'published' },
      { id: 'a', name: 'A', order_index: 0, event_date: null, status: 'published' },
      { id: 'b', name: 'B', order_index: 1, event_date: '2026-03-01', status: 'closed' },
    ];
    const sorted = sortLeagueCalendarItems(items);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('sin fechas respeta order_index y no inventa event_date', () => {
    const items = [
      { id: '2', name: 'Segunda', order_index: 1, status: 'closed' },
      { id: '1', name: 'Primera', order_index: 0, status: 'published' },
      { id: '3', name: 'Tercera', order_index: 2, status: 'running' },
    ];
    const grouped = groupLeagueCalendarItems(items);
    expect(grouped.items.map((i) => i.id)).toEqual(['1', '2', '3']);
    expect(grouped.has_dates).toBe(false);
    expect(grouped.upcoming).toHaveLength(1);
    expect(grouped.running).toHaveLength(1);
    expect(grouped.completed).toHaveLength(1);
    expect(grouped.items.every((i) => i.event_date == null)).toBe(true);
  });

  it('filtra borradores en modo público y agrupa el resto', () => {
    const items = [
      { id: 'd', name: 'Borrador', order_index: 0, status: 'draft', event_date: '2026-01-01' },
      { id: 'p', name: 'Pub', order_index: 1, status: 'published', event_date: '2026-02-01' },
      { id: 'x', name: 'Cerrada', order_index: 2, status: 'closed', event_date: '2026-01-15' },
    ];
    const grouped = groupLeagueCalendarItems(items, { publicOnly: true });
    expect(grouped.items.map((i) => i.id)).toEqual(['x', 'p']);
    expect(grouped.upcoming.map((i) => i.id)).toEqual(['p']);
    expect(grouped.completed.map((i) => i.id)).toEqual(['x']);
  });

  it('adjunta la fecha más temprana del club_event y no usa created_at', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            order: async () => ({
              data: [
                { competition_id: 'a', event_date: '2026-06-10', start_time: '18:00' },
                { competition_id: 'a', event_date: '2026-07-01', start_time: null },
              ],
              error: null,
            }),
          }),
        }),
      }),
    };
    const result = await attachCompetitionEventDates(supabase, [
      { id: 'a', name: 'Con evento', order_index: 0, status: 'published', created_at: '2025-01-01' },
      { id: 'b', name: 'Sin evento', order_index: 1, status: 'published', created_at: '2025-02-01' },
    ]);
    expect(result[0].event_date).toBe('2026-06-10');
    expect(result[0].date_source).toBe('club_event');
    expect(result[1].event_date).toBe(null);
    expect(result[1].date_source).toBe(null);
  });
});
