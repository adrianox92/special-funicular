/**
 * Acceso al catálogo público de referencias.
 *
 * Objetivo: personas en el navegador, crawlers de indexación de Google
 * (Googlebot + imagen/vídeo/inspección) y bots de vista previa al compartir
 * (WhatsApp, Facebook, Slack, X/Twitter, etc.) pueden ver el catálogo.
 * El resto de bots, scrapers y motores/IA no.
 *
 * robots.txt es cortesía; este módulo es el bloqueo real en servidor.
 * Un cliente que finja un UA de Chrome sigue pudiendo pasar: sin WAF/JS
 * challenge no hay forma fiable de distinguirlo de un usuario.
 */

const dns = require('dns').promises;

const INTERNAL_SSR_UA = 'SlotDatabase-CatalogSSR/1.0';

const GOOGLE_INDEX_UA =
  /Googlebot-Image|Googlebot-Video|Google-InspectionTool|(?:^|[^\w-])Googlebot(?:[^\w-]|$)/i;

const GOOGLE_NON_SEARCH_UA =
  /Google-Extended|Google-CloudVertexBot|GoogleOther|Storebot-Google|AdsBot-Google|Mediapartners-Google/i;

const GOOGLE_RDNS_HOST = /(^|\.)googlebot\.com$/i;
const GOOGLE_RDNS_HOST_ALT = /(^|\.)google\.com$/i;

/**
 * Unfurl / Open Graph al pegar un enlace. No indexan el catálogo.
 * FacebookBot y meta-externalagent son crawlers de Meta (IA/producto), no preview.
 */
const LINK_PREVIEW_UA_PATTERNS = [
  /facebookexternalhit/i,
  /(?:^|[^\w])Facebot(?:[^\w]|$)/i,
  /WhatsApp/i,
  /Twitterbot/i,
  /Slackbot/i,
  /Discordbot/i,
  /TelegramBot/i,
  /LinkedInBot/i,
  /SkypeUriPreview/i,
  /Pinterest/i,
  /Redditbot/i,
];

const BLOCKED_UA_PATTERNS = [
  // Motores de búsqueda que no son Google
  /bingbot/i,
  /BingPreview/i,
  /DuckDuckBot/i,
  /Slurp/i,
  /Baiduspider/i,
  /Yandex(Bot|Images|Render|Mobile)/i,
  /Sogou/i,
  /Exabot/i,
  /Applebot/i,
  /PetalBot/i,
  /Qwantify/i,
  /SeznamBot/i,
  /MojeekBot/i,
  // SEO / inventarios
  /SemrushBot/i,
  /AhrefsBot/i,
  /DotBot/i,
  /MJ12bot/i,
  /BLEXBot/i,
  /DataForSeoBot/i,
  /Seekport/i,
  /MauiBot/i,
  // IA y scrapers de entrenamiento
  /GPTBot/i,
  /ChatGPT-User/i,
  /OAI-SearchBot/i,
  /ClaudeBot/i,
  /anthropic-ai/i,
  /Claude-Web/i,
  /CCBot/i,
  /Bytespider/i,
  /Amazonbot/i,
  /PerplexityBot/i,
  /YouBot/i,
  /\bcohere-ai\b/i,
  /AI2Bot/i,
  /Diffbot/i,
  /ImagesiftBot/i,
  /meta-externalagent/i,
  /FacebookBot/i,
  // Herramientas HTTP / headless
  /^(curl|Wget|wget)(?:\/|\s|$)/i,
  /libcurl/i,
  /python-requests/i,
  /python-urllib/i,
  /aiohttp/i,
  /httpx\//i,
  /Scrapy/i,
  /Go-http-client/i,
  /libwww-perl/i,
  /okhttp/i,
  /PostmanRuntime/i,
  /insomnia/i,
  /axios\//i,
  /node-fetch/i,
  /node-undici/i,
  /^undici(?:\/|$)/i,
  /^node(?:\/|$)/i,
  /Java\//i,
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Selenium/i,
  /Puppeteer/i,
  /Playwright/i,
];

const GENERIC_BOT_UA = /bot|crawler|spider|scraper|crawling/i;

const BROWSER_UA =
  /Mozilla\/5\.0/i;
const BROWSER_ENGINE_UA =
  /Chrome|Chromium|Firefox|FxiOS|Safari|Edg|OPR|SamsungBrowser|CriOS|Mobile/i;

const VERIFY_TTL_MS = 6 * 60 * 60 * 1000;
const verifyCache = new Map();

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

