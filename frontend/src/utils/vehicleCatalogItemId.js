/**
 * El alta de vehículo no debe enviar catalog_item_id dos veces en FormData:
 * Multer convierte claves duplicadas en un array y el backend acaba buscando
 * "uuid,uuid" en el catálogo.
 */
function scalarCatalogItemId(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const inner = scalarCatalogItemId(item);
      if (inner) return inner;
    }
    return null;
  }
  const raw = typeof value === 'object' && value.id != null ? value.id : value;
  const text = String(raw).trim();
  if (!text || text === 'null' || text === 'undefined') return null;
  return text.includes(',') ? text.split(',')[0].trim() : text;
}

export function firstCatalogItemId(...candidates) {
  for (const raw of candidates) {
    const id = scalarCatalogItemId(raw);
    if (id) return id;
  }
  return null;
}

export function appendCatalogItemIdOnce(formData, ...candidates) {
  const id = firstCatalogItemId(...candidates);
  if (id) formData.append('catalog_item_id', id);
  return id;
}
