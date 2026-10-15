/**
 * URLs de imagen en el catálogo público: reescribe Storage a /api/img en el origen
 * canónico. No se usa en /api/sync/* ni en escrituras admin (la BD sigue con la
 * URL pública de Storage).
 */
const {
  rewritePublicCatalogMediaUrls,
} = require('../../frontend/src/utils/cachedStorageImageUrl');
const { normalizePublicSiteOrigin } = require('./sitemapBuilder');

const DEFAULT_PUBLIC_IMAGE_ORIGIN = 'https://www.slotdatabase.es';

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string} origen sin barra final
 */
function publicImageOrigin(env = process.env) {
  const raw = env.PUBLIC_IMAGE_ORIGIN || env.PUBLIC_SITE_ORIGIN || '';
  if (raw && String(raw).trim()) {
    return normalizePublicSiteOrigin(raw) || DEFAULT_PUBLIC_IMAGE_ORIGIN;
  }
  return DEFAULT_PUBLIC_IMAGE_ORIGIN;
}

function rewritePublicCatalogResponse(payload, env = process.env) {
  return rewritePublicCatalogMediaUrls(payload, { origin: publicImageOrigin(env) });
}

module.exports = {
  DEFAULT_PUBLIC_IMAGE_ORIGIN,
  publicImageOrigin,
  rewritePublicCatalogResponse,
};
