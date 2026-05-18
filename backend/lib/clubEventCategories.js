/**
 * Categorías fijas para public.club_events.event_category (debe coincidir con CHECK en DB).
 */
const ALLOWED_CLUB_EVENT_CATEGORIES = Object.freeze([
  'meeting',
  'competition',
  'training',
  'social',
  'maintenance',
  'other',
]);

function isAllowedClubEventCategory(value) {
  return typeof value === 'string' && ALLOWED_CLUB_EVENT_CATEGORIES.includes(value);
}

function normalizeClubEventCategory(value) {
  if (value == null || String(value).trim() === '') return 'other';
  const v = String(value).trim();
  return isAllowedClubEventCategory(v) ? v : 'other';
}

module.exports = {
  ALLOWED_CLUB_EVENT_CATEGORIES,
  isAllowedClubEventCategory,
  normalizeClubEventCategory,
};
