/**
 * Pilotos favoritos / habituales por usuario organizador.
 * Permite CRUD básico de una lista personal que luego se usa para dar de alta
 * participantes en competiciones sin necesidad de invitaciones ni enlaces.
 */
const express = require('express');
const { body, param } = require('express-validator');
const { getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { isLicenseAdminUser } = require('../lib/licenseAdminAuth');
const {
  normalizePilotSlug,
  isValidPilotSlug,
} = require('../lib/pilotProfileUtils');

const router = express.Router();
const supabaseAdmin = getServiceClient();

router.use(authMiddleware);

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

async function resolveLinkedSlug(rawSlug) {
  const slug = normalizePilotSlug(rawSlug);
  if (!slug) {
    return { ok: true, linked_user_id: null, linked_slug: null };
  }
  if (!isValidPilotSlug(slug)) {
    return { ok: false, status: 400, error: 'El slug no tiene un formato válido' };
  }
  const { data, error } = await supabaseAdmin
    .from('pilot_public_profiles')
    .select('user_id, slug, enabled')
    .ilike('slug', slug)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data || !data.enabled) {
    return { ok: false, status: 404, error: 'No hay ningún piloto público con ese slug' };
  }
  return { ok: true, linked_user_id: data.user_id, linked_slug: data.slug };
}

async function validateDefaultVehicleId(userId, vehicleId) {
  if (!vehicleId) return { ok: true };
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, error: 'Vehículo por defecto no encontrado en tu colección' };
  return { ok: true };
}

function sanitizeText(value, maxLen) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * GET /api/favorite-pilots
 */
