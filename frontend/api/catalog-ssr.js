/**
 * SSR del catálogo público: misma HTML para usuarios y crawlers.
 * Reescribe /catalogo, /en/catalog, /de/katalog (ficha o listado) hacia aquí.
 */
const { getBackendApiBase } = require('./_lib/backendUrls');
const {
  parsePublicCatalogPath,
  catalogItemPath,
  hreflangForItem,
  hreflangForList,
  localizeCatalogPath,
  VEHICLE_TYPE_SLUG_TO_LABEL,
  TRACTION_SLUG_TO_LABEL,
} = require('./_lib/parseCatalogPath');
const {
  copyFor,
  catalogSlugify,
  buildCatalogItemPageTitle,
  buildCatalogItemMetaDescription,
  buildCatalogItemImageAlt,
  buildItemJsonLd,
  renderItemBody,
  renderListBody,
  renderNotFoundBody,
  buildHeadTags,
  injectIntoSpaHtml,
  fallbackDocument,
} = require('./_lib/catalogSeoHtml');
const { cachedStorageImageUrl } = require('../src/utils/cachedStorageImageUrl');

const LIST_PAGE_SIZE = 24;
const FETCH_MS = 8000;

/** @type {{ html: string, at: number }|null} */
let spaShellCache = null;
const SPA_SHELL_TTL_MS = 5 * 60 * 1000;

const CANONICAL_PUBLIC_ORIGIN = 'https://www.slotdatabase.es';
const CANONICAL_PUBLIC_HOSTS = new Set(['www.slotdatabase.es', 'slotdatabase.es']);

/** Misma regla que el sitemap: apex → www, sin barra final. */
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

function publicOrigin(req) {
  const fromEnv = process.env.REACT_APP_SITE_URL;
  if (fromEnv) return normalizePublicSiteOrigin(fromEnv);
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.slotdatabase.es';
  return normalizePublicSiteOrigin(`${proto}://${host}`);
}

function originalPathname(req) {
  const candidates = [
    req.headers['x-forwarded-uri'],
    req.headers['x-original-uri'],
    req.headers['x-invoke-path'],
    req.query && req.query.ssrPath,
    req.url,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string' || !raw.startsWith('/')) continue;
    const pathname = raw.split('?')[0];
    if (
      pathname === '/catalogo' ||
      pathname.startsWith('/catalogo/') ||
      pathname === '/en/catalog' ||
      pathname.startsWith('/en/catalog/') ||
      pathname === '/de/katalog' ||
      pathname.startsWith('/de/katalog/')
    ) {
      return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    }
  }
  const q = req.query && req.query.ssrPath;
  if (typeof q === 'string' && q.startsWith('/')) return q.split('?')[0];
  return '/catalogo';
}

function originalSearchParams(req) {
  const params = new URLSearchParams();
  const q = req.query || {};
  for (const [key, value] of Object.entries(q)) {
    if (key === 'ssrPath') continue;
    if (Array.isArray(value)) params.set(key, String(value[0] ?? ''));
    else if (value != null) params.set(key, String(value));
  }
  return params;
}

async function fetchText(url, timeoutMs = FETCH_MS) {
  const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
  const res = await fetch(url, {
    headers: { Accept: 'text/html, application/json, */*' },
    redirect: 'follow',
    signal: ctrl,
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body, contentType: res.headers.get('content-type') || '' };
}

async function getSpaShell(req) {
  const now = Date.now();
  if (spaShellCache && now - spaShellCache.at < SPA_SHELL_TTL_MS) {
    return spaShellCache.html;
  }
  const origin = publicOrigin(req);
  try {
    const { ok, body } = await fetchText(`${origin}/index.html`);
    if (ok && body && body.includes('<div id="root">')) {
      spaShellCache = { html: body, at: now };
      return body;
    }
  } catch (e) {
    console.error('[api/catalog-ssr] index.html fetch failed', e);
  }
  return '';
}

function sendHtml(res, status, html, extraHeaders) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', extraHeaders?.cache || 'public, s-maxage=300, stale-while-revalidate=86400');
  if (extraHeaders?.location) res.setHeader('Location', extraHeaders.location);
  res.send(html);
}

