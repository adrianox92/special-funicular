import { appendCatalogItemIdOnce, firstCatalogItemId } from '../../utils/vehicleCatalogItemId';

const ID = 'f837090b-c5a9-4749-a828-3d67a04f6b60';

describe('vehicleCatalogItemId', () => {
  test('prioriza catalogItemId y no duplica el campo en FormData', () => {
    const formData = new FormData();
    const appended = appendCatalogItemIdOnce(formData, ID, ID);
    expect(appended).toBe(ID);
    expect(formData.getAll('catalog_item_id')).toEqual([ID]);
  });

  test('si el estado del formulario ya trae catalog_item_id, no añade un segundo valor', () => {
    const formData = new FormData();
    appendCatalogItemIdOnce(formData, ID, ID);
    expect(formData.getAll('catalog_item_id')).toHaveLength(1);
  });

  test('firstCatalogItemId ignora vacíos y toma el primero útil', () => {
    expect(firstCatalogItemId(null, '', ID)).toBe(ID);
    expect(firstCatalogItemId([ID, ID])).toBe(ID);
  });
});
