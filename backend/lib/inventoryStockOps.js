/**
 * Descuento optimista de stock (misma idea que POST /inventory/:id/mount).
 * @returns {Promise<{ ok: true, previousQuantity: number, newQuantity: number } | { ok: false, error: string }>}
 */
async function deductInventoryQuantity(supabase, { userId, itemId, qty }) {
  if (!itemId || qty <= 0) return { ok: true, skipped: true, previousQuantity: null, newQuantity: null };
  const { data: item, error: fetchErr } = await supabase
    .from('inventory_items')
    .select('id, quantity')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!item) return { ok: false, error: 'Ítem de inventario no encontrado' };
  const prevQty = Number(item.quantity);
  if (prevQty < qty) {
    return { ok: false, error: `Stock insuficiente (disponible: ${prevQty}, necesario: ${qty})` };
  }
  const { data: updated, error: updErr } = await supabase
    .from('inventory_items')
    .update({
      quantity: prevQty - qty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .eq('quantity', prevQty)
    .select('*')
    .maybeSingle();
  if (updErr) return { ok: false, error: updErr.message };
  if (!updated) return { ok: false, error: 'No se pudo actualizar el stock (reintenta).' };
  return { ok: true, previousQuantity: prevQty, newQuantity: prevQty - qty };
}

/**
 * Revierte un descuento si falla la actualización del componente.
 */
async function restoreInventoryQuantity(supabase, { userId, itemId, qty, quantityMustBe }) {
  if (!itemId || qty <= 0) return { ok: true };
  const { data: updated, error: updErr } = await supabase
    .from('inventory_items')
    .update({
      quantity: quantityMustBe + qty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .eq('quantity', quantityMustBe)
    .select('id')
    .maybeSingle();
  if (updErr) return { ok: false, error: updErr.message };
  if (!updated) return { ok: false, error: 'No se pudo revertir el stock.' };
  return { ok: true };
}

module.exports = { deductInventoryQuantity, restoreInventoryQuantity };
