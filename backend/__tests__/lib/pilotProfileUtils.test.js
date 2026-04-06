const { parseSupplyVoltageVolts, isValidPilotSlug, normalizePilotSlug } = require('../../lib/pilotProfileUtils');

describe('pilotProfileUtils', () => {
  test('parseSupplyVoltageVolts', () => {
    expect(parseSupplyVoltageVolts(null)).toEqual({ ok: true, volts: null });
    expect(parseSupplyVoltageVolts('')).toEqual({ ok: true, volts: null });
    expect(parseSupplyVoltageVolts(12.5)).toEqual({ ok: true, volts: 12.5 });
    expect(parseSupplyVoltageVolts('12,5')).toEqual({ ok: true, volts: 12.5 });
    expect(parseSupplyVoltageVolts(31).ok).toBe(false);
    expect(parseSupplyVoltageVolts(-1).ok).toBe(false);
  });

  test('slug', () => {
    expect(isValidPilotSlug('ab')).toBe(false);
    expect(isValidPilotSlug('abc')).toBe(true);
    expect(isValidPilotSlug('mi-slug-1')).toBe(true);
    expect(normalizePilotSlug('  Mi-Slug  ')).toBe('mi-slug');
  });
});
