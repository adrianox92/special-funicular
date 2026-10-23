'use strict';

const {
  collectEnrolledCompetitionIds,
  mergeMyCompetitions,
} = require('../../lib/competitionParticipation');
const { canViewCompetition } = require('../../lib/competitionPermissions');

function supabaseMock(tables) {
  return {
    from(table) {
      const filters = [];
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          filters.push({ type: 'eq', column, value });
          return builder;
        },
        in(column, values) {
          filters.push({ type: 'in', column, values });
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          const rows = matchRows(tables[table] || [], filters);
          return Promise.resolve({ data: rows[0] || null, error: null });
        },
        then(onFulfilled, onRejected) {
          const rows = matchRows(tables[table] || [], filters);
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };
}

function matchRows(rows, filters) {
  return rows.filter((row) =>
    filters.every((filter) => {
      if (filter.type === 'eq') return row[filter.column] === filter.value;
      return filter.values.includes(row[filter.column]);
    }),
  );
}

describe('competiciones del inscrito', () => {
  it('agrupa los participantes oficiales por competición', () => {
    const ids = collectEnrolledCompetitionIds([
      { id: 'p1', competition_id: 'copa', vehicle_id: 'supra' },
      { id: 'p2', competition_id: 'copa', vehicle_id: 'supra' },
      { id: 'p3', competition_id: 'otra', vehicle_id: 'supra' },
      { id: 'p4', competition_id: null, vehicle_id: 'supra' },
    ]);
    expect(ids).toEqual(['copa', 'otra']);
  });

  it('conserva organizador y club, y añade solo la prueba del inscrito', () => {
    const list = mergeMyCompetitions({
      owned: [
        {
          id: 'mia',
          name: 'Mía',
          created_at: '2026-10-01T00:00:00.000Z',
          competition_participants: [{ count: 4 }],
        },
      ],
      club: [
        {
          id: 'club',
          name: 'Del club',
          created_at: '2026-09-01T00:00:00.000Z',
          competition_participants: [{ count: 8 }],
        },
      ],
      enrolled: [
        {
          id: 'mia',
          name: 'Mía',
          created_at: '2026-10-01T00:00:00.000Z',
          competition_participants: [{ count: 4 }],
        },
        {
          id: 'copa',
          name: 'Copa octubre 17',
          created_at: '2026-10-17T14:30:00.000Z',
          club_id: null,
          status: 'running',
          competition_participants: [{ count: 2 }],
        },
      ],
    });

    expect(list.map((row) => [row.id, row.viewer_role, row.participants_count])).toEqual([
      ['copa', 'participant', 2],
      ['mia', 'organizer', 4],
      ['club', 'club', 8],
    ]);
    expect(list[0].competition_participants).toBeUndefined();
  });
});

describe('canViewCompetition para un inscrito', () => {
  const juan = { id: 'juan', email: 'juan@example.com' };
  const copa = { id: 'copa', organizer: 'adrian', club_id: null, status: 'running' };

  it('deja ver la prueba sin club si el coche del usuario está inscrito', async () => {
    const supabase = supabaseMock({
      vehicles: [{ id: 'supra', user_id: 'juan' }],
      competition_participants: [{ id: 'p1', competition_id: 'copa', vehicle_id: 'supra' }],
    });
    await expect(canViewCompetition(supabase, juan, copa)).resolves.toBe(true);
  });

  it('sigue ocultando una prueba ajena sin club ni coche propio', async () => {
    const supabase = supabaseMock({
      vehicles: [{ id: 'otro', user_id: 'juan' }],
      competition_participants: [{ id: 'p1', competition_id: 'copa', vehicle_id: 'peugeot' }],
    });
    await expect(canViewCompetition(supabase, juan, copa)).resolves.toBe(false);
  });

  it('el organizador sigue viendo la prueba', async () => {
    const supabase = supabaseMock({});
    await expect(
      canViewCompetition(supabase, { id: 'adrian' }, copa),
    ).resolves.toBe(true);
  });

  it('un miembro del club sigue viendo la prueba del club', async () => {
    const supabase = supabaseMock({
      vehicles: [],
      club_members: [{ id: 'm1', club_id: 'pedrena', user_id: 'juan' }],
    });
    await expect(
      canViewCompetition(supabase, juan, { ...copa, club_id: 'pedrena' }),
    ).resolves.toBe(true);
  });
});
