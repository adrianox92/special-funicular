/**
 * Query params de filtros del listado (misma semántica que GET /vehicles y export).
 * @param {URLSearchParams} params
 * @param {{
 *   model?: string,
 *   manufacturer?: string,
 *   type?: string,
 *   modified?: string,
 *   digital?: string,
 *   filterMuseo?: boolean,
 *   filterTaller?: boolean,
 *   scale?: string,
 * }} filters
 * @returns {URLSearchParams}
 */
export function appendVehicleFilterQueryParams(params, filters) {
  if (!filters) return params;
  if (filters.model) params.set('model', filters.model);
  if (filters.manufacturer) params.set('manufacturer', filters.manufacturer);
  if (filters.type) params.set('type', filters.type);
  if (filters.modified) params.set('modified', filters.modified);
  if (filters.digital) params.set('digital', filters.digital);
  if (filters.filterMuseo) params.set('filterMuseo', 'true');
  if (filters.filterTaller) params.set('filterTaller', 'true');
  if (filters.scale) params.set('scale', filters.scale);
  return params;
}

/**
 * @param {{
 *   model?: string,
 *   manufacturer?: string,
 *   type?: string,
 *   modified?: string,
 *   digital?: string,
 *   filterMuseo?: boolean,
 *   filterTaller?: boolean,
 *   scale?: string,
 * }} filters
 */
export function hasActiveVehicleFilters(filters) {
  if (!filters) return false;
  return !!(
    filters.model ||
    filters.manufacturer ||
    filters.type ||
    filters.modified !== '' ||
    filters.digital !== '' ||
    filters.scale !== '' ||
    filters.filterMuseo ||
    filters.filterTaller
  );
}
