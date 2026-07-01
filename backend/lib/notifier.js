const { getServiceClient, getServiceOrAnonClient } = require('./supabaseClients');
const { getTelegramBotTokenFromEnv } = require('./telegramEnv');
const { formatSecondsToLapTime } = require('./timingUtils');

function displaySessionTime(textVal, secVal) {
  if (textVal != null && String(textVal).trim() !== '') return String(textVal).trim();
  if (secVal != null && Number(secVal) > 0) {
    const fmt = formatSecondsToLapTime(Number(secVal));
    return fmt != null ? fmt : '—';
  }
  return '—';
}

/**
 * Solo si el coche ha ganado puestos en la clasificación general (position_change > 0).
 * Ignora el centinela 999 que usa positionTracker cuando no había posición previa en BD.
 * @returns {string|null}
 */
/**
 * @param {string|null|undefined} sessionType
 * @returns {string}
 */
function formatSessionTypeLine(sessionType) {
  if (sessionType === 'HEAT') return 'Sesión: manga (campeonato)';
  if (sessionType === 'TRAINING') return 'Sesión: entrenamiento';
  return 'Sesión: no indicada';
}

function formatRankingGainLine(timing) {
  const change = Number(timing.position_change);
  const prev = timing.previous_position;
  const curr = timing.current_position;
  if (!Number.isFinite(change) || change <= 0) return null;
  if (prev == null || Number(prev) >= 999) return null;
  if (curr == null || !Number.isFinite(Number(curr))) return null;
  return `Clasificación general: P${prev} → P${curr} (+${change})`;
}

function getAdminClient() {
  return getServiceClient();
}

/**
 * @param {string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
async function fetchUserMetadata(userId) {
  const admin = getAdminClient();
  if (!admin) return {};
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return {};
  return data.user.user_metadata || {};
}

function formatDeltaVsPb(currentBest, previousBest) {
  if (previousBest == null || !Number.isFinite(Number(previousBest)) || Number(previousBest) <= 0) {
    return 'Primera referencia en este circuito/carril';
  }
  const cur = Number(currentBest);
  const prev = Number(previousBest);
  if (!Number.isFinite(cur)) return '—';
  const d = cur - prev;
  if (d < 0) return `Mejora PB: ${Math.abs(d).toFixed(3)} s`;
  if (d > 0) return `+${d.toFixed(3)} s vs PB anterior`;
  return 'Igual que PB anterior';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} vehicleId
 */
async function fetchVehicleLabel(supabase, vehicleId) {
  const { data } = await supabase.from('vehicles').select('model, manufacturer').eq('id', vehicleId).maybeSingle();
  if (!data) return 'Vehículo';
  return `${data.manufacturer || ''} ${data.model || ''}`.trim() || 'Vehículo';
}

/**
 * @param {string} userId
 * @param {object} timing - fila vehicle_timings tras insert/actualización
 * @param {number|null|undefined} previousBestLapSeconds
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseForVehicle] - cliente con permisos para leer vehicles (mismo que sync)
 */
