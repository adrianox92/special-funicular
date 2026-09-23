import {
  calendarPhase,
  groupLeagueCalendarItems,
  sortLeagueCalendarItems,
} from '../../utils/leagueSeasonCalendar';

describe('leagueSeasonCalendar', () => {
  test('clasifica draft/published como próximas', () => {
    expect(calendarPhase('draft')).toBe('upcoming');
    expect(calendarPhase('published')).toBe('upcoming');
    expect(calendarPhase('running')).toBe('running');
    expect(calendarPhase('closed')).toBe('completed');
  });

  test('ordena por fecha y cae a order_index si falta', () => {
    const sorted = sortLeagueCalendarItems([
      { id: 'late', order_index: 0, event_date: '2026-09-01', name: 'Late' },
      { id: 'early', order_index: 2, event_date: '2026-03-01', name: 'Early' },
      { id: 'nodate', order_index: 1, event_date: null, name: 'No date' },
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['early', 'late', 'nodate']);
  });

  test('empty y sin fechas siguen siendo útiles por estado/orden', () => {
    expect(groupLeagueCalendarItems([]).items).toEqual([]);
    const grouped = groupLeagueCalendarItems([
      { id: '2', name: 'B', order_index: 1, status: 'closed' },
      { id: '1', name: 'A', order_index: 0, status: 'published' },
    ]);
    expect(grouped.hasDates).toBe(false);
    expect(grouped.items.map((i) => i.id)).toEqual(['1', '2']);
    expect(grouped.upcoming).toHaveLength(1);
    expect(grouped.completed).toHaveLength(1);
  });

  test('publicOnly oculta draft', () => {
    const grouped = groupLeagueCalendarItems(
      [
        { id: 'd', name: 'Draft', order_index: 0, status: 'draft' },
        { id: 'p', name: 'Pub', order_index: 1, status: 'published' },
      ],
      { publicOnly: true },
    );
    expect(grouped.items.map((i) => i.id)).toEqual(['p']);
  });
});
