'use strict';

const {
  participantMatchKey,
  formatParticipantVehicle,
  registerStandingsEntry,
  resolveParticipantKey,
  applyCountingRaces,
  applyExplicitZeroPointResult,
  inferResultStatusFromPointsStat,
  isCountableZeroResultStatus,
  sortStandings,
  isCompetitionScorable,
  shouldScoreCompetition,
} = require('../../lib/leagueStandings');

describe('leagueStandings — estados de competición', () => {
  it('considera publicada como procesable', () => {
    expect(isCompetitionScorable('published')).toBe(true);
  });

  it('puntúa publicada/en curso solo con resultados', () => {
    expect(shouldScoreCompetition('published', true)).toBe(true);
    expect(shouldScoreCompetition('published', false)).toBe(false);
    expect(shouldScoreCompetition('running', true)).toBe(true);
    expect(shouldScoreCompetition('running', false)).toBe(false);
    expect(shouldScoreCompetition('closed', false)).toBe(true);
  });
});

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

  it('suma puntos numéricamente aunque vengan como texto', () => {
    const row = {
      name: 'Piloto C',
      by_competition: {
        c1: { points: '10', position: 1 },
        c2: { points: '18', position: 2 },
      },
    };

    applyCountingRaces(row, null);

    expect(row.total_points).toBe(28);
  });

  it('cuenta todas las pruebas si counting_races es null', () => {
    const row = {
      name: 'Piloto B',
      by_competition: {
        c1: { points: 10, position: 1 },
        c2: { points: 8, position: 2 },
      },
    };

    applyCountingRaces(row, null);

    expect(row.total_points).toBe(18);
    expect(row.dropped_competitions).toBe(0);
    expect(row.by_competition.c1.dropped).toBe(false);
    expect(row.by_competition.c2.dropped).toBe(false);
  });
});

describe('leagueStandings — DNS / DSQ y descartes', () => {
  it('DNS cuenta como resultado 0 pts y se puede descartar si es el peor', () => {
    const row = {
      name: 'Piloto DNS',
      by_competition: {
        c1: { points: 25, position: 1, dropped: false },
        c2: { points: 18, position: 2, dropped: false },
        c3: { points: 10, position: 3, dropped: false },
      },
    };

    applyExplicitZeroPointResult(row, 'c4', {
      resultStatus: 'dns',
      competitionName: 'Prueba 4',
    });
    applyCountingRaces(row, 3);

    expect(row.by_competition.c4.points).toBe(0);
    expect(row.by_competition.c4.result_status).toBe('dns');
    expect(row.dropped_competitions).toBe(1);
    expect(row.by_competition.c4.dropped).toBe(true);
    expect(row.by_competition.c1.dropped).toBe(false);
    expect(row.total_points).toBe(53);
  });

  it('DNS permanece en el pool cuando no hay más resultados que counting_races', () => {
    const row = {
      name: 'Piloto justo',
      by_competition: {
        c1: { points: 25, position: 1, dropped: false },
        c2: { points: 18, position: 2, dropped: false },
      },
    };

    applyExplicitZeroPointResult(row, 'c3', {
      resultStatus: 'dns',
      competitionName: 'Prueba 3',
    });
    applyCountingRaces(row, 3);

    expect(row.dropped_competitions).toBe(0);
    expect(row.by_competition.c3.dropped).toBe(false);
    expect(row.by_competition.c3.points).toBe(0);
    expect(row.total_points).toBe(43);
  });

  it('ausencia (sin fila) no consume descarte', () => {
    const row = {
      name: 'Piloto ausente',
      by_competition: {
        c1: { points: 10, position: 2, dropped: false },
        c2: { points: 8, position: 3, dropped: false },
      },
    };

    applyCountingRaces(row, 2);

    expect(row.total_points).toBe(18);
    expect(row.dropped_competitions).toBe(0);
    expect(row.by_competition.c3).toBeUndefined();
  });

  it('con counting_races = N elige el peor incluyendo DNS', () => {
    const row = {
      name: 'Piloto mixto',
      by_competition: {
        c1: { points: 15, position: 2, dropped: false },
        c2: { points: 6, position: 4, dropped: false },
        c3: { points: 20, position: 1, dropped: false },
      },
    };

    applyExplicitZeroPointResult(row, 'c2', {
      resultStatus: 'dns',
      competitionName: 'Prueba 2',
    });
    applyCountingRaces(row, 2);

    expect(row.by_competition.c2.points).toBe(0);
    expect(row.by_competition.c2.dropped).toBe(true);
    expect(row.by_competition.c1.dropped).toBe(false);
    expect(row.by_competition.c3.dropped).toBe(false);
    expect(row.total_points).toBe(35);
  });

  it('DSQ se trata igual que DNS respecto a descartes', () => {
    const withDns = {
      name: 'A',
      by_competition: {
        c1: { points: 25, position: 1 },
        c2: { points: 12, position: 2 },
      },
    };
    const withDsq = {
      name: 'B',
      by_competition: {
        c1: { points: 25, position: 1 },
        c2: { points: 12, position: 2 },
      },
    };

    applyExplicitZeroPointResult(withDns, 'c3', { resultStatus: 'dns', competitionName: 'P3' });
    applyExplicitZeroPointResult(withDsq, 'c3', { resultStatus: 'dsq', competitionName: 'P3' });
    applyCountingRaces(withDns, 2);
    applyCountingRaces(withDsq, 2);

    expect(isCountableZeroResultStatus('dsq')).toBe(true);
    expect(withDsq.by_competition.c3.points).toBe(0);
    expect(withDsq.by_competition.c3.dropped).toBe(true);
    expect(withDsq.total_points).toBe(withDns.total_points);
    expect(withDsq.dropped_competitions).toBe(withDns.dropped_competitions);
  });

  it('DSQ anula puntos ya registrados de esa prueba', () => {
    const row = {
      name: 'Descalificado',
      by_competition: {
        c1: { points: 25, position: 1, vehicle: 'Porsche 911', competition_name: 'Ronda 1' },
      },
    };

    applyExplicitZeroPointResult(row, 'c1', { resultStatus: 'dsq', competitionName: 'Ronda 1' });

    expect(row.by_competition.c1.points).toBe(0);
    expect(row.by_competition.c1.position).toBeNull();
    expect(row.by_competition.c1.result_status).toBe('dsq');
    expect(row.by_competition.c1.vehicle).toBe('Porsche 911');
  });

  it('DNF conserva los puntos registrados (no se reinterpreta)', () => {
    const row = {
      name: 'DNF',
      by_competition: {
        c1: { points: 4, position: 8, dropped: false },
        c2: { points: 18, position: 2, dropped: false },
        c3: { points: 10, position: 5, dropped: false },
      },
    };

    applyCountingRaces(row, 2);

    expect(row.by_competition.c1.points).toBe(4);
    expect(row.by_competition.c1.result_status).toBeUndefined();
    expect(row.by_competition.c1.dropped).toBe(true);
    expect(row.total_points).toBe(28);
  });

  it('infiere DNS si todas las rondas de la prueba son NP', () => {
    expect(
      inferResultStatusFromPointsStat({ rounds_completed: 3, rounds_dnp: 3, points: 0 }),
    ).toBe('dns');
    expect(
      inferResultStatusFromPointsStat({ rounds_completed: 3, rounds_dnp: 1, points: 8 }),
    ).toBeNull();
    expect(inferResultStatusFromPointsStat({ rounds_completed: 0, rounds_dnp: 0 })).toBeNull();
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
