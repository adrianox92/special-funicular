import { mergeEmptyTechSpecsFromCatalog } from '../data/catalogTechSpecs';
import { detectSwappedVehicleFields, swapModelAndReference } from './vehicleFieldSwap';

function isEmptyFormValue(value) {
  if (value == null) return true;
  if (typeof value === 'boolean') return false;
  return String(value).trim() === '';
}

const IDENTITY_FROM_CATALOG = [
  ['model', 'model_name'],
  ['manufacturer', 'manufacturer'],
  ['reference', 'reference'],
  ['type', 'vehicle_type'],
  ['traction', 'traction'],
  ['motor_position', 'motor_position'],
  ['commercial_release_year', 'commercial_release_year'],
  ['dorsal', 'dorsal'],
];

/**
 * Enlaza un ítem de catálogo: corrige intercambio modelo/referencia si se
 * detectó, rellena solo huecos y nunca pisa lo que el usuario ya escribió.
 */
export function applyCatalogItemToVehicleForm(currentForm, catalogItem) {
  if (!catalogItem?.id) return currentForm || {};
  let next = { ...(currentForm || {}) };
  if (detectSwappedVehicleFields(next)) {
    next = swapModelAndReference(next);
  }
  for (const [formKey, itemKey] of IDENTITY_FROM_CATALOG) {
    if (!isEmptyFormValue(next[formKey]) || isEmptyFormValue(catalogItem[itemKey])) continue;
    const raw = catalogItem[itemKey];
    next[formKey] = formKey === 'commercial_release_year' ? String(raw) : raw;
  }
  Object.assign(next, mergeEmptyTechSpecsFromCatalog(next, catalogItem));
  next.catalog_item_id = catalogItem.id;
  return next;
}
