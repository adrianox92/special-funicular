'use strict';

/** Columnas nuevas de ficha (no incluye traction / motor_position). */
const CATALOG_TECH_SPEC_TEXT_FIELDS = [
  'spec_scale',
  'spec_body',
  'spec_motor',
  'spec_pinion_gear',
  'spec_front_wheels',
  'spec_rear_wheels',
  'spec_front_tyres',
  'spec_rear_tyres',
  'spec_lights',
];

const CATALOG_TECH_SPEC_NUM_FIELDS = [
  'spec_length_mm',
  'spec_height_mm',
  'spec_wheelbase_mm',
  'spec_front_track_mm',
  'spec_rear_track_mm',
  'spec_weight_g',
];

const CATALOG_TECH_SPEC_COLUMNS = [
  ...CATALOG_TECH_SPEC_TEXT_FIELDS,
  ...CATALOG_TECH_SPEC_NUM_FIELDS,
  'spec_magnet',
];

const CATALOG_TECH_SPEC_SELECT = CATALOG_TECH_SPEC_COLUMNS.join(', ');

const TEXT_MAX = {
  spec_scale: 32,
  spec_body: 80,
  spec_motor: 120,
  spec_pinion_gear: 40,
  spec_front_wheels: 120,
  spec_rear_wheels: 120,
  spec_front_tyres: 120,
  spec_rear_tyres: 120,
  spec_lights: 80,
};

const NUM_MAX = 100000;

function normOptionalStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
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

function parseOptionalNullableBool(raw) {
  if (raw == null || raw === '') return { ok: true, value: null };
  if (typeof raw === 'boolean') return { ok: true, value: raw };
  const s = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'sí', 'si', 'ja', 'on'].includes(s)) return { ok: true, value: true };
  if (['false', '0', 'no', 'nein', 'n', 'off'].includes(s)) return { ok: true, value: false };
  return { ok: false, error: 'spec_magnet: valor no válido (sí/no o vacío)' };
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
  const src = body && typeof body === 'object' ? body : {};
  const prev = existing && typeof existing === 'object' ? existing : null;
  const specs = {};

  for (const field of CATALOG_TECH_SPEC_TEXT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, field)) {
      const parsed = parseOptionalTechText(src[field], field);
      if (!parsed.ok) return parsed;
      specs[field] = parsed.value;
    } else {
      specs[field] = prev ? (prev[field] ?? null) : null;
    }
  }

  for (const field of CATALOG_TECH_SPEC_NUM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(src, field)) {
      const parsed = parseOptionalNonNegativeNumber(src[field], field);
      if (!parsed.ok) return parsed;
      specs[field] = parsed.value;
    } else {
      specs[field] = prev ? (prev[field] ?? null) : null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(src, 'spec_magnet')) {
    const parsed = parseOptionalNullableBool(src.spec_magnet);
    if (!parsed.ok) return parsed;
    specs.spec_magnet = parsed.value;
  } else {
    specs.spec_magnet = prev
      ? (prev.spec_magnet === true || prev.spec_magnet === false ? prev.spec_magnet : null)
      : null;
  }

  return { ok: true, specs };
}

module.exports = {
  CATALOG_TECH_SPEC_COLUMNS,
  CATALOG_TECH_SPEC_TEXT_FIELDS,
  CATALOG_TECH_SPEC_NUM_FIELDS,
  CATALOG_TECH_SPEC_SELECT,
  parseCatalogTechSpecsFromBody,
  parseOptionalNonNegativeNumber,
  parseOptionalNullableBool,
  parseOptionalTechText,
};
