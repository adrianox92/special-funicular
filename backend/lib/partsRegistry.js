/**
 * Identidad canónica de recambios (`public.parts`).
 * Debe coincidir con public.part_identity_key en la migración.
 *
 * El descuento/restauración de stock vive en `inventoryStockOps.js`.
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

module.exports = {
  ALLOWED_CATEGORIES,
  buildPartIdentity,
  resolvePartId,
  componentTypeToInventoryCategory,
  inventoryCategoryToComponentType,
  normalizeOptionalText,
};
