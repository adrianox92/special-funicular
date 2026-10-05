'use strict';

/** Columnas nuevas de ficha (no incluye traction / motor_position). */
const CATALOG_TECH_SPEC_TEXT_FIELDS = [
  'spec_scale',
  'spec_body',
  'spec_color',
  'spec_motor',
  'spec_pinion_gear',
  'spec_front_wheels',
  'spec_rear_wheels',
];

const CATALOG_TECH_SPEC_NUM_FIELDS = [
  'spec_length_mm',
  'spec_height_mm',
  'spec_wheelbase_mm',
  'spec_front_track_mm',
  'spec_rear_track_mm',
  'spec_front_axle_length_mm',
  'spec_rear_axle_length_mm',
  'spec_front_rim_diameter_mm',
  'spec_rear_rim_diameter_mm',
  'spec_weight_g',
];

const CATALOG_TECH_SPEC_BOOL_FIELDS = [
  'spec_magnet',
  'spec_front_lights',
  'spec_rear_lights',
];

const CATALOG_TECH_SPEC_RIM_FIELDS = ['spec_front_rim', 'spec_rear_rim'];

const CATALOG_TECH_SPEC_SYSTEM_VALUES = ['analog', 'digital'];

const CATALOG_TECH_SPEC_RIM_VALUES = ['plastic', 'aluminum', 'magnesium'];

const CATALOG_TECH_SPEC_COLUMNS = [
  ...CATALOG_TECH_SPEC_TEXT_FIELDS,
  ...CATALOG_TECH_SPEC_NUM_FIELDS,
  ...CATALOG_TECH_SPEC_BOOL_FIELDS,
  'spec_system',
  ...CATALOG_TECH_SPEC_RIM_FIELDS,
];

const CATALOG_TECH_SPEC_SELECT = CATALOG_TECH_SPEC_COLUMNS.join(', ');

const TEXT_MAX = {
  spec_scale: 32,
  spec_body: 80,
  spec_color: 80,
  spec_motor: 120,
  spec_pinion_gear: 40,
  spec_front_wheels: 120,
  spec_rear_wheels: 120,
};

const NUM_MAX = 100000;

const SYSTEM_ALIASES = {
  analog: 'analog',
  analogue: 'analog',
  analogico: 'analog',
  analogisch: 'analog',
  digital: 'digital',
};

const RIM_ALIASES = {
  plastic: 'plastic',
  plastico: 'plastic',
  plastik: 'plastic',
  kunststoff: 'plastic',
  pl: 'plastic',
  aluminum: 'aluminum',
  aluminium: 'aluminum',
  aluminio: 'aluminum',
  alu: 'aluminum',
  al: 'aluminum',
  magnesium: 'magnesium',
  magnesio: 'magnesium',
  mag: 'magnesium',
  ma: 'magnesium',
};

function normOptionalStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function foldKey(value) {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function parseOptionalTechText(raw, field) {
  const value = normOptionalStr(raw);
  if (value == null) return { ok: true, value: null };
  const max = TEXT_MAX[field] || 120;
  if (value.length > max) {
    return { ok: false, error: `${field}: máximo ${max} caracteres` };
  }
  return { ok: true, value };
}

function parseOptionalNonNegativeNumber(raw, field) {
  if (raw == null || raw === '') return { ok: true, value: null };
  const s = String(raw).trim().replace(',', '.');
  if (s === '') return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > NUM_MAX) {
    return { ok: false, error: `${field}: debe ser un número entre 0 y ${NUM_MAX}` };
  }
  return { ok: true, value: n };
}

function parseOptionalNullableBool(raw, field = 'spec_magnet') {
  if (raw == null || raw === '') return { ok: true, value: null };
  if (typeof raw === 'boolean') return { ok: true, value: raw };
  const s = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'sí', 'si', 'ja', 'on'].includes(s)) return { ok: true, value: true };
  if (['false', '0', 'no', 'nein', 'n', 'off'].includes(s)) return { ok: true, value: false };
  return { ok: false, error: `${field}: valor no válido (sí/no o vacío)` };
}

