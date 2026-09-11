import { parseLapTimeToSeconds } from '../../utils/averageLapTime';

/**
 * Formato mm:ss.mmm de EditVehicle (ms con Math.floor sobre el decimal).
 * NewSession usa `formatSecondsToLapTime` (redondeo a ms); aquí se conserva
 * el algoritmo original para no cambiar los promedios mostrados en esta pantalla.
 */
function formatSecondsFloor(totalSeconds) {
  const avgMinutes = Math.floor(totalSeconds / 60);
  const avgSeconds = Math.floor(totalSeconds % 60);
  const avgMilliseconds = Math.floor((totalSeconds % 1) * 1000);
  return `${String(avgMinutes).padStart(2, '0')}:${String(avgSeconds).padStart(2, '0')}.${String(avgMilliseconds).padStart(3, '0')}`;
}

/**
 * Promedio = tiempo total / vueltas. Misma fórmula y avisos que el monolito.
 * @param {string} totalTime
 * @param {number|string} laps
 * @param {string} bestLapTime
 * @param {{ t?: Function, setTimingNotice?: Function }} [notice]
 */
export function calculateAverageTime(totalTime, laps, bestLapTime, notice) {
  if (!totalTime || !laps || laps <= 0 || !bestLapTime) return '';

  const totalSeconds = parseLapTimeToSeconds(totalTime);
  const bestLapSeconds = parseLapTimeToSeconds(bestLapTime);

  if (totalSeconds === null || bestLapSeconds === null) return '';

  const setTimingNotice = notice?.setTimingNotice;
  const t = notice?.t;
  const minimumTotalSeconds = bestLapSeconds * laps;
  if (setTimingNotice && t) {
    if (totalSeconds < minimumTotalSeconds) {
      const minimumTime = formatSecondsFloor(minimumTotalSeconds);
      setTimingNotice({
        variant: 'warning',
        message: t('edit.errors.totalTimeTooLow', {
          total: totalTime,
          minimum: minimumTime,
          laps,
          bestLap: bestLapTime,
        }),
      });
    } else {
      setTimingNotice(null);
    }
  }

  return formatSecondsFloor(totalSeconds / laps);
}

export function averageTimeTimestamp(averageTime) {
  return parseLapTimeToSeconds(averageTime);
}
