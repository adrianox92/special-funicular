/**
 * Orden de salida (start_order) de participantes en una competición.
 */

function sortParticipantsByStartOrder(participants) {
  return [...(participants || [])].sort((a, b) => {
    const ao = a.start_order;
    const bo = b.start_order;
    if (ao != null && bo != null) return ao - bo;
    if (ao != null) return -1;
    if (bo != null) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

async function getNextStartOrder(supabase, competitionId) {
  const { data, error } = await supabase
    .from('competition_participants')
    .select('start_order')
    .eq('competition_id', competitionId)
    .not('start_order', 'is', null)
    .order('start_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const max = data?.start_order;
  return Number.isFinite(max) && max >= 1 ? max + 1 : 1;
}

async function findStartOrderConflict(supabase, competitionId, startOrder, excludeParticipantId = null) {
  if (startOrder == null) return null;

  let query = supabase
    .from('competition_participants')
    .select('id, driver_name')
    .eq('competition_id', competitionId)
    .eq('start_order', startOrder);

  if (excludeParticipantId) {
    query = query.neq('id', excludeParticipantId);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Asigna start_order 1..n sin colisiones temporales (dos fases: null → secuencial). */
async function renumberStartOrders(supabase, competitionId, orderedParticipantIds) {
  if (!Array.isArray(orderedParticipantIds) || orderedParticipantIds.length === 0) {
    return;
  }

  const { error: clearError } = await supabase
    .from('competition_participants')
    .update({ start_order: null })
    .eq('competition_id', competitionId)
    .in('id', orderedParticipantIds);

  if (clearError) throw clearError;

  for (let i = 0; i < orderedParticipantIds.length; i += 1) {
    const { error } = await supabase
      .from('competition_participants')
      .update({ start_order: i + 1 })
      .eq('id', orderedParticipantIds[i])
      .eq('competition_id', competitionId);
    if (error) throw error;
  }
}

function startOrderConflictMessage(conflict, startOrder) {
  if (!conflict) return null;
  return `El orden ${startOrder} ya lo tiene ${conflict.driver_name}`;
}

module.exports = {
  sortParticipantsByStartOrder,
  getNextStartOrder,
  findStartOrderConflict,
  renumberStartOrders,
  startOrderConflictMessage,
};
