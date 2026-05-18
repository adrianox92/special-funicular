/**
 * Clubes: CRUD mínimo, invitaciones por token, miembros.
 * Usa service role tras validar JWT (evita depender de RLS en todas las tablas).
 */
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { body, param } = require('express-validator');
const { getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { uploadClubPdf, removeClubDocument } = require('../lib/clubDocumentUpload');
const { ALLOWED_CLUB_EVENT_CATEGORIES, normalizeClubEventCategory } = require('../lib/clubEventCategories');

const router = express.Router();

/** SELECT de filas club_events devueltas al cliente (debe incluir event_category). */
const CLUB_EVENT_LIST_SELECT =
  'id, club_id, user_id, title, description, event_date, start_time, end_time, location, competition_id, event_category, created_at, competitions ( id, name, public_slug )';

/** Normaliza campo time opcional desde JSON (HH:mm o HH:mm:ss → HH:mm:ss). */
function parseBodyTime(val) {
  if (val === undefined) return { omit: true };
  if (val == null || val === '') return { value: null };
  const s = String(val).trim();
  const m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return { error: 'Formato de hora inválido (HH:mm)' };
  const hh = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const ss = (m[3] || '00').padStart(2, '0');
  return { value: `${hh}:${mm}:${ss}` };
}

function validateEventTimes(startVal, endVal) {
  if (endVal && !startVal) return 'La hora de fin requiere hora de inicio';
  if (startVal && endVal) {
    const toSec = (t) => {
      const [h, mi, se] = t.split(':').map(Number);
      return h * 3600 + mi * 60 + se;
    };
    if (toSec(endVal) <= toSec(startVal)) return 'La hora de fin debe ser posterior a la de inicio';
  }
  return null;
}

const supabaseAdmin = getServiceClient();

const CLUB_PDF_MAX = 6 * 1024 * 1024;
const CLUB_BOARD_SELECT_PUBLIC =
  'id, club_id, user_id, title, body, link_url, link_label, document_url, document_label, pinned, sort_order, is_public, created_at, updated_at';

const clubBoardPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CLUB_PDF_MAX },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'));
  },
});

function stripSensitiveClubRow(row) {
  if (!row || typeof row !== 'object') return row;
  const { calendar_feed_token: _cf, ...rest } = row;
  return rest;
}

function getApiPublicBase() {
  if (process.env.PUBLIC_API_URL) return String(process.env.PUBLIC_API_URL).replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://api.slotdatabase.es';
  return 'http://localhost:5001';
}

function buildCalendarFeedUrl(clubId, token) {
  return `${getApiPublicBase()}/api/public/clubs/${clubId}/calendar.ics?token=${encodeURIComponent(token)}`;
}

async function assertCompetitionBelongsToClub(competitionId, clubId) {
  const { data } = await supabaseAdmin
    .from('competitions')
    .select('id, club_id')
    .eq('id', competitionId)
    .maybeSingle();
  if (!data) return { ok: false, error: 'Competición no encontrada' };
  if (data.club_id !== clubId) return { ok: false, error: 'La competición no pertenece a este club' };
  return { ok: true };
}

