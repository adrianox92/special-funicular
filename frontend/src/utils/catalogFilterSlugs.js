/**
 * Diccionarios bidireccionales para slugs de tipo de vehículo y tracción.
 *
 * Tipos y tracciones se detectan en las URLs por presencia en estos sets.
 * Las marcas se resuelven contra la API de brands (slugs en slot_catalog_brands.slug).
 */

// Slugs canónicos de tipo de vehículo → etiqueta legible
export const VEHICLE_TYPE_SLUG_TO_LABEL = {
  'turismo':       'Turismo',
  'rally':         'Rally',
  'gt':            'GT',
  'formula':       'Fórmula',
  'camion':        'Camión',
  'moto':          'Moto',
  'clasico':       'Clásico',
  'deportivo':     'Deportivo',
  'suv':           'SUV',
  'monoplaza':     'Monoplaza',
  'truck':         'Truck',
  'buggy':         'Buggy',
  'stock-car':     'Stock Car',
  'prototipo':     'Prototipo',
  'otro':          'Otro',
};

// Slugs canónicos de tracción → etiqueta legible
export const TRACTION_SLUG_TO_LABEL = {
  '4wd':   '4WD',
  'rwd':   'RWD',
  'fwd':   'FWD',
};

/** Set rápido para detección (O(1)) */
export const VEHICLE_TYPE_SLUGS = new Set(Object.keys(VEHICLE_TYPE_SLUG_TO_LABEL));
export const TRACTION_SLUGS     = new Set(Object.keys(TRACTION_SLUG_TO_LABEL));

/**
 * Convierte un string de tipo de vehículo al slug canónico.
 * Ej: "Rally" → "rally", "GT" → "gt"
 */
export function vehicleTypeToSlug(label) {
  if (!label) return null;
  // Búsqueda directa inversa
  const lower = label.toLowerCase().trim()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (VEHICLE_TYPE_SLUGS.has(lower)) return lower;
  // Búsqueda por valor
  for (const [slug, lbl] of Object.entries(VEHICLE_TYPE_SLUG_TO_LABEL)) {
    if (lbl.toLowerCase() === label.toLowerCase()) return slug;
  }
  return lower || null;
}

/**
 * Convierte un string de tracción al slug canónico.
 * Ej: "4WD" → "4wd"
 */
export function tractionToSlug(label) {
  if (!label) return null;
  const lower = label.toLowerCase().trim();
  if (TRACTION_SLUGS.has(lower)) return lower;
  for (const [slug, lbl] of Object.entries(TRACTION_SLUG_TO_LABEL)) {
    if (lbl.toLowerCase() === label.toLowerCase()) return slug;
  }
  return lower || null;
}

/** Devuelve la etiqueta legible de un slug de tipo de vehículo, o el slug si no se conoce. */
export function vehicleTypeSlugToLabel(slug) {
  return VEHICLE_TYPE_SLUG_TO_LABEL[slug] ?? slug ?? '';
}

/** Devuelve la etiqueta legible de un slug de tracción, o el slug si no se conoce. */
export function tractionSlugToLabel(slug) {
  return TRACTION_SLUG_TO_LABEL[slug] ?? slug ?? '';
}
