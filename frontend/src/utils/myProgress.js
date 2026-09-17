import { ACTIVATION_STALE_DAYS } from './activationNudge';

/** Umbral suave: misma ventana de 30 días que el nudge stale. */
export const PROGRESS_STALE_DAYS = ACTIVATION_STALE_DAYS;

/**
 * CTA a /session solo si no hay otro nudge de sesión visible
 * y el mes va a 0 o la última sesión está fría.
 */
export function shouldShowProgressCta({
  sessionsThisMonth = 0,
  daysSinceLastSession = null,
  totalTimings = 0,
  sessionNudgeVisible = false,
  staleDays = PROGRESS_STALE_DAYS,
} = {}) {
  if (sessionNudgeVisible) return false;
  if ((Number(totalTimings) || 0) < 1) return true;
  if ((Number(sessionsThisMonth) || 0) < 1) return true;
  if (daysSinceLastSession != null && Number(daysSinceLastSession) >= staleDays) return true;
  return false;
}

export function sessionsMonthDelta(sessionsThisMonth = 0, sessionsLastMonth = 0) {
  return (Number(sessionsThisMonth) || 0) - (Number(sessionsLastMonth) || 0);
}

export function emptyProgress() {
  return {
    sessionsThisMonth: 0,
    sessionsLastMonth: 0,
    lastSessionDate: null,
    daysSinceLastSession: null,
    consecutiveWeeksWithSession: 0,
  };
}
