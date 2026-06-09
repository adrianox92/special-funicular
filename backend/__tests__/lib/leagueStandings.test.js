'use strict';

const {
  participantMatchKey,
  registerStandingsEntry,
  resolveParticipantKey,
} = require('../../lib/leagueStandings');

describe('leagueStandings — emparejamiento de participantes', () => {
  it('genera claves distintas con y sin email', () => {
    expect(participantMatchKey('Juan Pérez', null)).toBe('juan pérez');
    expect(participantMatchKey('Juan Pérez', 'juan@test.com')).toBe('juan pérez|juan@test.com');
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
    expect(standingsMap.has('juan pérez|juan@test.com')).toBe(false);
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
