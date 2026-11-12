/**
 * catalog_item_id llega por multipart. Multer (append-field) convierte claves
 * duplicadas en un array; String([uuid, uuid]) === "uuid,uuid", que no es un UUID
 * y hace fallar el EXISTS contra el catálogo.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrapScalar(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const inner = unwrapScalar(item);
      if (inner) return inner;
    }
    return null;
  }
  if (typeof value === 'object') {
    if (value.id != null) return unwrapScalar(value.id);
    return null;
  }
  const t = String(value).trim();
  if (!t || t === 'null' || t === 'undefined') return null;
  return t;
}

function firstUuidToken(text) {
  if (text.includes(',')) {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    const uuid = parts.find((p) => UUID_RE.test(p));
    return uuid || parts[0] || text;
  }
  return text;
}

/**
 * @param {unknown} raw
 * @returns {{ value: string|null, error?: string }}
 */
function parseCatalogItemId(raw) {
  const first = unwrapScalar(raw);
  if (!first) return { value: null };
  const candidate = firstUuidToken(first);
  if (!UUID_RE.test(candidate)) {
    return { error: 'catalog_item_id no es un UUID válido' };
  }
  return { value: candidate };
}

/**
 * Comprueba el ítem en la tabla FK (no la vista con JOIN a brands).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} catalogItemId
 */
async function loadCatalogItemForVehicleLink(supabase, catalogItemId) {
  const { data, error } = await supabase
    .from('slot_catalog_items')
    .select('*')
    .eq('id', catalogItemId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { missing: true };
  return { row: data };
}

module.exports = {
  parseCatalogItemId,
  loadCatalogItemForVehicleLink,
};
