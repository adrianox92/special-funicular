const {
  sortParticipantsByStartOrder,
  startOrderConflictMessage,
} = require('../../lib/competitionStartOrder');

describe('competitionStartOrder', () => {
  describe('sortParticipantsByStartOrder', () => {
    it('ordena por start_order y usa created_at como fallback', () => {
      const sorted = sortParticipantsByStartOrder([
        { id: 'c', start_order: null, created_at: '2026-01-03T00:00:00.000Z' },
        { id: 'a', start_order: 1, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'b', start_order: 2, created_at: '2026-01-02T00:00:00.000Z' },
      ]);
      expect(sorted.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('startOrderConflictMessage', () => {
    it('describe el piloto que ya ocupa el orden', () => {
      expect(
        startOrderConflictMessage({ driver_name: 'Adrián Palomera' }, 1),
      ).toBe('El orden 1 ya lo tiene Adrián Palomera');
    });
  });
});
