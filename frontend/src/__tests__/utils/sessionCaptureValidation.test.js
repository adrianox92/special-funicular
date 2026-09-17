import {
  getSessionCaptureIssue,
  isBlockingCaptureIssue,
} from '../../utils/sessionCaptureValidation';

describe('sessionCaptureValidation', () => {
  test('pide mejor vuelta si falta', () => {
    expect(getSessionCaptureIssue({ totalTime: '00:30.000', laps: '3' })).toEqual({
      field: 'bestLapTime',
      code: 'requiredBest',
    });
  });

  test('rechaza mejor vuelta con formato inválido y conserva el resto', () => {
    const issue = getSessionCaptureIssue({
      bestLapTime: 'bad',
      totalTime: '00:30.000',
      laps: '3',
    });
    expect(issue).toEqual({ field: 'bestLapTime', code: 'invalidBest' });
    expect(isBlockingCaptureIssue(issue)).toBe(true);
  });

  test('pide vueltas si faltan', () => {
    expect(getSessionCaptureIssue({
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
    })).toEqual({ field: 'laps', code: 'requiredLaps' });
  });

  test('rechaza voltaje fuera de rango', () => {
    expect(getSessionCaptureIssue({
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
      laps: '3',
      supplyVoltageVolts: '99',
    })).toEqual({
      field: 'supplyVoltageVolts',
      code: 'invalidVoltage',
      openMore: true,
    });
  });

  test('total demasiado bajo avisa pero no bloquea', () => {
    const issue = getSessionCaptureIssue({
      bestLapTime: '00:09.000',
      totalTime: '00:20.000',
      laps: '3',
    });
    expect(issue.code).toBe('totalTooLow');
    expect(issue.params).toMatchObject({
      total: '00:20.000',
      minimum: '00:27.000',
      laps: 3,
      bestLap: '00:09.000',
    });
    expect(isBlockingCaptureIssue(issue)).toBe(false);
  });

  test('captura válida sin avisos aunque haya vueltas individuales vacías', () => {
    expect(getSessionCaptureIssue({
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
      laps: '3',
    })).toBeNull();
    expect(getSessionCaptureIssue({
      bestLapTime: '00:09.000',
      totalTime: '00:30.000',
      laps: '3',
      lapTimes: ['', '', ''],
    })).toBeNull();
  });
});
