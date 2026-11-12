'use strict';

const { createMemoryDb } = require('../helpers/mcpMemoryDb');
const { hashApiKey } = require('../../lib/apiKeyHash');
const {
  OauthError,
  pkceChallengeS256,
  verifyPkce,
  isAllowedRedirectUri,
  registerClient,
  buildAuthorizeRedirect,
  approveAuthorization,
  exchangeToken,
  resolveAccessToken,
  revokeConnection,
} = require('../../lib/mcpOauth');
const { getMcpIssuerOrigin, buildProtectedResourceMetadata } = require('../../lib/mcpPublicOrigin');

const VERIFIER = 'a'.repeat(50);
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

function futureIso(ms) {
  return new Date(Date.now() + ms).toISOString();
}

describe('mcpOauth', () => {
  let db;

  beforeEach(() => {
    db = createMemoryDb();
  });

  test('PKCE S256 acepta el verifier y rechaza otro', () => {
    const challenge = pkceChallengeS256(VERIFIER);
    expect(verifyPkce(VERIFIER, challenge)).toBe(true);
    expect(verifyPkce(`${VERIFIER}x`, challenge)).toBe(false);
    expect(verifyPkce('short', challenge)).toBe(false);
  });

  test('redirect http solo en loopback', () => {
    expect(isAllowedRedirectUri('https://chatgpt.com/connector')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:3000/cb')).toBe(true);
    expect(isAllowedRedirectUri('http://evil.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false);
  });

  test('en producción el issuer es www y no el host de la petición', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevOrigin = process.env.PUBLIC_SITE_ORIGIN;
    const prevOverride = process.env.MCP_PUBLIC_ORIGIN;
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_SITE_ORIGIN = 'https://slotdatabase.es';
    delete process.env.MCP_PUBLIC_ORIGIN;
    const req = { protocol: 'https', get: () => 'special-funicular-3q60.onrender.com' };
    expect(getMcpIssuerOrigin(req)).toBe('https://www.slotdatabase.es');
    expect(buildProtectedResourceMetadata(getMcpIssuerOrigin(req)).resource).toBe(
      'https://www.slotdatabase.es/mcp',
    );
    process.env.NODE_ENV = prevEnv;
    process.env.PUBLIC_SITE_ORIGIN = prevOrigin;
    if (prevOverride == null) delete process.env.MCP_PUBLIC_ORIGIN;
    else process.env.MCP_PUBLIC_ORIGIN = prevOverride;
  });

  test('el código se canjea una vez y un PKCE inválido no emite token', async () => {
    const registered = await registerClient(db, {
      client_name: 'Claude',
      redirect_uris: [REDIRECT],
    });
    const challenge = pkceChallengeS256(VERIFIER);
    const approved = await approveAuthorization(db, 'user-1', {
      client_id: registered.client_id,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'xyz',
    }, { issuerOrigin: 'http://localhost:5001' });

    const bad = exchangeToken(db, {
      grant_type: 'authorization_code',
      code: new URL(approved.redirect_url).searchParams.get('code'),
      redirect_uri: REDIRECT,
      client_id: registered.client_id,
      code_verifier: 'b'.repeat(50),
    }, { issuerOrigin: 'http://localhost:5001' });
    await expect(bad).rejects.toMatchObject({ code: 'invalid_grant', message: 'PKCE inválido' });

    const code = new URL(approved.redirect_url).searchParams.get('code');
    const tokens = await exchangeToken(db, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: registered.client_id,
      code_verifier: VERIFIER,
    }, { issuerOrigin: 'http://localhost:5001' });
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.scope).toBe('read');

    await expect(exchangeToken(db, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: registered.client_id,
      code_verifier: VERIFIER,
    }, { issuerOrigin: 'http://localhost:5001' })).rejects.toBeInstanceOf(OauthError);
  });

  test('un token revocado no resuelve usuario', async () => {
    const plain = 'access-token-plain';
    db.tables.mcp_oauth_tokens.push({
      id: 'tok-1',
      user_id: 'user-1',
      client_id: 'mcp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      access_token_hash: hashApiKey(plain),
      refresh_token_hash: hashApiKey('refresh-plain'),
      scope: 'read',
      access_expires_at: futureIso(60_000),
      refresh_expires_at: futureIso(60_000),
      revoked_at: new Date().toISOString(),
    });
    await expect(resolveAccessToken(db, plain)).rejects.toMatchObject({
      statusCode: 401,
      code: 'invalid_token',
    });
  });

  test('revocar deja el access token inservible', async () => {
    const registered = await registerClient(db, {
      client_name: 'ChatGPT',
      redirect_uris: [REDIRECT],
    });
    const challenge = pkceChallengeS256(VERIFIER);
    await buildAuthorizeRedirect(db, {
      response_type: 'code',
      client_id: registered.client_id,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'read',
    }, { consentOrigin: 'http://localhost:3000', issuerOrigin: 'http://localhost:5001' });
    const approved = await approveAuthorization(db, 'user-9', {
      client_id: registered.client_id,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }, { issuerOrigin: 'http://localhost:5001' });
    const code = new URL(approved.redirect_url).searchParams.get('code');
    const tokens = await exchangeToken(db, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: registered.client_id,
      code_verifier: VERIFIER,
    }, { issuerOrigin: 'http://localhost:5001' });
    const session = await resolveAccessToken(db, tokens.access_token);
    expect(session.userId).toBe('user-9');
    await revokeConnection(db, 'user-9', registered.client_id);
    await expect(resolveAccessToken(db, tokens.access_token)).rejects.toMatchObject({ statusCode: 401 });
  });
});
