/**
 * Helpers for querying timing_laps without hitting PostgREST's default 1000-row limit.
 */

const { getServiceClient } = require('./supabaseClients');

/**
 * Lectura de timing_laps: si en Supabase RLS solo deja pasar service role (p. ej. sin policy para
 * authenticated), el cliente con JWT devuelve 0 filas. Los timingIds deben venir siempre de
 * vehicle_timings ya filtrados por usuario en la ruta que llama.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase — cliente con JWT (fallback)
 * @param {string[]} timingIds
 * @returns {Promise<Set<string>>}
 */
async function fetchTimingIdsWithLaps(userSupabase, timingIds) {
  const result = new Set();
  if (!timingIds || timingIds.length === 0) return result;

  const supabase = getServiceClient() || userSupabase;

  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('timing_laps')
      .select('timing_id')
      .in('timing_id', timingIds)
      .order('timing_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    (data || []).forEach((row) => result.add(row.timing_id));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return result;
}

module.exports = {
  fetchTimingIdsWithLaps,
};
