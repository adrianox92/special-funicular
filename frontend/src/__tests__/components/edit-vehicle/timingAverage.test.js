import { calculateAverageTime, averageTimeTimestamp } from '../../../components/edit-vehicle/timingAverage';

describe('timingAverage (EditVehicle)', () => {
  test('promedio = total / vueltas con formato floor original', () => {
    expect(calculateAverageTime('00:30.000', 3, '00:09.000')).toBe('00:10.000');
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
      message: expect.stringContaining('edit.errors.totalTimeTooLow'),
    });

    setTimingNotice.mockClear();
    calculateAverageTime('00:30.000', 3, '00:09.000', { t, setTimingNotice });
    expect(setTimingNotice).toHaveBeenCalledWith(null);
  });

  test('averageTimeTimestamp parsea mm:ss.mmm', () => {
    expect(averageTimeTimestamp('00:10.000')).toBe(10);
    expect(averageTimeTimestamp('bad')).toBeNull();
  });
});
