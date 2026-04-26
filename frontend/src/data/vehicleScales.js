/**
 * @param {number} n
 * @returns {string} Etiqueta "1:32" para mostrar en UI
 */
export function formatScaleLabel(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return '';
  return `1:${x}`;
}

/**
 * Denominadores 1:X que el usuario tiene en su colección, ordenados; opcionalmente se incluye
 * un valor aún presente en URL/estado (p. ej. carga en curso del listado de escalas).
 * @param {number[]} fromUserVehicles
 * @param {string|number|undefined} [includeDenominator]
 * @returns {number[]}
 */
export function mergeScaleDenominators(fromUserVehicles, includeDenominator) {
  const set = new Set();
  for (const v of fromUserVehicles) {
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
      set.add(Number(v));
    }
  }
  if (includeDenominator != null && String(includeDenominator).trim() !== '') {
    const n = parseInt(String(includeDenominator), 10);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}
