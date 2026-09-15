import { buildInventoryListQueryParams } from '../../utils/inventoryListQuery';

/** Alineado con COMPONENT_PAYLOAD_KEYS del backend (cambio de modificación → historial). */
export const VEHICLE_SPEC_SNAPSHOT_KEYS = [
  'component_type',
  'element',
  'manufacturer',
  'material',
  'size',
  'teeth',
  'color',
  'rpm',
  'gaus',
  'price',
  'url',
  'sku',
  'description',
  'mounted_qty',
];

export function normalizeSpecSnapshotValue(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(n) && String(n) === String(Number(v))) return n;
  return String(v);
}

export function vehicleSpecSnapshotsDiffer(prev, next) {
  if (!prev || !next) return false;
  for (const k of VEHICLE_SPEC_SNAPSHOT_KEYS) {
    if (normalizeSpecSnapshotValue(prev[k]) !== normalizeSpecSnapshotValue(next[k])) return true;
  }
  return false;
}

/** Solo sube cantidad (misma pieza): guardar directo y descontar stock en servidor si aplica. */
export function getModificationSaveDialogInfo(baseline, editing) {
  if (!baseline || !editing || !vehicleSpecSnapshotsDiffer(baseline, editing)) {
    return { mode: 'save_direct' };
  }
  const keysNoQty = VEHICLE_SPEC_SNAPSHOT_KEYS.filter((k) => k !== 'mounted_qty');
  const othersChanged = keysNoQty.some(
    (k) => normalizeSpecSnapshotValue(baseline[k]) !== normalizeSpecSnapshotValue(editing[k]),
  );
  const prevQ = Math.max(1, parseInt(baseline.mounted_qty, 10) || 1);
  const nextQ = Math.max(1, parseInt(editing.mounted_qty, 10) || 1);
  if (!othersChanged && nextQ > prevQ) {
    return { mode: 'save_direct' };
  }
  if (!othersChanged && nextQ < prevQ) {
    return { mode: 'ask_inventory_return', removedQty: prevQ - nextQ };
  }
  return { mode: 'ask_inventory_return', removedQty: prevQ };
}

/** Categoría de inventario (`otro`) → tipo de componente del vehículo (`other`). */
export function inventoryCategoryToVehicleType(cat) {
  return cat === 'otro' ? 'other' : cat;
}

export const INVENTORY_PICKER_PAGE_SIZE = 25;

/**
 * Params for GET /inventory in the mount-from-inventory picker.
 * Always sends page/limit so the picker never dumps the full inventory.
 */
export function inventoryPickerRequestParams(
  componentType,
  { page = 1, limit = INVENTORY_PICKER_PAGE_SIZE, q } = {},
) {
  return buildInventoryListQueryParams({
    page,
    limit,
    category: componentType ? (componentType === 'other' ? 'otro' : componentType) : undefined,
    q,
    inStock: true,
  });
}

export function parseInventoryPickerResponse(data, { page = 1, limit = INVENTORY_PICKER_PAGE_SIZE } = {}) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  const pagination =
    data?.pagination && typeof data.pagination === 'object'
      ? data.pagination
      : {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit) || 0,
        };
  return {
    items: list.filter((i) => Number(i.quantity) > 0),
    pagination,
  };
}
