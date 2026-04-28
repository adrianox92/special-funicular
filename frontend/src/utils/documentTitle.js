import { LANDING_PAGE_TITLE } from './landingSeo';

export const BRAND = 'Slot Collection Pro';

/** Ruta pública `/catalogo/:uuid` o `/catalogo/:uuid/:slug` (ficha de un ítem). */
const PUBLIC_CATALOG_ITEM_PATH =
  /^\/catalogo\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(\/[^/]*)?$/i;

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPublicCatalogDetailPath(pathname) {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return PUBLIC_CATALOG_ITEM_PATH.test(p);
}

/** @param {string} section */
function withBrand(section) {
  return `${section} | ${BRAND}`;
}

/**
 * Título del documento según la ruta (nombre de sección alineado con la navegación principal).
 * @param {string} pathname
 */
export function getDocumentTitle(pathname) {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (p === '/') return LANDING_PAGE_TITLE;

  if (p === '/login') return withBrand('Iniciar sesión');
  if (p === '/reset-password') return withBrand('Restablecer contraseña');

  if (p === '/dashboard') return withBrand('Inicio');

  if (p === '/vehicles/new') return withBrand('Nuevo vehículo');
  if (p.startsWith('/vehicles/')) return withBrand('Vehículos');
  if (p === '/vehicles') return withBrand('Vehículos');

  if (p === '/timings') return withBrand('Tiempos');
  if (p === '/circuits') return withBrand('Circuitos');
  if (p === '/inventory') return withBrand('Inventario');

  if (p.startsWith('/competitions/signup/')) return withBrand('Inscripción');
  if (p.startsWith('/competitions/status/')) return withBrand('Estado de la competición');
  if (p.startsWith('/competitions/presentation/')) return withBrand('Presentación');
  if (/^\/competitions\/[^/]+\/participants$/.test(p)) return withBrand('Participantes');
  if (/^\/competitions\/[^/]+\/timings$/.test(p)) return withBrand('Tiempos de competición');
  if (p === '/competitions' || p.startsWith('/competitions/')) return withBrand('Competiciones');

  if (p === '/profile') return withBrand('Mi perfil');
  if (p === '/settings') return withBrand('Configuración');
  if (p === '/help') return withBrand('Ayuda · Guía de inicio');
  if (p === '/admin/slot-race-licenses') return withBrand('Admin licencias SRM');
  if (p === '/admin/slot-catalog') return withBrand('Catálogo slot (admin)');
  if (p === '/admin/changelog') return withBrand('Changelog (admin)');
  if (p === '/admin/dashboard') return withBrand('Métricas de plataforma (admin)');
  if (p === '/changelog') return withBrand('Novedades');

  if (p === '/privacidad') return withBrand('Política de privacidad');
  if (p === '/terminos') return withBrand('Términos de servicio');
  if (p === '/contacto') return withBrand('Contacto');

  if (p === '/slot-race-manager') return withBrand('Slot Race Manager');

  if (p.startsWith('/piloto/')) return withBrand('Piloto');

  if (p === '/catalogo') return withBrand('Catálogo de referencias');
  if (p.startsWith('/catalogo/')) return withBrand('Catálogo');

  if (p === '/mis-sugerencias-catalogo') return withBrand('Mis sugerencias al catálogo');
  if (p === '/proponer-alta-catalogo') return withBrand('Proponer alta en el catálogo');

  return BRAND;
}
