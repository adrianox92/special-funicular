/**
 * Campos multipart equivalentes a frontend/src/utils/buildCreateVehicleFormData.js
 * (sin ficha técnica: el backend las acepta vacías). Usado por el e2e de POST /vehicles.
 */
function createVehicleMultipartFields(vehicle, { catalogItemId, source } = {}) {
  const skip = new Set([
    'catalog_item_id',
    'dorsal',
    'limited_edition',
    'limited_edition_unit_number',
    'vehicle_save_source',
  ]);
  const fields = [];
  Object.entries(vehicle || {}).forEach(([key, value]) => {
    if (skip.has(key) || key.startsWith('spec_')) return;
    if (value === undefined || value === null) return;
    if (typeof value === 'object') return;
    fields.push([key, String(value)]);
  });
  fields.push(['dorsal', vehicle?.dorsal ?? '']);
  fields.push(['limited_edition', vehicle?.limited_edition ? 'true' : 'false']);
  fields.push(['limited_edition_unit_number', '']);
  const cid = catalogItemId || vehicle?.catalog_item_id;
  if (cid) fields.push(['catalog_item_id', String(cid)]);
  if (source) fields.push(['vehicle_save_source', source]);
  return fields;
}

function applyMultipart(req, fields) {
  fields.forEach(([key, value]) => {
    req.field(key, value);
  });
  return req;
}

module.exports = { createVehicleMultipartFields, applyMultipart };
