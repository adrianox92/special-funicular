/**
 * Middleware: Authorization Bearer CRON_SECRET para jobs de Render Cron.
 */
function cronAuth(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret || String(secret).trim() === '') {
    return res.status(503).json({ error: 'CRON_SECRET no configurado en el servidor' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

module.exports = cronAuth;
