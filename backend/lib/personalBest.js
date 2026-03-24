const { timeToSeconds } = require('./positionTracker');

/**
 * Mejor vuelta en segundos desde una fila vehicle_timings.
 * @param {{ best_lap_timestamp?: number|null, best_lap_time?: string|null }} row
 * @returns {number|null}
 */
function bestLapSecondsFromTimingRow(row) {
  if (row.best_lap_timestamp != null && Number(row.best_lap_timestamp) > 0) {
    return Number(row.best_lap_timestamp);
  }
  const t = timeToSeconds(row.best_lap_time);
  return t === Infinity ? null : t;
}

/**
 * Mejor vuelta en segundos desde el payload de un nuevo timing (antes de insertar).
 * @param {{ best_lap_timestamp?: number|null, best_lap_time?: string|null }} input
 * @returns {number|null}
 */
function bestLapSecondsFromInput(input) {
  if (input.best_lap_timestamp != null && Number(input.best_lap_timestamp) > 0) {
    return Number(input.best_lap_timestamp);
  }
  const t = timeToSeconds(input.best_lap_time);
  return t === Infinity ? null : t;
}

/**
 * Mínimo histórico de mejor vuelta para el mismo vehículo, circuito, carril y número de vueltas.
 * Solo con circuit_id (evita mezclar circuitos sin ID).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ vehicle_id: string, circuit_id: string, lane: string|null|undefined, laps: number }} params
 * @returns {Promise<number|null>} null si no hay marcas previas válidas
 */
async function getPreviousBestLapSeconds(supabase, { vehicle_id, circuit_id, lane, laps }) {
  if (!circuit_id) return null;

  const lapsNum = Number(laps);
  if (Number.isNaN(lapsNum)) return null;

  let query = supabase
    .from('vehicle_timings')
    .select('best_lap_timestamp, best_lap_time')
    .eq('vehicle_id', vehicle_id)
    .eq('circuit_id', circuit_id)
    .eq('laps', lapsNum);

  if (lane == null || lane === '') {
    query = query.is('lane', null);
  } else {
    query = query.eq('lane', lane);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  let min = null;
  for (const row of data) {
    const s = bestLapSecondsFromTimingRow(row);
    if (s == null) continue;
    if (min == null || s < min) min = s;
  }
  return min;
}

module.exports = {
  bestLapSecondsFromTimingRow,
  bestLapSecondsFromInput,
  getPreviousBestLapSeconds,
};
