/**
 * Query params del listado de inventario (misma semántica que GET /inventory y /inventory/parts).
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   category?: string,
 *   lowStock?: boolean,
 *   q?: string,
 *   onlyMounted?: boolean,
 *   vehicleId?: string,
 *   inStock?: boolean,
 * }} opts
 */
export function buildInventoryListQueryParams({
  page,
  limit,
  category,
  lowStock,
  q,
  onlyMounted,
  vehicleId,
  inStock,
} = {}) {
  const params = {};
  if (page != null) params.page = page;
  if (limit != null) params.limit = limit;
  if (category && category !== 'all') params.category = category;
  if (lowStock) params.low_stock = 'true';
  if (q) params.q = q;
  if (onlyMounted) params.only_mounted = 'true';
  if (vehicleId) params.vehicle_id = vehicleId;
  if (inStock) params.in_stock = 'true';
  return params;
}