/**
 * IP del cliente de confianza. Nunca se lee el X-Forwarded-For que manda el cliente:
 * - Vercel (env VERCEL): x-vercel-forwarded-for / x-real-ip los fija el edge de Vercel,
 *   que además sobrescribe X-Forwarded-For (no lo concatena), así que no son falsificables.
 * - Express detrás de Render: req.ip con `trust proxy` = 1 (entrada que añade el proxy
 *   de Render, la de más a la derecha). Las entradas previas de XFF las pone el cliente.
 */
function getClientIp(req, env = process.env) {
  if (!req) return '';
  if (env && env.VERCEL) {
    const vercel = header(req, 'x-vercel-forwarded-for');
    if (vercel) return normalizeIp(vercel.split(',')[0]);
    const realIp = header(req, 'x-real-ip');
    if (realIp) return normalizeIp(realIp);
    const forwarded = header(req, 'x-forwarded-for');
    if (forwarded) return normalizeIp(forwarded.split(',')[0]);
  }
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}

function normalizeIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return '';
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s;
}

/** Lista coma-separada; se lee en cada request (cambiar IPs = env + redeploy, sin código). */
function parseBlockedIpList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function ipv4ToInt(ip) {
  const parts = String(ip || '').split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const x = Number(part);
    if (!Number.isInteger(x) || x < 0 || x > 255) return null;
    n = (n << 8) + x;
  }
  return n >>> 0;
}

function ipv4InCidr(ip, cidr) {
  const slash = cidr.lastIndexOf('/');
  if (slash < 0) return false;
  const bits = Number(cidr.slice(slash + 1));
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(cidr.slice(0, slash));
  if (ipInt == null || baseInt == null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function expandIpv6(ip) {
  const s = String(ip || '').toLowerCase();
  if (!s.includes(':') || s.includes('.')) return null;
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  if (halves.length === 1) {
    if (left.length !== 8) return null;
    return left.map((p) => String(p).padStart(4, '0'));
  }
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return [...left, ...Array(missing).fill('0000'), ...right].map((p) => String(p).padStart(4, '0'));
}

function ipv6ToBigInt(ip) {
  const parts = expandIpv6(ip);
  if (!parts || parts.length !== 8) return null;
  let n = 0n;
  for (const p of parts) {
    if (!/^[0-9a-f]{4}$/.test(p)) return null;
    n = (n << 16n) + BigInt(parseInt(p, 16));
  }
  return n;
}

function ipv6InCidr(ip, cidr) {
  const slash = cidr.lastIndexOf('/');
  if (slash < 0) return false;
  const bits = Number(cidr.slice(slash + 1));
  if (!Number.isInteger(bits) || bits < 0 || bits > 128) return false;
  const ipN = ipv6ToBigInt(ip);
  const baseN = ipv6ToBigInt(cidr.slice(0, slash));
  if (ipN == null || baseN == null) return false;
  if (bits === 0) return true;
  const shift = 128n - BigInt(bits);
  return ipN >> shift === baseN >> shift;
}

function ipMatchesBlockedEntry(ip, entry) {
  const addr = normalizeIp(ip);
  const rule = normalizeIp(entry);
  if (!addr || !rule) return false;
  if (rule.includes('/')) {
    return addr.includes(':') ? ipv6InCidr(addr, rule) : ipv4InCidr(addr, rule);
  }
  if (addr.includes(':') || rule.includes(':')) {
    const a = ipv6ToBigInt(addr);
    const b = ipv6ToBigInt(rule);
    if (a != null && b != null) return a === b;
  }
  return addr === rule;
}

function clientIpsToCheck(req, env = process.env) {
  const ip = getClientIp(req, env);
  return ip ? [ip] : [];
}

/**
 * BLOCKED_IPS: coma-separado, IPs sueltas o CIDR. Vacío = nadie bloqueado.
 * @param {object} req
 * @param {NodeJS.ProcessEnv} [env]
 */
function isBlockedClientIp(req, env = process.env) {
  const list = parseBlockedIpList((env || process.env).BLOCKED_IPS);
  if (!list.length) return false;
  return clientIpsToCheck(req, env || process.env).some((ip) => list.some((entry) => ipMatchesBlockedEntry(ip, entry)));
}

function ipBlockedPayload() {
  return { error: 'Forbidden', code: 'ip_blocked' };
}

function sendIpBlocked(res, { html = false } = {}) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'private, no-store');
  } else if (typeof res.set === 'function') {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cache-Control', 'private, no-store');
  }
  if (typeof res.status === 'function') res.status(403);
  else res.statusCode = 403;

  if (html) {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.send(
      '<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Forbidden</title></head><body><p>Forbidden</p></body></html>',
    );
    return;
  }

  if (typeof res.json === 'function') {
    res.json(ipBlockedPayload());
    return;
  }
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.send(JSON.stringify(ipBlockedPayload()));
}

