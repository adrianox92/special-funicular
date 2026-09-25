const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { hashApiKey } = require('../lib/apiKeyHash');

// Nota de memoria: el store in-memory de express-rate-limit expira automáticamente las
// entradas al final de cada ventana (windowMs). Mantener ventanas ≤ 15 min para que el GC
// las libere en tiempo razonable. Para producción con alto tráfico de IPs únicas (bots,
// crawlers) valorar rate-limit-redis para que el store no crezca en el proceso Node.

/** Inscripciones públicas: límite por IP */
const publicSignupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
});

/**
 * Catálogo público (GET facets/items/detail): lecturas frecuentes; no comparte cupo con signup/pilot.
 * Ventana de 1 min para que el store se limpie rápido y no acumule IPs de bots.
 */
const publicCatalogReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
});

/**
 * Auth para app de sincronización: límite suave (configurable al arranque).
 * AUTH_RATE_LIMIT_MAX=0 desactiva el límite.
 */
function getAuthMax() {
  const raw = process.env.AUTH_RATE_LIMIT_MAX;
  if (raw === '0') return 0;
  if (raw == null || raw === '') return 120;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : 120;
}

const authMax = getAuthMax();

const authSoftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: authMax === 0 ? 10_000_000 : authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de autenticación. Inténtalo más tarde.' },
  skip: () => authMax === 0,
});

/** Formulario de contacto público: límite estricto por IP */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados envíos desde esta dirección. Inténtalo más tarde.' },
});

/** Preguntas al asistente de ayuda: por usuario autenticado; IP con ipKeyGenerator (IPv6) */
const helpAskLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has superado el límite de preguntas al asistente. Inténtalo más tarde.' },
  keyGenerator: (req) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKeyGenerator(req.ip);
  },
});

/** Sugerencias de catálogo y valoraciones: por usuario autenticado */
const catalogContributionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes al catálogo. Inténtalo más tarde.' },
  keyGenerator: (req) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKeyGenerator(req.ip);
  },
});

/** Feed iCal de clubes (suscripción pública con token). */
const publicClubIcsFeedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
});

/** Modo árbitro por enlace compartible (token en URL). */
const publicRefereeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
});

/**
 * Partner Sync (`/api/sync/*`): per API key, high enough for a live race.
 * SYNC_RATE_LIMIT_MAX=0 disables. Default 600 req / 60s.
 */
function getSyncRateLimitMax() {
  const raw = process.env.SYNC_RATE_LIMIT_MAX;
  if (raw === '0') return 0;
  if (raw == null || raw === '') return 600;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : 600;
}

function syncRateLimitKey(req) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
    try {
      return `sync:${hashApiKey(apiKey)}`;
    } catch {
      // fall through to IP
    }
  }
  return `sync-ip:${ipKeyGenerator(req.ip)}`;
}

function createSyncApiKeyLimiter(overrides = {}) {
  const windowMs = overrides.windowMs || 60 * 1000;
  return rateLimit({
    windowMs,
    max: (req, res) => {
      const configured = overrides.max != null ? overrides.max : getSyncRateLimitMax();
      if (configured === 0) return 10_000_000;
      return configured;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
    keyGenerator: (req) => syncRateLimitKey(req),
    skip: () => (overrides.max != null ? overrides.max === 0 : getSyncRateLimitMax() === 0),
    handler(req, res, _next, options) {
      const retryAfterSec = Math.max(1, Math.ceil((options.windowMs || windowMs) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
    },
  });
}

const syncApiKeyLimiter = createSyncApiKeyLimiter();

module.exports = {
  publicSignupLimiter,
  publicCatalogReadLimiter,
  publicClubIcsFeedLimiter,
  publicRefereeLimiter,
  authSoftLimiter,
  contactLimiter,
  helpAskLimiter,
  catalogContributionsLimiter,
  syncApiKeyLimiter,
  createSyncApiKeyLimiter,
  getSyncRateLimitMax,
  syncRateLimitKey,
};
