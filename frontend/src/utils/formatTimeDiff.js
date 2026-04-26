/**
 * Formatea una diferencia de tiempo (en segundos) como cadena mm:ss.mmm o ss.mmm
 * con signo correcto. Evita prefijos incorrectos como "+-" cuando la diferencia
 * es negativa (piloto más rápido que la referencia).
 *
 * @param {number} diffSeconds - Diferencia de tiempo en segundos (puede ser negativa).
 * @returns {string} Diferencia formateada, o "-" cuando la diferencia es exactamente 0.
 */
export function formatTimeDiff(diffSeconds) {
  if (!Number.isFinite(diffSeconds) || diffSeconds === 0) return '-';
  const sign = diffSeconds > 0 ? '+' : '-';
  const abs = Math.abs(diffSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = (abs % 60).toFixed(3);
  return minutes > 0
    ? `${sign}${minutes}:${seconds.padStart(6, '0')}`
    : `${sign}${seconds}`;
}

export default formatTimeDiff;
