'use strict';

const { applyCountingRaces, applyExplicitZeroPointResult } = require('../../lib/leagueStandings');
const {
  findStandingRow,
  isSelfStanding,
  raceAppearance,
  buildParticipantSeason,
} = require('../../lib/leagueParticipantSeason');

function scoredComp(id, name, orderIndex) {
  return {
    competition_id: id,
    competition_name: name,
    competition_status: 'closed',
    order_index: orderIndex,
    public_slug: `${id}-slug`,
    has_results: true,
  };
}

function pendingComp(id, name, orderIndex) {
  return {
    competition_id: id,
    competition_name: name,
    competition_status: 'published',
    order_index: orderIndex,
    public_slug: `${id}-slug`,
    has_results: false,
  };
}

describe('leagueParticipantSeason — matching', () => {
  const standings = [
    { league_participant_id: 'lp-1', name: 'Ana Pérez', email: 'ana@test.com', total_points: 10 },
    { league_participant_id: 'lp-2', name: 'Luis', email: null, total_points: 8 },
  ];

  it('encuentra por league_participant_id', () => {
    expect(findStandingRow(standings, { leagueParticipantId: 'lp-2' }).name).toBe('Luis');
  });

  it('encuentra por email normalizado', () => {
    expect(findStandingRow(standings, { email: 'ANA@test.com' }).league_participant_id).toBe('lp-1');
  });

  it('encuentra por nombre si es único', () => {
    expect(findStandingRow(standings, { name: 'Luis' }).league_participant_id).toBe('lp-2');
  });

  it('no adivina si el nombre es ambiguo y no hay email', () => {
    const dup = [
      { league_participant_id: 'a', name: 'Alex', email: 'a@x.com' },
      { league_participant_id: 'b', name: 'Alex', email: 'b@x.com' },
    ];
    expect(findStandingRow(dup, { name: 'Alex' })).toBeNull();
    expect(findStandingRow(dup, { name: 'Alex', email: 'b@x.com' }).league_participant_id).toBe('b');
  });

  it('marca is_self solo con email coincidente', () => {
    expect(isSelfStanding(standings[0], { email: 'ana@test.com' })).toBe(true);
    expect(isSelfStanding(standings[0], { email: 'otro@test.com' })).toBe(false);
    expect(isSelfStanding(standings[1], { email: 'alguien@test.com', user_metadata: { name: 'Luis' } })).toBe(false);
  });
});

