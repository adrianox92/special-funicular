'use strict';

const { getServiceClient } = require('./supabaseClients');

const MESSAGE_MAX = 500;
const RAW_MAX = 200;
const SOURCE_MAX = 40;
const ROUTE_MAX = 80;

function firstText(value, max) {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined') return null;
  return s.slice(0, max);
}

function summarizeCatalogItemIdRaw(raw) {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) {
    const parts = raw.map((v) => String(v).slice(0, 64));
    return `array:${raw.length}:${parts.join(',').slice(0, RAW_MAX)}`.slice(0, RAW_MAX);
  }
  if (typeof raw === 'object') {
    return firstText(raw.id, RAW_MAX);
  }
  return String(raw).slice(0, RAW_MAX);
}

/**
 * Inserta un fallo de alta/edición de vehículo. Nunca lanza: el HTTP no depende del log.
 * No guarda cuerpos completos ni cabeceras/autorización.
 */
async function logVehicleSaveError({
  userId,
  route,
  status,
  errorMessage,
  catalogItemIdRaw,
  source,
} = {}) {
  const code = Number(status);
  if (!Number.isFinite(code) || code < 400) return;
  try {
    const db = getServiceClient();
    if (!db) return;
    const row = {
      user_id: userId || null,
      route: firstText(route, ROUTE_MAX) || 'unknown',
      status: code,
      error_message: firstText(errorMessage, MESSAGE_MAX),
      catalog_item_id_raw: summarizeCatalogItemIdRaw(catalogItemIdRaw),
      source: firstText(source, SOURCE_MAX),
    };
    const { error } = await db.from('vehicle_save_errors').insert(row);
    if (error) {
      console.error('[vehicle_save_errors]', error.message || error);
    }
  } catch (err) {
    console.error('[vehicle_save_errors]', err && err.message ? err.message : err);
  }
}

function logVehicleSaveFailures(routeName) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode || 200;
      if (status < 400) return origJson(body);
      const message =
        body && typeof body === 'object' && body.error != null ? body.error : null;
      const route = typeof routeName === 'function' ? routeName(req) : routeName;
      return Promise.resolve(
        logVehicleSaveError({
          userId: req.user && req.user.id,
          route,
          status,
          errorMessage: message,
          catalogItemIdRaw: req.body ? req.body.catalog_item_id : undefined,
          source: req.body ? req.body.vehicle_save_source : undefined,
        }),
      ).then(
        () => origJson(body),
        () => origJson(body),
      );
    };
    next();
  };
}

module.exports = {
  logVehicleSaveError,
  logVehicleSaveFailures,
  summarizeCatalogItemIdRaw,
};
