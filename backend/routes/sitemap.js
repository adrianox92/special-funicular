/**
 * Sitemap XML multilingüe para el sitio público (catálogo).
 */
const { getAnonClient } = require('../lib/supabaseClients');

const PAGE_SIZE = 1000;
const LOCALES = [
  { code: 'es', home: '/', catalog: '/catalogo' },
  { code: 'en', home: '/en', catalog: '/en/catalog' },
  { code: 'de', home: '/de', catalog: '/de/katalog' },
];

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

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toLastmodW3cDate(iso) {
  if (iso == null || iso === '') return '';
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function getPublicSiteOrigin() {
  const raw = process.env.PUBLIC_SITE_ORIGIN;
  if (raw) return String(raw).replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  return '';
}

function catalogItemPaths(itemId, slug) {
  return LOCALES.map((loc) => {
    const base = loc.catalog.replace(/\/$/, '');
    return `${base}/${itemId}/${slug}`;
  });
}

/**
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
function sitemapHandler(_req, res) {
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

    const supabase = getAnonClient();

    /** @type {{ loc: string, lastmod: string, alternates?: { hreflang: string, href: string }[] }[]} */
    const urls = [];

    for (const loc of LOCALES) {
      urls.push({ loc: `${origin}${loc.home}`, lastmod: '' });
      urls.push({ loc: `${origin}${loc.catalog}`, lastmod: '' });
    }

    let from = 0;
    for (;;) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('slot_catalog_items_with_ratings')
        .select('id, model_name, reference, updated_at')
        .order('id', { ascending: true })
        .range(from, to);

      if (error) {
        console.error('[sitemap]', error.message);
        res.status(500).type('text/plain; charset=utf-8').send('Sitemap generation failed');
        return;
      }

      if (!data || data.length === 0) break;

      for (const row of data) {
        const slug = catalogSlugify(row.model_name || row.reference);
        const paths = catalogItemPaths(row.id, slug);
        const lastmod = toLastmodW3cDate(row.updated_at);
        const alternates = paths.map((path, idx) => ({
          hreflang: LOCALES[idx].code,
          href: `${origin}${path}`,
        }));
        alternates.push({
          hreflang: 'x-default',
          href: `${origin}${paths[0]}`,
        });
        paths.forEach((path) => {
          urls.push({ loc: `${origin}${path}`, lastmod, alternates });
        });
      }

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
      urls
        .map((u) => {
          const lm = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
          const alt =
            u.alternates?.map(
              (a) =>
                `\n    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}" />`,
            ).join('') || '';
          return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lm}${alt}\n  </url>`;
        })
        .join('\n') +
      '\n</urlset>';

    res
      .status(200)
      .type('application/xml; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600')
      .send(body);
  })().catch((e) => {
    console.error('[sitemap]', e);
    res.status(500).type('text/plain; charset=utf-8').send('Sitemap generation failed');
  });
}

module.exports = sitemapHandler;
