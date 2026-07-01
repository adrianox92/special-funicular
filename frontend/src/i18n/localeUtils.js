export const SUPPORTED_LOCALES = ['es', 'en', 'de'];
export const DEFAULT_LOCALE = 'es';
export const LOCALE_STORAGE_KEY = 'slotdb-locale';

const INTL_MAP = { es: 'es-ES', en: 'en-GB', de: 'de-DE' };
const OG_LOCALE_MAP = { es: 'es_ES', en: 'en_GB', de: 'de_DE' };
const OG_ALT = { es: ['en_GB', 'de_DE'], en: ['es_ES', 'de_DE'], de: ['es_ES', 'en_GB'] };

/** @param {string} locale */
export function toIntlLocale(locale) {
  return INTL_MAP[locale] || INTL_MAP[DEFAULT_LOCALE];
}

/** @param {string} locale */
export function toOgLocale(locale) {
  return OG_LOCALE_MAP[locale] || OG_LOCALE_MAP[DEFAULT_LOCALE];
}

/** @param {string} locale */
export function getOgLocaleAlternates(locale) {
  return OG_ALT[locale] || OG_ALT[DEFAULT_LOCALE];
}

/** @param {string} pathname */
export function detectLocaleFromPath(pathname) {
  const p = pathname.split('?')[0];
  const m = p.match(/^\/(en|de)(\/|$)/);
  return m && SUPPORTED_LOCALES.includes(m[1]) ? m[1] : DEFAULT_LOCALE;
}

/**
 * Idioma fijado explícitamente por la URL, o null si la ruta no impone idioma
 * (app autenticada: se usa localStorage / elección del usuario).
 * @param {string} pathname
 * @returns {string|null}
 */
export function pathImpliesLocale(pathname) {
  const p = pathname.split('?')[0];
  const m = p.match(/^\/(en|de)(\/|$)/);
  if (m && SUPPORTED_LOCALES.includes(m[1])) {
    return m[1];
  }
  if (p === '/catalogo' || p.startsWith('/catalogo/')) {
    return DEFAULT_LOCALE;
  }
  return null;
}

/** @param {string} pathname */
export function stripLocalePrefix(pathname) {
  const p = pathname.split('?')[0];
  const stripped = p.replace(/^\/(en|de)(?=\/|$)/, '') || '/';
  return stripped.endsWith('/') && stripped.length > 1 ? stripped.slice(0, -1) : stripped;
}

/**
 * Public catalog path per locale (ES keeps /catalogo).
 * @param {string} locale
 */
export function catalogBasePath(locale) {
  if (locale === 'en') return '/en/catalog';
  if (locale === 'de') return '/de/katalog';
  return '/catalogo';
}

/**
 * Rutas que usan prefijo /en o /de en la URL (SEO público).
 * El resto de la app cambia idioma solo vía i18n, sin prefijo en la ruta.
 * @param {string} path — sin prefijo de locale
 */
export function isLocalePrefixedPublicPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized === '/' || normalized === '/catalogo' || normalized.startsWith('/catalogo/');
}

/**
 * @param {string} locale
 * @param {string} path — path without locale prefix
 */
export function localizePath(locale, path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) {
    return normalized;
  }
  if (!isLocalePrefixedPublicPath(normalized)) {
    return normalized;
  }
  if (normalized === '/catalogo' || normalized.startsWith('/catalogo/')) {
    const rest = normalized.slice('/catalogo'.length);
    const base = locale === 'en' ? '/en/catalog' : '/de/katalog';
    return `${base}${rest}`;
  }
  if (normalized === '/') {
    return `/${locale}`;
  }
  return normalized;
}

/** @param {string} [raw] */
export function normalizeLocale(raw) {
  if (!raw) return DEFAULT_LOCALE;
  const base = String(raw).toLowerCase().split('-')[0];
  return SUPPORTED_LOCALES.includes(base) ? base : DEFAULT_LOCALE;
}

/** Browser + stored preference (not URL). */
export function detectInitialLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return normalizeLocale(navigator.language);
  }
  return DEFAULT_LOCALE;
}
