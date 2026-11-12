'use strict';

const { normalizePublicSiteOrigin, CANONICAL_PUBLIC_ORIGIN } = require('./sitemapBuilder');

/**
 * Origen que ven Claude y ChatGPT (issuer OAuth y recurso /mcp).
 * En producción es la web (www), nunca el host de Render.
 * En local es el host de la petición (el inspector habla con :5001).
 * @param {import('express').Request} [req]
 * @returns {string}
 */
function getMcpIssuerOrigin(req) {
  const override = process.env.MCP_PUBLIC_ORIGIN;
  if (override && String(override).trim()) {
    return normalizePublicSiteOrigin(override);
  }
  if (process.env.NODE_ENV === 'production') {
    return normalizePublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN || CANONICAL_PUBLIC_ORIGIN);
  }
  const host = req && typeof req.get === 'function' ? req.get('host') : '';
  if (host) {
    const proto = req.protocol || 'http';
    return normalizePublicSiteOrigin(`${proto}://${host}`);
  }
  const port = process.env.PORT || 5001;
  return `http://localhost:${port}`;
}

/**
 * Origen de la pantalla /oauth/consent (la SPA).
 * @returns {string}
 */
function getConsentPageOrigin() {
  if (process.env.NODE_ENV === 'production') {
    return normalizePublicSiteOrigin(process.env.PUBLIC_SITE_ORIGIN || CANONICAL_PUBLIC_ORIGIN);
  }
  const front = process.env.FRONTEND_URL;
  if (front && String(front).trim()) return normalizePublicSiteOrigin(front);
  return 'http://localhost:3000';
}

/**
 * @param {string} origin
 */
function buildProtectedResourceMetadata(origin) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: ['read'],
    bearer_methods_supported: ['header'],
    resource_name: 'Slot Database',
  };
}

/**
 * @param {string} origin
 */
function buildAuthorizationServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['read'],
  };
}

module.exports = {
  getMcpIssuerOrigin,
  getConsentPageOrigin,
  buildProtectedResourceMetadata,
  buildAuthorizationServerMetadata,
};
