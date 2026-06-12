const MAX_TIME_DIGITS = 7;

/**
 * Asigna dígitos de derecha a izquierda: ms (3), segundos (2), minutos (2).
 * Ej: "11324" -> { minutes: "", seconds: "11", milliseconds: "324" }
 */
export function splitTimeDigitsRTL(digits) {
  const d = (digits ?? '').replace(/\D/g, '').slice(0, MAX_TIME_DIGITS);
  if (!d) {
    return { minutes: '', seconds: '', milliseconds: '' };
  }

  const msLen = Math.min(3, d.length);
  const milliseconds = d.slice(-msLen);
  const afterMs = d.slice(0, d.length - msLen);

  const secLen = Math.min(2, afterMs.length);
  const seconds = afterMs.slice(-secLen);
  const minutes = afterMs.slice(0, afterMs.length - secLen);

  return { minutes, seconds, milliseconds };
}

function formatPartsToDisplay({ minutes, seconds, milliseconds }) {
  if (minutes) {
    if (milliseconds) {
      return `${minutes}:${seconds}.${milliseconds}`;
    }
    if (seconds) {
      return `${minutes}:${seconds}`;
    }
    return minutes;
  }

  if (seconds) {
    if (milliseconds) {
      return `${seconds}.${milliseconds}`;
    }
    return seconds;
  }

  return milliseconds;
}

/**
 * Formatea la entrada mientras el usuario escribe: asigna dígitos RTL e inserta separadores.
 * Ej: "11324" -> "11.324", "3212345" -> "32:12.345"
 */
export function formatTimeOnChange(rawValue) {
  const digits = (rawValue ?? '').replace(/\D/g, '').slice(0, MAX_TIME_DIGITS);
  if (!digits) return '';

  return formatPartsToDisplay(splitTimeDigitsRTL(digits));
}

/**
 * Normaliza al salir del campo: rellena minutos (2), segundos (2) y milisegundos (3).
 * Los dígitos se interpretan de derecha a izquierda (ms → ss → mm).
 * Ej: "11.324" -> "00:11.324", "3:2.1" -> "00:03.021"
 */
export function normalizeTimeOnBlur(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '').slice(0, MAX_TIME_DIGITS);
  if (!digits) return '';

  const { minutes, seconds, milliseconds } = splitTimeDigitsRTL(digits);

  return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.${milliseconds.padEnd(3, '0').slice(0, 3)}`;
}
