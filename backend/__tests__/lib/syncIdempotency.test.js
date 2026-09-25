'use strict';

const express = require('express');
const request = require('supertest');
const {
  parseIdempotencyKey,
  ownerScopeFromReq,
  requestFingerprint,
  syncIdempotencyMiddleware,
  resetIdempotencyStoreForTests,
} = require('../../lib/syncIdempotency');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1' };
    req.apiKeyContext = { type: 'user', userId: 'user-1' };
    next();
  });
  app.use(syncIdempotencyMiddleware);
  let n = 0;
  app.post('/api/sync/timings', (req, res) => {
    n += 1;
    res.status(201).json({ id: `row-${n}`, vehicle_id: req.body.vehicle_id, n });
  });
  app.get('/hits', (_req, res) => res.json({ n }));
  return app;
}

describe('syncIdempotency', () => {
  beforeEach(() => {
    resetIdempotencyStoreForTests();
  });

  test('parseIdempotencyKey treats missing/blank as opt-out', () => {
    expect(parseIdempotencyKey(undefined)).toEqual({ key: null });
    expect(parseIdempotencyKey('')).toEqual({ key: null });
    expect(parseIdempotencyKey('  ')).toEqual({ key: null });
    expect(parseIdempotencyKey('abc-123').key).toBe('abc-123');
    expect(parseIdempotencyKey('x'.repeat(257)).error).toMatch(/256/);
  });

  test('ownerScopeFromReq prefers club scope', () => {
    expect(ownerScopeFromReq({ user: { id: 'u' } })).toBe('user:u');
    expect(
      ownerScopeFromReq({
        user: { id: 'owner' },
        apiKeyContext: { type: 'club', clubId: 'club-1' },
      }),
    ).toBe('club:club-1');
  });

  test('requestFingerprint changes when body changes', () => {
    const a = requestFingerprint({ method: 'POST', originalUrl: '/api/sync/timings', body: { laps: 1 } });
    const b = requestFingerprint({ method: 'POST', originalUrl: '/api/sync/timings', body: { laps: 2 } });
    expect(a).not.toBe(b);
  });

  test('missing header keeps current behavior (handler runs every time)', async () => {
    const app = buildApp();
    const body = { vehicle_id: 'v1' };
    await request(app).post('/api/sync/timings').send(body).expect(201);
    const second = await request(app).post('/api/sync/timings').send(body).expect(201);
    expect(second.body.n).toBe(2);
    expect(second.headers['idempotent-replayed']).toBeUndefined();
  });

  test('same Idempotency-Key replays the first response', async () => {
    const app = buildApp();
    const body = { vehicle_id: 'v1', laps: 10 };
    const first = await request(app)
      .post('/api/sync/timings')
      .set('Idempotency-Key', 'race-heat-1')
      .send(body)
      .expect(201);
    const second = await request(app)
      .post('/api/sync/timings')
      .set('Idempotency-Key', 'race-heat-1')
      .send(body)
      .expect(201);
    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotent-replayed']).toBe('true');
    const hits = await request(app).get('/hits');
    expect(hits.body.n).toBe(1);
  });

  test('same key with a different body returns 409', async () => {
    const app = buildApp();
    await request(app)
      .post('/api/sync/timings')
      .set('Idempotency-Key', 'race-heat-1')
      .send({ vehicle_id: 'v1' })
      .expect(201);
    const res = await request(app)
      .post('/api/sync/timings')
      .set('Idempotency-Key', 'race-heat-1')
      .send({ vehicle_id: 'v2' })
      .expect(409);
    expect(res.body.error).toMatch(/cuerpo o ruta/);
  });
});
