'use strict';

const {
  clubScopeClubId,
  isPersonalGaragePath,
  clubIdFromSyncPath,
  enforceClubKeyScope,
} = require('../../lib/syncKeyScope');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('syncKeyScope', () => {
  test('clubScopeClubId only for club keys', () => {
    expect(clubScopeClubId({})).toBeNull();
    expect(clubScopeClubId({ apiKeyContext: { type: 'user' } })).toBeNull();
    expect(clubScopeClubId({ apiKeyContext: { type: 'club', clubId: 'c1' } })).toBe('c1');
  });

  test('personal garage paths', () => {
    expect(isPersonalGaragePath('/vehicles')).toBe(true);
    expect(isPersonalGaragePath('/timings')).toBe(true);
    expect(isPersonalGaragePath('/circuits')).toBe(true);
    expect(isPersonalGaragePath('/clubs/admin')).toBe(false);
    expect(isPersonalGaragePath('/competitions')).toBe(false);
  });

  test('clubIdFromSyncPath', () => {
    expect(clubIdFromSyncPath('/clubs/admin')).toBeNull();
    expect(clubIdFromSyncPath('/clubs/33333333-3333-4333-8333-333333333333/members')).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
  });

  test('enforceClubKeyScope is a no-op for personal keys', () => {
    const req = { path: '/vehicles', apiKeyContext: { type: 'user' } };
    const res = mockRes();
    const next = jest.fn();
    enforceClubKeyScope(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  test('club key cannot hit personal garage', () => {
    const req = { path: '/vehicles', apiKeyContext: { type: 'club', clubId: 'c1' } };
    const res = mockRes();
    enforceClubKeyScope(req, res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/garaje personal/);
  });

  test('club key cannot touch another club', () => {
    const req = {
      path: '/clubs/other-club/members',
      apiKeyContext: { type: 'club', clubId: 'c1' },
    };
    const res = mockRes();
    enforceClubKeyScope(req, res, jest.fn());
    expect(res.statusCode).toBe(403);
  });

  test('club key can access its own club routes', () => {
    const req = {
      path: '/clubs/c1/members',
      apiKeyContext: { type: 'club', clubId: 'c1' },
    };
    const res = mockRes();
    const next = jest.fn();
    enforceClubKeyScope(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
