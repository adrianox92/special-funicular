const MAX_TIME_DIGITS = 7;

/**
 * Formatea la entrada mientras el usuario escribe: extrae dígitos e inserta ':' y '.'.
 * Ej: "3212345" -> "32:12.345"
 */
export function formatTimeOnChange(rawValue) {
  const digits = (rawValue ?? '').replace(/\D/g, '').slice(0, MAX_TIME_DIGITS);
  if (!digits) return '';

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/**
 * Normaliza al salir del campo: rellena minutos (2), segundos (2) y milisegundos (3).
 * Ej: "3:2.1" -> "03:02.100"
 */
export function normalizeTimeOnBlur(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';

  let minutes = '';
  let seconds = '';
  let milliseconds = '';

  if (trimmed.includes(':') || trimmed.includes('.')) {
    const [minPart, rest = ''] = trimmed.split(':');
    const [secPart = '', msPart = ''] = rest.split('.');
    minutes = minPart.replace(/\D/g, '');
    seconds = secPart.replace(/\D/g, '');
    milliseconds = msPart.replace(/\D/g, '');
  } else {
    const digits = trimmed.replace(/\D/g, '').slice(0, MAX_TIME_DIGITS);
    minutes = digits.slice(0, 2);
    seconds = digits.slice(2, 4);
    milliseconds = digits.slice(4, 7);
  }

  return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.${milliseconds.padEnd(3, '0').slice(0, 3)}`;
}
