'use strict';

const crypto = require('crypto');
const { hashApiKey } = require('./apiKeyHash');

const ACCESS_TTL_SEC = 60 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const CODE_TTL_MS = 10 * 60 * 1000;
const READ_SCOPE = 'read';
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
const CLIENT_ID_RE = /^mcp_[a-f0-9]{32}$/;

class OauthError extends Error {
  /**
   * @param {string} code
   * @param {string} description
   * @param {number} [statusCode]
   */
  constructor(code, description, statusCode = 400) {
    super(description || code);
    this.name = 'OauthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function pkceChallengeS256(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function verifyPkce(verifier, challenge) {
  if (typeof verifier !== 'string' || !VERIFIER_RE.test(verifier)) return false;
  if (typeof challenge !== 'string' || !challenge) return false;
  return safeEqual(pkceChallengeS256(verifier), challenge);
}

/**
 * @param {unknown} uri
 * @returns {boolean}
 */
function isAllowedRedirectUri(uri) {
  if (typeof uri !== 'string' || uri.length > 2000) return false;
  let url;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === 'https:') return true;
  if (url.protocol === 'http:') {
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  }
  return false;
}

function assertReadScope(scope) {
  if (scope == null || String(scope).trim() === '') return READ_SCOPE;
  const parts = String(scope).trim().split(/\s+/);
  if (parts.length !== 1 || parts[0] !== READ_SCOPE) {
    throw new OauthError('invalid_scope', 'El único scope permitido es read');
  }
  return READ_SCOPE;
}

function assertResource(resource, issuerOrigin) {
  if (resource == null || resource === '') return null;
  const expected = `${issuerOrigin}/mcp`;
  const got = String(resource).replace(/\/+$/, '');
  if (got !== expected) {
    throw new OauthError('invalid_target', 'resource no coincide con el servidor MCP');
  }
  return expected;
}

function dbError(error) {
  const err = new Error(error.message || 'Error de base de datos');
  err.statusCode = 500;
  return err;
}

