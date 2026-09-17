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

/** Tope de filas en captura opcional (móvil / rendimiento). */
export const MAX_SESSION_LAP_ROWS = 80;

/**
 * Ajusta el array de TimeInput al número de vueltas declarado. Conserva valores al crecer/encoger.
 * Si `lapsCount` no es un entero ≥ 1, deja las filas como están.
 * @param {string[]|undefined|null} rows
 * @param {string|number|null|undefined} lapsCount
 * @param {number} [maxRows]
 * @returns {string[]}
 */
export function resizeLapTimeRows(rows, lapsCount, maxRows = MAX_SESSION_LAP_ROWS) {
  const current = Array.isArray(rows) ? rows.map((v) => String(v ?? '')) : [];
  const n = parseInt(String(lapsCount ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return current;
  const size = Math.min(n, maxRows);
  if (current.length === size) return current;
  if (current.length > size) return current.slice(0, size);
  return current.concat(Array(size - current.length).fill(''));
}

/**
 * Vueltas válidas para POST /timings (mismo contrato que sync): omite vacías e inválidas.
 * Conserva el índice 1-based original como `lap_number`.
 * @param {unknown} texts
 * @returns {Array<{ lap_number: number, time_seconds: number, lap_time_seconds: number, time_text: string }>}
 */
export function buildLapTimesFromTexts(texts) {
  if (!Array.isArray(texts)) return [];
  const out = [];
  texts.forEach((text, idx) => {
    const time_text = String(text ?? '').trim();
    if (!time_text) return;
    const sec = parseLapTimeToSeconds(time_text);
    if (sec == null || sec <= 0) return;
    out.push({
      lap_number: idx + 1,
      time_seconds: sec,
      lap_time_seconds: sec,
      time_text,
    });
  });
  return out;
}

/**
 * Agregados solo si **todas** las filas tienen un tiempo válido (lista completa).
 * @param {unknown} texts
 * @returns {{ bestLapTime: string, totalTime: string, laps: number, averageTime: string } | null}
 */
export function deriveCaptureFromLapTimes(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return null;
  const parsed = [];
  for (const text of texts) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return null;
    const sec = parseLapTimeToSeconds(trimmed);
    if (sec == null || sec <= 0) return null;
    parsed.push(sec);
  }
  const totalSec = parsed.reduce((a, b) => a + b, 0);
  const bestSec = Math.min(...parsed);
  return {
    laps: parsed.length,
    bestLapTime: formatSecondsToLapTime(bestSec),
    totalTime: formatSecondsToLapTime(totalSec),
    averageTime: formatSecondsToLapTime(totalSec / parsed.length),
  };
}

/**
 * Rellena mejor/total/vueltas desde la lista completa sin pisar lo que el usuario ya escribió
 * (salvo valores que salieron de una derivación anterior y no ha tocado).
 * @param {object} prev
 * @param {string[]} lapTimes
 */
export function mergeDerivedLapAggregates(prev, lapTimes) {
  const next = { ...prev, lapTimes };
  const derived = deriveCaptureFromLapTimes(lapTimes);
  if (!derived) return next;

  const last = prev.derivedFromLaps || null;
  const bestEmpty = !String(prev.bestLapTime || '').trim();
  const totalEmpty = !String(prev.totalTime || '').trim();
  const lapsEmpty = !String(prev.laps || '').trim();
  const bestFromUs = Boolean(last && prev.bestLapTime === last.bestLapTime);
  const totalFromUs = Boolean(last && prev.totalTime === last.totalTime);
  const lapsFromUs = Boolean(last && String(prev.laps) === String(last.laps));

  const derivedFromLaps = { ...(last || {}) };
  if (bestEmpty || bestFromUs) {
    next.bestLapTime = derived.bestLapTime;
    derivedFromLaps.bestLapTime = derived.bestLapTime;
  }
  if (totalEmpty || totalFromUs) {
    next.totalTime = derived.totalTime;
    derivedFromLaps.totalTime = derived.totalTime;
  }
  if (lapsEmpty || lapsFromUs) {
    next.laps = String(derived.laps);
    derivedFromLaps.laps = derived.laps;
  }
  next.derivedFromLaps = derivedFromLaps;
  return next;
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
 *   lapTimes?: string[],
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

  const lap_times = buildLapTimesFromTexts(input.lapTimes);
  if (lap_times.length > 0) payload.lap_times = lap_times;

  return payload;
}
