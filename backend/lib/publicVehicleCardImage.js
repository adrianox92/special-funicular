'use strict';

const { pickPreferredVehicleImageUrl } = require('./vehicleImagePick');

/**
 * Foto de la card pública: primero la del vehículo (misma prioridad que el garaje),
 * si no hay, la del ítem de catálogo enlazado. Nunca inventa otra imagen.
 * @param {{ vehicleImages?: { image_url: string, view_type?: string | null }[], catalogImageUrl?: string | null }} input
 * @returns {string | null}
 */
function resolvePublicVehicleCardImage(input) {
  const own = pickPreferredVehicleImageUrl((input && input.vehicleImages) || []);
  if (own && String(own).trim()) return String(own).trim();
  const catalog = input && input.catalogImageUrl != null ? String(input.catalogImageUrl).trim() : '';
  return catalog || null;
}

module.exports = { resolvePublicVehicleCardImage };
