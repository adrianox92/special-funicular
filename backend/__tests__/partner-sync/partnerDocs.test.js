'use strict';

const fs = require('fs');
const request = require('supertest');
const app = require('../../server');
const {
  resolveOpenApiSpecPath,
  renderPartnerDocsHtml,
} = require('../../lib/partnerOpenApi');

const FORBIDDEN_PUBLIC_NAMES = [
  'SlotLapTimer',
  'Slot Lap Timer',
  'Slot Lap Counter',
  'ds200-manager',
  'DS-200',
  'DS200',
  'Lap Counter',
];

describe('Slot Database API docs (P2 Swagger UI)', () => {
  test('resolves the canonical OpenAPI YAML on disk', () => {
    const specPath = resolveOpenApiSpecPath();
    expect(fs.existsSync(specPath)).toBe(true);
    expect(specPath).toMatch(/docs[/\\]openapi[/\\]slot-database-api\.v1\.yaml$/);
  });

  test('GET /api/docs returns 200 HTML with Slot Database API intro', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Slot Database API');
    expect(res.text).toContain('X-API-Key');
    expect(res.text).toContain('Perfil');
    expect(res.text).toContain('Profile');
    expect(res.text).toContain('/api/docs/openapi.yaml');
    expect(res.text).toContain('SwaggerUIBundle');
    for (const name of FORBIDDEN_PUBLIC_NAMES) {
      expect(res.text.toLowerCase()).not.toContain(name.toLowerCase());
    }
  });

  test('GET /api/docs/ also returns 200', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Slot Database API');
  });

  test('GET /api/docs/openapi.yaml serves the v1 spec', async () => {
    const onDisk = fs.readFileSync(resolveOpenApiSpecPath(), 'utf8');
    const res = await request(app).get('/api/docs/openapi.yaml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/ya?ml/);
    expect(res.text).toBe(onDisk);
    expect(res.text.startsWith('openapi: 3.')).toBe(true);
    expect(res.text).toContain('title: Slot Database API');
    expect(res.text).toContain('X-API-Key');
    expect(res.text).toContain('https://api.slotdatabase.es');
    expect(res.text).not.toContain('staging');
  });

  test('GET /api/docs/slot-database-api.v1.yaml is the same file', async () => {
    const a = await request(app).get('/api/docs/openapi.yaml');
    const b = await request(app).get('/api/docs/slot-database-api.v1.yaml');
    expect(b.status).toBe(200);
    expect(b.text).toBe(a.text);
  });

  test('Swagger UI bundle is reachable', async () => {
    const res = await request(app).get('/api/docs/swagger-ui-bundle.js');
    expect(res.status).toBe(200);
    expect(res.text || res.body.toString('utf8')).toMatch(/SwaggerUIBundle|swagger-ui/i);
  });

  test('rendered intro HTML does not cite internal client names (D13)', () => {
    const html = renderPartnerDocsHtml();
    for (const name of FORBIDDEN_PUBLIC_NAMES) {
      expect(html.toLowerCase()).not.toContain(name.toLowerCase());
    }
  });

  test('docs origin can fetch the spec (CORS allow any origin)', async () => {
    const res = await request(app)
      .get('/api/docs/openapi.yaml')
      .set('Origin', 'https://slotdatabase.es');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://slotdatabase.es');
  });
});
