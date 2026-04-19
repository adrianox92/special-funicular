/**
 * Helpers for querying timing_laps without hitting PostgREST's default 1000-row limit.
 */

/**
 * Returns a Set of timing_id values that have at least one row in timing_laps.
 * Paginates to avoid truncating bulk selects.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} timingIds
 * @returns {Promise<Set<string>>}
 */
async function fetchTimingIdsWithLaps(supabase, timingIds) {
  const result = new Set();
  if (!timingIds || timingIds.length === 0) return result;

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
