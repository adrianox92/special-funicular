'use strict';

const { getServiceClient } = require('./supabaseClients');
const { vehiclePurchaseCost } = require('./componentPricing');
const { evaluateGoalProgress } = require('./trainingGoals');
const { formatSecondsToLapTime } = require('./timingUtils');
const { ALLOWED_CATEGORIES } = require('./partsRegistry');
const {
  applyInventoryItemListFilters,
  applyInventoryItemPostFilters,
} = require('./inventoryListFilters');
const { isPublicOffer, publicOfferCutoff } = require('./shopOfferSync');
const { findExactCatalogItemId, withCatalogLookup } = require('./mcpReadTools');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GARAGE_CAP = 1000;
const BEST_LAP_SCAN = 200;
const BEST_LAP_LIMIT = 25;
const CIRCUIT_SESSION_CAP = 300;
const CRITICAL_INVENTORY_CATEGORIES = new Set([
  'motor',
  'guide',
  'pinion',
  'crown',
  'neumaticos',
  'front_wheel',
  'rear_wheel',
  'axle',
]);

const CAPABILITY_MENU = {
  groups: [
    {
      name: 'Opciones',
      options: [
        {
          tool: 'list_capabilities',
          summary: 'Lista lo que este conector puede consultar y lo que no hace.',
          example: '¿Qué opciones tienes?',
        },
      ],
    },
    {
      name: 'Garaje',
      options: [
        {
          tool: 'search_collection',
          summary: 'Busca un texto en coches, circuitos y competiciones.',
          example: 'Busca Porsche en mi colección',
        },
        {
          tool: 'list_vehicles',
          summary: 'Lista el garaje, paginado o filtrado por modelo o marca.',
          example: '¿Qué coches tengo de Avant Slot?',
        },
        {
          tool: 'get_vehicle',
          summary: 'Ficha de un coche del garaje a partir de su id.',
          example: 'Enséñame la ficha de este coche',
        },
        {
          tool: 'garage_summary',
          summary: 'Resume totales, marcas, tipos, valor de compra y coches sin ficha de catálogo.',
          example: '¿Cómo va mi garaje?',
        },
      ],
    },
    {
      name: 'Tiempos',
      options: [
        {
          tool: 'list_timings',
          summary: 'Sesiones de entrenamiento, con filtros de coche, circuito, carril y fechas.',
          example: 'Mis últimas sesiones en este circuito',
        },
        {
          tool: 'best_laps',
          summary: 'Mejor vuelta por coche, circuito y carril.',
          example: '¿Cuál es mi mejor tiempo en cada carril?',
        },
        {
          tool: 'training_goals',
          summary: 'Metas de entrenamiento activas y cuánto falta para cumplirlas.',
          example: '¿Cómo van mis metas?',
        },
      ],
    },
    {
      name: 'Competiciones',
      options: [
        {
          tool: 'list_competitions',
          summary: 'Competiciones que organizas y las de tus clubes.',
          example: '¿Qué competiciones tengo?',
        },
        {
          tool: 'get_competition',
          summary: 'Participantes y progreso de una competición a la que tienes acceso.',
          example: '¿Cómo va esta carrera?',
        },
        {
          tool: 'action_items',
          summary: 'Pendientes: competiciones abiertas, recambios bajo mínimo y revisiones de esta semana.',
          example: '¿Qué tengo pendiente?',
        },
      ],
    },
    {
      name: 'Circuito',
      options: [
        {
          tool: 'list_circuits',
          summary: 'Circuitos personales.',
          example: '¿Qué circuitos tengo?',
        },
        {
          tool: 'get_circuit',
          summary: 'Ficha de un circuito y comparativa de tiempos por carril.',
          example: 'Compara los carriles de mi circuito de casa',
        },
      ],
    },
    {
      name: 'Mantenimiento',
      options: [
        {
          tool: 'list_maintenance',
          summary: 'Revisiones de un coche, o las recientes y las que vencen en siete días.',
          example: '¿Qué mantenimiento tiene este coche?',
        },
      ],
    },
    {
      name: 'Inventario',
      options: [
        {
          tool: 'list_inventory',
          summary: 'Recambios en stock, por texto, categoría o bajo mínimo.',
          example: '¿Me queda stock de motores?',
        },
      ],
    },
    {
      name: 'Catálogo',
      options: [
        {
          tool: 'get_catalog_item',
          summary: 'Una ficha concreta, con referencia y marca exactas. No lista el catálogo.',
          example: 'Ficha de la referencia 50402 de Avant Slot',
        },
        {
          tool: 'get_catalog_offers',
          summary: 'Precio y tienda de esa misma ficha. Comparte el cupo de consultas del catálogo.',
          example: '¿A qué precio está la 50402 de Avant Slot?',
        },
      ],
    },
  ],
  cannot: [
    'No lista ni busca el catálogo. Solo una ficha concreta por referencia y marca, y las ofertas de esa ficha.',
    'No crea, no edita y no borra datos.',
    'No consulta ligas ni clubes.',
  ],
};

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

