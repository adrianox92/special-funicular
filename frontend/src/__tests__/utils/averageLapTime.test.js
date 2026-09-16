import {
  averageTimeTimestamp,
  buildLapTimesFromTexts,
  buildSessionTimingPayload,
  calculateAverageTime,
  deriveCaptureFromLapTimes,
  formatSecondsToLapTime,
  getTotalTimeTooLowContext,
  isTotalTimeTooLow,
  isValidLapTime,
  MAX_SESSION_LAP_ROWS,
  mergeDerivedLapAggregates,
  parseLapTimeToSeconds,
  resizeLapTimeRows,
} from '../../utils/averageLapTime';

describe('averageLapTime', () => {
  test('parsea mm:ss.mmm a segundos', () => {
    expect(parseLapTimeToSeconds('00:11.324')).toBeCloseTo(11.324, 3);
    expect(parseLapTimeToSeconds('01:02.500')).toBeCloseTo(62.5, 3);
    expect(parseLapTimeToSeconds('bad')).toBeNull();
  });

  test('formatea segundos redondeando al ms más cercano', () => {
    expect(formatSecondsToLapTime(11.324)).toBe('00:11.324');
    expect(formatSecondsToLapTime(62.5)).toBe('01:02.500');
    // 3.335666…s → 3336 ms (antes EditVehicle hacía floor → 00:03.335)
    expect(formatSecondsToLapTime(3.3356666666666666)).toBe('00:03.336');
    expect(formatSecondsToLapTime(3.3354)).toBe('00:03.335');
    expect(formatSecondsToLapTime(59.9996)).toBe('01:00.000');
  });

  test('calcula el promedio como total / vueltas con redondeo a ms', () => {
    expect(calculateAverageTime('00:30.000', 3, '00:09.000')).toBe('00:10.000');
    expect(calculateAverageTime('02:00.000', 10, '00:11.324')).toBe('00:12.000');
    // 10.007 / 3 = 3.335666… → round 00:03.336 (floor habría sido 00:03.335)
    expect(calculateAverageTime('00:10.007', 3, '00:03.000')).toBe('00:03.336');
  });

  test('vacío si faltan datos o el formato no es mm:ss.mmm', () => {
    expect(calculateAverageTime('', 3, '00:09.000')).toBe('');
    expect(calculateAverageTime('00:30.000', 0, '00:09.000')).toBe('');
    expect(calculateAverageTime('00:30.000', 3, '')).toBe('');
    expect(calculateAverageTime('00:30.000', 3, 'bad')).toBe('');
  });

  test('detecta tiempo total por debajo del mínimo', () => {
    expect(isTotalTimeTooLow('00:20.000', 3, '00:09.000')).toBe(true);
    expect(isTotalTimeTooLow('00:30.000', 3, '00:09.000')).toBe(false);
    expect(getTotalTimeTooLowContext('00:20.000', 3, '00:09.000')).toEqual({
      total: '00:20.000',
      minimum: '00:27.000',
      laps: 3,
      bestLap: '00:09.000',
    });
    expect(getTotalTimeTooLowContext('00:30.000', 3, '00:09.000')).toBeNull();
  });

  test('averageTimeTimestamp parsea el mm:ss.mmm ya redondeado', () => {
    expect(averageTimeTimestamp('00:03.336')).toBeCloseTo(3.336, 3);
    expect(averageTimeTimestamp('bad')).toBeNull();
  });

  test('buildSessionTimingPayload usa el contrato sync y TRAINING', () => {
    const payload = buildSessionTimingPayload({
      vehicleId: 'veh-1',
      circuitId: 'cir-1',
      circuitName: 'Salón',
      lane: '2',
      bestLapTime: '00:11.324',
      totalTime: '02:00.000',
      laps: '10',
      supplyVoltageVolts: '12,5',
      timingDate: '2026-09-11',
    });

    expect(payload).toMatchObject({
      vehicle_id: 'veh-1',
      circuit_id: 'cir-1',
      circuit: 'Salón',
      lane: '2',
      best_lap_time: '00:11.324',
      total_time: '02:00.000',
      laps: 10,
      average_time: '00:12.000',
      timing_date: '2026-09-11',
      session_type: 'TRAINING',
      supply_voltage_volts: 12.5,
    });
    expect(payload.best_lap_timestamp).toBeCloseTo(11.324, 3);
    expect(payload.total_time_timestamp).toBe(120);
    expect(payload.average_time_timestamp).toBe(12);
    expect(payload).not.toHaveProperty('lap_times');
  });

  test('buildSessionTimingPayload omite lap_times vacíos o inválidos', () => {
    const emptyRows = buildSessionTimingPayload({
      vehicleId: 'veh-1',
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
      laps: '3',
      lapTimes: ['', '', ''],
    });
    expect(emptyRows).not.toHaveProperty('lap_times');

    const mixed = buildSessionTimingPayload({
      vehicleId: 'veh-1',
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
      laps: '3',
      lapTimes: ['00:09.000', 'bad', '00:11.000'],
    });
    expect(mixed.lap_times).toEqual([
      {
        lap_number: 1,
        time_seconds: 9,
        lap_time_seconds: 9,
        time_text: '00:09.000',
      },
      {
        lap_number: 3,
        time_seconds: 11,
        lap_time_seconds: 11,
        time_text: '00:11.000',
      },
    ]);
  });

  test('buildSessionTimingPayload incluye lap_times válidos', () => {
    const payload = buildSessionTimingPayload({
      vehicleId: 'veh-1',
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
      laps: '3',
      lapTimes: ['00:09.000', '00:10.000', '00:11.000'],
    });
    expect(payload.session_type).toBe('TRAINING');
    expect(payload.lap_times).toHaveLength(3);
    expect(payload.lap_times[0]).toEqual({
      lap_number: 1,
      time_seconds: 9,
      lap_time_seconds: 9,
      time_text: '00:09.000',
    });
    expect(payload.lap_times[1].time_seconds).toBe(10);
    expect(payload.lap_times[2].lap_number).toBe(3);
  });

  test('resizeLapTimeRows alinea filas al número de vueltas y conserva valores', () => {
    expect(resizeLapTimeRows(['00:09.000'], 3)).toEqual(['00:09.000', '', '']);
    expect(resizeLapTimeRows(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b']);
    expect(resizeLapTimeRows(['a', 'b'], '')).toEqual(['a', 'b']);
    expect(resizeLapTimeRows(undefined, 2)).toEqual(['', '']);
    expect(resizeLapTimeRows(['x'], 200).length).toBe(MAX_SESSION_LAP_ROWS);
  });

  test('buildLapTimesFromTexts y deriveCaptureFromLapTimes', () => {
    expect(buildLapTimesFromTexts(['00:09.000', '', '00:11.000'])).toEqual([
      { lap_number: 1, time_seconds: 9, lap_time_seconds: 9, time_text: '00:09.000' },
      { lap_number: 3, time_seconds: 11, lap_time_seconds: 11, time_text: '00:11.000' },
    ]);
    expect(deriveCaptureFromLapTimes(['00:09.000', ''])).toBeNull();
    expect(deriveCaptureFromLapTimes(['00:09.000', '00:10.000', '00:11.000'])).toEqual({
      laps: 3,
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
      averageTime: '00:10.000',
    });
  });

  test('mergeDerivedLapAggregates rellena vacíos y no pisa lo escrito a mano', () => {
    const filled = mergeDerivedLapAggregates(
      { bestLapTime: '', totalTime: '', laps: '', lapTimes: [] },
      ['00:09.000', '00:10.000', '00:11.000'],
    );
    expect(filled.bestLapTime).toBe('00:09.000');
    expect(filled.totalTime).toBe('00:30.000');
    expect(filled.laps).toBe('3');

    const kept = mergeDerivedLapAggregates(
      { bestLapTime: '00:08.500', totalTime: '00:40.000', laps: '3' },
      ['00:09.000', '00:10.000', '00:11.000'],
    );
    expect(kept.bestLapTime).toBe('00:08.500');
    expect(kept.totalTime).toBe('00:40.000');
    expect(kept.laps).toBe('3');

    const updatedFromUs = mergeDerivedLapAggregates(filled, ['00:09.000', '00:10.000', '00:12.000']);
    expect(updatedFromUs.bestLapTime).toBe('00:09.000');
    expect(updatedFromUs.totalTime).toBe('00:31.000');
    expect(updatedFromUs.laps).toBe('3');
  });

  test('isValidLapTime', () => {
    expect(isValidLapTime('00:11.324')).toBe(true);
    expect(isValidLapTime('11.324')).toBe(false);
  });
});
