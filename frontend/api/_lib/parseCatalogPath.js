/**
 * Parseo de rutas públicas de catálogo (ES / EN / DE) para el SSR de Vercel.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const YEAR_RE = /^\d{4}$/;

const VEHICLE_TYPE_SLUG_TO_LABEL = {
  turismo: 'Turismo',
  rally: 'Rally',
  gt: 'GT',
  formula: 'Fórmula',
  camion: 'Camión',
  camiones: 'Camiones',
  moto: 'Moto',
  clasico: 'Clásico',
  deportivo: 'Deportivo',
  suv: 'SUV',
  monoplaza: 'Monoplaza',
  truck: 'Truck',
  buggy: 'Buggy',
  'stock-car': 'Stock Car',
  prototipo: 'Prototipo',
  otro: 'Otro',
  lmp: 'LMP',
  hypercar: 'Hypercar',
  'grupo-5': 'Grupo 5',
  'road-car': 'Road Car',
  dtm: 'DTM',
  f1: 'F1',
  raid: 'Raid',
};

const TRACTION_SLUG_TO_LABEL = {
  '4wd': '4WD',
  rwd: 'RWD',
  fwd: 'FWD',
};

const VEHICLE_TYPE_SLUGS = new Set(Object.keys(VEHICLE_TYPE_SLUG_TO_LABEL));
const TRACTION_SLUGS = new Set(Object.keys(TRACTION_SLUG_TO_LABEL));

const LOCALES = [
  { code: 'es', catalog: '/catalogo' },
  { code: 'en', catalog: '/en/catalog' },
  { code: 'de', catalog: '/de/katalog' },
];

function isCatalogItemUuid(s) {
  return typeof s === 'string' && UUID_RE.test(s);
}

function catalogBasePath(locale) {
  if (locale === 'en') return '/en/catalog';
  if (locale === 'de') return '/de/katalog';
  return '/catalogo';
}

function localizeCatalogPath(locale, pathStartingWithCatalogo) {
  const normalized = pathStartingWithCatalogo.startsWith('/')
    ? pathStartingWithCatalogo
    : `/${pathStartingWithCatalogo}`;
  if (locale === 'es') return normalized;
  const rest = normalized.slice('/catalogo'.length);
  return `${catalogBasePath(locale)}${rest}`;
}

function parseCatalogPath(segments = []) {
  let manufacturerSlug = null;
  let vehicleTypeSlug = null;
  let tractionSlug = null;
  let year = null;

  for (const raw of segments) {
    const seg = String(raw).trim().toLowerCase();
    if (!seg) continue;
    if (year === null && YEAR_RE.test(seg)) {
      const n = parseInt(seg, 10);
      if (n >= 1900 && n <= 2100) {
        year = n;
        continue;
      }
    }
    if (tractionSlug === null && TRACTION_SLUGS.has(seg)) {
      tractionSlug = seg;
      continue;
    }
    if (vehicleTypeSlug === null && VEHICLE_TYPE_SLUGS.has(seg)) {
      vehicleTypeSlug = seg;
      continue;
    }
    if (manufacturerSlug === null) {
      manufacturerSlug = seg;
    }
  }

  return { manufacturerSlug, vehicleTypeSlug, tractionSlug, year };
}

/**
 * @param {string} pathname
 * @returns {{
 *   locale: 'es'|'en'|'de',
 *   kind: 'item'|'list',
 *   id?: string,
 *   slug?: string,
 *   filters?: { manufacturerSlug: string|null, vehicleTypeSlug: string|null, tractionSlug: string|null, year: number|null },
 *   listPathEs: string,
 * }}
 */
function parsePublicCatalogPath(pathname) {
  const p = String(pathname || '').split('?')[0];
  const cleaned = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;

  let locale = 'es';
  let rest = cleaned;
  if (cleaned === '/en/catalog' || cleaned.startsWith('/en/catalog/')) {
    locale = 'en';
    rest = `/catalogo${cleaned.slice('/en/catalog'.length)}`;
  } else if (cleaned === '/de/katalog' || cleaned.startsWith('/de/katalog/')) {
    locale = 'de';
    rest = `/catalogo${cleaned.slice('/de/katalog'.length)}`;
  } else if (cleaned !== '/catalogo' && !cleaned.startsWith('/catalogo/')) {
    return { locale: 'es', kind: 'list', filters: parseCatalogPath([]), listPathEs: '/catalogo' };
  }

  const segments = rest.replace(/^\/catalogo\/?/, '').split('/').filter(Boolean);
  if (segments.length > 0 && isCatalogItemUuid(segments[0])) {
    return {
      locale,
      kind: 'item',
      id: segments[0],
      slug: segments[1] || '',
      listPathEs: '/catalogo',
    };
  }

  const filters = parseCatalogPath(segments);
  const listPathEs =
    segments.length > 0 ? `/catalogo/${segments.join('/')}` : '/catalogo';
  return { locale, kind: 'list', filters, listPathEs };
}

function catalogItemPath(locale, id, slug) {
  return `${catalogBasePath(locale)}/${id}/${slug}`;
}

function hreflangForItem(origin, id, slug) {
  return LOCALES.map((loc) => ({
    hreflang: loc.code,
    href: `${origin}${catalogItemPath(loc.code, id, slug)}`,
  })).concat([{ hreflang: 'x-default', href: `${origin}${catalogItemPath('es', id, slug)}` }]);
}

function hreflangForList(origin, listPathEs) {
  return LOCALES.map((loc) => ({
    hreflang: loc.code,
    href: `${origin}${localizeCatalogPath(loc.code, listPathEs)}`,
  })).concat([{ hreflang: 'x-default', href: `${origin}${listPathEs}` }]);
}

module.exports = {
  LOCALES,
  VEHICLE_TYPE_SLUG_TO_LABEL,
  TRACTION_SLUG_TO_LABEL,
  isCatalogItemUuid,
  catalogBasePath,
  localizeCatalogPath,
  parsePublicCatalogPath,
  catalogItemPath,
  hreflangForItem,
  hreflangForList,
};
