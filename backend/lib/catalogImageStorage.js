const { processVehicleImageBuffer } = require('./processVehicleImageBuffer');

const CATALOG_IMAGES_BUCKET = 'catalog-images';

/**
 * Sube imagen al bucket catálogo y devuelve URL pública.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Buffer} buffer
 * @param {string} mimetype
 */
async function uploadCatalogImageBuffer(supabase, buffer, mimetype) {
  const processed = await processVehicleImageBuffer(buffer, mimetype);
  const filePath = `catalog/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${processed.ext}`;
  const { error: storageError } = await supabase.storage.from(CATALOG_IMAGES_BUCKET).upload(filePath, processed.buffer, {
    contentType: processed.contentType,
    upsert: false,
  });
  if (storageError) throw new Error(storageError.message);
  const { data: publicUrlData } = supabase.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

/**
 * @param {string} publicUrl
 * @returns {string|null}
 */
function catalogStoragePathFromPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const marker = `/${CATALOG_IMAGES_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  let path = publicUrl.slice(idx + marker.length);
  const q = path.indexOf('?');
  if (q !== -1) path = path.slice(0, q);
  return path || null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} publicUrl
 */
async function removeCatalogObjectByPublicUrl(supabase, publicUrl) {
  const storagePath = catalogStoragePathFromPublicUrl(publicUrl);
  if (!storagePath) return { error: new Error('URL de imagen de catálogo inválida') };
  const { error } = await supabase.storage.from(CATALOG_IMAGES_BUCKET).remove([storagePath]);
  return { error: error || null };
}

/**
 * Logo de marca (mismo bucket, carpeta brands/).
 */
async function uploadBrandLogoBuffer(supabase, buffer, mimetype) {
  const processed = await processVehicleImageBuffer(buffer, mimetype);
  const filePath = `brands/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${processed.ext}`;
  const { error: storageError } = await supabase.storage.from(CATALOG_IMAGES_BUCKET).upload(filePath, processed.buffer, {
    contentType: processed.contentType,
    upsert: false,
  });
  if (storageError) throw new Error(storageError.message);
  const { data: publicUrlData } = supabase.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

module.exports = {
  CATALOG_IMAGES_BUCKET,
  uploadCatalogImageBuffer,
  uploadBrandLogoBuffer,
  removeCatalogObjectByPublicUrl,
};
