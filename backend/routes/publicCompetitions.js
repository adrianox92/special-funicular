const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * @swagger
 * /api/public-signup/{slug}:
 *   get:
 *     summary: Obtiene información pública de una competición para inscripción
 *     tags:
 *       - Competiciones Públicas
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug público de la competición
 *     responses:
 *       200:
 *         description: Información de la competición
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *
 * /api/public-signup/{slug}/signup:
 *   post:
 *     summary: Inscripción pública a una competición
 *     tags:
 *       - Competiciones Públicas
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug público de la competición
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               category_id:
 *                 type: string
 *               vehicle:
 *                 type: string
 *     responses:
 *       201:
 *         description: Inscripción realizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *
 * /api/public-signup/{slug}/status:
 *   get:
 *     summary: Obtiene el estado público de una competición
 *     tags:
 *       - Competiciones Públicas
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug público de la competición
 *     responses:
 *       200:
 *         description: Estado de la competición
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

// Ruta de prueba simple
router.get('/test', (req, res) => {
  res.json({ message: 'Ruta pública funcionando correctamente' });
});

// Endpoint público para obtener información de competición para inscripción
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Obtener la competición por public_slug
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select(`
        id,
        name,
        num_slots,
        rounds,
        circuit_name,
        created_at
      `)
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener categorías disponibles
    const { data: categories, error: catError } = await supabase
      .from('competition_categories')
      .select('id, name')
      .eq('competition_id', competition.id)
      .order('name', { ascending: true });

    if (catError) {
      console.error('Error al obtener categorías:', catError);
    }

    // Verificar que hay al menos una categoría
    if (!categories || categories.length === 0) {
      return res.status(400).json({ 
        error: 'Esta competición no tiene categorías configuradas. Contacta al organizador.' 
      });
    }

    // Obtener número de inscripciones actuales
    const { count: signupsCount, error: countError } = await supabase
      .from('competition_signups')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competition.id);

    if (countError) {
      console.error('Error al contar inscripciones:', countError);
    }

    // Preparar respuesta
    const response = {
      ...competition,
      categories: categories || [],
      signups_count: signupsCount || 0
    };

    res.json(response);
  } catch (error) {
    console.error('Error en GET /public-signup/:slug:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inscripción pública (sin autenticación)
router.post('/:slug/signup', async (req, res) => {
  try {
    const { slug } = req.params;
    const { name, email, category_id, vehicle } = req.body;

    // Validaciones
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    if (!category_id) {
      return res.status(400).json({ error: 'Debes seleccionar una categoría' });
    }

    if (!vehicle || !vehicle.trim()) {
      return res.status(400).json({ error: 'El vehículo es requerido' });
    }

    // Obtener la competición por public_slug
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id, num_slots')
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Verificar que la categoría existe y pertenece a esta competición
    const { data: category, error: catError } = await supabase
      .from('competition_categories')
      .select('id, name')
      .eq('id', category_id)
      .eq('competition_id', competition.id)
      .single();

    if (catError || !category) {
      return res.status(400).json({ error: 'Categoría no válida para esta competición' });
    }

    // Verificar si hay plazas disponibles
    const { count: signupsCount, error: countError } = await supabase
      .from('competition_signups')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competition.id);

    if (countError) {
      console.error('Error al contar inscripciones:', countError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (signupsCount >= competition.num_slots) {
      return res.status(400).json({ error: 'No hay plazas disponibles en esta competición' });
    }

    // Verificar si el email ya está inscrito
    const { data: existingSignup, error: existingError } = await supabase
      .from('competition_signups')
      .select('id')
      .eq('competition_id', competition.id)
      .eq('email', email.trim())
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error al verificar inscripción existente:', existingError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (existingSignup) {
      return res.status(400).json({ error: 'Ya estás inscrito en esta competición' });
    }

    // Crear la inscripción
    const { data: signup, error: signupError } = await supabase
      .from('competition_signups')
      .insert([{
        competition_id: competition.id,
        name: name.trim(),
        email: email.trim(),
        vehicle: vehicle.trim(),
        category_id: category_id
      }])
      .select(`
        *,
        competition_categories(name)
      `)
      .single();

    if (signupError) {
      console.error('Error al crear inscripción:', signupError);
      return res.status(500).json({ error: 'Error al procesar la inscripción' });
    }

    res.status(201).json({
      message: 'Inscripción enviada correctamente',
      signup: {
        id: signup.id,
        name: signup.name,
        email: signup.email,
        vehicle: signup.vehicle,
        category: signup.competition_categories?.name
      }
    });
  } catch (error) {
    console.error('Error en POST /public-signup/:slug/signup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint público para obtener el estado de la competición
router.get('/:slug/status', async (req, res) => {
  try {
    const { slug } = req.params;
    // Obtener la competición por public_slug
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select(`
        id,
        name,
        num_slots,
        rounds,
        circuit_name,
        created_at
      `)
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener participantes oficiales
    const { data: participants, error: partError } = await supabase
      .from('competition_participants')
      .select(`
        id,
        driver_name,
        vehicle_model,
        vehicles(model, manufacturer)
      `)
      .eq('competition_id', competition.id)
      .order('created_at', { ascending: true });

    if (partError) {
      console.error('Error al obtener participantes:', partError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Obtener todos los tiempos registrados
    const { data: timings, error: timingsError } = await supabase
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
        timing_date
      `)
      .in('participant_id', participants.map(p => p.id))
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (timingsError) {
      console.error('Error al obtener tiempos:', timingsError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Calcular progreso
    const totalRequiredTimes = participants.length * competition.rounds;
    const timesCount = timings.length;
    const isCompleted = timesCount >= totalRequiredTimes;
    const progressPercentage = totalRequiredTimes > 0 ? (timesCount / totalRequiredTimes) * 100 : 0;

    // Calcular estadísticas por participante
    const participantStats = participants.map(participant => {
      const participantTimings = timings.filter(t => t.participant_id === participant.id);
      const roundsCompleted = participantTimings.length;
      const roundsRemaining = competition.rounds - roundsCompleted;
      
      // Calcular tiempo total acumulado
      let totalTimeSeconds = 0;
      let bestLapTime = null;
      let totalLaps = 0;
      
      participantTimings.forEach(timing => {
        // Convertir tiempo total a segundos
        const timeParts = timing.total_time.split(':');
        const timeInSeconds = parseFloat(timeParts[0]) * 60 + parseFloat(timeParts[1]);
        totalTimeSeconds += timeInSeconds;
        
        // Actualizar mejor vuelta
        if (!bestLapTime || timing.best_lap_time < bestLapTime) {
          bestLapTime = timing.best_lap_time;
        }
        
        totalLaps += timing.laps;
      });

      // Formatear tiempo total
      const totalMinutes = Math.floor(totalTimeSeconds / 60);
      const totalSeconds = (totalTimeSeconds % 60).toFixed(3);
      const totalTimeFormatted = totalTimeSeconds > 0 ? 
        `${String(totalMinutes).padStart(2, '0')}:${totalSeconds.padStart(6, '0')}` : null;

      return {
        participant_id: participant.id,
        driver_name: participant.driver_name,
        vehicle_info: participant.vehicles ? 
          `${participant.vehicles.manufacturer} ${participant.vehicles.model}` : 
          participant.vehicle_model,
        rounds_completed: roundsCompleted,
        rounds_remaining: roundsRemaining,
        total_time: totalTimeFormatted,
        best_lap_time: bestLapTime,
        total_laps: totalLaps,
        timings: participantTimings
      };
    });

    // Ordenar participantes por completitud y tiempo total
    const sortedParticipants = participantStats.sort((a, b) => {
      // Primero por completitud de rondas (descendente)
      if (a.rounds_completed !== b.rounds_completed) {
        return b.rounds_completed - a.rounds_completed;
      }
      
      // Si tienen las mismas rondas completadas, ordenar por tiempo total
      if (a.total_time && b.total_time) {
        const timeAParts = a.total_time.split(':');
        const timeBParts = b.total_time.split(':');
        const timeA = parseFloat(timeAParts[0]) * 60 + parseFloat(timeAParts[1]);
        const timeB = parseFloat(timeBParts[0]) * 60 + parseFloat(timeBParts[1]);
        return timeA - timeB;
      }
      
      // Si uno no tiene tiempo total, el otro va primero
      if (a.total_time && !b.total_time) return -1;
      if (!a.total_time && b.total_time) return 1;
      
      return 0;
    });

    // Añadir posición a cada participante
    sortedParticipants.forEach((participant, index) => {
      participant.position = index + 1;
    });

    // Calcular mejor vuelta global
    let globalBestLap = null;
    let globalBestLapParticipant = null;
    
    timings.forEach(timing => {
      if (!globalBestLap || timing.best_lap_time < globalBestLap) {
        globalBestLap = timing.best_lap_time;
        globalBestLapParticipant = participants.find(p => p.id === timing.participant_id);
      }
    });

    // Obtener reglas de puntuación
    const { data: rules, error: rulesError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('competition_id', competition.id);
    if (rulesError) {
      console.error('Error al obtener reglas:', rulesError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Inicializar puntos por participante
    const pointsByParticipant = {};
    participants.forEach(p => { pointsByParticipant[p.id] = 0; });

    // Reglas por ronda y final (puntuación estándar)
    const perRoundRule = rules.find(r => r.rule_type === 'per_round');
    const finalRule = rules.find(r => r.rule_type === 'final');
    const bestTimeRule = rules.find(r => r.rule_type === 'best_time_per_round');

    // Puntuación por ronda
    if (perRoundRule) {
      for (let round = 1; round <= competition.rounds; round++) {
        // Tiempos de la ronda
        const roundTimings = timings.filter(t => t.round_number === round);
        // Solo sumar puntos si todos los participantes han registrado tiempo en la ronda
        if (roundTimings.length === participants.length) {
          // Ordenar por tiempo total ascendente (mejor primero)
          const sorted = roundTimings.slice().sort((a, b) => {
            const aTime = a.total_time ? parseFloat(a.total_time.split(':')[0]) * 60 + parseFloat(a.total_time.split(':')[1]) : Infinity;
            const bTime = b.total_time ? parseFloat(b.total_time.split(':')[0]) * 60 + parseFloat(b.total_time.split(':')[1]) : Infinity;
            return aTime - bTime;
          });
          Object.entries(perRoundRule.points_structure).forEach(([pos, pts], idx) => {
            if (sorted[idx]) {
              pointsByParticipant[sorted[idx].participant_id] += pts;
            }
          });
        }
      }
    }

    // Puntuación por mejor tiempo por ronda
    let bestTimeTies = [];
    if (bestTimeRule && bestTimeRule.points_structure?.points > 0) {
      for (let round = 1; round <= competition.rounds; round++) {
        const roundTimings = timings.filter(t => t.round_number === round);
        // Solo sumar puntos si todos los participantes han registrado tiempo en la ronda
        if (roundTimings.length === participants.length) {
          let bestTiming = roundTimings[0];
          roundTimings.forEach(t => {
            if (t.best_lap_time < bestTiming.best_lap_time) {
              bestTiming = t;
            }
          });
          // Verificar si hay empate
          const tied = roundTimings.filter(t => t.best_lap_time === bestTiming.best_lap_time);
          if (tied.length === 1 && bestTiming && bestTiming.participant_id) {
            pointsByParticipant[bestTiming.participant_id] += bestTimeRule.points_structure.points;
          } else if (tied.length > 1) {
            bestTimeTies.push({ round, time: bestTiming.best_lap_time });
          }
        }
      }
    }

    // Puntuación final (solo si la competición está completada)
    if (finalRule && isCompleted) {
      // Ordenar participantes por tiempo total (mejor primero)
      const finalSorted = sortedParticipants.slice().sort((a, b) => {
        if (a.total_time && b.total_time) {
          const aTime = a.total_time.split(':');
          const bTime = b.total_time.split(':');
          const aSeconds = parseFloat(aTime[0]) * 60 + parseFloat(aTime[1]);
          const bSeconds = parseFloat(bTime[0]) * 60 + parseFloat(bTime[1]);
          return aSeconds - bSeconds;
        }
        if (a.total_time && !b.total_time) return -1;
        if (!a.total_time && b.total_time) return 1;
        return 0;
      });
      Object.entries(finalRule.points_structure).forEach(([pos, pts], idx) => {
        if (finalSorted[idx]) {
          pointsByParticipant[finalSorted[idx].participant_id] += pts;
        }
      });
    }

    // Añadir los puntos calculados a cada participante
    sortedParticipants.forEach(p => {
      p.points = pointsByParticipant[p.participant_id] || 0;
    });

    // Preparar respuesta
    const response = {
      competition: {
        id: competition.id,
        name: competition.name,
        circuit_name: competition.circuit_name,
        rounds: competition.rounds,
        num_slots: competition.num_slots,
        created_at: competition.created_at
      },
      status: {
        is_completed: isCompleted,
        progress_percentage: Math.round(progressPercentage),
        participants_count: participants.length,
        times_registered: timesCount,
        total_required_times: totalRequiredTimes,
        times_remaining: Math.max(0, totalRequiredTimes - timesCount)
      },
      participants: sortedParticipants,
      global_best_lap: globalBestLap ? {
        time: globalBestLap,
        driver: globalBestLapParticipant?.driver_name
      } : null
    };

    // Añadir avisos de empates en mejor vuelta
    if (bestTimeTies.length > 0) {
      response.best_time_ties = bestTimeTies;
      response.best_time_ties_message = 'No se han otorgado puntos extra por mejor vuelta en las rondas con empate de tiempo.';
    }

    res.json(response);
  } catch (error) {
    console.error('Error en GET /public/:slug/status:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener reglas de puntuación de una competición pública
router.get('/:slug/rules', async (req, res) => {
  try {
    const { slug } = req.params;
    // Buscar la competición por public_slug
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener reglas de puntuación
    const { data: rules, error: rulesError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('competition_id', competition.id);

    if (rulesError) {
      return res.status(500).json({ error: 'Error al obtener reglas' });
    }

    res.json(rules || []);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router; 