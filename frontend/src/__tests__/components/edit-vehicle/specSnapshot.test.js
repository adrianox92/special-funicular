import {
  getModificationSaveDialogInfo,
  inventoryCategoryToVehicleType,
  inventoryPickerRequestParams,
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

  test('inventoryPickerRequestParams no incluye page ni limit', () => {
    expect(inventoryPickerRequestParams('')).toEqual({});
    expect(inventoryPickerRequestParams(undefined)).toEqual({});
    expect(inventoryPickerRequestParams('motor')).toEqual({ category: 'motor' });
    expect(inventoryPickerRequestParams('other')).toEqual({ category: 'otro' });
    expect(inventoryPickerRequestParams('motor')).not.toHaveProperty('page');
    expect(inventoryPickerRequestParams('motor')).not.toHaveProperty('limit');
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
