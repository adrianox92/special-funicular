/**
 * Changelog in-app (novedades).
 *
 * Público (autenticado):
 *   GET  /              — entradas publicadas
 *   GET  /unread-count  — novedades no leídas desde last_seen_at
 *   POST /mark-read     — marcar como leídas
 *
 * Admin (LICENSE_ADMIN_EMAILS + SUPABASE_SERVICE_ROLE_KEY):
 *   GET    /admin
 *   POST   /admin
 *   PUT    /admin/:id
 *   DELETE /admin/:id
 *   POST   /admin/:id/publish
 *   POST   /admin/:id/unpublish
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getServiceClient,
  createUserScopedClient,
} = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { handleValidationErrors } = require('../middleware/validateRequest');

const router = express.Router();

const CATEGORIES = ['feature', 'fix', 'improvement', 'breaking'];

function requireServiceDb(res) {
  const svc = getServiceClient();
  if (!svc) {
    res.status(503).json({
      error:
        'SUPABASE_SERVICE_ROLE_KEY no está configurada. Es obligatoria para administrar el changelog.',
    });
    return null;
  }
  return svc;
}

function userDb(req) {
  return createUserScopedClient(req.headers.authorization);
}

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

function licenseAdminOnly(req, res, next) {
  if (!assertLicenseAdmin(req, res)) return;
  next();
}

router.use(authMiddleware);

router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors,
  async (req, res) => {
    const limit = req.query.limit ?? 20;
    const db = userDb(req);
    const { data, error } = await db
      .from('changelog_entries')
      .select(
        'id, version, title, body_md, category, is_featured, published_at, created_at, updated_at',
      )
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[changelog] list', error);
      return res.status(500).json({ error: 'No se pudo cargar el changelog' });
    }
    return res.json({ entries: data || [] });
  },
);

router.get('/unread-count', async (req, res) => {
  const userId = req.user.id;
  const db = userDb(req);

  const { data: readRow, error: readErr } = await db
    .from('user_changelog_reads')
    .select('last_seen_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) {
    console.error('[changelog] unread read row', readErr);
    return res.status(500).json({ error: 'No se pudo calcular novedades' });
  }

  const userCreatedMs = req.user.created_at
    ? new Date(req.user.created_at).getTime()
    : Date.now();
  const floor90Ms = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const baselineMs = readRow?.last_seen_at
    ? new Date(readRow.last_seen_at).getTime()
    : Math.max(userCreatedMs, floor90Ms);
  const baselineIso = new Date(baselineMs).toISOString();
  const nowIso = new Date().toISOString();

  const { count, error: countErr } = await db
    .from('changelog_entries')
    .select('*', { count: 'exact', head: true })
    .gt('published_at', baselineIso)
    .lte('published_at', nowIso);

  if (countErr) {
    console.error('[changelog] unread count', countErr);
    return res.status(500).json({ error: 'No se pudo calcular novedades' });
  }

  return res.json({ count: count ?? 0 });
});

router.post('/mark-read', async (req, res) => {
  const userId = req.user.id;
  const db = userDb(req);
  const now = new Date().toISOString();

  const { error } = await db.from('user_changelog_reads').upsert(
    {
      user_id: userId,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.error('[changelog] mark-read', error);
    return res.status(500).json({ error: 'No se pudo guardar el estado de lectura' });
  }
  return res.json({ ok: true });
});

router.get('/admin', licenseAdminOnly, async (req, res) => {
  const svc = requireServiceDb(res);
  if (!svc) return;

  const { data, error } = await svc
    .from('changelog_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[changelog] admin list', error);
    return res.status(500).json({ error: 'No se pudo cargar el changelog (admin)' });
  }
  return res.json({ entries: data || [] });
});

router.post(
  '/admin',
  licenseAdminOnly,
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Título obligatorio (máx. 200).'),
  body('body_md').optional().isString().isLength({ max: 50000 }),
  body('version').optional().trim().isLength({ max: 50 }),
  body('category').optional().isIn(CATEGORIES),
  body('is_featured').optional().isBoolean(),
  handleValidationErrors,
  async (req, res) => {
    const svc = requireServiceDb(res);
    if (!svc) return;

    const row = {
      title: req.body.title,
      body_md: typeof req.body.body_md === 'string' ? req.body.body_md : '',
      version: req.body.version?.trim() || null,
      category: CATEGORIES.includes(req.body.category) ? req.body.category : 'feature',
      is_featured: Boolean(req.body.is_featured),
      published_at: null,
    };

    const { data, error } = await svc.from('changelog_entries').insert(row).select('*').single();

    if (error) {
      console.error('[changelog] admin create', error);
      return res.status(500).json({ error: 'No se pudo crear la entrada' });
    }
    return res.status(201).json({ entry: data });
  },
);

router.put(
  '/admin/:id',
  licenseAdminOnly,
  param('id').custom((v) => isUuid(v)).withMessage('id inválido'),
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('body_md').optional().isString().isLength({ max: 50000 }),
  body('version').optional().trim().isLength({ max: 50 }),
  body('category').optional().isIn(CATEGORIES),
  body('is_featured').optional().isBoolean(),
  handleValidationErrors,
  async (req, res) => {
    const svc = requireServiceDb(res);
    if (!svc) return;

    const patch = { updated_at: new Date().toISOString() };
    if (req.body.title != null) patch.title = req.body.title;
    if (req.body.body_md != null) patch.body_md = req.body.body_md;
    if (req.body.version !== undefined) patch.version = req.body.version?.trim() || null;
    if (req.body.category != null) patch.category = req.body.category;
    if (req.body.is_featured != null) patch.is_featured = req.body.is_featured;

    const { data, error } = await svc
      .from('changelog_entries')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[changelog] admin update', error);
      return res.status(500).json({ error: 'No se pudo actualizar la entrada' });
    }
    if (!data) return res.status(404).json({ error: 'Entrada no encontrada' });
    return res.json({ entry: data });
  },
);

router.delete(
  '/admin/:id',
  licenseAdminOnly,
  param('id').custom((v) => isUuid(v)).withMessage('id inválido'),
  handleValidationErrors,
  async (req, res) => {
    const svc = requireServiceDb(res);
    if (!svc) return;

    const { data: deletedRows, error } = await svc
      .from('changelog_entries')
      .delete()
      .eq('id', req.params.id)
      .select('id');

    if (error) {
      console.error('[changelog] admin delete', error);
      return res.status(500).json({ error: 'No se pudo eliminar la entrada' });
    }
    if (!deletedRows?.length) return res.status(404).json({ error: 'Entrada no encontrada' });
    return res.json({ ok: true });
  },
);

router.post(
  '/admin/:id/publish',
  licenseAdminOnly,
  param('id').custom((v) => isUuid(v)).withMessage('id inválido'),
  handleValidationErrors,
  async (req, res) => {
    const svc = requireServiceDb(res);
    if (!svc) return;

    const now = new Date().toISOString();
    const { data, error } = await svc
      .from('changelog_entries')
      .update({ published_at: now, updated_at: now })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[changelog] admin publish', error);
      return res.status(500).json({ error: 'No se pudo publicar' });
    }
    if (!data) return res.status(404).json({ error: 'Entrada no encontrada' });
    return res.json({ entry: data });
  },
);

router.post(
  '/admin/:id/unpublish',
  licenseAdminOnly,
  param('id').custom((v) => isUuid(v)).withMessage('id inválido'),
  handleValidationErrors,
  async (req, res) => {
    const svc = requireServiceDb(res);
    if (!svc) return;

    const now = new Date().toISOString();
    const { data, error } = await svc
      .from('changelog_entries')
      .update({ published_at: null, updated_at: now })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[changelog] admin unpublish', error);
      return res.status(500).json({ error: 'No se pudo despublicar' });
    }
    if (!data) return res.status(404).json({ error: 'Entrada no encontrada' });
    return res.json({ entry: data });
  },
);

module.exports = router;
