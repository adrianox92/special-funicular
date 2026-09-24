'use strict';

const fs = require('fs');
const path = require('path');

const SPEC_PATH = path.resolve(__dirname, '../../../docs/openapi/slot-database-api.v1.yaml');
const FORBIDDEN_PUBLIC_NAMES = [
  'SlotLapTimer',
  'Slot Lap Timer',
  'Slot Lap Counter',
  'ds200-manager',
  'DS-200',
  'DS200',
  'Lap Counter',
];

describe('Slot Database API OpenAPI (P1)', () => {
  const spec = fs.readFileSync(SPEC_PATH, 'utf8');

  test('file is OpenAPI 3 and branded Slot Database API', () => {
    expect(spec.startsWith('openapi: 3.')).toBe(true);
    expect(spec).toMatch(/title:\s*Slot Database API/);
    expect(spec).toContain('X-API-Key');
    expect(spec).toContain('https://api.slotdatabase.es');
    expect(spec).toContain('http://localhost:5001');
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

  test('parses as a valid OpenAPI 3 document when swagger-parser is available', async () => {
    let SwaggerParser;
    try {
      SwaggerParser = require('@apidevtools/swagger-parser');
    } catch {
      return;
    }
    const api = await SwaggerParser.validate(SPEC_PATH);
    expect(api.openapi.startsWith('3.')).toBe(true);
    expect(api.info.title).toBe('Slot Database API');
    expect(api.paths['/api/sync/clubs/{id}/members'].get).toBeDefined();
    expect(api.components.securitySchemes.ApiKeyAuth.name).toBe('X-API-Key');
  });
});
