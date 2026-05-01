/**
 * Meta description y Open Graph para fichas del catálogo público (SEO).
 */
import { LANDING_PAGE_DESCRIPTION, LANDING_PAGE_TITLE } from './landingSeo';
import { BRAND } from './documentTitle';
import { catalogSlugify } from './catalogSlug';

/** Mismas etiquetas que `data/motorPosition.js` (evita import y problemas de HMR con rutas). */
const MOTOR_POSITION_LABELS = {
  inline: 'En línea',
  angular: 'Angular',
  transverse: 'Transversal',
};

function labelMotorForMeta(value) {
  if (value == null || value === '') return '';
  return MOTOR_POSITION_LABELS[value] ?? String(value);
}

const KEYWORDS_BASE =
  'slot, scalextric, ninco, avant slot, slot car, coche slot, catálogo referencias slot, base de datos slot, colección scalextric, referencia slot';

/** Pie de meta description compartido entre listados y fichas del catálogo público. */
const CATALOG_PUBLIC_META_FOOTER = `Referencia, especificaciones, imagen y valoraciones en ${BRAND}.`;

function setMeta(attrName, value, isProperty) {
  if (value == null || value === '') return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${attrName}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, attrName);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/** Quita una meta añadida solo en ficha de catálogo (evita arrastrarla al resto de rutas). */
function removeMeta(attrName, isProperty) {
  const attr = isProperty ? 'property' : 'name';
  const el = document.querySelector(`meta[${attr}="${attrName}"]`);
  if (el) el.remove();
}

