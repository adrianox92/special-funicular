/** SEO del landing público con soporte multiidioma. */
import i18n from '../i18n';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  catalogBasePath,
  localizePath,
  toOgLocale,
  getOgLocaleAlternates,
} from '../i18n/localeUtils';

export const LANDING_PAGE_TITLE = 'Slot Database | Lleva la gestión de tu colección a otro nivel';

export const LANDING_PAGE_DESCRIPTION =
  'Slot Database: gestiona coches de slot Scalextric, Ninco y Avant Slot. Fichas técnicas, cronometraje al milisegundo, competiciones y sincronización en la nube.';

const KEYWORDS =
  'slot, scalextric, ninco, avant slot, slot car, base de datos slot, colección scalextric';

function setMeta(attrName, value, isProperty) {
  if (!value) return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${attrName}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, attrName);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function removeHreflangLinks() {
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
}

function setHreflangAlternates(origin, path = '/') {
  removeHreflangLinks();
  SUPPORTED_LOCALES.forEach((loc) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = loc === 'es' ? 'es' : loc;
    link.href = `${origin}${localizePath(loc, path)}`;
    document.head.appendChild(link);
  });
  const xDefault = document.createElement('link');
  xDefault.rel = 'alternate';
  xDefault.hreflang = 'x-default';
  xDefault.href = `${origin}${localizePath(DEFAULT_LOCALE, path)}`;
  document.head.appendChild(xDefault);
}

/**
 * @param {string} [localeOverride]
 */
export function applyLandingPageSeo(localeOverride) {
  const locale = localeOverride || i18n.language || DEFAULT_LOCALE;
  const title = i18n.t('seo.title', { ns: 'landing' });
  const description = i18n.t('seo.description', { ns: 'landing' });
  const origin =
    (typeof process !== 'undefined' && process.env.REACT_APP_SITE_URL) ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const canonicalUrl = origin ? `${origin.replace(/\/$/, '')}${localizePath(locale, '/')}` : '';
  const imageUrl = origin ? `${origin.replace(/\/$/, '')}/logo512.png` : '';

  document.title = title;

  setMeta('description', description, false);
  setMeta('keywords', KEYWORDS, false);

  setMeta('og:type', 'website', true);
  setMeta('og:locale', toOgLocale(locale), true);
  getOgLocaleAlternates(locale).forEach((alt) => {
    setMeta('og:locale:alternate', alt, true);
  });
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);
  if (imageUrl) {
    setMeta('og:image', imageUrl, true);
    setMeta('og:image:width', '512', true);
    setMeta('og:image:height', '512', true);
  }

  setMeta('twitter:card', 'summary_large_image', false);
  setMeta('twitter:title', title, false);
  setMeta('twitter:description', description, false);
  if (imageUrl) setMeta('twitter:image', imageUrl, false);

  let linkCanonical = document.querySelector('link[rel="canonical"]');
  if (canonicalUrl) {
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);
  }

  if (origin) setHreflangAlternates(origin.replace(/\/$/, ''), '/');

  const existing = document.getElementById('landing-jsonld');
  if (existing) existing.remove();

  if (origin) {
    const inLanguage = locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : 'es-ES';
    const script = document.createElement('script');
    script.id = 'landing-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Slot Database',
      alternateName: ['Scalextric Collection'],
      url: canonicalUrl || `${origin}/`,
      description,
      inLanguage,
      keywords: KEYWORDS,
    });
    document.head.appendChild(script);
  }
}

export { catalogBasePath, localizePath };
