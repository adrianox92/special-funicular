import { getTotalTimeTooLowContext, isValidLapTime } from './averageLapTime';

/**
 * Primer problema de captura, en orden de los campos del formulario.
 * `totalTooLow` no bloquea el guardado (evita callejones); el aviso vive en UI.
 * @param {{
 *   bestLapTime?: string,
 *   totalTime?: string,
 *   laps?: string|number,
 *   supplyVoltageVolts?: string|number,
 * }} capture
 * @returns {{ field: string, code: string, params?: object, openMore?: boolean } | null}
 */
export function getSessionCaptureIssue(capture = {}) {
  const best = String(capture.bestLapTime ?? '').trim();
  const total = String(capture.totalTime ?? '').trim();
  const lapsRaw = String(capture.laps ?? '').trim();
  const lapsN = parseInt(lapsRaw, 10);
  const voltageRaw = String(capture.supplyVoltageVolts ?? '').trim();

  if (!best) return { field: 'bestLapTime', code: 'requiredBest' };
  if (!isValidLapTime(best)) return { field: 'bestLapTime', code: 'invalidBest' };
  if (!total) return { field: 'totalTime', code: 'requiredTotal' };
  if (!isValidLapTime(total)) return { field: 'totalTime', code: 'invalidTotal' };
  if (!lapsRaw) return { field: 'laps', code: 'requiredLaps' };
  if (!Number.isFinite(lapsN) || lapsN < 1) return { field: 'laps', code: 'invalidLaps' };

  if (voltageRaw) {
    const n = parseFloat(voltageRaw.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 30) {
      return { field: 'supplyVoltageVolts', code: 'invalidVoltage', openMore: true };
    }
  }

  const totalTooLow = getTotalTimeTooLowContext(total, lapsN, best);
  if (totalTooLow) {
    return { field: 'totalTime', code: 'totalTooLow', params: totalTooLow };
  }

  return null;
}

export function isBlockingCaptureIssue(issue) {
  return Boolean(issue && issue.code && issue.code !== 'totalTooLow');
}
