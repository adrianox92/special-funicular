/**
 * Fragmento de URL para fichas públicas (mismo criterio que frontend/src/utils/catalogSlug.js).
 * @param {unknown} text
 * @returns {string}
 */
function catalogSlugify(text) {
  const s = String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return s || 'item';
}

module.exports = { catalogSlugify };