function slugifyBase(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

function randomSlugSuffix() {
  return crypto.randomBytes(4).toString('hex');
}

async function userOwnsClub(userId, clubId) {
  const { data } = await supabaseAdmin
    .from('clubs')
    .select('id')
    .eq('id', clubId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function userIsClubAdmin(userId, clubId) {
  if (await userOwnsClub(userId, clubId)) return true;
  const { data } = await supabaseAdmin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return Boolean(data);
}

async function userIsClubMember(userId, clubId) {
  if (await userOwnsClub(userId, clubId)) return true;
  const { data } = await supabaseAdmin
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data?.id);
}

router.use(authMiddleware);

router.post(
  '/',
  body('name').trim().notEmpty().isLength({ max: 200 }),
  body('license_installations_max').optional().isInt({ min: 1, max: 500 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const name = req.body.name.trim();
      const licenseMax = req.body.license_installations_max != null
        ? parseInt(String(req.body.license_installations_max), 10)
        : 10;

      let slug = `${slugifyBase(name)}-${randomSlugSuffix()}`;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: existing } = await supabaseAdmin.from('clubs').select('id').eq('slug', slug).maybeSingle();
        if (!existing) break;
        slug = `${slugifyBase(name)}-${randomSlugSuffix()}`;
      }

      const { data: club, error } = await supabaseAdmin
        .from('clubs')
        .insert({
          name,
          slug,
          owner_user_id: req.user.id,
          license_installations_max: licenseMax,
        })
        .select()
        .single();

      if (error) {
        console.error('POST /clubs', error);
        return res.status(500).json({ error: error.message });
      }

      await supabaseAdmin.from('club_members').insert({
        club_id: club.id,
        user_id: req.user.id,
        role: 'admin',
      });

      res.status(201).json(club);
    } catch (e) {
      console.error('POST /clubs', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.get('/mine', async (req, res) => {
  try {
    const { data: owned } = await supabaseAdmin
      .from('clubs')
      .select('*')
      .eq('owner_user_id', req.user.id);

    const { data: memberships } = await supabaseAdmin
      .from('club_members')
      .select('club_id, role, joined_at, clubs(*)')
      .eq('user_id', req.user.id);

    const fromMembership = (memberships || [])
      .map((m) => {
        const c = m.clubs;
        if (!c) return null;
        return { ...stripSensitiveClubRow(c), my_role: m.role, joined_at: m.joined_at };
      })
      .filter(Boolean);

    const byId = new Map();
    for (const c of owned || []) {
      byId.set(c.id, { ...stripSensitiveClubRow(c), my_role: 'admin' });
    }
    for (const c of fromMembership) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }

    res.json([...byId.values()]);
  } catch (e) {
    console.error('GET /clubs/mine', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/members', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await userIsClubMember(req.user.id, id);
    if (!ok) return res.status(404).json({ error: 'Club no encontrado' });

    const { data: clubRow, error: clubErr } = await supabaseAdmin
      .from('clubs')
      .select('owner_user_id')
      .eq('id', id)
      .maybeSingle();
    if (clubErr || !clubRow) return res.status(404).json({ error: 'Club no encontrado' });

    const { data: rows, error } = await supabaseAdmin
      .from('club_members')
      .select('id, user_id, role, joined_at')
      .eq('club_id', id)
      .order('joined_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const members = [];
    for (const row of rows || []) {
      let email = null;
      try {
        const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        if (uErr) {
          console.error('GET /clubs/:id/members getUserById', row.user_id, uErr);
        } else {
          email = u?.user?.email ?? null;
        }
      } catch (authErr) {
        console.error('GET /clubs/:id/members getUserById', row.user_id, authErr);
      }
      members.push({
        id: row.id,
        user_id: row.user_id,
        email,
        role: row.role,
        joined_at: row.joined_at,
        is_owner: row.user_id === clubRow.owner_user_id,
      });
    }

    res.json({ members, owner_user_id: clubRow.owner_user_id });
  } catch (e) {
    console.error('GET /clubs/:id/members', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/events', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await userIsClubMember(req.user.id, id);
    if (!ok) return res.status(404).json({ error: 'Club no encontrado' });

    const showAll = req.query.all === 'true';
    const todayStr = new Date().toISOString().slice(0, 10);

    let query = supabaseAdmin
      .from('club_events')
      .select(CLUB_EVENT_LIST_SELECT)
      .eq('club_id', id);
    if (!showAll) {
      query = query.gte('event_date', todayStr);
    }
    const { data: events, error } = await query
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(events || []);
  } catch (e) {
    console.error('GET /clubs/:id/events', e);
    res.status(500).json({ error: e.message });
  }
});

router.post(
  '/:id/events',
  param('id').isUUID(),
  body('title').trim().notEmpty().isLength({ max: 300 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('event_date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('location').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('competition_id').optional({ values: 'falsy' }).isUUID(),
  body('start_time').optional({ nullable: true }),
  body('end_time').optional({ nullable: true }),
  body('event_category').optional({ values: 'falsy' }).isIn(ALLOWED_CLUB_EVENT_CATEGORIES),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const event_category = normalizeClubEventCategory(req.body.event_category);

      const title = req.body.title.trim();
      const description = req.body.description != null && String(req.body.description).trim() !== ''
        ? String(req.body.description).trim()
        : null;
      const event_date = req.body.event_date;
      const location = req.body.location != null && String(req.body.location).trim() !== ''
        ? String(req.body.location).trim()
        : null;
      let competition_id = req.body.competition_id != null && String(req.body.competition_id).trim() !== ''
        ? String(req.body.competition_id).trim()
        : null;
      if (competition_id) {
        const v = await assertCompetitionBelongsToClub(competition_id, id);
        if (!v.ok) return res.status(400).json({ error: v.error });
      }

      const st = parseBodyTime(req.body.start_time);
      const et = parseBodyTime(req.body.end_time);
      if (st.error) return res.status(400).json({ error: st.error });
      if (et.error) return res.status(400).json({ error: et.error });
      const start_time = st.omit ? null : st.value;
      const end_time = et.omit ? null : et.value;
      const timeErr = validateEventTimes(start_time, end_time);
      if (timeErr) return res.status(400).json({ error: timeErr });

      const { data: row, error } = await supabaseAdmin
        .from('club_events')
        .insert({
          club_id: id,
          user_id: req.user.id,
          title,
          description,
          event_date,
          start_time,
          end_time,
          location,
          competition_id,
          event_category,
        })
        .select(CLUB_EVENT_LIST_SELECT)
        .single();

      if (error) {
        console.error('POST /clubs/:id/events', error);
        return res.status(500).json({ error: error.message });
      }
      res.status(201).json(row);
    } catch (e) {
      console.error('POST /clubs/:id/events', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  '/:id/events/:eventId',
  param('id').isUUID(),
  param('eventId').isUUID(),
  body('title').optional().trim().notEmpty().isLength({ max: 300 }),
  body('description').optional({ nullable: true }).trim().isLength({ max: 5000 }),
  body('event_date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('location').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('competition_id').optional({ values: 'falsy' }).isUUID(),
  body('start_time').optional({ nullable: true }),
  body('end_time').optional({ nullable: true }),
  body('event_category').optional({ values: 'falsy', nullable: true }).isIn(ALLOWED_CLUB_EVENT_CATEGORIES),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id, eventId } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const { data: existing, error: exErr } = await supabaseAdmin
        .from('club_events')
        .select('id, start_time, end_time')
        .eq('id', eventId)
        .eq('club_id', id)
        .maybeSingle();
      if (exErr || !existing) return res.status(404).json({ error: 'Evento no encontrado' });

      const patch = {};
      if (req.body.title != null) patch.title = String(req.body.title).trim();
      if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
        patch.description = req.body.description != null && String(req.body.description).trim() !== ''
          ? String(req.body.description).trim()
          : null;
      }
      if (req.body.event_date != null) patch.event_date = req.body.event_date;
      if (Object.prototype.hasOwnProperty.call(req.body, 'location')) {
        patch.location = req.body.location != null && String(req.body.location).trim() !== ''
          ? String(req.body.location).trim()
          : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'competition_id')) {
        const raw = req.body.competition_id;
        if (raw != null && String(raw).trim() !== '') {
          const compId = String(raw).trim();
          const v = await assertCompetitionBelongsToClub(compId, id);
          if (!v.ok) return res.status(400).json({ error: v.error });
          patch.competition_id = compId;
        } else {
          patch.competition_id = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'event_category')) {
        const raw = req.body.event_category;
        patch.event_category =
          raw == null || String(raw).trim() === '' ? 'other' : normalizeClubEventCategory(raw);
      }

      let nextStart = existing.start_time;
      let nextEnd = existing.end_time;
      if (Object.prototype.hasOwnProperty.call(req.body, 'start_time')) {
        const st = parseBodyTime(req.body.start_time);
        if (st.error) return res.status(400).json({ error: st.error });
        if (!st.omit) {
          patch.start_time = st.value;
          nextStart = st.value;
          if (!nextStart) {
            patch.end_time = null;
            nextEnd = null;
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'end_time')) {
        const et = parseBodyTime(req.body.end_time);
        if (et.error) return res.status(400).json({ error: et.error });
        if (!et.omit) {
          patch.end_time = et.value;
          nextEnd = et.value;
        }
      }
      const timeErr = validateEventTimes(nextStart, nextEnd);
      if (timeErr) return res.status(400).json({ error: timeErr });

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'Nada que actualizar' });
      }

      const { data: row, error } = await supabaseAdmin
        .from('club_events')
        .update(patch)
        .eq('id', eventId)
        .eq('club_id', id)
        .select(CLUB_EVENT_LIST_SELECT)
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(row);
    } catch (e) {
      console.error('PUT /clubs/:id/events/:eventId', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.delete(
  '/:id/events/:eventId',
  param('id').isUUID(),
  param('eventId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id, eventId } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const { error } = await supabaseAdmin
        .from('club_events')
        .delete()
        .eq('id', eventId)
        .eq('club_id', id);

      if (error) return res.status(500).json({ error: error.message });
      res.status(204).send();
    } catch (e) {
      console.error('DELETE /clubs/:id/events/:eventId', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.get('/:id/competitions', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await userIsClubMember(req.user.id, id);
    if (!ok) return res.status(404).json({ error: 'Club no encontrado' });

    const { data, error } = await supabaseAdmin
      .from('competitions')
      .select('id, name, public_slug, created_at')
      .eq('club_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    console.error('GET /clubs/:id/competitions', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/calendar-feed/status', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await userIsClubAdmin(req.user.id, id);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    const { data: club, error } = await supabaseAdmin
      .from('clubs')
      .select('id, calendar_feed_token')
      .eq('id', id)
      .maybeSingle();
    if (error || !club) return res.status(404).json({ error: 'Club no encontrado' });
    const enabled = Boolean(club.calendar_feed_token);
    res.json({
      enabled,
      feed_url: enabled ? buildCalendarFeedUrl(id, club.calendar_feed_token) : null,
    });
  } catch (e) {
    console.error('GET calendar-feed/status', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/calendar-feed/enable', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await userIsClubAdmin(req.user.id, id);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    let token = crypto.randomBytes(32).toString('hex');
    const { error } = await supabaseAdmin
      .from('clubs')
      .update({ calendar_feed_token: token })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ enabled: true, feed_url: buildCalendarFeedUrl(id, token) });
  } catch (e) {
    console.error('POST calendar-feed/enable', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/calendar-feed/regenerate', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await userIsClubAdmin(req.user.id, id);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    const token = crypto.randomBytes(32).toString('hex');
    const { error } = await supabaseAdmin
      .from('clubs')
      .update({ calendar_feed_token: token })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ enabled: true, feed_url: buildCalendarFeedUrl(id, token) });
  } catch (e) {
    console.error('POST calendar-feed/regenerate', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/calendar-feed/disable', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await userIsClubAdmin(req.user.id, id);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    const { error } = await supabaseAdmin
      .from('clubs')
      .update({ calendar_feed_token: null })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ enabled: false, feed_url: null });
  } catch (e) {
    console.error('POST calendar-feed/disable', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/board', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await userIsClubMember(req.user.id, id);
    if (!ok) return res.status(404).json({ error: 'Club no encontrado' });

    const { data, error } = await supabaseAdmin
      .from('club_board_items')
      .select(
        CLUB_BOARD_SELECT_PUBLIC,
      )
      .eq('club_id', id)
      .order('pinned', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    console.error('GET /clubs/:id/board', e);
    res.status(500).json({ error: e.message });
  }
});

router.post(
  '/:id/board',
  param('id').isUUID(),
  body('title').trim().notEmpty().isLength({ max: 300 }),
  body('body').optional({ nullable: true }).trim().isLength({ max: 8000 }),
  body('link_url').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('link_label').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('document_url').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('document_label').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('document_storage_path').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('pinned').optional().isBoolean(),
  body('sort_order').optional().isInt(),
  body('is_public').optional().isBoolean(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const insert = {
        club_id: id,
        user_id: req.user.id,
        title: req.body.title.trim(),
        body: req.body.body != null && String(req.body.body).trim() !== '' ? String(req.body.body).trim() : null,
        link_url:
          req.body.link_url != null && String(req.body.link_url).trim() !== ''
            ? String(req.body.link_url).trim()
            : null,
        link_label:
          req.body.link_label != null && String(req.body.link_label).trim() !== ''
            ? String(req.body.link_label).trim()
            : null,
        document_url:
          req.body.document_url != null && String(req.body.document_url).trim() !== ''
            ? String(req.body.document_url).trim()
            : null,
        document_label:
          req.body.document_label != null && String(req.body.document_label).trim() !== ''
            ? String(req.body.document_label).trim()
            : null,
        document_storage_path:
          req.body.document_storage_path != null && String(req.body.document_storage_path).trim() !== ''
            ? String(req.body.document_storage_path).trim()
            : null,
        pinned: Boolean(req.body.pinned),
        sort_order: req.body.sort_order != null ? parseInt(String(req.body.sort_order), 10) : 0,
        is_public: req.body.is_public != null ? Boolean(req.body.is_public) : false,
      };

      const { data: row, error } = await supabaseAdmin
        .from('club_board_items')
        .insert(insert)
        .select(CLUB_BOARD_SELECT_PUBLIC)
        .single();
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json(row);
    } catch (e) {
      console.error('POST /clubs/:id/board', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  '/:id/board/:itemId',
  param('id').isUUID(),
  param('itemId').isUUID(),
  body('title').optional().trim().notEmpty().isLength({ max: 300 }),
  body('body').optional({ nullable: true }).trim().isLength({ max: 8000 }),
  body('link_url').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('link_label').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('document_url').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('document_label').optional({ nullable: true }).trim().isLength({ max: 200 }),
  body('document_storage_path').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('pinned').optional().isBoolean(),
  body('sort_order').optional().isInt(),
  body('is_public').optional().isBoolean(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id, itemId } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const { data: existing, error: exErr } = await supabaseAdmin
        .from('club_board_items')
        .select('*')
        .eq('id', itemId)
        .eq('club_id', id)
        .maybeSingle();
      if (exErr || !existing) return res.status(404).json({ error: 'Entrada no encontrada' });

      const patch = {};
      if (req.body.title != null) patch.title = String(req.body.title).trim();
      if (Object.prototype.hasOwnProperty.call(req.body, 'body')) {
        patch.body =
          req.body.body != null && String(req.body.body).trim() !== '' ? String(req.body.body).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'link_url')) {
        patch.link_url =
          req.body.link_url != null && String(req.body.link_url).trim() !== ''
            ? String(req.body.link_url).trim()
            : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'link_label')) {
        patch.link_label =
          req.body.link_label != null && String(req.body.link_label).trim() !== ''
            ? String(req.body.link_label).trim()
            : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'document_url')) {
        patch.document_url =
          req.body.document_url != null && String(req.body.document_url).trim() !== ''
            ? String(req.body.document_url).trim()
            : null;
        const prevUrl = existing.document_url != null ? String(existing.document_url) : null;
        const urlChanged = prevUrl !== patch.document_url;
        if (
          urlChanged &&
          !Object.prototype.hasOwnProperty.call(req.body, 'document_storage_path') &&
          existing.document_storage_path
        ) {
          await removeClubDocument(supabaseAdmin, existing.document_storage_path);
          patch.document_storage_path = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'document_label')) {
        patch.document_label =
          req.body.document_label != null && String(req.body.document_label).trim() !== ''
            ? String(req.body.document_label).trim()
            : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'document_storage_path')) {
        patch.document_storage_path =
          req.body.document_storage_path != null && String(req.body.document_storage_path).trim() !== ''
            ? String(req.body.document_storage_path).trim()
            : null;
        if (existing.document_storage_path && existing.document_storage_path !== patch.document_storage_path) {
          await removeClubDocument(supabaseAdmin, existing.document_storage_path);
        }
      }
      if (req.body.pinned != null) patch.pinned = Boolean(req.body.pinned);
      if (req.body.sort_order != null) patch.sort_order = parseInt(String(req.body.sort_order), 10);
      if (Object.prototype.hasOwnProperty.call(req.body, 'is_public')) {
        patch.is_public = Boolean(req.body.is_public);
      }

      if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

      const { data: row, error } = await supabaseAdmin
        .from('club_board_items')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('club_id', id)
        .select(CLUB_BOARD_SELECT_PUBLIC)
        .single();
      if (error) return res.status(500).json({ error: error.message });
      res.json(row);
    } catch (e) {
      console.error('PUT /clubs/:id/board/:itemId', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.delete('/:id/board/:itemId', param('id').isUUID(), param('itemId').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const admin = await userIsClubAdmin(req.user.id, id);
    if (!admin) return res.status(403).json({ error: 'Sin permiso' });

    const { data: existing } = await supabaseAdmin
      .from('club_board_items')
      .select('document_storage_path')
      .eq('id', itemId)
      .eq('club_id', id)
      .maybeSingle();
    if (existing?.document_storage_path) {
      await removeClubDocument(supabaseAdmin, existing.document_storage_path);
    }

    const { error } = await supabaseAdmin.from('club_board_items').delete().eq('id', itemId).eq('club_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /clubs/:id/board/:itemId', e);
    res.status(500).json({ error: e.message });
  }
});

router.post(
  '/:id/board/upload',
  param('id').isUUID(),
  handleValidationErrors,
  clubBoardPdfUpload.single('file'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });
      if (!req.file?.buffer) return res.status(400).json({ error: 'Falta el archivo PDF' });

      const { publicUrl, storagePath } = await uploadClubPdf(
        supabaseAdmin,
        id,
        req.file.buffer,
        req.file.originalname || 'document.pdf',
      );
      res.json({ url: publicUrl, storage_path: storagePath });
    } catch (e) {
      if (e.message === 'Solo se permiten archivos PDF') {
        return res.status(400).json({ error: e.message });
      }
      console.error('POST board/upload', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.patch(
  '/:id/members/:userId',
  param('id').isUUID(),
  param('userId').isUUID(),
  body('role').isIn(['admin', 'member']),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id, userId } = req.params;
      const { role } = req.body;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const { data: club } = await supabaseAdmin.from('clubs').select('owner_user_id').eq('id', id).single();
      if (club?.owner_user_id === userId) {
        return res.status(400).json({ error: 'No se puede cambiar el rol del propietario del club' });
      }

      const { data: targetMem, error: memErr } = await supabaseAdmin
        .from('club_members')
        .select('id')
        .eq('club_id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (memErr || !targetMem) return res.status(404).json({ error: 'Miembro no encontrado' });

      const { error: updErr } = await supabaseAdmin
        .from('club_members')
        .update({ role })
        .eq('club_id', id)
        .eq('user_id', userId);

      if (updErr) return res.status(500).json({ error: updErr.message });
      res.json({ ok: true, role });
    } catch (e) {
      console.error('PATCH /clubs/:id/members/:userId', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.patch(
  '/:id',
  param('id').isUUID(),
  body('description').optional({ nullable: true }).isLength({ max: 10000 }),
  body('city').optional({ nullable: true }).isLength({ max: 200 }),
  body('website_url').optional({ nullable: true }).isLength({ max: 500 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const patch = {};
      if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
        patch.description =
          req.body.description != null && String(req.body.description).trim() !== ''
            ? String(req.body.description).trim()
            : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'city')) {
        patch.city =
          req.body.city != null && String(req.body.city).trim() !== ''
            ? String(req.body.city).trim()
            : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'website_url')) {
        const u = req.body.website_url;
        if (u != null && String(u).trim() !== '') {
          const s = String(u).trim();
          try {
            // eslint-disable-next-line no-new
            new URL(s);
          } catch {
            return res.status(400).json({ error: 'website_url no es una URL válida' });
          }
          patch.website_url = s;
        } else {
          patch.website_url = null;
        }
      }

      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'Nada que actualizar' });
      }

      const { data: club, error } = await supabaseAdmin
        .from('clubs')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(stripSensitiveClubRow(club));
    } catch (e) {
      console.error('PATCH /clubs/:id', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.get('/:id', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await userIsClubMember(req.user.id, id);
    if (!ok) return res.status(404).json({ error: 'Club no encontrado' });

    const { data: club, error } = await supabaseAdmin.from('clubs').select('*').eq('id', id).single();
    if (error || !club) return res.status(404).json({ error: 'Club no encontrado' });

    const { data: mem } = await supabaseAdmin
      .from('club_members')
      .select('role')
      .eq('club_id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    res.json({
      ...stripSensitiveClubRow(club),
      my_role: (await userOwnsClub(req.user.id, id)) ? 'admin' : (mem?.role || 'member'),
    });
  } catch (e) {
    console.error('GET /clubs/:id', e);
    res.status(500).json({ error: e.message });
  }
});

router.post(
  '/:id/invite',
  param('id').isUUID(),
  body('expires_in_days').optional().isInt({ min: 1, max: 90 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!admin) return res.status(403).json({ error: 'Sin permiso' });

      const days = req.body.expires_in_days != null ? parseInt(String(req.body.expires_in_days), 10) : 14;
      const token = crypto.randomBytes(24).toString('hex');
      const expires = new Date();
      expires.setDate(expires.getDate() + days);

      const { data: inv, error } = await supabaseAdmin
        .from('club_invitations')
        .insert({
          club_id: id,
          token,
          created_by: req.user.id,
          expires_at: expires.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('invite', error);
        return res.status(500).json({ error: error.message });
      }

      const base = process.env.FRONTEND_URL || 'http://localhost:3000';
      const joinUrl = `${base.replace(/\/+$/, '')}/clubs/join?token=${encodeURIComponent(token)}`;

      res.status(201).json({ invitation: inv, join_url: joinUrl, token });
    } catch (e) {
      console.error('POST /clubs/:id/invite', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.post(
  '/join/:token',
  param('token').trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { data: inv, error: invErr } = await supabaseAdmin
        .from('club_invitations')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (invErr || !inv) return res.status(404).json({ error: 'Invitación no válida' });
      if (new Date(inv.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Invitación caducada' });
      }

      const { data: existing } = await supabaseAdmin
        .from('club_members')
        .select('id')
        .eq('club_id', inv.club_id)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (existing) {
        const { data: club } = await supabaseAdmin.from('clubs').select('*').eq('id', inv.club_id).single();
        return res.json({ already_member: true, club: stripSensitiveClubRow(club) });
      }

      const { error: insErr } = await supabaseAdmin.from('club_members').insert({
        club_id: inv.club_id,
        user_id: req.user.id,
        role: 'member',
      });

      if (insErr) {
        console.error('join insert', insErr);
        return res.status(500).json({ error: insErr.message });
      }

      const { data: club } = await supabaseAdmin.from('clubs').select('*').eq('id', inv.club_id).single();
      res.status(201).json({ club: stripSensitiveClubRow(club) });
    } catch (e) {
      console.error('POST /clubs/join', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.delete(
  '/:id/members/:userId',
  param('id').isUUID(),
  param('userId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id, userId } = req.params;
      const targetSelf = userId === req.user.id;
      const admin = await userIsClubAdmin(req.user.id, id);
      if (!targetSelf && !admin) return res.status(403).json({ error: 'Sin permiso' });

      if (!targetSelf && userId) {
        const { data: club } = await supabaseAdmin.from('clubs').select('owner_user_id').eq('id', id).single();
        if (club?.owner_user_id === userId) {
          return res.status(400).json({ error: 'No se puede expulsar al propietario del club' });
        }
      }

      const { error } = await supabaseAdmin
        .from('club_members')
        .delete()
        .eq('club_id', id)
        .eq('user_id', userId);

      if (error) return res.status(500).json({ error: error.message });
      res.json({ ok: true });
    } catch (e) {
      console.error('DELETE /clubs/:id/members/:userId', e);
      res.status(500).json({ error: e.message });
    }
  },
);

module.exports = router;
