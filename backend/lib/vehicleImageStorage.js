/**
 * Supabase Storage helpers for bucket `vehicle-images`.
 *
 * Env (documentación): las rutas públicas incluyen /object/public/vehicle-images/<path>
 * o /storage/v1/object/public/vehicle-images/<path> según despliegue.
 *
 * @see processVehicleImageBuffer.js — VEHICLE_IMAGE_MAX_UPLOAD_BYTES, VEHICLE_IMAGE_MAX_EDGE_PX
 */

const VEHICLE_IMAGES_BUCKET = 'vehicle-images';

/**
 * Extrae la clave del objeto dentro del bucket a partir de la URL pública devuelta por Supabase.
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
 * Elimina un objeto del bucket usando la URL pública almacenada en BD.
 * @param {import('@supabase/supabase-js').SupabaseClient} storageClient
 * @param {string} publicUrl
 * @returns {Promise<{ error: Error | null }>}
 */
async function removeObjectByPublicUrl(storageClient, publicUrl) {
  const storagePath = storagePathFromPublicUrl(publicUrl);
  if (!storagePath) return { error: new Error('URL de imagen inválida') };
  const { error } = await storageClient.storage.from(VEHICLE_IMAGES_BUCKET).remove([storagePath]);
  return { error: error || null };
}

/**
 * Lista y elimina todos los objetos bajo vehicles/{vehicleId}/ (paginado).
 * @param {import('@supabase/supabase-js').SupabaseClient} storageClient
 * @param {string} vehicleId
 */
async function removeAllObjectsInVehicleFolder(storageClient, vehicleId) {
  const folder = `vehicles/${vehicleId}`;
  const limit = 100;
  let offset = 0;
  for (;;) {
    const { data: files, error } = await storageClient.storage.from(VEHICLE_IMAGES_BUCKET).list(folder, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      throw new Error(error.message);
    }
    if (!files || files.length === 0) break;
    const paths = files.map((f) => `${folder}/${f.name}`);
    const { error: removeError } = await storageClient.storage.from(VEHICLE_IMAGES_BUCKET).remove(paths);
    if (removeError) {
      throw new Error(removeError.message);
    }
    if (files.length < limit) break;
    offset += limit;
  }
}

module.exports = {
  VEHICLE_IMAGES_BUCKET,
  storagePathFromPublicUrl,
  removeObjectByPublicUrl,
  removeAllObjectsInVehicleFolder,
};
