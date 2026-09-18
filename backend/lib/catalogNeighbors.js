/**
 * Vecinos del catálogo público.
 *
 * Orden estable (igual que el listado por defecto GET /api/public/catalog/items?sort=manufacturer):
 *   manufacturer ASC (NULLs al final), reference ASC, id ASC.
 *
 * Ese orden es el de «Anterior» / «Siguiente» en la ficha pública.
 */

const VIEW = 'slot_catalog_items_with_ratings';
const NEIGHBOR_SELECT = 'id, model_name, reference, manufacturer';

/**
 * Comparación alineada con ORDER BY manufacturer ASC NULLS LAST, reference ASC, id ASC.
 * @param {{ manufacturer?: string|null, reference?: string|null, id: string }} a
 * @param {{ manufacturer?: string|null, reference?: string|null, id: string }} b
 * @returns {number}
 */
function compareCatalogOrder(a, b) {
  const am = a.manufacturer == null || String(a.manufacturer) === '' ? null : String(a.manufacturer);
  const bm = b.manufacturer == null || String(b.manufacturer) === '' ? null : String(b.manufacturer);
  if (am !== bm) {
    if (am == null) return 1;
    if (bm == null) return -1;
    if (am < bm) return -1;
    if (am > bm) return 1;
  }
  const ar = a.reference == null ? '' : String(a.reference);
  const br = b.reference == null ? '' : String(b.reference);
  if (ar !== br) return ar < br ? -1 : 1;
  const aid = String(a.id);
  const bid = String(b.id);
  if (aid < bid) return -1;
  if (aid > bid) return 1;
  return 0;
}

function pickNeighbor(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    model_name: row.model_name ?? '',
    reference: row.reference ?? '',
    manufacturer: row.manufacturer ?? '',
  };
}

function firstRow(data) {
  return Array.isArray(data) && data[0] ? pickNeighbor(data[0]) : null;
}

function hasManufacturer(item) {
  return item.manufacturer != null && String(item.manufacturer).trim() !== '';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, manufacturer?: string|null, reference?: string|null }} item
 * @returns {Promise<{ id: string, model_name: string, reference: string, manufacturer: string }|null>}
 */
async function findNext(supabase, item) {
  const ref = item.reference == null ? '' : String(item.reference);
  const id = item.id;

  if (hasManufacturer(item)) {
    const mfg = String(item.manufacturer);
    {
      const { data, error } = await supabase
        .from(VIEW)
        .select(NEIGHBOR_SELECT)
        .eq('manufacturer', mfg)
        .gt('reference', ref)
        .order('reference', { ascending: true })
        .order('id', { ascending: true })
        .limit(1);
      if (error) throw error;
      const hit = firstRow(data);
      if (hit) return hit;
    }
    {
      const { data, error } = await supabase
        .from(VIEW)
        .select(NEIGHBOR_SELECT)
        .eq('manufacturer', mfg)
        .eq('reference', ref)
        .gt('id', id)
        .order('id', { ascending: true })
        .limit(1);
      if (error) throw error;
      const hit = firstRow(data);
      if (hit) return hit;
    }
    {
      const { data, error } = await supabase
        .from(VIEW)
        .select(NEIGHBOR_SELECT)
        .gt('manufacturer', mfg)
        .order('manufacturer', { ascending: true, nullsFirst: false })
        .order('reference', { ascending: true })
        .order('id', { ascending: true })
        .limit(1);
      if (error) throw error;
      const hit = firstRow(data);
      if (hit) return hit;
    }
    const { data, error } = await supabase
      .from(VIEW)
      .select(NEIGHBOR_SELECT)
      .is('manufacturer', null)
      .order('reference', { ascending: true })
      .order('id', { ascending: true })
      .limit(1);
    if (error) throw error;
    return firstRow(data);
  }

  {
    const { data, error } = await supabase
      .from(VIEW)
      .select(NEIGHBOR_SELECT)
      .is('manufacturer', null)
      .gt('reference', ref)
      .order('reference', { ascending: true })
      .order('id', { ascending: true })
      .limit(1);
    if (error) throw error;
    const hit = firstRow(data);
    if (hit) return hit;
  }
  {
    const { data, error } = await supabase
      .from(VIEW)
      .select(NEIGHBOR_SELECT)
      .is('manufacturer', null)
      .eq('reference', ref)
      .gt('id', id)
      .order('id', { ascending: true })
      .limit(1);
    if (error) throw error;
    return firstRow(data);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, manufacturer?: string|null, reference?: string|null }} item
 */
async function findPrev(supabase, item) {
  const ref = item.reference == null ? '' : String(item.reference);
  const id = item.id;

  if (hasManufacturer(item)) {
    const mfg = String(item.manufacturer);
    {
      const { data, error } = await supabase
        .from(VIEW)
        .select(NEIGHBOR_SELECT)
        .eq('manufacturer', mfg)
        .eq('reference', ref)
        .lt('id', id)
        .order('id', { ascending: false })
        .limit(1);
      if (error) throw error;
      const hit = firstRow(data);
      if (hit) return hit;
    }
    {
      const { data, error } = await supabase
        .from(VIEW)
        .select(NEIGHBOR_SELECT)
        .eq('manufacturer', mfg)
        .lt('reference', ref)
        .order('reference', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);
      if (error) throw error;
      const hit = firstRow(data);
      if (hit) return hit;
    }
    {
      const { data, error } = await supabase
        .from(VIEW)
        .select(NEIGHBOR_SELECT)
        .lt('manufacturer', mfg)
        .order('manufacturer', { ascending: false, nullsFirst: false })
        .order('reference', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);
      if (error) throw error;
      return firstRow(data);
    }
  }

  {
    const { data, error } = await supabase
      .from(VIEW)
      .select(NEIGHBOR_SELECT)
      .is('manufacturer', null)
      .eq('reference', ref)
      .lt('id', id)
      .order('id', { ascending: false })
      .limit(1);
    if (error) throw error;
    const hit = firstRow(data);
    if (hit) return hit;
  }
  {
    const { data, error } = await supabase
      .from(VIEW)
      .select(NEIGHBOR_SELECT)
      .is('manufacturer', null)
      .lt('reference', ref)
      .order('reference', { ascending: false })
      .order('id', { ascending: false })
      .limit(1);
    if (error) throw error;
    const hit = firstRow(data);
    if (hit) return hit;
  }
  const { data, error } = await supabase
    .from(VIEW)
    .select(NEIGHBOR_SELECT)
    .not('manufacturer', 'is', null)
    .order('manufacturer', { ascending: false, nullsFirst: false })
    .order('reference', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw error;
  return firstRow(data);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, manufacturer?: string|null, reference?: string|null }} item
 * @returns {Promise<{ prev: object|null, next: object|null }>}
 */
async function fetchCatalogNeighbors(supabase, item) {
  const [prev, next] = await Promise.all([findPrev(supabase, item), findNext(supabase, item)]);
  return { prev, next };
}

/**
 * Vecinos a partir de una lista ya cargada (tests / orden documentado).
 * @param {Array<{ id: string, manufacturer?: string|null, reference?: string|null, model_name?: string }>} items
 * @param {string} id
 */
function neighborsFromList(items, id) {
  const sorted = [...items].sort(compareCatalogOrder);
  const i = sorted.findIndex((row) => String(row.id) === String(id));
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? pickNeighbor(sorted[i - 1]) : null,
    next: i < sorted.length - 1 ? pickNeighbor(sorted[i + 1]) : null,
  };
}

module.exports = {
  compareCatalogOrder,
  fetchCatalogNeighbors,
  neighborsFromList,
};
