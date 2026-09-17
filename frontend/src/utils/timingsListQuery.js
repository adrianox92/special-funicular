/**
 * Filtros del listado /timings desde query string (deep-link de Nueva sesión, etc.).
 * Acepta circuit_id y vehicle o vehicle_id; el resto de filtros sigue vacío.
 *
 * @param {string|URLSearchParams|null|undefined} search
 * @returns {{ circuit_id: string, vehicle: string }}
 */
export function parseTimingsListFilterFromSearch(search) {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(typeof search === 'string' ? search.replace(/^\?/, '') : '');
  return {
    circuit_id: (params.get('circuit_id') || '').trim(),
    vehicle: (params.get('vehicle') || params.get('vehicle_id') || '').trim(),
  };
}
