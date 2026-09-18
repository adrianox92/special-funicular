/**
 * Meta, JSON-LD y HTML crawlable para fichas/listados (SSR).
 * Mantener títulos de ficha alineados con frontend/src/utils/catalogItemSeo.js.
 */

const BRAND = 'Slot Database';

const COPY = {
  es: {
    home: 'Inicio',
    catalog: 'Catálogo',
    prev: 'Anterior',
    next: 'Siguiente',
    name: 'Nombre / modelo',
    brand: 'Marca',
    reference: 'Referencia',
    type: 'Tipo',
    imageFallback: 'Sin imagen en catálogo',
    listTitle: `Catálogo de referencias | ${BRAND}`,
    listLead: 'Modelos de slot catalogados: referencia, marca, tipo y año de comercialización.',
    listDescription: `Catálogo público de coches slot (Scalextric, Ninco, Avant Slot y más). Referencia, especificaciones, imagen y valoraciones en ${BRAND}.`,
    pagePrev: 'Anterior',
    pageNext: 'Siguiente',
    brands: 'Marcas',
    notFoundTitle: `Ítem no encontrado | ${BRAND}`,
    notFoundBody: 'Esta ficha no existe o ya no está en el catálogo público.',
  },
  en: {
    home: 'Home',
    catalog: 'Catalog',
    prev: 'Previous',
    next: 'Next',
    name: 'Name / model',
    brand: 'Brand',
    reference: 'Reference',
    type: 'Type',
    imageFallback: 'No catalog image',
    listTitle: `Reference catalog | ${BRAND}`,
    listLead: 'Catalogued slot cars: reference, brand, type and commercial year.',
    listDescription: `Public slot-car catalog (Scalextric, Ninco, Avant Slot and more). Reference, specs, image and ratings on ${BRAND}.`,
    pagePrev: 'Previous',
    pageNext: 'Next',
    brands: 'Brands',
    notFoundTitle: `Item not found | ${BRAND}`,
    notFoundBody: 'This catalog item does not exist or is no longer public.',
  },
  de: {
    home: 'Start',
    catalog: 'Katalog',
    prev: 'Zurück',
    next: 'Weiter',
    name: 'Name / Modell',
    brand: 'Marke',
    reference: 'Referenz',
    type: 'Typ',
    imageFallback: 'Kein Katalogbild',
    listTitle: `Referenzkatalog | ${BRAND}`,
    listLead: 'Katalogisierte Slotcars: Referenz, Marke, Typ und Erscheinungsjahr.',
    listDescription: `Öffentlicher Slotcar-Katalog (Scalextric, Ninco, Avant Slot und mehr). Referenz, Daten, Bild und Bewertungen auf ${BRAND}.`,
    pagePrev: 'Zurück',
    pageNext: 'Weiter',
    brands: 'Marken',
    notFoundTitle: `Eintrag nicht gefunden | ${BRAND}`,
    notFoundBody: 'Dieser Katalogeintrag existiert nicht oder ist nicht mehr öffentlich.',
  },
};

