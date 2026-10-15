/**
 * Controles del proxy /api/img: rate limit por IP (sliding window) y hotlink.
 *
 * Vercel Firewall (rate_limit) es el control preferido a escala — no se puede
 * declarar en vercel.json (solo deny/challenge en `routes.mitigate`). Este
 * limiter in-process cubre cache-misses por isolate; ver docs/DEPLOY.md.
 */
const { classifyCatalogUserAgent, getClientIp } = require('./catalogBotGate');

const CANONICAL_HOSTS = Object.freeze(['www.slotdatabase.es', 'slotdatabase.es']);
const SEARCH_REFERER_HOST =
  /(^|\.)(google|googleusercontent|googlebot|gstatic|bing|yahoo|yandex)\./i;

const DEFAULT_BURST_WINDOW_MS = 10 * 1000;
const DEFAULT_BURST_MAX = 120;
const DEFAULT_SUSTAINED_WINDOW_MS = 60 * 1000;
const DEFAULT_SUSTAINED_MAX = 300;
const MAX_TRACKED_IPS = 4000;

/** @type {Map<string, number[]>} */
const hitsByIp = new Map();

function header(req, name) {
  if (!req) return '';
  if (typeof req.get === 'function') {
    const v = req.get(name);
    if (v != null) return String(v);
  }
  const headers = req.headers || {};
  const raw = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || '');
  return raw == null ? '' : String(raw);
}

function envFlagOff(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s === 'off' || s === '0' || s === 'false';
}

function parsePositiveInt(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function imgRateLimitConfig(env = process.env) {
  return {
    burstWindowMs: parsePositiveInt(env.IMG_RATE_LIMIT_BURST_WINDOW_MS, DEFAULT_BURST_WINDOW_MS),
    burstMax: parsePositiveInt(env.IMG_RATE_LIMIT_BURST_MAX, DEFAULT_BURST_MAX),
    windowMs: parsePositiveInt(env.IMG_RATE_LIMIT_WINDOW_MS, DEFAULT_SUSTAINED_WINDOW_MS),
    max: parsePositiveInt(env.IMG_RATE_LIMIT_MAX, DEFAULT_SUSTAINED_MAX),
  };
}

function isImgRateLimitDisabled(env = process.env) {
  return envFlagOff(env.IMG_RATE_LIMIT) || imgRateLimitConfig(env).max === 0;
}

function isImgHotlinkCheckDisabled(env = process.env) {
  return envFlagOff(env.IMG_HOTLINK_CHECK);
}

function hostFromMaybeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(s) ? s : `https://${s}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function allowedRefererHosts(env = process.env) {
  const hosts = new Set(CANONICAL_HOSTS);
  hosts.add('localhost');
  hosts.add('127.0.0.1');
  for (const raw of [env.PUBLIC_IMAGE_ORIGIN, env.PUBLIC_SITE_ORIGIN, env.REACT_APP_SITE_URL]) {
    const host = hostFromMaybeUrl(raw);
    if (host) hosts.add(host);
  }
  return hosts;
}

function isAllowedRefererHost(hostname, env = process.env) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (allowedRefererHosts(env).has(host)) return true;
  if (host.endsWith('.vercel.app')) return true;
  if (SEARCH_REFERER_HOST.test(host)) return true;
  return false;
}

function isPrivilegedImageClient(userAgent) {
  const cls = classifyCatalogUserAgent(userAgent);
  return cls === 'google-index' || cls === 'link-preview' || cls === 'internal-ssr';
}

function pruneHits(hits, cutoff) {
  let i = 0;
  while (i < hits.length && hits[i] < cutoff) i += 1;
  if (i > 0) hits.splice(0, i);
}

function rememberHit(ip, now, windowMs) {
  let hits = hitsByIp.get(ip);
  if (!hits) {
    hits = [];
    hitsByIp.set(ip, hits);
  }
  pruneHits(hits, now - windowMs);
  hits.push(now);
  if (hitsByIp.size > MAX_TRACKED_IPS) {
    const oldest = hitsByIp.keys().next().value;
    if (oldest != null && oldest !== ip) hitsByIp.delete(oldest);
  }
}

/**
 * Sliding window por IP: ráfaga corta + techo por minuto.
 * @returns {{ ok: true } | { ok: false, status: 429, retryAfterSec: number }}
 */
function allowImgRateLimit(req, env = process.env, now = Date.now()) {
  if (isImgRateLimitDisabled(env)) return { ok: true };
  if (isPrivilegedImageClient(header(req, 'user-agent'))) return { ok: true };

  const cfg = imgRateLimitConfig(env);
  const ip = getClientIp(req) || 'unknown';
  let hits = hitsByIp.get(ip);
  if (!hits) hits = [];
  const longestWindow = Math.max(cfg.windowMs, cfg.burstWindowMs);
  pruneHits(hits, now - longestWindow);

  const burstCutoff = now - cfg.burstWindowMs;
  const sustainedCutoff = now - cfg.windowMs;
  const burstCount = hits.reduce((n, t) => (t >= burstCutoff ? n + 1 : n), 0);
  const sustainedCount = hits.reduce((n, t) => (t >= sustainedCutoff ? n + 1 : n), 0);

  if (burstCount >= cfg.burstMax || sustainedCount >= cfg.max) {
    const retryAfterMs = burstCount >= cfg.burstMax ? cfg.burstWindowMs : cfg.windowMs;
    return {
      ok: false,
      status: 429,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  rememberHit(ip, now, longestWindow);
  return { ok: true };
}

/**
 * 403 solo ante hotlink cruzado claro. Referer vacío y crawlers de búsqueda: OK.
 * @returns {{ ok: true } | { ok: false, status: 403, message: string }}
 */
function allowImgHotlink(req, env = process.env) {
  if (isImgHotlinkCheckDisabled(env)) return { ok: true };
  if (isPrivilegedImageClient(header(req, 'user-agent'))) return { ok: true };

  const site = header(req, 'sec-fetch-site').toLowerCase();
  if (site === 'same-origin' || site === 'same-site' || site === 'none') {
    return { ok: true };
  }

  const referer = header(req, 'referer') || header(req, 'referrer');
  if (!referer) return { ok: true };

  let host = '';
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    return { ok: true };
  }
  if (isAllowedRefererHost(host, env)) return { ok: true };

  return { ok: false, status: 403, message: 'Hotlink no permitido' };
}

function resetImgAccessControlForTests() {
  hitsByIp.clear();
}

module.exports = {
  allowImgRateLimit,
  allowImgHotlink,
  isAllowedRefererHost,
  imgRateLimitConfig,
  resetImgAccessControlForTests,
  DEFAULT_BURST_MAX,
  DEFAULT_SUSTAINED_MAX,
};