function parseOptionalSystem(raw) {
  const value = normOptionalStr(raw);
  if (value == null) return { ok: true, value: null };
  const mapped = SYSTEM_ALIASES[foldKey(value)];
  if (mapped) return { ok: true, value: mapped };
  return { ok: false, error: 'spec_system: debe ser analog, digital o vacío' };
}

function parseOptionalRim(raw, field) {
  const value = normOptionalStr(raw);
  if (value == null) return { ok: true, value: null };
  const mapped = RIM_ALIASES[foldKey(value)];
  if (mapped) return { ok: true, value: mapped };
  return {
    ok: false,
    error: `${field}: debe ser plastic, aluminum, magnesium o vacío`,
  };
}

function copyExistingOrNull(prev, field) {
  if (!prev) return null;
  return prev[field] === undefined ? null : prev[field];
}

/**
 * Clientes antiguos podían enviar spec_*_axle_width_mm (renombrado a length).
 * No se persisten ambas: se copia al campo length solo si este no viene en el body.
 */
function applyLegacyAxleWidthAliases(src) {
  if (!src || typeof src !== 'object') return src;
  const out = { ...src };
  if (
    !Object.prototype.hasOwnProperty.call(out, 'spec_front_axle_length_mm') &&
    Object.prototype.hasOwnProperty.call(out, 'spec_front_axle_width_mm')
  ) {
    out.spec_front_axle_length_mm = out.spec_front_axle_width_mm;
  }
  if (
    !Object.prototype.hasOwnProperty.call(out, 'spec_rear_axle_length_mm') &&
    Object.prototype.hasOwnProperty.call(out, 'spec_rear_axle_width_mm')
  ) {
    out.spec_rear_axle_length_mm = out.spec_rear_axle_width_mm;
  }
  return out;
}

/**
 * Parsea specs técnicas desde body (JSON o multipart).
 * Campo ausente: en create → null; en update → valor existente.
 * Campo presente vacío: null (permite borrar).
 *
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>|null} existing
 * @returns {{ ok: true, specs: Record<string, unknown> } | { ok: false, error: string }}
 */
function parseCatalogTechSpecsFromBody(body, existing) {
  const src = applyLegacyAxleWidthAliases(body && typeof body === 'object' ? body : {});
  const prev = existing && typeof existing === 'object' ? existing : null;
  const specs = {};

  for (const field of CATALOG_TECH_SPEC_TEXT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, field)) {
      const parsed = parseOptionalTechText(src[field], field);
      if (!parsed.ok) return parsed;
      specs[field] = parsed.value;
    } else {
      specs[field] = copyExistingOrNull(prev, field);
    }
  }

  for (const field of CATALOG_TECH_SPEC_NUM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, field)) {
      const parsed = parseOptionalNonNegativeNumber(src[field], field);
      if (!parsed.ok) return parsed;
      specs[field] = parsed.value;
    } else {
      specs[field] = copyExistingOrNull(prev, field);
    }
  }

  for (const field of CATALOG_TECH_SPEC_BOOL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, field)) {
      const parsed = parseOptionalNullableBool(src[field], field);
      if (!parsed.ok) return parsed;
      specs[field] = parsed.value;
    } else if (prev) {
      const v = prev[field];
      specs[field] = v === true || v === false ? v : null;
    } else {
      specs[field] = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(src, 'spec_system')) {
    const parsed = parseOptionalSystem(src.spec_system);
    if (!parsed.ok) return parsed;
    specs.spec_system = parsed.value;
  } else {
    const existingSystem = prev ? prev.spec_system : null;
    specs.spec_system = CATALOG_TECH_SPEC_SYSTEM_VALUES.includes(existingSystem)
      ? existingSystem
      : null;
  }

  for (const field of CATALOG_TECH_SPEC_RIM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, field)) {
      const parsed = parseOptionalRim(src[field], field);
      if (!parsed.ok) return parsed;
      specs[field] = parsed.value;
    } else {
      const existingRim = prev ? prev[field] : null;
      specs[field] = CATALOG_TECH_SPEC_RIM_VALUES.includes(existingRim) ? existingRim : null;
    }
  }

  return { ok: true, specs };
}

