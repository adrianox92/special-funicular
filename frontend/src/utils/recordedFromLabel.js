const LABELS = {
  web: 'Web',
  lap_timer: 'App móvil',
  slot_race_manager: 'Slot Race Manager',
  import: 'Importación',
};

/**
 * @param {string|undefined|null} recordedFrom
 * @returns {string|null}
 */
export function getRecordedFromLabel(recordedFrom) {
  if (!recordedFrom) return null;
  return LABELS[recordedFrom] ?? null;
}

/**
 * @param {string|undefined|null} recordedFrom
 * @returns {boolean}
 */
export function isLapTimerSession(recordedFrom) {
  return recordedFrom === 'lap_timer';
}

export { LABELS };
