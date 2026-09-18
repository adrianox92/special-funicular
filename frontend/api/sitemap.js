/**
 * Proxy del sitemap hacia la API Express (Render).
 * Cubre /sitemap.xml (índice) y /sitemap-static.xml, /sitemap-catalog-N.xml.
 */
const { getBackendOrigin, sitemapBackendPath } = require('./_lib/backendUrls');

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

  const target = `${origin}${path}`;

  try {
    const upstream = await fetch(target, {
      headers: { Accept: 'application/xml, text/xml, */*' },
      redirect: 'follow',
    });
    const body = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/xml; charset=utf-8';
    res.status(upstream.status).setHeader('Content-Type', ct);
    if (upstream.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    }
    res.send(body);
  } catch (e) {
    console.error('[api/sitemap] fetch failed', target, e);
    res.status(502).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Bad gateway fetching sitemap');
  }
};
