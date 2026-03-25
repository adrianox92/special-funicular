/**
 * Token del bot de Telegram (solo servidor).
 * Render / otros hosts: define TELEGRAM_BOT_TOKEN en el servicio que ejecuta Node (API), no en el frontend estático.
 */

function normalizeToken(raw) {
  if (raw == null) return '';
  let t = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (t.length >= 2) {
    const q = t[0];
    if ((q === '"' || q === "'") && t.endsWith(q)) {
      t = t.slice(1, -1).trim();
    }
  }
  return t;
}

/**
 * @returns {string}
 */
function getTelegramBotTokenFromEnv() {
  const primary = normalizeToken(process.env.TELEGRAM_BOT_TOKEN);
  if (primary) return primary;
  return normalizeToken(process.env.TELEGRAM_TOKEN);
}

function isTelegramBotConfigured() {
  return getTelegramBotTokenFromEnv().length > 0;
}

module.exports = {
  getTelegramBotTokenFromEnv,
  isTelegramBotConfigured,
};
