import {
  ACTIVATION_NUDGE_STORAGE,
  dismissActivationNudge,
  getActivationNudgeVariant,
  isActivationNudgeDismissed,
} from '../../utils/activationNudge';

describe('getActivationNudgeVariant', () => {
  test('no muestra nada sin vehículos', () => {
    expect(getActivationNudgeVariant({ totalVehicles: 0, totalTimings: 0, timingsLast30Days: 0 })).toBeNull();
  });

  test('first cuando hay garaje y cero tiempos', () => {
    expect(getActivationNudgeVariant({ totalVehicles: 2, totalTimings: 0, timingsLast30Days: 0 })).toBe('first');
  });

  test('stale cuando hay tiempos históricos pero ninguno en 30 días', () => {
    expect(getActivationNudgeVariant({ totalVehicles: 1, totalTimings: 4, timingsLast30Days: 0 })).toBe('stale');
  });

  test('oculto si hay tiempos recientes', () => {
    expect(getActivationNudgeVariant({ totalVehicles: 3, totalTimings: 4, timingsLast30Days: 1 })).toBeNull();
    expect(getActivationNudgeVariant({ totalVehicles: 3, totalTimings: 1, timingsLast30Days: 1 })).toBeNull();
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
});
