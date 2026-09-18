'use strict';

const REFS_GAP_MIN_LIMIT = 1;
const REFS_GAP_MAX_LIMIT = 100;
const REFS_Q_MAX = 100;

/**
 * Normaliza el texto de búsqueda de referencia de garaje.
 * La coincidencia real es contains sobre referencia normalizada (trim + lower) en el RPC.
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeRefsQuery(raw) {
  if (raw == null) return '';
  return String(raw).trim().slice(0, REFS_Q_MAX);
}

/**
 * Query del listado admin de referencias de garaje.
 * `q` canónico; `reference` y `ref` se aceptan como alias (p. ej. deep-link ?ref=FOO).
 * Vacío → informe ranking «solo ausentes del catálogo».
 * Informado → contains (trim+lower) e incluye refs que ya existen en catálogo.
 * `manufacturer` (alias `mfg` / `brand`): contains sobre fabricante de garaje.
 *
 * @param {Record<string, unknown>} query
 * @returns {{ error: string } | { limit: number, offset: number, only_unlinked: boolean, q: string, manufacturer: string }}
 */
function parseRefsGapQuery(query = {}) {
  const limRaw = query.limit;
  const offRaw = query.offset;
  const lim =
    limRaw === undefined || limRaw === ''
      ? 25
      : Number.parseInt(String(limRaw), 10);
  const off =
    offRaw === undefined || offRaw === ''
      ? 0
      : Number.parseInt(String(offRaw), 10);
  if (!Number.isFinite(lim) || !Number.isFinite(off)) {
    return { error: 'limit y offset deben ser enteros.' };
  }
  const limit = Math.min(REFS_GAP_MAX_LIMIT, Math.max(REFS_GAP_MIN_LIMIT, lim));
  const offset = Math.max(0, off);
  const only =
    query.only_unlinked === true ||
    query.only_unlinked === 'true' ||
    query.only_unlinked === '1';
  const q = normalizeRefsQuery(query.q ?? query.reference ?? query.ref);
  const manufacturer = normalizeRefsQuery(
    query.manufacturer ?? query.mfg ?? query.brand,
  );
  return { limit, offset, only_unlinked: only, q, manufacturer };
}

/**
 * Parámetros nombrados de `admin_vehicle_refs_missing_catalog`.
 * `p_q` / `p_manufacturer` vacíos se omiten para no romper firmas RPC anteriores.
 * Con p_q el RPC incluye matches en catálogo; con p_manufacturer filtra y agrupa por marca.
 * @param {{ limit: number, offset: number, only_unlinked: boolean, q: string, manufacturer: string }} parsed
 */
function buildMissingCatalogRpcParams(parsed) {
  const params = {
    p_limit: parsed.limit,
    p_offset: parsed.offset,
    p_only_unlinked: parsed.only_unlinked,
  };
  // Omitir vacíos: el RPC 3-arg / 4-arg (pre-migración) sigue sirviendo el ranking.
  if (parsed.q) params.p_q = parsed.q;
  if (parsed.manufacturer) params.p_manufacturer = parsed.manufacturer;
  return params;
}

module.exports = {
  REFS_GAP_MIN_LIMIT,
  REFS_GAP_MAX_LIMIT,
  REFS_Q_MAX,
  normalizeRefsQuery,
  parseRefsGapQuery,
  buildMissingCatalogRpcParams,
};
