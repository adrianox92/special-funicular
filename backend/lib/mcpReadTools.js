'use strict';

const { getServiceClient } = require('./supabaseClients');
const { buildCompetitionProgress } = require('./competitionProgress');
const { normalizeReference } = require('./catalogAliases');
const { catalogSlugify } = require('./catalogSlug');
const {
  assertPersistedCatalogLimit,
  recordCatalogLookup,
  resetCatalogUsageState,
} = require('./mcpCatalogUsage');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VEHICLE_LIST_FIELDS = 'id, model, manufacturer, type, traction, reference, commercial_release_year, catalog_item_id';
const VEHICLE_DETAIL_FIELDS = `${VEHICLE_LIST_FIELDS}, price, purchase_date, purchase_place, modified, digital, anotaciones, dorsal, scale_factor`;
const TIMING_FIELDS = 'id, vehicle_id, best_lap_time, best_lap_timestamp, total_time, average_time, laps, lane, circuit_id, circuit, timing_date';
const COMP_FIELDS = 'id, name, status, rounds, num_slots, public_slug, circuit_name, organizer, club_id, is_multi_stage, created_at';
const CATALOG_ITEM_FIELDS = 'reference, manufacturer, model_name, vehicle_type, traction, motor_position, commercial_release_year, dorsal, discontinued, image_url';
const CATALOG_LOOKUPS_PER_MINUTE = 10;
const CATALOG_WINDOW_MS = 60_000;
const catalogLookups = new Map();

function requireDb() {
  const db = getServiceClient();
  if (!db) {
    const err = new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
    err.statusCode = 503;
    throw err;
  }
  return db;
}

function assertUser(userId) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Sesión MCP sin usuario');
    err.statusCode = 401;
    throw err;
  }
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function assertNoError(error) {
  if (error) httpError(500, error.message || 'Error de base de datos');
}

function escapeIlikePattern(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function assertUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) httpError(400, `${label} inválido`);
  return value;
}

function assertDate(value, label) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) httpError(400, `${label} debe ser YYYY-MM-DD`);
  return value;
}

function clip(value, max) {
  if (value == null) return null;
  const s = String(value);
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

async function searchCollection(userId, args = {}) {
  assertUser(userId);
  const raw = String(args.q ?? '').trim();
  if (raw.length < 2) return { vehicles: [], circuits: [], competitions: [] };
  const pattern = `%${escapeIlikePattern(raw)}%`;
  const db = requireDb();
  const [byModel, byManufacturer, competitionsRes, circuitsRes] = await Promise.all([
    db.from('vehicles').select('id, model, manufacturer').eq('user_id', userId).ilike('model', pattern).limit(10),
    db.from('vehicles').select('id, model, manufacturer').eq('user_id', userId).ilike('manufacturer', pattern).limit(10),
    db.from('competitions').select('id, name').eq('organizer', userId).ilike('name', pattern).limit(5),
    db.from('circuits').select('id, name').eq('user_id', userId).ilike('name', pattern).limit(5),
  ]);
  assertNoError(byModel.error);
  assertNoError(byManufacturer.error);
  assertNoError(competitionsRes.error);
  assertNoError(circuitsRes.error);
  const vehicleMap = new Map();
  for (const row of [...(byModel.data || []), ...(byManufacturer.data || [])]) {
    if (row?.id && !vehicleMap.has(row.id)) vehicleMap.set(row.id, row);
  }
  return {
    vehicles: [...vehicleMap.values()].slice(0, 10),
    circuits: circuitsRes.data || [],
    competitions: competitionsRes.data || [],
  };
}

async function listVehicles(userId, args = {}) {
  assertUser(userId);
  const db = requireDb();
  const q = String(args.q ?? '').trim();
  if (q.length >= 2) {
    const pattern = `%${escapeIlikePattern(q)}%`;
    const [byModel, byManufacturer] = await Promise.all([
      db.from('vehicles').select(VEHICLE_LIST_FIELDS).eq('user_id', userId).ilike('model', pattern).limit(25),
      db.from('vehicles').select(VEHICLE_LIST_FIELDS).eq('user_id', userId).ilike('manufacturer', pattern).limit(25),
    ]);
    assertNoError(byModel.error);
    assertNoError(byManufacturer.error);
    const map = new Map();
    for (const row of [...(byModel.data || []), ...(byManufacturer.data || [])]) {
      if (row?.id && !map.has(row.id)) map.set(row.id, row);
    }
    return { vehicles: [...map.values()].slice(0, 25) };
  }
  const page = clampInt(args.page, 1, 1, 200);
  const limit = clampInt(args.limit, 25, 1, 25);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await db
    .from('vehicles')
    .select(VEHICLE_LIST_FIELDS, { count: 'exact' })
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false })
    .range(from, to);
  assertNoError(error);
  return {
    vehicles: data || [],
    pagination: { total: count ?? (data || []).length, page, limit },
  };
}

