/** Valor por defecto del umbral “sin sesión en circuito habitual” (días). */
const DEFAULT_STALE_DAYS_THRESHOLD = 60;
const MIN_STALE_DAYS_THRESHOLD = 1;
const MAX_STALE_DAYS_THRESHOLD = 365;

/**
 * Lee `stale_days_threshold` de user_metadata (Supabase Auth) con límites seguros.
 * @param {import('@supabase/supabase-js').User | { user_metadata?: Record<string, unknown> } | null | undefined} user
 * @returns {number}
 */
function resolveStaleDaysThreshold(user) {
  const raw = user?.user_metadata?.stale_days_threshold;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return DEFAULT_STALE_DAYS_THRESHOLD;
  }
  const rounded = Math.round(n);
  return Math.min(MAX_STALE_DAYS_THRESHOLD, Math.max(MIN_STALE_DAYS_THRESHOLD, rounded));
}

module.exports = {
  resolveStaleDaysThreshold,
  DEFAULT_STALE_DAYS_THRESHOLD,
  MIN_STALE_DAYS_THRESHOLD,
  MAX_STALE_DAYS_THRESHOLD,
};
