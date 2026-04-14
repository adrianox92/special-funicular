/**
 * Sitemap XML para el sitio público (catálogo). Debe alinearse con
 * `frontend/src/utils/catalogSlug.js` (slug canónico por ítem).
 */
const { createClient } = require('@supabase/supabase-js');

const PAGE_SIZE = 1000;

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

    const supabase = createClient(supabaseUrl, supabaseKey);

    /** @type {{ loc: string, lastmod: string }[]} */
    const urls = [
      { loc: `${origin}/`, lastmod: '' },
      { loc: `${origin}/catalogo`, lastmod: '' },
    ];

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
        const path = `/catalogo/${row.id}/${slug}`;
        const lastmod = toLastmodW3cDate(row.updated_at);
        urls.push({ loc: `${origin}${path}`, lastmod });
      }

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map((u) => {
          const lm = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
          return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lm}\n  </url>`;
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
