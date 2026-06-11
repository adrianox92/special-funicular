'use strict';

const {
  participantMatchKey,
  formatParticipantVehicle,
  registerStandingsEntry,
  resolveParticipantKey,
  applyCountingRaces,
  sortStandings,
} = require('../../lib/leagueStandings');

describe('leagueStandings — emparejamiento de participantes', () => {
  it('genera claves distintas con y sin email', () => {
    expect(participantMatchKey('Juan Pérez', null)).toBe('juan perez');
    expect(participantMatchKey('Juan Pérez', 'juan@test.com')).toBe('juan perez|juan@test.com');
  });

  it('normaliza espacios múltiples en el nombre', () => {
    expect(participantMatchKey('Adrian  Palomera', null)).toBe('adrian palomera');
  });

  it('formatea vehículo desde catálogo o texto libre', () => {
    expect(
      formatParticipantVehicle({
        vehicles: { manufacturer: 'Scalextric', model: 'Ford GT40' },
      }),
    ).toBe('Scalextric Ford GT40');
    expect(formatParticipantVehicle({ vehicle_model: 'Porsche 911' })).toBe('Porsche 911');
    expect(formatParticipantVehicle({})).toBeNull();
  });

  it('resuelve participante de liga sin email cuando la competición aporta email', () => {
    const standingsMap = new Map();
    const keyAliases = new Map();
    const leagueKey = participantMatchKey('Juan Pérez', null);

    registerStandingsEntry(standingsMap, keyAliases, leagueKey, {
      league_participant_id: 'lp-1',
      name: 'Juan Pérez',
      email: null,
      total_points: 0,
    });

    const resolved = resolveParticipantKey(
      keyAliases,
      standingsMap,
      'Juan Pérez',
      'juan@test.com',
    );

    expect(resolved).toBe(leagueKey);
    expect(standingsMap.has('juan perez|juan@test.com')).toBe(false);
  });

  it('resuelve participante de liga con email cuando la competición no lo tiene', () => {
    const standingsMap = new Map();
    const keyAliases = new Map();
    const leagueKey = participantMatchKey('Juan Pérez', 'juan@test.com');

    registerStandingsEntry(standingsMap, keyAliases, leagueKey, {
      league_participant_id: 'lp-1',
      name: 'Juan Pérez',
      email: 'juan@test.com',
      total_points: 0,
    });

    const resolved = resolveParticipantKey(keyAliases, standingsMap, 'Juan Pérez', null);

    expect(resolved).toBe(leagueKey);
  });
});

describe('leagueStandings — counting_races', () => {
  it('descarta las peores puntuaciones y marca dropped', () => {
    const row = {
      name: 'Piloto A',
      by_competition: {
        'c1': { points: 10, position: 2, dropped: false },
        'c2': { points: 25, position: 1, dropped: false },
        'c3': { points: 5, position: 4, dropped: false },
        'c4': { points: 18, position: 3, dropped: false },
      },
    };

    applyCountingRaces(row, 2);

    expect(row.total_points).toBe(43);
    expect(row.dropped_competitions).toBe(2);
    expect(row.by_competition.c3.dropped).toBe(true);
    expect(row.by_competition.c1.dropped).toBe(true);
    expect(row.by_competition.c2.dropped).toBe(false);
    expect(row.by_competition.c4.dropped).toBe(false);
  });

  it('cuenta todas las pruebas si counting_races es null', () => {
    const row = {
      name: 'Piloto B',
      by_competition: {
        'c1': { points: 10, position: 1 },
        'c2': { points: 8, position: 2 },
      },
    };

    applyCountingRaces(row, null);

    expect(row.total_points).toBe(18);
    expect(row.dropped_competitions).toBe(0);
    expect(row.by_competition.c1.dropped).toBe(false);
    expect(row.by_competition.c2.dropped).toBe(false);
  });
});

describe('leagueStandings — tiebreak_mode', () => {
  const closedIds = ['c1', 'c2'];

  it('desempata por más victorias', () => {
    const standings = [
      {
        name: 'Ana',
        total_points: 30,
        wins: 1,
        competitions_completed: 2,
        by_competition: { c2: { position: 1, dropped: false } },
      },
      {
        name: 'Luis',
        total_points: 30,
        wins: 2,
        competitions_completed: 2,
        by_competition: { c1: { position: 1, dropped: false }, c2: { position: 2, dropped: false } },
      },
    ];

    const sorted = sortStandings(standings, 'most_wins', closedIds);
    expect(sorted[0].name).toBe('Luis');
  });

  it('desempata por posición en última prueba', () => {
    const standings = [
      {
        name: 'Ana',
        total_points: 20,
        competitions_completed: 2,
        by_competition: { c2: { position: 3, dropped: false } },
      },
      {
        name: 'Luis',
        total_points: 20,
        competitions_completed: 2,
        by_competition: { c2: { position: 1, dropped: false } },
      },
    ];

    const sorted = sortStandings(standings, 'last_race_position', closedIds);
    expect(sorted[0].name).toBe('Luis');
  });

  it('desempata por pruebas completadas por defecto', () => {
    const standings = [
      { name: 'Ana', total_points: 15, competitions_completed: 1 },
      { name: 'Luis', total_points: 15, competitions_completed: 2 },
    ];

    const sorted = sortStandings(standings, 'competitions_completed', closedIds);
    expect(sorted[0].name).toBe('Luis');
  });
});
