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

/** Tipos de mantenimiento (etiquetas UI y validación alineada con backend). */
export const MAINTENANCE_KINDS = [
  { value: 'limpieza_general', label: 'Limpieza general' },
  { value: 'guias', label: 'Guías' },
  { value: 'escobillas', label: 'Escobillas' },
  { value: 'engrase', label: 'Engrase' },
  { value: 'iman', label: 'Imán' },
  { value: 'contactos', label: 'Contactos' },
  { value: 'neumaticos', label: 'Neumáticos' },
  { value: 'cables', label: 'Cables' },
  { value: 'suspension', label: 'Suspensión' },
  { value: 'otro', label: 'Otro' },
];

/**
 * @param {string|null|undefined} kind
 * @returns {string}
 */
export function formatMaintenanceKind(kind) {
  if (kind == null || kind === '') return '—';
  const found = MAINTENANCE_KINDS.find((k) => k.value === kind);
  return found ? found.label : String(kind);
}

/** Categorías de inventario (alineadas con backend/routes/inventory.js). */
export const INVENTORY_CATEGORIES = [
  { value: 'pinion', label: 'Piñón' },
  { value: 'crown', label: 'Corona' },
  { value: 'motor', label: 'Motor' },
  { value: 'guide', label: 'Guía' },
  { value: 'chassis', label: 'Chasis' },
  { value: 'front_wheel', label: 'Rueda delantera' },
  { value: 'rear_wheel', label: 'Rueda trasera' },
  { value: 'front_rim', label: 'Llanta delantera' },
  { value: 'rear_rim', label: 'Llanta trasera' },
  { value: 'front_axle', label: 'Eje delantero' },
  { value: 'rear_axle', label: 'Eje trasero' },
  { value: 'aceite', label: 'Aceite / lubricante' },
  { value: 'limpiador', label: 'Limpiador' },
  { value: 'electronica', label: 'Electrónica' },
  { value: 'herramienta', label: 'Herramienta' },
  { value: 'neumaticos', label: 'Neumáticos' },
  { value: 'cables', label: 'Cables' },
  { value: 'suspension', label: 'Suspensión' },
  { value: 'otro', label: 'Otro' },
];

export const INVENTORY_UNITS = [
  { value: 'uds', label: 'Unidades' },
  { value: 'pares', label: 'Pares' },
  { value: 'ml', label: 'ml' },
  { value: 'metros', label: 'Metros' },
  { value: 'juego', label: 'Juego' },
];

/**
 * @param {string|null|undefined} cat
 * @returns {string}
 */
export function formatInventoryCategory(cat) {
  if (cat == null || cat === '') return '—';
  const found = INVENTORY_CATEGORIES.find((c) => c.value === cat);
  return found ? found.label : String(cat);
}
