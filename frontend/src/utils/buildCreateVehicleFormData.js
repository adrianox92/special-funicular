import { appendCatalogItemIdOnce } from './vehicleCatalogItemId';
import {
  appendTechSpecsToFormData,
  CATALOG_TECH_SPEC_KEYS,
  techSpecFormFromRow,
} from '../data/catalogTechSpecs';

const SKIP_SCALAR_KEYS = new Set([
  'catalog_item_id',
  'dorsal',
  'limited_edition',
  'limited_edition_unit_number',
  'vehicle_save_source',
]);

/**
 * Origen del alta para vehicle_save_errors.source (si el guardado falla).
 * catalog_tab cubre la pestaña Catálogo y el enlace ?catalogItemId=.
 */
export function resolveVehicleSaveSource({ catalogItemId, entryMode, explicit } = {}) {
  if (explicit) return explicit;
  if (!catalogItemId) return 'manual';
  if (entryMode === 'catalog') return 'catalog_tab';
  return 'suggest';
}

/**
 * FormData exacto que envía el alta de vehículo (multipart / Multer).
 * catalog_item_id se anexa como mucho una vez.
 */
export function buildCreateVehicleFormData(
  vehicle,
  { catalogItemId, images, imageFieldNames = [], source } = {},
) {
  const formData = new FormData();
  const specKeySet = new Set(CATALOG_TECH_SPEC_KEYS);
  Object.entries(vehicle || {}).forEach(([key, value]) => {
    if (specKeySet.has(key)) return;
    if (SKIP_SCALAR_KEYS.has(key)) return;
    if (value === undefined || value === null) return;
    if (typeof value === 'object') return;
    formData.append(key, value);
  });
  formData.append('dorsal', vehicle?.dorsal ?? '');
  formData.append('limited_edition', vehicle?.limited_edition ? 'true' : 'false');
  formData.append(
    'limited_edition_unit_number',
    vehicle?.limited_edition &&
      vehicle.limited_edition_unit_number !== '' &&
      vehicle.limited_edition_unit_number != null
      ? String(vehicle.limited_edition_unit_number)
      : '',
  );
  appendTechSpecsToFormData(formData, techSpecFormFromRow(vehicle));
  appendCatalogItemIdOnce(formData, catalogItemId, vehicle?.catalog_item_id);
  if (source) formData.append('vehicle_save_source', source);
  imageFieldNames.forEach((name) => {
    if (images?.[name]) formData.append('images', images[name], name);
  });
  return formData;
}
