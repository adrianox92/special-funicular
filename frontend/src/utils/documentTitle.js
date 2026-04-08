import { LANDING_PAGE_TITLE } from './landingSeo';

const BRAND = 'Slot Collection Pro';

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
  if (p === '/help') return withBrand('Ayuda');
  if (p === '/admin/slot-race-licenses') return withBrand('Admin licencias SRM');

  if (p === '/privacidad') return withBrand('Política de privacidad');
  if (p === '/terminos') return withBrand('Términos de servicio');
  if (p === '/contacto') return withBrand('Contacto');

  if (p === '/slot-race-manager') return withBrand('Slot Race Manager');

  if (p.startsWith('/piloto/')) return withBrand('Piloto');

  return BRAND;
}
