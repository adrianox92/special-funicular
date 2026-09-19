/**
 * Copy y builders SEO del catálogo público (ES/EN/DE).
 * CJS para que SSR (Node) y SPA (webpack) compartan la misma fuente.
 */
const BRAND = 'Slot Database';

const PACKS = {
  es: require('../i18n/locales/es/catalog.json'),
  en: require('../i18n/locales/en/catalog.json'),
  de: require('../i18n/locales/de/catalog.json'),
};

function normalizeLocale(raw) {
  const base = String(raw || 'es').toLowerCase().split('-')[0];
  return PACKS[base] ? base : 'es';
}

function packFor(locale) {
  return PACKS[normalizeLocale(locale)] || PACKS.es;
}

function seoFor(locale) {
  return packFor(locale).seo;
}

function interpolate(template, vars = {}) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : '',
  );
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

function plural(seo, base, count, vars = {}) {
  const key = count === 1 ? `${base}_one` : `${base}_other`;
  const tpl = seo[key] || seo[`${base}_other`] || seo[base] || '';
  return interpolate(tpl, { count, ...vars });
}

function labelMotorForMeta(seo, value) {
  if (value == null || value === '') return '';
  const labels = seo.motorLabels || {};
  return labels[value] || String(value);
}

function buildCatalogItemHeadline(item) {
  const ref = item.reference != null ? String(item.reference).trim() : '';
  const mfg = item.manufacturer != null ? String(item.manufacturer).trim() : '';
  const name = item.model_name != null ? String(item.model_name).trim() : '';
  return [mfg || null, ref || null, name || null].filter(Boolean).join(' · ');
}

function copyChrome(locale) {
  const seo = seoFor(locale);
  return {
    home: seo.home,
    catalog: seo.catalog,
    prev: seo.pagePrev,
    next: seo.pageNext,
    name: seo.name,
    brand: seo.brand,
    reference: seo.reference,
    type: seo.type,
    imageFallback: seo.imageFallback,
    listTitle: interpolate(seo.listTitle, { brand: BRAND }),
    listLead: seo.listLead,
    listDescription: interpolate(seo.listDescription, { brand: BRAND }),
    pagePrev: seo.pagePrev,
    pageNext: seo.pageNext,
    brands: seo.brands,
    notFoundTitle: interpolate(seo.notFoundTitle, { brand: BRAND }),
    notFoundBody: seo.notFoundBody,
    ogImageAlt: interpolate(seo.ogImageAlt, { brand: BRAND }),
  };
}

function buildCatalogItemPageTitle(item, locale = 'es') {
  const seo = seoFor(locale);
  const core = buildCatalogItemHeadline(item);
  const raw = core ? `${core} | ${BRAND}` : interpolate(seo.listTitle, { brand: BRAND });
  return truncateTitle(raw, 72);
}

function catalogMetaExtras(item, seo, { includeRating = true } = {}) {
  const extras = [];
  if (item.vehicle_type) extras.push(`${item.vehicle_type}`);
  if (item.commercial_release_year != null && item.commercial_release_year !== '') {
    extras.push(interpolate(seo.year, { year: item.commercial_release_year }));
  }
  if (item.traction) extras.push(interpolate(seo.traction, { traction: item.traction }));
  if (item.discontinued) extras.push(seo.discontinued);
  if (item.upcoming_release) extras.push(seo.upcoming);
  const motor = labelMotorForMeta(seo, item.motor_position);
  if (motor) extras.push(interpolate(seo.motor, { position: String(motor).toLowerCase() }));
  if (includeRating) {
    const rc = Number(item.rating_count);
    if (Number.isFinite(rc) && rc > 0 && item.rating_avg != null) {
      const avg = Number(item.rating_avg);
      if (Number.isFinite(avg)) {
        extras.push(interpolate(seo.ratingAvg, { avg: avg.toFixed(1), count: rc }));
      }
    }
  }
  return extras;
}

function buildCatalogItemMetaDescription(item, locale = 'es') {
  const seo = seoFor(locale);
  const headline = buildCatalogItemHeadline(item);
  const lead = headline
    ? interpolate(seo.leadWithHeadline, { headline, brand: BRAND })
    : interpolate(seo.leadWithoutHeadline, { brand: BRAND });
  const parts = [lead];
  const extras = catalogMetaExtras(item, seo, { includeRating: true });
  if (extras.length) parts.push(extras.join(' · ') + '.');
  parts.push(interpolate(seo.footer, { brand: BRAND }));
  return truncate(parts.join(' '), 160);
}

function buildCatalogItemImageAlt(item, locale = 'es') {
  const seo = seoFor(locale);
  const ref = item.reference != null ? String(item.reference) : '';
  const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
  const name = item.model_name != null ? String(item.model_name) : '';
  const bits = [
    seo.imageAltPrefix,
    mfg,
    ref && interpolate(seo.refAbbrev, { ref }),
    name,
  ].filter(Boolean);
  return bits.join(', ');
}

