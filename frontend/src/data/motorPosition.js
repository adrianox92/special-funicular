/** Valores almacenados en API/BD (motor_position). */
export const MOTOR_POSITION_OPTIONS = [
  { value: 'inline', label: 'En línea' },
  { value: 'angular', label: 'Angular' },
  { value: 'transverse', label: 'Transversal' },
];

export function labelMotorPosition(value) {
  if (value == null || value === '') return '—';
  const o = MOTOR_POSITION_OPTIONS.find((x) => x.value === value);
  return o ? o.label : String(value);
}
