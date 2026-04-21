/**
 * Sincronización de competiciones para Slot Race Manager (API key).
 * Rutas bajo /api/sync/competitions (montadas desde sync.js tras apiKeyAuth).
 */
const express = require('express');
const { getServiceClient } = require('../lib/supabaseClients');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { deriveCompetitionAverageFromTotalAndLaps } = require('../lib/competitionTimingDerivation');
const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('../lib/distanceCalculator');

const router = express.Router();

const supabaseAdmin = getServiceClient();

function generateSlug(name) {
  const baseSlug = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  const uuid = uuidv4().substring(0, 8);
  return `${baseSlug}-${uuid}`;
}

async function getClubIdsForUser(userId) {
  const { data } = await supabaseAdmin.from('club_members').select('club_id').eq('user_id', userId);
  return [...new Set((data || []).map((r) => r.club_id))];
}

async function assertCompetitionAccess(userId, competitionId) {
  const { data: comp, error } = await supabaseAdmin
    .from('competitions')
    .select('id, organizer, club_id, rounds, updated_at')
    .eq('id', competitionId)
    .maybeSingle();
  if (error || !comp) return { ok: false, status: 404, error: 'Competición no encontrada', competition: null };
  if (comp.organizer === userId) return { ok: true, competition: comp };
  if (comp.club_id) {
    const { data: mem } = await supabaseAdmin
      .from('club_members')
      .select('id')
      .eq('club_id', comp.club_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (mem) return { ok: true, competition: comp };
  }
  return { ok: false, status: 403, error: 'Sin acceso a esta competición', competition: null };
}

async function assertClubMembership(userId, clubId) {
  const { data: club } = await supabaseAdmin.from('clubs').select('id, owner_user_id').eq('id', clubId).maybeSingle();
  if (!club) return false;
  if (club.owner_user_id === userId) return true;
  const { data: mem } = await supabaseAdmin
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(mem);
}

async function ensureDefaultCategory(competitionId) {
  const { data: existing } = await supabaseAdmin
    .from('competition_categories')
    .select('id')
    .eq('competition_id', competitionId)
    .limit(1);
  if (existing?.length) return existing[0].id;
  const { data: cat, error } = await supabaseAdmin
    .from('competition_categories')
    .insert({ competition_id: competitionId, name: 'General' })
    .select('id')
    .single();
  if (error) throw error;
  return cat.id;
}

router.get('/competitions', async (req, res) => {
  try {
    const userId = req.user.id;
    const clubIds = await getClubIdsForUser(userId);

    const { data: owned, error: e1 } = await supabaseAdmin
      .from('competitions')
      .select(`
        *,
        circuits(id, name, num_lanes, lane_lengths),
        competition_participants(count)
      `)
      .eq('organizer', userId)
      .order('created_at', { ascending: false });

    if (e1) return res.status(500).json({ error: e1.message });

    let clubComps = [];
    if (clubIds.length > 0) {
      const { data: cc, error: e2 } = await supabaseAdmin
        .from('competitions')
        .select(`
          *,
          circuits(id, name, num_lanes, lane_lengths),
          competition_participants(count)
        `)
        .in('club_id', clubIds)
        .neq('organizer', userId)
        .order('created_at', { ascending: false });
      if (e2) return res.status(500).json({ error: e2.message });
      clubComps = cc || [];
    }

    const byId = new Map();
    for (const c of owned || []) {
      byId.set(c.id, {
        ...c,
        participants_count: c.competition_participants?.[0]?.count || 0,
      });
    }
    for (const c of clubComps) {
      if (!byId.has(c.id)) {
        byId.set(c.id, {
          ...c,
          participants_count: c.competition_participants?.[0]?.count || 0,
        });
      }
    }

    const list = [...byId.values()].map(({ competition_participants, ...rest }) => rest);
    res.json({ competitions: list });
  } catch (err) {
    console.error('GET /sync/competitions', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/competitions/:id', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const access = await assertCompetitionAccess(req.user.id, req.params.id);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const id = req.params.id;
    const { data: competition, error: cErr } = await supabaseAdmin
      .from('competitions')
      .select(`*, circuits(id, name, num_lanes, lane_lengths)`)
      .eq('id', id)
      .single();

    if (cErr || !competition) return res.status(404).json({ error: 'Competición no encontrada' });

    const { data: participants } = await supabaseAdmin
      .from('competition_participants')
      .select(`*, vehicles(model, manufacturer)`)
      .eq('competition_id', id)
      .order('created_at', { ascending: true });

    const { data: categories } = await supabaseAdmin
      .from('competition_categories')
      .select('*')
      .eq('competition_id', id)
      .order('name', { ascending: true });

    const { data: rules } = await supabaseAdmin
      .from('competition_rules')
      .select('*')
      .eq('competition_id', id);

    const pids = (participants || []).map((p) => p.id);
    let timings = [];
    if (pids.length > 0) {
      const { data: t } = await supabaseAdmin.from('competition_timings').select('*').in('participant_id', pids);
      timings = t || [];
    }

    res.json({
      ...competition,
      participants: participants || [],
      categories: categories || [],
      rules: rules || [],
      timings: timings || [],
    });
  } catch (err) {
    console.error('GET /sync/competitions/:id', err);
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/competitions',
  body('name').trim().notEmpty(),
  body('num_slots').isInt({ min: 1 }),
  body('rounds').isInt({ min: 1 }),
  body('id').optional().isUUID(),
  body('club_id').optional({ values: 'null' }).isUUID(),
  body('circuit_id').optional({ values: 'null' }).isUUID(),
  body('circuit_name').optional({ values: 'null' }).isString(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        name,
        num_slots: numSlots,
        rounds,
        id: clientId,
        club_id: clubId,
        circuit_id: circuitId,
        circuit_name: circuitName,
      } = req.body;

      if (clubId && !(await assertClubMembership(userId, clubId))) {
        return res.status(403).json({ error: 'No perteneces a este club' });
      }

      let circuitNameToStore = circuitName ? String(circuitName).trim() : null;
      if (circuitId) {
        const { data: circuit } = await supabaseAdmin
          .from('circuits')
          .select('name')
          .eq('id', circuitId)
          .eq('user_id', userId)
          .maybeSingle();
        if (circuit) circuitNameToStore = circuit.name;
      }

      const rowId = clientId && uuidValidate(clientId) ? clientId : uuidv4();
      const public_slug = generateSlug(name.trim());

      const insertData = {
        id: rowId,
        name: name.trim(),
        public_slug,
        organizer: userId,
        num_slots: numSlots,
        rounds,
        circuit_name: circuitNameToStore,
        circuit_id: circuitId || null,
        club_id: clubId || null,
      };

      const { data, error } = await supabaseAdmin.from('competitions').insert([insertData]).select().single();
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Ya existe una competición con este id' });
        }
        console.error('sync POST competitions', error);
        return res.status(500).json({ error: error.message });
      }

      await ensureDefaultCategory(data.id);

      res.status(201).json(data);
    } catch (err) {
      console.error('POST /sync/competitions', err);
      res.status(500).json({ error: err.message });
    }
  },
);

