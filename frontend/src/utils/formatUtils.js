import i18n from '../i18n';
import { toIntlLocale } from '../i18n/localeUtils';
import {
  getVehicleComponentTypeLabel,
  inventoryVehicleCategoryValues,
} from '../data/componentTypes';

/** Active BCP 47 locale for Intl formatters. */
export function getIntlLocale() {
  return toIntlLocale(i18n.language || 'es');
}

/**
 * Convierte valores null/undefined o la cadena "null" a cadena vacía para mostrar en inputs.
 */
export function toDisplayValue(value) {
  if (value == null || value === 'null' || value === 'undefined') return '';
  return String(value);
}

export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '-';
  const m = Number(meters);
  if (m < 1000) return `${m.toFixed(1)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatCurrencyEur(value, opts = {}) {
  const locale = getIntlLocale();
  const min = opts.minimumFractionDigits ?? 2;
  const max = opts.maximumFractionDigits ?? 2;
  const n = Number(value);
  const fmt = (num) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }).format(num);
  if (value == null || Number.isNaN(n)) return fmt(0);
  return fmt(n);
}

export function formatPercent(value) {
  const locale = getIntlLocale();
  const n = Number(value);
  const opts = { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (value == null || Number.isNaN(n)) {
    return new Intl.NumberFormat(locale, opts).format(0);
  }
  return new Intl.NumberFormat(locale, opts).format(n / 100);
}

/** @deprecated alias */
export const formatPercentEs = formatPercent;

export function formatDate(raw, opts = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (raw == null || raw === '') return 'N/A';
  const locale = getIntlLocale();
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toLocaleDateString(locale, opts);
  }
  const parsed = new Date(String(raw).trim());
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString(locale, opts);
  return String(raw);
}

/**
 * @param {number|null|undefined} value
 * @param {string} [localeOverride]
 * @param {Intl.NumberFormatOptions} [options]
 */
export function formatNumber(value, localeOverride, options) {
  const locale = localeOverride ? toIntlLocale(localeOverride) : getIntlLocale();
  const n = Number(value);
  if (value == null || Number.isNaN(n)) {
    return new Intl.NumberFormat(locale, options).format(0);
  }
  return new Intl.NumberFormat(locale, options).format(n);
}

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

export function modificationLineTotal(price, mountedQty) {
  const unit = price != null && price !== '' && !Number.isNaN(Number(price)) ? Number(price) : 0;
  let q = parseInt(mountedQty, 10);
  if (Number.isNaN(q) || q < 1) q = 1;
  return unit * q;
}

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
    (p) => p != null && String(p).trim() !== '' && String(p) !== 'null' && p !== '—',
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
  if (mq != null && !Number.isNaN(mq) && mq !== 1) parts.push(`${mq} uds montadas`);
  return parts.length ? parts.join(' · ') : '—';
}

export function formatDashboardMetricDate(raw) {
  return formatDate(raw);
}

export function formatHistoryDate(isoDate) {
  if (!isoDate) return '—';
  const d = String(isoDate).slice(0, 10);
  const parsed = new Date(`${d}T12:00:00`);
  if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
  return String(isoDate);
}

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

export function formatMaintenanceKind(kind) {
  if (kind == null || kind === '') return '—';
  const key = `maintenanceKinds.${kind}`;
  if (i18n.exists(key, { ns: 'data' })) return i18n.t(key, { ns: 'data' });
  const found = MAINTENANCE_KINDS.find((k) => k.value === kind);
  return found ? found.label : String(kind);
}

const INVENTORY_EXTRA_I18N = {
  aceite: 'inventoryExtra.aceite',
  limpiador: 'inventoryExtra.limpiador',
  electronica: 'inventoryExtra.electronica',
  herramienta: 'inventoryExtra.herramienta',
  neumaticos: 'inventoryExtra.neumaticos',
  cables: 'inventoryExtra.cables',
  suspension: 'inventoryExtra.suspension',
  trencillas: 'inventoryExtra.trencillas',
  tornillos: 'inventoryExtra.tornillos',
  stoppers: 'inventoryExtra.stoppers',
  topes_y_centradores: 'inventoryExtra.topes_y_centradores',
  cojinetes: 'inventoryExtra.cojinetes',
  otro: 'inventoryExtra.otro',
};

export function formatInventoryCategory(cat) {
  if (cat == null || cat === '') return '—';
  const fromComponent = getVehicleComponentTypeLabel(cat);
  if (fromComponent !== '—' && fromComponent !== String(cat)) return fromComponent;
  const i18nKey = INVENTORY_EXTRA_I18N[cat];
  if (i18nKey && i18n.exists(i18nKey, { ns: 'data' })) return i18n.t(i18nKey, { ns: 'data' });
  return String(cat);
}

export const INVENTORY_CATEGORIES = [
  ...inventoryVehicleCategoryValues.map((value) => ({
    value,
    label: getVehicleComponentTypeLabel(value),
  })),
  ...Object.keys(INVENTORY_EXTRA_I18N).map((value) => ({
    value,
    get label() {
      return formatInventoryCategory(value);
    },
  })),
].sort((a, b) => a.label.localeCompare(b.label, getIntlLocale()));

export const INVENTORY_UNITS = [
  { value: 'uds', label: 'Unidades' },
  { value: 'pares', label: 'Pares' },
  { value: 'ml', label: 'ml' },
  { value: 'metros', label: 'Metros' },
  { value: 'juego', label: 'Juego' },
];

const FORBIDDEN_FILE_NAME_CHARS = new Set('<>:"/\\|?*');

export function safeVehicleFileBasename(model, opts = {}) {
  const fb = opts.fallback ?? 'vehiculo';
  const raw = String(model ?? '').trim() || fb;
  let cleaned = raw
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 32 || code === 127) return false;
      return !FORBIDDEN_FILE_NAME_CHARS.has(ch);
    })
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  while (cleaned.startsWith('-')) cleaned = cleaned.slice(1);
  while (cleaned.endsWith('-')) cleaned = cleaned.slice(0, -1);
  return (cleaned || fb).toLowerCase().slice(0, 180);
}

/** Etiqueta para selectores: prefija club si es circuito compartido. */
export function formatCircuitSelectLabel(circuit) {
  if (!circuit?.name) return '—';
  const clubName = circuit.clubs?.name;
  if (circuit.club_id && clubName) {
    return `[${clubName}] ${circuit.name}`;
  }
  if (circuit.club_id) {
    return `[Club] ${circuit.name}`;
  }
  return circuit.name;
}