async function loadClient(db, clientId) {
  if (typeof clientId !== 'string' || !CLIENT_ID_RE.test(clientId)) return null;
  const { data, error } = await db
    .from('mcp_oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw dbError(error);
  return data || null;
}

function assertRegisteredRedirect(client, redirectUri) {
  if (!isAllowedRedirectUri(redirectUri) || !client.redirect_uris.includes(redirectUri)) {
    throw new OauthError('invalid_request', 'redirect_uri no registrada');
  }
}

function assertPkceParams(query) {
  if (query.code_challenge_method !== 'S256') {
    throw new OauthError('invalid_request', 'Se requiere PKCE S256');
  }
  if (typeof query.code_challenge !== 'string' || query.code_challenge.length < 43 || query.code_challenge.length > 128) {
    throw new OauthError('invalid_request', 'code_challenge inválido');
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {object} body
 */
async function registerClient(db, body) {
  const rawUris = body && body.redirect_uris;
  if (!Array.isArray(rawUris) || rawUris.length < 1 || rawUris.length > 10) {
    throw new OauthError('invalid_client_metadata', 'redirect_uris debe tener entre 1 y 10 URLs');
  }
  const redirectUris = [];
  for (const uri of rawUris) {
    if (!isAllowedRedirectUri(uri)) {
      throw new OauthError('invalid_redirect_uri', 'redirect_uri no permitida');
    }
    if (!redirectUris.includes(uri)) redirectUris.push(uri);
  }
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none') {
    throw new OauthError('invalid_client_metadata', 'Solo se admite token_endpoint_auth_method none');
  }
  const name = body.client_name != null ? String(body.client_name).trim().slice(0, 120) : null;
  const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const { data, error } = await db
    .from('mcp_oauth_clients')
    .insert({
      client_id: clientId,
      client_name: name || null,
      redirect_uris: redirectUris,
      created_at: createdAt,
    })
    .select('client_id, client_name, redirect_uris, created_at')
    .single();
  if (error) throw dbError(error);
  return {
    client_id: data.client_id,
    client_id_issued_at: Math.floor(new Date(data.created_at || createdAt).getTime() / 1000),
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: READ_SCOPE,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {Record<string, string>} query
 * @param {{ consentOrigin: string, issuerOrigin: string }} ctx
 * @returns {Promise<string>}
 */
async function buildAuthorizeRedirect(db, query, ctx) {
  if (query.response_type !== 'code') {
    throw new OauthError('unsupported_response_type', 'response_type debe ser code');
  }
  const client = await loadClient(db, query.client_id);
  if (!client) throw new OauthError('invalid_client', 'client_id desconocido', 401);
  assertRegisteredRedirect(client, query.redirect_uri);
  assertPkceParams(query);
  assertReadScope(query.scope);
  assertResource(query.resource, ctx.issuerOrigin);
  const params = new URLSearchParams();
  params.set('response_type', 'code');
  for (const key of ['client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource']) {
    if (query[key]) params.set(key, String(query[key]).slice(0, key === 'state' ? 512 : 2000));
  }
  return `${ctx.consentOrigin}/oauth/consent?${params.toString()}`;
}

function redirectWith(redirectUri, entries) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(entries)) {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} userId
 * @param {object} body
 * @param {{ issuerOrigin: string }} ctx
 */
async function approveAuthorization(db, userId, body, ctx) {
  if (!userId) throw new OauthError('invalid_request', 'Sesión de usuario requerida', 401);
  const client = await loadClient(db, body.client_id);
  if (!client) throw new OauthError('invalid_client', 'client_id desconocido', 401);
  assertRegisteredRedirect(client, body.redirect_uri);
  assertPkceParams(body);
  assertReadScope(body.scope);
  const resource = assertResource(body.resource, ctx.issuerOrigin);
  const plainCode = randomToken();
  const { error } = await db.from('mcp_oauth_codes').insert({
    code_hash: hashApiKey(plainCode),
    client_id: client.client_id,
    user_id: userId,
    redirect_uri: body.redirect_uri,
    code_challenge: body.code_challenge,
    scope: READ_SCOPE,
    resource,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    created_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw dbError(error);
  const state = body.state != null ? String(body.state).slice(0, 512) : '';
  return {
    redirect_url: redirectWith(body.redirect_uri, { code: plainCode, state }),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {object} body
 */
async function denyAuthorization(db, body) {
  const client = await loadClient(db, body.client_id);
  if (!client) throw new OauthError('invalid_client', 'client_id desconocido', 401);
  assertRegisteredRedirect(client, body.redirect_uri);
  const state = body.state != null ? String(body.state).slice(0, 512) : '';
  return {
    redirect_url: redirectWith(body.redirect_uri, { error: 'access_denied', state }),
  };
}

function issueTokenPair(userId, clientId) {
  const access = randomToken();
  const refresh = randomToken();
  const now = Date.now();
  return {
    plain: {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SEC,
      refresh_token: refresh,
      scope: READ_SCOPE,
    },
    row: {
      user_id: userId,
      client_id: clientId,
      access_token_hash: hashApiKey(access),
      refresh_token_hash: hashApiKey(refresh),
      scope: READ_SCOPE,
      access_expires_at: new Date(now + ACCESS_TTL_SEC * 1000).toISOString(),
      refresh_expires_at: new Date(now + REFRESH_TTL_SEC * 1000).toISOString(),
      created_at: new Date(now).toISOString(),
    },
  };
}

async function insertToken(db, row) {
  const { error } = await db.from('mcp_oauth_tokens').insert(row).select('id').single();
  if (error) throw dbError(error);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {object} body
 * @param {{ issuerOrigin: string }} ctx
 */
async function exchangeToken(db, body, ctx) {
  const grant = body && body.grant_type;
  if (grant === 'authorization_code') return exchangeCode(db, body, ctx);
  if (grant === 'refresh_token') return exchangeRefresh(db, body);
  throw new OauthError('unsupported_grant_type', 'grant_type no admitido');
}

async function exchangeCode(db, body, ctx) {
  if (typeof body.code !== 'string' || !body.code) {
    throw new OauthError('invalid_grant', 'Código ausente');
  }
  const { data: row, error } = await db
    .from('mcp_oauth_codes')
    .select('id, code_hash, client_id, user_id, redirect_uri, code_challenge, scope, resource, expires_at, used_at')
    .eq('code_hash', hashApiKey(body.code))
    .maybeSingle();
  if (error) throw dbError(error);
  if (!row || row.used_at) throw new OauthError('invalid_grant', 'Código inválido');
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new OauthError('invalid_grant', 'Código caducado');
  }
  if (body.client_id !== row.client_id) throw new OauthError('invalid_grant', 'client_id no coincide');
  if (body.redirect_uri !== row.redirect_uri) throw new OauthError('invalid_grant', 'redirect_uri no coincide');
  if (row.scope !== READ_SCOPE) throw new OauthError('invalid_scope', 'Scope no permitido');
  assertResource(body.resource != null && body.resource !== '' ? body.resource : row.resource, ctx.issuerOrigin);
  if (!verifyPkce(body.code_verifier, row.code_challenge)) {
    throw new OauthError('invalid_grant', 'PKCE inválido');
  }
  const { data: marked, error: markError } = await db
    .from('mcp_oauth_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle();
  if (markError) throw dbError(markError);
  if (!marked) throw new OauthError('invalid_grant', 'El código ya se usó');
  const issued = issueTokenPair(row.user_id, row.client_id);
  await insertToken(db, issued.row);
  return issued.plain;
}

async function exchangeRefresh(db, body) {
  if (typeof body.refresh_token !== 'string' || !body.refresh_token) {
    throw new OauthError('invalid_grant', 'refresh_token ausente');
  }
  const { data: row, error } = await db
    .from('mcp_oauth_tokens')
    .select('id, user_id, client_id, scope, refresh_expires_at, revoked_at')
    .eq('refresh_token_hash', hashApiKey(body.refresh_token))
    .maybeSingle();
  if (error) throw dbError(error);
  if (!row || row.revoked_at) throw new OauthError('invalid_grant', 'refresh_token inválido');
  if (body.client_id && body.client_id !== row.client_id) {
    throw new OauthError('invalid_grant', 'client_id no coincide');
  }
  if (row.scope !== READ_SCOPE) throw new OauthError('invalid_scope', 'Scope no permitido');
  if (new Date(row.refresh_expires_at).getTime() <= Date.now()) {
    throw new OauthError('invalid_grant', 'refresh_token caducado');
  }
  const { data: revoked, error: revokeError } = await db
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (revokeError) throw dbError(revokeError);
  if (!revoked) throw new OauthError('invalid_grant', 'refresh_token ya usado');
  const issued = issueTokenPair(row.user_id, row.client_id);
  await insertToken(db, issued.row);
  return issued.plain;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} rawToken
 * @returns {Promise<{ userId: string, tokenId: string }>}
 */
async function resolveAccessToken(db, rawToken) {
  if (typeof rawToken !== 'string' || !rawToken.trim()) {
    throw new OauthError('invalid_token', 'Token ausente', 401);
  }
  let hash;
  try {
    hash = hashApiKey(rawToken);
  } catch {
    throw new OauthError('invalid_token', 'Token inválido', 401);
  }
  const { data: row, error } = await db
    .from('mcp_oauth_tokens')
    .select('id, user_id, client_id, scope, access_expires_at, revoked_at')
    .eq('access_token_hash', hash)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!row || row.revoked_at) {
    throw new OauthError('invalid_token', 'Token revocado o inválido', 401);
  }
  if (row.scope !== READ_SCOPE) {
    throw new OauthError('invalid_token', 'Scope no permitido', 401);
  }
  if (new Date(row.access_expires_at).getTime() <= Date.now()) {
    throw new OauthError('invalid_token', 'Token caducado', 401);
  }
  const touch = db
    .from('mcp_oauth_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id);
  if (touch && typeof touch.then === 'function') {
    touch.then(() => {}, () => {});
  }
  return { userId: row.user_id, tokenId: row.id, clientId: row.client_id || null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} userId
 */
async function listConnections(db, userId) {
  const { data: tokens, error } = await db
    .from('mcp_oauth_tokens')
    .select('client_id, created_at, last_used_at, refresh_expires_at')
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (error) throw dbError(error);
  const now = Date.now();
  const byClient = new Map();
  for (const row of tokens || []) {
    if (!row.refresh_expires_at || new Date(row.refresh_expires_at).getTime() <= now) continue;
    const prev = byClient.get(row.client_id);
    if (!prev) {
      byClient.set(row.client_id, {
        client_id: row.client_id,
        connected_at: row.created_at,
        last_used_at: row.last_used_at || null,
      });
      continue;
    }
    if (row.created_at && (!prev.connected_at || row.created_at < prev.connected_at)) {
      prev.connected_at = row.created_at;
    }
    if (row.last_used_at && (!prev.last_used_at || row.last_used_at > prev.last_used_at)) {
      prev.last_used_at = row.last_used_at;
    }
  }
  const ids = [...byClient.keys()];
  let names = new Map();
  if (ids.length > 0) {
    const { data: clients, error: clientError } = await db
      .from('mcp_oauth_clients')
      .select('client_id, client_name')
      .in('client_id', ids);
    if (clientError) throw dbError(clientError);
    names = new Map((clients || []).map((c) => [c.client_id, c.client_name]));
  }
  const connections = [...byClient.values()].map((row) => ({
    ...row,
    client_name: names.get(row.client_id) || null,
  }));
  return { connections };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} userId
 * @param {string} clientId
 */
async function revokeConnection(db, userId, clientId) {
  if (!CLIENT_ID_RE.test(String(clientId || ''))) {
    throw new OauthError('invalid_request', 'client_id inválido');
  }
  const { data, error } = await db
    .from('mcp_oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .is('revoked_at', null)
    .select('id');
  if (error) throw dbError(error);
  const revoked = Array.isArray(data) ? data.length : 0;
  return { revoked };
}

module.exports = {
  OauthError,
  ACCESS_TTL_SEC,
  READ_SCOPE,
  CLIENT_ID_RE,
  pkceChallengeS256,
  verifyPkce,
  isAllowedRedirectUri,
  registerClient,
  buildAuthorizeRedirect,
  approveAuthorization,
  denyAuthorization,
  exchangeToken,
  resolveAccessToken,
  listConnections,
  revokeConnection,
  loadClient,
};
