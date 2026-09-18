const {
  parseRefsGapQuery,
  buildMissingCatalogRpcParams,
  normalizeRefsQuery,
} = require('../../lib/adminVehicleRefsQuery');

describe('adminVehicleRefsQuery', () => {
  test('sin q conserva el ranking de huecos (p_q null)', () => {
    const parsed = parseRefsGapQuery({});
    expect(parsed).toMatchObject({
      limit: 25,
      offset: 0,
      only_unlinked: false,
      q: '',
      manufacturer: '',
    });
    expect(buildMissingCatalogRpcParams(parsed)).toEqual({
      p_limit: 25,
      p_offset: 0,
      p_only_unlinked: false,
    });
  });

  test('q se normaliza con trim y se pasa a p_q (contains trim+lower en el RPC)', () => {
    const parsed = parseRefsGapQuery({ q: '  AV52802  ', only_unlinked: 'true' });
    expect(parsed.q).toBe('AV52802');
    expect(parsed.only_unlinked).toBe(true);
    expect(buildMissingCatalogRpcParams(parsed).p_q).toBe('AV52802');
  });

  test('acepta alias reference y ref (deep-link ?ref=)', () => {
    expect(parseRefsGapQuery({ reference: 'Ninco-1' }).q).toBe('Ninco-1');
    expect(parseRefsGapQuery({ ref: 'FOO' }).q).toBe('FOO');
    expect(parseRefsGapQuery({ q: 'canonical', ref: 'ignored' }).q).toBe('canonical');
  });

  test('normaliza recortando longitud máxima', () => {
    const long = 'A'.repeat(200);
    expect(normalizeRefsQuery(long)).toHaveLength(100);
  });

  test('manufacturer se normaliza y se pasa a p_manufacturer', () => {
    const parsed = parseRefsGapQuery({ manufacturer: '  Ninco  ' });
    expect(parsed.manufacturer).toBe('Ninco');
    expect(buildMissingCatalogRpcParams(parsed).p_manufacturer).toBe('Ninco');
    expect(buildMissingCatalogRpcParams(parsed).p_q).toBeUndefined();
  });

  test('acepta alias mfg y brand; manufacturer gana', () => {
    expect(parseRefsGapQuery({ mfg: 'Slot.it' }).manufacturer).toBe('Slot.it');
    expect(parseRefsGapQuery({ brand: 'Avant' }).manufacturer).toBe('Avant');
    expect(parseRefsGapQuery({ manufacturer: 'Ninco', mfg: 'ignored' }).manufacturer).toBe(
      'Ninco',
    );
  });

  test('q y manufacturer se combinan', () => {
    const parsed = parseRefsGapQuery({ q: 'AV52802', manufacturer: 'Avant Slot' });
    expect(buildMissingCatalogRpcParams(parsed)).toEqual({
      p_limit: 25,
      p_offset: 0,
      p_only_unlinked: false,
      p_q: 'AV52802',
      p_manufacturer: 'Avant Slot',
    });
  });

  test('limit/offset inválidos', () => {
    expect(parseRefsGapQuery({ limit: 'x' }).error).toMatch(/enteros/);
  });
});