function copyFor(locale) {
  return COPY[locale] || COPY.es;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(text, max = 158) {
  const t = String(text).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

function truncateTitle(text, max = 72) {
  const t = String(text).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 28 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

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

function buildCatalogItemHeadline(item) {
  const ref = item.reference != null ? String(item.reference).trim() : '';
  const mfg = item.manufacturer != null ? String(item.manufacturer).trim() : '';
  const name = item.model_name != null ? String(item.model_name).trim() : '';
  return [mfg || null, ref || null, name || null].filter(Boolean).join(' · ');
}

function buildCatalogItemPageTitle(item) {
  const core = buildCatalogItemHeadline(item);
  const raw = core ? `${core} | ${BRAND}` : `Catálogo de referencias | ${BRAND}`;
  return truncateTitle(raw, 72);
}

function buildCatalogItemMetaDescription(item) {
  const headline = buildCatalogItemHeadline(item);
  const lead = headline
    ? `${headline}: coche slot; catálogo público ${BRAND}.`
    : `Ficha de coche slot en el catálogo público ${BRAND}.`;
  const parts = [lead];
  const extras = [];
  if (item.vehicle_type) extras.push(`${item.vehicle_type}`);
  if (item.commercial_release_year != null && item.commercial_release_year !== '') {
    extras.push(`año ${item.commercial_release_year}`);
  }
  if (item.traction) extras.push(`tracción ${item.traction}`);
  if (extras.length) parts.push(extras.join(' · ') + '.');
  parts.push(`Referencia, especificaciones, imagen y valoraciones en ${BRAND}.`);
  return truncate(parts.join(' '), 160);
}

function buildCatalogItemImageAlt(item) {
  const ref = item.reference != null ? String(item.reference) : '';
  const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
  const name = item.model_name != null ? String(item.model_name) : '';
  const bits = ['Coche slot', mfg, ref && `ref. ${ref}`, name].filter(Boolean);
  return bits.join(', ');
}

function toIsoDateModified(iso) {
  if (iso == null || iso === '') return '';
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  } catch {
    return '';
  }
}

const OG_LOCALE = { es: 'es_ES', en: 'en_GB', de: 'de_DE' };

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function buildItemJsonLd({ item, origin, canonicalUrl, description, imageUrl }) {
  const homeUrl = `${origin}/`;
  const catalogUrl = `${origin}/catalogo`;
  const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
  const brandListUrl = mfg ? `${origin}/catalogo?manufacturer=${encodeURIComponent(mfg)}` : catalogUrl;
  const headline = buildCatalogItemHeadline(item);
  const modifiedIso = toIsoDateModified(item.updated_at);

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: homeUrl },
      { '@type': 'ListItem', position: 2, name: 'Catálogo de referencias slot', item: catalogUrl },
      ...(mfg
        ? [{ '@type': 'ListItem', position: 3, name: mfg, item: brandListUrl }]
        : []),
      {
        '@type': 'ListItem',
        position: mfg ? 4 : 3,
        name: headline || String(item.model_name ?? item.reference ?? 'Ficha'),
        item: canonicalUrl,
      },
    ],
  };

  const product = {
    '@type': 'Product',
    name: headline || String(item.model_name ?? item.reference ?? 'Coche slot'),
    description,
    sku: item.reference != null ? String(item.reference) : undefined,
    mpn: item.reference != null ? String(item.reference) : undefined,
    url: canonicalUrl,
  };
  if (item.manufacturer) {
    product.brand = { '@type': 'Brand', name: String(item.manufacturer) };
  }
  if (item.vehicle_type) {
    product.category = String(item.vehicle_type);
  }
  if (imageUrl) {
    product.image = [imageUrl];
  }
  if (modifiedIso) {
    product.dateModified = modifiedIso;
  }
  const rc = Number(item.rating_count);
  const avg = Number(item.rating_avg);
  if (Number.isFinite(rc) && rc > 0 && Number.isFinite(avg)) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.round(avg * 10) / 10,
      ratingCount: rc,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return { '@context': 'https://schema.org', '@graph': [breadcrumb, product] };
}

function shellStyles() {
  return (
    '<style id="catalog-ssr-css">' +
    '#catalog-ssr-shell{max-width:52rem;margin:0 auto;padding:1.25rem 1rem 2rem;font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#111}' +
    '#catalog-ssr-shell a{color:#1d4ed8}' +
    '#catalog-ssr-shell h1{font-size:1.75rem;margin:0.5rem 0}' +
    '#catalog-ssr-shell img{max-width:100%;height:auto}' +
    '#catalog-ssr-shell .ssr-nav,#catalog-ssr-shell .ssr-prevnext{display:flex;flex-wrap:wrap;gap:0.75rem 1.25rem;margin:1rem 0}' +
    '#catalog-ssr-shell ul{padding-left:1.2rem}' +
    '</style>'
  );
}

