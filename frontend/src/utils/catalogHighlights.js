import api from '../lib/axios';
import { supabase } from '../lib/supabase';

const HIGHLIGHT_SELECT =
  'id, reference, manufacturer_id, manufacturer, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, image_url';

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache = { at: 0, items: null };
let inflight = null;

function yearPresent(year) {
  const n = Number(year);
  return Number.isFinite(n) && n >= 1900 && n <= 2100;
}

function textPresent(value) {
  return value != null && String(value).trim() !== '';
}

/** Misma regla que el catálogo admin: imagen, nombre, tipo, tracción, motor y año. */
export function isCatalogModelComplete(row) {
  if (!row) return false;
  return (
    textPresent(row.image_url) &&
    textPresent(row.model_name) &&
    textPresent(row.vehicle_type) &&
    textPresent(row.traction) &&
    textPresent(row.motor_position) &&
    yearPresent(row.commercial_release_year)
  );
}

function sortByBrand(items) {
  return [...items].sort((a, b) =>
    String(a.manufacturer || '').localeCompare(String(b.manufacturer || ''), 'es'),
  );
}

function applyCompleteFilters(query) {
  return query
    .not('image_url', 'is', null)
    .neq('image_url', '')
    .not('model_name', 'is', null)
    .neq('model_name', '')
    .not('vehicle_type', 'is', null)
    .neq('vehicle_type', '')
    .not('traction', 'is', null)
    .neq('traction', '')
    .not('motor_position', 'is', null)
    .neq('motor_position', '')
    .gte('commercial_release_year', 1900)
    .lte('commercial_release_year', 2100);
}

async function fetchViaSupabase() {
  const { data: brands, error } = await supabase
    .from('slot_catalog_brands')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw error;

  const picked = await Promise.all(
    (brands || []).map(async (brand) => {
      const query = applyCompleteFilters(
        supabase
          .from('slot_catalog_items_with_ratings')
          .select(HIGHLIGHT_SELECT)
          .eq('manufacturer_id', brand.id),
      );
      const { data, error: itemErr } = await query
        .order('rating_avg', { ascending: false, nullsFirst: false })
        .order('reference', { ascending: true })
        .limit(1);
      if (itemErr || !data?.[0]) return null;
      const row = data[0];
      return isCatalogModelComplete(row) ? row : null;
    }),
  );

  return sortByBrand(picked.filter(Boolean));
}

async function fetchHighlights() {
  try {
    const res = await api.get('/public/catalog/highlights');
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    return sortByBrand(items.filter(isCatalogModelComplete));
  } catch {
    return fetchViaSupabase();
  }
}

/** Un modelo completo por marca. Cache en memoria de la pestaña. */
export function loadLandingCatalogHighlights() {
  const now = Date.now();
  if (cache.items && now - cache.at < CACHE_TTL_MS) {
    return Promise.resolve(cache.items);
  }
  if (inflight) return inflight;
  inflight = fetchHighlights()
    .then((items) => {
      cache = { at: Date.now(), items };
      inflight = null;
      return items;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}
