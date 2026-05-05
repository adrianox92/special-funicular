const express = require('express');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const authMiddleware = require('../middleware/auth');
const { insertVehicleTimingFromSyncBody } = require('../lib/vehicleTimingInsert');
const { findOrCreateCircuit } = require('../lib/circuitResolver');
const { sendTimingNotification, sendTestNotification } = require('../lib/notifier');

const router = express.Router();
const supabase = getAnonClient();

/** Cliente para escrituras de sync: service role evita RLS que bloquea timing_laps con anon (sesión SÍ, vueltas NO). */
function supabaseForSyncWrite() {
  return getServiceClient() || supabase;
}

/**
 * POST /api/sync/test-notification
 * JWT (Perfil web). Prueba Discord/Telegram configurados en user_metadata.
 */
router.post('/test-notification', authMiddleware, async (req, res) => {
  try {
    await sendTestNotification(req.user.id);
    res.json({ ok: true, message: 'Notificación de prueba enviada.' });
  } catch (e) {
    if (e.code === 'NO_CHANNELS') {
      return res.status(400).json({ error: e.message });
    }
    console.error('test-notification:', e);
    res.status(500).json({ error: e.message || 'Error al enviar la prueba' });
  }
});

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
 * POST /api/sync/circuits
 * Busca un circuito por nombre o lo crea (misma semántica que al enviar timings solo con nombre).
 * Body: { name, description?, num_lanes?, lane_lengths? }
 */
router.post('/circuits', async (req, res) => {
  try {
    const { name, description, num_lanes, lane_lengths } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const { circuit, created } = await findOrCreateCircuit(supabase, req.user.id, String(name).trim(), {
      description,
      num_lanes,
      lane_lengths,
    });
    res.status(created ? 201 : 200).json(circuit);
  } catch (error) {
    console.error('Error en POST /api/sync/circuits:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

/**
 * POST /api/sync/timings
 * Create a new timing record for a vehicle.
 * Body: { vehicle_id, best_lap_time, total_time, laps, average_time, lane?, circuit?, circuit_id?, timing_date?, session_type?: 'HEAT'|'TRAINING', supply_voltage_volts?: number (0-30), voltage? (alias), lap_times?: [{ lap_number, time_seconds|lap_time_seconds, time_text? }] }
 */
router.post('/timings', async (req, res) => {
  try {
    const db = supabaseForSyncWrite();
    const result = await insertVehicleTimingFromSyncBody(db, req.user.id, req.body);
    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    const { finalTiming, previousBestLapSeconds } = result;

    sendTimingNotification(req.user.id, finalTiming, previousBestLapSeconds, db).catch(() => {});

    res.status(201).json(finalTiming);
  } catch (error) {
    console.error('Error en POST /api/sync/timings:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const syncCompetitionsRoute = require('./syncCompetitions');
router.use(syncCompetitionsRoute);

module.exports = router;
