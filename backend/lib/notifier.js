const { createClient } = require('@supabase/supabase-js');

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
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

/** Token único del bot de la app (variable de entorno del servidor, no por usuario). */
function getTelegramBotTokenFromEnv() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  return typeof t === 'string' ? t.trim() : '';
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

    const supabase =
      supabaseForVehicle ||
      createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);
    const vehicleLabel = await fetchVehicleLabel(supabase, timing.vehicle_id);

    const best = timing.best_lap_time || timing.best_lap_timestamp;
    const circuit = timing.circuit || '—';
    const lane = timing.lane != null ? String(timing.lane) : '—';
    const laps = timing.laps != null ? String(timing.laps) : '—';
    const cons =
      timing.consistency_score != null ? `${Number(timing.consistency_score).toFixed(2)}%` : '—';
    const delta = formatDeltaVsPb(timing.best_lap_timestamp, previousBestLapSeconds);

    const lines = [
      '🏁 **Nueva sesión registrada**',
      `Coche: ${vehicleLabel}`,
      `Circuito: ${circuit} (carril ${lane})`,
      `Vueltas: ${laps}`,
      `Mejor vuelta: ${best}`,
      `Δ vs PB: ${delta}`,
      `Consistencia: ${cons}`,
    ];
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
          ? 'Telegram no está disponible: el administrador debe definir TELEGRAM_BOT_TOKEN en el servidor. Puedes usar Discord webhook.'
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

module.exports = {
  sendTimingNotification,
  sendTestNotification,
  fetchUserMetadata,
};
