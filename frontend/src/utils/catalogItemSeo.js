/**
 * Meta description y Open Graph para fichas del catálogo público (SEO).
 */
import i18n from '../i18n';
import { SUPPORTED_LOCALES, localizePath, toOgLocale, getOgLocaleAlternates } from '../i18n/localeUtils';
import { LANDING_PAGE_DESCRIPTION, LANDING_PAGE_TITLE } from './landingSeo';
import { BRAND } from './documentTitle';
import { catalogSlugify } from './catalogSlug';
import {
  buildCatalogItemHeadline,
  buildCatalogItemImageAlt as buildCatalogItemImageAltLocalized,
  buildCatalogItemPageTitle as buildCatalogItemPageTitleLocalized,
  buildCatalogItemMetaDescription as buildCatalogItemMetaDescriptionLocalized,
  buildCatalogItemLeadParagraph as buildCatalogItemLeadParagraphLocalized,
  buildCatalogItemKeywords as buildCatalogItemKeywordsLocalized,
  buildPublicCatalogListMeta,
  buildItemJsonLd,
  seoFor,
  interpolate,
  toIsoDateModified,
} from './catalogSeoCopy';

function currentLocale() {
  return i18n.language?.split('-')[0] || 'es';
}

function setMeta(attrName, value, isProperty) {
  if (value == null || value === '') return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${attrName}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, attrName);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/** Quita una meta añadida solo en ficha de catálogo (evita arrastrarla al resto de rutas). */
function removeMeta(attrName, isProperty) {
  const attr = isProperty ? 'property' : 'name';
  const el = document.querySelector(`meta[${attr}="${attrName}"]`);
  if (el) el.remove();
}

function getOrigin() {
  const fromEnv = typeof process !== 'undefined' && process.env.REACT_APP_SITE_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}

/**
 * Texto alternativo coherente para la imagen del modelo (accesibilidad + SEO de imagen).
 * @param {Record<string, unknown>} item
 * @param {string} [locale]
 */
export function buildCatalogItemImageAlt(item, locale = currentLocale()) {
  return buildCatalogItemImageAltLocalized(item, locale);
}

/**
 * Título del documento: marca · referencia · modelo | Slot Database.
 * @param {Record<string, unknown>} item
 * @param {string} [locale]
 */
export function buildCatalogItemPageTitle(item, locale = currentLocale()) {
  return buildCatalogItemPageTitleLocalized(item, locale);
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} [locale]
 */
export function buildCatalogItemMetaDescription(item, locale = currentLocale()) {
  return buildCatalogItemMetaDescriptionLocalized(item, locale);
}

/**
 * Párrafo introductorio visible en la ficha pública (no es meta description).
 * @param {Record<string, unknown>} item
 * @param {string} [locale]
 */
export function buildCatalogItemLeadParagraph(item, locale = currentLocale()) {
  return buildCatalogItemLeadParagraphLocalized(item, locale);
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} [locale]
 */
export function buildCatalogItemKeywords(item, locale = currentLocale()) {
  return buildCatalogItemKeywordsLocalized(item, locale);
}

/**
 * Meta del listado /catalogo — acepta filtros activos para componer título y canonical SEO-friendly.
 *
 * @param {object} [filters]
 * @param {string|null}  filters.manufacturerName   — nombre legible de la marca (no slug)
 * @param {string|null}  filters.vehicleTypeLabel   — etiqueta del tipo
 * @param {string|null}  filters.tractionLabel      — etiqueta de la tracción
 * @param {number|null}  filters.year
 * @param {number|null}  filters.total              — número de resultados
 * @param {string|null}  filters.canonicalPath      — path ya localizado
 * @param {string}       [filters.locale]
 */
export function applyPublicCatalogListSeo(filters = {}) {
  const locale = filters.locale || currentLocale();
  const { manufacturerName, vehicleTypeLabel, tractionLabel, year, total, canonicalPath } = filters;
  const origin = getOrigin();
  const seo = seoFor(locale);
  const { title: listTitle, description: listDescription, keywords } = buildPublicCatalogListMeta(
    { manufacturerName, vehicleTypeLabel, tractionLabel, year, total },
    locale,
  );

  document.title = listTitle;

  const canonicalUrl = origin
    ? `${origin}${canonicalPath || localizePath(locale, '/catalogo')}`
    : '';

  setMeta('description', listDescription, false);
  setMeta('keywords', keywords, false);
  setMeta('og:type', 'website', true);
  setMeta('og:locale', toOgLocale(locale), true);
  getOgLocaleAlternates(locale).forEach((alt) => setMeta('og:locale:alternate', alt, true));
  setMeta('og:site_name', BRAND, true);
  setMeta('og:title', listTitle, true);
  setMeta('og:description', listDescription, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);
  const logoUrl = origin ? `${origin}/logo512.png` : '';
  if (logoUrl) {
    setMeta('og:image', logoUrl, true);
    setMeta('og:image:width', '512', true);
    setMeta('og:image:height', '512', true);
    setMeta('og:image:alt', interpolate(seo.ogImageAlt, { brand: BRAND }), true);
  }
  setMeta('twitter:card', 'summary_large_image', false);
  setMeta('twitter:title', listTitle, false);
  setMeta('twitter:description', listDescription, false);
  if (logoUrl) setMeta('twitter:image', logoUrl, false);

  let linkCanonical = document.querySelector('link[rel="canonical"]');
  if (canonicalUrl) {
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);
  }
}

function removeHreflangLinks() {
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
}

