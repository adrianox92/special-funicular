/**
 * Store listings — monetización del catálogo.
 *
 * Rutas públicas (sin auth):
 *   GET  /catalog/:catalogItemId          — listados activos de un ítem
 *   POST /:id/click                       — registrar clic
 *
 * Rutas de vendedor aprobado (authMiddleware + sellerGuard):
 *   GET  /my                              — mis listados con click_count
 *   GET  /my/profile                      — mi perfil de tienda
 *   POST /my/profile                      — solicitar alta como vendedor
 *   PUT  /my/profile                      — actualizar perfil
 *   POST /my/profile/logo                 — subir logo
 *   POST /                                — crear listado
 *   PUT  /:id                             — editar propio
 *   DELETE /:id                           — borrar propio
 *
 * Rutas de admin (authMiddleware + assertLicenseAdmin):
 *   GET  /admin/sellers                   — todos los perfiles de vendedor
 *   POST /admin/sellers/:userId/approve   — aprobar/rechazar
 *   GET  /admin/all                       — todos los listados
 *   GET  /admin/clicks                    — stats de clics por listado
 */

const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const {
  getAnonClient,
  getServiceClient,
  createUserScopedClient,
} = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { processVehicleImageBuffer } = require('../lib/processVehicleImageBuffer');
const { buildTrackedUrl } = require('../lib/affiliateUrl');

/** Anon, sin sesión: lecturas/escrituras que RLS permite al rol anon (p. ej. listados públicos, INSERT de clics). */
const supabasePublic = getAnonClient();

/** Service role: bypass RLS. Necesario para el panel admin de tiendas (ver todos los perfiles, notas internas, etc.). */
const supabaseService = getServiceClient();

/**
 * Cliente Supabase con el JWT del usuario que llama a la API.
 * Sin esto, las políticas RLS con auth.uid() no ven al usuario y ocultan filas
 * (p. ej. perfil de tienda pendiente de aprobación).
 */
function supabaseForUser(req) {
  return createUserScopedClient(req.headers.authorization);
}

/** Operaciones de vendedor: preferir service role si está configurado; si no, JWT del usuario. */
function dbSeller(req) {
  return supabaseService || supabaseForUser(req);
}

function requireAdminDb(res) {
  if (!supabaseService) {
    res.status(503).json({
      error:
        'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. '
        + 'Es obligatoria para listar y moderar tiendas (RLS no expone todos los perfiles al rol anon).',
    });
    return null;
  }
  return supabaseService;
}

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const STORE_LOGOS_BUCKET = 'catalog-images';
const STORE_LOGOS_FOLDER = 'store-logos';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

