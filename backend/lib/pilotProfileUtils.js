/**
 * Validación de slug para perfil público de piloto.
 * Minúsculas, números y guiones; sin empezar/terminar en guión.
 */
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MIN = 3;
const SLUG_MAX = 40;

function normalizePilotSlug(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

function isValidPilotSlug(slug) {
  const s = normalizePilotSlug(slug);
  if (s.length < SLUG_MIN || s.length > SLUG_MAX) return false;
  return SLUG_REGEX.test(s);
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, volts: number | null } | { ok: false, error: string }}
 */
function parseSupplyVoltageVolts(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, volts: null };
  }
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'supply_voltage_volts debe ser un número' };
  }
  if (n < 0 || n > 30) {
    return { ok: false, error: 'supply_voltage_volts debe estar entre 0 y 30' };
  }
  return { ok: true, volts: Math.round(n * 100) / 100 };
}

module.exports = {
  normalizePilotSlug,
  isValidPilotSlug,
  parseSupplyVoltageVolts,
  SLUG_MIN,
  SLUG_MAX,
};
