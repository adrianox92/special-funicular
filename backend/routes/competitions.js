const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { calculatePoints } = require('../lib/pointsCalculator');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Aplicar middleware de autenticación SOLO a las rutas siguientes
router.use(authMiddleware);

/**
 * @swagger
 * /api/competitions/vehicles:
 *   get:
 *     summary: Obtiene los vehículos del usuario para seleccionar en competiciones
 *     tags:
 *       - Competiciones
 *     responses:
 *       200:
 *         description: Lista de vehículos disponibles para competiciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
// Obtener vehículos del usuario para seleccionar en competiciones
router.get('/vehicles', async (req, res) => {
  try {
    // Obtener los vehículos del usuario
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        model,
        manufacturer,
        type,
        traction
      `)
      .eq('user_id', req.user.id)
      .order('model', { ascending: true });

    if (error) {
      console.error('Error al obtener vehículos:', error);
      return res.status(500).json({ error: error.message });
    }

    // Obtener la imagen principal de cada vehículo (si existe)
    const vehicleIds = vehicles.map(v => v.id);
    let imagesMap = {};
    if (vehicleIds.length > 0) {
      const { data: images, error: imgError } = await supabase
        .from('vehicle_images')
        .select('vehicle_id, image_url')
        .in('vehicle_id', vehicleIds);
      if (!imgError && images) {
        images.forEach(img => {
          if (!imagesMap[img.vehicle_id]) {
            imagesMap[img.vehicle_id] = img.image_url;
          }
        });
      }
    }

    // Añadir la imagen principal al resultado
    const result = vehicles.map(v => ({
      ...v,
      image: imagesMap[v.id] || null
    }));

    res.json(result);
  } catch (error) {
    console.error('Error en GET /competitions/vehicles:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== COMPETICIONES ====================

/**
 * @swagger
 * /api/competitions:
 *   post:
 *     summary: Crea una nueva competición
 *     tags:
 *       - Competiciones
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               num_slots:
 *                 type: integer
 *               rounds:
 *                 type: integer
 *               circuit_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Competición creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
// Función helper para generar slugs
function generateSlug(name) {
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
    .replace(/\s+/g, '-') // Reemplazar espacios con guiones
    .replace(/-+/g, '-') // Múltiples guiones por uno solo
    .replace(/^-+|-+$/g, '') // Eliminar guiones al inicio y final
    .substring(0, 50); // Limitar longitud
  
  const uuid = uuidv4().substring(0, 8); // Tomar solo los primeros 8 caracteres del UUID
  return `${baseSlug}-${uuid}`;
}

// Crear una nueva competición
router.post('/', async (req, res) => {
  try {
    const { name, num_slots, rounds, circuit_name } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la competición es requerido' });
    }

    if (!num_slots || num_slots <= 0) {
      return res.status(400).json({ error: 'El número de plazas debe ser mayor a 0' });
    }

    if (!rounds || rounds <= 0) {
      return res.status(400).json({ error: 'El número de rondas debe ser mayor a 0' });
    }

    // Generar public_slug único
    const public_slug = generateSlug(name.trim());

    const { data, error } = await supabase
      .from('competitions')
      .insert([{
        name: name.trim(),
        public_slug: public_slug,
        organizer: req.user.id,
        num_slots: num_slots,
        rounds: rounds,
        circuit_name: circuit_name ? circuit_name.trim() : null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error al crear competición:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error en POST /competitions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/competitions/my-competitions:
 *   get:
 *     summary: Obtiene todas las competiciones del usuario como organizador
 *     tags:
 *       - Competiciones
 *     responses:
 *       200:
 *         description: Lista de competiciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
// Obtener todas las competiciones del usuario (como organizador)
router.get('/my-competitions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('competitions')
      .select(`
        *,
        competition_participants(count)
      `)
      .eq('organizer', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener competiciones:', error);
      return res.status(500).json({ error: error.message });
    }

    // Formatear la respuesta para incluir el número de participantes
    const competitions = data.map(comp => ({
      ...comp,
      participants_count: comp.competition_participants[0]?.count || 0
    }));

    res.json(competitions);
  } catch (error) {
    console.error('Error en GET /competitions/my-competitions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/competitions/{id}:
 *   get:
 *     summary: Obtiene una competición específica con sus participantes
 *     tags:
 *       - Competiciones
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la competición
 *     responses:
 *       200:
 *         description: Detalles de la competición
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
// Obtener una competición específica con sus participantes
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener la competición
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener los participantes
    const { data: participants, error: partError } = await supabase
      .from('competition_participants')
      .select(`
        *,
        vehicles(model, manufacturer)
      `)
      .eq('competition_id', id)
      .order('created_at', { ascending: true });

    if (partError) {
      console.error('Error al obtener participantes:', partError);
      return res.status(500).json({ error: partError.message });
    }

    // Obtener las categorías
    const { data: categories, error: catError } = await supabase
      .from('competition_categories')
      .select('*')
      .eq('competition_id', id)
      .order('name', { ascending: true });

    if (catError) {
      console.error('Error al obtener categorías:', catError);
    }

    // Obtener el número de inscripciones
    const { count: signupsCount, error: signupsError } = await supabase
      .from('competition_signups')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', id);

    if (signupsError) {
      console.error('Error al contar inscripciones:', signupsError);
    }

    res.json({
      ...competition,
      participants: participants || [],
      categories: categories || [],
      signups_count: signupsCount || 0
    });
  } catch (error) {
    console.error('Error en GET /competitions/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar una competición
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, num_slots, rounds, circuit_name } = req.body;

    // Verificar que la competición existe y pertenece al usuario
    const { data: existingComp, error: checkError } = await supabase
      .from('competitions')
      .select('id, num_slots, rounds')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (checkError || !existingComp) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Validaciones
    if (name && !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la competición no puede estar vacío' });
    }

    if (num_slots && num_slots <= 0) {
      return res.status(400).json({ error: 'El número de plazas debe ser mayor a 0' });
    }

    if (rounds && rounds <= 0) {
      return res.status(400).json({ error: 'El número de rondas debe ser mayor a 0' });
    }

    // Verificar que no se reduzca el número de plazas por debajo de los participantes actuales
    if (num_slots) {
      const { count, error: countError } = await supabase
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', id);

      if (countError) {
        console.error('Error al contar participantes:', countError);
        return res.status(500).json({ error: countError.message });
      }

      if (num_slots < count) {
        return res.status(400).json({ 
          error: `No se puede reducir el número de plazas a ${num_slots} porque ya hay ${count} participantes registrados` 
        });
      }
    }

    // Verificar que no se reduzca el número de rondas si ya hay tiempos registrados
    if (rounds) {
      // Aquí podrías añadir lógica para verificar si ya hay tiempos registrados
      // Por ahora, solo verificamos que el valor sea válido
      if (rounds < 1) {
        return res.status(400).json({ 
          error: 'El número de rondas debe ser al menos 1' 
        });
      }
    }

    // Actualizar la competición
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (num_slots) updateData.num_slots = num_slots;
    if (rounds) updateData.rounds = rounds;
    if (circuit_name !== undefined) updateData.circuit_name = circuit_name ? circuit_name.trim() : null;

    const { data, error } = await supabase
      .from('competitions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar competición:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /competitions/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar una competición
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: existingComp, error: checkError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (checkError || !existingComp) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Eliminar la competición (los participantes se eliminarán automáticamente por CASCADE)
    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar competición:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Competición eliminada correctamente' });
  } catch (error) {
    console.error('Error en DELETE /competitions/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PARTICIPANTES ====================

// Añadir un participante a una competición
router.post('/:id/participants', async (req, res) => {
  try {
    const { id: competitionId } = req.params;
    const { vehicle_id, driver_name, vehicle_model, category_id } = req.body;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id, num_slots')
      .eq('id', competitionId)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Validaciones
    if (!driver_name || !driver_name.trim()) {
      return res.status(400).json({ error: 'El nombre del piloto es requerido' });
    }

    if (!category_id) {
      return res.status(400).json({ error: 'La categoría es requerida' });
    }

    // Verificar que la categoría existe
    const { data: category, error: catError } = await supabase
      .from('competition_categories')
      .select('id')
      .eq('id', category_id)
      .eq('competition_id', competitionId)
      .single();

    if (catError || !category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    // Verificar que se proporcione exactamente una fuente de vehículo
    if ((vehicle_id && vehicle_model) || (!vehicle_id && !vehicle_model)) {
      return res.status(400).json({ 
        error: 'Debe proporcionar un vehículo de la colección O un modelo de vehículo externo, pero no ambos' 
      });
    }

    // Si se proporciona vehicle_id, verificar que existe y pertenece al usuario
    if (vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', vehicle_id)
        .eq('user_id', req.user.id)
        .single();

      if (vehicleError || !vehicle) {
        return res.status(404).json({ error: 'Vehículo no encontrado en tu colección' });
      }
    }

    // Verificar que no se exceda el número de plazas
    const { count, error: countError } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId);

    if (countError) {
      console.error('Error al contar participantes:', countError);
      return res.status(500).json({ error: countError.message });
    }

    if (count >= competition.num_slots) {
      return res.status(400).json({ 
        error: `La competición ya está completa. Máximo ${competition.num_slots} participantes` 
      });
    }

    // Crear el participante
    const participantData = {
      competition_id: competitionId,
      driver_name: driver_name.trim(),
      category_id: category_id,
      registered_by: req.user.id
    };

    if (vehicle_id) {
      participantData.vehicle_id = vehicle_id;
    } else {
      participantData.vehicle_model = vehicle_model.trim();
    }

    const { data, error } = await supabase
      .from('competition_participants')
      .insert([participantData])
      .select(`
        *,
        vehicles(model, manufacturer)
      `)
      .single();

    if (error) {
      console.error('Error al crear participante:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error en POST /competitions/:id/participants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener participantes de una competición
router.get('/:id/participants', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

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

    // Obtener los participantes
    const { data, error } = await supabase
      .from('competition_participants')
      .select(`
        *,
        vehicles(model, manufacturer)
      `)
      .eq('competition_id', competitionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error al obtener participantes:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error en GET /competitions/:id/participants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un participante
router.put('/:id/participants/:participantId', async (req, res) => {
  try {
    const { id: competitionId, participantId } = req.params;
    const { vehicle_id, driver_name, vehicle_model, category_id } = req.body;

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

    // Verificar que el participante existe
    const { data: existingParticipant, error: partError } = await supabase
      .from('competition_participants')
      .select('id')
      .eq('id', participantId)
      .eq('competition_id', competitionId)
      .single();

    if (partError || !existingParticipant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Validaciones
    if (driver_name && !driver_name.trim()) {
      return res.status(400).json({ error: 'El nombre del piloto no puede estar vacío' });
    }

    if (category_id) {
      // Verificar que la categoría existe
      const { data: category, error: catError } = await supabase
        .from('competition_categories')
        .select('id')
        .eq('id', category_id)
        .eq('competition_id', competitionId)
        .single();

      if (catError || !category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
    }

    // Verificar que se proporcione exactamente una fuente de vehículo
    if ((vehicle_id && vehicle_model) || (!vehicle_id && !vehicle_model)) {
      return res.status(400).json({ 
        error: 'Debe proporcionar un vehículo de la colección O un modelo de vehículo externo, pero no ambos' 
      });
    }

    // Si se proporciona vehicle_id, verificar que existe y pertenece al usuario
    if (vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', vehicle_id)
        .eq('user_id', req.user.id)
        .single();

      if (vehicleError || !vehicle) {
        return res.status(404).json({ error: 'Vehículo no encontrado en tu colección' });
      }
    }

    // Actualizar el participante
    const updateData = {};
    if (driver_name) updateData.driver_name = driver_name.trim();
    if (category_id) updateData.category_id = category_id;
    if (vehicle_id) {
      updateData.vehicle_id = vehicle_id;
      updateData.vehicle_model = null;
    } else if (vehicle_model) {
      updateData.vehicle_id = null;
      updateData.vehicle_model = vehicle_model.trim();
    }

    const { data, error } = await supabase
      .from('competition_participants')
      .update(updateData)
      .eq('id', participantId)
      .select(`
        *,
        vehicles(model, manufacturer)
      `)
      .single();

    if (error) {
      console.error('Error al actualizar participante:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /competitions/:id/participants/:participantId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un participante
router.delete('/:id/participants/:participantId', async (req, res) => {
  try {
    const { id: competitionId, participantId } = req.params;

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

    // Verificar que el participante existe
    const { data: existingParticipant, error: partError } = await supabase
      .from('competition_participants')
      .select('id')
      .eq('id', participantId)
      .eq('competition_id', competitionId)
      .single();

    if (partError || !existingParticipant) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }

    // Eliminar el participante
    const { error } = await supabase
      .from('competition_participants')
      .delete()
      .eq('id', participantId);

    if (error) {
      console.error('Error al eliminar participante:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Participante eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/participants/:participantId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener progreso de la competición
router.get('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener la competición
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id, num_slots, rounds')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener el número de participantes
    const { count: participantsCount, error: partError } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', id);

    if (partError) {
      console.error('Error al contar participantes:', partError);
      return res.status(500).json({ error: partError.message });
    }

    // Obtener el número de tiempos registrados usando la tabla competition_timings
    let timesCount = 0;
    let timesByParticipant = {};
    let timesByRound = {};

    if (participantsCount > 0) {
      // Obtener todos los tiempos de la competición
      const { data: timings, error: timesError } = await supabase
        .from('competition_timings')
        .select(`
          id,
          participant_id,
          round_number,
          best_lap_time,
          total_time,
          laps,
          average_time,
          lane,
          driver,
          timing_date,
          circuit,
          penalty_seconds
        `)
        .in('participant_id', 
          (await supabase
            .from('competition_participants')
            .select('id')
            .eq('competition_id', id)
          ).data?.map(p => p.id) || []
        )
        .order('round_number', { ascending: true });

      if (!timesError && timings) {
        timesCount = timings.length;
        
        // Agrupar tiempos por participante
        timings.forEach(timing => {
          if (!timesByParticipant[timing.participant_id]) {
            timesByParticipant[timing.participant_id] = [];
          }
          timesByParticipant[timing.participant_id].push(timing);
        });

        // Agrupar tiempos por ronda
        timings.forEach(timing => {
          if (!timesByRound[timing.round_number]) {
            timesByRound[timing.round_number] = [];
          }
          timesByRound[timing.round_number].push(timing);
        });
      }
    }

    // Calcular el progreso
    const totalRequiredTimes = participantsCount * competition.rounds;
    const isCompleted = timesCount >= totalRequiredTimes;
    const progressPercentage = totalRequiredTimes > 0 ? (timesCount / totalRequiredTimes) * 100 : 0;

    // Obtener reglas de puntuación
    const { data: rules, error: rulesError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('competition_id', id);
    if (rulesError) {
      console.error('Error al obtener reglas:', rulesError);
      return res.status(500).json({ error: rulesError.message });
    }
    const perRoundRule = rules.find(r => r.rule_type === 'per_round');
    const finalRule = rules.find(r => r.rule_type === 'final');

    // Calcular puntos y stats usando la función centralizada
    const { pointsByParticipant, participantStats } = calculatePoints({
      competition,
      participants: Object.keys(timesByParticipant).map(pid => ({ id: pid })),
      timings: Object.values(timesByParticipant).flat(),
      rules
    });

    res.json({
      competition_id: id,
      participants_count: participantsCount,
      rounds: competition.rounds,
      times_registered: timesCount,
      total_required_times: totalRequiredTimes,
      times_remaining: Math.max(0, totalRequiredTimes - timesCount),
      is_completed: isCompleted,
      progress_percentage: Math.round(progressPercentage),
      times_by_round: timesByRound,
      participant_stats: participantStats
    });
  } catch (error) {
    console.error('Error en GET /competitions/:id/progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== TIEMPOS DE COMPETICIÓN ====================

// Registrar un tiempo de competición
router.post('/:id/timings', async (req, res) => {
  try {
    const { id: competitionId } = req.params;
    const { 
      participant_id, 
      best_lap_time, 
      total_time, 
      laps, 
      average_time, 
      lane, 
      driver, 
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      average_time_timestamp,
      setup_snapshot,
      circuit,
      round_number 
    } = req.body;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id, rounds')
      .eq('id', competitionId)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Verificar que el participante existe y pertenece a esta competición
    const { data: participant, error: partError } = await supabase
      .from('competition_participants')
      .select('id')
      .eq('id', participant_id)
      .eq('competition_id', competitionId)
      .single();

    if (partError || !participant) {
      return res.status(404).json({ error: 'Participante no encontrado en esta competición' });
    }

    // Validaciones
    if (!best_lap_time || !total_time || !laps || !average_time) {
      return res.status(400).json({ error: 'Todos los campos de tiempo son requeridos' });
    }

    if (!round_number || round_number <= 0 || round_number > competition.rounds) {
      return res.status(400).json({ 
        error: `El número de ronda debe estar entre 1 y ${competition.rounds}` 
      });
    }

    // Verificar que no existe ya un tiempo para este participante en esta ronda
    const { data: existingTiming, error: existingError } = await supabase
      .from('competition_timings')
      .select('id')
      .eq('participant_id', participant_id)
      .eq('round_number', round_number)
      .single();

    if (existingTiming) {
      return res.status(400).json({ 
        error: `Ya existe un tiempo registrado para este participante en la ronda ${round_number}` 
      });
    }

    // Crear el tiempo
    const timingData = {
      participant_id,
      best_lap_time,
      total_time,
      laps,
      average_time,
      round_number,
      timing_date: timing_date || new Date().toISOString().split('T')[0]
    };

    // Campos opcionales
    if (lane) timingData.lane = lane;
    if (driver) timingData.driver = driver;
    if (best_lap_timestamp) timingData.best_lap_timestamp = best_lap_timestamp;
    if (total_time_timestamp) timingData.total_time_timestamp = total_time_timestamp;
    if (average_time_timestamp) timingData.average_time_timestamp = average_time_timestamp;
    if (setup_snapshot) timingData.setup_snapshot = setup_snapshot;
    if (circuit) timingData.circuit = circuit;

    const { data, error } = await supabase
      .from('competition_timings')
      .insert([timingData])
      .select()
      .single();

    if (error) {
      console.error('Error al registrar tiempo:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error en POST /competitions/:id/timings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener tiempos de una competición
router.get('/:id/timings', async (req, res) => {
  try {
    const { id: competitionId } = req.params;
    const { round_number, participant_id } = req.query;

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

    // Construir la consulta
    let query = supabase
      .from('competition_timings')
      .select(`
        *,
        competition_participants!inner(
          id,
          competition_id
        )
      `)
      .eq('competition_participants.competition_id', competitionId)
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true });

    // Filtros opcionales
    if (round_number) {
      query = query.eq('round_number', round_number);
    }

    if (participant_id) {
      query = query.eq('participant_id', participant_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener tiempos:', error);
      return res.status(500).json({ error: error.message });
    }

    const formatTime = (seconds) => {
      if (typeof seconds !== 'number' || isNaN(seconds)) return null;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(3);
      return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
    };

    const timingsWithPenalty = (data || []).map(t => {
      const penalty = Number(t.penalty_seconds) || 0;
      const totalTime = Number(t.total_time_timestamp) || 0;
      const adjustedTotal = totalTime + penalty;
      return {
        ...t,
        penalty_seconds: penalty,
        adjusted_total_time_timestamp: adjustedTotal,
        adjusted_total_time: formatTime(adjustedTotal),
      };
    });

    res.json(timingsWithPenalty);
  } catch (error) {
    console.error('Error en GET /competitions/:id/timings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un tiempo de competición
router.put('/:id/timings/:timingId', async (req, res) => {
  try {
    const { id: competitionId, timingId } = req.params;
    const { 
      best_lap_time, 
      total_time, 
      laps, 
      average_time, 
      lane, 
      driver, 
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      average_time_timestamp,
      setup_snapshot,
      circuit
    } = req.body;

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

    // Verificar que el tiempo existe y pertenece a esta competición
    const { data: existingTiming, error: timingError } = await supabase
      .from('competition_timings')
      .select('id, participant_id')
      .eq('id', timingId)
      .single();

    if (timingError || !existingTiming) {
      return res.status(404).json({ error: 'Tiempo no encontrado' });
    }

    // Verificar que el participante pertenece a esta competición
    const { data: participant, error: partError } = await supabase
      .from('competition_participants')
      .select('id')
      .eq('id', existingTiming.participant_id)
      .eq('competition_id', competitionId)
      .single();

    if (partError || !participant) {
      return res.status(404).json({ error: 'Participante no encontrado en esta competición' });
    }

    // Validaciones
    if (!best_lap_time || !total_time || !laps || !average_time) {
      return res.status(400).json({ error: 'Todos los campos de tiempo son requeridos' });
    }

    // Actualizar el tiempo
    const updateData = {
      best_lap_time,
      total_time,
      laps,
      average_time
    };

    // Campos opcionales
    if (lane !== undefined) updateData.lane = lane;
    if (driver !== undefined) updateData.driver = driver;
    if (timing_date) updateData.timing_date = timing_date;
    if (best_lap_timestamp !== undefined) updateData.best_lap_timestamp = best_lap_timestamp;
    if (total_time_timestamp !== undefined) updateData.total_time_timestamp = total_time_timestamp;
    if (average_time_timestamp !== undefined) updateData.average_time_timestamp = average_time_timestamp;
    if (setup_snapshot !== undefined) updateData.setup_snapshot = setup_snapshot;
    if (circuit !== undefined) updateData.circuit = circuit;

    const { data, error } = await supabase
      .from('competition_timings')
      .update(updateData)
      .eq('id', timingId)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar tiempo:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /competitions/:id/timings/:timingId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un tiempo de competición
router.delete('/:id/timings/:timingId', async (req, res) => {
  try {
    const { id: competitionId, timingId } = req.params;

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

    // Verificar que el tiempo existe y pertenece a esta competición
    const { data: existingTiming, error: timingError } = await supabase
      .from('competition_timings')
      .select('id, participant_id')
      .eq('id', timingId)
      .single();

    if (timingError || !existingTiming) {
      return res.status(404).json({ error: 'Tiempo no encontrado' });
    }

    // Verificar que el participante pertenece a esta competición
    const { data: participant, error: partError } = await supabase
      .from('competition_participants')
      .select('id')
      .eq('id', existingTiming.participant_id)
      .eq('competition_id', competitionId)
      .single();

    if (partError || !participant) {
      return res.status(404).json({ error: 'Participante no encontrado en esta competición' });
    }

    // Eliminar el tiempo
    const { error } = await supabase
      .from('competition_timings')
      .delete()
      .eq('id', timingId);

    if (error) {
      console.error('Error al eliminar tiempo:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Tiempo eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/timings/:timingId:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== EXPORTACIÓN DE DATOS ====================

// Exportar datos de competición en CSV
router.get('/:id/export/csv', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener participantes
    const { data: participants, error: partError } = await supabase
      .from('competition_participants')
      .select(`
        *,
        vehicles(model, manufacturer)
      `)
      .eq('competition_id', competitionId)
      .order('created_at', { ascending: true });

    if (partError) {
      console.error('Error al obtener participantes:', partError);
      return res.status(500).json({ error: partError.message });
    }

    // Obtener todos los tiempos
    const { data: timings, error: timingsError } = await supabase
      .from('competition_timings')
      .select(`
        *,
        competition_participants!inner(
          id,
          competition_id
        )
      `)
      .eq('competition_participants.competition_id', competitionId)
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (timingsError) {
      console.error('Error al obtener tiempos:', timingsError);
      return res.status(500).json({ error: timingsError.message });
    }

    // Generar datos para CSV
    const csvData = generateCompetitionCSV(competition, participants, timings);

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=competicion_${competition.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);

    res.send(csvData);
  } catch (error) {
    console.error('Error en GET /competitions/:id/export/csv:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar datos de competición en PDF
router.get('/:id/export/pdf', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener participantes
    const { data: participants, error: partError } = await supabase
      .from('competition_participants')
      .select(`
        *,
        vehicles(model, manufacturer)
      `)
      .eq('competition_id', competitionId)
      .order('created_at', { ascending: true });

    if (partError) {
      console.error('Error al obtener participantes:', partError);
      return res.status(500).json({ error: partError.message });
    }

    // Obtener todos los tiempos
    const { data: timings, error: timingsError } = await supabase
      .from('competition_timings')
      .select(`
        *,
        competition_participants!inner(
          id,
          competition_id
        )
      `)
      .eq('competition_participants.competition_id', competitionId)
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (timingsError) {
      console.error('Error al obtener tiempos:', timingsError);
      return res.status(500).json({ error: timingsError.message });
    }

    // Generar PDF
    const { generateCompetitionPDF } = require('../src/utils/competitionPdfGenerator');
    const pdfBuffer = await generateCompetitionPDF(competition, participants, timings);

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=competicion_${competition.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error en GET /competitions/:id/export/pdf:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función auxiliar para generar CSV
function generateCompetitionCSV(competition, participants, timings) {
  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(3);
    return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
  };

  const getVehicleInfo = (participant) => {
    if (participant.vehicles) {
      return `${participant.vehicles.manufacturer} ${participant.vehicles.model}`;
    } else if (participant.vehicle_model) {
      return participant.vehicle_model;
    }
    return 'Sin vehículo';
  };

  // Crear mapa de participantes para acceso rápido
  const participantsMap = {};
  participants.forEach(p => {
    participantsMap[p.id] = p;
  });

  // Calcular estadísticas por participante
  const participantStats = {};
  participants.forEach(participant => {
    const participantTimings = timings.filter(t => t.participant_id === participant.id);
    
    if (participantTimings.length > 0) {
      const bestLap = Math.min(...participantTimings.map(t => parseFloat(t.best_lap_time) || Infinity));
      const totalLaps = participantTimings.reduce((sum, t) => sum + (parseInt(t.laps) || 0), 0);
      const totalTime = participantTimings.reduce((sum, t) => sum + (parseFloat(t.total_time) || 0), 0);
      
      participantStats[participant.id] = {
        bestLap: bestLap === Infinity ? 0 : bestLap,
        totalLaps,
        totalTime,
        roundsCompleted: participantTimings.length
      };
    } else {
      participantStats[participant.id] = {
        bestLap: 0,
        totalLaps: 0,
        totalTime: 0,
        roundsCompleted: 0
      };
    }
  });

  // Ordenar participantes por mejor vuelta
  const sortedParticipants = participants.sort((a, b) => {
    const aBestLap = participantStats[a.id].bestLap;
    const bBestLap = participantStats[b.id].bestLap;
    if (aBestLap === 0 && bBestLap === 0) return 0;
    if (aBestLap === 0) return 1;
    if (bBestLap === 0) return -1;
    return aBestLap - bBestLap;
  });

  // Generar CSV
  let csvContent = '';

  // Encabezado de la competición
  csvContent += `Competición: ${competition.name}\n`;
  csvContent += `Circuito: ${competition.circuit_name || 'No especificado'}\n`;
  csvContent += `Rondas: ${competition.rounds}\n`;
  csvContent += `Participantes: ${participants.length}\n`;
  csvContent += `Fecha de exportación: ${new Date().toLocaleDateString('es-ES')}\n\n`;

  // Ranking general
  csvContent += '=== RANKING GENERAL ===\n';
  csvContent += 'Posición,Piloto,Vehículo,Mejor Vuelta,Vueltas Totales,Tiempo Total,Penalización Total (s),Tiempo Ajustado,Rondas Completadas\n';
  
  sortedParticipants.forEach((participant, index) => {
    const stats = participantStats[participant.id];
    const participantTimings = timings.filter(t => t.participant_id === participant.id);
    const totalPenalty = participantTimings.reduce((sum, t) => sum + (Number(t.penalty_seconds) || 0), 0);
    const adjustedTotal = stats.totalTime + totalPenalty;
    csvContent += `${index + 1},`;
    csvContent += `"${participant.driver_name}",`;
    csvContent += `"${getVehicleInfo(participant)}",`;
    csvContent += `${formatTime(stats.bestLap)},`;
    csvContent += `${stats.totalLaps},`;
    csvContent += `${formatTime(stats.totalTime)},`;
    csvContent += `${totalPenalty.toFixed(3)},`;
    csvContent += `${formatTime(adjustedTotal)},`;
    csvContent += `${stats.roundsCompleted}\n`;
  });

  csvContent += '\n';

  // Datos por ronda
  csvContent += '=== DATOS POR RONDA ===\n';
  csvContent += 'Ronda,Piloto,Vehículo,Mejor Vuelta,Vueltas,Tiempo Total,Penalización (s),Tiempo Ajustado,Tiempo Promedio,Carril\n';
  
  for (let round = 1; round <= competition.rounds; round++) {
    const roundTimings = timings.filter(t => t.round_number === round);
    
    roundTimings.forEach(timing => {
      const participant = participantsMap[timing.participant_id];
      if (participant) {
        const penalty = Number(timing.penalty_seconds) || 0;
        const totalTime = Number(timing.total_time_timestamp) || 0;
        const adjustedTotal = totalTime + penalty;
        csvContent += `${round},`;
        csvContent += `"${participant.driver_name}",`;
        csvContent += `"${getVehicleInfo(participant)}",`;
        csvContent += `${formatTime(timing.best_lap_time)},`;
        csvContent += `${timing.laps},`;
        csvContent += `${formatTime(totalTime)},`;
        csvContent += `${penalty.toFixed(3)},`;
        csvContent += `${formatTime(adjustedTotal)},`;
        csvContent += `${formatTime(timing.average_time)},`;
        csvContent += `${timing.lane || ''}\n`;
      }
    });
  }

  return csvContent;
}

// ==================== CATEGORÍAS DE COMPETICIÓN ====================

// Crear categoría para una competición
router.post('/:id/categories', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
    }

    const { data, error } = await supabase
      .from('competition_categories')
      .insert([{
        competition_id: id,
        name: name.trim()
      }])
      .select()
      .single();

    if (error) {
      console.error('Error al crear categoría:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error en POST /competitions/:id/categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener categorías de una competición
router.get('/:id/categories', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const { data, error } = await supabase
      .from('competition_categories')
      .select('*')
      .eq('competition_id', id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error al obtener categorías:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error en GET /competitions/:id/categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar categoría
router.delete('/:id/categories/:categoryId', async (req, res) => {
  try {
    const { id, categoryId } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const { error } = await supabase
      .from('competition_categories')
      .delete()
      .eq('id', categoryId)
      .eq('competition_id', id);

    if (error) {
      console.error('Error al eliminar categoría:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/categories/:categoryId:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== REGLAS DE COMPETICIÓN ====================

// Crear regla de competición
router.post('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;
    const { rule_type, description, points_structure } = req.body;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    if (!rule_type || !['per_round', 'final', 'best_time_per_round'].includes(rule_type)) {
      return res.status(400).json({ error: 'Tipo de regla debe ser "per_round", "final" o "best_time_per_round"' });
    }

    if (!points_structure || typeof points_structure !== 'object') {
      return res.status(400).json({ error: 'La estructura de puntos es requerida' });
    }

    const { data, error } = await supabase
      .from('competition_rules')
      .insert([{
        competition_id: id,
        rule_type,
        description: description ? description.trim() : null,
        points_structure
      }])
      .select()
      .single();

    if (error) {
      console.error('Error al crear regla:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error en POST /competitions/:id/rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener reglas de una competición
router.get('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const { data, error } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('competition_id', id)
      .order('rule_type', { ascending: true });

    if (error) {
      console.error('Error al obtener reglas:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error en GET /competitions/:id/rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar regla de competición
router.put('/:id/rules/:ruleId', async (req, res) => {
  try {
    const { id, ruleId } = req.params;
    const { rule_type, description, points_structure } = req.body;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const updateData = {};
    if (rule_type) updateData.rule_type = rule_type;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (points_structure) updateData.points_structure = points_structure;

    const { data, error } = await supabase
      .from('competition_rules')
      .update(updateData)
      .eq('id', ruleId)
      .eq('competition_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar regla:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Error en PUT /competitions/:id/rules/:ruleId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar regla de competición
router.delete('/:id/rules/:ruleId', async (req, res) => {
  try {
    const { id, ruleId } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const { error } = await supabase
      .from('competition_rules')
      .delete()
      .eq('id', ruleId)
      .eq('competition_id', id);

    if (error) {
      console.error('Error al eliminar regla:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Regla eliminada correctamente' });
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/rules/:ruleId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener inscripciones de una competición (para el organizador)
router.get('/:id/signups', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const { data, error } = await supabase
      .from('competition_signups')
      .select(`
        *,
        competition_categories(name)
      `)
      .eq('competition_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error al obtener inscripciones:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error en GET /competitions/:id/signups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convertir inscripción en participante oficial
router.post('/:id/signups/:signupId/approve', async (req, res) => {
  try {
    const { id, signupId } = req.params;
    const { vehicle_id, vehicle_model } = req.body;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener la inscripción
    const { data: signup, error: signupError } = await supabase
      .from('competition_signups')
      .select('*')
      .eq('id', signupId)
      .eq('competition_id', id)
      .single();

    if (signupError || !signup) {
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }

    // Verificar que no exceda el número de plazas
    const { count: participantsCount, error: countError } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', id);

    if (countError) {
      console.error('Error al contar participantes:', countError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (participantsCount >= competition.num_slots) {
      return res.status(400).json({ error: 'No hay plazas disponibles para más participantes' });
    }

    // Crear el participante oficial
    const participantData = {
      competition_id: id,
      driver_name: signup.name,
      category_id: signup.category_id
    };

    if (vehicle_id) {
      participantData.vehicle_id = vehicle_id;
    } else if (vehicle_model) {
      participantData.vehicle_model = vehicle_model;
    } else {
      participantData.vehicle_model = signup.vehicle;
    }

    const { data: participant, error: participantError } = await supabase
      .from('competition_participants')
      .insert([participantData])
      .select()
      .single();

    if (participantError) {
      console.error('Error al crear participante:', participantError);
      return res.status(500).json({ error: participantError.message });
    }

    // Eliminar la inscripción
    const { error: deleteError } = await supabase
      .from('competition_signups')
      .delete()
      .eq('id', signupId);

    if (deleteError) {
      console.error('Error al eliminar inscripción:', deleteError);
      // No fallamos aquí porque el participante ya se creó
    }

    res.json(participant);
  } catch (error) {
    console.error('Error en POST /competitions/:id/signups/:signupId/approve:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rechazar inscripción
router.delete('/:id/signups/:signupId', async (req, res) => {
  try {
    const { id, signupId } = req.params;

    // Verificar que la competición existe y pertenece al usuario
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('id', id)
      .eq('organizer', req.user.id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const { error } = await supabase
      .from('competition_signups')
      .delete()
      .eq('id', signupId)
      .eq('competition_id', id);

    if (error) {
      console.error('Error al eliminar inscripción:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Inscripción rechazada correctamente' });
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/signups/:signupId:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PENALIZACIONES ====================

/**
 * @swagger
 * /api/competition-timings/{id}/penalty:
 *   patch:
 *     summary: Actualiza la penalización en segundos para un tiempo de competición
 *     tags:
 *       - Competiciones
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del tiempo de competición
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               penalty_seconds:
 *                 type: number
 *     responses:
 *       200:
 *         description: Penalización actualizada correctamente
 *       500:
 *         description: Error al actualizar la penalización
 */
router.patch('/competition-timings/:id/penalty', async (req, res) => {
  const { id } = req.params;
  const { penalty_seconds } = req.body;

  if (typeof penalty_seconds !== 'number' || penalty_seconds < 0) {
    return res.status(400).json({ error: 'penalty_seconds debe ser un número positivo' });
  }

  const { error } = await supabase
    .from('competition_timings')
    .update({ penalty_seconds })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router; 