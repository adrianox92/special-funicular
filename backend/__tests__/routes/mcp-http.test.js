'use strict';

jest.mock('../../lib/supabaseClients', () => {
  const { createMemoryDb: createDb } = require('../helpers/mcpMemoryDb');
  if (!global.__mcpMemory) global.__mcpMemory = createDb();
  const db = () => global.__mcpMemory;
  return {
    getAnonClient: jest.fn(() => db()),
    getServiceClient: jest.fn(() => db()),
    getServiceOrAnonClient: jest.fn(() => db()),
    createUserScopedClient: jest.fn(() => db()),
    createServerClient: jest.fn(() => db()),
  };
});

const request = require('supertest');
const app = require('../../server');
const { hashApiKey } = require('../../lib/apiKeyHash');

const ACCEPT = 'application/json, text/event-stream';

function seedToken({ plain, revoked }) {
  global.__mcpMemory.tables.mcp_oauth_tokens.push({
    id: `tok-${plain}`,
    user_id: 'user-1',
    client_id: 'mcp_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    access_token_hash: hashApiKey(plain),
    refresh_token_hash: hashApiKey(`refresh-${plain}`),
    scope: 'read',
    access_expires_at: new Date(Date.now() + 60_000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: revoked ? new Date().toISOString() : null,
  });
}

describe('MCP HTTP', () => {
  beforeEach(() => {
    global.__mcpMemory.tables.mcp_oauth_clients.length = 0;
    global.__mcpMemory.tables.mcp_oauth_codes.length = 0;
    global.__mcpMemory.tables.mcp_oauth_tokens.length = 0;
  });

  test('sin token responde 401 con el metadato del recurso', async () => {
    const res = await request(app).post('/mcp').send({});
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('resource_metadata=');
    expect(res.headers['www-authenticate']).toContain('/.well-known/oauth-protected-resource');
  });

  test('un token revocado responde 401', async () => {
    seedToken({ plain: 'revoked-access', revoked: true });
    const res = await request(app)
      .post('/mcp')
      .set('Authorization', 'Bearer revoked-access')
      .set('Accept', ACCEPT)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/revocado/i);
  });

  test('tools/list solo anuncia lectura', async () => {
    seedToken({ plain: 'live-access', revoked: false });
    const res = await request(app)
      .post('/mcp')
      .set('Authorization', 'Bearer live-access')
      .set('Accept', ACCEPT)
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(200);
    const names = (res.body.result?.tools || []).map((tool) => tool.name).sort();
    expect(names).toEqual([
      'get_catalog_item',
      'get_competition',
      'get_vehicle',
      'list_circuits',
      'list_competitions',
      'list_timings',
      'list_vehicles',
      'search_collection',
    ]);
    for (const tool of res.body.result.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });
});

describe('metadatos OAuth', () => {
  test('el recurso protegido apunta a /mcp del host de la petición en test', async () => {
    const res = await request(app).get('/.well-known/oauth-protected-resource');
    expect(res.status).toBe(200);
    expect(res.body.scopes_supported).toEqual(['read']);
    expect(res.body.resource).toMatch(/\/mcp$/);
    expect(res.body.authorization_servers[0]).not.toMatch(/onrender\.com/);
  });

  test('el router de la SPA también está montado en /api/oauth', async () => {
    const res = await request(app).post('/api/oauth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_client_metadata');
  });
});