function renderItemBody({ item, locale, origin, slug, neighbors }) {
  const t = copyFor(locale);
  const { catalogItemPath, localizeCatalogPath } = require('./parseCatalogPath');
  const imageUrl = item.image_url && String(item.image_url).trim() ? String(item.image_url) : '';
  const alt = buildCatalogItemImageAlt(item);
  const catalogHref = localizeCatalogPath(locale, '/catalogo');
  const homeHref = locale === 'es' ? '/' : `/${locale}`;

  const prev = neighbors?.prev;
  const next = neighbors?.next;
  const prevSlug = prev ? catalogSlugify(prev.model_name || prev.reference) : '';
  const nextSlug = next ? catalogSlugify(next.model_name || next.reference) : '';

  const img = imageUrl
    ? `<p><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" width="640" height="480" /></p>`
    : `<p>${escapeHtml(t.imageFallback)}</p>`;

  const prevLink = prev
    ? `<a href="${escapeHtml(catalogItemPath(locale, prev.id, prevSlug))}">${escapeHtml(t.prev)}: ${escapeHtml(prev.model_name || prev.reference || prev.id)}</a>`
    : '';
  const nextLink = next
    ? `<a href="${escapeHtml(catalogItemPath(locale, next.id, nextSlug))}">${escapeHtml(t.next)}: ${escapeHtml(next.model_name || next.reference || next.id)}</a>`
    : '';

  const typeRow =
    item.vehicle_type != null && String(item.vehicle_type).trim() !== ''
      ? `<div><dt>${escapeHtml(t.type)}</dt><dd>${escapeHtml(item.vehicle_type)}</dd></div>`
      : '';

  return (
    `<div id="catalog-ssr-shell">` +
    `<nav aria-label="breadcrumb"><a href="${escapeHtml(homeHref)}">${escapeHtml(t.home)}</a> · ` +
    `<a href="${escapeHtml(catalogHref)}">${escapeHtml(t.catalog)}</a></nav>` +
    `<h1>${escapeHtml(item.model_name || item.reference || 'Slot')}</h1>` +
    `<p><span>${escapeHtml(item.manufacturer || '')}</span> · ` +
    `<span>${escapeHtml(item.reference || '')}</span></p>` +
    img +
    `<dl>` +
    `<div><dt>${escapeHtml(t.brand)}</dt><dd>${escapeHtml(item.manufacturer || '')}</dd></div>` +
    `<div><dt>${escapeHtml(t.reference)}</dt><dd>${escapeHtml(item.reference || '')}</dd></div>` +
    `<div><dt>${escapeHtml(t.name)}</dt><dd>${escapeHtml(item.model_name || '')}</dd></div>` +
    typeRow +
    `</dl>` +
    `<nav class="ssr-prevnext" aria-label="${escapeHtml(t.prev)} / ${escapeHtml(t.next)}">${prevLink}${nextLink}</nav>` +
    `</div>`
  );
}

function renderListBody({
  locale,
  items,
  brands,
  page,
  totalPages,
  listPathLocalized,
  queryString,
}) {
  const t = copyFor(locale);
  const { catalogItemPath, localizeCatalogPath } = require('./parseCatalogPath');
  const homeHref = locale === 'es' ? '/' : `/${locale}`;
  const catalogHref = localizeCatalogPath(locale, '/catalogo');

  const lis = (items || [])
    .map((row) => {
      const slug = catalogSlugify(row.model_name || row.reference);
      const href = catalogItemPath(locale, row.id, slug);
      const label = [row.manufacturer, row.reference, row.model_name].filter(Boolean).join(' · ');
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`;
    })
    .join('');

  function pageHref(p) {
    const qs = new URLSearchParams(queryString || '');
    if (p <= 1) qs.delete('page');
    else qs.set('page', String(p));
    const s = qs.toString();
    return s ? `${listPathLocalized}?${s}` : listPathLocalized;
  }

  const prevPage =
    page > 1 ? `<a href="${escapeHtml(pageHref(page - 1))}">${escapeHtml(t.pagePrev)}</a>` : '';
  const nextPage =
    totalPages > page
      ? `<a href="${escapeHtml(pageHref(page + 1))}">${escapeHtml(t.pageNext)}</a>`
      : '';

  const brandLinks = (brands || [])
    .filter((b) => b.slug)
    .slice(0, 80)
    .map((b) => {
      const href = localizeCatalogPath(locale, `/catalogo/${b.slug}`);
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(b.name || b.slug)}</a></li>`;
    })
    .join('');

  return (
    `<div id="catalog-ssr-shell">` +
    `<nav><a href="${escapeHtml(homeHref)}">${escapeHtml(t.home)}</a> · ` +
    `<a href="${escapeHtml(catalogHref)}">${escapeHtml(t.catalog)}</a></nav>` +
    `<h1>${escapeHtml(t.catalog)}</h1>` +
    `<p>${escapeHtml(t.listLead)}</p>` +
    `<ul>${lis}</ul>` +
    `<nav class="ssr-nav">${prevPage}${nextPage}</nav>` +
    (brandLinks ? `<h2>${escapeHtml(t.brands)}</h2><ul>${brandLinks}</ul>` : '') +
    `</div>`
  );
}

