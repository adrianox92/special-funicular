'use strict';

const express = require('express');
const request = require('supertest');
const { createSyncApiKeyLimiter, getSyncRateLimitMax, syncRateLimitKey } = require('../../middleware/rateLimits');

describe('sync rate limit', () => {
  const prev = process.env.SYNC_RATE_LIMIT_MAX;

  afterEach(() => {
    if (prev == null) delete process.env.SYNC_RATE_LIMIT_MAX;
    else process.env.SYNC_RATE_LIMIT_MAX = prev;
  });

  test('default is high enough for a live race (600/min)', () => {
    delete process.env.SYNC_RATE_LIMIT_MAX;
    expect(getSyncRateLimitMax()).toBe(600);
  });

  test('SYNC_RATE_LIMIT_MAX=0 disables', () => {
    process.env.SYNC_RATE_LIMIT_MAX = '0';
    expect(getSyncRateLimitMax()).toBe(0);
  });

  test('keys by X-API-Key, not by IP', () => {
    const a = syncRateLimitKey({ headers: { 'x-api-key': 'aaa' }, ip: '1.1.1.1' });
    const b = syncRateLimitKey({ headers: { 'x-api-key': 'bbb' }, ip: '1.1.1.1' });
    const c = syncRateLimitKey({ headers: { 'x-api-key': 'aaa' }, ip: '9.9.9.9' });
    expect(a).not.toBe(b);
    expect(a).toBe(c);
    expect(a.startsWith('sync:')).toBe(true);
  });

  test('returns 429 with Retry-After when the bucket is exhausted', async () => {
    const app = express();
    app.use(createSyncApiKeyLimiter({ max: 2, windowMs: 60 * 1000 }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));

    const key = 'rate-limit-unique-test-key';
    await request(app).get('/ping').set('X-API-Key', key).expect(200);
    await request(app).get('/ping').set('X-API-Key', key).expect(200);
    const limited = await request(app).get('/ping').set('X-API-Key', key).expect(429);
    expect(limited.body).toEqual({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
    expect(limited.headers['retry-after']).toBeDefined();
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    await request(app).get('/ping').set('X-API-Key', 'another-key').expect(200);
  });
});
