'use strict';

const { listClubAccountMembers, displayNameFromAuthUser } = require('../../lib/clubMembers');

const OWNER_ID = '88888888-8888-4888-8888-888888888888';
const MEMBER_ID = '99999999-9999-4999-8999-999999999999';
const CLUB_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_MEMBERSHIP_ID = '12121212-1212-4121-8121-121212121212';
const MEMBER_MEMBERSHIP_ID = '13131313-1313-4131-8131-131313131313';

function createQueryBuilder(resolveValue = { data: null, error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolveValue),
    single: jest.fn().mockResolvedValue(resolveValue),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('listClubAccountMembers', () => {
  test('returns user_id, display_name, email, role, is_owner', async () => {
    const supabase = {
      from: jest.fn((table) => {
        if (table === 'clubs') {
          return createQueryBuilder({ data: { owner_user_id: OWNER_ID }, error: null });
        }
        if (table === 'club_members') {
          return createQueryBuilder({
            data: [
              {
                id: OWNER_MEMBERSHIP_ID,
                user_id: OWNER_ID,
                role: 'admin',
                joined_at: '2026-01-15T10:00:00.000Z',
              },
              {
                id: MEMBER_MEMBERSHIP_ID,
                user_id: MEMBER_ID,
                role: 'member',
                joined_at: '2026-02-01T10:00:00.000Z',
              },
            ],
            error: null,
          });
        }
        if (table === 'pilot_public_profiles') {
          return createQueryBuilder({
            data: [{ user_id: OWNER_ID, display_name: 'Ada Lovelace' }],
            error: null,
          });
        }
        return createQueryBuilder();
      }),
      auth: {
        admin: {
          getUserById: jest.fn(async (userId) => {
            if (userId === OWNER_ID) {
              return {
                data: {
                  user: {
                    id: OWNER_ID,
                    email: 'ada@example.test',
                    user_metadata: { full_name: 'Ada From Meta' },
                  },
                },
                error: null,
              };
            }
            return {
              data: {
                user: {
                  id: MEMBER_ID,
                  email: 'bob@example.test',
                  user_metadata: { name: 'Bob' },
                },
              },
              error: null,
            };
          }),
        },
      },
    };

    const result = await listClubAccountMembers(supabase, CLUB_ID);
    expect(result.ok).toBe(true);
    expect(result.payload.owner_user_id).toBe(OWNER_ID);
    expect(result.payload.members).toHaveLength(2);
    expect(result.payload.members[0]).toEqual({
      id: OWNER_MEMBERSHIP_ID,
      user_id: OWNER_ID,
      display_name: 'Ada Lovelace',
      email: 'ada@example.test',
      role: 'admin',
      joined_at: '2026-01-15T10:00:00.000Z',
      is_owner: true,
    });
    expect(result.payload.members[1]).toEqual({
      id: MEMBER_MEMBERSHIP_ID,
      user_id: MEMBER_ID,
      display_name: 'Bob',
      email: 'bob@example.test',
      role: 'member',
      joined_at: '2026-02-01T10:00:00.000Z',
      is_owner: false,
    });
  });

  test('404 when club is missing', async () => {
    const supabase = {
      from: jest.fn(() => createQueryBuilder({ data: null, error: null })),
      auth: { admin: { getUserById: jest.fn() } },
    };
    const result = await listClubAccountMembers(supabase, CLUB_ID);
    expect(result).toEqual({ ok: false, status: 404, error: 'Club no encontrado' });
  });
});

describe('displayNameFromAuthUser', () => {
  test('prefers full_name then name', () => {
    expect(displayNameFromAuthUser({ user_metadata: { full_name: 'Ada', name: 'X' } })).toBe('Ada');
    expect(displayNameFromAuthUser({ user_metadata: { name: 'Bob' } })).toBe('Bob');
    expect(displayNameFromAuthUser({ user_metadata: {} })).toBeNull();
  });
});
