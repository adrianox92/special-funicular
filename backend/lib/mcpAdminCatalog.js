'use strict';

const { getServiceClient } = require('./supabaseClients');
const { isLicenseAdminUser } = require('./licenseAdminAuth');
const { normalizeReference } = require('./catalogAliases');
const { findExactCatalogItemId, resolveExactBrandId } = require('./mcpReadTools');
const {
  applyCatalogItemsMissingFilter,
  catalogCompletenessFilled,
  catalogDorsalPresent,
} = require('./catalogCompleteness');

const MISSING_FILTERS = new Set([
  'incomplete',
  'image',
  'model_name',
  'vehicle_type',
  'traction',
  'motor',
  'year',
  'dorsal',
]);

const LIST_FIELDS = 'reference, manufacturer, model_name, vehicle_type, traction, motor_position, commercial_release_year, dorsal, image_url';

function requireDb() {
  const db = getServiceClient();
  if (!db) {
    const err = new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
    err.statusCode = 503;
    throw err;
  }
  return db;
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function assertNoError(error) {
  if (error) httpError(500, error.message || 'Error de base de datos');
}

function assertUser(userId) {
  if (!userId || typeof userId !== 'string') httpError(401, 'Sesión MCP sin usuario');
}

function oneExactText(value, label) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (text.length < 2 || text.length > 80) httpError(400, `${label} debe ser un texto concreto`);
  return text;
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function nonEmptyText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function parseMotorPosition(raw) {
  const text = nonEmptyText(raw);
  if (!text) return null;
  const s = text.toLowerCase();
  if (s === 'inline' || s === 'angular' || s === 'transverse') return s;
  if (s === 'en_linea' || s === 'en línea' || s === 'en linea' || s === 'lineal') return 'inline';
  if (s === 'en_angular' || s === 'en angular') return 'angular';
  if (s === 'transversal' || s === 'transversa' || s === 'en_transversal' || s === 'en transversal') return 'transverse';
  httpError(400, 'motor_position debe ser inline, angular o transverse');
}

function parseYear(raw) {
  if (raw == null || raw === '') return null;
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1900 || n > 2100) {
    httpError(400, 'commercial_release_year debe estar entre 1900 y 2100');
  }
  return n;
}

/**
 * @returns {Promise<boolean>}
 */
async function resolveMcpAdmin(db, userId) {
  if (!userId || !db || !db.auth || !db.auth.admin || typeof db.auth.admin.getUserById !== 'function') {
    return false;
  }
  try {
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error) return false;
    return isLicenseAdminUser({ email: data?.user?.email });
  } catch {
    return false;
  }
}

async function assertAdmin(userId) {
  assertUser(userId);
  const db = requireDb();
  const admin = await resolveMcpAdmin(db, userId);
  if (!admin) httpError(403, 'Solo administradores');
  return db;
}

function missingOf(row) {
  const filled = catalogCompletenessFilled(row);
  const missing = [];
  if (!filled.model_name) missing.push('model_name');
  if (!filled.vehicle_type) missing.push('vehicle_type');
  if (!filled.traction) missing.push('traction');
  if (!filled.motor_position) missing.push('motor_position');
  if (!filled.commercial_release_year) missing.push('commercial_release_year');
  if (!filled.image_url) missing.push('image_url');
  if (!catalogDorsalPresent(row.dorsal)) missing.push('dorsal');
  return missing;
}

function toListItem(row, manufacturer) {
  return {
    reference: row.reference,
    manufacturer: row.manufacturer || manufacturer,
    model_name: row.model_name || null,
    vehicle_type: row.vehicle_type || null,
    traction: row.traction || null,
    motor_position: row.motor_position || null,
    commercial_release_year: row.commercial_release_year ?? null,
    dorsal: row.dorsal || null,
    has_image: Boolean(row.image_url && String(row.image_url).trim()),
    missing: missingOf(row),
  };
}

async function listIncompleteCatalogItems(userId, args = {}) {
  const db = await assertAdmin(userId);
  const manufacturer = oneExactText(args.manufacturer, 'manufacturer');
  const missing = String(args.missing || 'incomplete').trim().toLowerCase();
  if (!MISSING_FILTERS.has(missing)) httpError(400, 'missing no es un filtro válido');
  const page = clampInt(args.page, 1, 1, 200);
  const limit = clampInt(args.limit, 25, 1, 25);
  const manufacturerId = await resolveExactBrandId(db, manufacturer);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = db
    .from('slot_catalog_items_with_ratings')
    .select(LIST_FIELDS, { count: 'exact' })
    .eq('manufacturer_id', manufacturerId);
  query = applyCatalogItemsMissingFilter(query, missing);
  const { data, error, count } = await query
    .order('reference', { ascending: true })
    .range(from, to);
  assertNoError(error);
  const total = count ?? (data || []).length;
  return {
    manufacturer,
    missing,
    items: (data || []).map((row) => toListItem(row, manufacturer)),
    pagination: {
      total,
      page,
      limit,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    },
  };
}

function patchFromArgs(args) {
  const patch = {};
  if (args.model_name !== undefined) {
    const value = nonEmptyText(args.model_name);
    if (value) patch.model_name = value;
  }
  if (args.vehicle_type !== undefined) {
    const value = nonEmptyText(args.vehicle_type);
    if (value) patch.vehicle_type = value;
  }
  if (args.traction !== undefined) {
    const value = nonEmptyText(args.traction);
    if (value) patch.traction = value;
  }
  if (args.motor_position !== undefined && nonEmptyText(args.motor_position)) {
    patch.motor_position = parseMotorPosition(args.motor_position);
  }
  if (args.commercial_release_year !== undefined && args.commercial_release_year !== '') {
    const year = parseYear(args.commercial_release_year);
    if (year != null) patch.commercial_release_year = year;
  }
  if (args.dorsal !== undefined) {
    const value = nonEmptyText(args.dorsal);
    if (value) patch.dorsal = value;
  }
  return patch;
}

async function updateCatalogItem(userId, args = {}) {
  const db = await assertAdmin(userId);
  const reference = normalizeReference(oneExactText(args.reference, 'reference'));
  const manufacturer = oneExactText(args.manufacturer, 'manufacturer');
  if (!reference) httpError(400, 'reference debe ser un texto concreto');
  const patch = patchFromArgs(args);
  if (Object.keys(patch).length === 0) httpError(400, 'No hay campos para completar');
  const itemId = await findExactCatalogItemId(db, reference, manufacturer);
  const { error } = await db
    .from('slot_catalog_items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  assertNoError(error);
  return { reference, manufacturer, updated: patch };
}

module.exports = {
  resolveMcpAdmin,
  listIncompleteCatalogItems,
  updateCatalogItem,
};
