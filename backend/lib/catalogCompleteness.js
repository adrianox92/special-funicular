'use strict';

/**
 * Completitud ponderada del catálogo (dashboard admin y marcas).
 * Marca excluida: `manufacturer_id` es NOT NULL y no discrimina.
 * Pesos sobre 6 campos, suma 1 — imagen 30%; nombre, tipo, tracción, motor y año 14% cada uno.
 */
const CATALOG_COMPLETENESS_WEIGHTS = {
  image_url: 0.3,
  model_name: 0.14,
  vehicle_type: 0.14,
  traction: 0.14,
  motor_position: 0.14,
  commercial_release_year: 0.14,
};

/**
 * Filtro PostgREST `.or()`: ítems a los que les falta algún campo ponderado.
 * (No incluye dorsal: no entra en la ponderación.)
 */
const CATALOG_WEIGHTED_MISSING_OR = [
  'image_url.is.null',
  'image_url.eq.',
  'model_name.is.null',
  'model_name.eq.',
  'vehicle_type.is.null',
  'vehicle_type.eq.',
  'traction.is.null',
  'traction.eq.',
  'motor_position.is.null',
  'motor_position.eq.',
  'commercial_release_year.is.null',
  'commercial_release_year.lt.1900',
  'commercial_release_year.gt.2100',
].join(',');

/** Año de comercialización válido para métricas “sin año” y ponderación. */
function catalogYearPresent(y) {
  if (y == null || y === '') return false;
  const n = Number(y);
  return Number.isFinite(n) && n >= 1900 && n <= 2100;
}

function catalogDorsalPresent(d) {
  if (d == null || d === '') return false;
  return String(d).trim() !== '';
}

function catalogCompletenessFilled(row) {
  return {
    model_name: row.model_name != null && String(row.model_name).trim() !== '',
    vehicle_type: row.vehicle_type != null && String(row.vehicle_type).trim() !== '',
    traction: row.traction != null && String(row.traction).trim() !== '',
    motor_position: row.motor_position != null && String(row.motor_position).trim() !== '',
    image_url: row.image_url != null && String(row.image_url).trim() !== '',
    commercial_release_year: catalogYearPresent(row.commercial_release_year),
  };
}

function catalogItemIsWeightedComplete(row) {
  const f = catalogCompletenessFilled(row);
  return (
    f.model_name &&
    f.vehicle_type &&
    f.traction &&
    f.motor_position &&
    f.image_url &&
    f.commercial_release_year
  );
}

function weightedCompletenessScore(row) {
  const w = CATALOG_COMPLETENESS_WEIGHTS;
  const f = catalogCompletenessFilled(row);
  return (
    w.image_url * (f.image_url ? 1 : 0) +
    w.model_name * (f.model_name ? 1 : 0) +
    w.vehicle_type * (f.vehicle_type ? 1 : 0) +
    w.traction * (f.traction ? 1 : 0) +
    w.motor_position * (f.motor_position ? 1 : 0) +
    w.commercial_release_year * (f.commercial_release_year ? 1 : 0)
  );
}

function pctRatio(num, den) {
  return den > 0 ? Math.round((num / den) * 10000) / 100 : 0;
}

function computeCatalogDashboardStats(rows) {
  const total = rows.length;
  let sumScores = 0;
  let fullyComplete = 0;
  let withoutImage = 0;
  let withoutVehicleType = 0;
  let withoutTraction = 0;
  let withoutMotor = 0;
  let withoutYear = 0;
  let withoutDorsal = 0;

  for (const row of rows) {
    const f = catalogCompletenessFilled(row);
    sumScores += weightedCompletenessScore(row);
    if (catalogItemIsWeightedComplete(row)) fullyComplete += 1;
    if (!f.image_url) withoutImage += 1;
    if (!f.vehicle_type) withoutVehicleType += 1;
    if (!f.traction) withoutTraction += 1;
    if (!f.motor_position) withoutMotor += 1;
    if (!catalogYearPresent(row.commercial_release_year)) withoutYear += 1;
    if (!catalogDorsalPresent(row.dorsal)) withoutDorsal += 1;
  }

  return {
    totalItems: total,
    weightedCompletenessPercent: total > 0 ? pctRatio(sumScores, total) : 0,
    fullyCompleteCount: fullyComplete,
    fullyCompletePercent: pctRatio(fullyComplete, total),
    incompleteCount: Math.max(0, total - fullyComplete),
    missing: {
      withoutImage,
      withoutVehicleType,
      withoutTraction,
      withoutMotor,
      withoutYear,
      withoutDorsal,
    },
    weights: {
      ...CATALOG_COMPLETENESS_WEIGHTS,
      note: 'Marca (manufacturer_id) no entra en la ponderación.',
    },
  };
}

/**
 * @param {Array<{ manufacturer_id?: string|null }>} rows
 * @returns {Map<string, { catalog_items_count: number, weighted_completeness_percent: number, fully_complete_count: number, incomplete_count: number }>}
 */
function aggregateCompletenessByManufacturerId(rows) {
  const byBrand = new Map();
  for (const row of rows) {
    const id = row?.manufacturer_id != null ? String(row.manufacturer_id) : '';
    if (!id) continue;
    if (!byBrand.has(id)) byBrand.set(id, []);
    byBrand.get(id).push(row);
  }
  const out = new Map();
  for (const [id, brandRows] of byBrand) {
    const stats = computeCatalogDashboardStats(brandRows);
    out.set(id, {
      catalog_items_count: stats.totalItems,
      weighted_completeness_percent: stats.weightedCompletenessPercent,
      fully_complete_count: stats.fullyCompleteCount,
      incomplete_count: stats.incompleteCount,
    });
  }
  return out;
}

/**
 * @param {object} q - builder Supabase (chainable)
 * @param {unknown} missing - query param `missing`
 */
function applyCatalogItemsMissingFilter(q, missing) {
  const key = String(missing ?? '').trim().toLowerCase();
  if (!key) return q;
  if (key === 'image') return q.or('image_url.is.null,image_url.eq.');
  if (key === 'vehicle_type') return q.or('vehicle_type.is.null,vehicle_type.eq.');
  if (key === 'traction') return q.or('traction.is.null,traction.eq.');
  if (key === 'motor' || key === 'motor_position') {
    return q.or('motor_position.is.null,motor_position.eq.');
  }
  if (key === 'year') {
    return q.or(
      'commercial_release_year.is.null,commercial_release_year.lt.1900,commercial_release_year.gt.2100',
    );
  }
  if (key === 'dorsal') return q.or('dorsal.is.null,dorsal.eq.');
  if (key === 'weighted' || key === 'incomplete') {
    return q.or(CATALOG_WEIGHTED_MISSING_OR);
  }
  return q;
}

module.exports = {
  CATALOG_COMPLETENESS_WEIGHTS,
  CATALOG_WEIGHTED_MISSING_OR,
  catalogYearPresent,
  catalogDorsalPresent,
  catalogCompletenessFilled,
  catalogItemIsWeightedComplete,
  computeCatalogDashboardStats,
  aggregateCompletenessByManufacturerId,
  applyCatalogItemsMissingFilter,
};
