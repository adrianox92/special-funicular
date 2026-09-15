'use strict';

/** PostgREST trunca en 1000 filas; hay que paginar para no perder marcas. */
const VEHICLE_MANUFACTURER_PAGE_SIZE = 1000;

/**
 * Nombres de fabricante distintos en la colección del usuario (autocompletado del filtro).
 * Recorre todas las páginas; un único `.select()` se queda en las primeras 1000 filas.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function fetchDistinctVehicleManufacturers(supabase, userId) {
  const set = new Set();
  let from = 0;
  while (true) {
    const to = from + VEHICLE_MANUFACTURER_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, manufacturer')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = data || [];
    for (const row of rows) {
      const m = row?.manufacturer;
      if (m != null && String(m).trim() !== '') set.add(String(m).trim());
    }
    if (rows.length < VEHICLE_MANUFACTURER_PAGE_SIZE) break;
    from += VEHICLE_MANUFACTURER_PAGE_SIZE;
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

module.exports = {
  VEHICLE_MANUFACTURER_PAGE_SIZE,
  fetchDistinctVehicleManufacturers,
};