async function getVehicle(userId, args = {}) {
  assertUser(userId);
  const id = assertUuid(args.id, 'id');
  const db = requireDb();
  const { data, error } = await db
    .from('vehicles')
    .select(VEHICLE_DETAIL_FIELDS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  assertNoError(error);
  if (!data) httpError(404, 'Vehículo no encontrado');
  const { data: images, error: imageError } = await db
    .from('vehicle_images')
    .select('image_url')
    .eq('vehicle_id', id)
    .limit(1);
  assertNoError(imageError);
  return {
    vehicle: {
      ...data,
      anotaciones: clip(data.anotaciones, 500),
      image: images?.[0]?.image_url || null,
    },
  };
}

async function listCircuits(userId) {
  assertUser(userId);
  const db = requireDb();
  const { data, error } = await db
    .from('circuits')
    .select('id, name, description, num_lanes, lane_lengths')
    .eq('user_id', userId)
    .order('name', { ascending: true })
    .limit(100);
  assertNoError(error);
  return { circuits: data || [] };
}

async function listTimings(userId, args = {}) {
  assertUser(userId);
  const db = requireDb();
  const limit = clampInt(args.limit, 25, 1, 25);
  const dateFrom = assertDate(args.date_from, 'date_from');
  const dateTo = assertDate(args.date_to, 'date_to');
  let vehicleIds;
  if (args.vehicle_id) {
    const vehicleId = assertUuid(args.vehicle_id, 'vehicle_id');
    const { data: vehicle, error } = await db
      .from('vehicles')
      .select('id')
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(error);
    if (!vehicle) httpError(404, 'Vehículo no encontrado');
    vehicleIds = [vehicleId];
  } else {
    const { data, error } = await db.from('vehicles').select('id').eq('user_id', userId).limit(100);
    assertNoError(error);
    vehicleIds = (data || []).map((row) => row.id);
  }
  if (args.circuit_id) {
    const circuitId = assertUuid(args.circuit_id, 'circuit_id');
    const { data: circuit, error } = await db
      .from('circuits')
      .select('id')
      .eq('id', circuitId)
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(error);
    if (!circuit) httpError(404, 'Circuito no encontrado');
  }
  if (vehicleIds.length === 0) return { timings: [] };
  let query = db
    .from('vehicle_timings')
    .select(TIMING_FIELDS)
    .in('vehicle_id', vehicleIds)
    .order('timing_date', { ascending: false })
    .limit(limit);
  if (dateFrom) query = query.gte('timing_date', dateFrom);
  if (dateTo) query = query.lte('timing_date', dateTo);
  if (args.circuit_id) query = query.eq('circuit_id', args.circuit_id);
  if (args.lane != null && args.lane !== '') query = query.eq('lane', String(args.lane));
  const { data, error } = await query;
  assertNoError(error);
  return { timings: data || [] };
}

async function listCompetitions(userId) {
  assertUser(userId);
  const db = requireDb();
  const { data: memberships, error: memError } = await db
    .from('club_members')
    .select('club_id')
    .eq('user_id', userId);
  assertNoError(memError);
  const clubIds = [...new Set((memberships || []).map((row) => row.club_id).filter(Boolean))];
  const owned = await db
    .from('competitions')
    .select(COMP_FIELDS)
    .eq('organizer', userId)
    .order('created_at', { ascending: false })
    .limit(25);
  assertNoError(owned.error);
  let clubRows = [];
  if (clubIds.length > 0) {
    const clubComps = await db
      .from('competitions')
      .select(COMP_FIELDS)
      .in('club_id', clubIds)
      .neq('organizer', userId)
      .order('created_at', { ascending: false })
      .limit(25);
    assertNoError(clubComps.error);
    clubRows = clubComps.data || [];
  }
  const byId = new Map();
  for (const row of [...(owned.data || []), ...clubRows]) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  }
  return { competitions: [...byId.values()].slice(0, 25) };
}

function trimProgress(progress) {
  if (!progress || typeof progress !== 'object') return null;
  const rest = { ...progress };
  delete rest.times_by_round;
  const rankings = Array.isArray(rest.category_rankings) ? rest.category_rankings : [];
  return {
    ...rest,
    category_rankings: rankings.map((ranking) => ({
      ...ranking,
      sortedParticipants: Array.isArray(ranking.sortedParticipants)
        ? ranking.sortedParticipants.slice(0, 20)
        : [],
    })),
  };
}