router.put(
  '/competitions/:id',
  param('id').isUUID(),
  body('name').optional().trim().notEmpty(),
  body('num_slots').optional().isInt({ min: 1 }),
  body('rounds').optional().isInt({ min: 1 }),
  body('circuit_id').optional({ values: 'null' }).isUUID(),
  body('circuit_name').optional({ values: 'null' }).isString(),
  body('external_status').optional().isIn(['DRAFT', 'RUNNING', 'FINISHED']),
  body('updated_at').optional().isString(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await assertCompetitionAccess(req.user.id, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const { id } = req.params;
      const { data: current } = await supabaseAdmin
        .from('competitions')
        .select('updated_at')
        .eq('id', id)
        .single();

      if (req.body.updated_at && current?.updated_at) {
        const clientTs = new Date(req.body.updated_at).getTime();
        const serverTs = new Date(current.updated_at).getTime();
        if (clientTs < serverTs) {
          return res.status(409).json({ error: 'conflict', message: 'La competición fue modificada en el servidor' });
        }
      }

      const patch = {};
      if (req.body.name != null) patch.name = req.body.name.trim();
      if (req.body.num_slots != null) patch.num_slots = req.body.num_slots;
      if (req.body.rounds != null) patch.rounds = req.body.rounds;
      if (req.body.external_status != null) patch.external_status = req.body.external_status;
      if (req.body.circuit_name !== undefined) {
        patch.circuit_name = req.body.circuit_name ? String(req.body.circuit_name).trim() : null;
      }
      if (req.body.circuit_id !== undefined) {
        if (req.body.circuit_id) {
          const { data: circuit } = await supabaseAdmin
            .from('circuits')
            .select('name')
            .eq('id', req.body.circuit_id)
            .eq('user_id', req.user.id)
            .maybeSingle();
          if (circuit) {
            patch.circuit_id = req.body.circuit_id;
            patch.circuit_name = circuit.name;
          }
        } else {
          patch.circuit_id = null;
          patch.circuit_name = null;
        }
      }

      if (Object.keys(patch).length === 0) {
        const { data: full } = await supabaseAdmin.from('competitions').select('*').eq('id', id).single();
        return res.json(full);
      }

      const { data, error } = await supabaseAdmin.from('competitions').update(patch).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) {
      console.error('PUT /sync/competitions/:id', err);
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/competitions/:id/participants',
  param('id').isUUID(),
  body('participants').isArray({ min: 1 }),
  body('participants.*.driver_name').trim().notEmpty(),
  body('participants.*.id').optional().isUUID(),
  body('participants.*.vehicle_model').optional({ values: 'null' }).isString(),
  body('participants.*.vehicle_id').optional({ values: 'null' }).isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await assertCompetitionAccess(req.user.id, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const competitionId = req.params.id;
      const userId = req.user.id;
      const categoryId = await ensureDefaultCategory(competitionId);

      const results = [];
      for (const p of req.body.participants) {
        const driverName = String(p.driver_name).trim();
        const partId = p.id && uuidValidate(p.id) ? p.id : uuidv4();
        let vehicleId = p.vehicle_id || null;
        let vehicleModel = p.vehicle_model ? String(p.vehicle_model).trim() : null;

        if (vehicleId && vehicleModel) {
          return res.status(400).json({ error: 'Solo vehicle_id o vehicle_model por participante' });
        }
        if (!vehicleId && !vehicleModel) {
          vehicleModel = 'Externo';
        }
        if (vehicleId) {
          const { data: v } = await supabaseAdmin
            .from('vehicles')
            .select('id')
            .eq('id', vehicleId)
            .eq('user_id', userId)
            .maybeSingle();
          if (!v) return res.status(400).json({ error: `Vehículo no encontrado: ${vehicleId}` });
        }

        const row = {
          id: partId,
          competition_id: competitionId,
          driver_name: driverName,
          category_id: categoryId,
          registered_by: userId,
        };
        if (vehicleId) row.vehicle_id = vehicleId;
        else row.vehicle_model = vehicleModel;

        const { data: inserted, error } = await supabaseAdmin
          .from('competition_participants')
          .upsert(row, { onConflict: 'id' })
          .select(`*, vehicles(model, manufacturer)`)
          .single();

        if (error) {
          console.error('participant upsert', error);
          return res.status(500).json({ error: error.message });
        }
        results.push(inserted);
      }

      res.status(201).json({ participants: results });
    } catch (err) {
      console.error('POST /sync/competitions/:id/participants', err);
      res.status(500).json({ error: err.message });
    }
  },
);

router.post(
  '/competitions/:id/timings',
  param('id').isUUID(),
  body('timings').isArray({ min: 1 }),
  body('timings.*.participant_id').isUUID(),
  body('timings.*.round_number').isInt({ min: 1 }),
  body('timings.*.best_lap_time').notEmpty(),
  body('timings.*.total_time').notEmpty(),
  body('timings.*.laps').isInt({ min: 0 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await assertCompetitionAccess(req.user.id, req.params.id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const competitionId = req.params.id;
      const { data: competition } = await supabaseAdmin
        .from('competitions')
        .select('id, rounds')
        .eq('id', competitionId)
        .single();

      if (!competition) return res.status(404).json({ error: 'Competición no encontrada' });

      const created = [];
      const updated = [];

      for (const t of req.body.timings) {
        const {
          participant_id: participantId,
          round_number: roundNumber,
          best_lap_time: bestLapTime,
          total_time: totalTime,
          laps,
          lane,
          driver,
          timing_date: timingDate,
          best_lap_timestamp: bestLapTimestamp,
          total_time_timestamp: totalTimeTimestamp,
          setup_snapshot: setupSnapshot,
          circuit,
          circuit_id: circuitId,
        } = t;

        if (roundNumber > competition.rounds) {
          return res.status(400).json({ error: `Ronda ${roundNumber} fuera de rango (1-${competition.rounds})` });
        }

        const { data: participant } = await supabaseAdmin
          .from('competition_participants')
          .select('id, vehicle_id')
          .eq('id', participantId)
          .eq('competition_id', competitionId)
          .maybeSingle();

        if (!participant) {
          return res.status(400).json({ error: `Participante no válido: ${participantId}` });
        }

        let scaleFactor = DEFAULT_SCALE_FACTOR;
        if (participant.vehicle_id) {
          const { data: vehicle } = await supabaseAdmin
            .from('vehicles')
            .select('scale_factor')
            .eq('id', participant.vehicle_id)
            .single();
          if (vehicle?.scale_factor) scaleFactor = vehicle.scale_factor;
        }

        const derivedAverage = deriveCompetitionAverageFromTotalAndLaps(totalTime, laps);
        if (!derivedAverage) {
          return res.status(400).json({ error: 'Formato de tiempo o vueltas inválido (use mm:ss.mmm)' });
        }

        const timingData = {
          participant_id: participantId,
          best_lap_time: bestLapTime,
          total_time: totalTime,
          laps,
          average_time: derivedAverage.average_time,
          average_time_timestamp: derivedAverage.average_time_timestamp,
          round_number: roundNumber,
          timing_date: timingDate || new Date().toISOString().split('T')[0],
        };

        if (lane != null) timingData.lane = lane;
        if (driver) timingData.driver = driver;
        if (bestLapTimestamp != null) timingData.best_lap_timestamp = bestLapTimestamp;
        if (totalTimeTimestamp != null) timingData.total_time_timestamp = totalTimeTimestamp;
        if (setupSnapshot) timingData.setup_snapshot = setupSnapshot;

        let circuitLaneLengths = [];
        if (circuitId) {
          const { data: circ } = await supabaseAdmin
            .from('circuits')
            .select('name, lane_lengths')
            .eq('id', circuitId)
            .eq('user_id', req.user.id)
            .maybeSingle();
          if (circ) {
            timingData.circuit_id = circuitId;
            timingData.circuit = circ.name;
            circuitLaneLengths = Array.isArray(circ.lane_lengths) ? circ.lane_lengths : [];
          }
        } else if (circuit) {
          timingData.circuit = circuit;
        }

        const distanceSpeed = calculateDistanceAndSpeed({
          laps,
          lane,
          circuitLaneLengths,
          totalTimeSeconds: totalTimeTimestamp,
          bestLapSeconds: bestLapTimestamp,
          scaleFactor,
        });
        if (distanceSpeed) Object.assign(timingData, distanceSpeed);

        const { data: existing } = await supabaseAdmin
          .from('competition_timings')
          .select('id')
          .eq('participant_id', participantId)
          .eq('round_number', roundNumber)
          .maybeSingle();

        if (existing?.id) {
          const { data: row, error: uErr } = await supabaseAdmin
            .from('competition_timings')
            .update(timingData)
            .eq('id', existing.id)
            .select()
            .single();
          if (uErr) return res.status(500).json({ error: uErr.message });
          updated.push(row);
        } else {
          const { data: row, error: iErr } = await supabaseAdmin
            .from('competition_timings')
            .insert([timingData])
            .select()
            .single();
          if (iErr) return res.status(500).json({ error: iErr.message });
          created.push(row);
        }

        if (participant.vehicle_id) {
          try {
            await updateVehicleOdometer(supabaseAdmin, participant.vehicle_id);
          } catch (e) {
            console.warn('odometer', e);
          }
        }
      }

      res.status(201).json({ created, updated });
    } catch (err) {
      console.error('POST /sync/competitions/:id/timings', err);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