function setCatalogHreflang(itemId, slug) {
  const origin = getOrigin();
  if (!origin || !itemId) return;
  removeHreflangLinks();
  const suffix = `/${itemId}/${slug}`;
  SUPPORTED_LOCALES.forEach((loc) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = loc === 'es' ? 'es' : loc;
    link.href = `${origin}${localizePath(loc, `/catalogo${suffix}`)}`;
    document.head.appendChild(link);
  });
  const xDefault = document.createElement('link');
  xDefault.rel = 'alternate';
  xDefault.hreflang = 'x-default';
  xDefault.href = `${origin}/catalogo${suffix}`;
  document.head.appendChild(xDefault);
}

/**
 * @param {Record<string, unknown>} item — fila de slot_catalog_items / vista con rating_avg, etc.
 */
export function applyCatalogItemPageSeo(item) {
  if (!item?.id) return;

  const locale = currentLocale();
  const slug = catalogSlugify(item.model_name || item.reference);
  const title = buildCatalogItemPageTitle(item, locale);
  document.title = title;

  const description = buildCatalogItemMetaDescription(item, locale);
  const keywords = buildCatalogItemKeywords(item, locale);
  const origin = getOrigin();
  const canonicalUrl = origin ? `${origin}${localizePath(locale, `/catalogo/${item.id}/${slug}`)}` : '';
  const imageAlt = buildCatalogItemImageAlt(item, locale);
  const seo = seoFor(locale);
  const modifiedIso = toIsoDateModified(item.updated_at);

  setMeta('description', description, false);
  setMeta('keywords', keywords, false);
  setMeta('robots', 'index, follow, max-image-preview:large', false);

  setMeta('og:type', 'website', true);
  setMeta('og:locale', toOgLocale(locale), true);
  getOgLocaleAlternates(locale).forEach((alt) => setMeta('og:locale:alternate', alt, true));
  setMeta('og:site_name', BRAND, true);
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);
  if (modifiedIso) setMeta('article:modified_time', modifiedIso, true);

  const imageUrl = item.image_url && String(item.image_url).trim() ? String(item.image_url) : '';
  if (imageUrl) {
    setMeta('og:image', imageUrl, true);
    setMeta('og:image:alt', imageAlt, true);
  } else {
    const logoUrl = origin ? `${origin}/logo512.png` : '';
    if (logoUrl) {
      setMeta('og:image', logoUrl, true);
      setMeta('og:image:width', '512', true);
      setMeta('og:image:height', '512', true);
      setMeta('og:image:alt', interpolate(seo.ogImageAlt, { brand: BRAND }), true);
    }
  }

  setMeta('twitter:card', imageUrl ? 'summary_large_image' : 'summary', false);
  setMeta('twitter:title', title, false);
  setMeta('twitter:description', description, false);
  if (imageUrl) setMeta('twitter:image', imageUrl, false);
  else {
    const logoUrl = origin ? `${origin}/logo512.png` : '';
    if (logoUrl) setMeta('twitter:image', logoUrl, false);
  }

  let linkCanonical = document.querySelector('link[rel="canonical"]');
  if (canonicalUrl) {
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);
  }

  setCatalogHreflang(item.id, slug);

  const existing = document.getElementById('catalog-item-jsonld');
  if (existing) existing.remove();

  if (origin && canonicalUrl) {
    const script = document.createElement('script');
    script.id = 'catalog-item-jsonld';
    script.type = 'application/ld+json';
    const homeUrl = `${origin}${locale === 'es' ? '/' : `/${locale}`}`;
    const catalogUrl = `${origin}${localizePath(locale, '/catalogo')}`;
    const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
    const brandListUrl = mfg
      ? `${origin}${localizePath(locale, '/catalogo')}?manufacturer=${encodeURIComponent(mfg)}`
      : catalogUrl;

    const jsonLd = buildItemJsonLd({
      item,
      origin,
      canonicalUrl,
      description,
      imageUrl,
      locale,
      catalogUrl,
      homeUrl,
      brandListUrl,
    });
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

/** Restaura metas sociales al salir de la ficha (no toca document.title: lo pone App). */
export function clearCatalogItemPageSeo() {
  removeMeta('article:modified_time', true);
  removeMeta('og:image:alt', true);
  removeMeta('og:site_name', true);
  removeMeta('og:locale', true);
  const locale = currentLocale();
  const seo = seoFor(locale);
  setMeta('description', LANDING_PAGE_DESCRIPTION, false);
  setMeta('keywords', seo.keywords, false);
  setMeta('robots', 'index, follow', false);
  setMeta('og:type', 'website', true);
  setMeta('og:title', LANDING_PAGE_TITLE, true);
  setMeta('og:description', LANDING_PAGE_DESCRIPTION, true);
  const origin = getOrigin();
  const homeUrl = origin ? `${origin}/` : '';
  if (homeUrl) setMeta('og:url', homeUrl, true);
  const logoUrl = origin ? `${origin}/logo512.png` : '';
  if (logoUrl) {
    setMeta('og:image', logoUrl, true);
    setMeta('og:image:width', '512', true);
    setMeta('og:image:height', '512', true);
  }
  setMeta('twitter:card', 'summary_large_image', false);
  setMeta('twitter:title', LANDING_PAGE_TITLE, false);
  setMeta('twitter:description', LANDING_PAGE_DESCRIPTION, false);
  if (logoUrl) setMeta('twitter:image', logoUrl, false);

  const jsonld = document.getElementById('catalog-item-jsonld');
  if (jsonld) jsonld.remove();
}

export { buildCatalogItemHeadline };
