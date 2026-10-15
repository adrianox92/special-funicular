import {
  cachedStorageImageUrl,
  parseAllowedStorageUrl,
  PROXY_PREFIX,
  ALLOWED_BUCKETS,
} from './cachedStorageImageUrl';

const ALLOWED_BUCKET_SET = new Set(ALLOWED_BUCKETS || ['catalog-images', 'vehicle-images']);
const IMG_PROXY_PREFIX = PROXY_PREFIX || '/api/img/';

function proxyPathFromMaybeAbsolute(raw) {
  const s = String(raw || '');
  if (s.startsWith(IMG_PROXY_PREFIX)) return s;
  try {
    const url = new URL(s);
    if (url.pathname.startsWith(IMG_PROXY_PREFIX)) return url.pathname;
  } catch {
    /* not an absolute URL */
  }
  return '';
}

function isProxiedAllowedBucket(path) {
  const proxied = proxyPathFromMaybeAbsolute(path);
  if (!proxied.startsWith(IMG_PROXY_PREFIX)) return false;
  const rest = proxied.slice(IMG_PROXY_PREFIX.length);
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
