/** SEO del landing público: palabras clave slot, Scalextric, Ninco, Avant Slot. */

export const LANDING_PAGE_TITLE =
  'Slot Collection Pro | Base de datos Scalextric, Ninco y Avant Slot';

export const LANDING_PAGE_DESCRIPTION =
  'Slot Collection Pro (Slot Database): gestiona coches de slot Scalextric, Ninco y Avant Slot. Fichas técnicas, cronometraje al milisegundo, competiciones y sincronización en la nube.';

const KEYWORDS =
  'slot, scalextric, ninco, avant slot, slot car, base de datos slot, colección scalextric';

function setMeta(attrName, value, isProperty) {
  if (!value) return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${attrName}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, attrName);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/**
 * Aplica title, meta y Open Graph. Usa REACT_APP_SITE_URL en producción si está definida;
 * si no, window.location.origin (útil en cualquier dominio).
 */
export function applyLandingPageSeo() {
  const origin =
    (typeof process !== 'undefined' && process.env.REACT_APP_SITE_URL) ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const canonicalUrl = origin ? `${origin.replace(/\/$/, '')}/` : '';
  const imageUrl = origin ? `${origin.replace(/\/$/, '')}/logo512.png` : '';

  document.title = LANDING_PAGE_TITLE;

  setMeta('description', LANDING_PAGE_DESCRIPTION, false);
  setMeta('keywords', KEYWORDS, false);

  setMeta('og:type', 'website', true);
  setMeta('og:locale', 'es_ES', true);
  setMeta('og:title', LANDING_PAGE_TITLE, true);
  setMeta('og:description', LANDING_PAGE_DESCRIPTION, true);
  if (canonicalUrl) setMeta('og:url', canonicalUrl, true);
  if (imageUrl) {
    setMeta('og:image', imageUrl, true);
    setMeta('og:image:width', '512', true);
    setMeta('og:image:height', '512', true);
  }

  setMeta('twitter:card', 'summary_large_image', false);
  setMeta('twitter:title', LANDING_PAGE_TITLE, false);
  setMeta('twitter:description', LANDING_PAGE_DESCRIPTION, false);
  if (imageUrl) setMeta('twitter:image', imageUrl, false);

  let linkCanonical = document.querySelector('link[rel="canonical"]');
  if (canonicalUrl) {
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);
  }

  const existing = document.getElementById('landing-jsonld');
  if (existing) existing.remove();

  if (origin) {
    const script = document.createElement('script');
    script.id = 'landing-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Slot Collection Pro',
      alternateName: ['Slot Database', 'Scalextric Collection'],
      url: canonicalUrl || `${origin}/`,
      description: LANDING_PAGE_DESCRIPTION,
      inLanguage: 'es-ES',
      keywords: KEYWORDS,
    });
    document.head.appendChild(script);
  }
}
