'use strict';

const RAW_MAX_LEN = 500;

/**
 * Serializa meta a pares key=value para logs.
 * @param {Record<string, unknown>} [meta]
 * @returns {string}
 */
function formatMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const parts = [];
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    parts.push(`${key}=${String(value)}`);
  }
  return parts.length ? ` | ${parts.join(' | ')}` : '';
}

/**
 * Extrae campos útiles de errores Supabase/PostgREST u otros.
 * @param {unknown} err
 * @returns {{ message: string, fields: string[], raw?: string }}
 */
function extractErrorFields(err) {
  const fields = [];
  let message = 'Unknown error';

  if (err instanceof Error) {
    message = err.message || message;
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object') {
    const o = /** @type {Record<string, unknown>} */ (err);
    if (typeof o.message === 'string' && o.message) message = o.message;
    for (const key of ['code', 'details', 'hint', 'status', 'statusCode']) {
      const val = o[key];
      if (val != null && val !== '') fields.push(`${key}=${String(val)}`);
    }
  }

  const hasExtraFields = fields.length > 0;
  const onlyGenericMessage =
    !hasExtraFields && (message === 'Bad Request' || message === 'Unknown error');

  let raw;
  if (onlyGenericMessage && err != null) {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = String(err);
    }
    if (raw.length > RAW_MAX_LEN) {
      raw = `${raw.slice(0, RAW_MAX_LEN)}…`;
    }
  }

  return { message, fields, raw };
}

/**
 * Log conciso de error de base de datos/API con contexto de operación.
 * @param {string} label - Dónde falló (p. ej. "GET /api/vehicles list")
 * @param {unknown} err
 * @param {Record<string, unknown>} [meta]
 */
function logDbError(label, err, meta) {
  const { message, fields, raw } = extractErrorFields(err);
  const fieldPart = fields.length ? ` | ${fields.join(' | ')}` : '';
  const rawPart = raw ? ` | raw=${raw}` : '';
  const metaPart = formatMeta(meta);
  console.error(`[${label}] ${message}${fieldPart}${rawPart}${metaPart}`);
}

module.exports = {
  logDbError,
  extractErrorFields,
  formatMeta,
};
