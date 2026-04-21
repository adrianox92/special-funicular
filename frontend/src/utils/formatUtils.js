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

/**
 * Importe en euros (es-ES).
 * @param {number|null|undefined} value
 * @param {{ minimumFractionDigits?: number; maximumFractionDigits?: number }} [opts]
 */
export function formatCurrencyEur(value, opts = {}) {
  const min = opts.minimumFractionDigits ?? 2;
  const max = opts.maximumFractionDigits ?? 2;
  const n = Number(value);
  if (value == null || Number.isNaN(n)) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }).format(0);
  }
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(n);
}

/**
 * Porcentaje para mostrar en UI. `value` es el número “humano” del backend (ej. 12.5 = 12,5 %).
 * @param {number|null|undefined} value
 */
export function formatPercentEs(value) {
  const n = Number(value);
  if (value == null || Number.isNaN(n)) {
    return new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(0);
  }
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / 100);
}

/**
 * Tiempo de vuelta para tarjetas y tablas: acepta mm:ss.ms o segundos numéricos.
 * @param {string|number|null|undefined} timeStr
 * @returns {string}
 */
export function formatLapTimeDisplay(timeStr) {
  if (timeStr == null || timeStr === '') return 'N/A';
  if (typeof timeStr === 'string' && /^\d{2}:\d{2}\.\d{3}$/.test(timeStr)) return timeStr;
  const seconds = Number(timeStr);
  if (!Number.isNaN(seconds)) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(3);
    return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
  }
  return 'N/A';
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

/**
 * Muestra una fecha para tarjetas del dashboard: acepta ISO, Date o texto dd/mm/aaaa ya formateado por la API.
 * @param {string|Date|null|undefined} raw
 * @returns {string}
 */
export function formatDashboardMetricDate(raw) {
  if (raw == null || raw === '') return 'N/A';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const s = String(raw).trim();
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const d = new Date(parseInt(dmY[3], 10), parseInt(dmY[2], 10) - 1, parseInt(dmY[1], 10));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return s;
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

/**
 * Nombre de fichero local seguro a partir del nombre del coche (misma lógica que el PDF en el backend).
 * @param {string|null|undefined} model
 * @param {{ fallback?: string }} [opts]
 * @returns {string}
 */
export function safeVehicleFileBasename(model, opts = {}) {
  const fb = opts.fallback ?? 'vehiculo';
  const raw = String(model ?? '').trim() || fb;
  const cleaned = raw
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = (cleaned || fb).toLowerCase();
  return base.slice(0, 180);
}
