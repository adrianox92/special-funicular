'use strict';

/**
 * Filtros del listado de inventario (ítems y vista consolidada de piezas).
 *
 * Query params de ítems: category, vehicle_id, q (nombre/referencia), low_stock.
 * Query params de piezas: category, q (nombre/referencia/fabricante), low_stock, only_mounted.
 *
 * `low_stock` (ítems) aplica `min_stock IS NOT NULL` en PostgREST; la comparación
 * quantity <= min_stock es post-filtro (PostgREST no compara columna vs columna).
 * `low_stock` y `only_mounted` en piezas se aplican sobre la vista ensamblada.
 *
 * @param {object} query - builder de Supabase (chainable)
 * @param {object} [params] - típ. `req.query`
 * @returns {object} el mismo builder con los filtros SQL aplicados
 */

function isTruthyQueryFlag(val) {
  return val === 'true' || val === '1' || val === true || val === 1;
}

function sanitizeInventorySearchTerm(q) {
  if (q == null || String(q).trim() === '') return null;
  const safe = String(q).trim().replace(/%/g, '').replace(/,/g, ' ').replace(/[()]/g, ' ').trim();
  if (!safe) return null;
  return safe.replace(/_/g, '\\_');
}

function applyInventoryTextSearch(query, q, columns) {
  const esc = sanitizeInventorySearchTerm(q);
  if (!esc || !Array.isArray(columns) || columns.length === 0) return query;
  const orExpr = columns.map((col) => `${col}.ilike.%${esc}%`).join(',');
  return query.or(orExpr);
}

function applyInventoryCategoryFilter(query, category) {
  if (category && String(category).trim() !== '' && String(category) !== 'all') {
    return query.eq('category', String(category).trim());
  }
  return query;
}

function applyInventoryItemListFilters(query, params = {}) {
  const { category, vehicle_id: vehicleId, q, low_stock: lowStock } = params || {};

  query = applyInventoryCategoryFilter(query, category);
  if (vehicleId && String(vehicleId).trim() !== '') {
    query = query.eq('vehicle_id', String(vehicleId).trim());
  }
  query = applyInventoryTextSearch(query, q, ['name', 'reference']);
  if (isTruthyQueryFlag(lowStock)) {
    query = query.not('min_stock', 'is', null);
  }
  return query;
}

function applyInventoryPartListFilters(query, params = {}) {
  const { category, q } = params || {};
  query = applyInventoryCategoryFilter(query, category);
  query = applyInventoryTextSearch(query, q, ['name', 'reference', 'manufacturer']);
  return query;
}

function rowIsLowStock(row) {
  return row != null && row.min_stock != null && Number(row.quantity) <= Number(row.min_stock);
}

function applyInventoryItemPostFilters(rows, params = {}) {
  let out = Array.isArray(rows) ? rows : [];
  if (isTruthyQueryFlag(params.low_stock)) {
    out = out.filter(rowIsLowStock);
  }
  return out;
}

function applyInventoryPartPostFilters(views, params = {}) {
  let out = Array.isArray(views) ? views : [];
  if (isTruthyQueryFlag(params.low_stock)) {
    out = out.filter((v) => v.low_stock);
  }
  if (isTruthyQueryFlag(params.only_mounted)) {
    out = out.filter((v) => Number(v.mounted_qty) > 0);
  }
  return out;
}

function inventoryItemNeedsPostFilter(params = {}) {
  return isTruthyQueryFlag(params.low_stock);
}

function inventoryPartNeedsPostFilter(params = {}) {
  return isTruthyQueryFlag(params.low_stock) || isTruthyQueryFlag(params.only_mounted);
}

function parseInventoryListPagination(query = {}) {
  const pageRaw = query.page;
  const limitRaw = query.limit;
  const paginate =
    (pageRaw != null && String(pageRaw) !== '') ||
    (limitRaw != null && String(limitRaw) !== '');
  const page = parseInt(pageRaw, 10) || 1;
  const limit = parseInt(limitRaw, 10) || 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { paginate, page, limit, from, to };
}

function buildInventoryPagination(total, page, limit) {
  const safeTotal = total ?? 0;
  return {
    total: safeTotal,
    page,
    limit,
    totalPages: Math.ceil(safeTotal / limit),
  };
}

module.exports = {
  isTruthyQueryFlag,
  sanitizeInventorySearchTerm,
  applyInventoryItemListFilters,
  applyInventoryPartListFilters,
  applyInventoryItemPostFilters,
  applyInventoryPartPostFilters,
  inventoryItemNeedsPostFilter,
  inventoryPartNeedsPostFilter,
  parseInventoryListPagination,
  buildInventoryPagination,
  rowIsLowStock,
};
