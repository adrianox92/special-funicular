'use strict';

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getServiceClient } = require('../lib/supabaseClients');
const {
  OauthError,
  registerClient,
  buildAuthorizeRedirect,
  approveAuthorization,
  denyAuthorization,
  exchangeToken,
  listConnections,
  revokeConnection,
  loadClient,
} = require('../lib/mcpOauth');
const {
  getMcpIssuerOrigin,
  getConsentPageOrigin,
  buildProtectedResourceMetadata,
  buildAuthorizationServerMetadata,
} = require('../lib/mcpPublicOrigin');

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

function dbOr503(res) {
  const db = getServiceClient();
  if (!db) {
    res.status(503).json({ error: 'Error de configuración del servidor' });
    return null;
  }
  return db;
}

function sendOauthError(res, err) {
  if (err instanceof OauthError) {
    return res.status(err.statusCode).json({
      error: err.code,
      error_description: err.message,
    });
  }
  console.error('[oauth]', err);
  return res.status(err.statusCode || 500).json({
    error: 'server_error',
    error_description: 'Error interno del servidor',
  });
}

function sendMetadata(res, body) {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(body);
}

function resourceMetadata(req, res) {
  sendMetadata(res, buildProtectedResourceMetadata(getMcpIssuerOrigin(req)));
}

function authorizationServerMetadata(req, res) {
  sendMetadata(res, buildAuthorizationServerMetadata(getMcpIssuerOrigin(req)));
}

router.get('/register', (_req, res) => {
  res.status(405).json({ error: 'method_not_allowed' });
});

router.post('/register', async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    const body = await registerClient(db, req.body || {});
    return res.status(201).json(body);
  } catch (err) {
    return sendOauthError(res, err);
  }
});

router.get('/authorize', async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    const location = await buildAuthorizeRedirect(db, req.query || {}, {
      consentOrigin: getConsentPageOrigin(),
      issuerOrigin: getMcpIssuerOrigin(req),
    });
    return res.redirect(302, location);
  } catch (err) {
    return sendOauthError(res, err);
  }
});

router.get('/client-info', async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    const client = await loadClient(db, req.query.client_id);
    if (!client) return res.status(404).json({ error: 'client_id desconocido' });
    return res.json({
      client_id: client.client_id,
      client_name: client.client_name,
      scope: 'read',
    });
  } catch (err) {
    return sendOauthError(res, err);
  }
});

router.post('/approve', authMiddleware, async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    const body = await approveAuthorization(db, req.user.id, req.body || {}, {
      issuerOrigin: getMcpIssuerOrigin(req),
    });
    return res.json(body);
  } catch (err) {
    return sendOauthError(res, err);
  }
});

router.post('/deny', authMiddleware, async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    const body = await denyAuthorization(db, req.body || {});
    return res.json(body);
  } catch (err) {
    return sendOauthError(res, err);
  }
});

router.post('/token', async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    const body = await exchangeToken(db, req.body || {}, {
      issuerOrigin: getMcpIssuerOrigin(req),
    });
    res.set('Cache-Control', 'no-store');
    return res.json(body);
  } catch (err) {
    return sendOauthError(res, err);
  }
});

router.get('/connections', authMiddleware, async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    return res.json(await listConnections(db, req.user.id));
  } catch (err) {
    return sendOauthError(res, err);
  }
});

router.delete('/connections/:clientId', authMiddleware, async (req, res) => {
  const db = dbOr503(res);
  if (!db) return undefined;
  try {
    return res.json(await revokeConnection(db, req.user.id, req.params.clientId));
  } catch (err) {
    return sendOauthError(res, err);
  }
});

module.exports = router;
module.exports.resourceMetadata = resourceMetadata;
module.exports.authorizationServerMetadata = authorizationServerMetadata;
