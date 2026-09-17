import { emptyProgress, sessionsMonthDelta, shouldShowProgressCta } from '../../utils/myProgress';
import esDashboard from '../../i18n/locales/es/dashboard.json';
import enDashboard from '../../i18n/locales/en/dashboard.json';
import deDashboard from '../../i18n/locales/de/dashboard.json';

describe('sessionsMonthDelta', () => {
  test('positivo, negativo e igual', () => {
    expect(sessionsMonthDelta(3, 1)).toBe(2);
    expect(sessionsMonthDelta(0, 1)).toBe(-1);
    expect(sessionsMonthDelta(2, 2)).toBe(0);
    expect(sessionsMonthDelta(undefined, undefined)).toBe(0);
  });
});

describe('shouldShowProgressCta', () => {
  test('usuario nuevo sin tiempos: CTA', () => {
    expect(shouldShowProgressCta({ totalTimings: 0, sessionsThisMonth: 0 })).toBe(true);
  });

  test('cero sesiones este mes: CTA', () => {
    expect(shouldShowProgressCta({ totalTimings: 4, sessionsThisMonth: 0, daysSinceLastSession: 12 })).toBe(
      true,
    );
  });

  test('última sesión fría (≥30 días): CTA', () => {
    expect(
      shouldShowProgressCta({
        totalTimings: 8,
        sessionsThisMonth: 1,
        daysSinceLastSession: 30,
      }),
    ).toBe(true);
  });

  test('activo este mes y reciente: sin CTA', () => {
    expect(
      shouldShowProgressCta({
        totalTimings: 8,
        sessionsThisMonth: 2,
        daysSinceLastSession: 4,
      }),
    ).toBe(false);
  });

  test('no duplica el CTA si ya hay nudge de sesión visible', () => {
    expect(
      shouldShowProgressCta({
        totalTimings: 0,
        sessionsThisMonth: 0,
        sessionNudgeVisible: true,
      }),
    ).toBe(false);
  });
});

describe('emptyProgress', () => {
  test('forma estable para el estado cero', () => {
    expect(emptyProgress()).toEqual({
      sessionsThisMonth: 0,
      sessionsLastMonth: 0,
      lastSessionDate: null,
      daysSinceLastSession: null,
      consecutiveWeeksWithSession: 0,
    });
  });
});

describe('i18n myProgress', () => {
  test('mismas claves ES / EN / DE', () => {
    const keys = Object.keys(esDashboard.myProgress).sort();
    expect(Object.keys(enDashboard.myProgress).sort()).toEqual(keys);
    expect(Object.keys(deDashboard.myProgress).sort()).toEqual(keys);
    keys.forEach((key) => {
      expect(String(esDashboard.myProgress[key]).length).toBeGreaterThan(0);
      expect(String(enDashboard.myProgress[key]).length).toBeGreaterThan(0);
      expect(String(deDashboard.myProgress[key]).length).toBeGreaterThan(0);
    });
  });
});
