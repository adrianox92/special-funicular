const { generateVehicleSpecsPDF } = require('../src/utils/pdfGenerator');

/**
 * Carga el vehículo, imágenes y specs; genera el buffer PDF.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} vehicleId
 * @param {{ userId?: string | null }} [options] — si `userId` está definido, solo el propietario puede obtener el PDF
 * @returns {Promise<{ pdfBuffer: Buffer, model: string }>}
 */
async function buildVehicleSpecsPdfBuffer(supabase, vehicleId, options = {}) {
  const { userId = null } = options;

  let vQuery = supabase.from('vehicles').select('*').eq('id', vehicleId);
  if (userId != null) {
    vQuery = vQuery.eq('user_id', userId);
  }
  const { data: vehicle, error: vehicleError } = await vQuery.single();
  if (vehicleError || !vehicle) {
    const err = new Error('Vehículo no encontrado');
    err.statusCode = 404;
    throw err;
  }

  let imageUrl = null;
  const { data: images, error: imagesError } = await supabase
    .from('vehicle_images')
    .select('image_url, view_type')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: true });
  if (!imagesError && images && images.length > 0) {
    const threeQuarters = images.find((img) => img.view_type === 'three_quarters');
    if (threeQuarters) {
      imageUrl = threeQuarters.image_url;
    } else {
      const lateral = images.find((img) => img.view_type === 'left' || img.view_type === 'right');
      imageUrl = lateral ? lateral.image_url : images[0].image_url;
    }
  }

  const { data: specs, error: specsError } = await supabase
    .from('technical_specs')
    .select('*, components (*)')
    .eq('vehicle_id', vehicleId)
    .order('is_modification', { ascending: true });
  if (specsError) {
    throw specsError;
  }

  const technicalSpecs = (specs || []).filter((spec) => !spec.is_modification);
  const modifications = (specs || []).filter((spec) => spec.is_modification);
  const pdfBuffer = await generateVehicleSpecsPDF(
    { ...vehicle, image: imageUrl },
    technicalSpecs,
    modifications,
  );
  return { pdfBuffer, model: vehicle.model || 'vehiculo' };
}

/**
 * Nombre de fichero seguro a partir del nombre del coche (sin prefijo ficha-tecnica-).
 * Elimina caracteres no válidos en nombres de fichero.
 */
function safeFilenamePart(model) {
  const raw = String(model || '').trim() || 'vehiculo';
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = (cleaned || 'vehiculo').toLowerCase();
  return base.slice(0, 180);
}

module.exports = { buildVehicleSpecsPdfBuffer, safeFilenamePart };
