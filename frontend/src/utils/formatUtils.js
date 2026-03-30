import {
  getVehicleComponentTypeLabel,
  inventoryVehicleCategoryValues,
} from '../data/componentTypes';

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

/** Precio unitario × unidades montadas (mínimo 1 unidad). */
export function modificationLineTotal(price, mountedQty) {
  const unit = price != null && price !== '' && !Number.isNaN(Number(price)) ? Number(price) : 0;
  let q = parseInt(mountedQty, 10);
  if (Number.isNaN(q) || q < 1) q = 1;
  return unit * q;
}

/**
 * Texto legible de un snapshot de modificación (historial).
 * @param {Record<string, unknown>|null|undefined|string} snap
 */
export function formatModificationSnapshot(snap) {
  if (snap == null) return '—';
  let obj = snap;
  if (typeof snap === 'string') {
    try {
      obj = JSON.parse(snap);
    } catch {
      return '—';
    }
  }
  if (!obj || typeof obj !== 'object') return '—';
  const typeLabel = getVehicleComponentTypeLabel(obj.component_type);
  const parts = [typeLabel, obj.element, obj.manufacturer].filter(
    (p) =>
      p != null &&
      String(p).trim() !== '' &&
      String(p) !== 'null' &&
      p !== '—',
  );
  const ref = obj.reference ?? obj.sku;
  if (ref != null && String(ref).trim() !== '' && String(ref) !== 'null') {
    parts.push(`Referencia: ${String(ref).trim()}`);
  }
  if (obj.price != null && obj.price !== '') {
    const p = Number(obj.price);
    if (!Number.isNaN(p)) parts.push(`${p.toFixed(2)} €`);
  }
  const mq = obj.mounted_qty != null ? Number(obj.mounted_qty) : null;
  if (mq != null && !Number.isNaN(mq) && mq !== 1) {
    parts.push(`${mq} uds montadas`);
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

/** Categorías de inventario (alineadas con backend/routes/inventory.js). Etiquetas de piezas = componentTypes. */
export const INVENTORY_CATEGORIES = [
  ...inventoryVehicleCategoryValues.map((value) => ({
    value,
    label: getVehicleComponentTypeLabel(value),
  })),
  { value: 'aceite', label: 'Aceite / lubricante' },
  { value: 'limpiador', label: 'Limpiador' },
  { value: 'electronica', label: 'Electrónica' },
  { value: 'herramienta', label: 'Herramienta' },
  { value: 'neumaticos', label: 'Neumáticos' },
  { value: 'cables', label: 'Cables' },
  { value: 'suspension', label: 'Suspensión' },
  { value: 'trencillas', label: 'Trencillas' },
  { value: 'tornillos', label: 'Tornillos' },
  { value: 'stoppers', label: 'Stoppers' },
  { value: 'topes_y_centradores', label: 'Topes y centradores' },
  { value: 'cojinetes', label: 'Cojinetes' },
  { value: 'otro', label: 'Otro' },
].sort((a, b) => a.label.localeCompare(b.label, 'es'));

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
