const { findOrCreateCircuit } = require('./circuitResolver');
const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('./distanceCalculator');
const { getPreviousBestLapSeconds } = require('./personalBest');
const { updatePositionsAfterNewTiming } = require('./positionTracker');
const { calculateConsistencyFromLaps } = require('./timingUtils');

/**
 * Inserta una sesión de cronometraje (misma lógica que POST /api/sync/timings).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ success: true, finalTiming: object, previousBestLapSeconds: number|null } | { success: false, error: string, status: number }>}
 */
async function insertVehicleTimingFromSyncBody(supabase, userId, body) {
  const {
    vehicle_id,
    best_lap_time,
    total_time,
    laps,
    average_time,
    lane,
    circuit,
    circuit_id,
    timing_date,
    best_lap_timestamp,
    total_time_timestamp,
    average_time_timestamp,
    lap_times,
    scale_factor: bodyScaleFactor,
  } = body;

  if (!vehicle_id || !best_lap_time || !total_time || laps == null || !average_time) {
    return {
      success: false,
      error: 'Campos requeridos: vehicle_id, best_lap_time, total_time, laps, average_time',
      status: 400,
    };
  }

  const { data: existingVehicle, error: checkError } = await supabase
    .from('vehicles')
    .select('id, scale_factor, model')
    .eq('id', vehicle_id)
    .eq('user_id', userId)
    .single();

  if (checkError || !existingVehicle) {
    return { success: false, error: 'Vehículo no encontrado', status: 404 };
  }

  let circuitIdToStore = null;
  let circuitNameToStore = circuit || null;
  let circuitLaneLengths = [];

  if (circuit_id) {
    const { data: circuitRow, error: circuitError } = await supabase
      .from('circuits')
      .select('id, name, lane_lengths')
      .eq('id', circuit_id)
      .eq('user_id', userId)
      .single();
    if (circuitError || !circuitRow) {
      return { success: false, error: 'Circuito no encontrado o no pertenece al usuario', status: 404 };
    }
    circuitIdToStore = circuitRow.id;
    circuitNameToStore = circuitRow.name;
    circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
  } else if (circuit && String(circuit).trim()) {
    try {
      const { circuit: resolvedCircuit } = await findOrCreateCircuit(supabase, userId, String(circuit).trim(), {
        num_lanes: 1,
        lane_lengths: [],
      });
      circuitIdToStore = resolvedCircuit.id;
      circuitNameToStore = resolvedCircuit.name;
      circuitLaneLengths = Array.isArray(resolvedCircuit.lane_lengths) ? resolvedCircuit.lane_lengths : [];
    } catch (err) {
      console.error('Error al resolver circuito:', err);
      return {
        success: false,
        error: err.message || 'Error al resolver circuito',
        status: 500,
      };
    }
  }

  const { data: specs } = await supabase.from('technical_specs').select('id').eq('vehicle_id', vehicle_id);

  const specIds = (specs || []).map((s) => s.id);
  let componentsSnapshot = [];

  if (specIds.length > 0) {
    const { data: comps } = await supabase.from('components').select('*').in('tech_spec_id', specIds);
    componentsSnapshot = comps || [];
  }

  const scaleFactor = bodyScaleFactor ?? existingVehicle.scale_factor ?? DEFAULT_SCALE_FACTOR;
  const distanceSpeed = calculateDistanceAndSpeed({
    laps,
    lane,
    circuitLaneLengths,
    totalTimeSeconds: total_time_timestamp,
    bestLapSeconds: best_lap_timestamp,
    scaleFactor,
  });

  const timingData = {
    vehicle_id,
    best_lap_time,
    total_time,
    laps,
    average_time,
    lane: lane || null,
    circuit: circuitNameToStore,
    circuit_id: circuitIdToStore,
    timing_date: timing_date || new Date().toISOString().split('T')[0],
    setup_snapshot: JSON.stringify(componentsSnapshot),
    best_lap_timestamp: best_lap_timestamp || null,
    total_time_timestamp: total_time_timestamp || null,
    average_time_timestamp: average_time_timestamp || null,
  };
  if (distanceSpeed) {
    Object.assign(timingData, distanceSpeed);
  }

  let previousBestLapSeconds = null;
  if (circuitIdToStore) {
    previousBestLapSeconds = await getPreviousBestLapSeconds(supabase, {
      vehicle_id,
      circuit_id: circuitIdToStore,
      lane,
      laps,
    });
  }

  const { data: timing, error: timingError } = await supabase
    .from('vehicle_timings')
    .insert([timingData])
    .select()
    .single();

  if (timingError) {
    return { success: false, error: timingError.message, status: 500 };
  }

  let finalTiming = { ...timing };

  if (Array.isArray(lap_times) && lap_times.length > 0) {
    const lapsToInsert = lap_times
      .map((l, idx) => ({
        timing_id: timing.id,
        lap_number: l.lap_number ?? l.lapNumber ?? idx + 1,
        lap_time_seconds: l.time_seconds ?? l.lap_time_seconds ?? l.lapTimeSeconds ?? 0,
        lap_time_text: l.time_text ?? l.lap_time_text ?? null,
      }))
      .filter((l) => l.lap_time_seconds > 0);

    if (lapsToInsert.length === 0) {
      console.warn('lap_times recibido pero sin vueltas válidas (time_seconds > 0)');
    } else {
      const { error: lapsError } = await supabase.from('timing_laps').insert(lapsToInsert);
      if (lapsError) {
        console.warn('Error al insertar vueltas individuales:', lapsError);
      } else {
        const consistencyData = calculateConsistencyFromLaps(lapsToInsert);
        if (consistencyData) {
          const { data: updated, error: updateErr } = await supabase
            .from('vehicle_timings')
            .update(consistencyData)
            .eq('id', timing.id)
            .select()
            .single();
          if (!updateErr && updated) finalTiming = updated;
        }
      }
    }
  }

  try {
    await updateVehicleOdometer(supabase, vehicle_id);
  } catch (odometerError) {
    console.warn('Error al actualizar odómetro:', odometerError);
  }

  if (circuitNameToStore) {
    try {
      await updatePositionsAfterNewTiming(circuitNameToStore, timing.id);
      const { data: posRow, error: posErr } = await supabase
        .from('vehicle_timings')
        .select('current_position, previous_position, position_change')
        .eq('id', timing.id)
        .single();
      if (!posErr && posRow) {
        finalTiming = { ...finalTiming, ...posRow };
      }
    } catch (positionError) {
      console.warn('Error al actualizar posiciones:', positionError);
    }
  }

  return { success: true, finalTiming, previousBestLapSeconds };
}

module.exports = {
  insertVehicleTimingFromSyncBody,
};
