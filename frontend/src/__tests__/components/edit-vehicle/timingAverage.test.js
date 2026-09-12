import { calculateAverageTime, averageTimeTimestamp } from '../../../components/edit-vehicle/timingAverage';
import { calculateAverageTime as sharedCalculateAverageTime } from '../../../utils/averageLapTime';

describe('timingAverage (EditVehicle)', () => {
  test('delega el promedio en el helper compartido (redondeo a ms)', () => {
    expect(calculateAverageTime('00:30.000', 3, '00:09.000')).toBe('00:10.000');
    expect(calculateAverageTime('00:10.007', 3, '00:03.000')).toBe('00:03.336');
  });

  test('mismos inputs que NewSession producen el mismo average_time', () => {
    const cases = [
      ['00:30.000', 3, '00:09.000'],
      ['00:10.007', 3, '00:03.000'],
      ['02:00.000', 10, '00:11.324'],
      ['00:20.000', 3, '00:09.000'],
      ['01:02.501', 7, '00:08.900'],
    ];
    cases.forEach((args) => {
      expect(calculateAverageTime(...args)).toBe(sharedCalculateAverageTime(...args));
    });
  });

  test('vacío si faltan datos', () => {
    expect(calculateAverageTime('', 3, '00:09.000')).toBe('');
    expect(calculateAverageTime('00:30.000', 0, '00:09.000')).toBe('');
    expect(calculateAverageTime('00:30.000', 3, '')).toBe('');
  });

  test('avisa si el total es menor que best * vueltas y limpia el aviso si es válido', () => {
    const setTimingNotice = jest.fn();
    const t = (key, vars) => `${key}:${vars.minimum}`;

    calculateAverageTime('00:20.000', 3, '00:09.000', { t, setTimingNotice });
    expect(setTimingNotice).toHaveBeenCalledWith({
      variant: 'warning',
      message: 'edit.errors.totalTimeTooLow:00:27.000',
    });

    setTimingNotice.mockClear();
    calculateAverageTime('00:30.000', 3, '00:09.000', { t, setTimingNotice });
    expect(setTimingNotice).toHaveBeenCalledWith(null);
  });

  test('no toca el aviso si faltan datos para calcular', () => {
    const setTimingNotice = jest.fn();
    const t = (key) => key;
    calculateAverageTime('', 3, '00:09.000', { t, setTimingNotice });
    expect(setTimingNotice).not.toHaveBeenCalled();
  });

  test('averageTimeTimestamp parsea mm:ss.mmm', () => {
    expect(averageTimeTimestamp('00:10.000')).toBe(10);
    expect(averageTimeTimestamp('bad')).toBeNull();
  });
});
