const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const ALLOWED_KINDS = new Set([
  'limpieza_general',
  'guias',
  'escobillas',
  'engrase',
  'iman',
  'contactos',
  'neumaticos',
  'cables',
  'suspension',
  'otro',
]);

router.use(authMiddleware);

function normalizeDate(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

async function assertVehicleOwned(vehicleId, userId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * GET /api/maintenance?vehicle_id=uuid
 */
router.get('/', async (req, res) => {
  try {
    const { vehicle_id: vehicleId } = req.query;
    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicle_id es requerido' });
    }

    const owned = await assertVehicleOwned(vehicleId, req.user.id);
    if (!owned) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const { data, error } = await supabase
      .from('vehicle_maintenance_log')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', req.user.id)
      .order('performed_at', { ascending: false });

    if (error) {
      console.error('Error al listar mantenimiento:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error('GET /maintenance:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/maintenance
 */
router.post('/', async (req, res) => {
  try {
    const { vehicle_id: vehicleId, performed_at, kind, notes, next_due_at } = req.body;

    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicle_id es requerido' });
    }
    const performed = normalizeDate(performed_at);
    if (!performed) {
      return res.status(400).json({ error: 'performed_at debe ser una fecha válida (YYYY-MM-DD)' });
    }
    if (!kind || !ALLOWED_KINDS.has(String(kind))) {
      return res.status(400).json({ error: 'kind no válido' });
    }

    const owned = await assertVehicleOwned(vehicleId, req.user.id);
    if (!owned) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const nextDue = normalizeDate(next_due_at);
    const row = {
      user_id: req.user.id,
      vehicle_id: vehicleId,
      performed_at: performed,
      kind: String(kind),
      notes: notes != null && String(notes).trim() !== '' ? String(notes).trim() : null,
      next_due_at: nextDue,
    };

    const { data, error } = await supabase
      .from('vehicle_maintenance_log')
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error('Error al crear mantenimiento:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('POST /maintenance:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/maintenance/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_at, kind, notes, next_due_at } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('vehicle_maintenance_log')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('Error al buscar mantenimiento:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }
    if (!existing) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const updates = {};
    if (performed_at !== undefined) {
      const performed = normalizeDate(performed_at);
      if (!performed) {
        return res.status(400).json({ error: 'performed_at debe ser una fecha válida (YYYY-MM-DD)' });
      }
      updates.performed_at = performed;
    }
    if (kind !== undefined) {
      if (!ALLOWED_KINDS.has(String(kind))) {
        return res.status(400).json({ error: 'kind no válido' });
      }
      updates.kind = String(kind);
    }
    if (notes !== undefined) {
      updates.notes = notes != null && String(notes).trim() !== '' ? String(notes).trim() : null;
    }
    if (next_due_at !== undefined) {
      updates.next_due_at = normalizeDate(next_due_at);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('vehicle_maintenance_log')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar mantenimiento:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('PUT /maintenance/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/maintenance/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vehicle_maintenance_log')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id');

    if (error) {
      console.error('Error al eliminar mantenimiento:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /maintenance/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