function getOrigin() {
  const fromEnv = typeof process !== 'undefined' && process.env.REACT_APP_SITE_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max = 158) {
  const t = String(text).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncateTitle(text, max = 72) {
  const t = String(text).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 28 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

/**
 * @param {unknown} iso
 * @returns {string}
 */
function toIsoDateModified(iso) {
  if (iso == null || iso === '') return '';
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  } catch {
    return '';
  }
}

/**
 * Texto alternativo coherente para la imagen del modelo (accesibilidad + SEO de imagen).
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
/**
 * Cabecera SEO de ficha de catálogo: marca · referencia · modelo (solo valores presentes).
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function buildCatalogItemHeadline(item) {
  const ref = item.reference != null ? String(item.reference).trim() : '';
  const mfg = item.manufacturer != null ? String(item.manufacturer).trim() : '';
  const name = item.model_name != null ? String(item.model_name).trim() : '';
  return [mfg || null, ref || null, name || null].filter(Boolean).join(' · ');
}

export function buildCatalogItemImageAlt(item) {
  const ref = item.reference != null ? String(item.reference) : '';
  const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
  const name = item.model_name != null ? String(item.model_name) : '';
  const bits = ['Coche slot', mfg, ref && `ref. ${ref}`, name].filter(Boolean);
  return bits.join(', ');
}

/**
 * Título del documento: marca · referencia · modelo | Slot Database.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function buildCatalogItemPageTitle(item) {
  const core = buildCatalogItemHeadline(item);
  const raw = core ? `${core} | ${BRAND}` : `Catálogo de referencias | ${BRAND}`;
  return truncateTitle(raw, 72);
}

/**
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function buildCatalogItemMetaDescription(item) {
  const headline = buildCatalogItemHeadline(item);

  const lead = headline
    ? `${headline}: coche slot; catálogo público ${BRAND}.`
    : `Ficha de coche slot en el catálogo público ${BRAND}.`;

  const parts = [lead];
  const extras = [];
  if (item.vehicle_type) extras.push(`${item.vehicle_type}`);
  if (item.commercial_release_year != null && item.commercial_release_year !== '') {
    extras.push(`año ${item.commercial_release_year}`);
  }
  if (item.traction) extras.push(`tracción ${item.traction}`);
  if (item.discontinued) extras.push('descatalogado');
  if (item.upcoming_release) extras.push('próximo lanzamiento');
  const motor = labelMotorForMeta(item.motor_position);
  if (motor) extras.push(`motor ${motor.toLowerCase()}`);
  const rc = Number(item.rating_count);
  if (Number.isFinite(rc) && rc > 0 && item.rating_avg != null) {
    const avg = Number(item.rating_avg);
    if (Number.isFinite(avg)) {
      extras.push(`nota media ${avg.toFixed(1)}/5 (${rc})`);
    }
  }
  if (extras.length) {
    parts.push(extras.join(' · ') + '.');
  }
  parts.push(CATALOG_PUBLIC_META_FOOTER);
  return truncate(parts.join(' '), 160);
}

/**
 * Párrafo introductorio visible en la ficha pública (no es meta description).
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function buildCatalogItemLeadParagraph(item) {
  const headline = buildCatalogItemHeadline(item);
  const parts = [
    headline
      ? `${headline}: coche slot en el catálogo público de ${BRAND}.`
      : `Ficha de coche slot en el catálogo público de ${BRAND}.`,
  ];
  const extras = [];
  if (item.vehicle_type) extras.push(String(item.vehicle_type));
  if (item.commercial_release_year != null && item.commercial_release_year !== '') {
    extras.push(`comercializado en ${item.commercial_release_year}`);
  }
  if (item.traction) extras.push(`tracción ${item.traction}`);
  if (item.discontinued) extras.push('descatalogado');
  if (item.upcoming_release) extras.push('próximo lanzamiento');
  const motor = labelMotorForMeta(item.motor_position);
  if (motor) extras.push(`motor ${motor.toLowerCase()}`);
  const rc = Number(item.rating_count);
  if (Number.isFinite(rc) && rc > 0 && item.rating_avg != null) {
    const avg = Number(item.rating_avg);
    if (Number.isFinite(avg)) {
      extras.push(
        `valoración media ${avg.toFixed(1)}/5 (${rc} ${rc === 1 ? 'opinión' : 'opiniones'})`,
      );
    }
  }
  if (extras.length) {
    parts.push(`Datos: ${extras.join('; ')}.`);
  }
  parts.push(`Imagen, especificaciones y valoraciones de coleccionistas en ${BRAND}.`);
  return truncate(parts.join(' '), 420);
}

/**
 * @param {Record<string, unknown>} item
 */
export function buildCatalogItemKeywords(item) {
  const bits = [KEYWORDS_BASE];
  if (item.reference) bits.push(String(item.reference));
  if (item.manufacturer) bits.push(String(item.manufacturer));
  if (item.model_name) bits.push(String(item.model_name));
  if (item.vehicle_type) bits.push(String(item.vehicle_type));
  if (item.reference && item.manufacturer) {
    bits.push(`${item.reference} ${item.manufacturer}`);
  }
  return bits.join(', ');
}

const LIST_TITLE_BASE = `Catálogo de referencias | ${BRAND}`;
const LIST_DESCRIPTION_BASE = truncate(
  `Catálogo público de coches slot (Scalextric, Ninco, Avant Slot y más). ${CATALOG_PUBLIC_META_FOOTER}`,
  158,
);

/**
 * Meta del listado /catalogo — acepta filtros activos para componer título y canonical SEO-friendly.
 *
 * @param {object} [filters]
 * @param {string|null}  filters.manufacturerName   — nombre legible de la marca (no slug)
 * @param {string|null}  filters.vehicleTypeLabel   — etiqueta del tipo
 * @param {string|null}  filters.tractionLabel      — etiqueta de la tracción
 * @param {number|null}  filters.year
 * @param {number|null}  filters.total              — número de resultados
 * @param {string|null}  filters.canonicalPath      — path /catalogo/... ya construido
 */
export function applyPublicCatalogListSeo(filters = {}) {
  const { manufacturerName, vehicleTypeLabel, tractionLabel, year, total, canonicalPath } = filters;
  const origin = getOrigin();

  // Construir título dinámico
  const parts = [manufacturerName, vehicleTypeLabel, tractionLabel, year ? String(year) : null].filter(Boolean);
  const titleSuffix = parts.length ? parts.join(' · ') : null;
  // Título dinámico: solo filtros del path + marca del sitio (cada combinación es una página distinta para SEO).
  const listTitle = titleSuffix
    ? `${titleSuffix} | ${BRAND}`
    : LIST_TITLE_BASE;

  document.title = truncateTitle(listTitle, 72);

  // Meta description dinámica
  const countText = total != null ? `${total} modelo${total !== 1 ? 's' : ''}` : 'modelos';
  const filterText = parts.length ? ` de ${parts.join(', ')}` : '';
  const listDescription = parts.length
    ? truncate(`Catálogo público${filterText}: ${countText} encontrados. ${CATALOG_PUBLIC_META_FOOTER}`, 158)
    : LIST_DESCRIPTION_BASE;

  const canonicalUrl = origin
    ? `${origin}${canonicalPath || '/catalogo'}`
    : '';

  setMeta('description', listDescription, false);
  setMeta('keywords', KEYWORDS_BASE, false);
  setMeta('og:type', 'website', true);
  setMeta('og:locale', 'es_ES', true);
  setMeta('og:site_name', BRAND, true);
  setMeta('og:title', listTitle, true);
  setMeta('og:description', listDescription, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);
  const logoUrl = origin ? `${origin}/logo512.png` : '';
  if (logoUrl) {
    setMeta('og:image', logoUrl, true);
    setMeta('og:image:width', '512', true);
    setMeta('og:image:height', '512', true);
  }
  setMeta('twitter:card', 'summary_large_image', false);
  setMeta('twitter:title', listTitle, false);
  setMeta('twitter:description', listDescription, false);
  if (logoUrl) setMeta('twitter:image', logoUrl, false);

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

/**
 * @param {Record<string, unknown>} item — fila de slot_catalog_items / vista con rating_avg, etc.
 */
export function applyCatalogItemPageSeo(item) {
  if (!item?.id) return;

  const slug = catalogSlugify(item.model_name || item.reference);
  const title = buildCatalogItemPageTitle(item);
  document.title = title;

  const description = buildCatalogItemMetaDescription(item);
  const keywords = buildCatalogItemKeywords(item);
  const origin = getOrigin();
  const canonicalUrl = origin ? `${origin}/catalogo/${item.id}/${slug}` : '';
  const imageAlt = buildCatalogItemImageAlt(item);
  const modifiedIso = toIsoDateModified(item.updated_at);

  setMeta('description', description, false);
  setMeta('keywords', keywords, false);
  setMeta('robots', 'index, follow, max-image-preview:large', false);

  setMeta('og:type', 'website', true);
  setMeta('og:locale', 'es_ES', true);
  setMeta('og:site_name', BRAND, true);
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);
  if (modifiedIso) setMeta('article:modified_time', modifiedIso, true);

  const imageUrl = item.image_url && String(item.image_url).trim() ? String(item.image_url) : '';
  if (imageUrl) {
    setMeta('og:image', imageUrl, true);
    setMeta('og:image:alt', imageAlt, true);
  } else {
    const logoUrl = origin ? `${origin}/logo512.png` : '';
    if (logoUrl) {
      setMeta('og:image', logoUrl, true);
      setMeta('og:image:width', '512', true);
      setMeta('og:image:height', '512', true);
      setMeta('og:image:alt', `Catálogo público · ${BRAND}`, true);
    }
  }

  setMeta('twitter:card', imageUrl ? 'summary_large_image' : 'summary', false);
  setMeta('twitter:title', title, false);
  setMeta('twitter:description', description, false);
  if (imageUrl) setMeta('twitter:image', imageUrl, false);
  else {
    const logoUrl = origin ? `${origin}/logo512.png` : '';
    if (logoUrl) setMeta('twitter:image', logoUrl, false);
  }

  let linkCanonical = document.querySelector('link[rel="canonical"]');
  if (canonicalUrl) {
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);
  }

  const existing = document.getElementById('catalog-item-jsonld');
  if (existing) existing.remove();

  if (origin && canonicalUrl) {
    const script = document.createElement('script');
    script.id = 'catalog-item-jsonld';
    script.type = 'application/ld+json';
    const homeUrl = `${origin}/`;
    const catalogUrl = `${origin}/catalogo`;
    const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
    const brandListUrl =
      mfg ? `${origin}/catalogo?manufacturer=${encodeURIComponent(mfg)}` : catalogUrl;

    const breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Inicio',
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Catálogo de referencias slot',
          item: catalogUrl,
        },
        ...(mfg
          ? [
              {
                '@type': 'ListItem',
                position: 3,
                name: mfg,
                item: brandListUrl,
              },
            ]
          : []),
        {
          '@type': 'ListItem',
          position: mfg ? 4 : 3,
          name: buildCatalogItemHeadline(item) || String(item.model_name ?? item.reference ?? 'Ficha'),
          item: canonicalUrl,
        },
      ],
    };

    const product = {
      '@type': 'Product',
      name: buildCatalogItemHeadline(item) || String(item.model_name ?? item.reference ?? 'Coche slot'),
      description,
      sku: String(item.reference),
      mpn: String(item.reference),
      url: canonicalUrl,
    };
    if (item.manufacturer) {
      product.brand = { '@type': 'Brand', name: String(item.manufacturer) };
    }
    if (item.vehicle_type) {
      product.category = String(item.vehicle_type);
    }
    if (imageUrl) {
      product.image = [imageUrl];
    }
    if (modifiedIso) {
      product.dateModified = modifiedIso;
    }
    const rc = Number(item.rating_count);
    const avg = Number(item.rating_avg);
    if (Number.isFinite(rc) && rc > 0 && Number.isFinite(avg)) {
      product.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: Math.round(avg * 10) / 10,
        ratingCount: rc,
        bestRating: 5,
        worstRating: 1,
      };
    }

    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [breadcrumb, product],
    });
    document.head.appendChild(script);
  }
}

