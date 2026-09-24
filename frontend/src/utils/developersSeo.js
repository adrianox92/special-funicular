/** SEO de /developers (título + description + OG). Una sola URL canónica. */
import i18n from '../i18n';
import { DEFAULT_LOCALE, toOgLocale } from '../i18n/localeUtils';
import { DEVELOPERS_PATH } from './partnerApiUrls';

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

/**
 * @param {string} [localeOverride]
 */
export function applyDevelopersPageSeo(localeOverride) {
  const locale = localeOverride || i18n.language || DEFAULT_LOCALE;
  const title = i18n.t('seo.title', { ns: 'developers' });
  const description = i18n.t('seo.description', { ns: 'developers' });
  const origin =
    (typeof process !== 'undefined' && process.env.REACT_APP_SITE_URL) ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const base = origin ? origin.replace(/\/$/, '') : '';
  const canonicalUrl = base ? `${base}${DEVELOPERS_PATH}` : '';
  const imageUrl = base ? `${base}/logo512.png` : '';

  document.title = title;

  setMeta('description', description, false);
  setMeta('og:type', 'website', true);
  setMeta('og:locale', toOgLocale(locale), true);
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
}
