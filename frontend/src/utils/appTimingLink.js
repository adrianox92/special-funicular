/**
 * URL web de redirección hacia Slot Lap Timer (custom scheme).
 * @param {{ vehicleId: string, circuitId?: string|null, lane?: string|null, guided?: boolean }} params
 * @returns {string}
 */
export function buildAppTimingRedirectUrl({ vehicleId, circuitId, lane, guided = true }) {
  const params = new URLSearchParams();
  params.set('vehicle_id', vehicleId);
  if (circuitId) params.set('circuit_id', circuitId);
  if (lane != null && lane !== '' && lane !== 'Sin carril') {
    params.set('lane', String(lane));
  }
  if (guided) params.set('guided', '1');
  return `/app/timing?${params.toString()}`;
}

/**
 * Deep link nativo slotdatabase://
 * @param {{ vehicleId: string, circuitId?: string|null, lane?: string|null, guided?: boolean }} params
 * @returns {string}
 */
export function buildAppTimingDeepLink({ vehicleId, circuitId, lane, guided = true }) {
  const params = new URLSearchParams();
  params.set('vehicle_id', vehicleId);
  if (circuitId) params.set('circuit_id', circuitId);
  if (lane != null && lane !== '' && lane !== 'Sin carril') {
    params.set('lane', String(lane));
  }
  if (guided) params.set('guided', '1');
  return `slotdatabase://timing?${params.toString()}`;
}

export const DEFAULT_GUIDED_TARGET_MS = 200;
