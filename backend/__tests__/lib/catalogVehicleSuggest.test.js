const {
  detectSwappedVehicleFields,
  fieldsForCatalogSearch,
  shouldSearchCatalog,
  scoreCatalogSuggestion,
  groupCatalogVariants,
  variantBits,
} = require('../../lib/catalogVehicleSuggest');

describe('catalogVehicleSuggest', () => {
  test('detecta campos intercambiados y los usa para la búsqueda', () => {
    expect(
      detectSwappedVehicleFields({
        model: 'U10522S300',
        reference: 'CUPRA LEÓN COMPETICIÓN - J. FILIPPI',
      }),
    ).toBe(true);
    const fields = fieldsForCatalogSearch({
      manufacturer: 'Scaleauto',
      model: 'U10522S300',
      reference: 'CUPRA LEÓN COMPETICIÓN - J. FILIPPI',
    });
    expect(fields.reference).toBe('U10522S300');
    expect(fields.model).toContain('CUPRA');
    expect(shouldSearchCatalog(fields)).toBe(true);
  });

  test('no busca solo con la marca', () => {
    expect(shouldSearchCatalog({ manufacturer: 'NSR', model: '', reference: '' })).toBe(false);
  });

  test('prioriza coincidencia exacta de referencia y marca', () => {
    const query = { manufacturer: 'NSR', model: 'Audi R8', reference: '0135AW' };
    const exact = scoreCatalogSuggestion(
      { reference: '0135AW', manufacturer: 'NSR', model_name: 'Audi R8 LMS AW' },
      query,
    );
    const other = scoreCatalogSuggestion(
      { reference: '9999', manufacturer: 'Carrera', model_name: 'Porsche' },
      query,
    );
    expect(exact).toBeGreaterThan(other);
    expect(exact).toBeGreaterThan(100);
  });

  test('agrupa variantes AW/SW para mostrarlas juntas', () => {
    const grouped = groupCatalogVariants([
      {
        id: '1',
        manufacturer: 'NSR',
        reference: '0135AW',
        model_name: 'Audi R8 LMS AW',
        score: 80,
      },
      {
        id: '2',
        manufacturer: 'NSR',
        reference: '0135SW',
        model_name: 'Audi R8 LMS SW',
        score: 78,
      },
    ]);
    expect(grouped.groups).toHaveLength(1);
    expect(grouped.groups[0].variant_group).toBe(true);
    expect(grouped.groups[0].items.map((i) => i.reference)).toEqual(['0135AW', '0135SW']);
  });

  test('variantBits extrae AW/SW y tracción', () => {
    const bits = variantBits({
      traction: '4x4',
      reference: '0135AW',
      model_name: 'Audi R8 LMS AW',
    });
    expect(bits).toEqual(expect.arrayContaining(['4x4', 'AW']));
  });
});
