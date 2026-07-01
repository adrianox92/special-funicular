import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  detectLocaleFromPath,
  pathImpliesLocale,
  localizePath,
  stripLocalePrefix,
  toIntlLocale,
} from '../i18n/localeUtils';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '../utils/formatUtils';

export { SUPPORTED_LOCALES, toIntlLocale, toIntlLocale as localeToIntl };

export const LOCALE_LABELS = {
  es: 'ES',
  en: 'EN',
  de: 'DE',
};

export function formatNumber(value, locale, options) {
  return formatNumberUtil(value, locale, options);
}

/**
 * Idioma activo, utilidades Intl, rutas localizadas y cambio de locale persistido.
 */
export function useLocale() {
  const { i18n, t } = useTranslation('common');
  const location = useLocation();
  const navigate = useNavigate();

  const pathLocale = detectLocaleFromPath(location.pathname);
  const locale = SUPPORTED_LOCALES.includes(i18n.language?.split('-')[0])
    ? i18n.language.split('-')[0]
    : pathLocale;
  const intlLocale = toIntlLocale(locale);
  const pathWithoutLocale = stripLocalePrefix(location.pathname);

  useEffect(() => {
    const implied = pathImpliesLocale(location.pathname);
    if (implied === null) return;
    const current = i18n.language?.split('-')[0];
    if (implied !== current) {
      i18n.changeLanguage(implied);
    }
  }, [location.pathname, i18n]);

  useEffect(() => {
    document.documentElement.lang = locale === 'de' ? 'de' : locale === 'en' ? 'en' : 'es';
  }, [locale]);

  const setLocale = useCallback(
    (lng) => {
      if (!SUPPORTED_LOCALES.includes(lng)) return;
      const targetPath = localizePath(lng, pathWithoutLocale);
      const search = location.search || '';
      const hash = location.hash || '';
      const targetUrl = `${targetPath}${search}${hash}`;
      if (targetUrl !== `${location.pathname}${search}${hash}`) {
        navigate(targetUrl, { replace: true });
      }
      i18n.changeLanguage(lng);
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, lng);
      } catch {
        /* ignore */
      }
    },
    [i18n, location.hash, location.pathname, location.search, navigate, pathWithoutLocale],
  );

  const formatDate = useCallback(
    (raw, options) => formatDateUtil(raw, options),
    [],
  );

  const formatNumberLocalized = useCallback(
    (value, options) => formatNumber(value, locale, options),
    [locale],
  );

  return {
    locale,
    intlLocale,
    setLocale,
    pathWithoutLocale,
    supportedLocales: SUPPORTED_LOCALES,
    localeLabels: LOCALE_LABELS,
    tCommon: t,
    formatDate,
    formatNumber: formatNumberLocalized,
  };
}

export default useLocale;
