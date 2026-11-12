'use strict';

const CATALOG_LOOKUPS_PER_MINUTE = 10;
const CATALOG_LOOKUPS_PER_DAY = 100;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REAL_OUTCOMES = ['found', 'not_found', 'ambiguous'];

const limitLogs = new Map();

function resetCatalogUsageState() {
  limitLogs.clear();
}

function shouldLogLimit(userId, kind, now, windowMs) {
  const key = `${userId}:${kind}`;
  const prev = limitLogs.get(key);
  if (prev && now - prev < windowMs) return false;
  limitLogs.set(key, now);
  return true;
}

async function countRealLookups(db, userId, sinceIso) {
  const result = await db
    .from('mcp_catalog_lookups')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('outcome', REAL_OUTCOMES)
    .gte('created_at', sinceIso);
  if (!result || result.error || typeof result.count !== 'number') return null;
  return result.count;
}

/**
 * Conteos persistidos. null si la tabla aún no existe o el cliente de test no devuelve count.
 * @returns {Promise<{ minute: number, day: number } | null>}
 */
async function catalogUsageCounts(db, userId, now = Date.now()) {
  if (!db || typeof db.from !== 'function') return null;
  try {
    const [minute, day] = await Promise.all([
      countRealLookups(db, userId, new Date(now - MINUTE_MS).toISOString()),
      countRealLookups(db, userId, new Date(now - DAY_MS).toISOString()),
    ]);
    if (minute == null || day == null) return null;
    return { minute, day };
  } catch {
    return null;
  }
}

async function recordCatalogLookup(db, row) {
  if (!db || typeof db.from !== 'function') return;
  try {
    const result = await db.from('mcp_catalog_lookups').insert({
      user_id: row.userId,
      client_id: row.clientId || null,
      reference: String(row.reference || '').slice(0, 80),
      manufacturer: String(row.manufacturer || '').slice(0, 80),
      outcome: row.outcome,
    });
    if (result && result.error) return;
  } catch {
    // Sin la tabla el catálogo sigue limitado en memoria.
  }
}

/**
 * @returns {Promise<'minute' | 'day' | null>}
 */
async function assertPersistedCatalogLimit(db, userId, reference, manufacturer, clientId) {
  const usage = await catalogUsageCounts(db, userId);
  if (!usage) return null;
  const now = Date.now();
  if (usage.day >= CATALOG_LOOKUPS_PER_DAY) {
    if (shouldLogLimit(userId, 'day', now, 60 * MINUTE_MS)) {
      await recordCatalogLookup(db, {
        userId,
        clientId,
        reference,
        manufacturer,
        outcome: 'daily_limited',
      });
    }
    return 'day';
  }
  if (usage.minute >= CATALOG_LOOKUPS_PER_MINUTE) {
    if (shouldLogLimit(userId, 'minute', now, MINUTE_MS)) {
      await recordCatalogLookup(db, {
        userId,
        clientId,
        reference,
        manufacturer,
        outcome: 'rate_limited',
      });
    }
    return 'minute';
  }
  return null;
}

async function emailForUser(db, userId) {
  try {
    if (!db.auth || !db.auth.admin || typeof db.auth.admin.getUserById !== 'function') return null;
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error) return null;
    return data?.user?.email || null;
  } catch {
    return null;
  }
}

function missingTable(error) {
  const message = String(error?.message || error?.details || '');
  return /mcp_catalog_lookups|does not exist|schema cache|could not find the table/i.test(message);
}

/**
 * Resumen de 24 h para el panel de administración.
 */
async function summarizeCatalogUsage(db) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const countRes = await db
    .from('mcp_catalog_lookups')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  if (countRes?.error) {
    if (missingTable(countRes.error)) return { ready: false };
    const err = new Error(countRes.error.message || 'Error al leer el uso del catálogo');
    err.statusCode = 500;
    throw err;
  }
  const recentRes = await db
    .from('mcp_catalog_lookups')
    .select('user_id, client_id, reference, manufacturer, outcome, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);
  if (recentRes?.error) {
    if (missingTable(recentRes.error)) return { ready: false };
    const err = new Error(recentRes.error.message || 'Error al leer el uso del catálogo');
    err.statusCode = 500;
    throw err;
  }
  const recent = recentRes.data || [];
  const byUser = new Map();
  for (const row of recent) {
    if (!row?.user_id) continue;
    const current = byUser.get(row.user_id) || {
      user_id: row.user_id,
      lookups: 0,
      distinct_refs: 0,
      refs: new Set(),
      last_at: row.created_at,
      last_reference: row.reference,
      last_manufacturer: row.manufacturer,
      last_outcome: row.outcome,
    };
    current.lookups += 1;
    current.refs.add(`${row.manufacturer}|${row.reference}`);
    byUser.set(row.user_id, current);
  }
  const users = [...byUser.values()]
    .sort((a, b) => b.lookups - a.lookups)
    .slice(0, 15);
  for (const user of users) {
    const exact = await countRealLookups(db, user.user_id, since);
    if (typeof exact === 'number') user.lookups = exact;
    user.distinct_refs = user.refs.size;
    user.email = await emailForUser(db, user.user_id);
    delete user.refs;
  }
  return {
    ready: true,
    window_hours: 24,
    lookups_24h: typeof countRes.count === 'number' ? countRes.count : recent.length,
    limits: {
      per_minute: CATALOG_LOOKUPS_PER_MINUTE,
      per_day: CATALOG_LOOKUPS_PER_DAY,
    },
    users,
    recent: recent.slice(0, 20),
  };
}

module.exports = {
  CATALOG_LOOKUPS_PER_MINUTE,
  CATALOG_LOOKUPS_PER_DAY,
  catalogUsageCounts,
  recordCatalogLookup,
  assertPersistedCatalogLimit,
  summarizeCatalogUsage,
  resetCatalogUsageState,
};
