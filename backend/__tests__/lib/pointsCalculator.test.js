'use strict';

const {
  calculatePoints,
  getPointsForPosition,
  sortTimingsByTotalTime,
  awardPowerStagePointsForRound,
} = require('../../lib/pointsCalculator');

describe('pointsCalculator — Power Stage', () => {
  const participants = [
    { id: 'p1', driver_name: 'Ana' },
    { id: 'p2', driver_name: 'Bruno' },
    { id: 'p3', driver_name: 'Carlos' },
  ];

  const powerStageRule = {
    rule_type: 'power_stage',
    target_rounds: [2],
    points_structure: { 1: 5, 2: 3, 3: 1 },
  };

  it('otorga puntos por posición según el tiempo total de la ronda', () => {
    const timings = [
      {
        participant_id: 'p1',
        round_number: 2,
        best_lap_time: '00:12.500',
        total_time: '01:00.000',
      },
      {
        participant_id: 'p2',
        round_number: 2,
        best_lap_time: '00:11.900',
        total_time: '01:10.000',
      },
      {
        participant_id: 'p3',
        round_number: 2,
        best_lap_time: '00:12.100',
        total_time: '00:50.000',
      },
    ];

    const result = calculatePoints({
      competition: { rounds: 2 },
      participants,
      timings,
      rules: [powerStageRule],
    });

    expect(result.pointsByParticipant.p3).toBe(5);
    expect(result.pointsByParticipant.p1).toBe(3);
    expect(result.pointsByParticipant.p2).toBe(1);

    const byId = Object.fromEntries(
      result.participantStats.map((s) => [s.participant_id, s.power_stage_points]),
    );
    expect(byId.p3).toBe(5);
    expect(byId.p1).toBe(3);
    expect(byId.p2).toBe(1);
  });

  it('usa el tiempo total, no la mejor vuelta, para clasificar el Power Stage', () => {
    const timings = [
      {
        participant_id: 'p1',
        round_number: 2,
        best_lap_time: '00:12.000',
        total_time: '00:40.000',
      },
      {
        participant_id: 'p2',
        round_number: 2,
        best_lap_time: '00:11.000',
        total_time: '00:50.000',
      },
    ];

    const pointsByParticipant = { p1: 0, p2: 0 };
    const powerStagePointsByParticipant = { p1: 0, p2: 0 };
    const timesByParticipant = {
      p1: [timings[0]],
      p2: [timings[1]],
    };

    awardPowerStagePointsForRound({
      participants: participants.slice(0, 2),
      timesByParticipant,
      round: 2,
      powerStageRule,
      pointsByParticipant,
      powerStagePointsByParticipant,
    });

    expect(pointsByParticipant.p1).toBe(5);
    expect(pointsByParticipant.p2).toBe(3);
  });

  it('incluye penalizaciones en el tiempo total del Power Stage', () => {
    const pointsByParticipant = { p1: 0, p2: 0 };
    const powerStagePointsByParticipant = { p1: 0, p2: 0 };

    awardPowerStagePointsForRound({
      participants: participants.slice(0, 2),
      timesByParticipant: {
        p1: [
          {
            participant_id: 'p1',
            round_number: 2,
            total_time: '00:30.000',
            penalty_seconds: 5,
          },
        ],
        p2: [
          {
            participant_id: 'p2',
            round_number: 2,
            total_time: '00:32.000',
            penalty_seconds: 0,
          },
        ],
      },
      round: 2,
      powerStageRule,
      pointsByParticipant,
      powerStagePointsByParticipant,
    });

    expect(pointsByParticipant.p2).toBe(5);
    expect(pointsByParticipant.p1).toBe(3);
  });

  it('ignora participantes sin tiempo total válido', () => {
    const pointsByParticipant = { p1: 0, p2: 0 };
    const powerStagePointsByParticipant = { p1: 0, p2: 0 };

    awardPowerStagePointsForRound({
      participants: participants.slice(0, 2),
      timesByParticipant: {
        p1: [
          {
            participant_id: 'p1',
            round_number: 2,
            best_lap_time: '00:11.000',
            total_time: '00:00.000',
          },
        ],
        p2: [
          {
            participant_id: 'p2',
            round_number: 2,
            best_lap_time: '00:12.000',
            total_time: '01:10.000',
          },
        ],
      },
      round: 2,
      powerStageRule,
      pointsByParticipant,
      powerStagePointsByParticipant,
    });

    expect(pointsByParticipant.p1).toBe(0);
    expect(pointsByParticipant.p2).toBe(5);
  });

  it('ordena posiciones de puntos numéricamente aunque las claves vengan desordenadas', () => {
    expect(getPointsForPosition({ 3: 1, 1: 5, 2: 3 }, 1)).toBe(5);
    expect(getPointsForPosition({ 3: 1, 1: 5, 2: 3 }, 2)).toBe(3);
  });

  it('sortTimingsByTotalTime coloca el tiempo total más bajo primero', () => {
    const sorted = sortTimingsByTotalTime([
      { participant_id: 'p1', total_time: '01:00.000' },
      { participant_id: 'p2', total_time: '00:50.000' },
      { participant_id: 'p3', total_time: '00:55.000' },
    ]);

    expect(sorted.map((t) => t.participant_id)).toEqual(['p2', 'p3', 'p1']);
  });
});
