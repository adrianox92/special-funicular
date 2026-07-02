import { findNextPilot } from './findNextPilot';

const mkParticipant = (id, { start_order, created_at, rounds = [] } = {}) => ({
  id,
  driver_name: `Pilot ${id}`,
  start_order,
  created_at: created_at ?? '2026-01-01T00:00:00.000Z',
  position: 1,
  rounds,
});

describe('findNextPilot', () => {
  it('elige el pendiente con menor start_order, no el primero del ranking', () => {
    const participants = [
      mkParticipant('a', { start_order: 3 }),
      mkParticipant('b', { start_order: 1 }),
      mkParticipant('c', { start_order: 2 }),
    ];

    const result = findNextPilot(participants, 2);
    expect(result?.participant.id).toBe('b');
    expect(result?.roundNumber).toBe(1);
  });

  it('usa created_at como fallback cuando start_order es null', () => {
    const participants = [
      mkParticipant('late', { start_order: null, created_at: '2026-01-03T00:00:00.000Z' }),
      mkParticipant('early', { start_order: null, created_at: '2026-01-01T00:00:00.000Z' }),
    ];

    const result = findNextPilot(participants, 1);
    expect(result?.participant.id).toBe('early');
  });

  it('salta pilotos que ya completaron la ronda actual', () => {
    const participants = [
      mkParticipant('first', {
        start_order: 1,
        rounds: [{ round_number: 1, did_not_participate: false, time_timestamp: 65.2 }],
      }),
      mkParticipant('second', { start_order: 2 }),
    ];

    const result = findNextPilot(participants, 2);
    expect(result?.participant.id).toBe('second');
    expect(result?.roundNumber).toBe(1);
  });
});
