const LAST_VEHICLE_KEY = 'slotdb-session-last-vehicle-id';

export function getLastSessionVehicleId() {
  try {
    const value = localStorage.getItem(LAST_VEHICLE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function setLastSessionVehicleId(vehicleId) {
  if (!vehicleId) return;
  try {
    localStorage.setItem(LAST_VEHICLE_KEY, String(vehicleId));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearLastSessionVehicleId() {
  try {
    localStorage.removeItem(LAST_VEHICLE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Elige el vehículo por defecto: query/preferred si sigue en el garaje,
 * si no el último usado en modo sesión (y limpia el id si ya no existe).
 * Con un solo coche, lo preselecciona.
 * @param {Array<{ id: string }>} vehicles
 * @param {string|null} [preferredId]
 */
export function pickDefaultVehicleId(vehicles, preferredId = null) {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const ids = new Set(list.map((v) => String(v.id)));
  if (preferredId && ids.has(String(preferredId))) return String(preferredId);
  const last = getLastSessionVehicleId();
  if (last && ids.has(last)) return last;
  if (last) clearLastSessionVehicleId();
  if (list.length === 1) return String(list[0].id);
  return '';
}
