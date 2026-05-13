/**
 * Elige la URL de imagen preferida para un vehículo (misma prioridad que ficha PDF y listado API).
 * `images` debe estar ordenado por `created_at` ascendente si hay varias vistas.
 * @param {{ image_url: string, view_type?: string | null }[]} images
 * @returns {string | null}
 */
function pickPreferredVehicleImageUrl(images) {
  if (!images || images.length === 0) return null;
  const threeQuarters = images.find((img) => img.view_type === 'three_quarters');
  if (threeQuarters) return threeQuarters.image_url;
  const lateral = images.find((img) => img.view_type === 'left' || img.view_type === 'right');
  if (lateral) return lateral.image_url;
  return images[0].image_url;
}

module.exports = { pickPreferredVehicleImageUrl };
