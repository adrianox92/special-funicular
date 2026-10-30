'use strict';

const { POSTGREST_IN_FILTER_CHUNK, chunkArray } = require('./postgrestInFilter');

/**
 * URLs de foto de ficha por id de catálogo. Solo incluye filas con image_url no vacía.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<string|null|undefined>} catalogItemIds
 * @returns {Promise<{ map: Map<string, string>, error: unknown|null }>}
 */
async function fetchCatalogImageUrlsByIds(supabase, catalogItemIds) {
  const ids = [...new Set((catalogItemIds || []).filter(Boolean))];
  /** @type {Map<string, string>} */
  const map = new Map();
  if (ids.length === 0) return { map, error: null };

  const chunks = chunkArray(ids, POSTGREST_IN_FILTER_CHUNK);
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('slot_catalog_items')
      .select('id, image_url')
      .in('id', chunk);
    if (error) return { map, error };
    for (const row of data || []) {
      const url = row.image_url != null ? String(row.image_url).trim() : '';
      if (url) map.set(row.id, url);
    }
  }

  return { map, error: null };
}

module.exports = { fetchCatalogImageUrlsByIds };
