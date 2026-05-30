'use strict';

const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('./distanceCalculator');
const { deriveCompetitionAverageFromTotalAndLaps } = require('./competitionTimingDerivation');
const { normalizeStatus, timingForbiddenReason } = require('./competitionLifecycle');

function formatAdjustedTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(3);
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
}

function enrichTimingsWithPenalty(rows) {
  return (rows || []).map((t) => {
    const penalty = Number(t.penalty_seconds) || 0;
    const totalTime = Number(t.total_time_timestamp) || 0;
    const adjustedTotal = totalTime + penalty;
    return {
      ...t,
      penalty_seconds: penalty,
      adjusted_total_time_timestamp: adjustedTotal,
      adjusted_total_time: formatAdjustedTime(adjustedTotal),
    };
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function listCompetitionTimings(supabase, competitionId, query = {}) {
  const { round_number, participant_id } = query;
  let dbQuery = supabase
    .from('competition_timings')
    .select(`
      *,
      competition_participants!inner(
        id,
        competition_id
      )
    `)
    .eq('competition_participants.competition_id', competitionId)
    .order('round_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (round_number) dbQuery = dbQuery.eq('round_number', round_number);
  if (participant_id) dbQuery = dbQuery.eq('participant_id', participant_id);

  const { data, error } = await dbQuery;
  if (error) return { error: { status: 500, message: error.message } };
  return { data: enrichTimingsWithPenalty(data) };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function listCompetitionParticipants(supabase, competitionId) {
  const { data, error } = await supabase
    .from('competition_participants')
    .select(`
      *,
      vehicles(model, manufacturer)
    `)
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: true });

  if (error) return { error: { status: 500, message: error.message } };
  return { data: data || [] };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function verifyTimingInCompetition(supabase, competitionId, timingId) {
  const { data: existingTiming, error: timingError } = await supabase
    .from('competition_timings')
    .select('id, participant_id, lane, total_time_timestamp, best_lap_timestamp, circuit_id')
    .eq('id', timingId)
    .single();

  if (timingError || !existingTiming) {
    return { error: { status: 404, message: 'Tiempo no encontrado' } };
  }

  const { data: participant, error: partError } = await supabase
    .from('competition_participants')
    .select('id, vehicle_id')
    .eq('id', existingTiming.participant_id)
    .eq('competition_id', competitionId)
    .single();

  if (partError || !participant) {
    return { error: { status: 404, message: 'Participante no encontrado en esta competición' } };
  }

  return { existingTiming, participant };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function createCompetitionTiming(supabase, competitionId, competition, body) {
  const {
    participant_id,
    best_lap_time,
    total_time,
    laps,
    lane,
    driver,
    timing_date,
    best_lap_timestamp,
    total_time_timestamp,
    setup_snapshot,
    circuit,
    circuit_id,
    round_number,
    did_not_participate,
  } = body;

  const isDnp = Boolean(did_not_participate);

  const timingBlock = timingForbiddenReason(competition.status);
  if (timingBlock) {
    return { error: { status: 400, message: timingBlock } };
  }

  const { data: participant, error: partError } = await supabase
    .from('competition_participants')
    .select('id, vehicle_id')
    .eq('id', participant_id)
    .eq('competition_id', competitionId)
    .single();

  if (partError || !participant) {
    return { error: { status: 404, message: 'Participante no encontrado en esta competición' } };
  }

  let scaleFactor = DEFAULT_SCALE_FACTOR;
  if (participant.vehicle_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('scale_factor')
      .eq('id', participant.vehicle_id)
      .single();
    if (vehicle?.scale_factor) scaleFactor = vehicle.scale_factor;
  }

  let derivedAverage = null;
  if (!isDnp) {
    if (!best_lap_time || !total_time || laps === undefined || laps === null || laps === '') {
      return { error: { status: 400, message: 'Mejor vuelta, tiempo total y vueltas son requeridos' } };
    }
    derivedAverage = deriveCompetitionAverageFromTotalAndLaps(total_time, laps);
    if (!derivedAverage) {
      return {
        error: {
          status: 400,
          message: 'Tiempo total debe ser mm:ss.mmm y el número de vueltas un entero mayor que 0',
        },
      };
    }
  }

  if (!round_number || round_number <= 0 || round_number > competition.rounds) {
    return {
      error: {
        status: 400,
        message: `El número de ronda debe estar entre 1 y ${competition.rounds}`,
      },
    };
  }

  const { data: existingTiming } = await supabase
    .from('competition_timings')
    .select('id')
    .eq('participant_id', participant_id)
    .eq('round_number', round_number)
    .single();

  if (existingTiming) {
    return {
      error: {
        status: 400,
        message: `Ya existe un tiempo registrado para este participante en la ronda ${round_number}`,
      },
    };
  }

  let timingsBefore = 0;
  const { data: partRowsForCount } = await supabase
    .from('competition_participants')
    .select('id')
    .eq('competition_id', competitionId);
  const pidList = (partRowsForCount || []).map((p) => p.id);
  if (pidList.length > 0) {
    const { count: tb } = await supabase
      .from('competition_timings')
      .select('*', { count: 'exact', head: true })
      .in('participant_id', pidList);
    timingsBefore = tb || 0;
  }

  const timingData = isDnp
    ? {
        participant_id,
        did_not_participate: true,
        best_lap_time: '00:00.000',
        total_time: '00:00.000',
        laps: 0,
        average_time: '00:00.000',
        round_number,
        timing_date: timing_date || new Date().toISOString().split('T')[0],
      }
    : {
        participant_id,
        did_not_participate: false,
        best_lap_time,
        total_time,
        laps,
        average_time: derivedAverage.average_time,
        average_time_timestamp: derivedAverage.average_time_timestamp,
        round_number,
        timing_date: timing_date || new Date().toISOString().split('T')[0],
      };

  if (!isDnp) {
    if (lane) timingData.lane = lane;
    if (driver) timingData.driver = driver;
    if (best_lap_timestamp) timingData.best_lap_timestamp = best_lap_timestamp;
    if (total_time_timestamp) timingData.total_time_timestamp = total_time_timestamp;
    if (setup_snapshot) timingData.setup_snapshot = setup_snapshot;
  }

  let circuitLaneLengths = [];
  if (!isDnp && circuit_id) {
    const { data: circuitRow, error: circuitError } = await supabase
      .from('circuits')
      .select('name, lane_lengths')
      .eq('id', circuit_id)
      .eq('user_id', competition.organizer)
      .single();
    if (!circuitError && circuitRow) {
      timingData.circuit_id = circuit_id;
      timingData.circuit = circuitRow.name;
      circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
    }
  } else if (!isDnp && circuit) {
    timingData.circuit = circuit;
  }

  if (!isDnp) {
    const distanceSpeed = calculateDistanceAndSpeed({
      laps,
      lane,
      circuitLaneLengths,
      totalTimeSeconds: total_time_timestamp,
      bestLapSeconds: best_lap_timestamp,
      scaleFactor,
    });
    if (distanceSpeed) Object.assign(timingData, distanceSpeed);
  }

  const { data, error } = await supabase
    .from('competition_timings')
    .insert([timingData])
    .select()
    .single();

  if (error) {
    console.error('Error al registrar tiempo:', error);
    return { error: { status: 500, message: error.message } };
  }

  if (normalizeStatus(competition) === 'published' && timingsBefore === 0) {
    const { error: stErr } = await supabase
      .from('competitions')
      .update({ status: 'running' })
      .eq('id', competitionId);
    if (stErr) console.warn('No se pudo pasar la competición a en_curso:', stErr.message);
  }

  if (!isDnp && participant.vehicle_id) {
    try {
      await updateVehicleOdometer(supabase, participant.vehicle_id);
    } catch (odometerError) {
      console.warn('Error al actualizar odómetro:', odometerError);
    }
  }

  return { data, status: 201 };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function updateCompetitionTiming(supabase, competitionId, competition, timingId, body) {
  const {
    best_lap_time,
    total_time,
    laps,
    lane,
    driver,
    timing_date,
    best_lap_timestamp,
    total_time_timestamp,
    setup_snapshot,
    circuit,
    circuit_id,
    did_not_participate,
  } = body;

  const isDnp = Boolean(did_not_participate);

  const timingBlockPut = timingForbiddenReason(competition.status);
  if (timingBlockPut) {
    return { error: { status: 400, message: timingBlockPut } };
  }

  const verified = await verifyTimingInCompetition(supabase, competitionId, timingId);
  if (verified.error) return verified;
  const { existingTiming, participant } = verified;

  let scaleFactor = DEFAULT_SCALE_FACTOR;
  if (participant.vehicle_id) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('scale_factor')
      .eq('id', participant.vehicle_id)
      .single();
    if (vehicle?.scale_factor) scaleFactor = vehicle.scale_factor;
  }

  let derivedAverage = null;
  if (!isDnp) {
    if (!best_lap_time || !total_time || laps === undefined || laps === null || laps === '') {
      return { error: { status: 400, message: 'Mejor vuelta, tiempo total y vueltas son requeridos' } };
    }
    derivedAverage = deriveCompetitionAverageFromTotalAndLaps(total_time, laps);
    if (!derivedAverage) {
      return {
        error: {
          status: 400,
          message: 'Tiempo total debe ser mm:ss.mmm y el número de vueltas un entero mayor que 0',
        },
      };
    }
  }

  const updateData = isDnp
    ? {
        did_not_participate: true,
        best_lap_time: '00:00.000',
        total_time: '00:00.000',
        laps: 0,
        average_time: '00:00.000',
        average_time_timestamp: null,
        best_lap_timestamp: null,
        total_time_timestamp: null,
        penalty_seconds: 0,
        track_length_meters: null,
        total_distance_meters: null,
        avg_speed_kmh: null,
        avg_speed_scale_kmh: null,
        best_lap_speed_kmh: null,
        best_lap_speed_scale_kmh: null,
      }
    : {
        did_not_participate: false,
        best_lap_time,
        total_time,
        laps,
        average_time: derivedAverage.average_time,
        average_time_timestamp: derivedAverage.average_time_timestamp,
      };

  if (isDnp) {
    if (timing_date) updateData.timing_date = timing_date;
    updateData.lane = null;
    updateData.driver = null;
    updateData.setup_snapshot = null;
    updateData.circuit_id = null;
    updateData.circuit = null;
  } else {
    if (lane !== undefined) updateData.lane = lane;
    if (driver !== undefined) updateData.driver = driver;
    if (timing_date) updateData.timing_date = timing_date;
    if (best_lap_timestamp !== undefined) updateData.best_lap_timestamp = best_lap_timestamp;
    if (total_time_timestamp !== undefined) updateData.total_time_timestamp = total_time_timestamp;
    if (setup_snapshot !== undefined) updateData.setup_snapshot = setup_snapshot;
    let circuitLaneLengths = [];
    if (circuit_id !== undefined) {
      if (circuit_id) {
        const { data: circuitRow, error: circuitError } = await supabase
          .from('circuits')
          .select('name, lane_lengths')
          .eq('id', circuit_id)
          .eq('user_id', competition.organizer)
          .single();
        if (!circuitError && circuitRow) {
          updateData.circuit_id = circuit_id;
          updateData.circuit = circuitRow.name;
          circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
        }
      } else {
        updateData.circuit_id = null;
        updateData.circuit = null;
      }
    } else if (circuit !== undefined) {
      updateData.circuit = circuit;
    } else if (existingTiming.circuit_id) {
      const { data: circuitRow } = await supabase
        .from('circuits')
        .select('lane_lengths')
        .eq('id', existingTiming.circuit_id)
        .single();
      if (circuitRow) {
        circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
      }
    }

    const effectiveLane = lane !== undefined ? lane : existingTiming.lane;
    const effectiveTotalTime = total_time_timestamp ?? existingTiming.total_time_timestamp;
    const effectiveBestLap = best_lap_timestamp ?? existingTiming.best_lap_timestamp;
    const distanceSpeed = calculateDistanceAndSpeed({
      laps,
      lane: effectiveLane,
      circuitLaneLengths,
      totalTimeSeconds: effectiveTotalTime,
      bestLapSeconds: effectiveBestLap,
      scaleFactor,
    });
    if (distanceSpeed) {
      Object.assign(updateData, distanceSpeed);
    } else {
      updateData.track_length_meters = null;
      updateData.total_distance_meters = null;
      updateData.avg_speed_kmh = null;
      updateData.avg_speed_scale_kmh = null;
      updateData.best_lap_speed_kmh = null;
      updateData.best_lap_speed_scale_kmh = null;
    }
  }

  const { data, error } = await supabase
    .from('competition_timings')
    .update(updateData)
    .eq('id', timingId)
    .select()
    .single();

  if (error) {
    console.error('Error al actualizar tiempo:', error);
    return { error: { status: 500, message: error.message } };
  }

  if (!isDnp && participant.vehicle_id) {
    try {
      await updateVehicleOdometer(supabase, participant.vehicle_id);
    } catch (odometerError) {
      console.warn('Error al actualizar odómetro:', odometerError);
    }
  }

  return { data };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function updateCompetitionTimingPenalty(supabase, competitionId, timingId, penaltySeconds) {
  const verified = await verifyTimingInCompetition(supabase, competitionId, timingId);
  if (verified.error) return verified;

  const { error } = await supabase
    .from('competition_timings')
    .update({ penalty_seconds: penaltySeconds })
    .eq('id', timingId);

  if (error) return { error: { status: 500, message: error.message } };
  return { success: true };
}

function toPublicRefereeCompetition(competition) {
  return {
    id: competition.id,
    name: competition.name,
    rounds: competition.rounds,
    circuit_id: competition.circuit_id ?? null,
    status: competition.status,
  };
}

function sendHandlerError(res, err) {
  return res.status(err.status).json({ error: err.message });
}

module.exports = {
  enrichTimingsWithPenalty,
  listCompetitionTimings,
  listCompetitionParticipants,
  createCompetitionTiming,
  updateCompetitionTiming,
  updateCompetitionTimingPenalty,
  toPublicRefereeCompetition,
  sendHandlerError,
};
