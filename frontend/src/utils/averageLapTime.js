const LAP_TIME_RE = /^(\d{2}):(\d{2})\.(\d{3})$/;

/**
 * Convierte mm:ss.mmm a segundos (misma regla que EditVehicle).
 * @param {string} timeStr
 * @returns {number|null}
 */
export function parseLapTimeToSeconds(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).match(LAP_TIME_RE);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const milliseconds = Number(match[3]);
  if ([minutes, seconds, milliseconds].some((n) => Number.isNaN(n))) return null;
  return minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Formato mm:ss.mmm usado en EditVehicle al calcular el promedio (ms con Math.floor).
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatSecondsToLapTime(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(Number(totalSeconds))) return '';
  const totalMs = Math.round(Number(totalSeconds) * 1000);
  const avgMinutes = Math.floor(totalMs / 60000);
  const rem = totalMs % 60000;
  const avgSeconds = Math.floor(rem / 1000);
  const avgMilliseconds = rem % 1000;
  return `${String(avgMinutes).padStart(2, '0')}:${String(avgSeconds).padStart(2, '0')}.${String(avgMilliseconds).padStart(3, '0')}`;
}

/**
 * Promedio = tiempo total / vueltas. Misma fórmula que EditVehicle.
 * @param {string} totalTime
 * @param {number|string} laps
 * @param {string} bestLapTime
 * @returns {string}
 */
export function calculateAverageTime(totalTime, laps, bestLapTime) {
  const lapsN = Number(laps);
  if (!totalTime || !lapsN || lapsN <= 0 || !bestLapTime) return '';
  const totalSeconds = parseLapTimeToSeconds(totalTime);
  const bestLapSeconds = parseLapTimeToSeconds(bestLapTime);
  if (totalSeconds === null || bestLapSeconds === null) return '';
  return formatSecondsToLapTime(totalSeconds / lapsN);
}

/**
 * @param {string} totalTime
 * @param {number|string} laps
 * @param {string} bestLapTime
 * @returns {boolean}
 */
export function isTotalTimeTooLow(totalTime, laps, bestLapTime) {
  const lapsN = Number(laps);
  const totalSeconds = parseLapTimeToSeconds(totalTime);
  const bestLapSeconds = parseLapTimeToSeconds(bestLapTime);
  if (totalSeconds == null || bestLapSeconds == null || !lapsN || lapsN <= 0) return false;
  return totalSeconds < bestLapSeconds * lapsN;
}

export function isValidLapTime(timeStr) {
  return parseLapTimeToSeconds(timeStr) != null;
}

/**
 * Cuerpo JWT/sync para POST /api/timings (mismo contrato que POST /api/sync/timings).
 * @param {{
 *   vehicleId: string,
 *   circuitId?: string,
 *   circuitName?: string,
 *   lane?: string|number|null,
 *   bestLapTime: string,
 *   totalTime: string,
 *   laps: string|number,
 *   supplyVoltageVolts?: string|number|null,
 *   timingDate?: string,
 * }} input
 */
export function buildSessionTimingPayload(input) {
  const lapsN = parseInt(String(input.laps ?? ''), 10);
  const average_time = calculateAverageTime(input.totalTime, lapsN, input.bestLapTime);

  const payload = {
    vehicle_id: input.vehicleId,
    best_lap_time: input.bestLapTime,
    total_time: input.totalTime,
    laps: lapsN,
    average_time,
    best_lap_timestamp: parseLapTimeToSeconds(input.bestLapTime),
    total_time_timestamp: parseLapTimeToSeconds(input.totalTime),
    average_time_timestamp: parseLapTimeToSeconds(average_time),
    timing_date: input.timingDate || new Date().toISOString().split('T')[0],
    session_type: 'TRAINING',
  };

  if (input.circuitId) payload.circuit_id = input.circuitId;
  if (input.circuitName) payload.circuit = input.circuitName;

  const lane = input.lane != null && String(input.lane).trim() !== '' ? String(input.lane).trim() : '';
  if (lane) payload.lane = lane;

  if (input.supplyVoltageVolts != null && String(input.supplyVoltageVolts).trim() !== '') {
    const n = parseFloat(String(input.supplyVoltageVolts).replace(',', '.'));
    if (Number.isFinite(n)) payload.supply_voltage_volts = n;
  }

  return payload;
}
