export const ACTIVATION_NUDGE_STORAGE = {
  first: 'sdb.activationNudge.firstDismissed',
  stale: 'sdb.activationNudge.staleDismissed',
};

/**
 * Usuarios con garaje y sin hábito de cronometraje.
 * - first: ≥1 vehículo y 0 tiempos
 * - stale: ≥1 vehículo, tiene tiempos históricos, 0 en los últimos 30 días
 */
export function getActivationNudgeVariant({
  totalVehicles = 0,
  totalTimings = 0,
  timingsLast30Days = 0,
} = {}) {
  if (Number(totalVehicles) < 1) return null;
  if (Number(timingsLast30Days) > 0) return null;
  if (Number(totalTimings) < 1) return 'first';
  return 'stale';
}

export function isActivationNudgeDismissed(variant) {
  if (!variant || typeof localStorage === 'undefined') return false;
  const key = ACTIVATION_NUDGE_STORAGE[variant];
  if (!key) return false;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function dismissActivationNudge(variant) {
  if (!variant || typeof localStorage === 'undefined') return;
  const key = ACTIVATION_NUDGE_STORAGE[variant];
  if (!key) return;
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* ignore quota / private mode */
  }
}
