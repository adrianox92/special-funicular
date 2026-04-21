const { getAnonClient } = require('./supabaseClients');
const { modificationLineTotal } = require('./componentPricing');

const supabase = getAnonClient();

/**
 * Recalcula total_price y modified del vehículo a partir de modificaciones.
 * @param {string} vehicleId
 */
async function updateVehicleTotalPrice(vehicleId) {
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('price')
    .eq('id', vehicleId)
    .single();
  if (vehicleError) return;

  const basePrice = vehicle && vehicle.price ? Number(vehicle.price) : 0;

  const { data: modSpecs, error: modSpecsError } = await supabase
    .from('technical_specs')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('is_modification', true);
  if (modSpecsError) return;

  const modSpecIds = modSpecs.map((s) => s.id);
  let modsTotal = 0;
  let comps = [];

  if (modSpecIds.length > 0) {
    const { data: compsData, error: compsError } = await supabase
      .from('components')
      .select('price, mounted_qty')
      .in('tech_spec_id', modSpecIds);
    if (compsError) return;
    comps = compsData || [];
    modsTotal = comps.reduce((sum, c) => sum + modificationLineTotal(c.price, c.mounted_qty), 0);
  }

  const hasModificationComponents = modSpecIds.length > 0 && comps.length > 0;

  await supabase
    .from('vehicles')
    .update({ total_price: basePrice + modsTotal, modified: hasModificationComponents })
    .eq('id', vehicleId);
}

/**
 * Obtiene o crea las filas technical_specs (modificación y técnica) de un vehículo.
 * @param {string} vehicleId
 * @returns {Promise<{ modification: object, technical: object }>}
 */
async function getOrCreateBaseSpecs(vehicleId) {
  const { data: existingSpecs, error: fetchError } = await supabase
    .from('technical_specs')
    .select('*')
    .eq('vehicle_id', vehicleId);

  if (fetchError) throw fetchError;

  let specs = {
    modification: existingSpecs?.find((s) => s.is_modification),
    technical: existingSpecs?.find((s) => !s.is_modification),
  };

  if (!specs.modification) {
    const { data: newModSpec, error: modError } = await supabase
      .from('technical_specs')
      .insert([
        {
          vehicle_id: vehicleId,
          is_modification: true,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (modError) throw modError;
    specs.modification = newModSpec;
  }

  if (!specs.technical) {
    const { data: newTechSpec, error: techError } = await supabase
      .from('technical_specs')
      .insert([
        {
          vehicle_id: vehicleId,
          is_modification: false,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();
    if (techError) throw techError;
    specs.technical = newTechSpec;
  }

  return specs;
}

module.exports = {
  updateVehicleTotalPrice,
  getOrCreateBaseSpecs,
};
