'use strict';

/**
 * Filtros del listado de vehículos (misma semántica que export CSV/PDF).
 *
 * Query params: manufacturer, model (ilike), type, modified, digital,
 * filterMuseo, filterTaller, scale / scale_factor.
 * Museo + taller juntos usan OR (`museo.eq.true,taller.eq.true`).
 *
 * @param {object} query - builder de Supabase (chainable)
 * @param {object} [params] - típ. `req.query`
 * @returns {object} el mismo builder con los filtros aplicados
 */
function applyVehicleListFilters(query, params = {}) {
  const {
    manufacturer,
    model,
    type,
    modified,
    digital,
    filterMuseo,
    filterTaller,
    scale,
    scale_factor,
  } = params || {};

  if (manufacturer && String(manufacturer).trim()) {
    query = query.ilike('manufacturer', `%${String(manufacturer).trim()}%`);
  }
  if (model && String(model).trim()) {
    query = query.ilike('model', `%${String(model).trim()}%`);
  }
  if (type && String(type).trim()) {
    query = query.eq('type', String(type).trim());
  }
  if (modified === 'Sí' || modified === 'true') {
    query = query.eq('modified', true);
  } else if (modified === 'No' || modified === 'false') {
    query = query.eq('modified', false);
  }
  if (digital === 'Digital' || digital === 'true') {
    query = query.eq('digital', true);
  } else if (digital === 'Analógico' || digital === 'false') {
    query = query.eq('digital', false);
  }
  const museoFilter = filterMuseo === 'true' || filterMuseo === true;
  const tallerFilter = filterTaller === 'true' || filterTaller === true;
  if (museoFilter && tallerFilter) {
    query = query.or('museo.eq.true,taller.eq.true');
  } else if (museoFilter) {
    query = query.eq('museo', true);
  } else if (tallerFilter) {
    query = query.eq('taller', true);
  }
  const scaleParam = scale != null && String(scale).trim() !== '' ? scale : scale_factor;
  if (scaleParam != null && String(scaleParam).trim() !== '') {
    const n = parseInt(String(scaleParam).trim(), 10);
    if (Number.isFinite(n) && n > 0) {
      query = query.eq('scale_factor', n);
    }
  }
  return query;
}

/** Alias histórico usado por export CSV/PDF. */
const applyVehicleExportFilters = applyVehicleListFilters;

module.exports = {
  applyVehicleListFilters,
  applyVehicleExportFilters,
};
