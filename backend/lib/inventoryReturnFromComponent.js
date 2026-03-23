/**
 * Reingreso al inventario desde un componente retirado (modificación).
 * Si ya existe una línea compatible, suma cantidad y anota el reingreso; si no, inserta.
 */

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
  'front_axle',
  'rear_axle',
  'aceite',
  'limpiador',
  'electronica',
  'herramienta',
  'neumaticos',
  'cables',
  'suspension',
  'otro',
]);

function normalizeOptionalText(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t === '' ? null : t;
}

function normalizeUrl(val) {
  const raw = normalizeOptionalText(val);
  if (raw == null) return null;
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).href;
    return new URL(`https://${raw}`).href;
  } catch {
    return '__invalid__';
  }
}

function componentTypeToInventoryCategory(ct) {
  const c = ct == null ? '' : String(ct).trim();
  if (!c) return 'otro';
  if (c === 'other') return 'otro';
  if (ALLOWED_CATEGORIES.has(c)) return c;
  return 'otro';
}

function refKey(val) {
  if (val == null) return '';
  return String(val).trim();
}

function normMfg(val) {
  const n = normalizeOptionalText(val);
  return n == null ? null : n;
}

function numEq(dbVal, rowVal) {
  const a = dbVal == null || dbVal === '' ? null : Number(dbVal);
  const b = rowVal == null || rowVal === '' ? null : Number(rowVal);
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a === b;
}

/**
 * Busca una fila de inventario del mismo usuario a la que convenga sumar stock
 * para no duplicar líneas equivalentes.
 */
async function findMergeableInventoryItem(supabase, userId, row) {
  const refNorm = refKey(row.reference);
  const name = String(row.name || '').trim();
  if (!name) return null;

  let query = supabase
    .from('inventory_items')
    .select('id, quantity, notes, reference, teeth, rpm, gaus, manufacturer, name, updated_at')
    .eq('user_id', userId)
    .eq('category', row.category)
    .eq('name', name)
    .order('updated_at', { ascending: false })
    .limit(40);

  if (refNorm !== '') {
    query = query.eq('reference', refNorm);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  const pinionCrown = row.category === 'pinion' || row.category === 'crown';
  const motor = row.category === 'motor';
  const mfgRow = normMfg(row.manufacturer);

  for (const inv of data) {
    if (refNorm === '' && refKey(inv.reference) !== '') continue;
    if (normMfg(inv.manufacturer) !== mfgRow) continue;
    if (pinionCrown && !numEq(inv.teeth, row.teeth)) continue;
    if (motor && !numEq(inv.rpm, row.rpm)) continue;
    return { id: inv.id, quantity: inv.quantity, notes: inv.notes };
  }
  return null;
}

function buildReturnRow(userId, snapshot, vehicleLabel) {
  const category = componentTypeToInventoryCategory(snapshot.component_type);
  const element = normalizeOptionalText(snapshot.element);
  const sku = normalizeOptionalText(snapshot.sku);
  const name = (element || sku || 'Pieza retirada del vehículo').trim();

  let qty = parseInt(snapshot.mounted_qty, 10);
  if (Number.isNaN(qty) || qty < 1) qty = 1;

  const urlNorm = normalizeUrl(snapshot.url);
  const url = urlNorm === '__invalid__' ? null : urlNorm;

  const priceRaw = snapshot.price;
  let purchasePrice = null;
  if (priceRaw != null && String(priceRaw).trim() !== '') {
    const p = Number(priceRaw);
    if (!Number.isNaN(p) && p >= 0) purchasePrice = p;
  }

  const teeth =
    snapshot.teeth != null && String(snapshot.teeth).trim() !== '' && !Number.isNaN(Number(snapshot.teeth))
      ? Number(snapshot.teeth)
      : null;
  const rpm =
    snapshot.rpm != null && String(snapshot.rpm).trim() !== '' && !Number.isNaN(Number(snapshot.rpm))
      ? Number(snapshot.rpm)
      : null;
  const gaus =
    snapshot.gaus != null && String(snapshot.gaus).trim() !== '' && !Number.isNaN(Number(snapshot.gaus))
      ? Number(snapshot.gaus)
      : null;

  const notesParts = [];
  if (vehicleLabel) notesParts.push(`Retirado de: ${vehicleLabel}`);
  else notesParts.push('Retirado de vehículo (modificación)');

  const row = {
    user_id: userId,
    name,
    reference: sku,
    url,
    category,
    quantity: qty,
    unit: 'uds',
    min_stock: null,
    purchase_price: purchasePrice,
    purchase_date: null,
    notes: notesParts.join(' · '),
    vehicle_id: null,
    manufacturer: normalizeOptionalText(snapshot.manufacturer),
    material: normalizeOptionalText(snapshot.material),
    size: normalizeOptionalText(snapshot.size),
    color: normalizeOptionalText(snapshot.color),
    teeth,
    rpm,
    gaus,
    description: normalizeOptionalText(snapshot.description),
    updated_at: new Date().toISOString(),
  };

  return { row, qty, firstNoteLine: row.notes };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} opts
 * @param {string} opts.userId
 * @param {object} opts.snapshot - modificationSnapshotFromRow(prev)
 * @param {string|null} [opts.vehicleLabel] - texto para notas
 * @returns {Promise<{ ok: true, data: object, merged?: boolean } | { ok: false, error: string }>}
 */
async function insertReturnedComponentToInventory(supabase, { userId, snapshot, vehicleLabel }) {
  const { row, qty, firstNoteLine } = buildReturnRow(userId, snapshot, vehicleLabel);
  const reingressLine = `${new Date().toISOString().slice(0, 10)}: Reingreso de ${qty} uds — ${firstNoteLine}`;

  const existing = await findMergeableInventoryItem(supabase, userId, row);
  if (existing) {
    const prevQty = Number(existing.quantity);
    const newQty = prevQty + qty;
    const combinedNotes = existing.notes
      ? `${String(existing.notes).trim()}\n— ${reingressLine}`
      : reingressLine;

    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        quantity: newQty,
        notes: combinedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data, merged: true };
  }

  const { data, error } = await supabase.from('inventory_items').insert([row]).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data, merged: false };
}

module.exports = {
  insertReturnedComponentToInventory,
  componentTypeToInventoryCategory,
};
