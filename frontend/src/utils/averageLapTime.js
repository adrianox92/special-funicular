const LAP_TIME_RE = /^(\d{2}):(\d{2})\.(\d{3})$/;

/**
 * Convierte mm:ss.mmm a segundos.
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
 * Formato mm:ss.mmm. Redondea al milisegundo más cercano sobre el total
 * (Math.round(seconds * 1000)), con acarreo correcto a segundos/minutos.
 * Misma regla para NewSession (modo sesión) y la ficha de vehículo (EditVehicle).
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
 * Promedio = tiempo total / vueltas, formateado con redondeo a ms.
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

/**
 * Variables de interpolación i18n cuando el total es menor que best × vueltas.
 * `minimum` usa el mismo redondeo a ms que el promedio.
 * @returns {{ total: string, minimum: string, laps: number|string, bestLap: string } | null}
 */
export function getTotalTimeTooLowContext(totalTime, laps, bestLapTime) {
  if (!isTotalTimeTooLow(totalTime, laps, bestLapTime)) return null;
  const bestLapSeconds = parseLapTimeToSeconds(bestLapTime);
  return {
    total: totalTime,
    minimum: formatSecondsToLapTime(bestLapSeconds * Number(laps)),
    laps,
    bestLap: bestLapTime,
  };
}

export function isValidLapTime(timeStr) {
  return parseLapTimeToSeconds(timeStr) != null;
}

/** Timestamp numérico del promedio mostrado (parsea el mm:ss.mmm ya redondeado). */
export function averageTimeTimestamp(averageTime) {
  return parseLapTimeToSeconds(averageTime);
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
