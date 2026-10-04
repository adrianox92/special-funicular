/**
 * Etiquetas de valores almacenados en catálogo (tipo, tracción, posición motor).
 * Las claves coinciden con el valor en BD (p. ej. «Clásico», «Trasera», «inline»).
 */
export function translateCatalogValue(t, group, value, fallback = '—') {
  if (value == null || String(value).trim() === '') return fallback;
  const raw = String(value);
  const translated = t(`values.${group}.${raw}`, { defaultValue: '' });
  return translated || raw;
}
