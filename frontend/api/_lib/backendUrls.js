/**
 * Resolución de URLs del backend (Render) desde funciones serverless de Vercel.
 */

function getBackendOrigin() {
  const explicit = process.env.SITEMAP_BACKEND_URL;
  if (explicit) {
    try {
      return new URL(String(explicit).trim()).origin;
    } catch {
      /* fall through */
    }
  }
  const apiUrl = process.env.REACT_APP_API_URL;
  if (!apiUrl) return '';
  try {
    return new URL(apiUrl).origin;
  } catch {
    return '';
  }
}

/** Base `/api` (p. ej. https://host.onrender.com/api). */
function getBackendApiBase() {
  const apiUrl = process.env.REACT_APP_API_URL;
  if (apiUrl) return String(apiUrl).replace(/\/$/, '');
  const origin = getBackendOrigin();
  return origin ? `${origin}/api` : '';
}

/**
 * Solo permite el índice y los hijos conocidos (evita open-proxy).
 * @param {string|undefined} name — de /sitemap-:name.xml
 * @returns {string|null} path en el backend, p. ej. /sitemap-catalog-1.xml
 */
function sitemapBackendPath(name) {
  if (!name) return '/sitemap.xml';
  const n = String(name);
  if (n === 'static') return '/sitemap-static.xml';
  if (/^catalog-[1-9]\d*$/.test(n)) return `/sitemap-${n}.xml`;
  return null;
}

module.exports = {
  getBackendOrigin,
  getBackendApiBase,
  sitemapBackendPath,
};
