const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { normalizePilotSlug } = require('../lib/pilotProfileUtils');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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

    res.json({
      slug: profile.slug,
      display_name: profile.display_name,
      vehicles: vehiclesOut,
      best_times_by_circuit,
      competitions_organized,
      competitions_participated,
    });
  } catch (e) {
    console.error('GET /public/pilot/:slug:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