function isGateDisabled(env = process.env) {
  const raw = String(env.CATALOG_BOT_GATE || '').trim().toLowerCase();
  return raw === 'off' || raw === '0' || raw === 'false';
}

function isGoogleVerifyDisabled(env = process.env) {
  const raw = String(env.CATALOG_GOOGLE_VERIFY || '').trim().toLowerCase();
  return raw === 'off' || raw === '0' || raw === 'false';
}

function configuredInternalSecret(env = process.env) {
  const s = env.CATALOG_INTERNAL_SECRET;
  return s && String(s).trim() ? String(s).trim() : '';
}

function classifyCatalogUserAgent(userAgent) {
  const ua = String(userAgent || '').trim();
  if (!ua) return 'unknown';
  if (ua === INTERNAL_SSR_UA || ua.startsWith('SlotDatabase-CatalogSSR/')) {
    return 'internal-ssr';
  }
  if (GOOGLE_NON_SEARCH_UA.test(ua)) return 'blocked-bot';
  if (GOOGLE_INDEX_UA.test(ua)) return 'google-index';
  for (const re of LINK_PREVIEW_UA_PATTERNS) {
    if (re.test(ua)) return 'link-preview';
  }
  for (const re of BLOCKED_UA_PATTERNS) {
    if (re.test(ua)) return 'blocked-bot';
  }
  if (GENERIC_BOT_UA.test(ua)) return 'blocked-bot';
  if (BROWSER_UA.test(ua) && BROWSER_ENGINE_UA.test(ua)) return 'browser';
  return 'unknown';
}

function isGoogleRdnsHostname(hostname) {
  const host = String(hostname || '').replace(/\.$/, '').toLowerCase();
  return GOOGLE_RDNS_HOST.test(host) || GOOGLE_RDNS_HOST_ALT.test(host);
}

function cacheGet(ip) {
  const hit = verifyCache.get(ip);
  if (!hit) return null;
  if (Date.now() - hit.at > VERIFY_TTL_MS) {
    verifyCache.delete(ip);
    return null;
  }
  return hit;
}

function cacheSet(ip, result) {
  if (verifyCache.size > 4000) {
    const oldest = verifyCache.keys().next().value;
    if (oldest != null) verifyCache.delete(oldest);
  }
  verifyCache.set(ip, { ...result, at: Date.now() });
}

function resetGoogleVerifyCache() {
  verifyCache.clear();
}

/**
 * Verificación oficial de Google: PTR → hostname *.googlebot.com / *.google.com,
 * luego A/AAAA que coincida con la IP.
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
async function verifyGoogleCrawlerIp(ip, deps = {}) {
  const clean = normalizeIp(ip);
  if (!clean) return { ok: false, reason: 'missing-ip' };

  const cached = cacheGet(clean);
  if (cached) return { ok: cached.ok, reason: cached.reason };

  const reverseLookup = deps.reverseLookup || ((addr) => dns.reverse(addr));
  const forwardLookup =
    deps.forwardLookup || ((host) => dns.lookup(host, { all: true, verbatim: true }));

  try {
    const hosts = await reverseLookup(clean);
    const list = Array.isArray(hosts) ? hosts : hosts ? [hosts] : [];
    const googleHost = list.find(isGoogleRdnsHostname);
    if (!googleHost) {
      const result = { ok: false, reason: 'not-google-rdns' };
      cacheSet(clean, result);
      return result;
    }
    const looked = await forwardLookup(googleHost);
    const addresses = Array.isArray(looked)
      ? looked.map((row) => (typeof row === 'string' ? row : row && row.address))
      : looked && looked.address
        ? [looked.address]
        : [];
    const match = addresses.filter(Boolean).some((addr) => normalizeIp(addr) === clean);
    const result = match
      ? { ok: true, reason: 'verified' }
      : { ok: false, reason: 'fwd-mismatch' };
    cacheSet(clean, result);
    return result;
  } catch (err) {
    const code = err && err.code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'EINVAL') {
      const result = { ok: false, reason: 'lookup-empty' };
      cacheSet(clean, result);
      return result;
    }
    return { ok: false, reason: 'lookup-error', error: err };
  }
}

function catalogInternalHeaders(env = process.env) {
  const headers = {
    Accept: 'application/json, */*',
    'User-Agent': INTERNAL_SSR_UA,
  };
  const secret = configuredInternalSecret(env);
  if (secret) headers['X-Catalog-Internal'] = secret;
  return headers;
}

