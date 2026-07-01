import i18n from '../i18n';
import { stripLocalePrefix } from '../i18n/localeUtils';

/** @param {string} section */
function withBrand(section) {
  return `${section} | ${i18n.t('brand', { ns: 'meta' })}`;
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPublicCatalogDetailPath(pathname) {
  const p = stripLocalePrefix(pathname);
  const PUBLIC_CATALOG_ITEM_PATH =
    /^\/catalogo\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(\/[^/]*)?$/i;
  const EN_DE_CATALOG =
    /^\/(en\/catalog|de\/katalog)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(\/[^/]*)?$/i;
  return PUBLIC_CATALOG_ITEM_PATH.test(p) || EN_DE_CATALOG.test(p);
}

export const BRAND = 'Slot Database';

/**
 * Título del documento según la ruta.
 * @param {string} pathname
 */
export function getDocumentTitle(pathname) {
  const p = stripLocalePrefix(pathname);
  const normalized = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;

  if (normalized === '/') return i18n.t('landing', { ns: 'meta' });
  if (normalized === '/login') return withBrand(i18n.t('login', { ns: 'meta' }));
  if (normalized === '/reset-password') return withBrand(i18n.t('resetPassword', { ns: 'meta' }));
  if (normalized === '/dashboard') return withBrand(i18n.t('dashboard', { ns: 'meta' }));
  if (normalized === '/vehicles/new') return withBrand(i18n.t('vehiclesNew', { ns: 'meta' }));
  if (normalized.startsWith('/vehicles/') || normalized === '/vehicles') {
    return withBrand(i18n.t('vehicles', { ns: 'meta' }));
  }
  if (normalized === '/timings') return withBrand(i18n.t('timings', { ns: 'meta' }));
  if (normalized === '/circuits') return withBrand(i18n.t('circuits', { ns: 'meta' }));
  if (normalized === '/inventory') return withBrand(i18n.t('inventory', { ns: 'meta' }));
  if (normalized.startsWith('/competitions/signup/')) return withBrand(i18n.t('signup', { ns: 'meta' }));
  if (normalized.startsWith('/competitions/status/')) {
    return withBrand(i18n.t('competitionStatus', { ns: 'meta' }));
  }
  if (normalized.startsWith('/competitions/presentation/')) {
    return withBrand(i18n.t('presentation', { ns: 'meta' }));
  }
  if (/^\/competitions\/[^/]+\/participants$/.test(normalized)) {
    return withBrand(i18n.t('participants', { ns: 'meta' }));
  }
  if (/^\/competitions\/[^/]+\/timings$/.test(normalized)) {
    return withBrand(i18n.t('competitionTimings', { ns: 'meta' }));
  }
  if (normalized === '/competitions' || normalized.startsWith('/competitions/')) {
    return withBrand(i18n.t('competitions', { ns: 'meta' }));
  }
  if (normalized === '/profile') return withBrand(i18n.t('profile', { ns: 'meta' }));
  if (normalized === '/settings') return withBrand(i18n.t('settings', { ns: 'meta' }));
  if (normalized === '/settings/debug-data') return withBrand(i18n.t('debugData', { ns: 'meta' }));
  if (normalized === '/help') return withBrand(i18n.t('help', { ns: 'meta' }));
  if (normalized === '/admin/slot-race-licenses') return withBrand(i18n.t('adminSrm', { ns: 'meta' }));
  if (normalized === '/admin/slot-catalog') return withBrand(i18n.t('adminCatalog', { ns: 'meta' }));
  if (normalized === '/admin/changelog') return withBrand(i18n.t('adminChangelog', { ns: 'meta' }));
  if (normalized === '/admin/dashboard') return withBrand(i18n.t('adminMetrics', { ns: 'meta' }));
  if (normalized === '/changelog') return withBrand(i18n.t('changelog', { ns: 'meta' }));
  if (normalized === '/privacidad') return withBrand(i18n.t('privacy', { ns: 'meta' }));
  if (normalized === '/terminos') return withBrand(i18n.t('terms', { ns: 'meta' }));
  if (normalized === '/contacto') return withBrand(i18n.t('contact', { ns: 'meta' }));
  if (normalized === '/slot-race-manager') return withBrand(i18n.t('slotRaceManager', { ns: 'meta' }));
  if (normalized.startsWith('/piloto/')) return withBrand(i18n.t('pilot', { ns: 'meta' }));
  if (normalized === '/catalogo' || normalized === '/en/catalog' || normalized === '/de/katalog') {
    return withBrand(i18n.t('catalog', { ns: 'meta' }));
  }
  if (normalized.startsWith('/catalogo/') || normalized.startsWith('/en/catalog/') || normalized.startsWith('/de/katalog/')) {
    return withBrand(i18n.t('catalogItem', { ns: 'meta' }));
  }
  if (normalized === '/mis-sugerencias-catalogo') return withBrand(i18n.t('mySuggestions', { ns: 'meta' }));
  if (normalized === '/proponer-alta-catalogo') return withBrand(i18n.t('proposeCatalog', { ns: 'meta' }));
  return i18n.t('brand', { ns: 'meta' });
}
