import {
  averageTimeTimestamp,
  buildSessionTimingPayload,
  calculateAverageTime,
  formatSecondsToLapTime,
  getTotalTimeTooLowContext,
  isTotalTimeTooLow,
  isValidLapTime,
  parseLapTimeToSeconds,
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
  });

  test('isValidLapTime', () => {
    expect(isValidLapTime('00:11.324')).toBe(true);
    expect(isValidLapTime('11.324')).toBe(false);
  });
});
