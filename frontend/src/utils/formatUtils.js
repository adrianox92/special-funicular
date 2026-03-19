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

/**
 * Texto legible de un snapshot de modificación (historial).
 * @param {Record<string, unknown>|null|undefined} snap
 * @param {{ value: string, label: string }[]} [componentTypes]
 */
export function formatModificationSnapshot(snap, componentTypes = []) {
  if (!snap || typeof snap !== 'object') return '—';
  const typeLabel =
    componentTypes.find((t) => t.value === snap.component_type)?.label ||
    snap.component_type ||
    '—';
  const parts = [typeLabel, snap.element, snap.manufacturer].filter(
    (p) => p != null && String(p).trim() !== '' && String(p) !== 'null'
  );
  const ref = snap.reference ?? snap.sku;
  if (ref != null && String(ref).trim() !== '' && String(ref) !== 'null') {
    parts.push(`Referencia: ${String(ref).trim()}`);
  }
  if (snap.price != null && snap.price !== '') {
    const p = Number(snap.price);
    if (!Number.isNaN(p)) parts.push(`${p.toFixed(2)} €`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

/** Fecha ISO YYYY-MM-DD o date a texto dd/mm/aaaa */
export function formatHistoryDate(isoDate) {
  if (!isoDate) return '—';
  const d = String(isoDate).slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return String(isoDate);
  return `${day}/${m}/${y}`;
}
