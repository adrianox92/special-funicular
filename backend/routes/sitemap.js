/**
 * Sitemap XML: índice en /sitemap.xml y hijos chunked.
 *
 * robots.txt apunta a https://slotdatabase.es/sitemap.xml (índice).
 */
const { getAnonClient } = require('../lib/supabaseClients');
const {
  CATALOG_CHUNK_SIZE,
  buildSitemapIndexXml,
  buildStaticSitemapXml,
  buildCatalogChunkXml,
  parseSitemapRequestPath,
} = require('../lib/sitemapBuilder');

const PAGE_SIZE = 1000;

function getPublicSiteOrigin() {
  const raw = process.env.PUBLIC_SITE_ORIGIN;
  if (raw) return String(raw).replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  return '';
}

function sendXml(res, body) {
  res
    .status(200)
    .type('application/xml; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .send(body);
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function sitemapHandler(req, res) {
  (async () => {
    const origin = getPublicSiteOrigin();
    if (!origin) {
      res.status(503).type('text/plain; charset=utf-8').send('PUBLIC_SITE_ORIGIN is not configured');
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      res.status(503).type('text/plain; charset=utf-8').send('Supabase is not configured');
      return;
    }

    const parsed = parseSitemapRequestPath(req.path);
    if (parsed.kind === 'unknown') {
      res.status(404).type('text/plain; charset=utf-8').send('Sitemap not found');
      return;
    }

    const supabase = getAnonClient();

    if (parsed.kind === 'index') {
      const { count, error } = await supabase
        .from('slot_catalog_items_with_ratings')
        .select('id', { count: 'exact', head: true });
      if (error) {
        console.error('[sitemap]', error.message);
        res.status(500).type('text/plain; charset=utf-8').send('Sitemap generation failed');
        return;
      }
      sendXml(res, buildSitemapIndexXml({ origin, itemCount: count ?? 0, chunkSize: CATALOG_CHUNK_SIZE }));
      return;
    }

    if (parsed.kind === 'static') {
      const { data, error } = await supabase
        .from('slot_catalog_brands')
        .select('slug')
        .order('slug', { ascending: true });
      if (error) {
        console.error('[sitemap]', error.message);
        res.status(500).type('text/plain; charset=utf-8').send('Sitemap generation failed');
        return;
      }
      sendXml(res, buildStaticSitemapXml({ origin, brands: data ?? [] }));
      return;
    }

    const chunk = parsed.chunk;
    const from = (chunk - 1) * CATALOG_CHUNK_SIZE;
    const to = from + CATALOG_CHUNK_SIZE - 1;

    const rows = [];
    let pageFrom = from;
    while (pageFrom <= to) {
      const pageTo = Math.min(pageFrom + PAGE_SIZE - 1, to);
      const { data, error } = await supabase
        .from('slot_catalog_items_with_ratings')
        .select('id, model_name, reference, updated_at')
        .order('id', { ascending: true })
        .range(pageFrom, pageTo);

      if (error) {
        console.error('[sitemap]', error.message);
        res.status(500).type('text/plain; charset=utf-8').send('Sitemap generation failed');
        return;
      }
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageTo - pageFrom + 1) break;
      pageFrom += PAGE_SIZE;
    }

    if (rows.length === 0) {
      res.status(404).type('text/plain; charset=utf-8').send('Sitemap chunk is empty');
      return;
    }

    sendXml(res, buildCatalogChunkXml({ origin, rows }));
  })().catch((e) => {
    console.error('[sitemap]', e);
    res.status(500).type('text/plain; charset=utf-8').send('Sitemap generation failed');
  });
}

module.exports = sitemapHandler;
