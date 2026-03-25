const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { updatePositionsAfterNewTiming } = require('../lib/positionTracker');
const { findOrCreateCircuit } = require('../lib/circuitResolver');
const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('../lib/distanceCalculator');
const { getPreviousBestLapSeconds } = require('../lib/personalBest');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.use(apiKeyAuth);

/**
 * GET /api/sync/vehicles
 * List all vehicles for the authenticated user (via API key).
 * Query: ?page=1&limit=25
 */
router.get('/vehicles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { count, error: countError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (countError) {
      return res.status(500).json({ error: countError.message });
    }

    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, model, manufacturer, type, traction')
      .eq('user_id', req.user.id)
      .order('purchase_date', { ascending: false })
      .range(from, to);

    if (vehiclesError) {
      return res.status(500).json({ error: vehiclesError.message });
    }

    const vehicleIds = vehicles.map((v) => v.id);
    let imagesMap = {};

    if (vehicleIds.length > 0) {
      const { data: images } = await supabase
        .from('vehicle_images')
        .select('vehicle_id, image_url')
        .in('vehicle_id', vehicleIds);

      if (images) {
        images.forEach((img) => {
          if (!imagesMap[img.vehicle_id]) {
            imagesMap[img.vehicle_id] = img.image_url;
          }
        });
      }
    }

    const result = vehicles.map((v) => ({
      ...v,
      image: imagesMap[v.id] || null,
    }));

    res.json({
      vehicles: result,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error en GET /api/sync/vehicles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/sync/circuits
 * List all circuits for the authenticated user (via API key).
 * Allows external apps to list circuits before sending a timing, to use circuit_id directly.
 */
router.get('/circuits', async (req, res) => {
  try {
    const { data: circuits, error } = await supabase
      .from('circuits')
      .select('id, name, description, num_lanes, lane_lengths')
      .eq('user_id', req.user.id)
      .order('name', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ circuits: circuits || [] });
  } catch (error) {
    console.error('Error en GET /api/sync/circuits:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Calculate consistency_score (coefficient of variation) and worst_lap_timestamp from lap times.
 * @param {Array<{lap_number?: number, time_seconds?: number, lap_time_seconds?: number}>} lapTimes
 * @returns {{ consistency_score?: number, worst_lap_timestamp?: number } | null}
 */
function calculateConsistencyFromLaps(lapTimes) {
  const times = lapTimes
    .map((l) => l.time_seconds ?? l.lap_time_seconds)
    .filter((t) => typeof t === 'number' && t > 0);
  if (times.length < 3) return null;
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = mean > 0 ? (stdDev / mean) * 100 : null;
  const worstLap = Math.max(...times);
  return {
    consistency_score: consistencyScore != null ? Math.round(consistencyScore * 100) / 100 : null,
    worst_lap_timestamp: worstLap,
  };
}

/**
 * POST /api/sync/timings
 * Create a new timing record for a vehicle.
 * Body: { vehicle_id, best_lap_time, total_time, laps, average_time, lane?, circuit?, timing_date?, lap_times?: [{ lap_number, time_seconds|lap_time_seconds, time_text? }] }
 */
router.post('/timings', async (req, res) => {
  try {
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
    } = req.body;

    if (!vehicle_id || !best_lap_time || !total_time || laps == null || !average_time) {
      return res.status(400).json({
        error: 'Campos requeridos: vehicle_id, best_lap_time, total_time, laps, average_time',
      });
    }

    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id, scale_factor, model')
      .eq('id', vehicle_id)
      .eq('user_id', req.user.id)
      .single();

    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    let circuitIdToStore = null;
    let circuitNameToStore = circuit || null;
    let circuitLaneLengths = [];

    if (circuit_id) {
      const { data: circuitRow, error: circuitError } = await supabase
        .from('circuits')
        .select('id, name, lane_lengths')
        .eq('id', circuit_id)
        .eq('user_id', req.user.id)
        .single();
      if (circuitError || !circuitRow) {
        return res.status(404).json({ error: 'Circuito no encontrado o no pertenece al usuario' });
      }
      circuitIdToStore = circuitRow.id;
      circuitNameToStore = circuitRow.name;
      circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
    } else if (circuit && circuit.trim()) {
      try {
        const { circuit: resolvedCircuit } = await findOrCreateCircuit(supabase, req.user.id, circuit.trim(), {
          num_lanes: 1,
          lane_lengths: [],
        });
        circuitIdToStore = resolvedCircuit.id;
        circuitNameToStore = resolvedCircuit.name;
        circuitLaneLengths = Array.isArray(resolvedCircuit.lane_lengths) ? resolvedCircuit.lane_lengths : [];
      } catch (err) {
        console.error('Error al resolver circuito:', err);
        return res.status(500).json({ error: err.message || 'Error al resolver circuito' });
      }
    }

    const { data: specs } = await supabase
      .from('technical_specs')
      .select('id')
      .eq('vehicle_id', vehicle_id);

    const specIds = (specs || []).map((s) => s.id);
    let componentsSnapshot = [];

    if (specIds.length > 0) {
      const { data: comps } = await supabase
        .from('components')
        .select('*')
        .in('tech_spec_id', specIds);
      componentsSnapshot = comps || [];
    }

    const scaleFactor = req.body.scale_factor ?? existingVehicle.scale_factor ?? DEFAULT_SCALE_FACTOR;
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
      return res.status(500).json({ error: timingError.message });
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
      } catch (positionError) {
        console.warn('Error al actualizar posiciones:', positionError);
      }
    }

    res.status(201).json(finalTiming);
  } catch (error) {
    console.error('Error en POST /api/sync/timings:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;