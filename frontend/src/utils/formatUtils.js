/**
 * Convierte valores null/undefined o la cadena "null" a cadena vacía para mostrar en inputs.
 * Evita que se muestre el texto "null" cuando los campos están vacíos.
 * @param {*} value - Valor a normalizar
 * @returns {string} Cadena vacía si el valor es null/undefined/"null", o el valor convertido a string
 */
export function toDisplayValue(value) {
  if (value == null || value === 'null' || value === 'undefined') return '';
  return String(value);
}

/**
 * Formatea la distancia en metros para mostrar en la UI.
 * - Menor a 1 km: muestra en metros (ej: "250.5 m")
 * - Mayor o igual a 1 km: muestra en kilómetros (ej: "1.25 km")
 * @param {number|null|undefined} meters - Distancia en metros
 * @returns {string} Texto formateado o '-' si no hay valor
 */
export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '-';
  const m = Number(meters);
  if (m < 1000) {
    return `${m.toFixed(1)} m`;
  }
  return `${(m / 1000).toFixed(2)} km`;
}
