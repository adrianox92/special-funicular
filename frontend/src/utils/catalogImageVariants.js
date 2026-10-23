/**
 * Variantes de imagen de catálogo: el original (hasta 1400px) y un sibling `-thumb`
 * (hasta 400px) subido junto a él. Los listados deben usar el thumb.
 *
 * CJS para SPA y SSR.
 */

const THUMB_EDGE_PX = 400;
const DETAIL_EDGE_PX = 1400;

function withThumbSuffix(pathOrUrl) {
  const s = String(pathOrUrl || '');
  if (!s) return s;
  if (/-thumb\.[A-Za-z0-9]+(\?[^/]*)?$/.test(s)) return s;
  return s.replace(/(\.[A-Za-z0-9]+)(\?[^/]*)?$/, '-thumb$1$2');
}

function isThumbPath(pathOrUrl) {
  return /-thumb\.[A-Za-z0-9]+(\?[^/]*)?$/.test(String(pathOrUrl || ''));
}

function catalogThumbUrl(rawUrl) {
  if (rawUrl == null) return '';
  const s = String(rawUrl).trim();
  if (!s) return '';
  return withThumbSuffix(s);
}

module.exports = {
  __esModule: true,
  THUMB_EDGE_PX,
  DETAIL_EDGE_PX,
  withThumbSuffix,
  isThumbPath,
  catalogThumbUrl,
};
