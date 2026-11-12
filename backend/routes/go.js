/**
 * GET /api/go/:code
 * Acortador en el dominio del sitio (rewrite de Vercel /go/:code).
 * Registra el clic y responde 302 a la ficha de la tienda.
 * Sin stock, manda a la ficha del catálogo y no cuenta el clic.
 */

const crypto = require('crypto');
const express = require('express');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const { resolveGoTarget } = require('../lib/goTarget');
const { resolveAuthUser } = require('../lib/resolveAuthUser');

const router = express.Router();

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function optionalUserId(authHeader) {
  if (!authHeader) return null;
  const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const { user, error } = await resolveAuthUser(getAnonClient(), token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

router.get('/:code', async (req, res) => {
  const base = frontendBase();
  const code = String(req.params.code || '');
  if (!/^[A-Za-z0-9]{7}$/.test(code)) {
    return res.redirect(302, `${base}/catalogo`);
  }

  const db = getServiceClient();
  if (!db) return res.redirect(302, `${base}/catalogo`);

  try {
    const { data: offer, error } = await db
      .from('catalog_shop_offers')
      .select('id, catalog_item_id, product_url, in_stock, last_checked_at, catalog_shops(id, active)')
      .eq('short_code', code)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const shop = Array.isArray(offer?.catalog_shops)
      ? offer.catalog_shops[0]
      : offer?.catalog_shops;
    const target = resolveGoTarget({ offer, shop, frontendBase: base });

    if (target.recordClick && offer) {
      const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || '';
      const salt = process.env.IP_HASH_SALT || 'slotdb-salt';
      const ipHash = rawIp
        ? crypto.createHash('sha256').update(rawIp + salt).digest('hex')
        : null;
      const userId = await optionalUserId(req.headers.authorization);
      db.from('catalog_shop_offer_clicks').insert([{
        offer_id: offer.id,
        user_id: userId,
        referer: req.headers.referer ? String(req.headers.referer).slice(0, 512) : null,
        user_agent: req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 512) : null,
        ip_hash: ipHash,
      }]).then(({ error: clickError }) => {
        if (clickError) console.warn('[go] click insert error:', clickError.message);
      });
    }

    return res.redirect(302, target.redirect);
  } catch (err) {
    console.error('[go] error:', err.message);
    return res.redirect(302, `${base}/catalogo`);
  }
});

module.exports = router;
