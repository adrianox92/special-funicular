/**
 * Calculates distance and speed metrics for slot car timings.
 * Cars are at scale (1:32, 1:43, etc.) so we compute:
 * - Track speed (km/h): actual speed measured on the circuit
 * - Scale speed (km/h): equivalent speed if the car were full-size
 *
 * Formula: v_scale_kmh = (distance_m / time_s) * 3.6 * scale_factor
 */

const DEFAULT_SCALE_FACTOR = 32;

/**
 * Calculate distance and speed metrics for a timing record.
 * @param {Object} params
 * @param {number} params.laps - Number of laps
 * @param {string|number} params.lane - Lane used (1-based, e.g. "1" or 1)
 * @param {number[]} params.circuitLaneLengths - Array of lane lengths in meters from circuits.lane_lengths
 * @param {number|null} params.totalTimeSeconds - Total time in seconds
 * @param {number|null} params.bestLapSeconds - Best lap time in seconds
 * @param {number} [params.scaleFactor=32] - Scale factor (32 = 1:32)
 * @returns {Object|null} Calculated fields or null if insufficient data
 */
function calculateDistanceAndSpeed({
  laps,
  lane,
  circuitLaneLengths,
  totalTimeSeconds,
  bestLapSeconds,
  scaleFactor = DEFAULT_SCALE_FACTOR,
}) {
  const laneIndex = Math.max(0, parseInt(lane, 10) - 1);
  const laneLengths = Array.isArray(circuitLaneLengths) ? circuitLaneLengths : [];
  const trackLength = laneLengths[laneIndex];

  if (!trackLength || trackLength <= 0 || !laps || laps <= 0) {
    return null;
  }

  const totalDistance = trackLength * laps;
  const scale = scaleFactor > 0 ? scaleFactor : DEFAULT_SCALE_FACTOR;

  const trackSpeedKmh =
    totalTimeSeconds > 0 ? (totalDistance / totalTimeSeconds) * 3.6 : null;
  const bestLapTrackKmh =
    bestLapSeconds > 0 ? (trackLength / bestLapSeconds) * 3.6 : null;

  return {
    track_length_meters: Math.round(trackLength * 100) / 100,
    total_distance_meters: Math.round(totalDistance * 100) / 100,
    avg_speed_kmh: trackSpeedKmh != null ? Math.round(trackSpeedKmh * 100) / 100 : null,
    avg_speed_scale_kmh:
      trackSpeedKmh != null ? Math.round(trackSpeedKmh * scale * 100) / 100 : null,
    best_lap_speed_kmh:
      bestLapTrackKmh != null ? Math.round(bestLapTrackKmh * 100) / 100 : null,
    best_lap_speed_scale_kmh:
      bestLapTrackKmh != null ? Math.round(bestLapTrackKmh * scale * 100) / 100 : null,
  };
}

/**
 * Recalculate and return the total distance for a vehicle from all its timings.
 * Used to update vehicles.total_distance_meters.
 * @param {Object} supabase - Supabase client
 * @param {string} vehicleId - Vehicle UUID
 * @returns {Promise<number>} Total distance in meters
 */
async function recalculateVehicleTotalDistance(supabase, vehicleId) {
  const { data: vehicleTimings } = await supabase
    .from('vehicle_timings')
    .select('total_distance_meters')
    .eq('vehicle_id', vehicleId);

  let total = 0;
  for (const t of vehicleTimings || []) {
    if (t.total_distance_meters != null && !isNaN(t.total_distance_meters)) {
      total += Number(t.total_distance_meters);
    }
  }

  const { data: participants } = await supabase
    .from('competition_participants')
    .select('id')
    .eq('vehicle_id', vehicleId);

  if (participants && participants.length > 0) {
    const participantIds = participants.map((p) => p.id);
    const { data: compTimings } = await supabase
      .from('competition_timings')
      .select('total_distance_meters')
      .in('participant_id', participantIds);

    for (const t of compTimings || []) {
      if (t.total_distance_meters != null && !isNaN(t.total_distance_meters)) {
        total += Number(t.total_distance_meters);
      }
    }
  }

  return Math.round(total * 100) / 100;
}

/**
 * Update the total_distance_meters (odometer) for a vehicle.
 * @param {Object} supabase - Supabase client
 * @param {string} vehicleId - Vehicle UUID
 */
async function updateVehicleOdometer(supabase, vehicleId) {
  const total = await recalculateVehicleTotalDistance(supabase, vehicleId);
  await supabase
    .from('vehicles')
    .update({ total_distance_meters: total })
    .eq('id', vehicleId);
}

module.exports = {
  calculateDistanceAndSpeed,
  recalculateVehicleTotalDistance,
  updateVehicleOdometer,
  DEFAULT_SCALE_FACTOR,
};
