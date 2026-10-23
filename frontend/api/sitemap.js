/**
 * Proxy del sitemap hacia la API Express (Render).
 * Cubre /sitemap.xml (índice) y /sitemap-static.xml, /sitemap-catalog-N.xml.
 */
const { getBackendOrigin, sitemapBackendPath } = require('./_lib/backendUrls');
const { catalogInternalHeaders, gateCatalogRequest } = require('./_lib/catalogBotGate');

module.exports = async function handler(req, res) {
  const origin = getBackendOrigin();
  if (!origin) {
    res.status(503)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .send(
        'Sitemap proxy: define SITEMAP_BACKEND_URL (URL completa al XML) o REACT_APP_API_URL (p. ej. https://api.onrender.com/api) en Vercel.',
      );
    return;
  }

  const path = sitemapBackendPath(req.query && req.query.name);
  if (!path) {
    res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Sitemap not found');
    return;
  }

  if (path.startsWith('/sitemap-catalog-')) {
    const allowed = await gateCatalogRequest(req, res, { html: false });
    if (!allowed) return;
  }

  const target = `${origin}${path}`;
  const upstreamHeaders = { Accept: 'application/xml, text/xml, */*' };
  if (path.startsWith('/sitemap-catalog-')) {
    Object.assign(upstreamHeaders, catalogInternalHeaders());
  }

  try {
    const upstream = await fetch(target, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });
    const body = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/xml; charset=utf-8';
    res.status(upstream.status).setHeader('Content-Type', ct);
    if (upstream.ok) {
      const cache = path.startsWith('/sitemap-catalog-')
        ? 'private, max-age=300'
        : 'public, s-maxage=3600, stale-while-revalidate=86400';
      res.setHeader('Cache-Control', cache);
    }
    res.send(body);
  } catch (e) {
    console.error('[api/sitemap] fetch failed', target, e);
    res.status(502).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Bad gateway fetching sitemap');
  }
};
