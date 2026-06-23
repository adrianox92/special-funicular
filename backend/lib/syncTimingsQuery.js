const { bestLapSecondsFromTimingRow } = require('./personalBest');

function normalizeLane(lane) {
  if (lane == null || lane === '') return null;
  return String(lane).trim();
}

/**
 * Filtra sesiones para la búsqueda de baseline (entrenamiento guiado).
 * Soporta circuit_id y registros legacy con solo nombre de circuito en texto.
 */
function filterTimingsForBaseline(timings, { circuit_id, circuitName, lane }) {
  const filterLane = normalizeLane(lane);
  const normalizedCircuitName = circuitName
    ? String(circuitName).trim().toLowerCase()
    : null;

  return (timings || []).filter((row) => {
    if (circuit_id) {
      const matchesCircuitId = row.circuit_id === circuit_id;
      const matchesLegacyName =
        !row.circuit_id &&
        normalizedCircuitName &&
        row.circuit &&
        String(row.circuit).trim().toLowerCase() === normalizedCircuitName;
      if (!matchesCircuitId && !matchesLegacyName) return false;
    }

    if (filterLane != null) {
      const rowLane = normalizeLane(row.lane);
      if (rowLane !== filterLane) return false;
    }

    return bestLapSecondsFromTimingRow(row) != null;
  });
}

function sortTimingsByBestLap(timings) {
  return (timings || []).slice().sort((a, b) => {
    const aSec = bestLapSecondsFromTimingRow(a) ?? Infinity;
    const bSec = bestLapSecondsFromTimingRow(b) ?? Infinity;
    return aSec - bSec;
  });
}

/**
 * Filtra sesiones para baseline; si no hay coincidencia exacta de carril,
 * solo reutiliza sesiones legacy sin carril registrado (nunca otro carril).
 * @returns {{ timings: object[], laneFallback: boolean }}
 */
function resolveBaselineTimings(rawTimings, filters) {
  const strict = filterTimingsForBaseline(rawTimings, filters);
  if (strict.length > 0 || !normalizeLane(filters.lane)) {
    return { timings: strict, laneFallback: false };
  }

  const normalizedCircuitName = filters.circuitName
    ? String(filters.circuitName).trim().toLowerCase()
    : null;

  const legacyNoLane = (rawTimings || []).filter((row) => {
    if (normalizeLane(row.lane) != null) return false;

    if (filters.circuit_id) {
      const matchesCircuitId = row.circuit_id === filters.circuit_id;
      const matchesLegacyName =
        !row.circuit_id &&
        normalizedCircuitName &&
        row.circuit &&
        String(row.circuit).trim().toLowerCase() === normalizedCircuitName;
      if (!matchesCircuitId && !matchesLegacyName) return false;
    }

    return bestLapSecondsFromTimingRow(row) != null;
  });

  return { timings: legacyNoLane, laneFallback: legacyNoLane.length > 0 };
}

module.exports = {
  normalizeLane,
  filterTimingsForBaseline,
  sortTimingsByBestLap,
  resolveBaselineTimings,
};
