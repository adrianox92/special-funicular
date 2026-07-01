import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  detectInitialLocale,
  pathImpliesLocale,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
} from './localeUtils';

export {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
} from './localeUtils';

/** Namespaces cargados bajo demanda. */
export const NAMESPACES = [
  'common',
  'nav',
  'auth',
  'dashboard',
  'settings',
  'vehicles',
  'competitions',
  'clubs',
  'catalog',
  'legal',
  'presentation',
  'landing',
  'meta',
  'public',
  'data',
  'timings',
];

const LazyLocaleBackend = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    import(`./locales/${language}/${namespace}.json`)
      .then((module) => callback(null, module.default))
      .catch((err) => callback(err, null));
  },
};

function resolveInitialLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const implied = pathImpliesLocale(window.location.pathname);
  if (implied !== null) return implied;
  return detectInitialLocale();
}

const initialLocale = resolveInitialLocale();
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLocale;
}

i18n
  .use(LazyLocaleBackend)
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    ns: NAMESPACES,
    defaultNS: 'common',
    partialBundledLanguages: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

i18n.on('languageChanged', (lng) => {
  const code = lng.split('-')[0];
  if (typeof document !== 'undefined') {
    document.documentElement.lang = code;
  }
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
});

export default i18n;
