/**
 * Búsquedas de precio («Lo busco») sobre una referencia del catálogo.
 *
 *   GET    /?catalogItemId=
 *   POST   /                 { catalogItemId, maxPrice }
 *   DELETE /:id
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const { getServiceClient, createUserScopedClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { normalizePrice } = require('../lib/shopOfferSync');
const { matchPublicOffersForWatch } = require('../lib/priceWatchMatch');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

function userDb(req) {
  return createUserScopedClient(req.headers.authorization);
}

function requireServiceDb(res) {
  const db = getServiceClient();
  if (!db) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' });
    return null;
  }
  return db;
}

function toWatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    catalog_item_id: row.catalog_item_id,
    max_price: row.max_price,
    currency: row.currency,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.use(authMiddleware);

router.get(
  '/',
  query('catalogItemId').custom((value) => isUuid(value)).withMessage('catalogItemId inválido'),
  handleValidationErrors,
  async (req, res) => {
    const db = userDb(req);
    const { data, error } = await db
      .from('catalog_price_watches')
      .select('id, catalog_item_id, max_price, currency, created_at, updated_at')
      .eq('user_id', req.user.id)
      .eq('catalog_item_id', req.query.catalogItemId)
      .maybeSingle();
    if (error) {
      console.error('[catalog-watches] get', error);
      return res.status(500).json({ error: 'No se pudo cargar la búsqueda' });
    }
    return res.json({ watch: toWatch(data) });
  },
);

router.post(
  '/',
  body('catalogItemId').custom((value) => isUuid(value)).withMessage('catalogItemId inválido'),
  body('maxPrice')
    .custom((value) => {
      const price = normalizePrice(value);
      return price != null && price > 0 && price <= 99999999.99;
    })
    .withMessage('Indica un precio mayor que 0'),
  handleValidationErrors,
  async (req, res) => {
    const svc = requireServiceDb(res);
    if (!svc) return;

    const catalogItemId = req.body.catalogItemId;
    const maxPrice = normalizePrice(req.body.maxPrice);

    const { data: item, error: itemErr } = await svc
      .from('slot_catalog_items')
      .select('id')
      .eq('id', catalogItemId)
      .maybeSingle();
    if (itemErr) {
      console.error('[catalog-watches] item', itemErr);
      return res.status(500).json({ error: 'No se pudo comprobar la referencia' });
    }
    if (!item) return res.status(404).json({ error: 'La referencia no está en el catálogo' });

    const db = userDb(req);
    const { data, error } = await db
      .from('catalog_price_watches')
      .upsert(
        {
          user_id: req.user.id,
          catalog_item_id: catalogItemId,
          max_price: maxPrice,
          currency: 'EUR',
        },
        { onConflict: 'user_id,catalog_item_id' },
      )
      .select('id, user_id, catalog_item_id, max_price, currency, created_at, updated_at')
      .single();
    if (error) {
      console.error('[catalog-watches] upsert', error);
      return res.status(500).json({ error: 'No se pudo guardar la búsqueda' });
    }

    let noticesCreated = 0;
    try {
      noticesCreated = await matchPublicOffersForWatch(svc, data);
    } catch (err) {
      console.error('[catalog-watches] match', err);
      return res.status(500).json({ error: 'La búsqueda se guardó, pero no se pudieron revisar las tiendas' });
    }

    return res.status(201).json({ watch: toWatch(data), noticesCreated });
  },
);

router.delete(
  '/:id',
  param('id').custom((value) => isUuid(value)).withMessage('id inválido'),
  handleValidationErrors,
  async (req, res) => {
    const db = userDb(req);
    const { data, error } = await db
      .from('catalog_price_watches')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id');
    if (error) {
      console.error('[catalog-watches] delete', error);
      return res.status(500).json({ error: 'No se pudo quitar la búsqueda' });
    }
    const removed = Array.isArray(data) ? data[0] : data;
    if (!removed) return res.status(404).json({ error: 'No hay ninguna búsqueda con ese id' });
    return res.json({ ok: true });
  },
);

module.exports = router;
