/**
 * Autenticación para endpoints admin vía cabecera X-Admin-Key.
 */
function adminSecretAuth(req, res, next) {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret) {
    console.error('adminSecretAuth: ADMIN_SECRET_KEY no configurada');
    return res.status(503).json({ error: 'Servicio no configurado' });
  }

  const provided = req.headers['x-admin-key'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  return next();
}

module.exports = adminSecretAuth;
