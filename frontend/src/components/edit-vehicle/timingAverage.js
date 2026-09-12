import {
  averageTimeTimestamp,
  calculateAverageTime as computeAverageTime,
  getTotalTimeTooLowContext,
} from '../../utils/averageLapTime';

export { averageTimeTimestamp };

/**
 * Promedio de la ficha de vehículo: misma fórmula y redondeo a ms que NewSession.
 * El aviso de total demasiado bajo reutiliza el contexto i18n compartido.
 * @param {string} totalTime
 * @param {number|string} laps
 * @param {string} bestLapTime
 * @param {{ t?: Function, setTimingNotice?: Function }} [notice]
 */
export function calculateAverageTime(totalTime, laps, bestLapTime, notice) {
  const average = computeAverageTime(totalTime, laps, bestLapTime);
  const setTimingNotice = notice?.setTimingNotice;
  const t = notice?.t;
  if (setTimingNotice && t && average) {
    const tooLow = getTotalTimeTooLowContext(totalTime, laps, bestLapTime);
    if (tooLow) {
      setTimingNotice({
        variant: 'warning',
        message: t('edit.errors.totalTimeTooLow', tooLow),
      });
    } else {
      setTimingNotice(null);
    }
  }
  return average;
}
