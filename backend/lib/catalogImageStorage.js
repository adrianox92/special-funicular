const { processVehicleImageBuffer, DEFAULT_THUMB_EDGE } = require('./processVehicleImageBuffer');
const { STORAGE_UPLOAD_CACHE } = require('./storageCacheControl');

function isThumbPath(storagePath) {
  return /-thumb\.[A-Za-z0-9]+$/.test(String(storagePath || ''));
}

function withThumbSuffix(storagePath) {
  const s = String(storagePath || '');
  if (!s || isThumbPath(s)) return s;
  return s.replace(/(\.[A-Za-z0-9]+)$/, '-thumb$1');
}

const CATALOG_IMAGES_BUCKET = 'catalog-images';

function randomCatalogStem() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function uploadOptions(contentType, extra = {}) {
  return {
    contentType,
    upsert: false,
    ...STORAGE_UPLOAD_CACHE,
    ...extra,
  };
}

/**
 * Sube imagen al bucket catálogo (detalle + miniatura `-thumb`) y devuelve URL pública del detalle.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Buffer} buffer
 * @param {string} mimetype
 */
async function uploadCatalogImageBuffer(supabase, buffer, mimetype) {
  const processed = await processVehicleImageBuffer(buffer, mimetype);
  const stem = `catalog/${randomCatalogStem()}`;
  const filePath = `${stem}${processed.ext}`;
  const { error: storageError } = await supabase.storage
    .from(CATALOG_IMAGES_BUCKET)
    .upload(filePath, processed.buffer, uploadOptions(processed.contentType));
  if (storageError) throw new Error(storageError.message);

  try {
    const thumb = await processVehicleImageBuffer(buffer, mimetype, { maxEdgePx: DEFAULT_THUMB_EDGE });
    const thumbPath = `${stem}-thumb${thumb.ext}`;
    const { error: thumbError } = await supabase.storage
      .from(CATALOG_IMAGES_BUCKET)
      .upload(thumbPath, thumb.buffer, uploadOptions(thumb.contentType));
    if (thumbError) {
      console.warn('[catalogImageStorage] no se pudo subir miniatura:', thumbError.message);
    }
  } catch (thumbErr) {
    console.warn('[catalogImageStorage] no se pudo generar miniatura:', thumbErr.message);
  }

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

function thumbStoragePathFromDetailPath(storagePath) {
  if (!storagePath || isThumbPath(storagePath)) return null;
  return withThumbSuffix(storagePath);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} publicUrl
 */
async function removeCatalogObjectByPublicUrl(supabase, publicUrl) {
  const storagePath = catalogStoragePathFromPublicUrl(publicUrl);
  if (!storagePath) return { error: new Error('URL de imagen de catálogo inválida') };
  const paths = [storagePath];
  const thumbPath = thumbStoragePathFromDetailPath(storagePath);
  if (thumbPath && thumbPath !== storagePath) paths.push(thumbPath);
  const { error } = await supabase.storage.from(CATALOG_IMAGES_BUCKET).remove(paths);
  return { error: error || null };
}

/**
 * Logo de marca (mismo bucket, carpeta brands/).
 */
async function uploadBrandLogoBuffer(supabase, buffer, mimetype) {
  const processed = await processVehicleImageBuffer(buffer, mimetype);
  const filePath = `brands/${randomCatalogStem()}${processed.ext}`;
  const { error: storageError } = await supabase.storage
    .from(CATALOG_IMAGES_BUCKET)
    .upload(filePath, processed.buffer, uploadOptions(processed.contentType));
  if (storageError) throw new Error(storageError.message);
  const { data: publicUrlData } = supabase.storage.from(CATALOG_IMAGES_BUCKET).getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

module.exports = {
  CATALOG_IMAGES_BUCKET,
  uploadCatalogImageBuffer,
  uploadBrandLogoBuffer,
  catalogStoragePathFromPublicUrl,
  thumbStoragePathFromDetailPath,
  removeCatalogObjectByPublicUrl,
};
