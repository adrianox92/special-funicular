import {
  looksLikeCatalogReference,
  looksLikeVehicleName,
  detectSwappedVehicleFields,
  fieldsForCatalogSearch,
  swapModelAndReference,
} from '../../utils/vehicleFieldSwap';

describe('vehicleFieldSwap', () => {
  test('detecta código de referencia vs nombre largo', () => {
    expect(looksLikeCatalogReference('U10522S300')).toBe(true);
    expect(looksLikeCatalogReference('27131')).toBe(true);
    expect(looksLikeCatalogReference('CUPRA LEÓN COMPETICIÓN - J. FILIPPI')).toBe(false);
    expect(looksLikeVehicleName('CUPRA LEÓN COMPETICIÓN - J. FILIPPI')).toBe(true);
    expect(looksLikeVehicleName('U10522S300')).toBe(false);
  });

  test('detectSwappedVehicleFields en el caso real Scaleauto/Cupra', () => {
    expect(
      detectSwappedVehicleFields({
        model: 'U10522S300',
        reference: 'CUPRA LEÓN COMPETICIÓN - J. FILIPPI',
      }),
    ).toBe(true);
    expect(
      detectSwappedVehicleFields({
        model: 'CUPRA LEÓN COMPETICIÓN - J. FILIPPI',
        reference: 'U10522S300',
      }),
    ).toBe(false);
  });

  test('fieldsForCatalogSearch usa los valores intercambiados para buscar', () => {
    const fields = fieldsForCatalogSearch({
      manufacturer: 'Scaleauto',
      model: 'U10522S300',
      reference: 'CUPRA LEÓN COMPETICIÓN - J. FILIPPI',
    });
    expect(fields.swapped).toBe(true);
    expect(fields.reference).toBe('U10522S300');
    expect(fields.model).toBe('CUPRA LEÓN COMPETICIÓN - J. FILIPPI');
    expect(fields.manufacturer).toBe('Scaleauto');
  });

  test('si el modelo parece referencia y la referencia está vacía, busca por referencia', () => {
    const fields = fieldsForCatalogSearch({
      manufacturer: 'NSR',
      model: '0135AW',
      reference: '',
    });
    expect(fields.swapped).toBe(false);
    expect(fields.reference).toBe('0135AW');
    expect(fields.model).toBe('');
  });

  test('swapModelAndReference intercambia sin tocar el resto', () => {
    expect(
      swapModelAndReference({
        manufacturer: 'NSR',
        model: '0135AW',
        reference: 'Audi R8 LMS',
        type: 'GT',
      }),
    ).toEqual({
      manufacturer: 'NSR',
      model: 'Audi R8 LMS',
      reference: '0135AW',
      type: 'GT',
    });
  });
});
