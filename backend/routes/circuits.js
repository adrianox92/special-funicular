const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.use(authMiddleware);

/**
 * @swagger
 * /api/circuits:
 *   get:
 *     summary: Lista todos los circuitos del usuario
 *     tags: [Circuits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de circuitos
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('circuits')
      .select('*')
      .eq('user_id', req.user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error al obtener circuitos:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error en GET /circuits:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/circuits/find-or-create:
 *   post:
 *     summary: Busca un circuito por nombre o lo crea si no existe
 *     tags: [Circuits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               num_lanes:
 *                 type: integer
 *               lane_lengths:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: Circuito encontrado o creado
 *       400:
 *         description: Nombre requerido
 */
router.post('/find-or-create', async (req, res) => {
  try {
    const { name, description, num_lanes, lane_lengths } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const trimmedName = name.trim();

    const { data: existing, error: fetchError } = await supabase
      .from('circuits')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('name', trimmedName)
      .maybeSingle();

    if (fetchError) {
      console.error('Error al buscar circuito:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (existing) {
      return res.json({ circuit: existing, created: false });
    }

    const lanes = num_lanes != null ? parseInt(num_lanes, 10) : 1;
    const validLanes = isNaN(lanes) || lanes < 1 ? 1 : lanes;
    let lengths = Array.isArray(lane_lengths) ? lane_lengths : [];
    if (lengths.length !== validLanes) {
      lengths = Array(validLanes).fill(null).map((_, i) => (lengths[i] != null ? Number(lengths[i]) : 0));
    }
    lengths = lengths.slice(0, validLanes).map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0));

    const circuitData = {
      user_id: req.user.id,
      name: trimmedName,
      description: description ? description.trim() : null,
      num_lanes: validLanes,
      lane_lengths: lengths,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('circuits')
      .insert([circuitData])
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: raceExisting } = await supabase
          .from('circuits')
          .select('*')
          .eq('user_id', req.user.id)
          .eq('name', trimmedName)
          .single();
        if (raceExisting) {
          return res.json({ circuit: raceExisting, created: false });
        }
      }
      console.error('Error al crear circuito:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ circuit: inserted, created: true });
  } catch (error) {
    console.error('Error en POST /circuits/find-or-create:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/circuits/{id}:
 *   get:
 *     summary: Obtiene el detalle de un circuito
 *     tags: [Circuits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalle del circuito
 *       404:
 *         description: Circuito no encontrado
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('circuits')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Circuito no encontrado' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en GET /circuits/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/circuits:
 *   post:
 *     summary: Crea un nuevo circuito
 *     tags: [Circuits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - num_lanes
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               num_lanes:
 *                 type: integer
 *               lane_lengths:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       201:
 *         description: Circuito creado
 *       400:
 *         description: Datos inválidos
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, num_lanes, lane_lengths } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const lanes = num_lanes != null ? parseInt(num_lanes, 10) : 1;
    if (isNaN(lanes) || lanes < 1) {
      return res.status(400).json({ error: 'num_lanes debe ser un entero mayor a 0' });
    }

    let lengths = Array.isArray(lane_lengths) ? lane_lengths : [];
    if (lengths.length !== lanes) {
      lengths = Array(lanes).fill(null).map((_, i) => lengths[i] != null ? Number(lengths[i]) : 0);
    }
    lengths = lengths.slice(0, lanes).map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0));

    const circuitData = {
      user_id: req.user.id,
      name: name.trim(),
      description: description ? description.trim() : null,
      num_lanes: lanes,
      lane_lengths: lengths,
    };

    const { data, error } = await supabase
      .from('circuits')
      .insert([circuitData])
      .select()
      .single();

    if (error) {
      console.error('Error al crear circuito:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya tienes un circuito con ese nombre' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error en POST /circuits:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/circuits/{id}:
 *   put:
 *     summary: Actualiza un circuito
 *     tags: [Circuits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               num_lanes:
 *                 type: integer
 *               lane_lengths:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: Circuito actualizado
 *       404:
 *         description: Circuito no encontrado
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, num_lanes, lane_lengths } = req.body;

    const { data: existing, error: fetchError } = await supabase
      .from('circuits')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Circuito no encontrado' });
    }

    const updateData = {};

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) updateData.description = description ? description.trim() : null;

    if (num_lanes !== undefined) {
      const lanes = parseInt(num_lanes, 10);
      if (isNaN(lanes) || lanes < 1) {
        return res.status(400).json({ error: 'num_lanes debe ser un entero mayor a 0' });
      }
      updateData.num_lanes = lanes;

      let lengths = Array.isArray(lane_lengths) ? lane_lengths : existing.lane_lengths || [];
      if (lengths.length !== lanes) {
        lengths = Array(lanes).fill(null).map((_, i) => lengths[i] != null ? Number(lengths[i]) : 0);
      }
      updateData.lane_lengths = lengths.slice(0, lanes).map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0));
    }

    const { data, error } = await supabase
      .from('circuits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar circuito:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya tienes un circuito con ese nombre' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /circuits/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/circuits/{id}:
 *   delete:
 *     summary: Elimina un circuito (si no está en uso)
 *     tags: [Circuits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Circuito eliminado
 *       400:
 *         description: Circuito en uso, no se puede eliminar
 *       404:
 *         description: Circuito no encontrado
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('circuits')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Circuito no encontrado' });
    }

    const [
      { count: compCount },
      { count: vtCount },
      { count: ctCount },
    ] = await Promise.all([
      supabase.from('competitions').select('*', { count: 'exact', head: true }).eq('circuit_id', id),
      supabase.from('vehicle_timings').select('*', { count: 'exact', head: true }).eq('circuit_id', id),
      supabase.from('competition_timings').select('*', { count: 'exact', head: true }).eq('circuit_id', id),
    ]);

    const usedBy = [];
    if (compCount > 0) usedBy.push(`${compCount} competición(es)`);
    if (vtCount > 0) usedBy.push(`${vtCount} tiempo(s) de vehículo`);
    if (ctCount > 0) usedBy.push(`${ctCount} tiempo(s) de competición`);

    if (usedBy.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar: el circuito está en uso',
        usedBy,
      });
    }

    const { error } = await supabase.from('circuits').delete().eq('id', id);

    if (error) {
      console.error('Error al eliminar circuito:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Circuito eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /circuits/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