function isEmptyTechSpecValue(value, field) {
  if (value == null || value === '') return true;
  if ((field === 'spec_front_lights' || field === 'spec_rear_lights') && value === false) {
    return true;
  }
  return false;
}

const TRACK_TO_AXLE_LENGTH = [
  ['spec_front_track_mm', 'spec_front_axle_length_mm'],
  ['spec_rear_track_mm', 'spec_rear_axle_length_mm'],
];

/** Si axle_length está vacío, usa vía (track) legado. No pisa un axle ya relleno. */
function applyTrackFallbackToAxleLength(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const [trackKey, axleKey] of TRACK_TO_AXLE_LENGTH) {
    if (!isEmptyTechSpecValue(out[axleKey], axleKey)) continue;
    if (isEmptyTechSpecValue(out[trackKey], trackKey)) continue;
    out[axleKey] = out[trackKey];
  }
  return out;
}

/**
 * Copia specs del catálogo solo en campos vacíos del vehículo.
 * No pisa valores ya rellenados (incl. imán false y 0). Copy-on-create / copy-on-link.
 * Luces false se trata como vacío (el formulario envía false si el checkbox no está marcado).
 *
 * @param {Record<string, unknown>} specs
 * @param {Record<string, unknown>|null|undefined} catalogRow
 * @returns {Record<string, unknown>}
 */
function fillEmptyTechSpecsFromCatalog(specs, catalogRow) {
  const out = specs && typeof specs === 'object' ? { ...specs } : {};
  if (!catalogRow || typeof catalogRow !== 'object') return out;
  const catalog = applyTrackFallbackToAxleLength(catalogRow);
  for (const field of CATALOG_TECH_SPEC_COLUMNS) {
    if (!isEmptyTechSpecValue(out[field], field)) continue;
    const fromCatalog = catalog[field];
    if (isEmptyTechSpecValue(fromCatalog, field)) continue;
    out[field] = fromCatalog;
  }
  return applyTrackFallbackToAxleLength(out);
}

/**
 * Parsea el body y, si hay ficha de catálogo y fillFromCatalog, rellena huecos.
 *
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>|null} existing
 * @param {Record<string, unknown>|null} catalogRow
 * @param {{ fillFromCatalog?: boolean }} [opts]
 * @returns {{ ok: true, specs: Record<string, unknown> } | { ok: false, error: string }}
 */
function parseVehicleTechSpecsFromBody(body, existing, catalogRow, opts = {}) {
  const parsed = parseCatalogTechSpecsFromBody(body, existing);
  if (!parsed.ok) return parsed;
  const specs =
    opts.fillFromCatalog && catalogRow
      ? fillEmptyTechSpecsFromCatalog(parsed.specs, catalogRow)
      : parsed.specs;
  return { ok: true, specs };
}

module.exports = {
  CATALOG_TECH_SPEC_COLUMNS,
  CATALOG_TECH_SPEC_TEXT_FIELDS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_BOOL_FIELDS,
  CATALOG_TECH_SPEC_RIM_FIELDS,
  CATALOG_TECH_SPEC_SYSTEM_VALUES,
  CATALOG_TECH_SPEC_RIM_VALUES,
  CATALOG_TECH_SPEC_SELECT,
  parseCatalogTechSpecsFromBody,
  parseVehicleTechSpecsFromBody,
  fillEmptyTechSpecsFromCatalog,
  isEmptyTechSpecValue,
  parseOptionalNonNegativeNumber,
  parseOptionalNullableBool,
  parseOptionalRim,
  parseOptionalSystem,
  parseOptionalTechText,
};
