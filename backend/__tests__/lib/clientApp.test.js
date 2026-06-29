const {
  resolveClientContext,
  resolveRecordedFrom,
  buildSyncMeta,
} = require('../../lib/clientApp');

describe('clientApp', () => {
  describe('resolveClientContext', () => {
    it('maps lap-timer header to recorded_from lap_timer', () => {
      const req = { headers: { 'x-client-app': 'lap-timer', 'x-client-version': '1.0.0' } };
      const ctx = resolveClientContext(req);
      expect(ctx.recordedFrom).toBe('lap_timer');
      expect(ctx.clientApp).toBe('lap-timer');
      expect(ctx.clientVersion).toBe('1.0.0');
    });

    it('defaults to web when no header', () => {
      const ctx = resolveClientContext({ headers: {} });
      expect(ctx.recordedFrom).toBe('web');
    });
  });

  describe('resolveRecordedFrom', () => {
    it('prefers explicit body value when valid', () => {
      expect(resolveRecordedFrom('import', 'lap_timer')).toBe('import');
    });

    it('falls back to header value', () => {
      expect(resolveRecordedFrom(undefined, 'lap_timer')).toBe('lap_timer');
    });
  });

  describe('buildSyncMeta', () => {
    it('marks first timing as personal best', () => {
      const meta = buildSyncMeta(null, 12.5);
      expect(meta.is_personal_best).toBe(true);
      expect(meta.previous_best_lap_seconds).toBeNull();
    });

    it('computes negative delta on improvement', () => {
      const meta = buildSyncMeta(12.5, 12.3);
      expect(meta.is_personal_best).toBe(true);
      expect(meta.delta_vs_pb_seconds).toBe(-0.2);
    });

    it('computes positive delta when slower', () => {
      const meta = buildSyncMeta(12.3, 12.5);
      expect(meta.is_personal_best).toBe(false);
      expect(meta.delta_vs_pb_seconds).toBe(0.2);
    });
  });
});
