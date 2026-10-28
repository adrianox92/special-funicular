'use strict';

const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { OauthError, resolveAccessToken } = require('../lib/mcpOauth');
const { getMcpIssuerOrigin } = require('../lib/mcpPublicOrigin');

const router = express.Router();

function wwwAuthenticate(req) {
  const origin = getMcpIssuerOrigin(req);
  return `Bearer realm="slot-database", resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
}

router.use(async (req, res, next) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({ error: 'Solo se admite POST' });
  }
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    res.set('WWW-Authenticate', wwwAuthenticate(req));
    return res.status(401).json({ error: 'No se proporcionó token de acceso' });
  }
  const token = header.slice(7).trim();
  const db = getServiceClient();
  if (!db) return res.status(503).json({ error: 'Error de configuración del servidor' });
  try {
    const session = await resolveAccessToken(db, token);
    req.mcpUser = { id: session.userId };
    return next();
  } catch (err) {
    res.set('WWW-Authenticate', wwwAuthenticate(req));
    const status = err instanceof OauthError ? err.statusCode : (err.statusCode || 401);
    return res.status(status).json({ error: err.message || 'Token inválido' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { handleMcpHttp } = require('../mcp/createServer');
    await handleMcpHttp(req, res, req.mcpUser.id);
  } catch (err) {
    console.error('[mcp]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

module.exports = router;
