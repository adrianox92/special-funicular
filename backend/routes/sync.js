const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { updatePositionsAfterNewTiming } = require('../lib/positionTracker');

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
 * POST /api/sync/timings
 * Create a new timing record for a vehicle.
 * Body: { vehicle_id, best_lap_time, total_time, laps, average_time, lane?, circuit?, timing_date? }
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
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      average_time_timestamp,
    } = req.body;

    if (!vehicle_id || !best_lap_time || !total_time || laps == null || !average_time) {
      return res.status(400).json({
        error: 'Campos requeridos: vehicle_id, best_lap_time, total_time, laps, average_time',
      });
    }

    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', vehicle_id)
      .eq('user_id', req.user.id)
      .single();

    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
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

    const timingData = {
      vehicle_id,
      best_lap_time,
      total_time,
      laps,
      average_time,
      lane: lane || null,
      circuit: circuit || null,
      timing_date: timing_date || new Date().toISOString().split('T')[0],
      setup_snapshot: JSON.stringify(componentsSnapshot),
      best_lap_timestamp: best_lap_timestamp || null,
      total_time_timestamp: total_time_timestamp || null,
      average_time_timestamp: average_time_timestamp || null,
    };

    const { data: timing, error: timingError } = await supabase
      .from('vehicle_timings')
      .insert([timingData])
      .select()
      .single();

    if (timingError) {
      return res.status(500).json({ error: timingError.message });
    }

    if (circuit) {
      try {
        await updatePositionsAfterNewTiming(circuit, timing.id);
      } catch (positionError) {
        console.warn('Error al actualizar posiciones:', positionError);
      }
    }

    res.status(201).json(timing);
  } catch (error) {
    console.error('Error en POST /api/sync/timings:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;