async function uploadStoreLogoBuffer(buffer, mimetype, storageClient) {
  const client = storageClient || supabaseService || supabasePublic;
  const processed = await processVehicleImageBuffer(buffer, mimetype);
  const filePath = `${STORE_LOGOS_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${processed.ext}`;
  const { error: storageError } = await client.storage
    .from(STORE_LOGOS_BUCKET)
    .upload(filePath, processed.buffer, {
      contentType: processed.contentType,
      upsert: false,
    });
  if (storageError) throw new Error(storageError.message);
  const { data: publicUrlData } = client.storage
    .from(STORE_LOGOS_BUCKET)
    .getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

function storeLogoPathFromUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const marker = `/${STORE_LOGOS_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  let path = publicUrl.slice(idx + marker.length);
  const q = path.indexOf('?');
  if (q !== -1) path = path.slice(0, q);
  return path || null;
}

async function removeStoreLogo(publicUrl, storageClient) {
  const client = storageClient || supabaseService || supabasePublic;
  const storagePath = storeLogoPathFromUrl(publicUrl);
  if (!storagePath) return;
  await client.storage.from(STORE_LOGOS_BUCKET).remove([storagePath]);
}

/** Verifica que el usuario autenticado tiene un perfil de vendedor aprobado. */
async function sellerGuard(req, res, next) {
  const { data: profile, error } = await dbSeller(req)
    .from('seller_profiles')
    .select('approved')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!profile || !profile.approved) {
    return res.status(403).json({ error: 'Acceso restringido a vendedores aprobados' });
  }
  next();
}

// ----------------------------------------------------------------
// Rutas públicas (sin autenticación requerida)
// ----------------------------------------------------------------

/**
 * GET /catalog/:catalogItemId
 * Devuelve los listados activos de un ítem del catálogo, incluyendo datos del perfil de tienda.
 */
router.get('/catalog/:catalogItemId', async (req, res) => {
  try {
    const { catalogItemId } = req.params;
    if (!isUuid(catalogItemId)) {
      return res.status(400).json({ error: 'ID de ítem inválido' });
    }

    const { data: listings, error } = await supabasePublic
      .from('store_listings')
      .select('id, user_id, title, url, price, currency, notes, condition, created_at')
      .eq('catalog_item_id', catalogItemId)
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    if (!listings || listings.length === 0) {
      return res.json([]);
    }

    // Enriquecer con datos del perfil de tienda (nombre y logo)
    const userIds = [...new Set(listings.map((l) => l.user_id).filter(Boolean))];
    let profilesByUserId = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await supabasePublic
        .from('seller_profiles')
        .select('user_id, store_name, logo_url')
        .in('user_id', userIds)
        .eq('approved', true);
      profilesByUserId = new Map((profiles || []).map((p) => [p.user_id, p]));
    }

    const result = listings.map((l) => {
      const profile = profilesByUserId.get(l.user_id);
      return {
        id: l.id,
        title: l.title,
        url: l.url,
        price: l.price,
        currency: l.currency,
        notes: l.notes,
        condition: l.condition ?? null,
        created_at: l.created_at,
        store_name: profile?.store_name ?? null,
        store_logo_url: profile?.logo_url ?? null,
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /go/:id
 * Registra el clic con tracking enriquecido y redirige 302 a la URL destino con UTM/afiliado.
 * Si el listado no existe o está inactivo, redirige a la home del catálogo.
 */
router.get('/go/:id', async (req, res) => {
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
  const fallbackUrl  = `${frontendBase}/catalogo`;

  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.redirect(302, fallbackUrl);

    // Obtener listado + perfil de vendedor en paralelo
    const { data: listing, error: lErr } = await supabasePublic
      .from('store_listings')
      .select('id, catalog_item_id, user_id, url, active, custom_utm_campaign')
      .eq('id', id)
      .maybeSingle();

    if (lErr || !listing || !listing.active) {
      return res.redirect(302, fallbackUrl);
    }

    const { data: seller } = await supabasePublic
      .from('seller_profiles')
      .select('user_id, default_utm_source, default_utm_medium, affiliate_param_template')
      .eq('user_id', listing.user_id)
      .maybeSingle();

    const trackedUrl = buildTrackedUrl(listing, seller);

    // Registrar clic con datos enriquecidos (fire-and-forget, no bloquea redirect)
    const rawIp   = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    const salt    = process.env.IP_HASH_SALT || 'slotdb-salt';
    const ipHash  = rawIp
      ? crypto.createHash('sha256').update(rawIp + salt).digest('hex')
      : null;

    // Obtener user_id del token si existe (opcional)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token) {
        try {
          const { data: { user } } = await supabasePublic.auth.getUser(token);
          userId = user?.id ?? null;
        } catch { /* ignorar */ }
      }
    }

    supabasePublic.from('store_listing_clicks').insert([{
      listing_id:  id,
      user_id:     userId,
      session_id:  req.query?.session_id ? String(req.query.session_id).slice(0, 128) : null,
      referer:     req.headers.referer ? String(req.headers.referer).slice(0, 512) : null,
      user_agent:  req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 512) : null,
      ip_hash:     ipHash,
      redirected:  true,
    }]).then(({ error }) => {
      if (error) console.warn('[store-listings/go] click insert error:', error.message);
    });

    return res.redirect(302, trackedUrl);
  } catch (e) {
    console.error('[store-listings/go] error:', e.message);
    return res.redirect(302, fallbackUrl);
  }
});

/**
 * POST /:id/click
 * Registra un clic en un listado. body: { session_id? }
 */
router.post('/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'ID inválido' });

    // Obtener user_id del token si viene (no es obligatorio)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token) {
        const { data: { user } } = await supabasePublic.auth.getUser(token);
        userId = user?.id ?? null;
      }
    }

    const { data: listing, error: lErr } = await supabasePublic
      .from('store_listings')
      .select('id')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();

    if (lErr) return res.status(500).json({ error: lErr.message });
    if (!listing) return res.status(404).json({ error: 'Listado no encontrado' });

    const { error } = await supabasePublic.from('store_listing_clicks').insert([
      {
        listing_id: id,
        user_id: userId,
        session_id: req.body?.session_id ? String(req.body.session_id).slice(0, 128) : null,
      },
    ]);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------------------------------------------------------
// Rutas de perfil de tienda (auth requerida, no necesita ser aprobado)
// ----------------------------------------------------------------

/**
 * GET /my/profile — obtener el perfil propio (o null si no existe).
 * Devuelve rejection_reason pero NUNCA admin_notes.
 */
router.get('/my/profile', authMiddleware, async (req, res) => {
  try {
    const { data: profile, error } = await dbSeller(req)
      .from('seller_profiles')
      .select('user_id, store_name, store_description, store_url, logo_url, approved, rejection_reason, default_utm_source, default_utm_medium, affiliate_param_template, created_at, updated_at')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    res.json(profile ?? null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /my/profile — solicitar alta como vendedor (crea el perfil con approved=false)
 * body: { store_name, store_description?, store_url? }
 */
router.post('/my/profile', authMiddleware, async (req, res) => {
  try {
    const store_name = String(req.body?.store_name ?? '').trim();
    if (!store_name) {
      return res.status(400).json({ error: 'store_name es obligatorio' });
    }

    const { data: existing } = await dbSeller(req)
      .from('seller_profiles')
      .select('user_id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Ya tienes un perfil de tienda. Usa PUT /my/profile para actualizarlo.' });
    }

    const { data, error } = await dbSeller(req)
      .from('seller_profiles')
      .insert([
        {
          user_id: req.user.id,
          store_name,
          store_description: String(req.body?.store_description ?? '').trim() || null,
          store_url: String(req.body?.store_url ?? '').trim() || null,
          approved: false,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /my/profile — actualizar perfil de tienda (solo el propietario)
 * body: { store_name?, store_description?, store_url?, default_utm_source?, default_utm_medium?, affiliate_param_template? }
 */
router.put('/my/profile', authMiddleware, sellerGuard, async (req, res) => {
  try {
    const updates = {};
    if (req.body?.store_name !== undefined) {
      const s = String(req.body.store_name).trim();
      if (!s) return res.status(400).json({ error: 'store_name no puede estar vacío' });
      updates.store_name = s;
    }
    if (req.body?.store_description !== undefined) {
      updates.store_description = String(req.body.store_description).trim() || null;
    }
    if (req.body?.store_url !== undefined) {
      updates.store_url = String(req.body.store_url).trim() || null;
    }
    if (req.body?.default_utm_source !== undefined) {
      updates.default_utm_source = String(req.body.default_utm_source).trim() || 'slotdb';
    }
    if (req.body?.default_utm_medium !== undefined) {
      updates.default_utm_medium = String(req.body.default_utm_medium).trim() || 'catalog';
    }
    if (req.body?.affiliate_param_template !== undefined) {
      updates.affiliate_param_template = String(req.body.affiliate_param_template).trim() || null;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await dbSeller(req)
      .from('seller_profiles')
      .update(updates)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /my/profile/logo — subir/reemplazar logo de la tienda
 * multipart: logo (imagen)
 */
router.post(
  '/my/profile/logo',
  authMiddleware,
  sellerGuard,
  upload.single('logo'),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Archivo de logo requerido (field: logo)' });

      const db = dbSeller(req);

      const { data: existing } = await db
        .from('seller_profiles')
        .select('logo_url')
        .eq('user_id', req.user.id)
        .maybeSingle();

      let logo_url;
      try {
        logo_url = await uploadStoreLogoBuffer(file.buffer, file.mimetype, db);
      } catch (e) {
        return res.status(400).json({ error: e.message || 'No se pudo procesar el logo' });
      }

      // Borrar logo anterior si existía
      if (existing?.logo_url) {
        await removeStoreLogo(existing.logo_url, db);
      }

      const { data, error } = await db
        .from('seller_profiles')
        .update({ logo_url, updated_at: new Date().toISOString() })
        .eq('user_id', req.user.id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// ----------------------------------------------------------------
// Rutas de listados (auth + vendedor aprobado)
// ----------------------------------------------------------------

/**
 * GET /my — mis listados con total de clics por listado
 */
router.get('/my', authMiddleware, sellerGuard, async (req, res) => {
  try {
    const db = dbSeller(req);
    const { data: listings, error } = await db
      .from('store_listings')
      .select('id, catalog_item_id, title, url, price, currency, notes, active, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!listings || listings.length === 0) return res.json([]);

    // Contar clics para cada listado del vendedor
    const listingIds = listings.map((l) => l.id);
    const { data: clicks, error: cErr } = await db
      .from('store_listing_clicks')
      .select('listing_id')
      .in('listing_id', listingIds);

    if (cErr) return res.status(500).json({ error: cErr.message });

    const clickCountById = {};
    for (const c of clicks || []) {
      clickCountById[c.listing_id] = (clickCountById[c.listing_id] || 0) + 1;
    }

    // Enriquecer con nombre del ítem del catálogo
    const itemIds = [...new Set(listings.map((l) => l.catalog_item_id).filter(Boolean))];
    let itemsById = new Map();
    if (itemIds.length > 0) {
      const { data: items } = await supabasePublic
        .from('slot_catalog_items_with_ratings')
        .select('id, reference, manufacturer, model_name')
        .in('id', itemIds);
      itemsById = new Map((items || []).map((it) => [it.id, it]));
    }

    const result = listings.map((l) => ({
      ...l,
      click_count: clickCountById[l.id] || 0,
      catalog_item: itemsById.get(l.catalog_item_id) ?? null,
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST / — crear listado
 * body: { catalog_item_id, title, url, price?, currency?, notes?, active? }
 */
router.post('/', authMiddleware, sellerGuard, async (req, res) => {
  try {
    const db = dbSeller(req);
    const catalog_item_id = String(req.body?.catalog_item_id ?? '').trim();
    const title = String(req.body?.title ?? '').trim();
    const url = String(req.body?.url ?? '').trim();

    if (!catalog_item_id || !isUuid(catalog_item_id)) {
      return res.status(400).json({ error: 'catalog_item_id es obligatorio y debe ser un UUID válido' });
    }
    if (!title) return res.status(400).json({ error: 'title es obligatorio' });
    if (!url) return res.status(400).json({ error: 'url es obligatorio' });

    // Verificar que el ítem existe
    const { data: item, error: iErr } = await supabasePublic
      .from('slot_catalog_items')
      .select('id')
      .eq('id', catalog_item_id)
      .maybeSingle();
    if (iErr) return res.status(500).json({ error: iErr.message });
    if (!item) return res.status(404).json({ error: 'Ítem del catálogo no encontrado' });

    const priceRaw = req.body?.price;
    const price = priceRaw != null && priceRaw !== '' ? parseFloat(String(priceRaw)) : null;
    const currency = String(req.body?.currency ?? 'EUR').trim().toUpperCase() || 'EUR';
    const notes = String(req.body?.notes ?? '').trim() || null;
    const active = req.body?.active !== undefined ? Boolean(req.body.active) : true;
    const custom_utm_campaign = String(req.body?.custom_utm_campaign ?? '').trim() || null;
    const conditionRaw = String(req.body?.condition ?? '').trim() || null;
    const condition = ['new', 'used', 'preorder'].includes(conditionRaw) ? conditionRaw : null;

    const { data, error } = await db
      .from('store_listings')
      .insert([
        {
          catalog_item_id,
          user_id: req.user.id,
          title,
          url,
          price: Number.isFinite(price) ? price : null,
          currency,
          notes,
          active,
          custom_utm_campaign,
          condition,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /:id — editar listado propio
 */
router.put('/:id', authMiddleware, sellerGuard, async (req, res) => {
  try {
    const db = dbSeller(req);
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data: existing, error: eErr } = await db
      .from('store_listings')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (eErr) return res.status(500).json({ error: eErr.message });
    if (!existing) return res.status(404).json({ error: 'Listado no encontrado' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const updates = { updated_at: new Date().toISOString() };
    if (req.body?.title !== undefined) {
      const t = String(req.body.title).trim();
      if (!t) return res.status(400).json({ error: 'title no puede estar vacío' });
      updates.title = t;
    }
    if (req.body?.url !== undefined) {
      const u = String(req.body.url).trim();
      if (!u) return res.status(400).json({ error: 'url no puede estar vacío' });
      updates.url = u;
    }
    if (req.body?.price !== undefined) {
      const p = req.body.price != null && req.body.price !== '' ? parseFloat(String(req.body.price)) : null;
      updates.price = Number.isFinite(p) ? p : null;
    }
    if (req.body?.currency !== undefined) {
      updates.currency = String(req.body.currency).trim().toUpperCase() || 'EUR';
    }
    if (req.body?.notes !== undefined) {
      updates.notes = String(req.body.notes).trim() || null;
    }
    if (req.body?.active !== undefined) {
      updates.active = Boolean(req.body.active);
    }
    if (req.body?.custom_utm_campaign !== undefined) {
      updates.custom_utm_campaign = String(req.body.custom_utm_campaign).trim() || null;
    }
    if (req.body?.condition !== undefined) {
      const c = String(req.body.condition ?? '').trim() || null;
      updates.condition = ['new', 'used', 'preorder'].includes(c) ? c : null;
    }

    const { data, error } = await db
      .from('store_listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /:id — borrar listado propio
 */
router.delete('/:id', authMiddleware, sellerGuard, async (req, res) => {
  try {
    const db = dbSeller(req);
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data: existing, error: eErr } = await db
      .from('store_listings')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (eErr) return res.status(500).json({ error: eErr.message });
    if (!existing) return res.status(404).json({ error: 'Listado no encontrado' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const { error } = await db.from('store_listings').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------------------------------------------------------
// Rutas de administrador
// ----------------------------------------------------------------

function adminGuard(req, res, next) {
  if (!assertLicenseAdmin(req, res)) return;
  next();
}

/**
 * POST /admin/sellers — el admin crea una tienda directamente (ya aprobada) para un usuario
 * body: { email, store_name, store_description?, store_url? }
 * Busca al usuario por email usando la service role key y crea su perfil aprobado.
 */
router.post('/admin/sellers', authMiddleware, adminGuard, async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const store_name = String(req.body?.store_name ?? '').trim();

    if (!email) return res.status(400).json({ error: 'email es obligatorio' });
    if (!store_name) return res.status(400).json({ error: 'store_name es obligatorio' });

    // Necesita la service role key para buscar usuarios por email
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' });
    }
    const adminClient = getServiceClient();
    if (!adminClient) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' });
    }

    const { data: userList, error: userErr } = await adminClient.auth.admin.listUsers();
    if (userErr) return res.status(500).json({ error: userErr.message });

    const targetUser = (userList?.users ?? []).find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (!targetUser) {
      return res.status(404).json({ error: `No se encontró ningún usuario con el email: ${email}` });
    }

    const { data: existing } = await adminClient
      .from('seller_profiles')
      .select('user_id')
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        error: 'Este usuario ya tiene un perfil de tienda. Usa el botón de aprobar/revocar para cambiar su estado.',
      });
    }

    const { data, error } = await adminClient
      .from('seller_profiles')
      .insert([
        {
          user_id: targetUser.id,
          store_name,
          store_description: String(req.body?.store_description ?? '').trim() || null,
          store_url: String(req.body?.store_url ?? '').trim() || null,
          approved: true,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /admin/sellers — todos los perfiles de vendedor (incluye rejection_reason y admin_notes)
 */
router.get('/admin/sellers', authMiddleware, adminGuard, async (req, res) => {
  try {
    const adminDb = requireAdminDb(res);
    if (!adminDb) return;

    const { data, error } = await adminDb
      .from('seller_profiles')
      .select('user_id, store_name, store_description, store_url, logo_url, approved, rejection_reason, admin_notes, reviewed_at, reviewed_by, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ sellers: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /admin/sellers/:userId/approve — aprobar o rechazar un vendedor
 * body: { approved: true|false, rejection_reason?: string, admin_notes?: string }
 */
router.post('/admin/sellers/:userId/approve', authMiddleware, adminGuard, async (req, res) => {
  try {
    const adminDb = requireAdminDb(res);
    if (!adminDb) return;

    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: 'userId inválido' });

    const approved = Boolean(req.body?.approved);

    const { data: existing, error: eErr } = await adminDb
      .from('seller_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (eErr) return res.status(500).json({ error: eErr.message });
    if (!existing) return res.status(404).json({ error: 'Perfil de vendedor no encontrado' });

    const updates = {
      approved,
      updated_at:  new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user.id,
    };

    if (req.body?.rejection_reason !== undefined) {
      updates.rejection_reason = approved
        ? null
        : (String(req.body.rejection_reason ?? '').trim() || null);
    }
    if (req.body?.admin_notes !== undefined) {
      updates.admin_notes = String(req.body.admin_notes ?? '').trim() || null;
    }

    const { data, error } = await adminDb
      .from('seller_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /admin/all — todos los listados (con info del ítem)
 */
router.get('/admin/all', authMiddleware, adminGuard, async (req, res) => {
  try {
    const adminDb = requireAdminDb(res);
    if (!adminDb) return;

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await adminDb
      .from('store_listings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    // Enriquecer con nombre de tienda
    const userIds = [...new Set((data || []).map((l) => l.user_id).filter(Boolean))];
    let profilesById = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await adminDb
        .from('seller_profiles')
        .select('user_id, store_name')
        .in('user_id', userIds);
      profilesById = new Map((profiles || []).map((p) => [p.user_id, p]));
    }

    // Enriquecer con nombre del ítem
    const itemIds = [...new Set((data || []).map((l) => l.catalog_item_id).filter(Boolean))];
    let itemsById = new Map();
    if (itemIds.length > 0) {
      const { data: items } = await supabasePublic
        .from('slot_catalog_items_with_ratings')
        .select('id, reference, manufacturer, model_name')
        .in('id', itemIds);
      itemsById = new Map((items || []).map((it) => [it.id, it]));
    }

    const result = (data || []).map((l) => ({
      ...l,
      store_name: profilesById.get(l.user_id)?.store_name ?? null,
      catalog_item: itemsById.get(l.catalog_item_id) ?? null,
    }));

    res.json({
      listings: result,
      total: count ?? 0,
      page,
      limit,
      totalPages: count != null ? Math.ceil(count / limit) : 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /admin/clicks — clics agrupados por listado (últimos N días o todos)
 * query: days=30 (por defecto), catalog_item_id (opcional)
 */
router.get('/admin/clicks', authMiddleware, adminGuard, async (req, res) => {
  try {
    const adminDb = requireAdminDb(res);
    if (!adminDb) return;

    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const catalogItemId = String(req.query.catalog_item_id || '').trim();

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let q = adminDb
      .from('store_listing_clicks')
      .select('listing_id, clicked_at')
      .gte('clicked_at', since);

    const { data: clicks, error: cErr } = await q;
    if (cErr) return res.status(500).json({ error: cErr.message });

    // Agrupar por listing_id
    const countById = {};
    for (const c of clicks || []) {
      countById[c.listing_id] = (countById[c.listing_id] || 0) + 1;
    }

    // Recuperar listados correspondientes
    const listingIds = Object.keys(countById);
    if (listingIds.length === 0) return res.json({ stats: [] });

    let lq = adminDb
      .from('store_listings')
      .select('id, catalog_item_id, user_id, title, url, active')
      .in('id', listingIds);

    if (catalogItemId && isUuid(catalogItemId)) {
      lq = lq.eq('catalog_item_id', catalogItemId);
    }

    const { data: listings, error: lErr } = await lq;
    if (lErr) return res.status(500).json({ error: lErr.message });

    // Enriquecer con nombre de tienda e ítem
    const userIds = [...new Set((listings || []).map((l) => l.user_id).filter(Boolean))];
    const itemIds = [...new Set((listings || []).map((l) => l.catalog_item_id).filter(Boolean))];

    const [profilesRes, itemsRes] = await Promise.all([
      userIds.length > 0
        ? adminDb.from('seller_profiles').select('user_id, store_name').in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      itemIds.length > 0
        ? supabasePublic
            .from('slot_catalog_items_with_ratings')
            .select('id, reference, manufacturer, model_name')
            .in('id', itemIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profilesById = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
    const itemsById = new Map((itemsRes.data || []).map((it) => [it.id, it]));

    const stats = (listings || []).map((l) => ({
      listing_id: l.id,
      title: l.title,
      url: l.url,
      active: l.active,
      click_count: countById[l.id] || 0,
      store_name: profilesById.get(l.user_id)?.store_name ?? null,
      catalog_item: itemsById.get(l.catalog_item_id) ?? null,
    }));

    stats.sort((a, b) => b.click_count - a.click_count);

    res.json({ stats, days, since });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------------------------------------------------------
// Rutas de políticas públicas
// ----------------------------------------------------------------

/**
 * GET /public/policies/:slug — obtener texto legal por slug (sin auth)
 */
router.get('/public/policies/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'slug requerido' });

    const { data, error } = await supabasePublic
      .from('site_policies')
      .select('slug, title, content_md, updated_at')
      .eq('slug', slug)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'Política no encontrada' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /admin/policies — listar todas las políticas (solo admin)
 */
router.get('/admin/policies', authMiddleware, adminGuard, async (req, res) => {
  try {
    const adminDb = requireAdminDb(res);
    if (!adminDb) return;

    const { data, error } = await adminDb
      .from('site_policies')
      .select('slug, title, content_md, updated_at')
      .order('slug');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ policies: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /admin/policies/:slug — crear o actualizar una política (solo admin)
 * body: { title?, content_md? }
 */
router.put('/admin/policies/:slug', authMiddleware, adminGuard, async (req, res) => {
  try {
    const adminDb = requireAdminDb(res);
    if (!adminDb) return;

    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'slug requerido' });

    const updates = { slug, updated_at: new Date().toISOString() };
    if (req.body?.title !== undefined)      updates.title      = String(req.body.title      ?? '').trim();
    if (req.body?.content_md !== undefined) updates.content_md = String(req.body.content_md ?? '').trim();

    const { data, error } = await adminDb
      .from('site_policies')
      .upsert(updates, { onConflict: 'slug' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