async function sendTimingNotification(userId, timing, previousBestLapSeconds, supabaseForVehicle) {
  try {
    const meta = await fetchUserMetadata(userId);
    const discordUrl = typeof meta.webhook_discord_url === 'string' ? meta.webhook_discord_url.trim() : '';
    const tgToken = getTelegramBotTokenFromEnv();
    const tgChat = meta.telegram_chat_id != null ? String(meta.telegram_chat_id).trim() : '';

    if (!discordUrl && (!tgToken || !tgChat)) return;

    const supabase = supabaseForVehicle || getServiceOrAnonClient();
    const vehicleLabel = await fetchVehicleLabel(supabase, timing.vehicle_id);

    const best =
      timing.best_lap_time != null && String(timing.best_lap_time).trim() !== ''
        ? String(timing.best_lap_time).trim()
        : timing.best_lap_timestamp != null && Number(timing.best_lap_timestamp) > 0
          ? formatSecondsToLapTime(Number(timing.best_lap_timestamp))
          : '—';
    const totalDisplay = displaySessionTime(timing.total_time, timing.total_time_timestamp);
    const avgDisplay = displaySessionTime(timing.average_time, timing.average_time_timestamp);
    const circuit = timing.circuit || '—';
    const lane = timing.lane != null ? String(timing.lane) : '—';
    const laps = timing.laps != null ? String(timing.laps) : '—';
    const cons =
      timing.consistency_score != null ? `${Number(timing.consistency_score).toFixed(2)}%` : '—';
    const delta = formatDeltaVsPb(timing.best_lap_timestamp, previousBestLapSeconds);

    const lines = [
      '🏁 **Nueva sesión registrada**',
      `Coche: ${vehicleLabel}`,
      formatSessionTypeLine(timing.session_type),
      `Circuito: ${circuit} (carril ${lane})`,
      `Vueltas: ${laps}`,
      `Mejor vuelta: ${best}`,
      `Tiempo total sesión: ${totalDisplay}`,
      `Tiempo medio por vuelta: ${avgDisplay}`,
      `Δ vs PB: ${delta}`,
      `Consistencia: ${cons}`,
    ];
    const rankingLine = formatRankingGainLine(timing);
    if (rankingLine) {
      lines.push(`🏆 ${rankingLine}`);
    }
    const gs = timing.guided_session;
    if (gs && typeof gs === 'object') {
      const lapsOnTarget = gs.laps_on_target != null ? String(gs.laps_on_target) : '—';
      const totalLaps = gs.total_laps != null ? String(gs.total_laps) : null;
      const bestImp =
        gs.best_improvement_ms != null && Number.isFinite(Number(gs.best_improvement_ms))
          ? `${(Number(gs.best_improvement_ms) / 1000).toFixed(3)} s`
          : '—';
      const guidedLine =
        totalLaps != null
          ? `Entrenamiento guiado: ${lapsOnTarget}/${totalLaps} vueltas en objetivo · mejor mejora ${bestImp}`
          : `Entrenamiento guiado: ${lapsOnTarget} vueltas en objetivo · mejor mejora ${bestImp}`;
      lines.push(guidedLine);
    }
    const textPlain = lines
      .map((l) => l.replace(/\*\*/g, ''))
      .join('\n');

    const tasks = [];
    if (discordUrl) {
      tasks.push(
        fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: textPlain.slice(0, 2000) }),
        }).then((r) => {
          if (!r.ok) console.warn('[notifier] Discord webhook HTTP', r.status);
        }),
      );
    }
    if (tgToken && tgChat) {
      const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      tasks.push(
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChat, text: textPlain.slice(0, 4096) }),
        }).then((r) => {
          if (!r.ok) console.warn('[notifier] Telegram HTTP', r.status);
        }),
      );
    }
    await Promise.all(tasks);
  } catch (e) {
    console.warn('[notifier] sendTimingNotification:', e.message);
  }
}

/**
 * Notificaciones de evento en vivo de competición (líder / mejor vuelta).
 * Usa webhooks Discord/Telegram del perfil del organizador si existen.
 * @param {string} userId
 * @param {{
 *   type: 'leader_change' | 'new_pb',
 *   competitionName: string,
 *   driverName: string,
 *   previousLeaderName?: string|null,
 *   bestLapTime?: string|null,
 *   previousBestLapTime?: string|null,
 *   triggerDriverName?: string|null,
 * }} payload
 */
async function sendCompetitionLiveNotification(userId, payload) {
  try {
    const meta = await fetchUserMetadata(userId);
    const discordUrl = typeof meta.webhook_discord_url === 'string' ? meta.webhook_discord_url.trim() : '';
    const tgToken = getTelegramBotTokenFromEnv();
    const tgChat = meta.telegram_chat_id != null ? String(meta.telegram_chat_id).trim() : '';

    if (!discordUrl && (!tgToken || !tgChat)) return;

    const { type, competitionName, driverName } = payload;
    const lines =
      type === 'leader_change'
        ? [
            '🏆 **Cambio de liderato en competición**',
            `Evento: ${competitionName}`,
            `Nuevo líder: ${driverName}`,
            payload.previousLeaderName
              ? `Anterior líder: ${payload.previousLeaderName}`
              : null,
          ].filter(Boolean)
        : [
            '⚡ **Nueva mejor vuelta de la prueba**',
            `Evento: ${competitionName}`,
            `Piloto: ${driverName}`,
            payload.bestLapTime ? `Marca: ${payload.bestLapTime}` : null,
            payload.previousBestLapTime
              ? `Anterior récord: ${payload.previousBestLapTime}`
              : null,
            payload.triggerDriverName && payload.triggerDriverName !== driverName
              ? `Registrado por: ${payload.triggerDriverName}`
              : null,
          ].filter(Boolean);

    const textPlain = lines.map((l) => l.replace(/\*\*/g, '')).join('\n');
    const tasks = [];

    if (discordUrl) {
      tasks.push(
        fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: textPlain.slice(0, 2000) }),
        }).then((r) => {
          if (!r.ok) console.warn('[notifier] Discord webhook HTTP', r.status);
        }),
      );
    }
    if (tgToken && tgChat) {
      const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      tasks.push(
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChat, text: textPlain.slice(0, 4096) }),
        }).then((r) => {
          if (!r.ok) console.warn('[notifier] Telegram HTTP', r.status);
        }),
      );
    }
    await Promise.all(tasks);
  } catch (e) {
    console.warn('[notifier] sendCompetitionLiveNotification:', e.message);
  }
}

