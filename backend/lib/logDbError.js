'use strict';

const RAW_MAX_LEN = 500;
const EXTRA_FIELD_MAX_LEN = 120;
const KNOWN_ERROR_KEYS = new Set(['message', 'code', 'details', 'hint', 'status', 'statusCode']);

/** Umbral aproximado (chars del filtro `in.(...)`) por encima del cual nginx/proxy suele devolver 400 genérico. */
const IN_FILTER_URL_WARN_CHARS = 6000;

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
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 * @returns {string|null}
 */
function inferLikelyCause(message, meta) {
  const status = Number(meta?.status ?? meta?.statusCode);
  if (
    (message === 'Empty error message' || message === '' || message === 'Unknown error') &&
    Number.isFinite(status) &&
    status >= 500
  ) {
    return 'postgrest_head_count_hides_error_body';
  }

  const generic =
    message === 'Bad Request' ||
    message === 'Request-URI Too Large' ||
    message === 'URI Too Long';

  if (!generic || !meta) return null;

  const inFilterChars = Number(meta.inFilterChars ?? meta.failedChunkInFilterChars);
  if (Number.isFinite(inFilterChars) && inFilterChars > IN_FILTER_URL_WARN_CHARS) {
    return 'postgrest_in_filter_url_too_long';
  }

  return null;
}

/**
 * @param {unknown} val
 * @returns {string|null}
 */
function stringifyExtraField(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val).slice(0, EXTRA_FIELD_MAX_LEN);
    } catch {
      return String(val).slice(0, EXTRA_FIELD_MAX_LEN);
    }
  }
  return String(val).slice(0, EXTRA_FIELD_MAX_LEN);
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
    if (err.name && err.name !== 'Error') fields.push(`name=${err.name}`);
    if (err.cause) {
      const causeText = stringifyExtraField(
        err.cause instanceof Error ? err.cause.message : err.cause,
      );
      if (causeText) fields.push(`cause=${causeText}`);
    }
  } else if (typeof err === 'string') {
    message = err;
  }

  if (err && typeof err === 'object') {
    const o = /** @type {Record<string, unknown>} */ (err);
    if (!(err instanceof Error) && typeof o.message === 'string' && o.message) {
      message = o.message;
    }
    // HEAD + count=exact a menudo devuelve { message: '' } sin body; no dejar el log vacío.
    if (!message || message === 'Unknown error') {
      if (typeof o.message === 'string' && o.message === '') {
        message = 'Empty error message';
      }
    }
    for (const key of ['code', 'details', 'hint', 'status', 'statusCode']) {
      const val = o[key];
      if (val != null && val !== '') fields.push(`${key}=${String(val)}`);
    }
    for (const key of Object.keys(o)) {
      if (KNOWN_ERROR_KEYS.has(key)) continue;
      const text = stringifyExtraField(o[key]);
      if (text) fields.push(`${key}=${text}`);
    }
  }

  const hasPostgrestFields = fields.some((f) =>
    /^(code|details|hint)=/.test(f),
  );
  const onlyGenericMessage =
    !hasPostgrestFields &&
    (message === 'Bad Request' ||
      message === 'Unknown error' ||
      message === 'Empty error message' ||
      message === 'Request-URI Too Large' ||
      message === 'URI Too Long');

  let raw;
  if (onlyGenericMessage && err != null) {
    try {
      raw = JSON.stringify(err, Object.getOwnPropertyNames(err instanceof Error ? err : err));
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
  const likelyCause = inferLikelyCause(message, meta);
  const enrichedMeta = likelyCause ? { ...meta, likelyCause } : meta;
  const fieldPart = fields.length ? ` | ${fields.join(' | ')}` : '';
  const rawPart = raw ? ` | raw=${raw}` : '';
  const metaPart = formatMeta(enrichedMeta);
  console.error(`[${label}] ${message}${fieldPart}${rawPart}${metaPart}`);
}

module.exports = {
  logDbError,
  extractErrorFields,
  formatMeta,
  inferLikelyCause,
  IN_FILTER_URL_WARN_CHARS,
};
