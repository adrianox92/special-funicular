import {
  cachedStorageImageUrl,
  parseAllowedStorageUrl,
  PROXY_PREFIX,
  ALLOWED_BUCKETS,
} from './cachedStorageImageUrl';

const ALLOWED_BUCKET_SET = new Set(ALLOWED_BUCKETS || ['catalog-images', 'vehicle-images']);
const IMG_PROXY_PREFIX = PROXY_PREFIX || '/api/img/';

function isProxiedAllowedBucket(path) {
  const s = String(path || '');
  if (!s.startsWith(IMG_PROXY_PREFIX)) return false;
  const rest = s.slice(IMG_PROXY_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return false;
  return ALLOWED_BUCKET_SET.has(rest.slice(0, slash));
}

/**
 * URL mostrable en la card pública: solo Storage de vehículo o catálogo.
 * Rechaza placeholders ajenos (picsum, CDN genérico, etc.).
 * @param {unknown} raw
 * @returns {string}
 */
export function publicVehicleImageSrc(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (isProxiedAllowedBucket(s)) return s;
  const parsed = parseAllowedStorageUrl(s);
  if (!parsed) return '';
  return cachedStorageImageUrl(s) || s;
}
