'use strict';

const {
  MAX_USER_API_KEYS,
  listUserApiKeys,
  createUserApiKey,
  rotateDefaultUserApiKey,
  revokeUserApiKey,
  publicKeyListItem,
} = require('../../lib/userApiKeys');

function memoryUserKeys() {
  const rows = [];
  const api = {
    from(table) {
      if (table !== 'user_api_keys') throw new Error(`unexpected table ${table}`);
      const filters = {};
      const state = { op: 'select', payload: null };
      const builder = {
        select() {
          return builder;
        },
        insert(payload) {
          state.op = 'insert';
          state.payload = payload;
          return builder;
        },
        update(payload) {
          state.op = 'update';
          state.payload = payload;
          return builder;
        },
        eq(col, val) {
          filters[col] = val;
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle: async () => {
          const data = apply()[0] || null;
          return { data, error: null };
        },
        single: async () => {
          const data = apply()[0] || null;
          return { data, error: data ? null : { code: 'PGRST116' } };
        },
        then(onFulfilled, onRejected) {
          return Promise.resolve({ data: apply(), error: null }).then(onFulfilled, onRejected);
        },
      };

      function apply() {
        if (state.op === 'insert') {
          const inserted = (state.payload || []).map((row) => {
            const saved = { id: `id-${rows.length + 1}`, created_at: '2026-09-24T12:00:00.000Z', ...row };
            rows.push(saved);
            return saved;
          });
          return inserted;
        }
        let list = rows.slice();
        if (filters.user_id) list = list.filter((r) => r.user_id === filters.user_id);
        if (filters.id) list = list.filter((r) => r.id === filters.id);
        if (state.op === 'update') {
          list.forEach((row) => Object.assign(row, state.payload));
        }
        return list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      }

      return builder;
    },
  };
  return { api, rows };
}

describe('userApiKeys', () => {
  test('create + list + public shape', async () => {
    const { api } = memoryUserKeys();
    const created = await createUserApiKey(api, 'user-1', { name: 'Pista casa' });
    expect(created.error).toBeNull();
    expect(created.api_key).toEqual(expect.any(String));
    expect(created.api_key).toHaveLength(64);
    expect(created.row.key_prefix).toBe(created.api_key.slice(0, 8));

    const listed = await listUserApiKeys(api, 'user-1');
    expect(listed.keys).toHaveLength(1);
    expect(publicKeyListItem(listed.keys[0])).toEqual(
      expect.objectContaining({
        id: created.row.id,
        name: 'Pista casa',
        key_prefix: created.row.key_prefix,
        revoked_at: null,
      }),
    );
  });

  test('rotate default does not drop extra keys', async () => {
    const { api, rows } = memoryUserKeys();
    const first = await createUserApiKey(api, 'user-1', { name: 'default' });
    const extra = await createUserApiKey(api, 'user-1', { name: 'estación' });
    const rotated = await rotateDefaultUserApiKey(api, 'user-1');
    expect(rotated.error).toBeNull();
    expect(rotated.api_key).not.toBe(first.api_key);
    expect(rows.some((r) => r.id === extra.row.id && !r.revoked_at)).toBe(true);
  });

  test('cannot revoke the last active key', async () => {
    const { api } = memoryUserKeys();
    const first = await createUserApiKey(api, 'user-1');
    const denied = await revokeUserApiKey(api, 'user-1', first.row.id);
    expect(denied.error.status).toBe(400);
    expect(denied.error.message).toMatch(/al menos una/);
  });

  test('revoke extra key keeps one active', async () => {
    const { api } = memoryUserKeys();
    const first = await createUserApiKey(api, 'user-1');
    const extra = await createUserApiKey(api, 'user-1', { name: 'extra' });
    const revoked = await revokeUserApiKey(api, 'user-1', extra.row.id);
    expect(revoked.error).toBeNull();
    const listed = await listUserApiKeys(api, 'user-1');
    expect(listed.keys.filter((k) => !k.revoked_at).map((k) => k.id)).toEqual([first.row.id]);
  });

  test('enforces max active keys', async () => {
    const { api } = memoryUserKeys();
    for (let i = 0; i < MAX_USER_API_KEYS; i += 1) {
      const created = await createUserApiKey(api, 'user-1', { name: `k${i}` });
      expect(created.error).toBeNull();
    }
    const overflow = await createUserApiKey(api, 'user-1', { name: 'overflow' });
    expect(overflow.error.status).toBe(400);
  });
});
