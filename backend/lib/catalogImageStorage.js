const { processVehicleImageBuffer, DEFAULT_THUMB_EDGE } = require('./processVehicleImageBuffer');
const { uploadObject, removeObjects, providerForUrl } = require('./imageObjectStorage');

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
  const publicUrl = await uploadObject(
    supabase,
    CATALOG_IMAGES_BUCKET,
    filePath,
    processed.buffer,
    processed.contentType,
  );

  try {
    const thumb = await processVehicleImageBuffer(buffer, mimetype, { maxEdgePx: DEFAULT_THUMB_EDGE });
    const thumbPath = `${stem}-thumb${thumb.ext}`;
    await uploadObject(supabase, CATALOG_IMAGES_BUCKET, thumbPath, thumb.buffer, thumb.contentType);
  } catch (thumbErr) {
    console.warn('[catalogImageStorage] no se pudo generar o subir miniatura:', thumbErr.message);
  }

  return publicUrl;
}

/**
 * Ruta del objeto dentro del bucket lógico; vale para URLs de Supabase y de R2.
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
  return removeObjects(supabase, providerForUrl(publicUrl), CATALOG_IMAGES_BUCKET, paths);
}

/**
 * Logo de marca (mismo bucket, carpeta brands/).
 */
async function uploadBrandLogoBuffer(supabase, buffer, mimetype) {
  const processed = await processVehicleImageBuffer(buffer, mimetype);
  const filePath = `brands/${randomCatalogStem()}${processed.ext}`;
  return uploadObject(supabase, CATALOG_IMAGES_BUCKET, filePath, processed.buffer, processed.contentType);
}

module.exports = {
  CATALOG_IMAGES_BUCKET,
  uploadCatalogImageBuffer,
  uploadBrandLogoBuffer,
  catalogStoragePathFromPublicUrl,
  thumbStoragePathFromDetailPath,
  removeCatalogObjectByPublicUrl,
};