function buildCatalogItemLeadParagraph(item, locale = 'es') {
  const seo = seoFor(locale);
  const headline = buildCatalogItemHeadline(item);
  const parts = [
    headline
      ? interpolate(seo.paragraphWithHeadline, { headline, brand: BRAND })
      : interpolate(seo.paragraphWithoutHeadline, { brand: BRAND }),
  ];
  const extras = [];
  if (item.vehicle_type) extras.push(String(item.vehicle_type));
  if (item.commercial_release_year != null && item.commercial_release_year !== '') {
    extras.push(interpolate(seo.paragraphYear, { year: item.commercial_release_year }));
  }
  if (item.traction) extras.push(interpolate(seo.traction, { traction: item.traction }));
  if (item.discontinued) extras.push(seo.discontinued);
  if (item.upcoming_release) extras.push(seo.upcoming);
  const motor = labelMotorForMeta(seo, item.motor_position);
  if (motor) extras.push(interpolate(seo.motor, { position: String(motor).toLowerCase() }));
  const rc = Number(item.rating_count);
  if (Number.isFinite(rc) && rc > 0 && item.rating_avg != null) {
    const avg = Number(item.rating_avg);
    if (Number.isFinite(avg)) {
      extras.push(plural(seo, 'paragraphRating', rc, { avg: avg.toFixed(1) }));
    }
  }
  if (extras.length) {
    parts.push(interpolate(seo.paragraphData, { extras: extras.join('; ') }));
  }
  parts.push(interpolate(seo.paragraphFooter, { brand: BRAND }));
  return truncate(parts.join(' '), 420);
}

function buildCatalogItemKeywords(item, locale = 'es') {
  const seo = seoFor(locale);
  const bits = [seo.keywords];
  if (item.reference) bits.push(String(item.reference));
  if (item.manufacturer) bits.push(String(item.manufacturer));
  if (item.model_name) bits.push(String(item.model_name));
  if (item.vehicle_type) bits.push(String(item.vehicle_type));
  if (item.reference && item.manufacturer) {
    bits.push(`${item.reference} ${item.manufacturer}`);
  }
  return bits.join(', ');
}

function buildPublicCatalogListMeta(filters = {}, locale = 'es') {
  const seo = seoFor(locale);
  const { manufacturerName, vehicleTypeLabel, tractionLabel, year, total } = filters;
  const parts = [manufacturerName, vehicleTypeLabel, tractionLabel, year ? String(year) : null].filter(
    Boolean,
  );
  const titleSuffix = parts.length ? parts.join(' · ') : null;
  const listTitle = titleSuffix
    ? `${titleSuffix} | ${BRAND}`
    : interpolate(seo.listTitle, { brand: BRAND });
  const footer = interpolate(seo.footer, { brand: BRAND });
  const countText =
    total != null ? plural(seo, 'model', total) : seo.modelsFallback;
  const filterText = parts.length ? interpolate(seo.listFilterJoin, { parts: parts.join(', ') }) : '';
  const listDescription = parts.length
    ? truncate(interpolate(seo.listFiltered, { filterText, countText, footer }), 158)
    : truncate(interpolate(seo.listDescription, { brand: BRAND }), 158);
  return {
    title: truncateTitle(listTitle, 72),
    description: listDescription,
    keywords: seo.keywords,
    ogImageAlt: interpolate(seo.ogImageAlt, { brand: BRAND }),
  };
}

function homePathForLocale(locale) {
  const loc = normalizeLocale(locale);
  return loc === 'es' ? '/' : `/${loc}`;
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

/**
 * @param {object} opts
 * @param {object} opts.item
 * @param {string} opts.origin
 * @param {string} opts.canonicalUrl
 * @param {string} opts.description
 * @param {string} [opts.imageUrl]
 * @param {string} [opts.locale]
 * @param {string} [opts.catalogUrl]
 * @param {string} [opts.homeUrl]
 * @param {string} [opts.brandListUrl]
 */
function buildItemJsonLd({
  item,
  origin,
  canonicalUrl,
  description,
  imageUrl,
  locale = 'es',
  catalogUrl,
  homeUrl,
  brandListUrl,
}) {
  const seo = seoFor(locale);
  const loc = normalizeLocale(locale);
  const resolvedHome = homeUrl || `${origin}${homePathForLocale(loc)}`;
  const resolvedCatalog = catalogUrl || `${origin}${loc === 'es' ? '/catalogo' : loc === 'en' ? '/en/catalog' : '/de/katalog'}`;
  const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
  const resolvedBrandList = brandListUrl || (mfg ? `${resolvedCatalog}?manufacturer=${encodeURIComponent(mfg)}` : resolvedCatalog);
  const headline = buildCatalogItemHeadline(item);
  const modifiedIso = toIsoDateModified(item.updated_at);

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: seo.home, item: resolvedHome },
      { '@type': 'ListItem', position: 2, name: seo.catalogBreadcrumb, item: resolvedCatalog },
      ...(mfg
        ? [{ '@type': 'ListItem', position: 3, name: mfg, item: resolvedBrandList }]
        : []),
      {
        '@type': 'ListItem',
        position: mfg ? 4 : 3,
        name: headline || String(item.model_name ?? item.reference ?? seo.itemFallback),
        item: canonicalUrl,
      },
    ],
  };

  const product = {
    '@type': 'Product',
    name: headline || String(item.model_name ?? item.reference ?? seo.slotCar),
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

module.exports = {
  BRAND,
  PACKS,
  normalizeLocale,
  packFor,
  seoFor,
  interpolate,
  truncate,
  truncateTitle,
  copyChrome,
  buildCatalogItemHeadline,
  buildCatalogItemPageTitle,
  buildCatalogItemMetaDescription,
  buildCatalogItemImageAlt,
  buildCatalogItemLeadParagraph,
  buildCatalogItemKeywords,
  buildPublicCatalogListMeta,
  buildItemJsonLd,
  homePathForLocale,
  toIsoDateModified,
};
