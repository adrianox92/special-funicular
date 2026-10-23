/** Valores almacenados en API/BD (motor_position). */
export const MOTOR_POSITION_OPTIONS = [
  { value: 'inline', label: 'En línea' },
  { value: 'angular', label: 'Angular' },
  { value: 'transverse', label: 'Transversal' },
];

export function labelMotorPosition(value, t) {
  if (value == null || value === '') return '—';
  if (typeof t === 'function') {
    const translated = t(`values.motorPosition.${value}`, { defaultValue: '' });
    if (translated) return translated;
  }
  const o = MOTOR_POSITION_OPTIONS.find((x) => x.value === value);
  return o ? o.label : String(value);
}
