/**
 * affiliateUrl.js
 *
 * buildTrackedUrl(listing, seller) → string
 *
 * Compone la URL destino de un listado añadiendo:
 *   - Parámetros UTM (utm_source, utm_medium, utm_campaign, utm_content)
 *   - Parámetro de afiliado del vendedor (affiliate_param_template)
 *
 * Reglas:
 *   - Nunca sobreescribe parámetros UTM ya presentes en la URL original.
 *   - Preserva el hash (#fragment) al final.
 *   - Si la URL base está malformada, la devuelve sin modificar.
 *   - affiliate_param_template puede ser "aff=XYZ", "tag=ABC" o cualquier
 *     par key=value; si la clave ya existe en la URL no se duplica.
 */

function buildTrackedUrl(listing, seller) {
  if (!listing?.url) return listing?.url ?? '';

  let parsed;
  try {
    parsed = new URL(listing.url);
  } catch {
    return listing.url;
  }

  const params = parsed.searchParams;

  // -- UTM ---------------------------------------------------------------
  const utmSource   = seller?.default_utm_source   || 'slotdb';
  const utmMedium   = seller?.default_utm_medium   || 'catalog';
  const utmCampaign = listing.custom_utm_campaign  || `listing_${listing.id}`;
  const utmContent  = seller?.user_id              || undefined;

  if (!params.has('utm_source'))   params.set('utm_source',   utmSource);
  if (!params.has('utm_medium'))   params.set('utm_medium',   utmMedium);
  if (!params.has('utm_campaign')) params.set('utm_campaign', utmCampaign);
  if (utmContent && !params.has('utm_content')) {
    params.set('utm_content', utmContent);
  }

  // -- Parámetro de afiliado ---------------------------------------------
  const tpl = seller?.affiliate_param_template?.trim();
  if (tpl) {
    const eqIdx = tpl.indexOf('=');
    if (eqIdx > 0) {
      const affKey = tpl.slice(0, eqIdx).trim();
      const affVal = tpl.slice(eqIdx + 1).trim();
      if (affKey && !params.has(affKey)) {
        params.set(affKey, affVal);
      }
    }
  }

  return parsed.toString();
}

module.exports = { buildTrackedUrl };
