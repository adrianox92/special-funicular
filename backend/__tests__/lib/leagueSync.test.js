'use strict';

const {
  buildParticipantIndex,
  resolveFromIndex,
  registerImportCandidate,
} = require('../../lib/leagueSync');
const { participantMatchKey } = require('../../lib/leagueStandings');

describe('leagueSync — importación inversa', () => {
  it('empareja participantes existentes por nombre sin email', () => {
    const index = buildParticipantIndex([
      { id: 'lp-1', name: 'Juan Pérez', email: null },
    ]);

    const found = resolveFromIndex(index, 'Juan Pérez', 'juan@test.com');
    expect(found?.id).toBe('lp-1');
  });

  it('fusiona candidatos duplicados entre competiciones', () => {
    const candidates = new Map();
    const keyAliases = new Map();

    registerImportCandidate(candidates, keyAliases, {
      name: 'Ana Ruiz',
      email: null,
      vehicle_model: 'BMW M3',
    });
    registerImportCandidate(candidates, keyAliases, {
      name: 'Ana Ruiz',
      email: 'ana@test.com',
      vehicle_id: 'veh-1',
    });

    expect(candidates.size).toBe(1);
    const entry = [...candidates.values()][0];
    expect(entry.email).toBe('ana@test.com');
    expect(entry.vehicle_id).toBe('veh-1');
    expect(entry.vehicle_model).toBe('BMW M3');
  });

  it('no duplica cuando la 3ª competición aporta email tras fusionar sin email', () => {
    const candidates = new Map();
    const keyAliases = new Map();

    registerImportCandidate(candidates, keyAliases, {
      name: 'Adrian Palomera',
      email: null,
      vehicle_model: 'BMW',
    });
    registerImportCandidate(candidates, keyAliases, {
      name: 'Adrian Palomera',
      email: 'adrian@test.com',
      vehicle_model: 'Porsche',
    });
    registerImportCandidate(candidates, keyAliases, {
      name: 'Adrian Palomera',
      email: 'adrian@test.com',
      vehicle_model: 'Audi',
    });

    expect(candidates.size).toBe(1);
    const entry = [...candidates.values()][0];
    expect(entry.email).toBe('adrian@test.com');
    expect(entry.vehicle_model).toBe('BMW');
  });

  it('trata variantes de espacios como el mismo piloto', () => {
    const candidates = new Map();
    const keyAliases = new Map();

    registerImportCandidate(candidates, keyAliases, {
      name: 'Adrian  Palomera',
      email: null,
    });
    registerImportCandidate(candidates, keyAliases, {
      name: 'Adrian Palomera',
      email: 'adrian@test.com',
    });

    expect(candidates.size).toBe(1);
    expect(participantMatchKey('Adrian  Palomera', null)).toBe(
      participantMatchKey('Adrian Palomera', null),
    );
  });

  it('no duplica candidatos con el mismo nombre y email', () => {
    const candidates = new Map();
    const keyAliases = new Map();

    registerImportCandidate(candidates, keyAliases, {
      name: 'Luis',
      email: 'luis@test.com',
      vehicle_model: 'Ford GT',
    });
    registerImportCandidate(candidates, keyAliases, {
      name: 'Luis',
      email: 'luis@test.com',
      vehicle_model: 'Porsche 911',
    });

    expect(candidates.size).toBe(1);
    expect([...candidates.values()][0].vehicle_model).toBe('Ford GT');
  });
});
