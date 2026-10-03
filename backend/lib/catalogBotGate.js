/**
 * Acceso al catálogo público de referencias.
 *
 * Objetivo: personas en el navegador y crawlers de indexación de Google
 * (Googlebot + imagen/vídeo/inspección) pueden ver el catálogo. El resto de
 * bots, scrapers y motores/IA no.
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
  /facebookexternalhit/i,
  /facebot/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Discordbot/i,
  /TelegramBot/i,
  /WhatsApp/i,
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

function getClientIp(req) {
  const forwarded = header(req, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return normalizeIp(first);
  }
  const realIp = header(req, 'x-real-ip');
  if (realIp) return normalizeIp(realIp);
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
}

function normalizeIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return '';
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s;
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

  if (cls === 'browser') {
    return { allow: true, reason: 'browser', class: cls };
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
};
