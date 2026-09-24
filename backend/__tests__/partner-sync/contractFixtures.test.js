'use strict';

const fs = require('fs');
const path = require('path');

const FIXTURE_ROOT = path.resolve(__dirname, '../../../tests/fixtures/partner-sync');
const MANIFEST_PATH = path.join(FIXTURE_ROOT, 'manifest.json');
const RULES_PATH = path.join(FIXTURE_ROOT, 'contract-rules.json');

const TIME_FIELDS = ['best_lap_time', 'total_time', 'average_time'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFixtureRelPaths() {
  const out = [];
  function walk(dir, prefix) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else if (name.endsWith('.json') && name !== 'manifest.json' && name !== 'contract-rules.json') {
        out.push(rel);
      }
    }
  }
  walk(FIXTURE_ROOT, '');
  return out.sort();
}

function routeKey(method, rawPath) {
  const paramPath = rawPath
    .replace(
      /^\/api\/sync\/clubs\/[0-9a-fA-F-]{36}\/guest-members\/[0-9a-fA-F-]{36}\/timings$/,
      '/api/sync/clubs/:id/guest-members/:guestId/timings',
    )
    .replace(
      /^\/api\/sync\/clubs\/[0-9a-fA-F-]{36}\/guest-members$/,
      '/api/sync/clubs/:id/guest-members',
    )
    .replace(/^\/api\/sync\/clubs\/[0-9a-fA-F-]{36}\/circuits$/, '/api/sync/clubs/:id/circuits')
    .replace(
      /^\/api\/sync\/competitions\/[0-9a-fA-F-]{36}\/progress$/,
      '/api/sync/competitions/:id/progress',
    )
    .replace(
      /^\/api\/sync\/competitions\/[0-9a-fA-F-]{36}\/participants$/,
      '/api/sync/competitions/:id/participants',
    )
    .replace(
      /^\/api\/sync\/competitions\/[0-9a-fA-F-]{36}\/timings$/,
      '/api/sync/competitions/:id/timings',
    )
    .replace(/^\/api\/sync\/competitions\/[0-9a-fA-F-]{36}$/, '/api/sync/competitions/:id');
  return `${method} ${paramPath}`;
}

function expectedStatuses(expectBlock) {
  const raw = expectBlock.status;
  return Array.isArray(raw) ? raw : [raw];
}

function assertKeys(obj, keys, label) {
  expect(obj && typeof obj === 'object').toBe(true);
  for (const key of keys) {
    expect(obj).toHaveProperty(key);
    if (obj[key] === undefined) {
      throw new Error(`${label} missing key ${key}`);
    }
  }
}

function walkTimeFields(value, timeRe, onFail) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkTimeFields(item, timeRe, onFail));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (TIME_FIELDS.includes(k) && typeof v === 'string' && !timeRe.test(v)) {
      onFail(`${k}=${v}`);
    }
    walkTimeFields(v, timeRe, onFail);
  }
}

