const { randomBytes } = require('crypto');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Genera un código promocional legible: XXXX-XXXX-XXXX
 * @returns {string}
 */
function generatePromoCode() {
  const bytes = randomBytes(12);
  let raw = '';
  for (let i = 0; i < 12; i += 1) {
    raw += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Normaliza un código introducido por el usuario (ignora espacios y guiones).
 * @param {string} code
 * @returns {string}
 */
function normalizePromoCode(code) {
  return String(code ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

/**
 * Formato canónico con guiones a partir de código normalizado (12 chars).
 * @param {string} normalized
 * @returns {string|null}
 */
function formatPromoCode(normalized) {
  if (!/^[A-Z0-9]{12}$/.test(normalized)) return null;
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
}

module.exports = {
  generatePromoCode,
  normalizePromoCode,
  formatPromoCode,
};