router.get('/', async (req, res) => {
  try {
    let ownerId = req.user.id;
    const rawOwner = req.query.owner_user_id;
    if (rawOwner != null && String(rawOwner).trim() !== '') {
      const oid = String(rawOwner).trim();
      if (!isUuid(oid)) {
        return res.status(400).json({ error: 'owner_user_id inválido' });
      }
      if (oid !== req.user.id && !isLicenseAdminUser(req.user)) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      ownerId = oid;
    }

    const { data, error } = await supabaseAdmin
      .from('favorite_pilots')
      .select(`
        id,
        display_name,
        linked_user_id,
        linked_slug,
        default_vehicle_id,
        default_vehicle_model,
        notes,
        created_at,
        updated_at,
        vehicles:default_vehicle_id ( id, model, manufacturer )
      `)
      .eq('owner_user_id', ownerId)
      .order('display_name', { ascending: true });

    if (error) {
      console.error('GET /favorite-pilots', error);
      return res.status(500).json({ error: error.message });
    }

    const slugs = [...new Set((data || []).map((row) => row.linked_slug).filter(Boolean))];
    const enabledSlugs = new Set();
    if (slugs.length > 0) {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from('pilot_public_profiles')
        .select('slug, enabled')
        .in('slug', slugs);
      if (!pErr) {
        (profiles || []).forEach((p) => {
          if (p.enabled) enabledSlugs.add(p.slug);
        });
      }
    }

    const rows = (data || []).map((row) => ({
      id: row.id,
      display_name: row.display_name,
      linked_user_id: row.linked_user_id,
      linked_slug: row.linked_slug,
      linked_active: row.linked_slug ? enabledSlugs.has(row.linked_slug) : false,
      default_vehicle_id: row.default_vehicle_id,
      default_vehicle_model: row.default_vehicle_model,
      default_vehicle: row.vehicles
        ? { id: row.vehicles.id, model: row.vehicles.model, manufacturer: row.vehicles.manufacturer }
        : null,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return res.json(rows);
  } catch (e) {
    console.error('GET /favorite-pilots', e);
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
});

/**
 * POST /api/favorite-pilots
 * Body: { display_name, linked_slug?, default_vehicle_id?, default_vehicle_model?, notes? }
 */
router.post(
  '/',
  body('display_name').trim().notEmpty().isLength({ max: 120 }),
  body('linked_slug').optional({ nullable: true }).isString(),
  body('default_vehicle_id').optional({ nullable: true }).isUUID(),
  body('default_vehicle_model').optional({ nullable: true }).isString().isLength({ max: 200 }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const display_name = sanitizeText(req.body.display_name, 120);
      if (!display_name) return res.status(400).json({ error: 'El nombre es requerido' });

      const default_vehicle_id = req.body.default_vehicle_id || null;
      const default_vehicle_model = sanitizeText(req.body.default_vehicle_model, 200);
      const notes = sanitizeText(req.body.notes, 1000);

      if (default_vehicle_id && default_vehicle_model) {
        return res.status(400).json({
          error: 'Elige vehículo por defecto de la colección O texto libre, pero no ambos',
        });
      }

      const link = await resolveLinkedSlug(req.body.linked_slug);
      if (!link.ok) return res.status(link.status).json({ error: link.error });

      const vehicleCheck = await validateDefaultVehicleId(req.user.id, default_vehicle_id);
      if (!vehicleCheck.ok) return res.status(vehicleCheck.status).json({ error: vehicleCheck.error });

      const row = {
        owner_user_id: req.user.id,
        display_name,
        linked_user_id: link.linked_user_id,
        linked_slug: link.linked_slug,
        default_vehicle_id,
        default_vehicle_model,
        notes,
      };

      const { data, error } = await supabaseAdmin
        .from('favorite_pilots')
        .insert(row)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Ya tienes un favorito con ese nombre' });
        }
        console.error('POST /favorite-pilots', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json(data);
    } catch (e) {
      console.error('POST /favorite-pilots', e);
      return res.status(500).json({ error: e.message || 'Error interno' });
    }
  },
);

/**
 * PATCH /api/favorite-pilots/:id
 */
router.patch(
  '/:id',
  param('id').isUUID(),
  body('display_name').optional().isString().isLength({ max: 120 }),
  body('linked_slug').optional({ nullable: true }).isString(),
  body('default_vehicle_id').optional({ nullable: true }).isUUID(),
  body('default_vehicle_model').optional({ nullable: true }).isString().isLength({ max: 200 }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existing, error: exErr } = await supabaseAdmin
        .from('favorite_pilots')
        .select('*')
        .eq('id', id)
        .eq('owner_user_id', req.user.id)
        .maybeSingle();

      if (exErr) return res.status(500).json({ error: exErr.message });
      if (!existing) return res.status(404).json({ error: 'Favorito no encontrado' });

      const update = { updated_at: new Date().toISOString() };

      if (req.body.display_name !== undefined) {
        const name = sanitizeText(req.body.display_name, 120);
        if (!name) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        update.display_name = name;
      }

      if (req.body.default_vehicle_model !== undefined) {
        update.default_vehicle_model = sanitizeText(req.body.default_vehicle_model, 200);
      }

      if (req.body.default_vehicle_id !== undefined) {
        const vid = req.body.default_vehicle_id || null;
        const vehicleCheck = await validateDefaultVehicleId(req.user.id, vid);
        if (!vehicleCheck.ok) return res.status(vehicleCheck.status).json({ error: vehicleCheck.error });
        update.default_vehicle_id = vid;
      }

      const effVid = update.default_vehicle_id !== undefined ? update.default_vehicle_id : existing.default_vehicle_id;
      const effModel = update.default_vehicle_model !== undefined ? update.default_vehicle_model : existing.default_vehicle_model;
      if (effVid && effModel) {
        return res.status(400).json({
          error: 'Elige vehículo por defecto de la colección O texto libre, pero no ambos',
        });
      }

      if (req.body.notes !== undefined) {
        update.notes = sanitizeText(req.body.notes, 1000);
      }

      if (req.body.linked_slug !== undefined) {
        if (req.body.linked_slug === null || req.body.linked_slug === '') {
          update.linked_user_id = null;
          update.linked_slug = null;
        } else {
          const link = await resolveLinkedSlug(req.body.linked_slug);
          if (!link.ok) return res.status(link.status).json({ error: link.error });
          update.linked_user_id = link.linked_user_id;
          update.linked_slug = link.linked_slug;
        }
      }

      const { data, error } = await supabaseAdmin
        .from('favorite_pilots')
        .update(update)
        .eq('id', id)
        .eq('owner_user_id', req.user.id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Ya tienes un favorito con ese nombre' });
        }
        console.error('PATCH /favorite-pilots/:id', error);
        return res.status(500).json({ error: error.message });
      }

      return res.json(data);
    } catch (e) {
      console.error('PATCH /favorite-pilots/:id', e);
      return res.status(500).json({ error: e.message || 'Error interno' });
    }
  },
);

/**
 * DELETE /api/favorite-pilots/:id
 */
router.delete(
  '/:id',
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { error, count } = await supabaseAdmin
        .from('favorite_pilots')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('owner_user_id', req.user.id);

      if (error) {
        console.error('DELETE /favorite-pilots/:id', error);
        return res.status(500).json({ error: error.message });
      }
      if (!count) return res.status(404).json({ error: 'Favorito no encontrado' });
      return res.json({ ok: true });
    } catch (e) {
      console.error('DELETE /favorite-pilots/:id', e);
      return res.status(500).json({ error: e.message || 'Error interno' });
    }
  },
);

module.exports = router;
