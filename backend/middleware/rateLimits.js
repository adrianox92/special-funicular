const rateLimit = require('express-rate-limit');

/** Inscripciones públicas: límite por IP */
const publicSignupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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

module.exports = { publicSignupLimiter, authSoftLimiter };
