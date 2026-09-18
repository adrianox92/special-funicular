/**
 * Construcción de sitemap índice + hijos (urlset).
 *
 * Convención: cada ítem de catálogo aparece UNA vez (locale ES) con xhtml:link
 * hreflang es/en/de/x-default, para no triplicar el presupuesto de rastreo.
 * Las URLs en/de siguen existiendo y se anuncian como alternativas.
 */

const { catalogSlugify } = require('./catalogSlug');

const LOCALES = [
  { code: 'es', home: '/', catalog: '/catalogo' },
  { code: 'en', home: '/en', catalog: '/en/catalog' },
  { code: 'de', home: '/de', catalog: '/de/katalog' },
];

/** Ítems por hijo sitemap-catalog-N.xml. 2000 (~1.7 MB) es más fiable para Googlebot que 5000 (~4 MB). */
const CATALOG_CHUNK_SIZE = 2000;

/** Host canónico público (apex redirige 307 a www). Sin barra final. */
const CANONICAL_PUBLIC_ORIGIN = 'https://www.slotdatabase.es';
const CANONICAL_PUBLIC_HOSTS = new Set(['www.slotdatabase.es', 'slotdatabase.es']);

/**
 * Origen absoluto para <loc> / hreflang / canonical.
 * Unifica apex `slotdatabase.es` a `https://www.slotdatabase.es` y recorta la barra final.
 * Otros hosts (localhost, previews) se dejan intactos salvo el slash.
 * @param {unknown} raw
 * @returns {string}
 */
function normalizePublicSiteOrigin(raw) {
  const trimmed = String(raw || '')
    .trim()
    .replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    const hostname = url.hostname.toLowerCase();
    if (CANONICAL_PUBLIC_HOSTS.has(hostname)) return CANONICAL_PUBLIC_ORIGIN;
    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
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

function catalogItemPaths(itemId, slug) {
  return LOCALES.map((loc) => {
    const base = loc.catalog.replace(/\/$/, '');
    return `${base}/${itemId}/${slug}`;
  });
}

function hreflangAlternates(origin, paths) {
  const alts = paths.map((path, idx) => ({
    hreflang: LOCALES[idx].code,
    href: `${origin}${path}`,
  }));
  alts.push({ hreflang: 'x-default', href: `${origin}${paths[0]}` });
  return alts;
}

function renderUrlset(urls) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls
      .map((u) => {
        const lm = u.lastmod ? `\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
        const alt =
          u.alternates
            ?.map(
              (a) =>
                `\n    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}" />`,
            )
            .join('') || '';
        return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${lm}${alt}\n  </url>`;
      })
      .join('\n') +
    '\n</urlset>'
  );
}

function catalogChunkCount(itemCount, chunkSize = CATALOG_CHUNK_SIZE) {
  const n = Math.max(0, Number(itemCount) || 0);
  if (n === 0) return 0;
  return Math.ceil(n / chunkSize);
}

/**
 * @param {{ origin: string, itemCount: number, chunkSize?: number }} opts
 */
function buildSitemapIndexXml({ origin, itemCount, chunkSize = CATALOG_CHUNK_SIZE }) {
  const chunks = catalogChunkCount(itemCount, chunkSize);
  const locs = [`${origin}/sitemap-static.xml`];
  for (let i = 1; i <= chunks; i += 1) {
    locs.push(`${origin}/sitemap-catalog-${i}.xml`);
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    locs.map((loc) => `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n  </sitemap>`).join('\n') +
    '\n</sitemapindex>'
  );
}

/**
 * Home + listados de catálogo (raíz y marcas) con hreflang.
 * @param {{ origin: string, brands?: { slug?: string|null }[] }} opts
 */
function buildStaticSitemapXml({ origin, brands = [] }) {
  /** @type {{ loc: string, lastmod: string, alternates?: { hreflang: string, href: string }[] }[]} */
  const urls = [];

  const pushLocalized = (paths) => {
    urls.push({
      loc: `${origin}${paths[0]}`,
      lastmod: '',
      alternates: hreflangAlternates(origin, paths),
    });
  };

  pushLocalized(LOCALES.map((l) => l.home));
  pushLocalized(LOCALES.map((l) => l.catalog));

  const seen = new Set();
  for (const brand of brands) {
    const slug = String(brand?.slug || '')
      .trim()
      .toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    pushLocalized(LOCALES.map((l) => `${l.catalog.replace(/\/$/, '')}/${slug}`));
  }

  return renderUrlset(urls);
}

/**
 * @param {{ origin: string, rows: { id: string, model_name?: string, reference?: string, updated_at?: string }[] }} opts
 */
function buildCatalogChunkXml({ origin, rows }) {
  const urls = [];
  for (const row of rows) {
    const slug = catalogSlugify(row.model_name || row.reference);
    const paths = catalogItemPaths(row.id, slug);
    urls.push({
      loc: `${origin}${paths[0]}`,
      lastmod: toLastmodW3cDate(row.updated_at),
      alternates: hreflangAlternates(origin, paths),
    });
  }
  return renderUrlset(urls);
}

function parseSitemapRequestPath(pathname) {
  const p = String(pathname || '').split('?')[0];
  if (p === '/sitemap.xml') return { kind: 'index' };
  if (p === '/sitemap-static.xml') return { kind: 'static' };
  const m = p.match(/^\/sitemap-catalog-(\d+)\.xml$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n >= 1) return { kind: 'catalog', chunk: n };
  }
  return { kind: 'unknown' };
}

module.exports = {
  LOCALES,
  CATALOG_CHUNK_SIZE,
  CANONICAL_PUBLIC_ORIGIN,
  catalogSlugify,
  catalogChunkCount,
  normalizePublicSiteOrigin,
  buildSitemapIndexXml,
  buildStaticSitemapXml,
  buildCatalogChunkXml,
  parseSitemapRequestPath,
  catalogItemPaths,
  escapeXml,
  toLastmodW3cDate,
};
