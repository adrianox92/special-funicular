'use strict';

const {
  parsePeriodFilter,
  upsertBestLap,
  applyGuestLap,
  buildClubCircuitLeaderboard,
} = require('../../lib/clubCircuitLeaderboard');

describe('parsePeriodFilter', () => {
  it('devuelve all por defecto', () => {
    expect(parsePeriodFilter(null).label).toBe('all');
    expect(parsePeriodFilter('all').since).toBeNull();
  });

  it('calcula month y season', () => {
    expect(parsePeriodFilter('month').label).toBe('month');
    expect(parsePeriodFilter('month').since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsePeriodFilter('season').label).toBe('season');
    expect(parsePeriodFilter('season').since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('upsertBestLap / applyGuestLap', () => {
  it('guarda el más rápido y desempata por fecha más reciente', () => {
    const map = new Map();
    upsertBestLap(map, 'u1', 5.2, { timing_date: '2026-01-01', timing_id: 'a', best_lap_time: '5.200' });
    upsertBestLap(map, 'u1', 5.1, { timing_date: '2026-01-02', timing_id: 'b', best_lap_time: '5.100' });
    expect(map.get('u1').lapSeconds).toBe(5.1);
    expect(map.get('u1').timing_id).toBe('b');

    upsertBestLap(map, 'u1', 5.1, { timing_date: '2026-02-01', timing_id: 'c', best_lap_time: '5.100' });
    expect(map.get('u1').timing_id).toBe('c');
    expect(map.get('u1').timing_date).toBe('2026-02-01');
  });

  it('fusiona invitado vinculado al usuario', () => {
    const bestByUser = new Map();
    const bestByGuest = new Map();
    applyGuestLap(bestByUser, bestByGuest, {
      guestMemberId: 'g1',
      linkedUserId: 'u1',
      guestName: 'Pepe',
      lapSec: 4.5,
      entryBase: { best_lap_time: '4.500', timing_date: '2026-03-01', timing_id: 't1' },
    });
    expect(bestByUser.has('u1')).toBe(true);
    expect(bestByGuest.size).toBe(0);
  });

  it('mete invitado sin vincular en bestByGuest', () => {
    const bestByUser = new Map();
    const bestByGuest = new Map();
    applyGuestLap(bestByUser, bestByGuest, {
      guestMemberId: 'g1',
      linkedUserId: null,
      guestName: 'Pepe',
      lapSec: 4.5,
      entryBase: { best_lap_time: '4.500', timing_date: '2026-03-01', timing_id: 't1' },
    });
    expect(bestByGuest.get('g1').display_name).toBe('Pepe');
    expect(bestByUser.size).toBe(0);
  });
});

/**
 * Mock mínimo de Supabase que responde por nombre de tabla.
 * Cada handler recibe el "estado" del query builder (eq filters, etc.).
 */
function createSupabaseMock(handlers) {
  return {
    from(table) {
      const state = { table, filters: {}, gte: {}, inValues: {}, notNull: [] };
      const builder = {
        select() {
          return builder;
        },
        eq(col, val) {
          state.filters[col] = val;
          return builder;
        },
        gte(col, val) {
          state.gte[col] = val;
          return builder;
        },
        in(col, vals) {
          state.inValues[col] = vals;
          return builder;
        },
        not(col, op) {
          if (op === 'is') state.notNull.push(col);
          return builder;
        },
        maybeSingle: async () => {
          const handler = handlers[table];
          if (!handler) return { data: null, error: null };
          const result = await handler(state);
          const rows = result.data || [];
          return { data: rows[0] || null, error: result.error || null };
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(async () => {
              const handler = handlers[table];
              if (!handler) return { data: [], error: null };
              return handler(state);
            })
            .then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

describe('buildClubCircuitLeaderboard — competition_timings', () => {
  const clubId = 'club-1';
  const circuitId = 'circuit-1';
  const memberId = 'user-member';
  const guestId = 'guest-1';

  it('incluye mejor vuelta de competición de un invitado del club', async () => {
    const supabase = createSupabaseMock({
      vehicle_timings: async () => ({ data: [], error: null }),
      club_members: async () => ({ data: [{ user_id: memberId }], error: null }),
      clubs: async () => ({ data: [{ owner_user_id: memberId }], error: null }),
      club_guest_timings: async () => ({ data: [], error: null }),
      competition_timings: async () => ({
        data: [
          {
            id: 'ct-1',
            best_lap_time: '5.123',
            best_lap_timestamp: 5.123,
            timing_date: '2026-07-01',
            lane: '1',
            laps: 10,
            did_not_participate: false,
            participant_id: 'p-1',
            competition_participants: {
              id: 'p-1',
              vehicle_id: null,
              vehicle_model: 'GT3',
              driver_name: 'Invitado Uno',
              from_guest_member_id: guestId,
              vehicles: null,
            },
          },
        ],
        error: null,
      }),
      club_guest_members: async () => ({
        data: [{ id: guestId, name: 'Invitado Uno', linked_user_id: null, club_id: clubId }],
        error: null,
      }),
      pilot_public_profiles: async () => ({ data: [], error: null }),
    });

    const result = await buildClubCircuitLeaderboard(supabase, { clubId, circuitId });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].is_guest).toBe(true);
    expect(result.entries[0].guest_member_id).toBe(guestId);
    expect(result.entries[0].best_lap_seconds).toBe(5.123);
    expect(result.entries[0].display_name).toBe('Invitado Uno');
  });

  it('ignora DNP y invitados de otro club', async () => {
    const supabase = createSupabaseMock({
      vehicle_timings: async () => ({ data: [], error: null }),
      club_members: async () => ({ data: [], error: null }),
      clubs: async () => ({ data: [{ owner_user_id: null }], error: null }),
      club_guest_timings: async () => ({ data: [], error: null }),
      competition_timings: async () => ({
        data: [
          {
            id: 'ct-dnp',
            best_lap_time: '4.000',
            best_lap_timestamp: 4,
            timing_date: '2026-07-01',
            lane: '1',
            laps: 5,
            did_not_participate: true,
            competition_participants: {
              id: 'p-dnp',
              from_guest_member_id: guestId,
              vehicle_model: 'X',
              vehicles: null,
            },
          },
          {
            id: 'ct-other',
            best_lap_time: '4.100',
            best_lap_timestamp: 4.1,
            timing_date: '2026-07-02',
            lane: '1',
            laps: 5,
            did_not_participate: false,
            competition_participants: {
              id: 'p-other',
              from_guest_member_id: 'guest-otro-club',
              vehicle_model: 'Y',
              vehicles: null,
            },
          },
        ],
        error: null,
      }),
      // solo devolvemos guest del club actual; el otro no aparece
      club_guest_members: async () => ({
        data: [{ id: guestId, name: 'Local', linked_user_id: null, club_id: clubId }],
        error: null,
      }),
      pilot_public_profiles: async () => ({ data: [], error: null }),
    });

    const result = await buildClubCircuitLeaderboard(supabase, { clubId, circuitId });
    expect(result.entries).toHaveLength(0);
  });

  it('usa tiempo de competición de miembro vía vehicle.user_id si es mejor', async () => {
    const supabase = createSupabaseMock({
      vehicle_timings: async () => ({
        data: [
          {
            id: 'vt-1',
            best_lap_time: '6.000',
            best_lap_timestamp: 6,
            timing_date: '2026-06-01',
            lane: '1',
            laps: 10,
            consistency_score: 2,
            vehicles: { id: 'v1', user_id: memberId, model: 'Carrera', type: 'GT' },
          },
        ],
        error: null,
      }),
      club_members: async () => ({ data: [{ user_id: memberId }], error: null }),
      clubs: async () => ({ data: [{ owner_user_id: memberId }], error: null }),
      club_guest_timings: async () => ({ data: [], error: null }),
      competition_timings: async () => ({
        data: [
          {
            id: 'ct-member',
            best_lap_time: '5.500',
            best_lap_timestamp: 5.5,
            timing_date: '2026-07-10',
            lane: '2',
            laps: 12,
            did_not_participate: false,
            competition_participants: {
              id: 'p-m',
              vehicle_id: 'v1',
              vehicle_model: null,
              from_guest_member_id: null,
              vehicles: { id: 'v1', user_id: memberId, model: 'Carrera', type: 'GT' },
            },
          },
        ],
        error: null,
      }),
      club_guest_members: async () => ({ data: [], error: null }),
      pilot_public_profiles: async () => ({
        data: [{ user_id: memberId, display_name: 'Piloto', slug: 'piloto', enabled: true }],
        error: null,
      }),
    });

    const result = await buildClubCircuitLeaderboard(supabase, { clubId, circuitId });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].is_guest).toBe(false);
    expect(result.entries[0].user_id).toBe(memberId);
    expect(result.entries[0].best_lap_seconds).toBe(5.5);
    expect(result.entries[0].display_name).toBe('Piloto');
    expect(result.entries[0].pilot_slug).toBe('piloto');
  });

  it('fusiona competición de invitado vinculado con el usuario', async () => {
    const supabase = createSupabaseMock({
      vehicle_timings: async () => ({ data: [], error: null }),
      club_members: async () => ({ data: [{ user_id: memberId }], error: null }),
      clubs: async () => ({ data: [{ owner_user_id: memberId }], error: null }),
      club_guest_timings: async () => ({ data: [], error: null }),
      competition_timings: async () => ({
        data: [
          {
            id: 'ct-linked',
            best_lap_time: '5.010',
            best_lap_timestamp: 5.01,
            timing_date: '2026-07-15',
            lane: '1',
            laps: 8,
            did_not_participate: false,
            competition_participants: {
              id: 'p-l',
              from_guest_member_id: guestId,
              vehicle_model: 'Legacy',
              vehicles: null,
            },
          },
        ],
        error: null,
      }),
      club_guest_members: async () => ({
        data: [{ id: guestId, name: 'Antes guest', linked_user_id: memberId, club_id: clubId }],
        error: null,
      }),
      pilot_public_profiles: async () => ({
        data: [{ user_id: memberId, display_name: 'Ahora user', slug: 'ahora', enabled: true }],
        error: null,
      }),
    });

    const result = await buildClubCircuitLeaderboard(supabase, { clubId, circuitId });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].is_guest).toBe(false);
    expect(result.entries[0].user_id).toBe(memberId);
    expect(result.entries[0].best_lap_seconds).toBe(5.01);
  });
});
