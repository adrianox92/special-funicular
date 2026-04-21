/**
 * Clubes: CRUD mínimo, invitaciones por token, miembros.
 * Usa service role tras validar JWT (evita depender de RLS en todas las tablas).
 */
const express = require('express');
const crypto = require('crypto');
const { body, param } = require('express-validator');
const { getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');

const router = express.Router();

const supabaseAdmin = getServiceClient();

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
        return { ...c, my_role: m.role, joined_at: m.joined_at };
      })
      .filter(Boolean);

    const byId = new Map();
    for (const c of owned || []) {
      byId.set(c.id, { ...c, my_role: 'admin' });
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
      ...club,
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
        return res.json({ already_member: true, club });
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
      res.status(201).json({ club });
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
