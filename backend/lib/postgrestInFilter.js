'use strict';

/** Máximo de valores en `.in(...)` por petición (evita URL > ~8 KB en proxy/nginx). */
const POSTGREST_IN_FILTER_CHUNK = 80;

/**
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
function chunkArray(arr, size) {
  if (!arr?.length || size <= 0) return [];
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Estima caracteres del fragmento PostgREST `in.(v1,v2,...)` (sin nombre de columna ni URL base).
 * @param {unknown[]} values
 * @returns {number}
 */
function estimateInFilterUrlChars(values) {
  if (!values?.length) return 0;
  const joined = values.map((v) => String(v)).join(',');
  return 5 + joined.length;
}

module.exports = {
  POSTGREST_IN_FILTER_CHUNK,
  chunkArray,
  estimateInFilterUrlChars,
};
