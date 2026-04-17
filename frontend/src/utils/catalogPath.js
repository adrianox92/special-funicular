/**
 * catalogPath.js
 *
 * Utilidades para construir y parsear las URLs SEO del catálogo:
 *   /catalogo/<marca>/<tipo>/<traccion>/<año>
 *
 * Orden canónico: marca → tipo → tracción → año
 * Los segmentos ausentes se omiten (no hay placeholders).
 *
 * Ejemplos:
 *   /catalogo/scalextric/rally/2026         marca + tipo + año
 *   /catalogo/scalextric/2026               marca + año (sin tipo ni tracción)
 *   /catalogo/rally/4wd                     tipo + tracción (sin marca)
 *   /catalogo/2026                          solo año
 */

import { VEHICLE_TYPE_SLUGS, TRACTION_SLUGS } from './catalogFilterSlugs';

const YEAR_RE = /^\d{4}$/;

/**
 * Construye la URL del catálogo a partir de los filtros básicos activos.
 *
 * @param {object} filters
 * @param {string|null} filters.manufacturerSlug
 * @param {string|null} filters.vehicleTypeSlug
 * @param {string|null} filters.tractionSlug
 * @param {number|null} filters.year
 * @returns {string}  — path empezando con /catalogo
 */
export function buildCatalogPath({ manufacturerSlug, vehicleTypeSlug, tractionSlug, year } = {}) {
  const segments = [
    manufacturerSlug || null,
    vehicleTypeSlug  || null,
    tractionSlug     || null,
    year != null     ? String(year) : null,
  ].filter(Boolean);

  return segments.length > 0 ? `/catalogo/${segments.join('/')}` : '/catalogo';
}

/**
 * Parsea los segmentos de path del catálogo y devuelve los filtros básicos.
 *
 * Algoritmo: recorre los segmentos de izquierda a derecha asignando cada uno
 * al primer "slot" disponible en el orden: marca → tipo → tracción → año.
 *
 * - Año: detectado por `/^\d{4}$/`.
 * - Tipo: detectado por presencia en VEHICLE_TYPE_SLUGS.
 * - Tracción: detectado por presencia en TRACTION_SLUGS.
 * - Marca: cualquier cosa que no case con los anteriores (siempre slot "marca" si libre).
 *
 * En caso de ambigüedad (slug que podría ser marca Y tipo), gana marca si el slot
 * de marca aún está libre.
 *
 * @param {string[]} segments  — segmentos del path tras /catalogo/
 * @returns {{ manufacturerSlug: string|null, vehicleTypeSlug: string|null, tractionSlug: string|null, year: number|null }}
 */
export function parseCatalogPath(segments = []) {
  let manufacturerSlug = null;
  let vehicleTypeSlug  = null;
  let tractionSlug     = null;
  let year             = null;

  for (const raw of segments) {
    const seg = raw.trim().toLowerCase();
    if (!seg) continue;

    // Año: 4 dígitos
    if (year === null && YEAR_RE.test(seg)) {
      const n = parseInt(seg, 10);
      if (n >= 1900 && n <= 2100) { year = n; continue; }
    }

    // Tracción: conjunto cerrado
    if (tractionSlug === null && TRACTION_SLUGS.has(seg)) {
      tractionSlug = seg; continue;
    }

    // Tipo de vehículo: conjunto cerrado
    if (vehicleTypeSlug === null && VEHICLE_TYPE_SLUGS.has(seg)) {
      vehicleTypeSlug = seg; continue;
    }

    // Marca: todo lo demás (si el slot está libre)
    if (manufacturerSlug === null) {
      manufacturerSlug = seg;
    }
    // Si llega aquí con todos los slots ocupados lo ignoramos (URL inválida)
  }

  return { manufacturerSlug, vehicleTypeSlug, tractionSlug, year };
}

/**
 * Convierte los parámetros de búsqueda legacy (query string) al path canónico.
 * Devuelve null si no hay parámetros legacy que migrar.
 *
 * @param {URLSearchParams} searchParams
 * @returns {{ path: string, cleanSearchParams: URLSearchParams }|null}
 */
export function migrateLegacyQueryToPath(searchParams) {
  const manufacturer = searchParams.get('manufacturer');
  const vehicleType  = searchParams.get('vehicle_type');
  const year         = searchParams.get('year') || searchParams.get('commercial_release_year');

  if (!manufacturer && !vehicleType && !year) return null;

  const yearNum = year ? parseInt(year, 10) : null;
  const path = buildCatalogPath({
    manufacturerSlug: manufacturer ? manufacturer.toLowerCase().replace(/\s+/g, '-') : null,
    vehicleTypeSlug:  vehicleType  ? vehicleType.toLowerCase().replace(/\s+/g, '-')  : null,
    tractionSlug:     null,
    year:             Number.isFinite(yearNum) ? yearNum : null,
  });

  // Copiar searchParams sin los parámetros migrados
  const clean = new URLSearchParams(searchParams);
  clean.delete('manufacturer');
  clean.delete('vehicle_type');
  clean.delete('year');
  clean.delete('commercial_release_year');
  clean.delete('page');

  return { path, cleanSearchParams: clean };
}
