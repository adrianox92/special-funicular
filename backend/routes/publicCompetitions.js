const express = require('express');
const router = express.Router();
const { getServiceClient, getServiceOrAnonClient } = require('../lib/supabaseClients');
/** Service role: lecturas públicas por slug; el API filtra borradores y valida inscripciones. */
const supabase = getServiceOrAnonClient();
const { loadCompetitionExportByPublicSlug } = require('../lib/competitionExportPayload');
const {
  calculatePoints,
  lapTimeStringToSeconds,
  isUsableBestLapTimeString
} = require('../lib/pointsCalculator');
const { generateCompetitionCSV, safeFilenamePart } = require('../lib/competitionCsvGenerator');
const { generateCompetitionXLSX } = require('../lib/competitionXlsxGenerator');
const { generateCompetitionPDF } = require('../src/utils/competitionPdfGenerator');
const { generateCompetitionSocialPDF } = require('../src/utils/competitionSocialPdfGenerator');
const { normalizeStatus, signupForbiddenReason, registrationDeadlineForbiddenReason } = require('../lib/competitionLifecycle');
const { isLicenseAdminUser } = require('../lib/licenseAdminAuth');
const { optionalAuthMiddleware } = require('../middleware/auth');
const { appendRegulationFileUrl } = require('../lib/competitionRegulationUpload');
const { handlePresentationStream } = require('../lib/presentationStream');
const supabaseStorage = getServiceOrAnonClient();

function isDraftCompetitionPublic(competition) {
  return normalizeStatus(competition) === 'draft';
}

function mapParticipantToPresentation(participant, competitionRounds) {
  const rounds = [];
  for (let i = 1; i <= competitionRounds; i++) {
    const roundTiming = (participant.timings || []).find((t) => t.round_number === i);
    const isDnp = Boolean(roundTiming?.did_not_participate);
    rounds.push({
      round_number: i,
      did_not_participate: isDnp,
      time_timestamp:
        roundTiming && !isDnp && roundTiming.total_time
          ? parseFloat(roundTiming.total_time.split(':')[0]) * 60 +
            parseFloat(roundTiming.total_time.split(':')[1])
          : null,
      penalty_seconds: roundTiming ? Number(roundTiming.penalty_seconds) || 0 : 0,
    });
  }

  const hasParticipated = (participant.timings || []).some((t) => t && !t.did_not_participate);
  let bestLapSeconds = null;
  if (hasParticipated && isUsableBestLapTimeString(participant.best_lap_time)) {
    bestLapSeconds = lapTimeStringToSeconds(participant.best_lap_time);
  }

  const vehicleInfo = participant.vehicle_info || '';
  const vehicleParts = vehicleInfo.split(' ');

  return {
    id: participant.participant_id,
    driver_name: participant.driver_name,
    team_name: participant.team_name,
    vehicle_name: vehicleParts.slice(1).join(' '),
    vehicle_brand: vehicleParts[0] || '',
    total_time_timestamp: participant.total_time_seconds,
    penalties: participant.penalty_seconds,
    best_lap: bestLapSeconds,
    position: participant.position,
    points: participant.points ?? 0,
    category_id: participant.category_id || null,
    rounds,
  };
}

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
 *
 * /api/public-signup/{slug}/presentation:
 *   get:
 *     summary: Obtiene datos específicos para el modo presentación
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
 *         description: Datos de presentación de la competición
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 competition:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     circuit_name:
 *                       type: string
 *                     rounds:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                 participants:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       driver_name:
 *                         type: string
 *                       team_name:
 *                         type: string
 *                         nullable: true
 *                       vehicle_name:
 *                         type: string
 *                       vehicle_brand:
 *                         type: string
 *                       total_time_timestamp:
 *                         type: number
 *                       penalties:
 *                         type: number
 *                       best_lap:
 *                         type: number
 *                         nullable: true
 *                       points:
 *                         type: integer
 *                       position:
 *                         type: integer
 *                       rounds:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             round_number:
 *                               type: integer
 *                             did_not_participate:
 *                               type: boolean
 *                             time_timestamp:
 *                               type: number
 *                               nullable: true
 *                             penalty_seconds:
 *                               type: number
 *       404:
 *         description: Competición no encontrada
 *       500:
 *         description: Error interno del servidor
 */