function roundMoney(n) {
  return Number(Number(n || 0).toFixed(2));
}

function embedOne(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function isoDay(offset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function lapSeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function topCounts(rows, key, emptyLabel, limit = 15) {
  const counts = new Map();
  for (const row of rows) {
    const name = row[key] ? String(row[key]) : emptyLabel;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function listCapabilities(userId) {
  assertUser(userId);
  return CAPABILITY_MENU;
}

async function garageSummary(userId) {
  assertUser(userId);
  const db = requireDb();
  const { data, error } = await db
    .from('vehicles')
    .select('id, manufacturer, type, price, catalog_item_id, modified, digital')
    .eq('user_id', userId)
    .limit(GARAGE_CAP);
  assertNoError(error);
  const rows = data || [];
  const purchase = rows.reduce((sum, row) => sum + vehiclePurchaseCost(row), 0);
  return {
    total: rows.length,
    modified: rows.filter((row) => row.modified).length,
    digital: rows.filter((row) => row.digital).length,
    purchase_total: roundMoney(purchase),
    unlinked_catalog: rows.filter((row) => !row.catalog_item_id).length,
    by_manufacturer: topCounts(rows, 'manufacturer', 'Sin marca'),
    by_type: topCounts(rows, 'type', 'Sin tipo'),
    truncated: rows.length >= GARAGE_CAP,
  };
}

async function assertOwnedVehicle(db, userId, vehicleId) {
  const { data, error } = await db
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('user_id', userId)
    .maybeSingle();
  assertNoError(error);
  if (!data) httpError(404, 'Vehículo no encontrado');
}

async function assertOwnedCircuit(db, userId, circuitId) {
  const { data, error } = await db
    .from('circuits')
    .select('id')
    .eq('id', circuitId)
    .eq('user_id', userId)
    .maybeSingle();
  assertNoError(error);
  if (!data) httpError(404, 'Circuito no encontrado');
}

async function bestLaps(userId, args = {}) {
  assertUser(userId);
  const db = requireDb();
  const dateFrom = assertDate(args.date_from, 'date_from');
  const dateTo = assertDate(args.date_to, 'date_to');
  let vehicleId = null;
  let circuitId = null;
  if (args.vehicle_id) {
    vehicleId = assertUuid(args.vehicle_id, 'vehicle_id');
    await assertOwnedVehicle(db, userId, vehicleId);
  }
  if (args.circuit_id) {
    circuitId = assertUuid(args.circuit_id, 'circuit_id');
    await assertOwnedCircuit(db, userId, circuitId);
  }
  let query = db
    .from('vehicle_timings')
    .select('best_lap_time, timing_date, circuit, circuit_id, lane, vehicle_id, vehicles!inner(id, model, manufacturer)')
    .eq('vehicles.user_id', userId)
    .order('best_lap_time', { ascending: true })
    .limit(BEST_LAP_SCAN);
  if (vehicleId) query = query.eq('vehicle_id', vehicleId);
  if (circuitId) query = query.eq('circuit_id', circuitId);
  if (dateFrom) query = query.gte('timing_date', dateFrom);
  if (dateTo) query = query.lte('timing_date', dateTo);
  if (args.lane != null && args.lane !== '') query = query.eq('lane', String(args.lane));
  const { data, error } = await query;
  assertNoError(error);
  const grouped = new Map();
  for (const row of data || []) {
    const seconds = lapSeconds(row.best_lap_time);
    if (seconds == null) continue;
    const vehicle = embedOne(row.vehicles);
    const key = `${row.vehicle_id}|${row.circuit_id || row.circuit || ''}|${row.lane || ''}`;
    const current = grouped.get(key);
    if (current && current.best_lap_time <= seconds) continue;
    grouped.set(key, {
      vehicle_id: row.vehicle_id,
      model: vehicle?.model || null,
      manufacturer: vehicle?.manufacturer || null,
      circuit_id: row.circuit_id || null,
      circuit: row.circuit || null,
      lane: row.lane == null ? null : String(row.lane),
      best_lap_time: seconds,
      best_lap_display: formatSecondsToLapTime(seconds),
      timing_date: row.timing_date || null,
    });
  }
  const laps = [...grouped.values()]
    .sort((a, b) => a.best_lap_time - b.best_lap_time)
    .slice(0, BEST_LAP_LIMIT);
  return { laps };
}

async function trainingGoals(userId) {
  assertUser(userId);
  const db = requireDb();
  const { data: goals, error } = await db
    .from('training_goals')
    .select('id, goal_type, target_value, lane, circuit_id, vehicle_id, vehicles(id, model, manufacturer), circuits(name)')
    .eq('user_id', userId)
    .eq('active', true)
    .is('achieved_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  assertNoError(error);
  const rows = goals || [];
  const vehicleIds = [...new Set(rows.map((goal) => goal.vehicle_id).filter(Boolean))];
  const timingsByVehicle = {};
  if (vehicleIds.length > 0) {
    const { data: timings, error: timingError } = await db
      .from('vehicle_timings')
      .select('id, vehicle_id, circuit_id, lane, best_lap_time, best_lap_timestamp, consistency_score, timing_date')
      .in('vehicle_id', vehicleIds)
      .order('timing_date', { ascending: false })
      .limit(200);
    assertNoError(timingError);
    for (const timing of timings || []) {
      if (!timingsByVehicle[timing.vehicle_id]) timingsByVehicle[timing.vehicle_id] = [];
      timingsByVehicle[timing.vehicle_id].push(timing);
    }
  }
  return {
    goals: rows.map((goal) => {
      const progress = evaluateGoalProgress(goal, timingsByVehicle[goal.vehicle_id] || []);
      const vehicle = embedOne(goal.vehicles);
      const circuit = embedOne(goal.circuits);
      return {
        id: goal.id,
        goal_type: goal.goal_type,
        target_value: Number(goal.target_value),
        lane: goal.lane,
        circuit_name: circuit?.name || null,
        vehicle,
        progress_pct: progress.progressPct,
        current_value: progress.currentValue,
        current_display: goal.goal_type === 'lap_time' && progress.currentValue != null
          ? formatSecondsToLapTime(progress.currentValue)
          : progress.currentValue,
        target_display: goal.goal_type === 'lap_time'
          ? formatSecondsToLapTime(Number(goal.target_value))
          : `${Number(goal.target_value).toFixed(1)}%`,
      };
    }),
  };
}

async function actionItems(userId) {
  assertUser(userId);
  const db = requireDb();
  const today = isoDay(0);
  const until = isoDay(7);
  const [competitions, inventory, maintenance] = await Promise.all([
    db.from('competitions')
      .select('id, name, circuit_name, status')
      .eq('organizer', userId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('inventory_items')
      .select('id, name, reference, category, quantity, min_stock')
      .eq('user_id', userId)
      .in('category', [...CRITICAL_INVENTORY_CATEGORIES])
      .not('min_stock', 'is', null)
      .limit(200),
    db.from('vehicle_maintenance_log')
      .select('id, vehicle_id, kind, next_due_at, vehicles(model, manufacturer)')
      .eq('user_id', userId)
      .gte('next_due_at', today)
      .lte('next_due_at', until)
      .order('next_due_at', { ascending: true })
      .limit(5),
  ]);
  assertNoError(competitions.error);
  assertNoError(inventory.error);
  assertNoError(maintenance.error);
  const lowStock = (inventory.data || [])
    .filter((row) => CRITICAL_INVENTORY_CATEGORIES.has(String(row.category)))
    .filter((row) => row.min_stock != null && Number(row.quantity) <= Number(row.min_stock))
    .sort((a, b) => Number(a.quantity) - Number(b.quantity))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      name: row.name,
      reference: row.reference,
      category: row.category,
      quantity: row.quantity,
      min_stock: row.min_stock,
    }));
  return {
    open_competitions: competitions.data || [],
    low_stock: lowStock,
    maintenance_due: (maintenance.data || []).map((row) => {
      const vehicle = embedOne(row.vehicles);
      return {
        id: row.id,
        vehicle_id: row.vehicle_id,
        kind: row.kind,
        next_due_at: row.next_due_at,
        model: vehicle?.model || null,
        manufacturer: vehicle?.manufacturer || null,
      };
    }),
  };
}

async function getCircuit(userId, args = {}) {
  assertUser(userId);
  const id = assertUuid(args.id, 'id');
  const db = requireDb();
  const { data: circuit, error } = await db
    .from('circuits')
    .select('id, name, description, num_lanes, lane_lengths')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  assertNoError(error);
  if (!circuit) httpError(404, 'Circuito no encontrado');
  const { data: timings, error: timingError } = await db
    .from('vehicle_timings')
    .select('best_lap_time, lane, vehicle_id, timing_date, vehicles!inner(id, model, manufacturer)')
    .eq('circuit_id', id)
    .eq('vehicles.user_id', userId)
    .limit(CIRCUIT_SESSION_CAP);
  assertNoError(timingError);
  const byLane = new Map();
  for (const row of timings || []) {
    const lane = row.lane == null ? '' : String(row.lane);
    let bucket = byLane.get(lane);
    if (!bucket) {
      bucket = { lane, sessions: 0, best: null, sum: 0, timed: 0 };
      byLane.set(lane, bucket);
    }
    bucket.sessions += 1;
    const seconds = lapSeconds(row.best_lap_time);
    if (seconds == null) continue;
    bucket.sum += seconds;
    bucket.timed += 1;
    if (!bucket.best || seconds < bucket.best.seconds) {
      const vehicle = embedOne(row.vehicles);
      bucket.best = {
        seconds,
        vehicle_id: row.vehicle_id,
        model: vehicle?.model || null,
        manufacturer: vehicle?.manufacturer || null,
        timing_date: row.timing_date || null,
      };
    }
  }
  const lanes = [...byLane.values()]
    .sort((a, b) => a.lane.localeCompare(b.lane))
    .map((bucket) => ({
      lane: bucket.lane,
      sessions: bucket.sessions,
      best_lap_time: bucket.best ? bucket.best.seconds : null,
      best_lap_display: bucket.best ? formatSecondsToLapTime(bucket.best.seconds) : null,
      best_vehicle_id: bucket.best?.vehicle_id || null,
      best_model: bucket.best?.model || null,
      best_manufacturer: bucket.best?.manufacturer || null,
      average_lap_time: bucket.timed ? Number((bucket.sum / bucket.timed).toFixed(3)) : null,
    }));
  return {
    circuit: {
      ...circuit,
      description: clip(circuit.description, 500),
    },
    lanes,
  };
}

function trimMaintenance(row) {
  const vehicle = embedOne(row.vehicles);
  return {
    id: row.id,
    vehicle_id: row.vehicle_id || null,
    performed_at: row.performed_at || null,
    kind: row.kind || null,
    next_due_at: row.next_due_at || null,
    notes: clip(row.notes, 300),
    model: vehicle?.model || null,
    manufacturer: vehicle?.manufacturer || null,
  };
}

async function listMaintenance(userId, args = {}) {
  assertUser(userId);
  const db = requireDb();
  if (args.vehicle_id) {
    const vehicleId = assertUuid(args.vehicle_id, 'vehicle_id');
    await assertOwnedVehicle(db, userId, vehicleId);
    const { data, error } = await db
      .from('vehicle_maintenance_log')
      .select('id, vehicle_id, performed_at, kind, next_due_at, notes')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(15);
    assertNoError(error);
    return { maintenance: (data || []).map(trimMaintenance) };
  }
  const today = isoDay(0);
  const until = isoDay(7);
  const [recent, upcoming] = await Promise.all([
    db.from('vehicle_maintenance_log')
      .select('id, vehicle_id, performed_at, kind, next_due_at, notes, vehicles(model, manufacturer)')
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(8),
    db.from('vehicle_maintenance_log')
      .select('id, vehicle_id, performed_at, kind, next_due_at, notes, vehicles(model, manufacturer)')
      .eq('user_id', userId)
      .gte('next_due_at', today)
      .lte('next_due_at', until)
      .order('next_due_at', { ascending: true })
      .limit(10),
  ]);
  assertNoError(recent.error);
  assertNoError(upcoming.error);
  return {
    recent: (recent.data || []).map(trimMaintenance),
    upcoming: (upcoming.data || []).map(trimMaintenance),
  };
}

async function listInventory(userId, args = {}) {
  assertUser(userId);
  if (args.category != null && args.category !== '' && !ALLOWED_CATEGORIES.has(String(args.category))) {
    httpError(400, 'category no es válida');
  }
  const db = requireDb();
  const limit = clampInt(args.limit, 25, 1, 25);
  const fetchLimit = args.low_stock ? 100 : limit;
  let query = db
    .from('inventory_items')
    .select('id, name, reference, category, quantity, min_stock, unit')
    .eq('user_id', userId);
  query = applyInventoryItemListFilters(query, {
    q: args.q,
    category: args.category,
    low_stock: args.low_stock,
  });
  const { data, error } = await query.limit(fetchLimit);
  assertNoError(error);
  const items = applyInventoryItemPostFilters(data || [], { low_stock: args.low_stock }).slice(0, limit);
  return { items };
}

function shopFromEmbed(row) {
  const shop = Array.isArray(row?.catalog_shops) ? row.catalog_shops[0] : row.catalog_shops;
  return shop || null;
}

function toCatalogOffer(row) {
  const shop = shopFromEmbed(row);
  const price = row.price == null ? null : Number(row.price);
  const previous = row.previous_price == null ? null : Number(row.previous_price);
  return {
    shop_name: shop?.name ?? null,
    country_code: shop?.country_code ?? null,
    price,
    previous_price: previous != null && price != null && previous > price ? previous : null,
    currency: row.currency || null,
  };
}

async function getCatalogOffers(userId, args = {}, context = {}) {
  return withCatalogLookup(userId, args, context, async (db, reference, manufacturer) => {
    const itemId = await findExactCatalogItemId(db, reference, manufacturer);
    const { data, error } = await db
      .from('catalog_shop_offers')
      .select('price, previous_price, currency, in_stock, last_checked_at, catalog_shops!inner(name, country_code, active)')
      .eq('catalog_item_id', itemId)
      .eq('in_stock', true)
      .gte('last_checked_at', publicOfferCutoff())
      .eq('catalog_shops.active', true);
    assertNoError(error);
    const offers = (data || [])
      .filter((row) => isPublicOffer(row, shopFromEmbed(row)))
      .map(toCatalogOffer);
    return { outcome: 'found', value: { reference, manufacturer, offers } };
  });
}

module.exports = {
  CAPABILITY_MENU,
  listCapabilities,
  garageSummary,
  bestLaps,
  trainingGoals,
  actionItems,
  getCircuit,
  listMaintenance,
  listInventory,
  getCatalogOffers,
};
