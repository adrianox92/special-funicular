/**
 * Resuelve un circuito por nombre: lo busca o lo crea si no existe.
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID del usuario
 * @param {string} name - Nombre del circuito
 * @param {object} options - Opciones opcionales: description, num_lanes, lane_lengths
 * @returns {Promise<{ circuit: object, created: boolean }>}
 */
async function findOrCreateCircuit(supabase, userId, name, options = {}) {
  const { description, num_lanes, lane_lengths } = options;

  if (!name || !name.trim()) {
    throw new Error('El nombre es requerido');
  }

  const trimmedName = name.trim();

  const { data: existing, error: fetchError } = await supabase
    .from('circuits')
    .select('*')
    .eq('user_id', userId)
    .eq('name', trimmedName)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return { circuit: existing, created: false };

  const lanes = num_lanes != null ? parseInt(num_lanes, 10) : 1;
  const validLanes = isNaN(lanes) || lanes < 1 ? 1 : lanes;
  let lengths = Array.isArray(lane_lengths) ? lane_lengths : [];
  if (lengths.length !== validLanes) {
    lengths = Array(validLanes)
      .fill(null)
      .map((_, i) => (lengths[i] != null ? Number(lengths[i]) : 0));
  }
  lengths = lengths
    .slice(0, validLanes)
    .map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0));

  const circuitData = {
    user_id: userId,
    name: trimmedName,
    description: description ? description.trim() : null,
    num_lanes: validLanes,
    lane_lengths: lengths,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('circuits')
    .insert([circuitData])
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raceExisting } = await supabase
        .from('circuits')
        .select('*')
        .eq('user_id', userId)
        .eq('name', trimmedName)
        .single();
      if (raceExisting) return { circuit: raceExisting, created: false };
    }
    throw insertError;
  }

  return { circuit: inserted, created: true };
}

module.exports = { findOrCreateCircuit };