/**
 * @param {{
 *   userAgent?: string,
 *   ip?: string,
 *   internalToken?: string,
 *   env?: NodeJS.ProcessEnv,
 * }} input
 * @param {{
 *   verifyGoogleCrawlerIp?: typeof verifyGoogleCrawlerIp,
 * }} [deps]
 * @returns {Promise<{ allow: boolean, reason: string, class: string }>}
 */
async function decideCatalogAccess(input = {}, deps = {}) {
  const env = input.env || process.env;
  if (isGateDisabled(env)) {
    return { allow: true, reason: 'gate-disabled', class: 'disabled' };
  }

  const userAgent = input.userAgent || '';
  const cls = classifyCatalogUserAgent(userAgent);

  if (cls === 'internal-ssr') {
    const secret = configuredInternalSecret(env);
    if (!secret) {
      return { allow: true, reason: 'internal-ssr', class: cls };
    }
    const token = String(input.internalToken || '');
    if (token && token === secret) {
      return { allow: true, reason: 'internal-ssr-secret', class: cls };
    }
    return { allow: false, reason: 'internal-ssr-secret-mismatch', class: cls };
  }

  if (cls === 'google-index') {
    if (isGoogleVerifyDisabled(env)) {
      return { allow: true, reason: 'google-verify-disabled', class: cls };
    }
    const verify = deps.verifyGoogleCrawlerIp || verifyGoogleCrawlerIp;
    const result = await verify(input.ip, deps);
    if (result.ok) {
      return { allow: true, reason: 'google-verified', class: cls };
    }
    if (result.reason === 'lookup-error') {
      return { allow: true, reason: 'google-verify-error-open', class: cls };
    }
    return { allow: false, reason: `google-unverified:${result.reason}`, class: cls };
  }

  if (cls === 'browser' || cls === 'link-preview') {
    return { allow: true, reason: cls, class: cls };
  }

  return { allow: false, reason: cls === 'blocked-bot' ? 'blocked-bot' : 'unknown-client', class: cls };
}

function deniedPayload() {
  return {
    error: 'Catálogo no disponible para clientes automatizados',
    code: 'catalog_bot_denied',
  };
}

function deniedHtml() {
  const body = deniedPayload();
  return (
    '<!doctype html><html lang="es"><head>' +
    '<meta charset="utf-8"/>' +
    '<meta name="robots" content="noindex, nofollow"/>' +
    '<title>No disponible</title></head><body>' +
    `<p>${body.error}</p>` +
    '</body></html>'
  );
}

function sendCatalogDenied(res, { html = false } = {}) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'private, no-store');
  } else if (typeof res.set === 'function') {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cache-Control', 'private, no-store');
  }
  if (typeof res.status === 'function') res.status(403);
  else res.statusCode = 403;

  if (html) {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.send(deniedHtml());
    return;
  }

  if (typeof res.json === 'function') {
    res.json(deniedPayload());
    return;
  }
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.send(JSON.stringify(deniedPayload()));
}

/**
 * @returns {Promise<boolean>} true si la petición puede continuar
 */
async function gateCatalogRequest(req, res, opts = {}) {
  if (isBlockedClientIp(req, opts.env || process.env)) {
    sendIpBlocked(res, { html: Boolean(opts.html) });
    return false;
  }
  if (req && String(req.method || '').toUpperCase() === 'OPTIONS') return true;
  const decision = await decideCatalogAccess(
    {
      userAgent: header(req, 'user-agent'),
      ip: getClientIp(req),
      internalToken: header(req, 'x-catalog-internal'),
      env: opts.env,
    },
    opts.deps,
  );
  if (decision.allow) return true;
  sendCatalogDenied(res, { html: Boolean(opts.html) });
  return false;
}

function catalogBotGateMiddleware(opts = {}) {
  return async function catalogBotGate(req, res, next) {
    try {
      const ok = await gateCatalogRequest(req, res, opts);
      if (ok) next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  INTERNAL_SSR_UA,
  classifyCatalogUserAgent,
  decideCatalogAccess,
  verifyGoogleCrawlerIp,
  resetGoogleVerifyCache,
  catalogInternalHeaders,
  catalogBotGateMiddleware,
  gateCatalogRequest,
  sendCatalogDenied,
  getClientIp,
  deniedPayload,
  isGoogleRdnsHostname,
  parseBlockedIpList,
  isBlockedClientIp,
  ipMatchesBlockedEntry,
  sendIpBlocked,
  ipBlockedPayload,
};
