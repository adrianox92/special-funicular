const LAST_CIRCUIT_KEY = 'slotdb-session-last-circuit-id';

export function getLastSessionCircuitId() {
  try {
    const value = localStorage.getItem(LAST_CIRCUIT_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function setLastSessionCircuitId(circuitId) {
  if (!circuitId) return;
  try {
    localStorage.setItem(LAST_CIRCUIT_KEY, String(circuitId));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Elige el circuito por defecto: último usado si sigue existiendo, si no el primero de la lista.
 * @param {Array<{ id: string }>} circuits
 * @param {string|null} [preferredId]
 */
export function pickDefaultCircuitId(circuits, preferredId = null) {
  const list = Array.isArray(circuits) ? circuits : [];
  const ids = new Set(list.map((c) => String(c.id)));
  if (preferredId && ids.has(String(preferredId))) return String(preferredId);
  const last = getLastSessionCircuitId();
  if (last && ids.has(last)) return last;
  return list[0] ? String(list[0].id) : '';
}
