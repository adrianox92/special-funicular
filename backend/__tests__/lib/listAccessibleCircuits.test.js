const { listAccessibleCircuitsForUser } = require('../../lib/clubCircuits');

function mockSupabase(responses) {
  const queue = [...responses];
  return {
    from(table) {
      const next = queue.shift();
      if (!next || next.table !== table) {
        throw new Error(`Unexpected from(${table})`);
      }
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        is() {
          return chain;
        },
        in() {
          return chain;
        },
        then(resolve, reject) {
          return Promise.resolve(next.result).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

describe('listAccessibleCircuitsForUser', () => {
  it('combina circuitos personales y de club', async () => {
    const supabase = mockSupabase([
      {
        table: 'circuits',
        result: {
          data: [{ id: 'p1', name: 'Mi pista', club_id: null, user_id: 'u1' }],
          error: null,
        },
      },
      { table: 'clubs', result: { data: [], error: null } },
      { table: 'club_members', result: { data: [{ club_id: 'club-1' }], error: null } },
      {
        table: 'circuits',
        result: {
          data: [
            {
              id: 'c1',
              name: 'Pista club',
              club_id: 'club-1',
              clubs: { name: 'Slot Madrid' },
            },
          ],
          error: null,
        },
      },
    ]);

    const list = await listAccessibleCircuitsForUser(supabase, 'u1');
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.id).sort()).toEqual(['c1', 'p1']);
  });
});
