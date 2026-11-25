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
      'action_items',
      'best_laps',
      'garage_summary',
      'get_catalog_item',
      'get_catalog_offers',
      'get_circuit',
      'get_competition',
      'get_vehicle',
      'list_capabilities',
      'list_circuits',
      'list_competitions',
      'list_inventory',
      'list_maintenance',
      'list_timings',
      'list_vehicles',
      'search_collection',
      'training_goals',
    ]);
    for (const tool of res.body.result.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  test('list_capabilities nombra cada herramienta y no promete lo que el conector no hace', async () => {
    seedToken({ plain: 'live-access', revoked: false });
    const listed = await request(app)
      .post('/mcp')
      .set('Authorization', 'Bearer live-access')
      .set('Accept', ACCEPT)
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const called = await request(app)
      .post('/mcp')
      .set('Authorization', 'Bearer live-access')
      .set('Accept', ACCEPT)
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'list_capabilities', arguments: {} },
      });
    expect(called.status).toBe(200);
    const menu = JSON.parse(called.body.result.content[0].text);
    const mentioned = menu.groups.flatMap((group) => group.options.map((option) => option.tool)).sort();
    const names = (listed.body.result?.tools || []).map((tool) => tool.name).sort();
    expect(mentioned).toEqual(names);
    const denied = menu.cannot.join(' ');
    expect(denied).toMatch(/No lista ni busca el catálogo/);
    expect(denied).toMatch(/No crea, no edita y no borra/);
    expect(denied).toMatch(/No consulta ligas ni clubes/);
    expect(mentioned).not.toEqual(expect.arrayContaining(['list_leagues', 'list_clubs']));
  });

  test('un administrador ve las herramientas de catálogo y el resto no', async () => {
    const previous = process.env.LICENSE_ADMIN_EMAILS;
    process.env.LICENSE_ADMIN_EMAILS = 'admin@slot.test';
    global.__mcpMemory.auth = {
      admin: {
        getUserById: async () => ({ data: { user: { email: 'admin@slot.test' } }, error: null }),
      },
    };
    seedToken({ plain: 'live-access', revoked: false });
    try {
      const res = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer live-access')
        .set('Accept', ACCEPT)
        .set('Content-Type', 'application/json')
        .send({ jsonrpc: '2.0', id: 4, method: 'tools/list' });
      expect(res.status).toBe(200);
      const tools = res.body.result?.tools || [];
      const names = tools.map((tool) => tool.name);
      expect(names).toEqual(expect.arrayContaining([
        'list_incomplete_catalog_items',
        'update_catalog_item',
      ]));
      expect(tools.find((tool) => tool.name === 'list_incomplete_catalog_items').annotations.readOnlyHint).toBe(true);
      expect(tools.find((tool) => tool.name === 'update_catalog_item').annotations.readOnlyHint).toBe(false);
      const called = await request(app)
        .post('/mcp')
        .set('Authorization', 'Bearer live-access')
        .set('Accept', ACCEPT)
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: { name: 'list_capabilities', arguments: {} },
        });
      const menu = JSON.parse(called.body.result.content[0].text);
      const mentioned = menu.groups.flatMap((group) => group.options.map((option) => option.tool));
      expect(mentioned).toEqual(expect.arrayContaining([
        'list_incomplete_catalog_items',
        'update_catalog_item',
      ]));
      expect(menu.cannot.join(' ')).not.toMatch(/No lista ni busca el catálogo/);
    } finally {
      delete global.__mcpMemory.auth;
      if (previous == null) delete process.env.LICENSE_ADMIN_EMAILS;
      else process.env.LICENSE_ADMIN_EMAILS = previous;
    }
  });

  test('prompts/list anuncia las tres guías', async () => {
    seedToken({ plain: 'live-access', revoked: false });
    const res = await request(app)
      .post('/mcp')
      .set('Authorization', 'Bearer live-access')
      .set('Accept', ACCEPT)
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 3, method: 'prompts/list' });
    expect(res.status).toBe(200);
    const names = (res.body.result?.prompts || []).map((prompt) => prompt.name).sort();
    expect(names).toEqual(['available_options', 'garage_briefing', 'next_race_briefing']);
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
