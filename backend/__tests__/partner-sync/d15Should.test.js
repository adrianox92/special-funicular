'use strict';

const fs = require('fs');
const path = require('path');
const { parseIdempotencyKey, ownerScopeFromReq } = require('../../lib/syncIdempotency');
const { clubScopeClubId, isPersonalGaragePath } = require('../../lib/syncKeyScope');
const { getSyncRateLimitMax } = require('../../middleware/rateLimits');

const SPEC_PATH = path.resolve(__dirname, '../../../docs/openapi/slot-database-api.v1.yaml');
const RULES_PATH = path.resolve(__dirname, '../../../tests/fixtures/partner-sync/contract-rules.json');
const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../tests/fixtures/partner-sync/shared/post-timings-idempotency-key.json',
);

describe('P6 D15 Should — partner-sync surface', () => {
  const spec = fs.readFileSync(SPEC_PATH, 'utf8');
  const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));

  test('OpenAPI documents optional Idempotency-Key, 429 and club/station key', () => {
    expect(spec).toContain('Idempotency-Key');
    expect(spec).toContain('RateLimited');
    expect(spec).toMatch(/429/);
    expect(spec).toMatch(/Retry-After/);
    expect(spec.toLowerCase()).toContain('club');
    expect(spec).not.toMatch(/Slot Lap|ds200|DS-200/i);
  });

  test('contract rules list Idempotency-Key as optional', () => {
    expect(rules.optional_headers).toContain('Idempotency-Key');
    const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    expect(fixture.request.headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(fixture.request.headers['X-API-Key']).toEqual(expect.any(String));
  });

  test('idempotency is additive (blank header = current behavior)', () => {
    expect(parseIdempotencyKey(undefined).key).toBeNull();
    expect(parseIdempotencyKey('heat-1').key).toBe('heat-1');
    expect(ownerScopeFromReq({ user: { id: 'u1' } })).toBe('user:u1');
  });

  test('rate limit default stays high for race sessions', () => {
    const prev = process.env.SYNC_RATE_LIMIT_MAX;
    delete process.env.SYNC_RATE_LIMIT_MAX;
    expect(getSyncRateLimitMax()).toBeGreaterThanOrEqual(600);
    if (prev == null) delete process.env.SYNC_RATE_LIMIT_MAX;
    else process.env.SYNC_RATE_LIMIT_MAX = prev;
  });

  test('club/station key stays scoped (no personal garage)', () => {
    expect(clubScopeClubId({ apiKeyContext: { type: 'club', clubId: 'c1' } })).toBe('c1');
    expect(isPersonalGaragePath('/vehicles')).toBe(true);
    expect(isPersonalGaragePath('/clubs/c1/members')).toBe(false);
  });
});
