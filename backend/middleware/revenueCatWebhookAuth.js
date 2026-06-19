const crypto = require('crypto');

/**
 * Valida la cabecera Authorization de webhooks RevenueCat.
 * Responde 200 en fallo para evitar bucles de reintento de RC.
 */
function revenueCatWebhookAuth(req, res, next) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[revenueCatWebhook] REVENUECAT_WEBHOOK_SECRET no configurado');
    return res.sendStatus(200);
  }

  const rawAuth = String(req.headers.authorization || '');
  const incoming = rawAuth.toLowerCase().startsWith('bearer ')
    ? rawAuth.slice(7).trim()
    : rawAuth.trim();

  const secretBuf = Buffer.from(secret, 'utf8');
  const incomingBuf = Buffer.from(incoming, 'utf8');
  const valid =
    secretBuf.length === incomingBuf.length &&
    crypto.timingSafeEqual(secretBuf, incomingBuf);

  if (!valid) {
    console.warn('[revenueCatWebhook] Authorization inválida');
    return res.sendStatus(200);
  }

  next();
}

module.exports = revenueCatWebhookAuth;
