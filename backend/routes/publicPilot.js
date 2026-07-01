const express = require('express');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const { normalizePilotSlug } = require('../lib/pilotProfileUtils');
const { calculatePoints } = require('../lib/pointsCalculator');

const router = express.Router();
const supabase = getAnonClient();
const supabaseAdmin = getServiceClient() || supabase;

function bestLapSecondsFromRow(row) {
  const t = row.best_lap_timestamp;
  if (t != null && Number.isFinite(Number(t))) {
    return Number(t);
  }
  const s = row.best_lap_time;
  if (!s || typeof s !== 'string') return Infinity;
  const m = s.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) return Infinity;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / 1000;
}

/**
 * GET /api/public/pilot/:slug/compare/:otherSlug — head-to-head MVP en circuitos comunes.
 * Debe ir ANTES de /:slug.
 */
router.get('/:slug/compare/:otherSlug', async (req, res) => {
  try {
    const slugA = normalizePilotSlug(req.params.slug);
    const slugB = normalizePilotSlug(req.params.otherSlug);
    if (!slugA || !slugB) {
      return res.status(404).json({ error: 'Perfil no encontrado', code: 'NOT_FOUND' });
    }

    const loadProfile = async (slug) => {
      const { data } = await supabase
        .from('pilot_public_profiles')
        .select('user_id, slug, display_name')
        .ilike('slug', slug)
        .eq('enabled', true)
        .maybeSingle();
      return data;
    };

    const [profileA, profileB] = await Promise.all([loadProfile(slugA), loadProfile(slugB)]);
    if (!profileA || !profileB) {
      return res.status(404).json({ error: 'Perfil no encontrado', code: 'NOT_FOUND' });
    }

    const bestByUserCircuit = async (userId) => {
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id')
        .eq('user_id', userId);
      const vehicleIds = (vehicles || []).map((v) => v.id);
      if (vehicleIds.length === 0) return new Map();

      const { data: timings } = await supabase
        .from('vehicle_timings')
        .select('circuit_id, circuit, best_lap_time, best_lap_timestamp, circuits(name)')
        .in('vehicle_id', vehicleIds);

      const map = new Map();
      for (const row of timings || []) {
        const label = row.circuits?.name || row.circuit || 'Sin circuito';
        const key = row.circuit_id || `text:${label}`;
        const sec = bestLapSecondsFromRow(row);
        if (!Number.isFinite(sec)) continue;
        const prev = map.get(key);
        if (!prev || sec < prev.best_lap_seconds) {
          map.set(key, {
            circuit_name: label,
            best_lap_time: row.best_lap_time,
            best_lap_seconds: sec,
          });
        }
      }
      return map;
    };

    const [mapA, mapB] = await Promise.all([
      bestByUserCircuit(profileA.user_id),
      bestByUserCircuit(profileB.user_id),
    ]);

    const shared = [];
    for (const [key, a] of mapA.entries()) {
      const b = mapB.get(key);
      if (!b) continue;
      shared.push({
        circuit_key: key,
        circuit_name: a.circuit_name,
        pilot_a: { best_lap_time: a.best_lap_time, best_lap_seconds: a.best_lap_seconds },
        pilot_b: { best_lap_time: b.best_lap_time, best_lap_seconds: b.best_lap_seconds },
        delta_seconds: a.best_lap_seconds - b.best_lap_seconds,
        leader: a.best_lap_seconds < b.best_lap_seconds ? 'a' : a.best_lap_seconds > b.best_lap_seconds ? 'b' : 'tie',
      });
    }

    shared.sort((x, y) => x.circuit_name.localeCompare(y.circuit_name, 'es'));

    const winsA = shared.filter((s) => s.leader === 'a').length;
    const winsB = shared.filter((s) => s.leader === 'b').length;

    res.json({
      pilot_a: { slug: profileA.slug, display_name: profileA.display_name },
      pilot_b: { slug: profileB.slug, display_name: profileB.display_name },
      circuits_compared: shared.length,
      wins_a: winsA,
      wins_b: winsB,
      ties: shared.length - winsA - winsB,
      circuits: shared,
    });
  } catch (e) {
    console.error('GET /public/pilot/:slug/compare/:otherSlug:', e);
    res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/public/pilot/:slug
 */
router.get('/:slug', async (req, res) => {
  try {
    const slug = normalizePilotSlug(req.params.slug);
    if (!slug) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const { data: profile, error: pErr } = await supabase
      .from('pilot_public_profiles')
      .select('user_id, slug, enabled, display_name')
      .ilike('slug', slug)
      .eq('enabled', true)
      .maybeSingle();

    if (pErr || !profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const userId = profile.user_id;

    const { data: vehicles, error: vErr } = await supabase
      .from('vehicles')
      .select('id, model, manufacturer, type')
      .eq('user_id', userId)
      .order('model', { ascending: true });

    if (vErr) {
      return res.status(500).json({ error: vErr.message });
    }

    const vehicleIds = (vehicles || []).map((v) => v.id);
    const imagesMap = {};
    if (vehicleIds.length > 0) {
      const { data: images } = await supabase
        .from('vehicle_images')
        .select('vehicle_id, image_url')
        .in('vehicle_id', vehicleIds);
      (images || []).forEach((img) => {
        if (!imagesMap[img.vehicle_id]) {
          imagesMap[img.vehicle_id] = img.image_url;
        }
      });
    }

    const vehiclesOut = (vehicles || []).map((v) => ({
      id: v.id,
      model: v.model,
      manufacturer: v.manufacturer,
      type: v.type,
      image: imagesMap[v.id] || null,
    }));

    /** @type {Map<string, any>} */
    const bestByCircuit = new Map();

    if (vehicleIds.length > 0) {
      const { data: timings, error: tErr } = await supabase
        .from('vehicle_timings')
        .select(
          `
          id,
          vehicle_id,
          circuit_id,
          circuit,
          best_lap_time,
          best_lap_timestamp,
          supply_voltage_volts,
          timing_date,
          session_type,
          circuits(id, name)
        `,
        )
        .in('vehicle_id', vehicleIds)
        .order('timing_date', { ascending: false });

      if (tErr) {
        return res.status(500).json({ error: tErr.message });
      }

      const vehicleMap = Object.fromEntries((vehicles || []).map((v) => [v.id, v]));

      for (const row of timings || []) {
        const circuitLabel =
          row.circuits?.name || row.circuit || 'Sin circuito';
        const key = row.circuit_id || `text:${circuitLabel}`;
        const sec = bestLapSecondsFromRow(row);
        if (!Number.isFinite(sec)) continue;

        const prev = bestByCircuit.get(key);
        if (!prev || sec < prev.best_lap_seconds) {
          const veh = vehicleMap[row.vehicle_id];
          bestByCircuit.set(key, {
            circuit_id: row.circuit_id,
            circuit_name: circuitLabel,
            best_lap_time: row.best_lap_time,
            best_lap_seconds: sec,
            supply_voltage_volts: row.supply_voltage_volts,
            timing_date: row.timing_date,
            session_type: row.session_type,
            vehicle_id: row.vehicle_id,
            vehicle_model: veh?.model ?? null,
            vehicle_manufacturer: veh?.manufacturer ?? null,
          });
        }
      }
    }

    const best_times_by_circuit = Array.from(bestByCircuit.values()).sort((a, b) =>
      a.circuit_name.localeCompare(b.circuit_name, 'es'),
    );

    const { data: organized, error: oErr } = await supabase
      .from('competitions')
      .select('id, name, public_slug, created_at, circuit_name, rounds')
      .eq('organizer', userId)
      .order('created_at', { ascending: false });

    if (oErr) {
      return res.status(500).json({ error: oErr.message });
    }

    const competitions_organized = (organized || []).map((c) => ({
      id: c.id,
      name: c.name,
      public_slug: c.public_slug,
      created_at: c.created_at,
      circuit_name: c.circuit_name,
      rounds: c.rounds,
    }));

    let partRows = [];
    const q1 = supabase
      .from('competition_participants')
      .select(
        `
        id,
        driver_name,
        competition_id,
        vehicle_id,
        registered_by,
        competitions(id, name, public_slug, created_at, circuit_name)
      `,
      )
      .eq('registered_by', userId);

    const [r1, r2] = await Promise.all([
      q1,
      vehicleIds.length > 0
        ? supabase
            .from('competition_participants')
            .select(
              `
        id,
        driver_name,
        competition_id,
        vehicle_id,
        registered_by,
        competitions(id, name, public_slug, created_at, circuit_name)
      `,
            )
            .in('vehicle_id', vehicleIds)
        : Promise.resolve({ data: [] }),
    ]);

    if (r1.error) {
      return res.status(500).json({ error: r1.error.message });
    }
    if (r2.error) {
      return res.status(500).json({ error: r2.error.message });
    }

    partRows = [...(r1.data || []), ...(r2.data || [])];
    const seenPart = new Set();
    const seenComp = new Set();
    const competitions_participated = [];
    for (const p of partRows) {
      if (p.id && seenPart.has(p.id)) continue;
      if (p.id) seenPart.add(p.id);
      const c = p.competitions;
      if (!c?.id || seenComp.has(c.id)) continue;
      seenComp.add(c.id);
      competitions_participated.push({
        participant_id: p.id,
        driver_name: p.driver_name,
        competition_id: c.id,
        competition_name: c.name,
        public_slug: c.public_slug,
        created_at: c.created_at,
        circuit_name: c.circuit_name,
      });
    }

    competitions_participated.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const palmares = await buildVerifiedPalmares(userId, partRows);

    res.json({
      slug: profile.slug,
      display_name: profile.display_name,
      user_id: userId,
      vehicles: vehiclesOut,
      best_times_by_circuit,
      competitions_organized,
      competitions_participated,
      palmares,
    });
  } catch (e) {
    console.error('GET /public/pilot/:slug:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Palmarés verificado desde competiciones completadas (posición final calculada).
 * @param {string} userId
 * @param {object[]} partRows
 */
async function buildVerifiedPalmares(userId, partRows) {
  const seenComp = new Set();
  const compIds = [];
  const partByComp = new Map();

  for (const p of partRows || []) {
    const c = p.competitions;
    if (!c?.id || seenComp.has(c.id)) continue;
    seenComp.add(c.id);
    compIds.push(c.id);
    partByComp.set(c.id, p);
  }

  if (compIds.length === 0) return [];

  const { data: competitions } = await supabaseAdmin
    .from('competitions')
    .select('id, name, public_slug, status, rounds, circuit_name, created_at')
    .in('id', compIds);

  const palmares = [];

  for (const comp of competitions || []) {
    if (comp.status !== 'finished' && comp.status !== 'closed') continue;

    const participant = partByComp.get(comp.id);
    if (!participant?.id) continue;

    const { data: participants } = await supabaseAdmin
      .from('competition_participants')
      .select('id, driver_name, category_id, vehicles(model, manufacturer)')
      .eq('competition_id', comp.id);

    const participantIds = (participants || []).map((p) => p.id).filter(Boolean);
    let timings = [];
    if (participantIds.length > 0) {
      const { data: timingRows } = await supabaseAdmin
        .from('competition_timings')
        .select('*')
        .in('participant_id', participantIds);
      timings = timingRows || [];
    }

    const { data: rules } = await supabaseAdmin
      .from('competition_rules')
      .select('*')
      .eq('competition_id', comp.id);

    const { data: categories } = await supabaseAdmin
      .from('competition_categories')
      .select('id, name')
      .eq('competition_id', comp.id);

    const { sortedParticipants } = calculatePoints({
      competition: comp,
      participants: participants || [],
      timings,
      rules: rules || [],
      categories: categories || [],
    });

    const idx = sortedParticipants.findIndex(
      (row) => (row.participant_id || row.id) === participant.id,
    );
    if (idx < 0) continue;

    const row = sortedParticipants[idx];
    palmares.push({
      competition_id: comp.id,
      competition_name: comp.name,
      public_slug: comp.public_slug,
      circuit_name: comp.circuit_name,
      created_at: comp.created_at,
      position: idx + 1,
      total_participants: sortedParticipants.length,
      points: row.total_points ?? null,
      driver_name: participant.driver_name,
    });
  }

  palmares.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return palmares;
}

module.exports = router;
