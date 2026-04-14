/**
 * Proxy del sitemap hacia la API Express (Render).
 * Evita un hostname ficticio en vercel.json y usa variables de entorno de Vercel.
 */
function resolveBackendSitemapUrl() {
  const explicit = process.env.SITEMAP_BACKEND_URL;
  if (explicit) return String(explicit).trim();

  const apiUrl = process.env.REACT_APP_API_URL;
  if (!apiUrl) return '';

  try {
    const u = new URL(apiUrl);
    return `${u.origin}/sitemap.xml`;
  } catch {
    return '';
  }
}

module.exports = async function handler(req, res) {
  const target = resolveBackendSitemapUrl();
  if (!target) {
    res.status(503)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .send(
        'Sitemap proxy: define SITEMAP_BACKEND_URL (URL completa al XML) o REACT_APP_API_URL (p. ej. https://api.onrender.com/api) en Vercel.',
      );
    return;
  }

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
