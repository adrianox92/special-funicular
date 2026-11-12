/**
 * Imagen de las fichas de catálogo que aún no tienen foto propia.
 * CJS para que SSR (Node) y SPA (webpack) compartan la misma ruta.
 */
const CATALOG_PLACEHOLDER_PATH = '/catalog-placeholder.png';

function catalogPlaceholderUrl(origin) {
  if (!origin) return CATALOG_PLACEHOLDER_PATH;
  return `${String(origin).replace(/\/$/, '')}${CATALOG_PLACEHOLDER_PATH}`;
}

module.exports = {
  __esModule: true,
  CATALOG_PLACEHOLDER_PATH,
  catalogPlaceholderUrl,
};
