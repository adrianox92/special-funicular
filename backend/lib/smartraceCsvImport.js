const { formatSecondsToLapTime } = require('./timingUtils');

const PREVIEW_VEHICLE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * @param {string|undefined|null} raw
 * @returns {number|null}
 */
function parseLapTimeToSeconds(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length >= 2) {
      const mins = parseInt(parts[0], 10);
      const secPart = parts.slice(1).join(':');
      const sec = parseFloat(String(secPart).replace(',', '.'));
      if (Number.isFinite(mins) && Number.isFinite(sec)) {
        return mins * 60 + sec;
      }
    }
    return null;
  }
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {string[]} headersNormalized
 * @returns {boolean}
 */
function hasNumericLapColumns(headersNormalized) {
  return headersNormalized.some((h) => /^\d+$/.test(h));
}

/**
 * SmartRace export (Spanish): vueltas, piloto, columnas 1..N con tiempos m:ss.mmm
 * @param {string[]} headersNormalized
 * @returns {boolean}
 */
function isSmartRaceHeaders(headersNormalized) {
  if (!headersNormalized.length) return false;
  if (!hasNumericLapColumns(headersNormalized)) return false;
  const hasVueltas = headersNormalized.includes('vueltas');
  const hasPiloto = headersNormalized.includes('piloto');
  return hasVueltas || hasPiloto;
}

const CIRCUIT_HEADER_KEYS = ['circuit', 'circuito', 'circuit_id'];
const LANE_HEADER_KEYS = ['lane', 'carril'];

/**
 * @param {Record<string, string>} row
 * @returns {Record<string, string>}
 */
function normalizeSmartRaceRow(row) {
  const r = { ...row };
  if (!r.circuit && r.circuito) r.circuit = r.circuito;
  if (!r.lane && r.carril) r.lane = r.carril;
  return r;
}

/**
 * @param {Record<string, string>} row
 * @returns {boolean}
 */
function hasCircuitInRow(row) {
  const r = normalizeSmartRaceRow(row);
  if (r.circuit_id != null && String(r.circuit_id).trim() !== '') return true;
  if (r.circuit != null && String(r.circuit).trim() !== '') return true;
  return false;
}

/**
 * @param {Record<string, string>} row
 * @returns {boolean}
 */
function hasLaneInRow(row) {
  const r = normalizeSmartRaceRow(row);
  return r.lane != null && String(r.lane).trim() !== '';
}

/**
 * @param {string[]} headersNormalized
 * @param {Record<string, string>[]} objects
 * @returns {{ needsCircuitPick: boolean, needsLanePick: boolean }}
 */
function getSmartRaceCsvMeta(headersNormalized, objects) {
  const hasCircuitHeader = headersNormalized.some((h) => CIRCUIT_HEADER_KEYS.includes(h));
  const hasLaneHeader = headersNormalized.some((h) => LANE_HEADER_KEYS.includes(h));
  const first = objects[0] || {};
  const rn = normalizeSmartRaceRow(first);
  const circuitInFile = hasCircuitHeader && hasCircuitInRow(rn);
  const laneInFile = hasLaneHeader && hasLaneInRow(rn);
  return {
    needsCircuitPick: !circuitInFile,
    needsLanePick: !laneInFile,
  };
}

/**
 * Aplica circuito/carril elegidos en la importación cuando el CSV no los trae.
 * @param {Record<string, string>} row
 * @param {{ circuit_id?: string, circuit?: string, lane?: string }} importOptions
 * @returns {Record<string, string>}
 */
function mergeSmartRaceRowWithImportOptions(row, importOptions) {
  const r = normalizeSmartRaceRow(row);
  const { circuit_id: optCid, circuit: optName, lane: optLane } = importOptions || {};
  if (!hasCircuitInRow(r)) {
    if (optCid != null && String(optCid).trim() !== '') {
      r.circuit_id = String(optCid).trim();
    } else if (optName != null && String(optName).trim() !== '') {
      r.circuit = String(optName).trim();
    }
  }
  if (!hasLaneInRow(r) && optLane != null && String(optLane).trim() !== '') {
    r.lane = String(optLane).trim();
  }
  return r;
}

/**
 * @param {Record<string, string>} row
 * @param {string} defaultVehicleId
 * @returns {object} body for insertVehicleTimingFromSyncBody
 */