describe('leagueParticipantSeason — shape / descartes', () => {
  const competitions = [
    scoredComp('c1', 'Prueba 1', 0),
    scoredComp('c2', 'Prueba 2', 1),
    scoredComp('c3', 'Prueba 3', 2),
    scoredComp('c4', 'Prueba 4', 3),
    pendingComp('c5', 'Prueba 5', 4),
  ];

  function payloadFor(row) {
    applyCountingRaces(row, 3);
    return {
      league: {
        id: 'lg-1',
        name: 'Liga Invierno',
        slug: 'liga-invierno',
        status: 'running',
        counting_races: 3,
        tiebreak_mode: 'competitions_completed',
      },
      competitions,
      standings: [{ ...row, position: 2 }],
    };
  }

  it('lista qué cuentas y qué se descarta, distinguiendo DNS de no figura', () => {
    const row = {
      league_participant_id: 'lp-1',
      name: 'Ana',
      email: 'ana@test.com',
      vehicle_model: 'Porsche',
      status: 'confirmed',
      by_competition: {
        c1: { points: 25, position: 1, dropped: false, vehicle: 'Porsche', competition_name: 'Prueba 1' },
        c2: { points: 18, position: 2, dropped: false, competition_name: 'Prueba 2' },
        c3: { points: 6, position: 5, dropped: false, competition_name: 'Prueba 3' },
      },
    };
    applyExplicitZeroPointResult(row, 'c4', { resultStatus: 'dns', competitionName: 'Prueba 4' });

    const season = buildParticipantSeason(payloadFor(row), { leagueParticipantId: 'lp-1' }, { includeEmail: false });

    expect(season.found).toBe(true);
    expect(season.position).toBe(2);
    expect(season.total_points).toBe(49);
    expect(season.dropped_competitions).toBe(1);
    expect(season.participant.email).toBeNull();
    expect(season.counting.map((r) => r.competition_id)).toEqual(['c1', 'c2', 'c3']);
    expect(season.dropped).toHaveLength(1);
    expect(season.dropped[0]).toMatchObject({
      competition_id: 'c4',
      appearance: 'dns',
      points: 0,
      dropped: true,
      counts: false,
    });

    const byId = Object.fromEntries(season.races.map((r) => [r.competition_id, r]));
    expect(byId.c3.appearance).toBe('result');
    expect(byId.c3.counts).toBe(true);
    expect(byId.c4.appearance).toBe('dns');
    expect(byId.c4.points).toBe(0);
    expect(byId.c5.appearance).toBe('pending');
    expect(byId.c5.points).toBeNull();
    expect(season.races.find((r) => r.appearance === 'absent')).toBeUndefined();
    expect(byId.c1.public_path).toBe('/competitions/signup/c1-slug');
  });

  it('marca “no figura” cuando la prueba puntúa y no hay fila', () => {
    const row = {
      league_participant_id: 'lp-2',
      name: 'Luis',
      email: null,
      by_competition: {
        c1: { points: 10, position: 3, dropped: false, competition_name: 'Prueba 1' },
      },
    };

    const season = buildParticipantSeason(payloadFor(row), { name: 'Luis' });
    const absent = season.races.filter((r) => r.appearance === 'absent');
    expect(absent.map((r) => r.competition_id)).toEqual(['c2', 'c3', 'c4']);
    expect(absent.every((r) => r.points === null && r.dropped === false && r.counts === false)).toBe(true);
    expect(season.dropped).toEqual([]);
    expect(season.total_points).toBe(10);
  });

  it('empty: piloto sin resultados y liga sin pruebas', () => {
    const noResultsRow = {
      league_participant_id: 'lp-3',
      name: 'Nueva',
      email: null,
      position: 4,
      total_points: 0,
      by_competition: {},
    };
    const withComps = buildParticipantSeason(
      {
        league: { name: 'Liga', counting_races: 3 },
        competitions,
        standings: [noResultsRow],
      },
      { leagueParticipantId: 'lp-3' },
    );
    expect(withComps.found).toBe(true);
    expect(withComps.empty_reason).toBe('no_results');
    expect(withComps.races.some((r) => r.appearance === 'absent')).toBe(true);

    const noComps = buildParticipantSeason(
      {
        league: { name: 'Vacía', counting_races: null },
        competitions: [],
        standings: [noResultsRow],
      },
      { name: 'Nueva' },
    );
    expect(noComps.empty_reason).toBe('no_competitions');
    expect(noComps.races).toEqual([]);

    const missing = buildParticipantSeason(
      { league: { name: 'Liga' }, competitions, standings: [noResultsRow] },
      { name: 'No existo' },
    );
    expect(missing.found).toBe(false);
    expect(missing.empty_reason).toBe('not_found');
  });

  it('no recalcula: respeta dropped y total_points ya aplicados', () => {
    const row = {
      league_participant_id: 'lp-1',
      name: 'Ana',
      email: 'ana@test.com',
      total_points: 99,
      dropped_competitions: 2,
      position: 1,
      by_competition: {
        c1: { points: 1, position: 9, dropped: true },
        c2: { points: 50, position: 1, dropped: false },
      },
    };

    const season = buildParticipantSeason(
      {
        league: { counting_races: 1, name: 'X' },
        competitions: [scoredComp('c1', 'A', 0), scoredComp('c2', 'B', 1)],
        standings: [row],
      },
      { email: 'ana@test.com' },
      { includeEmail: true, isSelf: true },
    );

    expect(season.total_points).toBe(99);
    expect(season.dropped_competitions).toBe(2);
    expect(season.dropped[0].competition_id).toBe('c1');
    expect(season.counting[0].competition_id).toBe('c2');
    expect(season.participant.email).toBe('ana@test.com');
    expect(season.is_self).toBe(true);
  });
});

describe('leagueParticipantSeason — appearance', () => {
  const closed = { competition_status: 'closed', has_results: true };

  it('proyecta override en la ficha sin recalcular', () => {
    const row = {
      league_participant_id: 'lp-1',
      name: 'Ana',
      email: 'ana@test.com',
      position: 1,
      total_points: 40,
      dropped_competitions: 0,
      by_competition: {
        c1: {
          points: 25,
          position: 1,
          dropped: false,
          overridden: true,
          override: { points: 25, reason: 'Acta', updated_by_label: 'María' },
        },
      },
    };

    const season = buildParticipantSeason(
      {
        league: { counting_races: 3, name: 'Liga' },
        competitions: [scoredComp('c1', 'Prueba 1', 0)],
        standings: [row],
      },
      { leagueParticipantId: 'lp-1' },
    );

    expect(season.total_points).toBe(40);
    expect(season.races[0].points).toBe(25);
    expect(season.races[0].overridden).toBe(true);
    expect(season.races[0].override.reason).toBe('Acta');
    expect(season.counting[0].overridden).toBe(true);
  });

  it('distingue resultado, DNS, DSQ, ausente y pendiente', () => {
    expect(raceAppearance(closed, { points: 10, position: 2 })).toBe('result');
    expect(raceAppearance(closed, { points: 0, result_status: 'dns' })).toBe('dns');
    expect(raceAppearance(closed, { points: 0, result_status: 'dsq' })).toBe('dsq');
    expect(raceAppearance(closed, null)).toBe('absent');
    expect(raceAppearance({ competition_status: 'published', has_results: false }, null)).toBe('pending');
  });
});