function wrapHtml(spaHtml, payload) {
  if (spaHtml) return injectIntoSpaHtml(spaHtml, payload);
  return fallbackDocument(payload);
}

async function renderItem(req, res, parsed, spaHtml) {
  const origin = publicOrigin(req);
  const apiBase = getBackendApiBase();
  const locale = parsed.locale;
  const t = copyFor(locale);

  if (!apiBase) {
    sendHtml(res, 200, spaHtml || fallbackDocument({
      htmlLang: locale,
      headTags: '<title>Slot Database</title>',
      rootHtml: renderNotFoundBody(locale),
    }));
    return;
  }

  let item = null;
  try {
    const { ok, status, body } = await fetchText(
      `${apiBase}/public/catalog/items/${encodeURIComponent(parsed.id)}`,
    );
    if (status === 404) {
      const canonicalUrl = `${origin}${catalogItemPath(locale, parsed.id, parsed.slug || 'item')}`;
      const headTags = buildHeadTags({
        locale,
        title: t.notFoundTitle,
        description: t.notFoundBody,
        canonicalUrl,
        hreflangs: hreflangForItem(origin, parsed.id, parsed.slug || 'item'),
        robots: 'noindex, follow',
      });
      const html = wrapHtml(spaHtml, {
        htmlLang: locale,
        headTags,
        rootHtml: renderNotFoundBody(locale),
      });
      sendHtml(res, 404, html, { cache: 'public, s-maxage=60' });
      return;
    }
    if (!ok) {
      console.error('[api/catalog-ssr] item fetch', status, body.slice(0, 200));
      sendHtml(res, spaHtml ? 200 : 502, spaHtml || 'Bad gateway');
      return;
    }
    item = JSON.parse(body);
  } catch (e) {
    console.error('[api/catalog-ssr] item fetch failed', e);
    sendHtml(res, spaHtml ? 200 : 502, spaHtml || 'Bad gateway');
    return;
  }

  if (!item?.id) {
    sendHtml(res, 404, spaHtml || 'Not found', { cache: 'public, s-maxage=60' });
    return;
  }

  const slug = catalogSlugify(item.model_name || item.reference);
  if (parsed.slug !== slug) {
    const location = catalogItemPath(locale, item.id, slug);
    res.status(301);
    res.setHeader('Location', location);
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.end();
    return;
  }

  const title = buildCatalogItemPageTitle(item, locale);
  const description = buildCatalogItemMetaDescription(item, locale);
  const canonicalUrl = `${origin}${catalogItemPath(locale, item.id, slug)}`;
  const imageUrl = cachedStorageImageUrl(item.image_url, { origin });
  const imageAlt = buildCatalogItemImageAlt(item, locale);
  const jsonLd = buildItemJsonLd({ item, origin, canonicalUrl, description, imageUrl, locale });
  const neighbors = item.neighbors || { prev: null, next: null };

  const headTags = buildHeadTags({
    locale,
    title,
    description,
    canonicalUrl,
    hreflangs: hreflangForItem(origin, item.id, slug),
    imageUrl: imageUrl || `${origin}/logo512.png`,
    imageAlt: imageUrl ? imageAlt : t.ogImageAlt,
    jsonLd,
  });
  const rootHtml = renderItemBody({ item, locale, origin, slug, neighbors });
  const bootstrapScript = `<script>window.__PUBLIC_CATALOG_BOOTSTRAP__=${JSON.stringify({
    kind: 'item',
    item,
  }).replace(/</g, '\\u003c')};</script>`;

  const html = wrapHtml(spaHtml, {
    htmlLang: locale,
    headTags,
    rootHtml,
    bootstrapScript,
  });
  sendHtml(res, 200, html);
}