function smartRaceRowToSyncBody(row, defaultVehicleId) {
  row = normalizeSmartRaceRow(row);
  const vid = (row.vehicle_id && String(row.vehicle_id).trim()) || defaultVehicleId;
  if (!vid) {
    throw new Error('vehicle_id requerido (columna o parámetro de la petición)');
  }

  const declaredRaw = row.vueltas != null ? String(row.vueltas).trim() : '';
  const declaredLaps = declaredRaw ? parseInt(declaredRaw.replace(',', '.'), 10) : NaN;

  const lapKeys = Object.keys(row)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));

  const lap_times = [];
  const maxByDeclared = Number.isFinite(declaredLaps) && declaredLaps > 0 ? declaredLaps : Infinity;

  for (const k of lapKeys) {
    if (lap_times.length >= maxByDeclared) break;
    const sec = parseLapTimeToSeconds(row[k]);
    if (sec != null && sec > 0) {
      lap_times.push({
        lap_number: lap_times.length + 1,
        time_seconds: sec,
        lap_time_seconds: sec,
      });
    }
  }

  if (lap_times.length === 0) {
    throw new Error('No se pudieron leer vueltas válidas (columnas 1, 2, … con tiempos)');
  }

  const laps = lap_times.length;
  const times = lap_times.map((l) => l.time_seconds);
  const totalSec = times.reduce((a, b) => a + b, 0);
  const bestSec = Math.min(...times);
  const avgSec = totalSec / laps;

  const best_lap_timestamp = bestSec;
  const total_time_timestamp = totalSec;
  const average_time_timestamp = avgSec;

  const best_lap_time = formatSecondsToLapTime(bestSec);
  const total_time = formatSecondsToLapTime(totalSec);
  const average_time = formatSecondsToLapTime(avgSec);

  if (!best_lap_time || !total_time || !average_time) {
    throw new Error('Error al formatear tiempos agregados');
  }

  let mismatchWarning = null;
  if (Number.isFinite(declaredLaps) && declaredLaps > 0 && declaredLaps !== laps) {
    mismatchWarning = `La columna vueltas indica ${declaredLaps} pero se leyeron ${laps} tiempos de vuelta`;
  }

  return {
    vehicle_id: vid,
    best_lap_time,
    total_time,
    laps,
    average_time,
    lane: row.lane && String(row.lane).trim() ? String(row.lane).trim() : null,
    circuit: row.circuit && String(row.circuit).trim() ? String(row.circuit).trim() : null,
    circuit_id: row.circuit_id && String(row.circuit_id).trim() ? String(row.circuit_id).trim() : null,
    timing_date: row.timing_date && String(row.timing_date).trim() ? String(row.timing_date).trim() : null,
    best_lap_timestamp,
    total_time_timestamp,
    average_time_timestamp,
    lap_times,
    _smartraceWarning: mismatchWarning,
  };
}

/**
 * @param {Record<string, string>} row
 * @param {number} index
 * @returns {{ index: number, pilotLabel: string, lapsExpected: number|null, error: string|null, warning?: string|null }}
 */
function previewSmartRaceRow(row, index) {
  const pilot = row.piloto != null ? String(row.piloto).trim() : '';
  const car = row.coche != null ? String(row.coche).trim() : '';
  const pilotLabel = [pilot, car].filter(Boolean).join(' · ') || `Fila ${index + 1}`;
  let lapsExpected = null;
  const lr = row.vueltas != null ? String(row.vueltas).trim() : '';
  if (lr) {
    const n = parseInt(lr.replace(',', '.'), 10);
    if (Number.isFinite(n)) lapsExpected = n;
  }
  try {
    const body = smartRaceRowToSyncBody(row, PREVIEW_VEHICLE_ID);
    return {
      index,
      pilotLabel,
      lapsExpected,
      error: null,
      warning: body._smartraceWarning || null,
    };
  } catch (e) {
    return {
      index,
      pilotLabel,
      lapsExpected,
      error: e.message || String(e),
    };
  }
}

module.exports = {
  PREVIEW_VEHICLE_ID,
  parseLapTimeToSeconds,
  isSmartRaceHeaders,
  normalizeSmartRaceRow,
  hasCircuitInRow,
  hasLaneInRow,
  getSmartRaceCsvMeta,
  mergeSmartRaceRowWithImportOptions,
  smartRaceRowToSyncBody,
  previewSmartRaceRow,
};
