'use strict';

const { catalogItemIsWeightedComplete } = require('./catalogCompleteness');

/** Columnas del listado público suficientes para la ficha del homepage. */
const HIGHLIGHT_SELECT =
  'id, reference, manufacturer_id, manufacturer, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, image_url';

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = { at: 0, items: null };

/**
 * Un modelo 100% completo por marca, el mejor valorado de cada una.
 * La selección está en `catalog_public_highlights()` (una consulta). Aquí solo
 * se descartan filas que no cumplan la regla de completitud y se ordenan.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ force?: boolean }} [opts]
 */
async function fetchCatalogCompleteHighlights(supabase, opts = {}) {
  const now = Date.now();
  if (!opts.force && cache.items && now - cache.at < CACHE_TTL_MS) {
    return cache.items;
  }

  const { data, error } = await supabase.rpc('catalog_public_highlights');
  if (error) throw new Error(error.message);

  const items = (Array.isArray(data) ? data : [])
    .filter((row) => row && catalogItemIsWeightedComplete(row))
    .sort((a, b) => String(a.manufacturer || '').localeCompare(String(b.manufacturer || ''), 'es'));

  cache = { at: now, items };
  return items;
}

function clearCatalogHighlightCache() {
  cache = { at: 0, items: null };
}

module.exports = {
  HIGHLIGHT_SELECT,
  fetchCatalogCompleteHighlights,
  clearCatalogHighlightCache,
};
