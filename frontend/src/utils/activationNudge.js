export const ACTIVATION_QUIET_DAYS = 14;
export const ACTIVATION_STALE_DAYS = 30;
export const ACTIVATION_QUIET_SNOOZE_DAYS = 7;

export const ACTIVATION_NUDGE_STORAGE = {
  first: 'sdb.activationNudge.firstDismissed',
  stale: 'sdb.activationNudge.staleDismissed',
  quiet: 'sdb.activationNudge.quietSnoozedUntil',
};

/** Claves de copy suave (rotación + temporada). */
export const QUIET_COPY_KEYS = ['week', 'rhythm', 'short'];

/**
 * Card de inicio, sin duplicar el checklist global de onboarding.
 * - first: ≥1 vehículo y 0 tiempos, solo si el checklist no está a la vista
 *   (p. ej. lo descartaron). Si el checklist es visible, él ya empuja a /session.
 * - quiet: onboarding hecho (≥1 tiempo), 0 en los últimos 14 días pero sí en 30
 *   (nudge suave a mitad de ciclo; no se apila con stale).
 * - stale: ≥1 vehículo, tiempos históricos, 0 en los últimos 30 días.
 *
 * Si la API no envía timingsLast14Days, se usa timingsLast30Days como fallback
 * conservador: no mostramos quiet a alguien que podría estar activo.
 */
export function getActivationNudgeVariant({
  totalVehicles = 0,
  totalTimings = 0,
  timingsLast30Days = 0,
  timingsLast14Days,
  suppressFirst = false,
} = {}) {
  if (Number(totalVehicles) < 1) return null;

  const last30 = Number(timingsLast30Days) || 0;
  const last14 =
    timingsLast14Days == null || timingsLast14Days === ''
      ? last30
      : Number(timingsLast14Days) || 0;

  if (last14 > 0) return null;
  if (Number(totalTimings) < 1) return suppressFirst ? null : 'first';
  if (last30 > 0) return 'quiet';
  return 'stale';
}

function utcIsoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Copy estable por semana ISO (no cambia al recargar el mismo día).
 * Dic–ene: variante navideña ligera.
 */
export function getQuietCopyKey(now = new Date()) {
  const month = now.getUTCMonth();
  if (month === 11 || month === 0) return 'holiday';
  return QUIET_COPY_KEYS[utcIsoWeek(now) % QUIET_COPY_KEYS.length];
}

export function isActivationNudgeDismissed(variant, now = new Date()) {
  if (!variant || typeof localStorage === 'undefined') return false;
  const key = ACTIVATION_NUDGE_STORAGE[variant];
  if (!key) return false;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    if (variant === 'quiet') {
      const until = Date.parse(raw);
      if (Number.isNaN(until)) return false;
      return until > now.getTime();
    }
    return raw === '1';
  } catch {
    return false;
  }
}

export function dismissActivationNudge(variant, now = new Date()) {
  if (!variant || typeof localStorage === 'undefined') return;
  const key = ACTIVATION_NUDGE_STORAGE[variant];
  if (!key) return;
  try {
    if (variant === 'quiet') {
      const until = new Date(now.getTime());
      until.setUTCDate(until.getUTCDate() + ACTIVATION_QUIET_SNOOZE_DAYS);
      localStorage.setItem(key, until.toISOString());
      return;
    }
    localStorage.setItem(key, '1');
  } catch {
    /* ignore quota / private mode */
  }
}
