const { processVehicleImageBuffer } = require('./processVehicleImageBuffer');
const { saveVehicleViewProcessed } = require('./vehicleImageUpload');

/**
 * Si el ítem de catálogo tiene imagen y el usuario no subió vista "front", copia al vehículo.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} vehicleId
 * @param {{ image_url?: string | null } | null} catalogItem
 * @param {import('multer').File[]|undefined} reqFiles
 */
async function tryCopyCatalogImageToVehicleFront(supabase, vehicleId, catalogItem, reqFiles) {
  if (!catalogItem?.image_url) return;
  const hasFront = reqFiles && reqFiles.some((f) => f.originalname === 'front');
  if (hasFront) return;
  const res = await fetch(catalogItem.image_url);
  if (!res.ok) return;
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const processed = await processVehicleImageBuffer(buf, ct);
  await saveVehicleViewProcessed(supabase, vehicleId, 'front', processed);
}

module.exports = { tryCopyCatalogImageToVehicleFront };
