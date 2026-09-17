/**
 * Deep-links del resumen post-guardado de Nueva sesión.
 * Reutiliza rutas existentes: /timings (filtros query) y /vehicles/:id?tab=timings.
 *
 * @param {{ vehicleId?: string|number|null, circuitId?: string|number|null }} ids
 * @returns {{
 *   circuitHistory: string,
 *   vehicleSheet: string|null,
 *   vehicleOnCircuit: string|null,
 * }}
 */
export function buildSessionSummaryShortcuts({ vehicleId, circuitId } = {}) {
  const circuit = circuitId != null && String(circuitId).trim() !== '' ? String(circuitId) : '';
  const vehicle = vehicleId != null && String(vehicleId).trim() !== '' ? String(vehicleId) : '';

  const circuitParams = new URLSearchParams();
  if (circuit) circuitParams.set('circuit_id', circuit);
  const circuitQuery = circuitParams.toString();
  const circuitHistory = circuitQuery ? `/timings?${circuitQuery}` : '/timings';

  const vehicleSheet = vehicle
    ? `/vehicles/${encodeURIComponent(vehicle)}?tab=timings`
    : null;

  let vehicleOnCircuit = null;
  if (vehicle && circuit) {
    const params = new URLSearchParams();
    params.set('circuit_id', circuit);
    params.set('vehicle', vehicle);
    vehicleOnCircuit = `/timings?${params.toString()}`;
  }

  return { circuitHistory, vehicleSheet, vehicleOnCircuit };
}
