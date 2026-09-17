import {
  ACTIVATION_NUDGE_STORAGE,
  ACTIVATION_QUIET_SNOOZE_DAYS,
  dismissActivationNudge,
  getActivationNudgeVariant,
  getQuietCopyKey,
  isActivationNudgeDismissed,
  QUIET_COPY_KEYS,
} from '../../utils/activationNudge';
import esDashboard from '../../i18n/locales/es/dashboard.json';
import enDashboard from '../../i18n/locales/en/dashboard.json';
import deDashboard from '../../i18n/locales/de/dashboard.json';

describe('getActivationNudgeVariant', () => {
  test('no muestra nada sin vehículos', () => {
    expect(getActivationNudgeVariant({ totalVehicles: 0, totalTimings: 0, timingsLast30Days: 0 })).toBeNull();
  });

  test('first cuando hay garaje y cero tiempos', () => {
    expect(getActivationNudgeVariant({ totalVehicles: 2, totalTimings: 0, timingsLast30Days: 0 })).toBe('first');
  });

  test('no duplica el primer tiempo si el checklist de onboarding ya está visible', () => {
    expect(
      getActivationNudgeVariant({
        totalVehicles: 2,
        totalTimings: 0,
        timingsLast30Days: 0,
        timingsLast14Days: 0,
        suppressFirst: true,
      }),
    ).toBeNull();
  });

  test('quiet cuando hay tiempos en 30 días pero ninguno en 14', () => {
    expect(
      getActivationNudgeVariant({
        totalVehicles: 1,
        totalTimings: 4,
        timingsLast30Days: 2,
        timingsLast14Days: 0,
      }),
    ).toBe('quiet');
  });

  test('quiet no se apila con el checklist de primer tiempo (requiere tiempos históricos)', () => {
    expect(
      getActivationNudgeVariant({
        totalVehicles: 1,
        totalTimings: 4,
        timingsLast30Days: 1,
        timingsLast14Days: 0,
        suppressFirst: true,
      }),
    ).toBe('quiet');
  });

  test('stale cuando hay tiempos históricos pero ninguno en 30 días', () => {
    expect(
      getActivationNudgeVariant({
        totalVehicles: 1,
        totalTimings: 4,
        timingsLast30Days: 0,
        timingsLast14Days: 0,
      }),
    ).toBe('stale');
  });

  test('stale sigue visible aunque el checklist de onboarding esté activo', () => {
    expect(
      getActivationNudgeVariant({
        totalVehicles: 1,
        totalTimings: 4,
        timingsLast30Days: 0,
        timingsLast14Days: 0,
        suppressFirst: true,
      }),
    ).toBe('stale');
  });

  test('oculto si hay tiempos recientes (14 días)', () => {
    expect(
      getActivationNudgeVariant({
        totalVehicles: 3,
        totalTimings: 4,
        timingsLast30Days: 1,
        timingsLast14Days: 1,
      }),
    ).toBeNull();
    expect(
      getActivationNudgeVariant({
        totalVehicles: 3,
        totalTimings: 1,
        timingsLast30Days: 1,
        timingsLast14Days: 1,
      }),
    ).toBeNull();
  });

  test('sin timingsLast14Days no muestra quiet (fallback conservador a 30 días)', () => {
    expect(
      getActivationNudgeVariant({
        totalVehicles: 3,
        totalTimings: 4,
        timingsLast30Days: 1,
      }),
    ).toBeNull();
    expect(
      getActivationNudgeVariant({
        totalVehicles: 3,
        totalTimings: 4,
        timingsLast30Days: 0,
      }),
    ).toBe('stale');
  });
});

describe('getQuietCopyKey', () => {
  test('diciembre y enero usan la variante holiday', () => {
    expect(getQuietCopyKey(new Date('2026-12-20T12:00:00.000Z'))).toBe('holiday');
    expect(getQuietCopyKey(new Date('2026-01-05T12:00:00.000Z'))).toBe('holiday');
  });

  test('fuera de fiestas rota entre claves estables', () => {
    const key = getQuietCopyKey(new Date('2026-03-18T12:00:00.000Z'));
    expect(QUIET_COPY_KEYS).toContain(key);
    expect(getQuietCopyKey(new Date('2026-03-18T18:00:00.000Z'))).toBe(key);
  });
});

describe('dismissActivationNudge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('persiste el dismiss por variante', () => {
    expect(isActivationNudgeDismissed('first')).toBe(false);
    dismissActivationNudge('first');
    expect(localStorage.getItem(ACTIVATION_NUDGE_STORAGE.first)).toBe('1');
    expect(isActivationNudgeDismissed('first')).toBe(true);
    expect(isActivationNudgeDismissed('stale')).toBe(false);
  });

  test('quiet pospone 7 días y vuelve a mostrarse después', () => {
    const dismissedAt = new Date('2026-03-15T12:00:00.000Z');
    dismissActivationNudge('quiet', dismissedAt);
    const stored = localStorage.getItem(ACTIVATION_NUDGE_STORAGE.quiet);
    expect(stored).toBeTruthy();

    expect(isActivationNudgeDismissed('quiet', dismissedAt)).toBe(true);
    const stillSnoozed = new Date(dismissedAt);
    stillSnoozed.setUTCDate(stillSnoozed.getUTCDate() + ACTIVATION_QUIET_SNOOZE_DAYS - 1);
    expect(isActivationNudgeDismissed('quiet', stillSnoozed)).toBe(true);

    const afterSnooze = new Date(dismissedAt);
    afterSnooze.setUTCDate(afterSnooze.getUTCDate() + ACTIVATION_QUIET_SNOOZE_DAYS);
    afterSnooze.setUTCMilliseconds(afterSnooze.getUTCMilliseconds() + 1);
    expect(isActivationNudgeDismissed('quiet', afterSnooze)).toBe(false);
  });
});

describe('i18n quiet copy', () => {
  test('ES/EN/DE tienen las mismas claves de copy quiet', () => {
    const keys = Object.keys(esDashboard.activationNudge.quiet).sort();
    expect(keys).toEqual(['holiday', 'rhythm', 'short', 'week']);
    expect(Object.keys(enDashboard.activationNudge.quiet).sort()).toEqual(keys);
    expect(Object.keys(deDashboard.activationNudge.quiet).sort()).toEqual(keys);
    keys.forEach((key) => {
      expect(esDashboard.activationNudge.quiet[key].title).toBeTruthy();
      expect(esDashboard.activationNudge.quiet[key].body).toBeTruthy();
      expect(enDashboard.activationNudge.quiet[key].title).toBeTruthy();
      expect(enDashboard.activationNudge.quiet[key].body).toBeTruthy();
      expect(deDashboard.activationNudge.quiet[key].title).toBeTruthy();
      expect(deDashboard.activationNudge.quiet[key].body).toBeTruthy();
    });
  });
});
