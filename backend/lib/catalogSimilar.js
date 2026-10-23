/**
 * Vehículos similares de una ficha pública.
 *
 * Si la ficha tiene `car_make` y `car_model`, se usan esos (cualquier tipo y marca de slot).
 * Si no, mismo `vehicle_type` y mismo `model_name` (trim, sin distinguir mayúsculas).
 * Se excluye el ítem actual.
 * Si hay menos de 2, la ficha no lleva bloque (`[]`).
 */

const VIEW = 'slot_catalog_items_with_ratings';
const SIMILAR_MIN = 2;
const SIMILAR_LIMIT = 4;

/** Mismo select que el listado público (sin `created_at`). */
const SIMILAR_SELECT =
  'id, reference, manufacturer_id, manufacturer, manufacturer_slug, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, discontinued, upcoming_release, dorsal, limited_edition, limited_edition_total, real_race_results_url, real_race_photos_url, image_url, updated_at, rating_avg, rating_count, car_make, car_model';

function normalizeExact(value) {
  if (value == null) return '';
  return String(value).trim();
}

/** ILIKE exacto: escapa comodines para que no haya coincidencia parcial. */
function escapeIlikeExact(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Descarta el ítem actual, capa a 4 y oculta el bloque si quedan menos de 2.
 * @param {unknown} rows
 * @param {string} currentId
 * @returns {object[]}
 */
function finalizeSimilarRows(rows, currentId) {
  const list = (Array.isArray(rows) ? rows : []).filter(
    (row) => row && row.id != null && String(row.id) !== String(currentId),
  );
  const capped = list.slice(0, SIMILAR_LIMIT);
  if (capped.length < SIMILAR_MIN) return [];
  return capped;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string, model_name?: string|null, vehicle_type?: string|null }} item
 * @returns {Promise<object[]>}
 */
function similarQuery(supabase) {
  return supabase
    .from(VIEW)
    .select(SIMILAR_SELECT);
}

function orderSimilar(query, id) {
  return query
    .neq('id', id)
    .order('rating_count', { ascending: false, nullsFirst: false })
    .order('manufacturer', { ascending: true, nullsFirst: false })
    .order('reference', { ascending: true })
    .limit(SIMILAR_LIMIT);
}

async function fetchCatalogSimilar(supabase, item) {
  const id = item && item.id != null ? String(item.id) : '';
  if (!id) return [];

  const carMake = normalizeExact(item && item.car_make);
  const carModel = normalizeExact(item && item.car_model);
  const modelName = normalizeExact(item && item.model_name);
  const vehicleType = normalizeExact(item && item.vehicle_type);
  const byIdentity = Boolean(carMake && carModel);
  if (!byIdentity && (!modelName || !vehicleType)) return [];

  let query = similarQuery(supabase);
  query = byIdentity
    ? query.ilike('car_make', escapeIlikeExact(carMake)).ilike('car_model', escapeIlikeExact(carModel))
    : query.eq('vehicle_type', vehicleType).ilike('model_name', escapeIlikeExact(modelName));

  const { data, error } = await orderSimilar(query, id);
  if (error) throw error;
  return finalizeSimilarRows(data, id);
}

module.exports = {
  VIEW,
  SIMILAR_MIN,
  SIMILAR_LIMIT,
  SIMILAR_SELECT,
  escapeIlikeExact,
  finalizeSimilarRows,
  fetchCatalogSimilar,
};