async function getCompetition(userId, args = {}) {
  assertUser(userId);
  const id = assertUuid(args.id, 'id');
  const db = requireDb();
  const { data: comp, error } = await db
    .from('competitions')
    .select(`${COMP_FIELDS}, circuits(id, name)`)
    .eq('id', id)
    .maybeSingle();
  assertNoError(error);
  if (!comp) httpError(404, 'Competición no encontrada');
  let allowed = comp.organizer === userId;
  if (!allowed && comp.club_id) {
    const { data: mem, error: memError } = await db
      .from('club_members')
      .select('id')
      .eq('club_id', comp.club_id)
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(memError);
    allowed = Boolean(mem);
  }
  if (!allowed) httpError(403, 'Sin acceso a esta competición');
  const { data: participants, error: partError } = await db
    .from('competition_participants')
    .select('id, driver_name, team_name, vehicle_model, vehicles(model, manufacturer)')
    .eq('competition_id', id)
    .limit(40);
  assertNoError(partError);
  const progress = trimProgress(await buildCompetitionProgress(db, id, comp));
  return {
    competition: comp,
    participants: participants || [],
    progress,
  };
}

function resetCatalogLookupLimit() {
  catalogLookups.clear();
  resetCatalogUsageState();
}

function assertCatalogLookupLimit(userId, now = Date.now()) {
  const bucket = catalogLookups.get(userId);
  if (!bucket || now - bucket.start >= CATALOG_WINDOW_MS) {
    catalogLookups.set(userId, { start: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > CATALOG_LOOKUPS_PER_MINUTE) {
    httpError(429, 'Demasiadas consultas al catálogo. Máximo 10 por minuto.');
  }
}

function oneExactText(value, label) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (text.length < 2 || text.length > 80) httpError(400, `${label} debe ser un texto concreto`);
  return text;
}

async function exactBrand(db, manufacturer) {
  const name = escapeIlikePattern(manufacturer);
  const byName = await db
    .from('slot_catalog_brands')
    .select('id')
    .ilike('name', name)
    .limit(2);
  assertNoError(byName.error);
  const named = byName.data || [];
  if (named.length > 1) httpError(404, 'No hay una marca con ese nombre exacto');
  if (named.length === 1) return named[0].id;
  const bySlug = await db
    .from('slot_catalog_brands')
    .select('id')
    .eq('slug', catalogSlugify(manufacturer))
    .limit(2);
  assertNoError(bySlug.error);
  const slugged = bySlug.data || [];
  if (slugged.length !== 1) httpError(404, 'No hay una marca con ese nombre exacto');
  return slugged[0].id;
}

async function oneItemId(db, table, column, reference, manufacturerId) {
  const { data, error } = await db
    .from(table)
    .select(column === 'reference' ? 'id' : 'catalog_item_id')
    .eq(column, reference)
    .eq('manufacturer_id', manufacturerId)
    .limit(2);
  assertNoError(error);
  const rows = data || [];
  if (rows.length > 1) httpError(409, 'Hay más de una ficha. No se devuelve un listado.');
  if (rows.length === 0) return null;
  return column === 'reference' ? rows[0].id : rows[0].catalog_item_id;
}

async function getCatalogItem(userId, args = {}, context = {}) {
  assertUser(userId);
  const reference = normalizeReference(oneExactText(args.reference, 'reference'));
  const manufacturer = oneExactText(args.manufacturer, 'manufacturer');
  if (!reference) httpError(400, 'reference debe ser un texto concreto');
  const clientId = context.clientId || null;
  const db = requireDb();
  const blocked = await assertPersistedCatalogLimit(db, userId, reference, manufacturer, clientId);
  if (blocked === 'day') httpError(429, 'Demasiadas consultas al catálogo. Máximo 100 al día.');
  if (blocked === 'minute') httpError(429, 'Demasiadas consultas al catálogo. Máximo 10 por minuto.');
  assertCatalogLookupLimit(userId);
  let outcome = null;
  try {
    const manufacturerId = await exactBrand(db, manufacturer);
    const itemId = await oneItemId(db, 'slot_catalog_items', 'reference', reference, manufacturerId)
      || await oneItemId(db, 'slot_catalog_item_aliases', 'alias_reference', reference, manufacturerId);
    if (!itemId) httpError(404, 'Ítem no encontrado');
    const { data, error } = await db
      .from('slot_catalog_items_with_ratings')
      .select(CATALOG_ITEM_FIELDS)
      .eq('id', itemId)
      .maybeSingle();
    assertNoError(error);
    if (!data) httpError(404, 'Ítem no encontrado');
    outcome = 'found';
    return { item: data };
  } catch (err) {
    if (err.statusCode === 409) outcome = 'ambiguous';
    else if (err.statusCode === 404) outcome = 'not_found';
    throw err;
  } finally {
    if (outcome) {
      await recordCatalogLookup(db, {
        userId,
        clientId,
        reference,
        manufacturer,
        outcome,
      });
    }
  }
}

module.exports = {
  searchCollection,
  listVehicles,
  getVehicle,
  listCircuits,
  listTimings,
  listCompetitions,
  getCompetition,
  getCatalogItem,
  resetCatalogLookupLimit,
};
