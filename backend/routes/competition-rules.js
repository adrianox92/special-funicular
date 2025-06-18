const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @swagger
 * /api/competition-rules/templates:
 *   get:
 *     summary: Obtener todas las plantillas de reglas
 *     tags: [Competition Rules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de plantillas obtenida correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   rule_type:
 *                     type: string
 *                   points_structure:
 *                     type: object
 *                   is_template:
 *                     type: boolean
 *                   created_by:
 *                     type: string
 *                   use_bonus_best_lap:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error del servidor
 */
router.get('/templates', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('is_template', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener plantillas:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error en GET /templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/competition-rules/competition/{competitionId}:
 *   get:
 *     summary: Obtener reglas asociadas a una competición
 *     tags: [Competition Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: competitionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la competición
 *     responses:
 *       200:
 *         description: Reglas obtenidas correctamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Competición no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get('/competition/:competitionId', async (req, res) => {
  try {
    const { competitionId } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', competitionId)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const { data, error } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('is_template', false)
      .order('rule_type', { ascending: true });

    if (error) {
      console.error('Error al obtener reglas:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error en GET /competition/:competitionId:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/competition-rules:
 *   post:
 *     summary: Crear nueva regla o plantilla
 *     tags: [Competition Rules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rule_type
 *               - points_structure
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre de la regla (requerido para plantillas)
 *               description:
 *                 type: string
 *               rule_type:
 *                 type: string
 *                 enum: [per_round, final, best_time_per_round]
 *               points_structure:
 *                 type: object
 *               is_template:
 *                 type: boolean
 *                 default: false
 *               competition_id:
 *                 type: string
 *                 description: ID de la competición (requerido si no es plantilla)
 *               use_bonus_best_lap:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Regla creada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Competición no encontrada (si se especifica competition_id)
 *       500:
 *         description: Error del servidor
 */
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      rule_type, 
      points_structure, 
      is_template = false, 
      competition_id, 
      use_bonus_best_lap = false 
    } = req.body;

    // Validaciones básicas
    if (!rule_type || !['per_round', 'final', 'best_time_per_round'].includes(rule_type)) {
      return res.status(400).json({ error: 'Tipo de regla debe ser "per_round", "final" o "best_time_per_round"' });
    }

    if (!points_structure || typeof points_structure !== 'object') {
      return res.status(400).json({ error: 'La estructura de puntos es requerida' });
    }

    // Validaciones específicas según si es plantilla o regla de competición
    if (is_template) {
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'El nombre es requerido para las plantillas' });
      }
    } else {
      if (!competition_id) {
        return res.status(400).json({ error: 'El ID de la competición es requerido para las reglas' });
      }

      // Verificar que la competición existe y pertenece al usuario
      const { data: competition, error: compError } = await supabase
        .from('competitions')
        .select('id')
        .eq('id', competition_id)
        .eq('organizer', req.user.id)
        .single();

      if (compError || !competition) {
        return res.status(404).json({ error: 'Competición no encontrada' });
      }
    }

    const ruleData = {
      rule_type,
      description: description ? description.trim() : null,
      points_structure,
      is_template,
      created_by: req.user.id,
      use_bonus_best_lap
    };

    // Agregar campos específicos según el tipo
    if (is_template) {
      ruleData.name = name.trim();
    } else {
      ruleData.competition_id = competition_id;
    }

    const { data, error } = await supabase
      .from('competition_rules')
      .insert([ruleData])
      .select()
      .single();

    if (error) {
      console.error('Error al crear regla:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error en POST /:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/competition-rules/{id}:
 *   put:
 *     summary: Editar una regla existente
 *     tags: [Competition Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la regla
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               rule_type:
 *                 type: string
 *                 enum: [per_round, final, best_time_per_round]
 *               points_structure:
 *                 type: object
 *               use_bonus_best_lap:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Regla actualizada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Regla no encontrada
 *       500:
 *         description: Error del servidor
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, rule_type, points_structure, use_bonus_best_lap } = req.body;

    // Verificar que la regla existe y pertenece al usuario
    const { data: existingRule, error: ruleError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (ruleError || !existingRule) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    // Verificar permisos
    if (existingRule.is_template) {
      // Para plantillas, verificar que el usuario es el creador
      if (existingRule.created_by !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permisos para editar esta plantilla' });
      }
    } else {
      // Para reglas de competición, verificar que el usuario es el organizador
      const { data: competition, error: compError } = await supabase
        .from('competitions')
        .select('id')
        .eq('id', existingRule.competition_id)
        .eq('organizer', req.user.id)
        .single();

      if (compError || !competition) {
        return res.status(403).json({ error: 'No tienes permisos para editar esta regla' });
      }
    }

    // Validaciones
    if (rule_type && !['per_round', 'final', 'best_time_per_round'].includes(rule_type)) {
      return res.status(400).json({ error: 'Tipo de regla debe ser "per_round", "final" o "best_time_per_round"' });
    }

    if (points_structure && typeof points_structure !== 'object') {
      return res.status(400).json({ error: 'La estructura de puntos debe ser un objeto' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name ? name.trim() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (rule_type) updateData.rule_type = rule_type;
    if (points_structure) updateData.points_structure = points_structure;
    if (use_bonus_best_lap !== undefined) updateData.use_bonus_best_lap = use_bonus_best_lap;

    const { data, error } = await supabase
      .from('competition_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar regla:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /:id:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/competition-rules/{id}:
 *   delete:
 *     summary: Eliminar una regla o plantilla
 *     tags: [Competition Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la regla
 *     responses:
 *       200:
 *         description: Regla eliminada correctamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: No tienes permisos
 *       404:
 *         description: Regla no encontrada
 *       500:
 *         description: Error del servidor
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la regla existe y obtener información
    const { data: existingRule, error: ruleError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (ruleError || !existingRule) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }

    // Verificar permisos
    if (existingRule.is_template) {
      // Para plantillas, verificar que el usuario es el creador
      if (existingRule.created_by !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar esta plantilla' });
      }
    } else {
      // Para reglas de competición, verificar que el usuario es el organizador
      const { data: competition, error: compError } = await supabase
        .from('competitions')
        .select('id')
        .eq('id', existingRule.competition_id)
        .eq('organizer', req.user.id)
        .single();

      if (compError || !competition) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar esta regla' });
      }
    }

    const { error } = await supabase
      .from('competition_rules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar regla:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Regla eliminada correctamente' });
  } catch (error) {
    console.error('Error en DELETE /:id:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/competition-rules/apply-template/{templateId}:
 *   post:
 *     summary: Clonar plantilla y asociar a competición
 *     tags: [Competition Rules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la plantilla
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - competition_id
 *             properties:
 *               competition_id:
 *                 type: string
 *                 description: ID de la competición donde aplicar la plantilla
 *     responses:
 *       201:
 *         description: Plantilla aplicada correctamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Plantilla o competición no encontrada
 *       500:
 *         description: Error del servidor
 */
router.post('/apply-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { competition_id } = req.body;

    if (!competition_id) {
      return res.status(400).json({ error: 'El ID de la competición es requerido' });
    }

    // Verificar que la plantilla existe
    const { data: template, error: templateError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('id', templateId)
      .eq('is_template', true)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', competition_id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Crear la regla basada en la plantilla
    const ruleData = {
      competition_id,
      rule_type: template.rule_type,
      description: template.description,
      points_structure: template.points_structure,
      is_template: false,
      created_by: req.user.id,
      use_bonus_best_lap: template.use_bonus_best_lap
    };

    const { data, error } = await supabase
      .from('competition_rules')
      .insert([ruleData])
      .select()
      .single();

    if (error) {
      console.error('Error al aplicar plantilla:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Plantilla aplicada correctamente',
      rule: data
    });
  } catch (error) {
    console.error('Error en POST /apply-template/:templateId:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 