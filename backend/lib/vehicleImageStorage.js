/**
 * Helpers de borrado para el bucket lógico `vehicle-images` (Supabase Storage o R2).
 *
 * Las URLs guardadas incluyen /vehicle-images/<path>: en Supabase tras
 * /storage/v1/object/public/ y en R2 tras /api/img/r2/.
 *
 * @see processVehicleImageBuffer.js — VEHICLE_IMAGE_MAX_UPLOAD_BYTES, VEHICLE_IMAGE_MAX_EDGE_PX
 */

const { removeObjects, removePrefix, providerForUrl } = require('./imageObjectStorage');

const VEHICLE_IMAGES_BUCKET = 'vehicle-images';

/**
 * Extrae la clave del objeto dentro del bucket a partir de la URL pública guardada en BD.
 * @param {string} publicUrl
 * @returns {string|null}
 */
function storagePathFromPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const marker = `/${VEHICLE_IMAGES_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  let path = publicUrl.slice(idx + marker.length);
  const q = path.indexOf('?');
  if (q !== -1) path = path.slice(0, q);
  return path || null;
}

/**
 * Elimina un objeto usando la URL pública almacenada en BD.
 * @param {import('@supabase/supabase-js').SupabaseClient} storageClient
 * @param {string} publicUrl
 * @returns {Promise<{ error: Error | null }>}
 */
async function removeObjectByPublicUrl(storageClient, publicUrl) {
  const storagePath = storagePathFromPublicUrl(publicUrl);
  if (!storagePath) return { error: new Error('URL de imagen inválida') };
  return removeObjects(storageClient, providerForUrl(publicUrl), VEHICLE_IMAGES_BUCKET, [storagePath]);
}

/**
 * Elimina todos los objetos bajo vehicles/{vehicleId}/ en Supabase y en R2.
 * @param {import('@supabase/supabase-js').SupabaseClient} storageClient
 * @param {string} vehicleId
 */
async function removeAllObjectsInVehicleFolder(storageClient, vehicleId) {
  await removePrefix(storageClient, VEHICLE_IMAGES_BUCKET, `vehicles/${vehicleId}`);
}

module.exports = {
  VEHICLE_IMAGES_BUCKET,
  storagePathFromPublicUrl,
  removeObjectByPublicUrl,
  removeAllObjectsInVehicleFolder,
};
