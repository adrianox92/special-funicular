/**
 * cacheControl de Storage: segundos de max-age.
 * Los nombres de objeto son únicos (timestamp+hash); immutable es seguro.
 */
const STORAGE_CACHE_CONTROL_SECONDS = '31536000';

const STORAGE_UPLOAD_CACHE = Object.freeze({
  cacheControl: STORAGE_CACHE_CONTROL_SECONDS,
});

function isLongLivedCacheControl(value) {
  const s = String(value || '').toLowerCase();
  if (!s || s === 'no-cache' || s === 'no-store') return false;
  const m = s.match(/max-age=(\d+)/) || s.match(/^(\d+)$/);
  if (!m) return false;
  return Number(m[1]) >= 86400;
}

module.exports = {
  STORAGE_CACHE_CONTROL_SECONDS,
  STORAGE_UPLOAD_CACHE,
  isLongLivedCacheControl,
};
