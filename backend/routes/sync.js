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
 * Body: { vehicle_id, best_lap_time, total_time, laps, average_time, lane?, circuit?, circuit_id?, timing_date?, session_type?: 'HEAT'|'TRAINING', supply_voltage_volts?: number (0-30), voltage? (alias), reaction_time_ms?: number (optional, semáforo), reactionTime?, reactionTimeMs?, guided_session?: { baseline_lap_seconds, target_improvement_ms, laps_on_target, total_laps?, best_improvement_ms? } | campos sueltos (baseline_lap_seconds, target_improvement_ms, laps_on_target, best_improvement_ms, total_laps), lap_times?: [{ lap_number, time_seconds|lap_time_seconds, time_text? }] }
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

const {
  assertGuestMemberInClub,
  assertClubCircuit,
  normalizeGuestTimingBody,
  enrichGuestMembersWithLinkedEmails,
} = require('../lib/clubGuestMembers');

async function syncUserIsClubAdmin(userId, clubId) {
  const sb = supabaseForSyncWrite();
  const { data: owned } = await sb.from('clubs').select('id').eq('id', clubId).eq('owner_user_id', userId).maybeSingle();
  if (owned?.id) return true;
  const { data: mem } = await sb
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return Boolean(mem);
}

/**
 * GET /api/sync/clubs/admin
 * Clubes donde el usuario autenticado (API key) es admin o propietario.
 */
router.get('/clubs/admin', async (req, res) => {
  try {
    const sb = supabaseForSyncWrite();
    const userId = req.user.id;

    const { data: owned } = await sb.from('clubs').select('id, name, slug').eq('owner_user_id', userId);
    const { data: adminMemberships } = await sb
      .from('club_members')
      .select('club_id, clubs ( id, name, slug )')
      .eq('user_id', userId)
      .eq('role', 'admin');

    const byId = new Map();
    for (const c of owned || []) {
      byId.set(c.id, { id: c.id, name: c.name, slug: c.slug });
    }
    for (const m of adminMemberships || []) {
      const c = m.clubs;
      if (c?.id && !byId.has(c.id)) {
        byId.set(c.id, { id: c.id, name: c.name, slug: c.slug });
      }
    }

    res.json({ clubs: [...byId.values()] });
  } catch (error) {
    console.error('GET /api/sync/clubs/admin', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

/**
 * GET /api/sync/clubs/:id/circuits
 * Circuitos del club (admin) para grabar sesiones de invitados.
 */
router.get('/clubs/:id/circuits', async (req, res) => {
  try {
    const clubId = req.params.id;
    const sb = supabaseForSyncWrite();
    const admin = await syncUserIsClubAdmin(req.user.id, clubId);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    const { data, error } = await sb
      .from('circuits')
      .select('id, name, description, num_lanes, lane_lengths')
      .eq('club_id', clubId)
      .order('name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ circuits: data || [] });
  } catch (error) {
    console.error('GET /api/sync/clubs/:id/circuits', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

/**
 * GET /api/sync/clubs/:id/guest-members
 */
router.get('/clubs/:id/guest-members', async (req, res) => {
  try {
    const clubId = req.params.id;
    const sb = supabaseForSyncWrite();
    const admin = await syncUserIsClubAdmin(req.user.id, clubId);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    const { data: rows, error } = await sb
      .from('club_guest_members')
      .select('id, club_id, name, email, linked_user_id, created_at')
      .eq('club_id', clubId)
      .order('name', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    const guests = await enrichGuestMembersWithLinkedEmails(sb, rows || []);
    res.json({ guest_members: guests });
  } catch (error) {
    console.error('GET /api/sync/clubs/:id/guest-members', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

/**
 * POST /api/sync/clubs/:id/guest-members/:guestId/timings
 * Registra una sesión de entrenamiento para un miembro invitado (desde Slot Lap Timer).
 */
router.post('/clubs/:id/guest-members/:guestId/timings', async (req, res) => {
  try {
    const { id: clubId, guestId } = req.params;
    const sb = supabaseForSyncWrite();
    const admin = await syncUserIsClubAdmin(req.user.id, clubId);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    const guest = await assertGuestMemberInClub(sb, clubId, guestId);
    if (!guest) return res.status(404).json({ error: 'Miembro invitado no encontrado' });

    const circuitId = req.body.circuit_id;
    if (!circuitId) return res.status(400).json({ error: 'circuit_id es obligatorio' });

    const circuitCheck = await assertClubCircuit(sb, clubId, circuitId);
    if (!circuitCheck.ok) return res.status(400).json({ error: circuitCheck.error });

    let vehicleModel = req.body.vehicle_model;
    let vehicleType = req.body.vehicle_type;
    if (req.body.vehicle_id && (!vehicleModel || !vehicleType)) {
      const { data: vehicle } = await sb
        .from('vehicles')
        .select('model, type')
        .eq('id', req.body.vehicle_id)
        .maybeSingle();
      if (vehicle) {
        vehicleModel = vehicleModel || vehicle.model;
        vehicleType = vehicleType || vehicle.type;
      }
    }

    const normalized = normalizeGuestTimingBody(
      {
        ...req.body,
        vehicle_model: vehicleModel,
        vehicle_type: vehicleType,
      },
      { source: 'app', enteredBy: req.user.id },
    );
    if (normalized.error) return res.status(400).json({ error: normalized.error });

    const { data, error } = await sb
      .from('club_guest_timings')
      .insert({
        club_id: clubId,
        guest_member_id: guestId,
        ...normalized.row,
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (error) {
    console.error('POST /api/sync/clubs/:id/guest-members/:guestId/timings', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

const syncCompetitionsRoute = require('./syncCompetitions');
router.use(syncCompetitionsRoute);

module.exports = router;