describe('partner-sync contract fixtures (P0, no runtime hit)', () => {
  const manifest = readJson(MANIFEST_PATH);
  const rules = readJson(RULES_PATH);
  const timeRe = new RegExp(rules.time_format);
  const uuidRe = new RegExp(rules.uuid_format);
  const dateRe = new RegExp(rules.date_format);

  const listed = [
    ...manifest.clients.slotlaptimer.fixtures,
    ...manifest.clients['ds200-manager'].fixtures,
    ...manifest.shared,
  ];

  test('manifest files exist and cover every JSON fixture', () => {
    for (const rel of listed) {
      expect(fs.existsSync(path.join(FIXTURE_ROOT, rel))).toBe(true);
    }
    const onDisk = listFixtureRelPaths();
    expect(onDisk).toEqual([...listed].sort());
  });

  test('critical paths resolve to existing fixtures', () => {
    for (const row of manifest.critical_paths) {
      const fixture = readJson(path.join(FIXTURE_ROOT, row.fixture));
      expect(fixture.critical).toBe(true);
      expect(fixture.request.method).toBe(row.method);
      expect(routeKey(fixture.request.method, fixture.request.path)).toBe(
        `${row.method} ${row.path}`,
      );
    }
  });

  test.each(listed)('schema + frozen contract: %s', (rel) => {
    const fixture = readJson(path.join(FIXTURE_ROOT, rel));
    expect(fixture.id).toEqual(expect.any(String));
    expect(['slotlaptimer', 'ds200-manager', 'shared']).toContain(fixture.client);
    expect(fixture.request).toEqual(expect.any(Object));
    expect(fixture.expect).toEqual(expect.any(Object));
    expect(rules.allowed_methods).toContain(fixture.request.method);
    expect(fixture.request.path.startsWith(manifest.api_prefix)).toBe(true);

    const statuses = expectedStatuses(fixture.expect);
    statuses.forEach((s) => expect(Number.isInteger(s)).toBe(true));
    expect(Array.isArray(fixture.expect.response_required_keys)).toBe(true);
    expect(fixture.expect.response_required_keys.length).toBeGreaterThan(0);
    assertKeys(
      fixture.expect.example_response,
      fixture.expect.response_required_keys,
      `${rel} example_response`,
    );

    const isAuthFailure = statuses.includes(401);
    if (isAuthFailure) {
      expect(fixture.request.headers['X-API-Key']).toBeUndefined();
      expect(fixture.expect.response_required_keys).toContain('error');
      return;
    }

    expect(fixture.request.headers['X-API-Key']).toEqual(expect.any(String));
    expect(fixture.request.headers['X-API-Key'].length).toBeGreaterThan(8);

    const key = routeKey(fixture.request.method, fixture.request.path);
    const endpoint = rules.endpoints[key];
    expect(endpoint).toBeDefined();

    if (endpoint.query_required) {
      for (const q of endpoint.query_required) {
        expect(fixture.request.query[q]).toBeTruthy();
        if (q.endsWith('_id')) expect(uuidRe.test(fixture.request.query[q])).toBe(true);
      }
    }

    if (endpoint.body_required) {
      expect(fixture.request.body && typeof fixture.request.body === 'object').toBe(true);
      for (const field of endpoint.body_required) {
        expect(fixture.request.body[field]).toBeDefined();
        expect(fixture.request.body[field]).not.toBe('');
      }
    }

    if (endpoint.expected_status) {
      for (const s of statuses) {
        expect(endpoint.expected_status).toContain(s);
      }
    }

    for (const field of endpoint.response_required_keys || []) {
      expect(fixture.expect.response_required_keys).toContain(field);
    }

    if (endpoint.sync_meta_keys && fixture.expect.example_response.sync_meta) {
      assertKeys(
        fixture.expect.example_response.sync_meta,
        endpoint.sync_meta_keys,
        `${rel} sync_meta`,
      );
    }

    if (endpoint.pagination_keys && fixture.expect.example_response.pagination) {
      assertKeys(
        fixture.expect.example_response.pagination,
        endpoint.pagination_keys,
        `${rel} pagination`,
      );
    }

    if (endpoint.vehicle_keys && Array.isArray(fixture.expect.example_response.vehicles)) {
      for (const v of fixture.expect.example_response.vehicles) {
        assertKeys(v, endpoint.vehicle_keys, `${rel} vehicle`);
      }
    }

    if (endpoint.participant_item_required) {
      expect(Array.isArray(fixture.request.body.participants)).toBe(true);
      expect(fixture.request.body.participants.length).toBeGreaterThan(0);
      for (const p of fixture.request.body.participants) {
        for (const field of endpoint.participant_item_required) {
          expect(String(p[field] || '').trim()).not.toBe('');
        }
        if (p.vehicle_id && p.vehicle_model) {
          throw new Error(`${rel}: participant cannot send both vehicle_id and vehicle_model`);
        }
        if (p.vehicle_id) expect(uuidRe.test(p.vehicle_id)).toBe(true);
      }
    }

    if (endpoint.timing_item_required) {
      expect(Array.isArray(fixture.request.body.timings)).toBe(true);
      expect(fixture.request.body.timings.length).toBeGreaterThan(0);
      for (const t of fixture.request.body.timings) {
        for (const field of endpoint.timing_item_required) {
          expect(t[field]).toBeDefined();
        }
        expect(t.heat_number).toBeUndefined();
        expect(Number.isInteger(t.round_number)).toBe(true);
        expect(t.round_number).toBeGreaterThanOrEqual(1);
        expect(uuidRe.test(t.participant_id)).toBe(true);
      }
    }

    walkTimeFields(fixture.request.body, timeRe, (bad) => {
      throw new Error(`${rel} request time field not mm:ss.mmm: ${bad}`);
    });
    walkTimeFields(fixture.expect.example_response, timeRe, (bad) => {
      throw new Error(`${rel} example_response time field not mm:ss.mmm: ${bad}`);
    });

    const dateCandidates = [fixture.request.body?.timing_date, fixture.request.query?.timing_date];
    for (const d of dateCandidates) {
      if (d) expect(dateRe.test(d)).toBe(true);
    }
  });

  test('does not invent D10 members endpoint', () => {
    for (const rel of listed) {
      const fixture = readJson(path.join(FIXTURE_ROOT, rel));
      expect(fixture.request.path).not.toMatch(/\/members$/);
    }
    expect(rules.endpoints['GET /api/sync/clubs/:id/members']).toBeUndefined();
  });

  test('allowlist stays additive-only (no surprise methods)', () => {
    for (const key of Object.keys(rules.endpoints)) {
      const [method, p] = key.split(' ');
      expect(rules.allowed_methods).toContain(method);
      expect(p.startsWith('/api/sync/')).toBe(true);
    }
  });
});
