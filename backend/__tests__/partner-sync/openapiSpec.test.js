'use strict';

const fs = require('fs');
const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { resolveOpenApiSpecPath } = require('../../lib/partnerOpenApi');

const SPEC_PATH = path.resolve(__dirname, '../../../docs/openapi/slot-database-api.v1.yaml');
const SYNC_ROUTE_FILES = [
  path.resolve(__dirname, '../../routes/sync.js'),
  path.resolve(__dirname, '../../routes/syncCompetitions.js'),
];
const FORBIDDEN_PUBLIC_NAMES = [
  'SlotLapTimer',
  'Slot Lap Timer',
  'Slot Lap Counter',
  'ds200-manager',
  'DS-200',
  'DS200',
  'Lap Counter',
];
const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
/** JWT Profile probe — not part of the public API-key Partner Sync surface. */
const INTERNAL_UNDOCUMENTED = new Set(['POST /api/sync/test-notification']);
const ROUTER_OP_RE = /router\.(get|post|put|patch|delete)\(\s*['`]([^'`]+)['`]/g;

function opKey(method, openApiPath) {
  return `${method.toUpperCase()} ${openApiPath}`;
}

function listDocumentedOps(api) {
  const ops = [];
  for (const [openApiPath, item] of Object.entries(api.paths || {})) {
    if (!item || typeof item !== 'object') continue;
    for (const method of Object.keys(item)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      ops.push({ method: method.toUpperCase(), openApiPath });
    }
  }
  return ops;
}

function toOpenApiPath(expressPath) {
  return `/api/sync${expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
}

function listRegisteredSyncOps() {
  const ops = [];
  for (const filePath of SYNC_ROUTE_FILES) {
    const src = fs.readFileSync(filePath, 'utf8');
    ROUTER_OP_RE.lastIndex = 0;
    let match;
    while ((match = ROUTER_OP_RE.exec(src))) {
      const method = match[1].toUpperCase();
      const expressPath = match[2];
      ops.push({
        method,
        expressPath,
        openApiPath: toOpenApiPath(expressPath),
        file: path.basename(filePath),
      });
    }
  }
  return ops;
}

describe('Slot Database API OpenAPI (P1 + P4)', () => {
  const spec = fs.readFileSync(SPEC_PATH, 'utf8');

  test('canonical resolver matches the repo YAML served at /api/docs', () => {
    const resolved = resolveOpenApiSpecPath();
    expect(fs.existsSync(resolved)).toBe(true);
    expect(fs.realpathSync(resolved)).toBe(fs.realpathSync(SPEC_PATH));
    expect(resolved).toMatch(/docs[/\\]openapi[/\\]slot-database-api\.v1\.yaml$/);
  });

  test('file is OpenAPI 3 and branded Slot Database API', () => {
    expect(spec.startsWith('openapi: 3.')).toBe(true);
    expect(spec).toMatch(/title:\s*Slot Database API/);
    expect(spec).toContain('X-API-Key');
    expect(spec).toContain('https://api.slotdatabase.es');
    expect(spec).toContain('http://localhost:5001');
    expect(spec).not.toMatch(/url:\s*https?:\/\/\S*staging\S*/i);
  });

  test('documents the as-built sync surface including D10 members', () => {
    const requiredPaths = [
      '/api/sync/vehicles',
      '/api/sync/circuits',
      '/api/sync/timings',
      '/api/sync/clubs/admin',
      '/api/sync/clubs/{id}/circuits',
      '/api/sync/clubs/{id}/members',
      '/api/sync/clubs/{id}/guest-members',
      '/api/sync/clubs/{id}/guest-members/{guestId}/timings',
      '/api/sync/competitions',
      '/api/sync/competitions/{id}',
      '/api/sync/competitions/{id}/progress',
      '/api/sync/competitions/{id}/participants',
      '/api/sync/competitions/{id}/timings',
    ];
    for (const p of requiredPaths) {
      expect(spec).toContain(p);
    }
    expect(spec).toContain('vehicle_id');
    expect(spec).toContain('best_lap_time');
    expect(spec).toContain('round_number');
    expect(spec).toContain('time_seconds');
    expect(spec).toContain('time_text');
  });

  test('does not cite internal client names in public spec (D13)', () => {
    for (const name of FORBIDDEN_PUBLIC_NAMES) {
      expect(spec.toLowerCase()).not.toContain(name.toLowerCase());
    }
  });

  test('parses as a valid OpenAPI 3 document (swagger-parser required)', async () => {
    const api = await SwaggerParser.validate(SPEC_PATH);
    expect(api.openapi.startsWith('3.')).toBe(true);
    expect(api.info.title).toBe('Slot Database API');
    expect(api.paths['/api/sync/clubs/{id}/members'].get).toBeDefined();
    expect(api.components.securitySchemes.ApiKeyAuth.name).toBe('X-API-Key');
    const serverUrls = (api.servers || []).map((s) => s.url);
    expect(serverUrls).toEqual(
      expect.arrayContaining(['https://api.slotdatabase.es', 'http://localhost:5001']),
    );
    expect(serverUrls.every((url) => !/staging/i.test(url))).toBe(true);
  });

  test('documented /api/sync operations match registered sync routes', async () => {
    const api = await SwaggerParser.validate(SPEC_PATH);
    const documented = listDocumentedOps(api);
    const registered = listRegisteredSyncOps();

    expect(documented.length).toBeGreaterThan(0);
    expect(registered.length).toBeGreaterThan(0);

    const documentedKeys = new Set(documented.map((op) => opKey(op.method, op.openApiPath)));
    const registeredKeys = new Set(registered.map((op) => opKey(op.method, op.openApiPath)));
    const publicRegisteredKeys = new Set(
      [...registeredKeys].filter((key) => !INTERNAL_UNDOCUMENTED.has(key)),
    );

    const missingInRouters = [...documentedKeys].filter((key) => !registeredKeys.has(key)).sort();
    const missingInSpec = [...publicRegisteredKeys].filter((key) => !documentedKeys.has(key)).sort();

    expect(missingInRouters).toEqual([]);
    expect(missingInSpec).toEqual([]);

    for (const openApiPath of documented.map((op) => op.openApiPath)) {
      expect(openApiPath.startsWith('/api/sync/')).toBe(true);
    }
  });
});
