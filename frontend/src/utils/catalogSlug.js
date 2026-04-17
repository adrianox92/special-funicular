/**
 * UUID de ítem en rutas `/catalogo/:id` (alineado con validación del API público).
 */
const CATALOG_ITEM_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCatalogItemUuid(s) {
  return typeof s === 'string' && CATALOG_ITEM_UUID_RE.test(s);
}

/**
 * Fragmento de URL legible para fichas del catálogo (solo SEO; el dato canónico es id).
 */
export function catalogSlugify(text) {
  const s = String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return s || 'item';
}
