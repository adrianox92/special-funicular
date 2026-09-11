import { buildInventoryListQueryParams } from '../../utils/inventoryListQuery';

describe('inventoryListQuery', () => {
  test('sin filtros solo envía page y limit', () => {
    expect(buildInventoryListQueryParams({ page: 1, limit: 25 })).toEqual({
      page: 1,
      limit: 25,
    });
  });

  test('un filtro y varios filtros generan los mismos nombres que el API', () => {
    expect(
      buildInventoryListQueryParams({ page: 1, limit: 25, category: 'pinion' }),
    ).toEqual({
      page: 1,
      limit: 25,
      category: 'pinion',
    });

    expect(
      buildInventoryListQueryParams({
        page: 2,
        limit: 50,
        category: 'motor',
        lowStock: true,
        q: 'Slot',
        onlyMounted: true,
      }),
    ).toEqual({
      page: 2,
      limit: 50,
      category: 'motor',
      low_stock: 'true',
      q: 'Slot',
      only_mounted: 'true',
    });
  });
});
