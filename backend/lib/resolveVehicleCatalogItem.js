/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null|undefined} manufacturer
 * @param {string|null|undefined} reference
 * @returns {Promise<string|null>}
 */
async function resolveCatalogItemIdFromGarageRef(supabase, manufacturer, reference) {
  const m = manufacturer != null ? String(manufacturer).trim() : '';
  const r = reference != null ? String(reference).trim() : '';
  if (!m || !r) return null;
  const { data, error } = await supabase.rpc('resolve_slot_catalog_item_by_brand_and_reference', {
    p_brand_name: m,
    p_user_reference: r,
  });
  if (error) {
    console.warn('[resolveCatalogItemIdFromGarageRef]', error.message);
    return null;
  }
  return data ?? null;
}

module.exports = { resolveCatalogItemIdFromGarageRef };
