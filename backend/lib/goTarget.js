const { isPublicOffer } = require('./shopOfferSync');

function catalogHome(frontendBase) {
  return `${String(frontendBase || '').replace(/\/$/, '')}/catalogo`;
}

/**
 * Destino del acortador. Solo cuenta el clic si la oferta sigue en stock.
 * @returns {{ redirect: string, recordClick: boolean }}
 */
function resolveGoTarget({ offer, shop, now = new Date(), frontendBase }) {
  const home = catalogHome(frontendBase);
  if (!offer) return { redirect: home, recordClick: false };
  if (!isPublicOffer(offer, shop, now)) {
    const itemUrl = offer.catalog_item_id
      ? `${home}/${offer.catalog_item_id}`
      : home;
    return { redirect: itemUrl, recordClick: false };
  }
  return { redirect: offer.product_url, recordClick: true };
}

module.exports = {
  catalogHome,
  resolveGoTarget,
};
