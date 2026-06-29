'use strict';

const VALID_RECORDED_FROM = new Set(['web', 'lap_timer', 'slot_race_manager', 'import']);

const CLIENT_APP_MAP = {
  'lap-timer': 'lap_timer',
  lap_timer: 'lap_timer',
  'slot-race-manager': 'slot_race_manager',
  slot_race_manager: 'slot_race_manager',
};

/**
 * @param {import('express').Request} req
 * @returns {{ clientApp: string|null, clientVersion: string|null, recordedFrom: string }}
 */
function resolveClientContext(req) {
  const rawApp = req.headers['x-client-app'];
  const clientApp = typeof rawApp === 'string' && rawApp.trim() ? rawApp.trim().toLowerCase() : null;
  const rawVersion = req.headers['x-client-version'];
  const clientVersion = typeof rawVersion === 'string' && rawVersion.trim() ? rawVersion.trim() : null;

  let recordedFrom = 'web';
  if (clientApp && CLIENT_APP_MAP[clientApp]) {
    recordedFrom = CLIENT_APP_MAP[clientApp];
  }

  return { clientApp, clientVersion, recordedFrom };
}

/**
 * @param {string|undefined|null} explicit
 * @param {string} fromHeader
 * @returns {string}
 */
function resolveRecordedFrom(explicit, fromHeader) {
  if (explicit != null && explicit !== '') {
    const v = String(explicit).trim();
    if (VALID_RECORDED_FROM.has(v)) return v;
  }
  return VALID_RECORDED_FROM.has(fromHeader) ? fromHeader : 'web';
}

/**
 * @param {number|null|undefined} previousBestLapSeconds
 * @param {number|null|undefined} currentBestLapSeconds
 * @returns {{ previous_best_lap_seconds: number|null, delta_vs_pb_seconds: number|null, is_personal_best: boolean }}
 */
function buildSyncMeta(previousBestLapSeconds, currentBestLapSeconds) {
  const prev =
    previousBestLapSeconds != null && Number.isFinite(Number(previousBestLapSeconds))
      ? Number(previousBestLapSeconds)
      : null;
  const cur =
    currentBestLapSeconds != null && Number.isFinite(Number(currentBestLapSeconds))
      ? Number(currentBestLapSeconds)
      : null;

  if (cur == null || cur <= 0) {
    return {
      previous_best_lap_seconds: prev,
      delta_vs_pb_seconds: null,
      is_personal_best: false,
    };
  }

  if (prev == null || prev <= 0) {
    return {
      previous_best_lap_seconds: null,
      delta_vs_pb_seconds: null,
      is_personal_best: true,
    };
  }

  const delta = cur - prev;
  return {
    previous_best_lap_seconds: prev,
    delta_vs_pb_seconds: Math.round(delta * 1000) / 1000,
    is_personal_best: cur <= prev,
  };
}

module.exports = {
  VALID_RECORDED_FROM,
  resolveClientContext,
  resolveRecordedFrom,
  buildSyncMeta,
};
