/**
 * Descuento y restauración de stock de inventario (única fuente de verdad).
 *
 * - Descuenta siempre que la operación consume el cajón del usuario.
 * - FIFO por `part_id` cuando existe; si no, la línea concreta.
 * - Si no hay stock suficiente: error, sin descuento parcial persistente.
 */

function insufficientStockMessage(available, needed) {
  return `Stock insuficiente (disponible: ${available}, necesario: ${needed})`;
}

function parsePositiveQty(qty) {
  const n = parseInt(qty, 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

/**
 * Descuento optimista de una línea de inventario.
 * @returns {Promise<{ ok: true, previousQuantity: number, newQuantity: number, skipped?: boolean } | { ok: false, error: string, code?: string }>}
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
    return {
      ok: false,
      error: insufficientStockMessage(prevQty, qty),
      code: 'INSUFFICIENT_STOCK',
    };
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

/**
 * @returns {Promise<{ ok: true, lines: object[], stockQty: number } | { ok: false, error: string }>}
 */
async function getPartStock(supabase, userId, partId) {
  if (!partId) return { ok: true, lines: [], stockQty: 0 };
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId)
    .eq('part_id', partId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const lines = data || [];
  const stockQty = lines.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  return { ok: true, lines, stockQty };
}

/**
 * Restaura descuentos FIFO (en orden inverso).
 */
async function restoreStockDeductions(supabase, userId, deductions) {
  if (!deductions?.length) return { ok: true };
  for (let i = deductions.length - 1; i >= 0; i -= 1) {
    const prev = deductions[i];
    const restored = await restoreInventoryQuantity(supabase, {
      userId,
      itemId: prev.itemId,
      qty: prev.qty,
      quantityMustBe: prev.newQuantity,
    });
    if (!restored.ok) return restored;
  }
  return { ok: true };
}

/** Alias histórico */
const restorePartStockDeductions = restoreStockDeductions;

/**
 * Descuenta stock FIFO de las líneas de una pieza. Si no alcanza, no deja descuentos a medias.
 * @returns {Promise<{
 *   ok: true,
 *   deductions: { itemId: string, qty: number, newQuantity: number }[],
 *   deductedQty: number,
 *   remainingUnfilled: number,
 *   sourceInventoryItemId: string|null
 * } | { ok: false, error: string, code?: string }>}
 */
async function deductPartStockFifo(supabase, { userId, partId, qty }) {
  const want = parsePositiveQty(qty);
  if (!partId || want == null) {
    return {
      ok: true,
      deductions: [],
      deductedQty: 0,
      remainingUnfilled: want == null ? Math.max(0, parseInt(qty, 10) || 0) : 0,
      sourceInventoryItemId: null,
    };
  }

  const stock = await getPartStock(supabase, userId, partId);
  if (!stock.ok) return stock;

  const availableLines = (stock.lines || []).filter((l) => Number(l.quantity) > 0);
  const totalAvailable = availableLines.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  if (totalAvailable < want) {
    return {
      ok: false,
      error: insufficientStockMessage(totalAvailable, want),
      code: 'INSUFFICIENT_STOCK',
    };
  }

  let remaining = want;
  const deductions = [];

  for (const line of availableLines) {
    if (remaining <= 0) break;
    const take = Math.min(Number(line.quantity), remaining);
    const dres = await deductInventoryQuantity(supabase, {
      userId,
      itemId: line.id,
      qty: take,
    });
    if (!dres.ok) {
      await restoreStockDeductions(supabase, userId, deductions);
      return dres;
    }
    deductions.push({ itemId: line.id, qty: take, newQuantity: dres.newQuantity });
    remaining -= take;
  }

  if (remaining > 0) {
    await restoreStockDeductions(supabase, userId, deductions);
    return {
      ok: false,
      error: insufficientStockMessage(want - remaining, want),
      code: 'INSUFFICIENT_STOCK',
    };
  }

  return {
    ok: true,
    deductions,
    deductedQty: want,
    remainingUnfilled: 0,
    sourceInventoryItemId: deductions[0]?.itemId || null,
  };
}

function statusForConsumeError(result) {
  if (result?.code === 'INSUFFICIENT_STOCK') return 400;
  const msg = String(result?.error || '');
  if (msg.includes('Stock insuficiente') || msg.includes('Ítem de inventario no encontrado')) return 400;
  if (msg.includes('reintenta')) return 409;
  return 500;
}

/**
 * Punto único de consumo: FIFO por `part_id` si existe; si no, la línea `itemId`.
 * Falla con 4xx si no hay stock suficiente (no deja el componente a medias).
 *
 * @returns {Promise<{
 *   ok: true,
 *   deductions: { itemId: string, qty: number, newQuantity: number }[],
 *   deductedQty: number,
 *   sourceInventoryItemId: string|null
 * } | { ok: false, error: string, status: number, code?: string }>}
 */
async function consumeInventoryStock(supabase, { userId, partId, itemId, qty }) {
  const want = parsePositiveQty(qty);
  if (want == null) {
    return {
      ok: false,
      error: 'La cantidad a descontar debe ser un entero mayor o igual a 1',
      status: 400,
    };
  }

  if (partId) {
    const fifo = await deductPartStockFifo(supabase, { userId, partId, qty: want });
    if (!fifo.ok) {
      return {
        ok: false,
        error: fifo.error,
        status: statusForConsumeError(fifo),
        code: fifo.code,
      };
    }
    return {
      ok: true,
      deductions: fifo.deductions,
      deductedQty: fifo.deductedQty,
      sourceInventoryItemId: fifo.sourceInventoryItemId || itemId || null,
    };
  }

  if (itemId) {
    const dres = await deductInventoryQuantity(supabase, { userId, itemId, qty: want });
    if (!dres.ok) {
      return {
        ok: false,
        error: dres.error,
        status: statusForConsumeError(dres),
        code: dres.code,
      };
    }
    if (dres.skipped) {
      return { ok: false, error: 'Ítem de inventario no encontrado', status: 400 };
    }
    return {
      ok: true,
      deductions: [{ itemId, qty: want, newQuantity: dres.newQuantity }],
      deductedQty: want,
      sourceInventoryItemId: itemId,
    };
  }

  return {
    ok: false,
    error: 'No hay inventario del que descontar',
    status: 400,
  };
}

module.exports = {
  insufficientStockMessage,
  deductInventoryQuantity,
  restoreInventoryQuantity,
  getPartStock,
  deductPartStockFifo,
  restoreStockDeductions,
  restorePartStockDeductions,
  consumeInventoryStock,
};
