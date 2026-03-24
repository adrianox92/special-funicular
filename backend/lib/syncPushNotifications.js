const { sendPushToUser } = require('./pushNotifications');
const { bestLapSecondsFromInput } = require('./personalBest');
const { getCircuitRanking } = require('./positionTracker');

function formatLapSeconds(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const sec = Math.floor(s);
  const ms = Math.round((s - sec) * 1000);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function baseAppUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Tras POST /api/sync/timings: récord personal y opcional subida en ranking.
 * @param {object} ctx
 * @param {import('@supabase/supabase-js').SupabaseClient} ctx.supabase
 * @param {string} ctx.userId
 * @param {object} ctx.timingInput - best_lap_time, best_lap_timestamp, vehicle_id, lane, laps
 * @param {string|null} ctx.circuitIdToStore
 * @param {string|null} ctx.circuitNameToStore
 * @param {string} ctx.timingId - id del timing insertado
 * @param {{ model?: string }|null} ctx.vehicleInfo
 * @param {number|null} ctx.previousBestLapSeconds - mínimo histórico antes del INSERT (solo si había circuit_id)
 */
async function notifyAfterSyncTiming(ctx) {
  const {
    userId,
    timingInput,
    circuitIdToStore,
    circuitNameToStore,
    timingId,
    vehicleInfo,
    previousBestLapSeconds,
  } = ctx;

  const newSeconds = bestLapSecondsFromInput(timingInput);
  const vehicleLabel = vehicleInfo?.model ? vehicleInfo.model : 'Tu vehículo';

  if (circuitIdToStore && newSeconds != null) {
    if (previousBestLapSeconds != null && newSeconds < previousBestLapSeconds) {
      const url = `${baseAppUrl()}/vehicles/${timingInput.vehicle_id}`;
      await sendPushToUser(userId, {
        title: 'Nuevo récord personal',
        body: `${vehicleLabel}: ${formatLapSeconds(newSeconds)} en ${circuitNameToStore || 'circuito'} (antes ${formatLapSeconds(previousBestLapSeconds)})`,
        data: {
          type: 'personal_best',
          timing_id: String(timingId),
          vehicle_id: String(timingInput.vehicle_id),
          circuit_id: String(circuitIdToStore),
          url,
        },
      });
    }
  }

  if (circuitNameToStore && timingInput.vehicle_id != null) {
    try {
      const ranking = await getCircuitRanking(circuitNameToStore);
      const laneKey = timingInput.lane ?? null;
      const entry = ranking.find(
        (r) =>
          r.vehicle_id === timingInput.vehicle_id &&
          (r.lane ?? null) === (laneKey === '' ? null : laneKey) &&
          Number(r.laps) === Number(timingInput.laps)
      );

      if (entry && entry.position_change > 0) {
        const url = `${baseAppUrl()}/timings`;
        await sendPushToUser(userId, {
          title: 'Has subido en el ranking',
          body: `${vehicleLabel}: posición ${entry.current_position} en ${circuitNameToStore}`,
          data: {
            type: 'position_up',
            timing_id: String(timingId),
            vehicle_id: String(timingInput.vehicle_id),
            url,
          },
        });
      }
    } catch (e) {
      console.warn('[push] No se pudo evaluar ranking para notificación:', e.message);
    }
  }
}

module.exports = {
  notifyAfterSyncTiming,
  formatLapSeconds,
};
