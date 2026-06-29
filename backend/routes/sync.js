const express = require('express');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const authMiddleware = require('../middleware/auth');
const { insertVehicleTimingFromSyncBody } = require('../lib/vehicleTimingInsert');
const { resolveClientContext } = require('../lib/clientApp');
const { findOrCreateCircuit } = require('../lib/circuitResolver');
const { sendTimingNotification, sendTestNotification } = require('../lib/notifier');
const {
  resolveBaselineTimings,
  sortTimingsByBestLap,
} = require('../lib/syncTimingsQuery');

const router = express.Router();
const supabase = getAnonClient();

/** Cliente para escrituras de sync: service role evita RLS (p. ej. timing_laps, circuits) cuando la petición usa API key sin JWT en PostgREST. */
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

router.use((req, res, next) => {
  if (req.method === 'GET' && req.path === '/timings') {
    console.log(
      '[sync:timings:request]',
      JSON.stringify({
        at: new Date().toISOString(),
        userId: req.user?.id ?? null,
        vehicle_id: req.query.vehicle_id ?? null,
        circuit_id: req.query.circuit_id ?? null,
        lane: req.query.lane ?? null,
      }),
    );
  }
  next();
});

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
    const db = supabaseForSyncWrite();
    const { data: circuits, error } = await db
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
    const db = supabaseForSyncWrite();
    const { circuit, created } = await findOrCreateCircuit(db, req.user.id, String(name).trim(), {
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
 * Body: { vehicle_id, best_lap_time, total_time, laps, average_time, lane?, circuit?, circuit_id?, timing_date?, session_type?: 'HEAT'|'TRAINING', supply_voltage_volts?: number (0-30), voltage? (alias), reaction_time_ms?: number (optional, semáforo), reactionTime?, reactionTimeMs?, lap_times?: [{ lap_number, time_seconds|lap_time_seconds, time_text? }] }
 */
router.post('/timings', async (req, res) => {
  try {
    const db = supabaseForSyncWrite();
    const { recordedFrom } = resolveClientContext(req);
    const result = await insertVehicleTimingFromSyncBody(db, req.user.id, req.body, { recordedFrom });
    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    const { finalTiming, previousBestLapSeconds, syncMeta } = result;

    sendTimingNotification(req.user.id, finalTiming, previousBestLapSeconds, db).catch(() => {});

    res.status(201).json({ ...finalTiming, sync_meta: syncMeta });
  } catch (error) {
    console.error('Error en POST /api/sync/timings:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/sync/timings
 * List timing records for the authenticated user (via API key).
 * Query: ?vehicle_id=&circuit_id=&lane=&limit=
 */
router.get('/timings', async (req, res) => {
  const { vehicle_id, circuit_id, lane } = req.query;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

  try {
    if (!vehicle_id) {
      console.log('[sync:timings:reject] vehicle_id requerido', {
        userId: req.user?.id ?? null,
        query: req.query,
      });
      return res.status(400).json({ error: 'vehicle_id es requerido' });
    }

    const db = supabaseForSyncWrite();

    const { data: vehicle, error: vehicleError } = await db
      .from('vehicles')
      .select('id')
      .eq('id', vehicle_id)
      .eq('user_id', req.user.id)
      .single();

    if (vehicleError || !vehicle) {
      console.warn('[GET /api/sync/timings] vehículo no encontrado', {
        userId: req.user.id,
        vehicle_id,
        error: vehicleError?.message ?? null,
      });
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    let circuitName = null;
    let circuitNumLanes = null;
    if (circuit_id) {
      const { data: circuitRow, error: circuitError } = await db
        .from('circuits')
        .select('name, num_lanes')
        .eq('id', circuit_id)
        .eq('user_id', req.user.id)
        .single();
      if (circuitError || !circuitRow) {
        console.warn('[GET /api/sync/timings] circuito no encontrado', {
          userId: req.user.id,
          vehicle_id,
          circuit_id,
          error: circuitError?.message ?? null,
        });
        return res.status(404).json({ error: 'Circuito no encontrado' });
      }
      circuitName = circuitRow.name;
      circuitNumLanes = circuitRow.num_lanes;

      if (lane && circuitNumLanes > 0) {
        const laneNum = parseInt(String(lane), 10);
        if (Number.isNaN(laneNum) || laneNum < 1 || laneNum > circuitNumLanes) {
          console.log('[sync:timings:reject] carril fuera de rango', {
            userId: req.user.id,
            vehicle_id,
            circuit_id,
            lane,
            circuitNumLanes,
          });
          return res.json({
            timings: [],
            meta: {
              rawCount: 0,
              filteredCount: 0,
              invalidLane: true,
              circuitNumLanes,
            },
          });
        }
      }
    }

    const fetchLimit = circuit_id || lane ? 200 : limit;
    const { data: rawTimings, error } = await db
      .from('vehicle_timings')
      .select('id, vehicle_id, best_lap_time, best_lap_timestamp, lane, circuit_id, circuit, timing_date, laps')
      .eq('vehicle_id', vehicle_id)
      .order('timing_date', { ascending: false })
      .limit(fetchLimit);

    if (error) {
      console.error('[GET /api/sync/timings] error Supabase', {
        userId: req.user.id,
        vehicle_id,
        circuit_id: circuit_id ?? null,
        lane: lane ?? null,
        error: error.message,
      });
      return res.status(500).json({ error: error.message });
    }

    const { timings: filtered, laneFallback } = resolveBaselineTimings(rawTimings, {
      circuit_id: circuit_id || null,
      circuitName,
      lane: lane ?? null,
    });
    const sorted = sortTimingsByBestLap(filtered).slice(0, limit);

    console.log('[sync:timings:response]', JSON.stringify({
      userId: req.user.id,
      vehicle_id,
      circuit_id: circuit_id ?? null,
      lane: lane ?? null,
      rawCount: rawTimings?.length ?? 0,
      filteredCount: filtered.length,
      returnedCount: sorted.length,
      laneFallback,
    }));

    res.json({
      timings: sorted,
      meta: {
        rawCount: rawTimings?.length ?? 0,
        filteredCount: filtered.length,
        laneFallback,
      },
    });
  } catch (error) {
    console.error('[GET /api/sync/timings] error inesperado', {
      userId: req.user?.id ?? null,
      vehicle_id: vehicle_id ?? null,
      circuit_id: circuit_id ?? null,
      lane: lane ?? null,
      message: error?.message ?? String(error),
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const syncCompetitionsRoute = require('./syncCompetitions');
router.use(syncCompetitionsRoute);

module.exports = router;
