const { parseCatalogItemId } = require('../../lib/parseCatalogItemId');

const ID = 'f837090b-c5a9-4749-a828-3d67a04f6b60';

describe('parseCatalogItemId', () => {
  test('acepta un UUID suelto', () => {
    expect(parseCatalogItemId(ID)).toEqual({ value: ID });
  });

  test('si Multer duplica el campo, usa el primer UUID del array', () => {
    expect(parseCatalogItemId([ID, ID])).toEqual({ value: ID });
  });

  test('si String(array) llegó como "uuid,uuid", extrae el primer UUID', () => {
    expect(parseCatalogItemId(`${ID},${ID}`)).toEqual({ value: ID });
  });

  test('vacío o null no es error', () => {
    expect(parseCatalogItemId(null)).toEqual({ value: null });
    expect(parseCatalogItemId('')).toEqual({ value: null });
    expect(parseCatalogItemId(['', null])).toEqual({ value: null });
  });

  test('rechaza un valor que no es UUID', () => {
    expect(parseCatalogItemId('SC6378')).toEqual({
      error: 'catalog_item_id no es un UUID válido',
    });
  });
});