function renderNotFoundBody(locale) {
  const t = copyFor(locale);
  const { localizeCatalogPath } = require('./parseCatalogPath');
  const catalogHref = localizeCatalogPath(locale, '/catalogo');
  return (
    `<div id="catalog-ssr-shell">` +
    `<h1>${escapeHtml(t.notFoundTitle)}</h1>` +
    `<p>${escapeHtml(t.notFoundBody)}</p>` +
    `<p><a href="${escapeHtml(catalogHref)}">${escapeHtml(t.catalog)}</a></p>` +
    `</div>`
  );
}

function buildHeadTags({
  locale,
  title,
  description,
  canonicalUrl,
  hreflangs,
  imageUrl,
  imageAlt,
  jsonLd,
  robots,
}) {
  const ogLocale = OG_LOCALE[locale] || OG_LOCALE.es;
  const parts = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${escapeHtml(robots || 'index, follow, max-image-preview:large')}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    ...(hreflangs || []).map(
      (h) =>
        `<link rel="alternate" hreflang="${escapeHtml(h.hreflang)}" href="${escapeHtml(h.href)}" />`,
    ),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="${escapeHtml(ogLocale)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
  ];
  if (imageUrl) {
    parts.push(`<meta property="og:image" content="${escapeHtml(imageUrl)}" />`);
    if (imageAlt) parts.push(`<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`);
  }
  parts.push(`<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />`);
  parts.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  parts.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  if (imageUrl) parts.push(`<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`);
  if (jsonLd) {
    parts.push(
      `<script type="application/ld+json" id="catalog-item-jsonld">${safeJsonLd(jsonLd)}</script>`,
    );
  }
  parts.push(shellStyles());
  return parts.join('\n');
}

/**
 * Inserta head + cuerpo crawlable en el shell CRA, sin user-agent sniffing.
 * React createRoot sustituye #root al hidratar; crawlers sin JS ven el HTML.
 */
function injectIntoSpaHtml(html, { htmlLang, headTags, rootHtml, bootstrapScript }) {
  let out = String(html);
  out = out.replace(/<html\s+lang="[^"]*"/i, `<html lang="${escapeHtml(htmlLang || 'es')}"`);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, '');
  out = out.replace(/<meta\s+name="description"[^>]*>/gi, '');
  out = out.replace(/<meta\s+name="keywords"[^>]*>/gi, '');
  out = out.replace(/<meta\s+name="robots"[^>]*>/gi, '');
  out = out.replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '');
  out = out.replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '');
  out = out.replace(/<link\s+rel="canonical"[^>]*>/gi, '');
  out = out.replace(/<link\s+rel="alternate"\s+hreflang[^>]*>/gi, '');
  out = out.replace('</head>', `${headTags}\n</head>`);
  const boot = bootstrapScript || '';
  if (/<div id="root"><\/div>/.test(out)) {
    out = out.replace(
      '<div id="root"></div>',
      `${boot}<div id="root">${rootHtml}</div>`,
    );
  } else if (/<div id="root">[\s\S]*?<\/div>/.test(out)) {
    out = out.replace(
      /<div id="root">[\s\S]*?<\/div>/,
      `${boot}<div id="root">${rootHtml}</div>`,
    );
  } else {
    out = out.replace('</body>', `${boot}<div id="root">${rootHtml}</div></body>`);
  }
  return out;
}

function fallbackDocument({ htmlLang, headTags, rootHtml, bootstrapScript }) {
  return (
    `<!DOCTYPE html><html lang="${escapeHtml(htmlLang || 'es')}"><head>` +
    `<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `${headTags}</head><body>${bootstrapScript || ''}${rootHtml}</body></html>`
  );
}

module.exports = {
  BRAND,
  COPY,
  copyFor,
  escapeHtml,
  catalogSlugify,
  buildCatalogItemHeadline,
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
};