// Ruta de prueba simple
router.get('/test', (req, res) => {
  res.json({ message: 'Ruta pública funcionando correctamente' });
});

function competitionExportCompleted(payload) {
  const need = payload.participants.length * payload.competition.rounds;
  return need > 0 && payload.timings.length >= need;
}

async function sendPublicExportError(res, err) {
  const st = err && err.statusCode ? err.statusCode : 500;
  const msg =
    err && err.message ? err.message : 'Error interno';
  return res.status(st).json({ error: msg });
}

function rejectDraftPublic(competition, res) {
  if (isDraftCompetitionPublic(competition)) {
    res.status(404).json({ error: 'Competición no encontrada' });
    return true;
  }
  return false;
}

router.get('/:slug/export/csv', async (req, res) => {
  try {
    const { slug } = req.params;
    const loaded = await loadCompetitionExportByPublicSlug(supabase, slug);
    if (loaded.error) {
      return sendPublicExportError(res, loaded.error);
    }
    const { competition, payload } = loaded;
    if (rejectDraftPublic(competition, res)) return;
    if (!competitionExportCompleted(payload)) {
      return res.status(400).json({
        error: 'La competición no está finalizada; no hay resultados completos para exportar.',
      });
    }
    const csvData = generateCompetitionCSV(payload);
    const base = safeFilenamePart(competition.name);
    const day = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=competicion_${base}_${day}.csv`);
    res.send(csvData);
  } catch (error) {
    console.error('GET /public-signup/:slug/export/csv:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/export/pdf', async (req, res) => {
  try {
    const { slug } = req.params;
    const loaded = await loadCompetitionExportByPublicSlug(supabase, slug);
    if (loaded.error) {
      return sendPublicExportError(res, loaded.error);
    }
    const { competition, payload } = loaded;
    if (rejectDraftPublic(competition, res)) return;
    if (!competitionExportCompleted(payload)) {
      return res.status(400).json({
        error: 'La competición no está finalizada; no hay resultados completos para exportar.',
      });
    }
    const pdfBuffer = await generateCompetitionPDF(competition, payload.participants, payload.timings, {
      sortedParticipants: payload.sortedParticipants,
      rules: payload.rules,
      categoryRankings: payload.categoryRankings,
    });
    const base = safeFilenamePart(competition.name);
    const day = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=competicion_${base}_${day}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('GET /public-signup/:slug/export/pdf:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/export/xlsx', async (req, res) => {
  try {
    const { slug } = req.params;
    const loaded = await loadCompetitionExportByPublicSlug(supabase, slug);
    if (loaded.error) {
      return sendPublicExportError(res, loaded.error);
    }
    const { competition, payload } = loaded;
    if (rejectDraftPublic(competition, res)) return;
    if (!competitionExportCompleted(payload)) {
      return res.status(400).json({
        error: 'La competición no está finalizada; no hay resultados completos para exportar.',
      });
    }
    const buf = generateCompetitionXLSX(payload);
    const base = safeFilenamePart(competition.name);
    const day = new Date().toISOString().split('T')[0];
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=competicion_${base}_${day}.xlsx`);
    res.send(buf);
  } catch (error) {
    console.error('GET /public-signup/:slug/export/xlsx:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug/export/social', async (req, res) => {
  try {
    const { slug } = req.params;
    const loaded = await loadCompetitionExportByPublicSlug(supabase, slug);
    if (loaded.error) {
      return sendPublicExportError(res, loaded.error);
    }
    const { competition, payload } = loaded;
    if (rejectDraftPublic(competition, res)) return;
    if (!competitionExportCompleted(payload)) {
      return res.status(400).json({
        error: 'La competición no está finalizada; no hay resultados completos para exportar.',
      });
    }

    let clubName = null;
    const svc = getServiceClient();
    if (competition.club_id && svc) {
      const { data: clubRow } = await svc.from('clubs').select('name').eq('id', competition.club_id).maybeSingle();
      clubName = clubRow?.name || null;
    }

    const pdfBuffer = await generateCompetitionSocialPDF(competition, {
      sortedParticipants: payload.sortedParticipants,
      rules: payload.rules,
      clubName,
    });
    const base = safeFilenamePart(competition.name);
    const day = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=competicion_${base}_social_${day}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('GET /public-signup/:slug/export/social:', error);
    res.status(500).json({ error: error.message });
  }
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
        created_at,
        status,
        registration_deadline,
        regulation_url,
        regulation_file_path,
        regulation_file_name
      `)
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    if (isDraftCompetitionPublic(competition)) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener categorías disponibles
    const { data: categories, error: catError } = await supabase
      .from('competition_categories')
      .select('id, name, regulation_url, regulation_file_path, regulation_file_name')
      .eq('competition_id', competition.id)
      .order('name', { ascending: true });

    if (catError) {
      console.error('Error al obtener categorías:', catError);
    }

    const { count: participantsCount, error: pcErr } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competition.id);

    const { count: signupsPending, error: spErr } = await supabase
      .from('competition_signups')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competition.id)
      .eq('is_waitlist', false);

    const { count: waitlistCount, error: wlErr } = await supabase
      .from('competition_signups')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competition.id)
      .eq('is_waitlist', true);

    if (pcErr) console.error('Error al contar participantes:', pcErr);
    if (spErr) console.error('Error al contar inscripciones:', spErr);
    if (wlErr) console.error('Error al contar lista de espera:', wlErr);

    const enrichedCategories = (categories || []).map((cat) =>
      appendRegulationFileUrl(supabaseStorage, cat)
    );
    const enrichedCompetition = appendRegulationFileUrl(supabaseStorage, competition);

    const response = {
      ...enrichedCompetition,
      categories: enrichedCategories,
      participants_count: participantsCount || 0,
      signups_count: signupsPending || 0,
      waitlist_count: waitlistCount || 0,
    };

    res.json(response);
  } catch (error) {
    console.error('Error en GET /public-signup/:slug:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inscripción pública (autenticación opcional para exenciones de organizador/admin)
router.post('/:slug/signup', optionalAuthMiddleware, async (req, res) => {
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

    if (!vehicle || !vehicle.trim()) {
      return res.status(400).json({ error: 'El vehículo es requerido' });
    }

    // Obtener la competición por public_slug
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id, num_slots, status, registration_deadline, organizer')
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const signupBlock = signupForbiddenReason(competition.status);
    if (signupBlock) {
      return res.status(400).json({ error: signupBlock });
    }

    const isOrganizerOrAdmin =
      req.user &&
      (competition.organizer === req.user.id || isLicenseAdminUser(req.user));
    if (!isOrganizerOrAdmin) {
      const deadlineBlock = registrationDeadlineForbiddenReason(competition);
      if (deadlineBlock) {
        return res.status(400).json({ error: deadlineBlock });
      }
    }

    const { data: competitionCategories, error: categoriesError } = await supabase
      .from('competition_categories')
      .select('id')
      .eq('competition_id', competition.id);

    if (categoriesError) {
      console.error('Error al obtener categorías:', categoriesError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const hasCategories = Array.isArray(competitionCategories) && competitionCategories.length > 0;

    if (hasCategories && !category_id) {
      return res.status(400).json({ error: 'Debes seleccionar una categoría' });
    }

    let resolvedCategoryId = null;
    let categoryName = null;

    if (hasCategories) {
      const { data: category, error: catError } = await supabase
        .from('competition_categories')
        .select('id, name')
        .eq('id', category_id)
        .eq('competition_id', competition.id)
        .single();

      if (catError || !category) {
        return res.status(400).json({ error: 'Categoría no válida para esta competición' });
      }
      resolvedCategoryId = category.id;
      categoryName = category.name;
    } else if (category_id) {
      return res.status(400).json({ error: 'Esta competición no tiene categorías' });
    }

    const { count: participantsCount, error: pcErr } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competition.id);
    if (pcErr) {
      console.error('Error al contar participantes:', pcErr);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const filled = (participantsCount ?? 0) >= competition.num_slots;

    // Verificar si el email ya está inscrito
    const { data: existingSignup, error: existingError } = await supabase
      .from('competition_signups')
      .select('id')
      .eq('competition_id', competition.id)
      .eq('email', email.trim())
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error al verificar inscripción existente:', existingError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    if (existingSignup) {
      return res.status(400).json({ error: 'Ya estás inscrito en esta competición' });
    }

    let insertPayload = {
      competition_id: competition.id,
      name: name.trim(),
      email: email.trim(),
      vehicle: vehicle.trim(),
      category_id: resolvedCategoryId,
      is_waitlist: false,
      waitlist_position: null,
    };

    if (filled) {
      const { data: maxRows } = await supabase
        .from('competition_signups')
        .select('waitlist_position')
        .eq('competition_id', competition.id)
        .eq('is_waitlist', true)
        .order('waitlist_position', { ascending: false, nullsFirst: false })
        .limit(1);
      const maxPos =
        Array.isArray(maxRows) && maxRows.length > 0 && maxRows[0]?.waitlist_position != null
          ? Number(maxRows[0].waitlist_position)
          : 0;
      insertPayload = {
        ...insertPayload,
        is_waitlist: true,
        waitlist_position: maxPos + 1,
      };
    }

    // Crear la inscripción
    const { data: signup, error: signupError } = await supabase
      .from('competition_signups')
      .insert([insertPayload])
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
      message: filled
        ? 'Te has añadido a la lista de espera'
        : 'Inscripción enviada correctamente',
      waitlisted: Boolean(signup.is_waitlist),
      waitlist_position: signup.waitlist_position ?? null,
      signup: {
        id: signup.id,
        name: signup.name,
        email: signup.email,
        vehicle: signup.vehicle,
        category: signup.competition_categories?.name || categoryName,
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
        created_at,
        status
      `)
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    if (isDraftCompetitionPublic(competition)) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    // Obtener participantes oficiales
    const { data: participants, error: partError } = await supabase
      .from('competition_participants')
      .select(`
        id,
        driver_name,
        team_name,
        vehicle_model,
        category_id,
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
        driver,
        circuit,
        timing_date,
        penalty_seconds,
        did_not_participate
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

    // Obtener reglas de puntuación
    const { data: rules, error: rulesError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('competition_id', competition.id);
    if (rulesError) {
      console.error('Error al obtener reglas:', rulesError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const { data: categories, error: catError } = await supabase
      .from('competition_categories')
      .select('id, name')
      .eq('competition_id', competition.id)
      .order('name', { ascending: true });
    if (catError) {
      console.error('Error al obtener categorías:', catError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Calcular puntos y stats usando la función centralizada
    const { sortedParticipants, categoryRankings } = calculatePoints({
      competition,
      participants,
      timings,
      rules,
      categories: categories || [],
    });

    // Mejor vuelta global: solo rondas con participación real (no NP, no 00:00.000)
    let globalBestLap = null;
    let globalBestLapParticipant = null;
    let globalBestLapSeconds = null;

    timings.forEach(timing => {
      if (timing.did_not_participate) return;
      if (!isUsableBestLapTimeString(timing.best_lap_time)) return;
      const sec = lapTimeStringToSeconds(timing.best_lap_time);
      if (globalBestLapSeconds == null || sec < globalBestLapSeconds) {
        globalBestLapSeconds = sec;
        globalBestLap = timing.best_lap_time;
        globalBestLapParticipant = participants.find(p => p.id === timing.participant_id);
      }
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
      categories: categories || [],
      category_rankings: categoryRankings || [],
      has_category_rules: (rules || []).some((r) => r.category_id != null),
      global_best_lap: globalBestLap ? {
        time: globalBestLap,
        driver: globalBestLapParticipant?.driver_name
      } : null
    };

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
      .select('id, status')
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    if (isDraftCompetitionPublic(competition)) {
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

// Endpoint específico para el modo presentación
router.get('/:slug/presentation/stream', async (req, res) => {
  try {
    await handlePresentationStream(req, res, req.params.slug);
  } catch (error) {
    console.error('Error en GET /public-signup/:slug/presentation/stream:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

// Endpoint específico para el modo presentación
router.get('/:slug/presentation', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Obtener la competición por public_slug (circuit_name o relación circuits)
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select(`
        id,
        name,
        num_slots,
        rounds,
        circuit_name,
        circuit_id,
        circuits ( name ),
        created_at,
        status
      `)
      .eq('public_slug', slug)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    if (isDraftCompetitionPublic(competition)) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const embeddedCircuit =
      competition.circuits == null
        ? null
        : Array.isArray(competition.circuits)
          ? competition.circuits[0]
          : competition.circuits;
    const circuitDisplayName =
      (competition.circuit_name && String(competition.circuit_name).trim()) ||
      (embeddedCircuit && embeddedCircuit.name) ||
      null;

    // Obtener participantes oficiales
    const { data: participants, error: partError } = await supabase
      .from('competition_participants')
      .select(`
        id,
        driver_name,
        team_name,
        vehicle_model,
        category_id,
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
        driver,
        circuit,
        timing_date,
        penalty_seconds,
        did_not_participate
      `)
      .in('participant_id', participants.map(p => p.id))
      .order('round_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (timingsError) {
      console.error('Error al obtener tiempos:', timingsError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Obtener reglas de puntuación
    const { data: rules, error: rulesError } = await supabase
      .from('competition_rules')
      .select('*')
      .eq('competition_id', competition.id);
    
    if (rulesError) {
      console.error('Error al obtener reglas:', rulesError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const { data: categories, error: catError } = await supabase
      .from('competition_categories')
      .select('id, name')
      .eq('competition_id', competition.id)
      .order('name', { ascending: true });
    if (catError) {
      console.error('Error al obtener categorías:', catError);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Calcular puntos y stats usando la función centralizada
    const { sortedParticipants, categoryRankings } = calculatePoints({
      competition,
      participants,
      timings,
      rules,
      categories: categories || [],
    });

    const presentationParticipants = sortedParticipants.map((participant) =>
      mapParticipantToPresentation(participant, competition.rounds)
    );

    const categoryParticipants = (categoryRankings || []).map((ranking) => ({
      category_id: ranking.category_id,
      category_name: ranking.category_name,
      participants: (ranking.sortedParticipants || []).map((participant) =>
        mapParticipantToPresentation(participant, competition.rounds)
      ),
    }));

    const totalRequiredTimes = participants.length * competition.rounds;
    const isCompleted =
      totalRequiredTimes > 0 && timings.length >= totalRequiredTimes;

    // Preparar respuesta
    const response = {
      competition: {
        id: competition.id,
        name: competition.name,
        circuit_name: circuitDisplayName,
        rounds: competition.rounds,
        created_at: competition.created_at,
        status: isCompleted ? 'finished' : 'active',
      },
      participants: presentationParticipants,
      category_participants: categoryParticipants,
      has_category_rules: (rules || []).some((r) => r.category_id != null),
    };

    res.json(response);
  } catch (error) {
    console.error('Error en GET /public-signup/:slug/presentation:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router; 