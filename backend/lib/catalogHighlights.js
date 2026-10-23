'use strict';

const { catalogItemIsWeightedComplete } = require('./catalogCompleteness');

/** Columnas del listado público suficientes para la ficha del homepage. */
const HIGHLIGHT_SELECT =
  'id, reference, manufacturer_id, manufacturer, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, image_url';

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = { at: 0, items: null };

/**
 * Filtros de ítem 100% completo: imagen, nombre, tipo, tracción, motor y año.
 * Misma regla que `catalogItemIsWeightedComplete`.
 */
function applyWeightedCompleteFilters(query) {
  return query
    .not('image_url', 'is', null)
    .neq('image_url', '')
    .not('model_name', 'is', null)
    .neq('model_name', '')
    .not('vehicle_type', 'is', null)
    .neq('vehicle_type', '')
    .not('traction', 'is', null)
    .neq('traction', '')
    .not('motor_position', 'is', null)
    .neq('motor_position', '')
    .gte('commercial_release_year', 1900)
    .lte('commercial_release_year', 2100);
}

/**
 * Un modelo 100% completo por marca, el mejor valorado de cada una.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ force?: boolean }} [opts]
 */
async function fetchCatalogCompleteHighlights(supabase, opts = {}) {
  const now = Date.now();
  if (!opts.force && cache.items && now - cache.at < CACHE_TTL_MS) {
    return cache.items;
  }

  const { data: brands, error } = await supabase
    .from('slot_catalog_brands')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);

  const picked = await Promise.all(
    (brands || []).map(async (brand) => {
      const query = applyWeightedCompleteFilters(
        supabase
          .from('slot_catalog_items_with_ratings')
          .select(HIGHLIGHT_SELECT)
          .eq('manufacturer_id', brand.id),
      );
      const { data, error: itemErr } = await query
        .order('rating_avg', { ascending: false, nullsFirst: false })
        .order('reference', { ascending: true })
        .limit(1);
      if (itemErr || !data?.[0]) return null;
      const row = data[0];
      if (!catalogItemIsWeightedComplete(row)) return null;
      return row;
    }),
  );

  const items = picked
    .filter(Boolean)
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
  applyWeightedCompleteFilters,
};
