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

const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { processVehicleImageBuffer } = require('../lib/processVehicleImageBuffer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

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

async function uploadStoreLogoBuffer(buffer, mimetype) {
  const processed = await processVehicleImageBuffer(buffer, mimetype);
  const filePath = `${STORE_LOGOS_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${processed.ext}`;
  const { error: storageError } = await supabase.storage
    .from(STORE_LOGOS_BUCKET)
    .upload(filePath, processed.buffer, {
      contentType: processed.contentType,
      upsert: false,
    });
  if (storageError) throw new Error(storageError.message);
  const { data: publicUrlData } = supabase.storage
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

async function removeStoreLogo(publicUrl) {
  const storagePath = storeLogoPathFromUrl(publicUrl);
  if (!storagePath) return;
  await supabase.storage.from(STORE_LOGOS_BUCKET).remove([storagePath]);
}

/** Verifica que el usuario autenticado tiene un perfil de vendedor aprobado. */
async function sellerGuard(req, res, next) {
  const { data: profile, error } = await supabase
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

    const { data: listings, error } = await supabase
      .from('store_listings')
      .select('id, user_id, title, url, price, currency, notes, created_at')
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
      const { data: profiles } = await supabase
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
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id ?? null;
      }
    }

    const { data: listing, error: lErr } = await supabase
      .from('store_listings')
      .select('id')
      .eq('id', id)
      .eq('active', true)
      .maybeSingle();

    if (lErr) return res.status(500).json({ error: lErr.message });
    if (!listing) return res.status(404).json({ error: 'Listado no encontrado' });

    const { error } = await supabase.from('store_listing_clicks').insert([
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
 * GET /my/profile — obtener el perfil propio (o null si no existe)
 */
router.get('/my/profile', authMiddleware, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('seller_profiles')
      .select('*')
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

    const { data: existing } = await supabase
      .from('seller_profiles')
      .select('user_id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Ya tienes un perfil de tienda. Usa PUT /my/profile para actualizarlo.' });
    }

    const { data, error } = await supabase
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
 * body: { store_name?, store_description?, store_url? }
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
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
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

      const { data: existing } = await supabase
        .from('seller_profiles')
        .select('logo_url')
        .eq('user_id', req.user.id)
        .maybeSingle();

      let logo_url;
      try {
        logo_url = await uploadStoreLogoBuffer(file.buffer, file.mimetype);
      } catch (e) {
        return res.status(400).json({ error: e.message || 'No se pudo procesar el logo' });
      }

      // Borrar logo anterior si existía
      if (existing?.logo_url) {
        await removeStoreLogo(existing.logo_url);
      }

      const { data, error } = await supabase
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
    const { data: listings, error } = await supabase
      .from('store_listings')
      .select('id, catalog_item_id, title, url, price, currency, notes, active, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!listings || listings.length === 0) return res.json([]);

    // Contar clics para cada listado del vendedor
    const listingIds = listings.map((l) => l.id);
    const { data: clicks, error: cErr } = await supabase
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
      const { data: items } = await supabase
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
    const catalog_item_id = String(req.body?.catalog_item_id ?? '').trim();
    const title = String(req.body?.title ?? '').trim();
    const url = String(req.body?.url ?? '').trim();

    if (!catalog_item_id || !isUuid(catalog_item_id)) {
      return res.status(400).json({ error: 'catalog_item_id es obligatorio y debe ser un UUID válido' });
    }
    if (!title) return res.status(400).json({ error: 'title es obligatorio' });
    if (!url) return res.status(400).json({ error: 'url es obligatorio' });

    // Verificar que el ítem existe
    const { data: item, error: iErr } = await supabase
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

    const { data, error } = await supabase
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
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data: existing, error: eErr } = await supabase
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

    const { data, error } = await supabase
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
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ error: 'ID inválido' });

    const { data: existing, error: eErr } = await supabase
      .from('store_listings')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (eErr) return res.status(500).json({ error: eErr.message });
    if (!existing) return res.status(404).json({ error: 'Listado no encontrado' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const { error } = await supabase.from('store_listings').delete().eq('id', id);
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
    const { createClient: createAdmin } = require('@supabase/supabase-js');
    const adminClient = createAdmin(process.env.SUPABASE_URL, serviceKey);

    const { data: userList, error: userErr } = await adminClient.auth.admin.listUsers();
    if (userErr) return res.status(500).json({ error: userErr.message });

    const targetUser = (userList?.users ?? []).find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (!targetUser) {
      return res.status(404).json({ error: `No se encontró ningún usuario con el email: ${email}` });
    }

    const { data: existing } = await supabase
      .from('seller_profiles')
      .select('user_id')
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        error: 'Este usuario ya tiene un perfil de tienda. Usa el botón de aprobar/revocar para cambiar su estado.',
      });
    }

    const { data, error } = await supabase
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
 * GET /admin/sellers — todos los perfiles de vendedor
 */
router.get('/admin/sellers', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seller_profiles')
      .select('user_id, store_name, store_description, store_url, logo_url, approved, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ sellers: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /admin/sellers/:userId/approve — aprobar o rechazar un vendedor
 * body: { approved: true|false }
 */
router.post('/admin/sellers/:userId/approve', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: 'userId inválido' });

    const approved = Boolean(req.body?.approved);

    const { data: existing, error: eErr } = await supabase
      .from('seller_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (eErr) return res.status(500).json({ error: eErr.message });
    if (!existing) return res.status(404).json({ error: 'Perfil de vendedor no encontrado' });

    const { data, error } = await supabase
      .from('seller_profiles')
      .update({ approved, updated_at: new Date().toISOString() })
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
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('store_listings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    // Enriquecer con nombre de tienda
    const userIds = [...new Set((data || []).map((l) => l.user_id).filter(Boolean))];
    let profilesById = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('seller_profiles')
        .select('user_id, store_name')
        .in('user_id', userIds);
      profilesById = new Map((profiles || []).map((p) => [p.user_id, p]));
    }

    // Enriquecer con nombre del ítem
    const itemIds = [...new Set((data || []).map((l) => l.catalog_item_id).filter(Boolean))];
    let itemsById = new Map();
    if (itemIds.length > 0) {
      const { data: items } = await supabase
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
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const catalogItemId = String(req.query.catalog_item_id || '').trim();

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let q = supabase
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

    let lq = supabase
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
        ? supabase.from('seller_profiles').select('user_id, store_name').in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      itemIds.length > 0
        ? supabase
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

module.exports = router;
