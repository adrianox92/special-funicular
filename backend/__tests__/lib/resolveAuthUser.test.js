const { userFromJwtClaims, resolveAuthUser } = require('../../lib/resolveAuthUser');

describe('userFromJwtClaims', () => {
  it('mapea sub y email', () => {
    expect(
      userFromJwtClaims({
        sub: 'user-1',
        email: 'a@b.c',
        role: 'authenticated',
        user_metadata: { name: 'Ada' },
        app_metadata: { provider: 'email' },
      }),
    ).toMatchObject({
      id: 'user-1',
      email: 'a@b.c',
      role: 'authenticated',
      user_metadata: { name: 'Ada' },
      app_metadata: { provider: 'email' },
    });
  });

  it('usa email de user_metadata si no viene en el claim', () => {
    expect(userFromJwtClaims({ sub: 'u', user_metadata: { email: 'x@y.z' } }).email).toBe('x@y.z');
  });

  it('devuelve null sin sub', () => {
    expect(userFromJwtClaims({ email: 'a@b.c' })).toBeNull();
    expect(userFromJwtClaims(null)).toBeNull();
  });
});

describe('resolveAuthUser', () => {
  it('usa getClaims cuando verifica el JWT', async () => {
    const supabase = {
      auth: {
        getClaims: jest.fn().mockResolvedValue({
          data: { claims: { sub: 'user-1', email: 'a@b.c' } },
          error: null,
        }),
        getUser: jest.fn(),
      },
    };
    const out = await resolveAuthUser(supabase, 'jwt-token');
    expect(out.source).toBe('claims');
    expect(out.user).toMatchObject({ id: 'user-1', email: 'a@b.c' });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it('cae a getUser si getClaims falla', async () => {
    const supabase = {
      auth: {
        getClaims: jest.fn().mockRejectedValue(new Error('jwks')),
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-2', email: 'z@z.z' } },
          error: null,
        }),
      },
    };
    const out = await resolveAuthUser(supabase, 'jwt-token');
    expect(out.source).toBe('getUser');
    expect(out.user.id).toBe('user-2');
  });

  it('cae a getUser si no hay getClaims', async () => {
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-3' } },
          error: null,
        }),
      },
    };
    const out = await resolveAuthUser(supabase, 'jwt-token');
    expect(out.source).toBe('getUser');
    expect(out.user.id).toBe('user-3');
  });

  it('no acepta token vacío', async () => {
    const out = await resolveAuthUser({ auth: {} }, '');
    expect(out.user).toBeNull();
  });
});
