import { buildTractionFilterOptions } from '../../utils/catalogFilterSlugs';

function t(key, opts) {
  if (key === 'values.traction.4WD') return '4WD';
  if (key === 'values.traction.RWD') return 'Trasera';
  if (key === 'values.traction.Trasera') return 'Trasera';
  return opts?.defaultValue ?? key;
}

describe('buildTractionFilterOptions', () => {
  test('traduce facetas string con t, sin sombrear el traductor', () => {
    const options = buildTractionFilterOptions(['4WD', 'RWD', 'Trasera'], null, t);

    expect(options).toEqual([
      { slug: '4wd', label: '4WD' },
      { slug: 'rwd', label: 'Trasera' },
      { slug: 'trasera', label: 'Trasera' },
    ]);
  });

  test('acepta facetas objeto { name } y añade el slug activo si falta', () => {
    const options = buildTractionFilterOptions([{ name: '4WD' }], 'fwd', t);

    expect(options).toEqual([
      { slug: '4wd', label: '4WD' },
      { slug: 'fwd', label: 'FWD' },
    ]);
  });

  test('lanza TypeError si el callback del map sombrea t (regresión de producción)', () => {
    expect(() => {
      ['4WD'].map((t) => t('values.traction.4WD', { defaultValue: '4WD' }));
    }).toThrow(TypeError);
    expect(() => buildTractionFilterOptions(['4WD'], null, t)).not.toThrow();
  });
});
