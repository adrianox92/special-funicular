'use strict';

const {
  POSTGREST_IN_FILTER_CHUNK,
  chunkArray,
  estimateInFilterUrlChars,
} = require('./postgrestInFilter');

const DEFAULT_SELECT = 'vehicle_id, image_url, view_type';

/**
 * Obtiene imágenes de vehículos en lotes para evitar `.in()` con cientos de UUIDs en la URL.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} vehicleIds
 * @param {{ select?: string }} [options]
 * @returns {Promise<{ data: object[]|null, error: unknown|null, meta: object }>}
 */
async function fetchVehicleImagesForVehicleIds(supabase, vehicleIds, options = {}) {
  const select = options.select ?? DEFAULT_SELECT;
  const ids = vehicleIds || [];
  const chunks = chunkArray(ids, POSTGREST_IN_FILTER_CHUNK);
  const meta = {
    vehicleCount: ids.length,
    chunkCount: chunks.length,
    chunkSize: POSTGREST_IN_FILTER_CHUNK,
    inFilterChars: estimateInFilterUrlChars(ids),
  };

  if (ids.length === 0) {
    return { data: [], error: null, meta };
  }

  /** @type {object[]} */
  let allRows = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const { data, error } = await supabase
      .from('vehicle_images')
      .select(select)
      .in('vehicle_id', chunk)
      .order('created_at', { ascending: true });

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

  return { data: allRows, error: null, meta };
}

module.exports = {
  fetchVehicleImagesForVehicleIds,
  DEFAULT_SELECT,
};