async function renderList(req, res, parsed, spaHtml) {
  const origin = publicOrigin(req);
  const apiBase = getBackendApiBase();
  const locale = parsed.locale;
  const t = copyFor(locale);
  const search = originalSearchParams(req);
  const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
  const listPathLocalized = localizeCatalogPath(locale, parsed.listPathEs);
  const qsClean = new URLSearchParams(search);
  if (page <= 1) qsClean.delete('page');
  const canonicalPath = qsClean.toString()
    ? `${listPathLocalized}?${qsClean.toString()}`
    : listPathLocalized;
  const canonicalUrl = `${origin}${canonicalPath}`;

  let items = [];
  let totalPages = 1;
  let total = 0;
  let brands = [];

  if (apiBase) {
    try {
      const apiParams = new URLSearchParams();
      apiParams.set('page', String(page));
      apiParams.set('limit', String(LIST_PAGE_SIZE));
      const filters = parsed.filters || {};
      if (filters.manufacturerSlug) apiParams.set('manufacturer_slug', filters.manufacturerSlug);
      if (filters.vehicleTypeSlug) {
        apiParams.set(
          'vehicle_type',
          VEHICLE_TYPE_SLUG_TO_LABEL[filters.vehicleTypeSlug] || filters.vehicleTypeSlug,
        );
      }
      if (filters.tractionSlug) {
        apiParams.set(
          'traction',
          TRACTION_SLUG_TO_LABEL[filters.tractionSlug] || filters.tractionSlug,
        );
      }
      if (filters.year) apiParams.set('year', String(filters.year));
      if (search.get('q')) apiParams.set('q', search.get('q'));
      if (search.get('motor_position')) apiParams.set('motor_position', search.get('motor_position'));
      if (search.get('sort') && search.get('sort') !== 'manufacturer') {
        apiParams.set('sort', search.get('sort'));
      }

      const [listRes, brandsRes] = await Promise.all([
        fetchText(`${apiBase}/public/catalog/items?${apiParams.toString()}`),
        fetchText(`${apiBase}/public/catalog/brands`),
      ]);
      if (listRes.ok) {
        const data = JSON.parse(listRes.body);
        items = data.items ?? [];
        totalPages = data.totalPages ?? 1;
        total = data.total ?? 0;
      }
      if (brandsRes.ok) {
        const data = JSON.parse(brandsRes.body);
        brands = data.brands ?? [];
      }
    } catch (e) {
      console.error('[api/catalog-ssr] list fetch failed', e);
    }
  }

  const title = t.listTitle;
  const description = t.listDescription;
  const headTags = buildHeadTags({
    locale,
    title,
    description,
    canonicalUrl,
    hreflangs: hreflangForList(origin, parsed.listPathEs),
    imageUrl: `${origin}/logo512.png`,
    imageAlt: t.ogImageAlt,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      numberOfItems: total,
      itemListElement: items.map((row, idx) => ({
        '@type': 'ListItem',
        position: (page - 1) * LIST_PAGE_SIZE + idx + 1,
        url: `${origin}${catalogItemPath(locale, row.id, catalogSlugify(row.model_name || row.reference))}`,
        name: row.model_name || row.reference,
      })),
    },
  });

  const rootHtml = renderListBody({
    locale,
    items,
    brands,
    page,
    totalPages,
    listPathLocalized,
    queryString: search.toString(),
  });
  const bootstrapScript = `<script>window.__PUBLIC_CATALOG_BOOTSTRAP__=${JSON.stringify({
    kind: 'list',
    items,
    total,
    totalPages,
    page,
  }).replace(/</g, '\\u003c')};</script>`;

  const html = wrapHtml(spaHtml, {
    htmlLang: locale,
    headTags,
    rootHtml,
    bootstrapScript,
  });
  sendHtml(res, 200, html);
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).setHeader('Allow', 'GET, HEAD').send('Method Not Allowed');
    return;
  }

  const pathname = originalPathname(req);
  const parsed = parsePublicCatalogPath(pathname);
  const spaHtml = await getSpaShell(req);

  if (parsed.kind === 'item') {
    await renderItem(req, res, parsed, spaHtml);
    return;
  }
  await renderList(req, res, parsed, spaHtml);
};
