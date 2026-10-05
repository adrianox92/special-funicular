/** Campos nuevos de ficha de catálogo. No incluye traction ni motor_position. */

export const CATALOG_TECH_SPEC_TEXT_FIELDS = [
  { key: 'spec_scale', i18n: 'scale', maxLength: 32 },
  { key: 'spec_body', i18n: 'body', maxLength: 80 },
  { key: 'spec_color', i18n: 'color', maxLength: 80 },
  { key: 'spec_system', i18n: 'system', maxLength: 80 },
  { key: 'spec_motor', i18n: 'motor', maxLength: 120 },
  { key: 'spec_pinion_gear', i18n: 'pinionGear', maxLength: 40 },
  { key: 'spec_front_wheels', i18n: 'frontWheels', maxLength: 120 },
  { key: 'spec_rear_wheels', i18n: 'rearWheels', maxLength: 120 },
  { key: 'spec_front_tyres', i18n: 'frontTyres', maxLength: 120 },
  { key: 'spec_rear_tyres', i18n: 'rearTyres', maxLength: 120 },
  { key: 'spec_lights', i18n: 'lights', maxLength: 80 },
];

/** Texto mostrado antes de medidas / imán (ficha pública y formulario admin). */
export const CATALOG_TECH_SPEC_LEAD_TEXT_KEYS = [
  'spec_scale',
  'spec_body',
  'spec_color',
  'spec_system',
  'spec_motor',
];

export const CATALOG_TECH_SPEC_NUM_FIELDS = [
  { key: 'spec_length_mm', i18n: 'lengthMm' },
  { key: 'spec_height_mm', i18n: 'heightMm' },
  { key: 'spec_wheelbase_mm', i18n: 'wheelbaseMm' },
  { key: 'spec_front_track_mm', i18n: 'frontTrackMm' },
  { key: 'spec_rear_track_mm', i18n: 'rearTrackMm' },
  { key: 'spec_front_axle_width_mm', i18n: 'frontAxleWidthMm' },
  { key: 'spec_rear_axle_width_mm', i18n: 'rearAxleWidthMm' },
  { key: 'spec_weight_g', i18n: 'weightG' },
];

export const CATALOG_TECH_SPEC_KEYS = [
  ...CATALOG_TECH_SPEC_TEXT_FIELDS.map((f) => f.key),
  ...CATALOG_TECH_SPEC_NUM_FIELDS.map((f) => f.key),
  'spec_magnet',
];

export function emptyTechSpecForm() {
  const out = { spec_magnet: '' };
  for (const f of CATALOG_TECH_SPEC_TEXT_FIELDS) out[f.key] = '';
  for (const f of CATALOG_TECH_SPEC_NUM_FIELDS) out[f.key] = '';
  return out;
}

function formatStoredNumber(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return String(n);
}

export function techSpecFormFromRow(row = {}) {
  const out = emptyTechSpecForm();
  for (const f of CATALOG_TECH_SPEC_TEXT_FIELDS) {
    const v = row[f.key];
    out[f.key] = v == null ? '' : String(v);
  }
  for (const f of CATALOG_TECH_SPEC_NUM_FIELDS) {
    out[f.key] = formatStoredNumber(row[f.key]);
  }
  if (row.spec_magnet === true) out.spec_magnet = 'true';
  else if (row.spec_magnet === false) out.spec_magnet = 'false';
  else out.spec_magnet = '';
  return out;
}

export function appendTechSpecsToFormData(fd, form) {
  for (const key of CATALOG_TECH_SPEC_KEYS) {
    fd.append(key, form?.[key] ?? '');
  }
}

function isFilledText(v) {
  return v != null && String(v).trim() !== '';
}

function isFilledNumber(v) {
  if (v == null || v === '') return false;
  return Number.isFinite(Number(v));
}

/** True si hay al menos un campo nuevo relleno (imán false cuenta). */
export function hasCatalogTechSpecs(item) {
  if (!item) return false;
  if (item.spec_magnet === true || item.spec_magnet === false) return true;
  for (const f of CATALOG_TECH_SPEC_TEXT_FIELDS) {
    if (isFilledText(item[f.key])) return true;
  }
  for (const f of CATALOG_TECH_SPEC_NUM_FIELDS) {
    if (isFilledNumber(item[f.key])) return true;
  }
  return false;
}

export function formatTechSpecNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number.isInteger(n) ? String(n) : String(n);
}

export function validateTechSpecForm(form) {
  for (const f of CATALOG_TECH_SPEC_NUM_FIELDS) {
    const raw = form?.[f.key];
    if (raw == null || String(raw).trim() === '') continue;
    const n = Number(String(raw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      return f.i18n;
    }
  }
  return null;
}
