/**
 * Identidad canónica de recambios (`public.parts`).
 * Debe coincidir con public.part_identity_key en la migración.
 */

const { deductInventoryQuantity, restoreInventoryQuantity } = require('./inventoryStockOps');

const ALLOWED_CATEGORIES = new Set([
  'pinion',
  'crown',
  'motor',
  'guide',
  'chassis',
  'front_wheel',
  'rear_wheel',
  'front_rim',
  'rear_rim',
  'axle',
  'aceite',
  'limpiador',
  'electronica',
  'herramienta',
  'neumaticos',
  'cables',
  'suspension',
  'trencillas',
  'tornillos',
  'stoppers',
  'topes_y_centradores',
  'cojinetes',
  'otro',
]);

function normalizeOptionalText(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t === '' ? null : t;
}

function collapseWsLower(val) {
  return String(val == null ? '' : val)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function rpmIdentity(val) {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (Number.isNaN(n)) return '';
  if (n === Math.trunc(n)) return String(Math.trunc(n));
  return String(n).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function teethIdentity(val) {
  if (val == null || val === '') return '';
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return '';
  return String(n);
}

/** Inventario usa `otro`; componentes del vehículo usan `other`. Categorías desconocidas → `otro`. */
function componentTypeToInventoryCategory(ct) {
  const c = ct == null ? '' : String(ct).trim();
  if (!c) return 'otro';
  if (c === 'other') return 'otro';
  if (ALLOWED_CATEGORIES.has(c)) return c;
  return 'otro';
}

function inventoryCategoryToComponentType(category) {
  const c = String(category == null ? '' : category);
  return c === 'otro' ? 'other' : c;
}

function parseOptionalInt(val) {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function parseOptionalNumber(val) {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

/**
 * @param {object} attrs
 * @returns {{ fields: object, identityKey: string }}
 */
function buildPartIdentity(attrs = {}) {
  const category = componentTypeToInventoryCategory(attrs.category || attrs.component_type);
  const rawName = normalizeOptionalText(attrs.name) || normalizeOptionalText(attrs.element) || 'Pieza sin nombre';
  const manufacturer = normalizeOptionalText(attrs.manufacturer);
  const reference = normalizeOptionalText(attrs.reference != null ? attrs.reference : attrs.sku);
  const teeth = parseOptionalInt(attrs.teeth);
  const rpm = parseOptionalNumber(attrs.rpm);

  const identityKey = [
    collapseWsLower(category),
    collapseWsLower(rawName),
    collapseWsLower(manufacturer),
    collapseWsLower(reference),
    teethIdentity(teeth),
    rpmIdentity(rpm),
  ].join('|');

  const fields = {
    category: category || 'otro',
    name: rawName,
    manufacturer,
    reference,
    teeth,
    rpm,
    material: normalizeOptionalText(attrs.material),
    size: normalizeOptionalText(attrs.size),
    color: normalizeOptionalText(attrs.color),
    gaus: parseOptionalNumber(attrs.gaus),
    url: normalizeOptionalText(attrs.url),
    description: normalizeOptionalText(attrs.description),
  };

  return { fields, identityKey };
}

const DESCRIPTIVE_KEYS = ['material', 'size', 'color', 'url', 'description', 'gaus'];

/**
 * Busca o crea la pieza canónica. Completa huecos descriptivos si ya existía.
 * @returns {Promise<{ ok: true, part: object, created?: boolean } | { ok: false, error: string }>}
 */
async function resolvePartId(supabase, userId, attrs) {
  const { fields, identityKey } = buildPartIdentity(attrs);
  if (!fields.name) return { ok: false, error: 'name es requerido para resolver la pieza' };

  const { data: existing, error: findErr } = await supabase
    .from('parts')
    .select('*')
    .eq('user_id', userId)
    .eq('identity_key', identityKey)
    .maybeSingle();

  if (findErr) return { ok: false, error: findErr.message };

  let part = existing;
  let created = false;

  if (!part) {
    const insertRow = {
      user_id: userId,
      ...fields,
      updated_at: new Date().toISOString(),
    };
    const { data: inserted, error: insErr } = await supabase
      .from('parts')
      .insert([insertRow])
      .select('*')
      .single();

    if (insErr) {
      const { data: raced, error: raceErr } = await supabase
        .from('parts')
        .select('*')
        .eq('user_id', userId)
        .eq('identity_key', identityKey)
        .maybeSingle();
      if (raceErr) return { ok: false, error: insErr.message };
      if (!raced) return { ok: false, error: insErr.message };
      part = raced;
    } else {
      part = inserted;
      created = true;
    }
  }

  if (part && !created) {
    const patch = {};
    for (const k of DESCRIPTIVE_KEYS) {
      const cur = part[k];
      const next = fields[k];
      const empty = cur == null || cur === '';
      if (empty && next != null && next !== '') patch[k] = next;
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      const { data: updated, error: updErr } = await supabase
        .from('parts')
        .update(patch)
        .eq('id', part.id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (!updErr && updated) part = updated;
    }
  }

  return { ok: true, part, created };
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
 * Descuenta stock FIFO de las líneas de una pieza.
 * @returns {Promise<{
 *   ok: true,
 *   deductions: { itemId: string, qty: number, newQuantity: number }[],
 *   deductedQty: number,
 *   remainingUnfilled: number,
 *   sourceInventoryItemId: string|null
 * } | { ok: false, error: string }>}
 */
async function deductPartStockFifo(supabase, { userId, partId, qty }) {
  const want = parseInt(qty, 10);
  if (!partId || Number.isNaN(want) || want <= 0) {
    return {
      ok: true,
      deductions: [],
      deductedQty: 0,
      remainingUnfilled: Number.isNaN(want) ? 0 : Math.max(0, want),
      sourceInventoryItemId: null,
    };
  }

  const stock = await getPartStock(supabase, userId, partId);
  if (!stock.ok) return stock;

  const available = (stock.lines || []).filter((l) => Number(l.quantity) > 0);
  let remaining = want;
  const deductions = [];

  for (const line of available) {
    if (remaining <= 0) break;
    const take = Math.min(Number(line.quantity), remaining);
    const dres = await deductInventoryQuantity(supabase, {
      userId,
      itemId: line.id,
      qty: take,
    });
    if (!dres.ok) {
      for (let i = deductions.length - 1; i >= 0; i -= 1) {
        const prev = deductions[i];
        await restoreInventoryQuantity(supabase, {
          userId,
          itemId: prev.itemId,
          qty: prev.qty,
          quantityMustBe: prev.newQuantity,
        });
      }
      return { ok: false, error: dres.error };
    }
    deductions.push({ itemId: line.id, qty: take, newQuantity: dres.newQuantity });
    remaining -= take;
  }

  return {
    ok: true,
    deductions,
    deductedQty: want - remaining,
    remainingUnfilled: remaining,
    sourceInventoryItemId: deductions[0]?.itemId || null,
  };
}

async function restorePartStockDeductions(supabase, userId, deductions) {
  if (!deductions?.length) return;
  for (let i = deductions.length - 1; i >= 0; i -= 1) {
    const prev = deductions[i];
    await restoreInventoryQuantity(supabase, {
      userId,
      itemId: prev.itemId,
      qty: prev.qty,
      quantityMustBe: prev.newQuantity,
    });
  }
}

module.exports = {
  ALLOWED_CATEGORIES,
  buildPartIdentity,
  resolvePartId,
  getPartStock,
  deductPartStockFifo,
  restorePartStockDeductions,
  componentTypeToInventoryCategory,
  inventoryCategoryToComponentType,
  normalizeOptionalText,
};
