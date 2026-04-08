const { removeObjectByPublicUrl } = require('./vehicleImageStorage');
const { processVehicleImageBuffer } = require('./processVehicleImageBuffer');

const VEHICLE_IMAGES_BUCKET = 'vehicle-images';

const VALID_VIEW_TYPES = [
  'front',
  'left',
  'right',
  'rear',
  'top',
  'chassis',
  'three_quarters',
];

/**
 * Procesa y sube archivos multipart asociados a vistas del vehículo (field name = view_type).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} vehicleId
 * @param {Express.Multer.File[]} files
 * @param {{ replacePerView: boolean }} options - si true (PUT), elimina Storage/BD de esa vista antes de insertar
 */
async function saveVehicleImagesFromMultipart(supabase, vehicleId, files, options) {
  const { replacePerView } = options;
  if (!files || files.length === 0) return;

  for (const file of files) {
    const view_type = file.originalname;
    if (!VALID_VIEW_TYPES.includes(view_type)) continue;

    if (replacePerView) {
      const { data: existingRows, error: selErr } = await supabase
        .from('vehicle_images')
        .select('image_url')
        .eq('vehicle_id', vehicleId)
        .eq('view_type', view_type)
        .limit(1);

      if (selErr) throw new Error(selErr.message);

      const existing = existingRows?.[0];
      if (existing?.image_url) {
        const { error: remErr } = await removeObjectByPublicUrl(supabase, existing.image_url);
        if (remErr) {
          console.warn('[vehicleImageUpload] No se pudo borrar objeto anterior en Storage:', remErr.message);
        }
      }

      const { error: delErr } = await supabase
        .from('vehicle_images')
        .delete()
        .eq('vehicle_id', vehicleId)
        .eq('view_type', view_type);
      if (delErr) throw new Error(delErr.message);
    }

    let processed;
    try {
      processed = await processVehicleImageBuffer(file.buffer, file.mimetype);
    } catch (e) {
      const err = new Error(e.message || 'No se pudo procesar la imagen');
      err.code = e.code || 'INVALID_IMAGE';
      throw err;
    }

    const filePath = `vehicles/${vehicleId}/${Date.now()}-${view_type}${processed.ext}`;
    const { error: storageError } = await supabase.storage.from(VEHICLE_IMAGES_BUCKET).upload(filePath, processed.buffer, {
      contentType: processed.contentType,
      upsert: !!replacePerView,
    });
    if (storageError) throw new Error(storageError.message);

    const { data: publicUrlData } = supabase.storage.from(VEHICLE_IMAGES_BUCKET).getPublicUrl(filePath);
    const imageUrl = publicUrlData.publicUrl;

    const { error: imgError } = await supabase
      .from('vehicle_images')
      .insert([{ vehicle_id: vehicleId, image_url: imageUrl, view_type }]);
    if (imgError) throw new Error(imgError.message);
  }
}

module.exports = {
  VALID_VIEW_TYPES,
  saveVehicleImagesFromMultipart,
};
