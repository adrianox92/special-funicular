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
  'slot, scalextric, ninco, catálogo referencias, slot car, base de datos slot, colección scalextric';

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
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function buildCatalogItemMetaDescription(item) {
  const ref = item.reference != null ? String(item.reference) : '';
  const mfg = item.manufacturer != null ? String(item.manufacturer) : '';
  const name = item.model_name != null ? String(item.model_name) : '';
  const parts = [
    `Ficha del catálogo de referencias Slot Collection Pro: ${name} (${ref}) de ${mfg}.`,
  ];
  const extras = [];
  if (item.vehicle_type) extras.push(`tipo ${item.vehicle_type}`);
  if (item.commercial_release_year != null && item.commercial_release_year !== '') {
    extras.push(`año de comercialización ${item.commercial_release_year}`);
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
      extras.push(`valoración media ${avg.toFixed(1)}/5 (${rc})`);
    }
  }
  if (extras.length) {
    parts.push(extras.join(' · ') + '.');
  }
  parts.push('Consulta imagen, datos técnicos y valoraciones.');
  return truncate(parts.join(' '), 158);
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
  return bits.join(', ');
}

const LIST_TITLE = `Catálogo de referencias | ${BRAND}`;
const LIST_DESCRIPTION =
  'Catálogo público de modelos slot: referencia, marca, tipo, año de comercialización y valoraciones de la comunidad. Scalextric, Ninco, Avant Slot y más en Slot Collection Pro.';

/**
 * Meta del listado /catalogo (sin sobrescribir document.title; lo gestiona App + getDocumentTitle).
 */
export function applyPublicCatalogListSeo() {
  const origin = getOrigin();
  const canonicalUrl = origin ? `${origin}/catalogo` : '';

  setMeta('description', LIST_DESCRIPTION, false);
  setMeta('keywords', KEYWORDS_BASE, false);
  setMeta('og:type', 'website', true);
  setMeta('og:title', LIST_TITLE, true);
  setMeta('og:description', LIST_DESCRIPTION, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);
  const logoUrl = origin ? `${origin}/logo512.png` : '';
  if (logoUrl) {
    setMeta('og:image', logoUrl, true);
    setMeta('og:image:width', '512', true);
    setMeta('og:image:height', '512', true);
  }
  setMeta('twitter:card', 'summary_large_image', false);
  setMeta('twitter:title', LIST_TITLE, false);
  setMeta('twitter:description', LIST_DESCRIPTION, false);
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
  const title = `${item.model_name} · ${item.reference} | ${BRAND}`;
  document.title = title;

  const description = buildCatalogItemMetaDescription(item);
  const keywords = buildCatalogItemKeywords(item);
  const origin = getOrigin();
  const canonicalUrl = origin ? `${origin}/catalogo/${item.id}/${slug}` : '';

  setMeta('description', description, false);
  setMeta('keywords', keywords, false);

  setMeta('og:type', 'article', true);
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);

  const imageUrl = item.image_url && String(item.image_url).trim() ? String(item.image_url) : '';
  if (imageUrl) {
    setMeta('og:image', imageUrl, true);
  } else {
    const logoUrl = origin ? `${origin}/logo512.png` : '';
    if (logoUrl) {
      setMeta('og:image', logoUrl, true);
      setMeta('og:image:width', '512', true);
      setMeta('og:image:height', '512', true);
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
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${item.model_name} (${item.reference})`,
      description,
      sku: String(item.reference),
      url: canonicalUrl,
    };
    if (item.manufacturer) {
      product.brand = { '@type': 'Brand', name: String(item.manufacturer) };
    }
    if (imageUrl) product.image = imageUrl;
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
    script.textContent = JSON.stringify(product);
    document.head.appendChild(script);
  }
}

/** Restaura metas sociales al salir de la ficha (no toca document.title: lo pone App). */
export function clearCatalogItemPageSeo() {
  setMeta('description', LANDING_PAGE_DESCRIPTION, false);
  setMeta('keywords', KEYWORDS_BASE, false);
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
