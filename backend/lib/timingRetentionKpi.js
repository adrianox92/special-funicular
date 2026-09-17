'use strict';

/**
 * KPI de retención timing-30d (misma semántica que la rutina SQL semanal):
 *
 *   SELECT COUNT(*) FROM auth.users;
 *   SELECT COUNT(DISTINCT user_id) FROM vehicles;
 *   SELECT COUNT(DISTINCT v.user_id)
 *     FROM vehicle_timings vt
 *     JOIN vehicles v ON v.id = vt.vehicle_id
 *    WHERE coalesce(vt.timing_date::timestamptz, vt.created_at) >= now() - interval '30 days';
 *   timing_30d_pct = 100 * users_with_timing_30d / registered_users
 */

const WINDOW_DAYS = 30;
const PAGE_SIZE = 1000;
const MAX_TABLE_PAGES = 200;
const MAX_AUTH_PAGES = 50;

const TIMING_RETENTION_GOAL = {
  baseline_2026_09_11_pct: 2.7,
  baseline_2026_09_15_pct: 3.3,
  target_min_pct: 8,
  target_max_pct: 10,
};

function roundPct(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((1000 * part) / total) / 10;
}

/**
 * Equivale a `coalesce(timing_date::timestamptz, created_at)`.
 * `timing_date` tipo date se interpreta como medianoche UTC (igual que timestamptz en sesión UTC).
 * @param {{ timing_date?: string|null, created_at?: string|null }} timing
 * @returns {Date|null}
 */
function timingEffectiveAt(timing) {
  if (timing?.timing_date != null && String(timing.timing_date).trim() !== '') {
    const d = new Date(timing.timing_date);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (timing?.created_at != null && String(timing.created_at).trim() !== '') {
    const d = new Date(timing.created_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function isTimingInLastDays(timing, now, days = WINDOW_DAYS) {
  const at = timingEffectiveAt(timing);
  if (!at || !(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  return at.getTime() >= cutoffMs;
}

async function fetchAllPages(runPage) {
  const rows = [];
  for (let page = 0; page < MAX_TABLE_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const chunk = await runPage(from, from + PAGE_SIZE - 1);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Cuenta auth.users paginando el Admin API (service role).
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @returns {Promise<number>}
 */
async function countRegisteredUsers(admin) {
  let counted = 0;
  const perPage = PAGE_SIZE;
  for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    counted += users.length;
    if (users.length < perPage) break;
  }
  return counted;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @returns {Promise<Array<{ id: string, user_id: string }>>}
 */
async function fetchVehicles(admin) {
  return fetchAllPages(async (from, to) => {
    const { data, error } = await admin
      .from('vehicles')
      .select('id, user_id')
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    return data || [];
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @returns {Promise<Array<{ vehicle_id: string, timing_date?: string|null, created_at?: string|null }>>}
 */
async function fetchTimings(admin) {
  return fetchAllPages(async (from, to) => {
    const { data, error } = await admin
      .from('vehicle_timings')
      .select('vehicle_id, timing_date, created_at')
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    return data || [];
  });
}

/**
 * @param {{
 *   registeredUsers: number,
 *   vehicles: Array<{ id?: string, user_id?: string }>,
 *   timings: Array<{ vehicle_id?: string, timing_date?: string|null, created_at?: string|null }>,
 *   now?: Date,
 * }} input
 */
function computeTimingRetentionKpi({
  registeredUsers,
  vehicles,
  timings,
  now = new Date(),
}) {
  const vehicleById = new Map();
  const usersWithVehicle = new Set();
  for (const v of vehicles || []) {
    if (!v?.id || !v?.user_id) continue;
    vehicleById.set(v.id, v.user_id);
    usersWithVehicle.add(v.user_id);
  }

  const usersWithTimingEver = new Set();
  const usersWithTiming30d = new Set();
  for (const timing of timings || []) {
    const userId = vehicleById.get(timing?.vehicle_id);
    if (!userId) continue;
    usersWithTimingEver.add(userId);
    if (isTimingInLastDays(timing, now, WINDOW_DAYS)) {
      usersWithTiming30d.add(userId);
    }
  }

  const registered = Number.isFinite(registeredUsers) ? Math.max(0, registeredUsers) : 0;
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return {
    window_days: WINDOW_DAYS,
    as_of: now.toISOString(),
    window_start: windowStart.toISOString(),
    registered_users: registered,
    users_with_vehicle: usersWithVehicle.size,
    users_with_vehicle_pct: roundPct(usersWithVehicle.size, registered),
    users_with_timing_ever: usersWithTimingEver.size,
    users_with_timing_ever_pct: roundPct(usersWithTimingEver.size, registered),
    users_with_timing_30d: usersWithTiming30d.size,
    timing_30d_pct: roundPct(usersWithTiming30d.size, registered),
    goal: { ...TIMING_RETENTION_GOAL },
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ now?: Date }} [opts]
 */
async function fetchTimingRetentionKpi(admin, { now = new Date() } = {}) {
  const [registeredUsers, vehicles, timings] = await Promise.all([
    countRegisteredUsers(admin),
    fetchVehicles(admin),
    fetchTimings(admin),
  ]);
  return computeTimingRetentionKpi({ registeredUsers, vehicles, timings, now });
}

module.exports = {
  WINDOW_DAYS,
  PAGE_SIZE,
  TIMING_RETENTION_GOAL,
  roundPct,
  timingEffectiveAt,
  isTimingInLastDays,
  computeTimingRetentionKpi,
  countRegisteredUsers,
  fetchTimingRetentionKpi,
};
