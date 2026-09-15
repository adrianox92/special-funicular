import {
  getModificationSaveDialogInfo,
  inventoryCategoryToVehicleType,
  inventoryPickerRequestParams,
  INVENTORY_PICKER_PAGE_SIZE,
  parseInventoryPickerResponse,
  vehicleSpecSnapshotsDiffer,
} from '../../../components/edit-vehicle/specSnapshot';

function spec(overrides = {}) {
  return {
    component_type: 'pinion',
    element: 'Piñón 9',
    manufacturer: 'Slot.it',
    material: 'aluminio',
    size: '',
    teeth: 9,
    color: '',
    rpm: '',
    gaus: '',
    price: 4.5,
    url: '',
    sku: 'P9',
    description: '',
    mounted_qty: '1',
    ...overrides,
  };
}

describe('specSnapshot', () => {
  test('inventoryCategoryToVehicleType mapea otro → other', () => {
    expect(inventoryCategoryToVehicleType('otro')).toBe('other');
    expect(inventoryCategoryToVehicleType('motor')).toBe('motor');
  });

  test('inventoryPickerRequestParams siempre incluye page, limit e in_stock', () => {
    expect(inventoryPickerRequestParams('')).toEqual({
      page: 1,
      limit: INVENTORY_PICKER_PAGE_SIZE,
      in_stock: 'true',
    });
    expect(inventoryPickerRequestParams(undefined)).toEqual({
      page: 1,
      limit: INVENTORY_PICKER_PAGE_SIZE,
      in_stock: 'true',
    });
    expect(inventoryPickerRequestParams('motor')).toEqual({
      page: 1,
      limit: INVENTORY_PICKER_PAGE_SIZE,
      category: 'motor',
      in_stock: 'true',
    });
    expect(inventoryPickerRequestParams('other')).toEqual({
      page: 1,
      limit: INVENTORY_PICKER_PAGE_SIZE,
      category: 'otro',
      in_stock: 'true',
    });
    expect(
      inventoryPickerRequestParams('motor', { page: 2, limit: 25, q: 'Slot' }),
    ).toEqual({
      page: 2,
      limit: 25,
      category: 'motor',
      q: 'Slot',
      in_stock: 'true',
    });
  });

  test('parseInventoryPickerResponse usa items paginados y omite cantidad 0', () => {
    const parsed = parseInventoryPickerResponse(
      {
        items: [
          { id: 'a', quantity: 2 },
          { id: 'b', quantity: 0 },
          { id: 'c', quantity: 1 },
        ],
        pagination: { total: 26, page: 1, limit: 25, totalPages: 2 },
      },
      { page: 1, limit: 25 },
    );
    expect(parsed.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(parsed.pagination).toEqual({ total: 26, page: 1, limit: 25, totalPages: 2 });
  });

  test('vehicleSpecSnapshotsDiffer ignora equivalentes numéricos/string', () => {
    expect(vehicleSpecSnapshotsDiffer(spec({ teeth: 9 }), spec({ teeth: '9' }))).toBe(false);
    expect(vehicleSpecSnapshotsDiffer(spec({ teeth: 9 }), spec({ teeth: 10 }))).toBe(true);
  });

  test('getModificationSaveDialogInfo: misma pieza y más cantidad → save_direct', () => {
    const info = getModificationSaveDialogInfo(spec({ mounted_qty: '1' }), spec({ mounted_qty: '3' }));
    expect(info).toEqual({ mode: 'save_direct' });
  });

  test('getModificationSaveDialogInfo: misma pieza y menos cantidad → ask return delta', () => {
    const info = getModificationSaveDialogInfo(spec({ mounted_qty: '4' }), spec({ mounted_qty: '2' }));
    expect(info).toEqual({ mode: 'ask_inventory_return', removedQty: 2 });
  });

  test('getModificationSaveDialogInfo: cambia la pieza → ask return cantidad previa', () => {
    const info = getModificationSaveDialogInfo(spec({ mounted_qty: '2' }), spec({ mounted_qty: '2', element: 'Piñón 10' }));
    expect(info).toEqual({ mode: 'ask_inventory_return', removedQty: 2 });
  });

  test('getModificationSaveDialogInfo: sin cambios → save_direct', () => {
    const baseline = spec();
    expect(getModificationSaveDialogInfo(baseline, spec())).toEqual({ mode: 'save_direct' });
  });
});