async function sendTestNotification(userId) {
  const meta = await fetchUserMetadata(userId);
  const discordUrl = typeof meta.webhook_discord_url === 'string' ? meta.webhook_discord_url.trim() : '';
  const tgToken = getTelegramBotTokenFromEnv();
  const tgChat = meta.telegram_chat_id != null ? String(meta.telegram_chat_id).trim() : '';

  if (!discordUrl && (!tgToken || !tgChat)) {
    const err = new Error(
      tgToken && !tgChat
        ? 'Configura tu Chat ID de Telegram en el perfil, o un webhook de Discord.'
        : !tgToken && tgChat
          ? 'Telegram no está disponible: el servidor no ve TELEGRAM_BOT_TOKEN (en Render debe estar en el Web Service de la API, no en el sitio estático; redeploy tras guardar). Puedes usar Discord webhook.'
          : 'Configura al menos un webhook de Discord o tu Chat ID de Telegram (si el servidor tiene bot configurado).',
    );
    err.code = 'NO_CHANNELS';
    throw err;
  }

  const text = '✅ Prueba de notificación — Scalextric Collection (sync / telemetría).';
  const tasks = [];
  if (discordUrl) {
    tasks.push(
      fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Discord: HTTP ${r.status}`);
      }),
    );
  }
  if (tgToken && tgChat) {
    const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
    tasks.push(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.text();
          throw new Error(`Telegram: HTTP ${r.status} ${body.slice(0, 200)}`);
        }
      }),
    );
  }
  await Promise.all(tasks);
}

/**
 * Informe semanal (Discord/Telegram).
 * @param {string} userId
 * @param {object} digest
 */
async function sendWeeklyDigestNotification(userId, digest) {
  const meta = await fetchUserMetadata(userId);
  const discordUrl = typeof meta.webhook_discord_url === 'string' ? meta.webhook_discord_url.trim() : '';
  const tgToken = getTelegramBotTokenFromEnv();
  const tgChat = meta.telegram_chat_id != null ? String(meta.telegram_chat_id).trim() : '';

  if (!discordUrl && (!tgToken || !tgChat)) {
    const err = new Error(
      'Configura al menos un webhook de Discord o tu Chat ID de Telegram para recibir el resumen.',
    );
    err.code = 'NO_CHANNELS';
    throw err;
  }

  const lines = [
    '📊 **Resumen semanal — Scalextric Collection**',
    `Sesiones (7 días): ${digest.sessionCount ?? 0}`,
  ];
  if (digest.guidedCount > 0) {
    lines.push(`Entrenamientos guiados: ${digest.guidedCount}`);
  }
  if (digest.newPbs?.length) {
    lines.push('', '**Nuevos PB:**');
    digest.newPbs.forEach((pb) => {
      lines.push(`• ${pb.vehicle} — ${pb.circuit} (carril ${pb.lane ?? '—'}): ${pb.time} (−${pb.improvement}s)`);
    });
  }
  if (digest.goals?.length) {
    lines.push('', '**Metas de entrenamiento:**');
    digest.goals.forEach((g) => {
      const label =
        g.goal_type === 'lap_time'
          ? `PB objetivo ${Number(g.target_value).toFixed(3)}s`
          : `Consistencia ≤ ${Number(g.target_value).toFixed(1)}%`;
      const status = g.achieved ? '✅ lograda' : `${g.progressPct ?? 0}%`;
      lines.push(`• ${g.vehicle?.manufacturer ?? ''} ${g.vehicle?.model ?? ''} — ${g.circuit ?? ''}: ${label} (${status})`);
    });
  }
  if (digest.maintenancePending > 0) {
    lines.push('', `⚠️ Mantenimiento pendiente en ${digest.maintenancePending} registro(s) antiguo(s).`);
  }

  const textPlain = lines.map((l) => l.replace(/\*\*/g, '')).join('\n').slice(0, 4096);
  const tasks = [];
  if (discordUrl) {
    tasks.push(
      fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textPlain.slice(0, 2000) }),
      }).then((r) => {
        if (!r.ok) console.warn('[notifier] Discord digest HTTP', r.status);
      }),
    );
  }
  if (tgToken && tgChat) {
    const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
    tasks.push(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: textPlain }),
      }).then((r) => {
        if (!r.ok) console.warn('[notifier] Telegram digest HTTP', r.status);
      }),
    );
  }
  await Promise.all(tasks);
}

module.exports = {
  sendTimingNotification,
  sendCompetitionLiveNotification,
  sendTestNotification,
  sendWeeklyDigestNotification,
  fetchUserMetadata,
};
