import i18n from '../i18n';

/**
 * @param {string|undefined|null} recordedFrom
 * @returns {string|null}
 */
export function getRecordedFromLabel(recordedFrom) {
  if (!recordedFrom) return null;
  const key = `recordedFrom.${recordedFrom}`;
  if (i18n.exists(key, { ns: 'common' })) return i18n.t(key, { ns: 'common' });
  return null;
}

/**
 * @param {string|undefined|null} recordedFrom
 * @returns {boolean}
 */
export function isLapTimerSession(recordedFrom) {
  return recordedFrom === 'lap_timer';
}

export const LABELS = {
  web: 'Web',
  lap_timer: 'App móvil',
  slot_race_manager: 'Slot Race Manager',
  import: 'Importación',
};
