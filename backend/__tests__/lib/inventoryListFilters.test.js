const {
  applyInventoryItemListFilters,
  applyInventoryPartListFilters,
  applyInventoryItemPostFilters,
  applyInventoryPartPostFilters,
  inventoryItemNeedsPostFilter,
  inventoryPartNeedsPostFilter,
  parseInventoryListPagination,
  buildInventoryPagination,
} = require('../../lib/inventoryListFilters');

function createQuery() {
  const query = {
    ilike: jest.fn(function ilike() {
      return query;
    }),
    eq: jest.fn(function eq() {
      return query;
    }),
    or: jest.fn(function or() {
      return query;
    }),
    not: jest.fn(function not() {
      return query;
    }),
    gt: jest.fn(function gt() {
      return query;
    }),
  };
  return query;
}

describe('applyInventoryItemListFilters', () => {
  test('sin filtros no toca el builder', () => {
    const query = createQuery();
    const result = applyInventoryItemListFilters(query, {});
    expect(result).toBe(query);
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.or).not.toHaveBeenCalled();
    expect(query.not).not.toHaveBeenCalled();
    expect(query.gt).not.toHaveBeenCalled();
  });

  test('un solo filtro (categoría) usa eq', () => {
    const query = createQuery();
    applyInventoryItemListFilters(query, { category: 'pinion' });
    expect(query.eq).toHaveBeenCalledWith('category', 'pinion');
    expect(query.or).not.toHaveBeenCalled();
  });

  test('varios filtros se combinan (AND) y q busca nombre y referencia', () => {
    const query = createQuery();
    applyInventoryItemListFilters(query, {
      category: 'motor',
      vehicle_id: 'veh-1',
      q: 'Slot',
    });
    expect(query.eq).toHaveBeenCalledWith('category', 'motor');
    expect(query.eq).toHaveBeenCalledWith('vehicle_id', 'veh-1');
    expect(query.or).toHaveBeenCalledWith('name.ilike.%Slot%,reference.ilike.%Slot%');
  });

  test('low_stock aplica min_stock IS NOT NULL', () => {
    const query = createQuery();
    applyInventoryItemListFilters(query, { low_stock: 'true' });
    expect(query.not).toHaveBeenCalledWith('min_stock', 'is', null);
  });

  test('in_stock aplica quantity > 0 en SQL', () => {
    const query = createQuery();
    applyInventoryItemListFilters(query, { in_stock: 'true' });
    expect(query.gt).toHaveBeenCalledWith('quantity', 0);
    expect(query.not).not.toHaveBeenCalled();
  });
});

describe('applyInventoryPartListFilters', () => {
  test('q incluye fabricante', () => {
    const query = createQuery();
    applyInventoryPartListFilters(query, { q: 'Ninco' });
    expect(query.or).toHaveBeenCalledWith(
      'name.ilike.%Ninco%,reference.ilike.%Ninco%,manufacturer.ilike.%Ninco%',
    );
  });
});

describe('post-filtros y paginación', () => {
  test('low_stock de ítems compara quantity <= min_stock', () => {
    const rows = [
      { id: 'a', quantity: 1, min_stock: 2 },
      { id: 'b', quantity: 5, min_stock: 2 },
      { id: 'c', quantity: 0, min_stock: null },
    ];
    expect(applyInventoryItemPostFilters(rows, { low_stock: 'true' }).map((r) => r.id)).toEqual([
      'a',
    ]);
    expect(inventoryItemNeedsPostFilter({ low_stock: 'true' })).toBe(true);
    expect(inventoryItemNeedsPostFilter({})).toBe(false);
  });

  test('piezas: low_stock y only_mounted sobre la vista ensamblada', () => {
    const views = [
      { part: { id: '1' }, low_stock: true, mounted_qty: 0 },
      { part: { id: '2' }, low_stock: false, mounted_qty: 2 },
      { part: { id: '3' }, low_stock: true, mounted_qty: 1 },
    ];
    expect(
      applyInventoryPartPostFilters(views, { low_stock: 'true' }).map((v) => v.part.id),
    ).toEqual(['1', '3']);
    expect(
      applyInventoryPartPostFilters(views, { only_mounted: 'true' }).map((v) => v.part.id),
    ).toEqual(['2', '3']);
    expect(inventoryPartNeedsPostFilter({ only_mounted: '1' })).toBe(true);
  });

  test('parseInventoryListPagination: sin page/limit no pagina; página 2 usa from 10', () => {
    expect(parseInventoryListPagination({}).paginate).toBe(false);
    expect(parseInventoryListPagination({ page: '2', limit: '10' })).toEqual({
      paginate: true,
      page: 2,
      limit: 10,
      from: 10,
      to: 19,
    });
    expect(buildInventoryPagination(23, 2, 10)).toEqual({
      total: 23,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });
});
