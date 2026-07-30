'use strict';

const {
  POSTGREST_IN_FILTER_CHUNK,
  chunkArray,
  estimateInFilterUrlChars,
} = require('./postgrestInFilter');

const DEFAULT_SELECT =
  'vehicle_id, timing_date, circuit_id, circuit, circuits(id, name)';

/**
 * Obtiene tiempos de vehículos en lotes para evitar `.in()` con cientos de UUIDs en la URL.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} vehicleIds
 * @param {{ limit?: number, select?: string }} [options]
 * @returns {Promise<{ data: object[]|null, error: unknown|null, meta: object }>}
 */
async function fetchVehicleTimingsForVehicleIds(supabase, vehicleIds, options = {}) {
  const limit = options.limit ?? 8000;
  const select = options.select ?? DEFAULT_SELECT;
  const ids = vehicleIds || [];
  const chunks = chunkArray(ids, POSTGREST_IN_FILTER_CHUNK);
  const meta = {
    vehicleCount: ids.length,
    chunkCount: chunks.length,
    chunkSize: POSTGREST_IN_FILTER_CHUNK,
    inFilterChars: estimateInFilterUrlChars(ids),
    limit,
  };

  if (ids.length === 0) {
    return { data: [], error: null, meta };
  }

  /** @type {object[]} */
  let allRows = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const { data, error } = await supabase
      .from('vehicle_timings')
      .select(select)
      .in('vehicle_id', chunk)
      .order('timing_date', { ascending: false })
      .limit(limit);

    if (error) {
      return {
        data: null,
        error,
        meta: {
          ...meta,
          failedChunkIndex: i,
          failedChunkSize: chunk.length,
          failedChunkInFilterChars: estimateInFilterUrlChars(chunk),
        },
      };
    }

    if (data?.length) {
      allRows = allRows.concat(data);
    }
  }

  allRows.sort((a, b) => new Date(b.timing_date).getTime() - new Date(a.timing_date).getTime());
  if (allRows.length > limit) {
    allRows = allRows.slice(0, limit);
  }

  return { data: allRows, error: null, meta };
}

module.exports = {
  fetchVehicleTimingsForVehicleIds,
  DEFAULT_SELECT,
};
