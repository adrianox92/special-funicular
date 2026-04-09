const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

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
 * Misma instancia en server.js solo para /api/public/catalog.
 */
const publicCatalogReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
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

module.exports = {
  publicSignupLimiter,
  publicCatalogReadLimiter,
  authSoftLimiter,
  contactLimiter,
  helpAskLimiter,
  catalogContributionsLimiter,
};