/** Restaura metas sociales al salir de la ficha (no toca document.title: lo pone App). */
export function clearCatalogItemPageSeo() {
  removeMeta('article:modified_time', true);
  removeMeta('og:image:alt', true);
  removeMeta('og:site_name', true);
  removeMeta('og:locale', true);
  setMeta('description', LANDING_PAGE_DESCRIPTION, false);
  setMeta('keywords', KEYWORDS_BASE, false);
  setMeta('robots', 'index, follow', false);
  setMeta('og:type', 'website', true);
  setMeta('og:title', LANDING_PAGE_TITLE, true);
  setMeta('og:description', LANDING_PAGE_DESCRIPTION, true);
  const origin = getOrigin();
  const homeUrl = origin ? `${origin}/` : '';
  if (homeUrl) setMeta('og:url', homeUrl, true);
  const logoUrl = origin ? `${origin}/logo512.png` : '';
  if (logoUrl) {
    setMeta('og:image', logoUrl, true);
    setMeta('og:image:width', '512', true);
    setMeta('og:image:height', '512', true);
  }
  setMeta('twitter:card', 'summary_large_image', false);
  setMeta('twitter:title', LANDING_PAGE_TITLE, false);
  setMeta('twitter:description', LANDING_PAGE_DESCRIPTION, false);
  if (logoUrl) setMeta('twitter:image', logoUrl, false);

  const jsonld = document.getElementById('catalog-item-jsonld');
  if (jsonld) jsonld.remove();
}
