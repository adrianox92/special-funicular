const express = require('express');
const multer = require('multer');
const { body, param } = require('express-validator');
const router = express.Router();
const { getServiceOrAnonClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { v4: uuidv4 } = require('uuid');
const { calculatePoints } = require('../lib/pointsCalculator');
const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('../lib/distanceCalculator');
const { deriveCompetitionAverageFromTotalAndLaps } = require('../lib/competitionTimingDerivation');
const { loadCompetitionExportById } = require('../lib/competitionExportPayload');
const { generateCompetitionCSV, safeFilenamePart } = require('../lib/competitionCsvGenerator');
const { generateCompetitionXLSX } = require('../lib/competitionXlsxGenerator');
const { generateCompetitionPDF } = require('../src/utils/competitionPdfGenerator');
const { generateCompetitionSocialPDF } = require('../src/utils/competitionSocialPdfGenerator');
const {
  canViewCompetition,
  requireViewCompetition,
  requireManageCompetition,
} = require('../lib/competitionPermissions');
const { isLicenseAdminUser } = require('../lib/licenseAdminAuth');
const {
  normalizeStatus,
  timingForbiddenReason,
  participantMutationForbiddenReason,
  metadataEditForbiddenReason,
  signupForbiddenReason,
  validateManualStatusTransition,
} = require('../lib/competitionLifecycle');
const { sendWaitlistPromotionEmail } = require('../lib/waitlistMailer');
const { generateRefereeAccessToken, buildRefereeUrl } = require('../lib/refereeLink');
const {
  listCompetitionTimings,
  createCompetitionTiming,
  updateCompetitionTiming,
  updateCompetitionTimingPenalty,
  sendHandlerError,
} = require('../lib/competitionTimingHandlers');
const {
  appendRegulationFileUrl,
  uploadRegulationFile,
  removeRegulationFile,
  normalizeRegulationUrl,
  isAllowedRegulationMime,
  REGULATION_MAX_BYTES,
} = require('../lib/competitionRegulationUpload');

/** Cliente que usa service role si existe (omite RLS; el API valida permisos). Igual que clubs/sync. */
const supabase = getServiceOrAnonClient();

const regulationFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: REGULATION_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedRegulationMime(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF o Word'));
  },
});

/** Promociona el primer signup en lista de espera y envía email (tras liberar plaza de participante). */
async function promoteWaitlistAfterParticipantRemoval(competitionId) {
  const { data: comp, error: cErr } = await supabase
    .from('competitions')
    .select('id, name, public_slug')
    .eq('id', competitionId)
    .maybeSingle();
  if (cErr || !comp?.public_slug) return;

  const { data: next, error: wErr } = await supabase
    .from('competition_signups')
    .select('id, email, name')
    .eq('competition_id', competitionId)
    .eq('is_waitlist', true)
    .order('waitlist_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (wErr || !next) return;

  const { error: uErr } = await supabase
    .from('competition_signups')
    .update({ is_waitlist: false })
    .eq('id', next.id);
  if (uErr) {
    console.error('[waitlist] Error al promocionar signup:', uErr);
    return;
  }

  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const signupUrl = `${base}/competitions/signup/${encodeURIComponent(comp.public_slug)}`;
  await sendWaitlistPromotionEmail({
    to: next.email,
    name: next.name,
    competitionName: comp.name,
    signupUrl,
  });
}

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

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
    let garageUserId = req.user.id;
    const rawGarage = req.query.garage_user_id;
    if (rawGarage != null && String(rawGarage).trim() !== '') {
      const gid = String(rawGarage).trim();
      if (!isUuid(gid)) {
        return res.status(400).json({ error: 'garage_user_id inválido' });
      }
      if (gid !== req.user.id && !isLicenseAdminUser(req.user)) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      garageUserId = gid;
    }

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        model,
        manufacturer,
        type,
        traction
      `)
      .eq('user_id', garageUserId)
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

const competitionCreateValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('El nombre de la competición es requerido')
    .isLength({ max: 200 }),
  body('num_slots').isInt({ min: 1 }).withMessage('El número de plazas debe ser un entero mayor a 0'),
  body('rounds').isInt({ min: 1 }).withMessage('El número de rondas debe ser un entero mayor a 0'),
  body('circuit_name').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }),
  body('circuit_id')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('circuit_id inválido'),
  body('club_id').optional({ values: 'falsy' }).isUUID().withMessage('club_id inválido'),
];

// Crear una nueva competición
router.post('/', competitionCreateValidators, handleValidationErrors, async (req, res) => {
  try {
    const { name, num_slots, rounds, circuit_name, circuit_id, club_id } = req.body;

    if (club_id) {
      const { data: mem } = await supabase
        .from('club_members')
        .select('id')
        .eq('club_id', club_id)
        .eq('user_id', req.user.id)
        .maybeSingle();
      const { data: ownClub } = await supabase
        .from('clubs')
        .select('id')
        .eq('id', club_id)
        .eq('owner_user_id', req.user.id)
        .maybeSingle();
      if (!mem && !ownClub) {
        return res.status(403).json({ error: 'No perteneces a este club' });
      }
    }

    // Si circuit_id se proporciona, verificar que existe y pertenece al usuario
    let circuitNameToStore = circuit_name ? circuit_name.trim() : null;
    if (circuit_id) {
      const { data: circuit, error: circuitError } = await supabase
        .from('circuits')
        .select('name')
        .eq('id', circuit_id)
        .eq('user_id', req.user.id)
        .single();
      if (!circuitError && circuit) {
        circuitNameToStore = circuit.name;
      }
    }

    // Generar public_slug único
    const public_slug = generateSlug(name.trim());

    const insertData = {
      name: name.trim(),
      public_slug: public_slug,
      organizer: req.user.id,
      num_slots: num_slots,
      rounds: rounds,
      circuit_name: circuitNameToStore,
      circuit_id: circuit_id || null,
      club_id: club_id || null,
      status: 'draft',
    };

    const { data, error } = await supabase
      .from('competitions')
      .insert([insertData])
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
    let effectiveUserId = req.user.id;
    const forOrg = req.query.for_organizer;
    if (forOrg != null && String(forOrg).trim() !== '') {
      if (!isLicenseAdminUser(req.user)) {
        return res.status(403).json({ error: 'Solo administradores pueden usar for_organizer' });
      }
      const oid = String(forOrg).trim();
      if (!isUuid(oid)) {
        return res.status(400).json({ error: 'for_organizer inválido' });
      }
      effectiveUserId = oid;
    }

    const { data: owned, error: e1 } = await supabase
      .from('competitions')
      .select(`
        *,
        competition_participants(count),
        circuits(id, name, num_lanes, lane_lengths)
      `)
      .eq('organizer', effectiveUserId)
      .order('created_at', { ascending: false });

    if (e1) {
      console.error('Error al obtener competiciones:', e1);
      return res.status(500).json({ error: e1.message });
    }

    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', effectiveUserId);

    const clubIds = [...new Set((memberships || []).map((m) => m.club_id))];
    let clubComps = [];
    if (clubIds.length > 0) {
      const { data: cc, error: e2 } = await supabase
        .from('competitions')
        .select(`
          *,
          competition_participants(count),
          circuits(id, name, num_lanes, lane_lengths)
        `)
        .in('club_id', clubIds)
        .neq('organizer', effectiveUserId)
        .order('created_at', { ascending: false });
      if (e2) {
        console.error('Error al obtener competiciones de club:', e2);
        return res.status(500).json({ error: e2.message });
      }
      clubComps = cc || [];
    }

    const byId = new Map();
    const format = (comp) => ({
      ...comp,
      participants_count: comp.competition_participants[0]?.count || 0,
    });
    for (const comp of owned || []) {
      byId.set(comp.id, format(comp));
    }
    for (const comp of clubComps) {
      if (!byId.has(comp.id)) byId.set(comp.id, format(comp));
    }

    const competitions = [...byId.values()].map(({ competition_participants, ...rest }) => rest);

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

    // Obtener la competición con datos del circuito
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select(`
        *,
        circuits(id, name, num_lanes, lane_lengths)
      `)
      .eq('id', id)
      .single();

    if (compError || !competition) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    const canView = await canViewCompetition(supabase, req.user, competition);
    if (!canView) {
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

    // Obtener el número de inscripciones pendientes (sin lista de espera)
    const { count: signupsPending, error: signupsPendingErr } = await supabase
      .from('competition_signups')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', id)
      .eq('is_waitlist', false);

    const { count: waitlistCount, error: waitlistErr } = await supabase
      .from('competition_signups')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', id)
      .eq('is_waitlist', true);

    if (signupsPendingErr) {
      console.error('Error al contar inscripciones:', signupsPendingErr);
    }
    if (waitlistErr) {
      console.error('Error al contar lista de espera:', waitlistErr);
    }

    res.json({
      ...appendRegulationFileUrl(supabase, competition),
      participants: participants || [],
      categories: (categories || []).map((cat) => appendRegulationFileUrl(supabase, cat)),
      signups_count: signupsPending || 0,
      waitlist_count: waitlistCount || 0,
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
    const { name, num_slots, rounds, circuit_name, circuit_id } = req.body;

    const access = await requireManageCompetition(supabase, req.user, id, 'id, num_slots, rounds, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const existingComp = access.competition;

    const metaBlock = metadataEditForbiddenReason(existingComp.status);
    if (metaBlock) {
      return res.status(400).json({ error: metaBlock });
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
    if (circuit_id !== undefined) {
      if (circuit_id) {
        const { data: circuit, error: circuitError } = await supabase
          .from('circuits')
          .select('name')
          .eq('id', circuit_id)
          .eq('user_id', existingComp.organizer)
          .single();
        if (!circuitError && circuit) {
          updateData.circuit_id = circuit_id;
          updateData.circuit_name = circuit.name;
        } else {
          updateData.circuit_id = null;
          updateData.circuit_name = null;
        }
      } else {
        updateData.circuit_id = null;
        updateData.circuit_name = null;
      }
    }

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

router.patch(
  '/:id/status',
  body('status')
    .trim()
    .isIn(['draft', 'published', 'running', 'closed'])
    .withMessage('Estado inválido'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const nextStatus = req.body.status.trim();

      const access = await requireManageCompetition(supabase, req.user, id);
      if (!access.ok) return access.respond(res);
      const existingComp = access.competition;

      const { count: participantsCount, error: pcErr } = await supabase
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', id);
      if (pcErr) {
        console.error('PATCH status count participants:', pcErr);
        return res.status(500).json({ error: pcErr.message });
      }

      const transitionErr = validateManualStatusTransition(existingComp.status, nextStatus, {
        participantsCount: participantsCount || 0,
      });
      if (transitionErr) {
        return res.status(400).json({ error: transitionErr });
      }

      const { data, error } = await supabase
        .from('competitions')
        .update({ status: nextStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error al actualizar estado:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(data);
    } catch (error) {
      console.error('Error en PATCH /competitions/:id/status:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Eliminar una competición
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

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
    const { vehicle_id, driver_name, vehicle_model, category_id, team_name } = req.body;

    const access = await requireManageCompetition(supabase, req.user, competitionId, 'id, num_slots, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

    const partBlock = participantMutationForbiddenReason(competition.status);
    if (partBlock) {
      return res.status(400).json({ error: partBlock });
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

    // Si se proporciona vehicle_id, verificar que existe y pertenece al garaje del organizador
    if (vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', vehicle_id)
        .eq('user_id', competition.organizer)
        .single();

      if (vehicleError || !vehicle) {
        return res.status(404).json({ error: 'Vehículo no encontrado en la colección del organizador' });
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

    if (team_name != null && String(team_name).trim()) {
      participantData.team_name = String(team_name).trim();
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

// Añadir participantes en bloque a partir de pilotos favoritos del organizador
router.post('/:id/participants/bulk-from-favorites', async (req, res) => {
  try {
    const { id: competitionId } = req.params;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ error: 'Debes indicar al menos un piloto favorito' });
    }

    const access = await requireManageCompetition(
      supabase,
      req.user,
      competitionId,
      'id, num_slots, organizer, club_id',
    );
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

    const partBlockBulk = participantMutationForbiddenReason(competition.status);
    if (partBlockBulk) {
      return res.status(400).json({ error: partBlockBulk });
    }

    for (const [idx, item] of items.entries()) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ error: `Item ${idx} inválido` });
      }
      if (!item.favorite_id) {
        return res.status(400).json({ error: `Item ${idx}: favorite_id es requerido` });
      }
      if (!item.category_id) {
        return res.status(400).json({ error: `Item ${idx}: category_id es requerido` });
      }
      const src = item.vehicle_source || 'favorite_default';
      if (!['own', 'text', 'favorite_default'].includes(src)) {
        return res.status(400).json({ error: `Item ${idx}: vehicle_source no válido` });
      }
    }

    const favoriteIds = [...new Set(items.map((i) => i.favorite_id))];
    const { data: favorites, error: favErr } = await supabase
      .from('favorite_pilots')
      .select('id, display_name, default_vehicle_id, default_vehicle_model, owner_user_id')
      .in('id', favoriteIds)
      .eq('owner_user_id', competition.organizer);

    if (favErr) {
      console.error('bulk-from-favorites fav lookup', favErr);
      return res.status(500).json({ error: favErr.message });
    }

    const favoritesById = new Map((favorites || []).map((f) => [f.id, f]));
    for (const fid of favoriteIds) {
      if (!favoritesById.has(fid)) {
        return res.status(404).json({ error: `Favorito ${fid} no encontrado` });
      }
    }

    const categoryIds = [...new Set(items.map((i) => i.category_id))];
    const { data: categories, error: catErr } = await supabase
      .from('competition_categories')
      .select('id')
      .eq('competition_id', competitionId)
      .in('id', categoryIds);

    if (catErr) {
      console.error('bulk-from-favorites cat lookup', catErr);
      return res.status(500).json({ error: catErr.message });
    }
    const validCategoryIds = new Set((categories || []).map((c) => c.id));
    for (const cid of categoryIds) {
      if (!validCategoryIds.has(cid)) {
        return res.status(404).json({ error: `Categoría ${cid} no encontrada en esta competición` });
      }
    }

    const ownVehicleIds = items
      .filter((i) => i.vehicle_source === 'own' && i.vehicle_id)
      .map((i) => i.vehicle_id);
    const favoriteOwnVehicleIds = items
      .filter((i) => i.vehicle_source === 'favorite_default')
      .map((i) => favoritesById.get(i.favorite_id)?.default_vehicle_id)
      .filter(Boolean);
    const allOwnVehicleIds = [...new Set([...ownVehicleIds, ...favoriteOwnVehicleIds])];

    const ownedVehicleIds = new Set();
    if (allOwnVehicleIds.length > 0) {
      const { data: ownedVehicles, error: vErr } = await supabase
        .from('vehicles')
        .select('id')
        .in('id', allOwnVehicleIds)
        .eq('user_id', competition.organizer);
      if (vErr) {
        console.error('bulk-from-favorites vehicle lookup', vErr);
        return res.status(500).json({ error: vErr.message });
      }
      (ownedVehicles || []).forEach((v) => ownedVehicleIds.add(v.id));
    }

    const { data: existingSameFavorites, error: existErr } = await supabase
      .from('competition_participants')
      .select('id, from_favorite_id')
      .eq('competition_id', competitionId)
      .in('from_favorite_id', favoriteIds);

    if (existErr) {
      console.error('bulk-from-favorites existing lookup', existErr);
      return res.status(500).json({ error: existErr.message });
    }
    const alreadyFavoriteIds = new Set(
      (existingSameFavorites || []).map((p) => p.from_favorite_id),
    );

    const { count: currentCount, error: countError } = await supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId);
    if (countError) {
      console.error('bulk-from-favorites count', countError);
      return res.status(500).json({ error: countError.message });
    }

    const slotsLeft = (competition.num_slots || 0) - (currentCount || 0);

    const toInsert = [];
    const skipped = [];

    for (const item of items) {
      const fav = favoritesById.get(item.favorite_id);
      if (alreadyFavoriteIds.has(item.favorite_id)) {
        skipped.push({ favorite_id: item.favorite_id, reason: 'Ya añadido previamente' });
        continue;
      }

      const src = item.vehicle_source || 'favorite_default';
      let vehicle_id = null;
      let vehicle_model = null;

      if (src === 'own') {
        if (!item.vehicle_id) {
          skipped.push({ favorite_id: item.favorite_id, reason: 'Falta vehicle_id' });
          continue;
        }
        if (!ownedVehicleIds.has(item.vehicle_id)) {
          skipped.push({ favorite_id: item.favorite_id, reason: 'Vehículo no pertenece al organizador' });
          continue;
        }
        vehicle_id = item.vehicle_id;
      } else if (src === 'text') {
        const trimmed = (item.vehicle_model || '').trim();
        if (!trimmed) {
          skipped.push({ favorite_id: item.favorite_id, reason: 'Falta vehicle_model' });
          continue;
        }
        vehicle_model = trimmed;
      } else {
        if (fav.default_vehicle_id && ownedVehicleIds.has(fav.default_vehicle_id)) {
          vehicle_id = fav.default_vehicle_id;
        } else if (fav.default_vehicle_model && fav.default_vehicle_model.trim()) {
          vehicle_model = fav.default_vehicle_model.trim();
        } else {
          skipped.push({
            favorite_id: item.favorite_id,
            reason: 'El favorito no tiene vehículo por defecto; especifica uno',
          });
          continue;
        }
      }

      const row = {
        competition_id: competitionId,
        driver_name: fav.display_name,
        category_id: item.category_id,
        registered_by: req.user.id,
        from_favorite_id: fav.id,
      };
      if (vehicle_id) row.vehicle_id = vehicle_id;
      if (vehicle_model) row.vehicle_model = vehicle_model;

      toInsert.push(row);
    }

    if (toInsert.length > slotsLeft) {
      return res.status(400).json({
        error: `Solo quedan ${slotsLeft} plazas disponibles y se intentan añadir ${toInsert.length}`,
      });
    }

    let created = [];
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('competition_participants')
        .insert(toInsert)
        .select(`
          *,
          vehicles(model, manufacturer)
        `);
      if (error) {
        console.error('bulk-from-favorites insert', error);
        return res.status(500).json({ error: error.message });
      }
      created = data || [];
    }

    return res.status(201).json({ created, skipped });
  } catch (error) {
    console.error('Error en POST /competitions/:id/participants/bulk-from-favorites:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener participantes de una competición
router.get('/:id/participants', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    const access = await requireViewCompetition(supabase, req.user, competitionId);
    if (!access.ok) return access.respond(res);

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
    const { vehicle_id, driver_name, vehicle_model, category_id, team_name } = req.body;

    const access = await requireManageCompetition(supabase, req.user, competitionId);
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

    const partBlockPut = participantMutationForbiddenReason(competition.status);
    if (partBlockPut) {
      return res.status(400).json({ error: partBlockPut });
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

    // Si se proporciona vehicle_id, verificar que existe y pertenece al garaje del organizador
    if (vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', vehicle_id)
        .eq('user_id', competition.organizer)
        .single();

      if (vehicleError || !vehicle) {
        return res.status(404).json({ error: 'Vehículo no encontrado en la colección del organizador' });
      }
    }

    // Actualizar el participante
    const updateData = {};
    if (driver_name) updateData.driver_name = driver_name.trim();
    if (category_id) updateData.category_id = category_id;
    if (team_name !== undefined) {
      updateData.team_name =
        team_name == null || (typeof team_name === 'string' && !team_name.trim())
          ? null
          : String(team_name).trim();
    }
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

    const access = await requireManageCompetition(supabase, req.user, competitionId);
    if (!access.ok) return access.respond(res);
    const competitionRow = access.competition;

    const partBlock = participantMutationForbiddenReason(competitionRow.status);
    if (partBlock) {
      return res.status(400).json({ error: partBlock });
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

    await promoteWaitlistAfterParticipantRemoval(competitionId);

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

    const access = await requireViewCompetition(supabase, req.user, id, 'id, num_slots, rounds, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

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
          penalty_seconds,
          did_not_participate
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

    const { data: categories, error: catError } = await supabase
      .from('competition_categories')
      .select('id, name')
      .eq('competition_id', id)
      .order('name', { ascending: true });
    if (catError) {
      console.error('Error al obtener categorías:', catError);
      return res.status(500).json({ error: catError.message });
    }

    const { data: fullParticipants, error: fullPartError } = await supabase
      .from('competition_participants')
      .select(`
        id,
        driver_name,
        team_name,
        vehicle_model,
        category_id,
        vehicles(model, manufacturer)
      `)
      .eq('competition_id', id);

    if (fullPartError) {
      console.error('Error al obtener participantes:', fullPartError);
      return res.status(500).json({ error: fullPartError.message });
    }

    const participantsForPoints = (fullParticipants || []).filter(
      (p) => timesByParticipant[p.id]
    );
    const allTimings = Object.values(timesByParticipant).flat();

    const { pointsByParticipant, participantStats, categoryRankings } = calculatePoints({
      competition,
      participants: participantsForPoints,
      timings: allTimings,
      rules: rules || [],
      categories: categories || [],
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
      participant_stats: participantStats,
      category_rankings: categoryRankings || [],
      has_category_rules: (rules || []).some((r) => r.category_id != null),
    });
  } catch (error) {
    console.error('Error en GET /competitions/:id/progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENLACE MODO ÁRBITRO ====================

router.get(
  '/:id/referee-link/status',
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const access = await requireManageCompetition(supabase, req.user, id, 'id, referee_access_token');
      if (!access.ok) return access.respond(res);
      const enabled = Boolean(access.competition.referee_access_token);
      res.json({
        enabled,
        referee_url: enabled ? buildRefereeUrl(access.competition.referee_access_token) : null,
      });
    } catch (e) {
      console.error('GET /competitions/:id/referee-link/status', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.post(
  '/:id/referee-link/enable',
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const access = await requireManageCompetition(supabase, req.user, id, 'id, referee_access_token');
      if (!access.ok) return access.respond(res);

      let token = access.competition.referee_access_token;
      if (!token) {
        token = generateRefereeAccessToken();
        const { error } = await supabase
          .from('competitions')
          .update({ referee_access_token: token })
          .eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
      }

      res.status(200).json({ enabled: true, referee_url: buildRefereeUrl(token) });
    } catch (e) {
      console.error('POST /competitions/:id/referee-link/enable', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.post(
  '/:id/referee-link/regenerate',
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const access = await requireManageCompetition(supabase, req.user, id);
      if (!access.ok) return access.respond(res);

      const token = generateRefereeAccessToken();
      const { error } = await supabase
        .from('competitions')
        .update({ referee_access_token: token })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });

      res.json({ enabled: true, referee_url: buildRefereeUrl(token) });
    } catch (e) {
      console.error('POST /competitions/:id/referee-link/regenerate', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.post(
  '/:id/referee-link/disable',
  param('id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const access = await requireManageCompetition(supabase, req.user, id);
      if (!access.ok) return access.respond(res);

      const { error } = await supabase
        .from('competitions')
        .update({ referee_access_token: null })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });

      res.json({ enabled: false, referee_url: null });
    } catch (e) {
      console.error('POST /competitions/:id/referee-link/disable', e);
      res.status(500).json({ error: e.message });
    }
  },
);

// ==================== TIEMPOS DE COMPETICIÓN ====================

// Registrar un tiempo de competición
router.post('/:id/timings', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    const access = await requireManageCompetition(supabase, req.user, competitionId, 'id, rounds, organizer, club_id, status');
    if (!access.ok) return access.respond(res);

    const result = await createCompetitionTiming(supabase, competitionId, access.competition, req.body);
    if (result.error) return sendHandlerError(res, result.error);
    res.status(result.status || 201).json(result.data);
  } catch (error) {
    console.error('Error en POST /competitions/:id/timings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener tiempos de una competición
router.get('/:id/timings', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    const access = await requireViewCompetition(supabase, req.user, competitionId);
    if (!access.ok) return access.respond(res);

    const result = await listCompetitionTimings(supabase, competitionId, req.query);
    if (result.error) {
      console.error('Error al obtener tiempos:', result.error);
      return sendHandlerError(res, result.error);
    }

    res.json(result.data);
  } catch (error) {
    console.error('Error en GET /competitions/:id/timings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un tiempo de competición
router.put('/:id/timings/:timingId', async (req, res) => {
  try {
    const { id: competitionId, timingId } = req.params;

    const access = await requireManageCompetition(supabase, req.user, competitionId, 'id, rounds, organizer, club_id, status');
    if (!access.ok) return access.respond(res);

    const result = await updateCompetitionTiming(
      supabase,
      competitionId,
      access.competition,
      timingId,
      req.body,
    );
    if (result.error) return sendHandlerError(res, result.error);
    res.json(result.data);
  } catch (error) {
    console.error('Error en PUT /competitions/:id/timings/:timingId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un tiempo de competición
router.delete('/:id/timings/:timingId', async (req, res) => {
  try {
    const { id: competitionId, timingId } = req.params;

    const access = await requireManageCompetition(supabase, req.user, competitionId);
    if (!access.ok) return access.respond(res);

    const timingBlockDel = timingForbiddenReason(access.competition.status);
    if (timingBlockDel) {
      return res.status(400).json({ error: timingBlockDel });
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
      .select('id, vehicle_id')
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

    // Actualizar odómetro del vehículo si el participante tiene uno
    if (participant.vehicle_id) {
      try {
        await updateVehicleOdometer(supabase, participant.vehicle_id);
      } catch (odometerError) {
        console.warn('Error al actualizar odómetro:', odometerError);
      }
    }

    res.json({ message: 'Tiempo eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/timings/:timingId:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== EXPORTACIÓN DE DATOS ====================

// Exportar datos de competición — PDF compacto para redes (podio + barras)
router.get('/:id/export/social', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    const access = await requireViewCompetition(supabase, req.user, competitionId, 'id');
    if (!access.ok) return access.respond(res);

    const loaded = await loadCompetitionExportById(supabase, competitionId);
    if (loaded.error) {
      console.error('export social load:', loaded.error);
      return res.status(500).json({ error: loaded.error.message || 'Error al cargar datos' });
    }
    const { competition, payload } = loaded;

    const need = payload.participants.length * payload.competition.rounds;
    const completed = need > 0 && payload.timings.length >= need;
    if (!completed) {
      return res.status(400).json({
        error: 'La competición no está finalizada; no hay resultados completos para exportar.',
      });
    }

    let clubName = null;
    if (competition.club_id) {
      const { data: clubRow } = await supabase.from('clubs').select('name').eq('id', competition.club_id).maybeSingle();
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
    console.error('Error en GET /competitions/:id/export/social:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar datos de competición en CSV
router.get('/:id/export/csv', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    const access = await requireViewCompetition(supabase, req.user, competitionId, 'id');
    if (!access.ok) return access.respond(res);

    const loaded = await loadCompetitionExportById(supabase, competitionId);
    if (loaded.error) {
      console.error('export csv load:', loaded.error);
      return res.status(500).json({ error: loaded.error.message || 'Error al cargar datos' });
    }
    const { competition, payload } = loaded;

    const csvData = generateCompetitionCSV(payload);
    const base = safeFilenamePart(competition.name);
    const day = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=competicion_${base}_${day}.csv`
    );
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

    const access = await requireViewCompetition(supabase, req.user, competitionId, 'id');
    if (!access.ok) return access.respond(res);

    const loaded = await loadCompetitionExportById(supabase, competitionId);
    if (loaded.error) {
      console.error('export pdf load:', loaded.error);
      return res.status(500).json({ error: loaded.error.message || 'Error al cargar datos' });
    }
    const { competition, payload } = loaded;

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
    console.error('Error en GET /competitions/:id/export/pdf:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar datos de competición en Excel (.xlsx)
router.get('/:id/export/xlsx', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    const access = await requireViewCompetition(supabase, req.user, competitionId, 'id');
    if (!access.ok) return access.respond(res);

    const loaded = await loadCompetitionExportById(supabase, competitionId);
    if (loaded.error) {
      console.error('export xlsx load:', loaded.error);
      return res.status(500).json({ error: loaded.error.message || 'Error al cargar datos' });
    }
    const { competition, payload } = loaded;

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
    console.error('Error en GET /competitions/:id/export/xlsx:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CATEGORÍAS DE COMPETICIÓN ====================

async function fetchCategoryForCompetition(competitionId, categoryId) {
  const { data, error } = await supabase
    .from('competition_categories')
    .select('*')
    .eq('id', categoryId)
    .eq('competition_id', competitionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Crear categoría para una competición
router.post('/:id/categories', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, regulation_url } = req.body;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
    }

    let normalizedUrl = null;
    if (regulation_url != null && regulation_url !== '') {
      normalizedUrl = normalizeRegulationUrl(regulation_url);
      if (!normalizedUrl) {
        return res.status(400).json({ error: 'La URL del reglamento no es válida' });
      }
    }

    const { data, error } = await supabase
      .from('competition_categories')
      .insert([{
        competition_id: id,
        name: name.trim(),
        regulation_url: normalizedUrl,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error al crear categoría:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(appendRegulationFileUrl(supabase, data));
  } catch (error) {
    console.error('Error en POST /competitions/:id/categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener categorías de una competición
router.get('/:id/categories', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await requireViewCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    const { data, error } = await supabase
      .from('competition_categories')
      .select('*')
      .eq('competition_id', id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error al obtener categorías:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json((data || []).map((row) => appendRegulationFileUrl(supabase, row)));
  } catch (error) {
    console.error('Error en GET /competitions/:id/categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar categoría
router.put('/:id/categories/:categoryId', async (req, res) => {
  try {
    const { id, categoryId } = req.params;
    const { name, regulation_url } = req.body;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    const existing = await fetchCategoryForCompetition(id, categoryId);
    if (!existing) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
      }
      updateData.name = String(name).trim();
    }

    if (regulation_url !== undefined) {
      if (regulation_url == null || regulation_url === '') {
        updateData.regulation_url = null;
      } else {
        const normalizedUrl = normalizeRegulationUrl(regulation_url);
        if (!normalizedUrl) {
          return res.status(400).json({ error: 'La URL del reglamento no es válida' });
        }
        updateData.regulation_url = normalizedUrl;
        if (existing.regulation_file_path) {
          await removeRegulationFile(supabase, existing.regulation_file_path);
          updateData.regulation_file_path = null;
          updateData.regulation_file_name = null;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    const { data, error } = await supabase
      .from('competition_categories')
      .update(updateData)
      .eq('id', categoryId)
      .eq('competition_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar categoría:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(appendRegulationFileUrl(supabase, data));
  } catch (error) {
    console.error('Error en PUT /competitions/:id/categories/:categoryId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subir fichero de reglamento de categoría
router.post(
  '/:id/categories/:categoryId/regulation',
  param('id').isUUID(),
  param('categoryId').isUUID(),
  handleValidationErrors,
  regulationFileUpload.single('file'),
  async (req, res) => {
    try {
      const { id, categoryId } = req.params;

      const access = await requireManageCompetition(supabase, req.user, id);
      if (!access.ok) return access.respond(res);

      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Falta el archivo del reglamento' });
      }

      const existing = await fetchCategoryForCompetition(id, categoryId);
      if (!existing) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      const { storagePath, fileName } = await uploadRegulationFile(supabase, {
        buffer: req.file.buffer,
        originalName: req.file.originalname || 'reglamento.pdf',
        mimeType: req.file.mimetype,
        competitionId: id,
        categoryId,
      });

      if (existing.regulation_file_path && existing.regulation_file_path !== storagePath) {
        await removeRegulationFile(supabase, existing.regulation_file_path);
      }

      const { data, error } = await supabase
        .from('competition_categories')
        .update({
          regulation_file_path: storagePath,
          regulation_file_name: fileName,
          regulation_url: null,
        })
        .eq('id', categoryId)
        .eq('competition_id', id)
        .select()
        .single();

      if (error) {
        await removeRegulationFile(supabase, storagePath);
        console.error('Error al guardar reglamento de categoría:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(appendRegulationFileUrl(supabase, data));
    } catch (error) {
      if (error.message === 'Solo se permiten archivos PDF o Word') {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error en POST /competitions/:id/categories/:categoryId/regulation:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Eliminar fichero de reglamento de categoría
router.delete('/:id/categories/:categoryId/regulation', async (req, res) => {
  try {
    const { id, categoryId } = req.params;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    const existing = await fetchCategoryForCompetition(id, categoryId);
    if (!existing) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    if (existing.regulation_file_path) {
      await removeRegulationFile(supabase, existing.regulation_file_path);
    }

    const { data, error } = await supabase
      .from('competition_categories')
      .update({
        regulation_file_path: null,
        regulation_file_name: null,
      })
      .eq('id', categoryId)
      .eq('competition_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al eliminar reglamento de categoría:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(appendRegulationFileUrl(supabase, data));
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/categories/:categoryId/regulation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar categoría
router.delete('/:id/categories/:categoryId', async (req, res) => {
  try {
    const { id, categoryId } = req.params;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    const existing = await fetchCategoryForCompetition(id, categoryId);
    if (existing?.regulation_file_path) {
      await removeRegulationFile(supabase, existing.regulation_file_path);
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

// ==================== REGLAMENTO GLOBAL DE COMPETICIÓN ====================

// Actualizar URL del reglamento global (competiciones sin categorías)
router.put('/:id/regulation', async (req, res) => {
  try {
    const { id } = req.params;
    const { regulation_url } = req.body;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    const { data: existing, error: fetchError } = await supabase
      .from('competitions')
      .select('id, regulation_file_path')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    let normalizedUrl = null;
    if (regulation_url != null && regulation_url !== '') {
      normalizedUrl = normalizeRegulationUrl(regulation_url);
      if (!normalizedUrl) {
        return res.status(400).json({ error: 'La URL del reglamento no es válida' });
      }
    }

    const updateData = { regulation_url: normalizedUrl };
    if (existing.regulation_file_path) {
      await removeRegulationFile(supabase, existing.regulation_file_path);
      updateData.regulation_file_path = null;
      updateData.regulation_file_name = null;
    }

    const { data, error } = await supabase
      .from('competitions')
      .update(updateData)
      .eq('id', id)
      .select('id, regulation_url, regulation_file_path, regulation_file_name')
      .single();

    if (error) {
      console.error('Error al actualizar reglamento de competición:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(appendRegulationFileUrl(supabase, data));
  } catch (error) {
    console.error('Error en PUT /competitions/:id/regulation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subir fichero de reglamento global
router.post(
  '/:id/regulation',
  param('id').isUUID(),
  handleValidationErrors,
  regulationFileUpload.single('file'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const access = await requireManageCompetition(supabase, req.user, id);
      if (!access.ok) return access.respond(res);

      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Falta el archivo del reglamento' });
      }

      const { data: existing, error: fetchError } = await supabase
        .from('competitions')
        .select('id, regulation_file_path')
        .eq('id', id)
        .maybeSingle();
      if (fetchError || !existing) {
        return res.status(404).json({ error: 'Competición no encontrada' });
      }

      const { storagePath, fileName } = await uploadRegulationFile(supabase, {
        buffer: req.file.buffer,
        originalName: req.file.originalname || 'reglamento.pdf',
        mimeType: req.file.mimetype,
        competitionId: id,
      });

      if (existing.regulation_file_path && existing.regulation_file_path !== storagePath) {
        await removeRegulationFile(supabase, existing.regulation_file_path);
      }

      const { data, error } = await supabase
        .from('competitions')
        .update({
          regulation_file_path: storagePath,
          regulation_file_name: fileName,
          regulation_url: null,
        })
        .eq('id', id)
        .select('id, regulation_url, regulation_file_path, regulation_file_name')
        .single();

      if (error) {
        await removeRegulationFile(supabase, storagePath);
        console.error('Error al subir reglamento de competición:', error);
        return res.status(500).json({ error: error.message });
      }

      res.json(appendRegulationFileUrl(supabase, data));
    } catch (error) {
      if (error.message === 'Solo se permiten archivos PDF o Word') {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error en POST /competitions/:id/regulation:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Eliminar fichero de reglamento global
router.delete('/:id/regulation', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    const { data: existing, error: fetchError } = await supabase
      .from('competitions')
      .select('id, regulation_file_path')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Competición no encontrada' });
    }

    if (existing.regulation_file_path) {
      await removeRegulationFile(supabase, existing.regulation_file_path);
    }

    const { data, error } = await supabase
      .from('competitions')
      .update({
        regulation_file_path: null,
        regulation_file_name: null,
      })
      .eq('id', id)
      .select('id, regulation_url, regulation_file_path, regulation_file_name')
      .single();

    if (error) {
      console.error('Error al eliminar reglamento de competición:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(appendRegulationFileUrl(supabase, data));
  } catch (error) {
    console.error('Error en DELETE /competitions/:id/regulation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== REGLAS DE COMPETICIÓN ====================

// Crear regla de competición
router.post('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;
    const { rule_type, description, points_structure, category_id, target_rounds } = req.body;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    if (!rule_type || !['per_round', 'final', 'best_time_per_round', 'power_stage'].includes(rule_type)) {
      return res.status(400).json({ error: 'Tipo de regla debe ser "per_round", "final", "best_time_per_round" o "power_stage"' });
    }

    if (rule_type === 'power_stage') {
      if (!Array.isArray(target_rounds) || target_rounds.length === 0) {
        return res.status(400).json({ error: 'Debes seleccionar al menos una ronda para Power Stage' });
      }
    }

    if (!points_structure || typeof points_structure !== 'object') {
      return res.status(400).json({ error: 'La estructura de puntos es requerida' });
    }

    if (category_id) {
      const { data: category, error: catError } = await supabase
        .from('competition_categories')
        .select('id')
        .eq('id', category_id)
        .eq('competition_id', id)
        .maybeSingle();
      if (catError || !category) {
        return res.status(400).json({ error: 'Categoría no válida para esta competición' });
      }
    }

    const { data, error } = await supabase
      .from('competition_rules')
      .insert([{
        competition_id: id,
        rule_type,
        description: description ? description.trim() : null,
        points_structure,
        category_id: category_id || null,
        target_rounds: rule_type === 'power_stage'
          ? [...new Set(target_rounds.map((r) => Number(r)).filter((r) => Number.isInteger(r) && r > 0))].sort((a, b) => a - b)
          : null,
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

    const access = await requireViewCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

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
    const { rule_type, description, points_structure, category_id } = req.body;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    if (category_id) {
      const { data: category, error: catError } = await supabase
        .from('competition_categories')
        .select('id')
        .eq('id', category_id)
        .eq('competition_id', id)
        .maybeSingle();
      if (catError || !category) {
        return res.status(400).json({ error: 'Categoría no válida para esta competición' });
      }
    }

    const updateData = {};
    if (rule_type) updateData.rule_type = rule_type;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (points_structure) updateData.points_structure = points_structure;
    if (category_id !== undefined) updateData.category_id = category_id || null;

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

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

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

// Inscripción autenticada (p. ej. miembro del club con JWT)
router.post(
  '/:id/signups',
  body('category_id').isUUID().withMessage('Categoría inválida'),
  body('vehicle_id').optional({ values: 'falsy' }).isUUID().withMessage('Vehículo inválido'),
  body('vehicle').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }),
  body('name').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        category_id: categoryId,
        vehicle,
        vehicle_id: vehicleIdBody,
        name: nameBody,
      } = req.body;

      const hasVehicleId = typeof vehicleIdBody === 'string' && vehicleIdBody.trim().length > 0;
      const hasVehicleText = typeof vehicle === 'string' && vehicle.trim().length > 0;
      if (!hasVehicleId && !hasVehicleText) {
        return res.status(400).json({
          error: 'Debes seleccionar un vehículo de tu colección o escribir un modelo.',
        });
      }

      const access = await requireViewCompetition(supabase, req.user, id, 'id, num_slots, organizer, club_id');
      if (!access.ok) return access.respond(res);
      const competition = access.competition;

      const signupBlock = signupForbiddenReason(competition.status);
      if (signupBlock) {
        return res.status(400).json({ error: signupBlock });
      }

      const email = (req.user.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'Tu cuenta no tiene email; no puedes inscribirte por esta vía.' });
      }

      const { data: categories, error: catErr } = await supabase
        .from('competition_categories')
        .select('id')
        .eq('id', categoryId)
        .eq('competition_id', id)
        .maybeSingle();
      if (catErr || !categories) {
        return res.status(400).json({ error: 'Categoría no válida para esta competición' });
      }

      let vehicleText = hasVehicleText ? String(vehicle).trim() : null;
      let vehicleIdValue = null;
      if (hasVehicleId) {
        const { data: vehicleRow, error: vehicleErr } = await supabase
          .from('vehicles')
          .select('id, manufacturer, model, user_id')
          .eq('id', vehicleIdBody)
          .maybeSingle();
        if (vehicleErr || !vehicleRow) {
          return res.status(400).json({ error: 'Vehículo no encontrado' });
        }
        if (vehicleRow.user_id !== req.user.id) {
          return res
            .status(403)
            .json({ error: 'Solo puedes inscribirte con vehículos de tu propia colección.' });
        }
        vehicleIdValue = vehicleRow.id;
        if (!vehicleText) {
          vehicleText = [vehicleRow.manufacturer, vehicleRow.model].filter(Boolean).join(' ').trim() || 'Vehículo de colección';
        }
      }

      const { count: participantsCount, error: pcErr } = await supabase
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', id);
      if (pcErr) {
        console.error('participants count signup', pcErr);
        return res.status(500).json({ error: pcErr.message });
      }
      const filled = (participantsCount ?? 0) >= competition.num_slots;

      const { data: existingSignup } = await supabase
        .from('competition_signups')
        .select('id')
        .eq('competition_id', id)
        .eq('email', email)
        .maybeSingle();
      if (existingSignup) {
        return res.status(400).json({ error: 'Ya estás inscrito en esta competición' });
      }

      const displayName =
        (nameBody && String(nameBody).trim()) ||
        (req.user.user_metadata?.full_name && String(req.user.user_metadata.full_name).trim()) ||
        email.split('@')[0] ||
        'Piloto';

      let insertPayload = {
        competition_id: id,
        name: displayName,
        email,
        vehicle: vehicleText,
        vehicle_id: vehicleIdValue,
        category_id: categoryId,
        is_waitlist: false,
        waitlist_position: null,
      };

      if (filled) {
        const { data: maxRows } = await supabase
          .from('competition_signups')
          .select('waitlist_position')
          .eq('competition_id', id)
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

      const { data: signup, error: signupError } = await supabase
        .from('competition_signups')
        .insert([insertPayload])
        .select(`*, competition_categories(name), vehicles(id, model, manufacturer, type)`)
        .single();

      if (signupError) {
        console.error('signup insert', signupError);
        return res.status(500).json({ error: signupError.message });
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
          vehicle_id: signup.vehicle_id,
          vehicles: signup.vehicles ?? null,
          category: signup.competition_categories?.name,
        },
      });
    } catch (error) {
      console.error('Error en POST /competitions/:id/signups:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Obtener inscripciones de una competición (para el organizador)
router.get('/:id/signups', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

    const { data, error } = await supabase
      .from('competition_signups')
      .select(`
        *,
        competition_categories(name),
        vehicles(id, model, manufacturer, type)
      `)
      .eq('competition_id', id)
      .order('is_waitlist', { ascending: true })
      .order('waitlist_position', { ascending: true, nullsFirst: false })
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

    const access = await requireManageCompetition(supabase, req.user, id, 'id, num_slots, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

    const approveBlock = participantMutationForbiddenReason(competition.status);
    if (approveBlock) {
      return res.status(400).json({ error: approveBlock });
    }

    const { data: signup, error: signupError } = await supabase
      .from('competition_signups')
      .select('*')
      .eq('id', signupId)
      .eq('competition_id', id)
      .single();

    if (signupError || !signup) {
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }

    if (signup.is_waitlist) {
      return res.status(400).json({
        error: 'Este piloto está en lista de espera; promóvelo cuando haya una plaza libre.',
      });
    }

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

    // Crear el participante oficial. Orden de prioridad para el vehículo:
    //   1) vehicle_id u override explícito del organizador (por si sustituye la elección del miembro).
    //   2) vehicle_model texto explícito enviado por el organizador.
    //   3) vehicle_id elegido por el miembro en la inscripción (su propia colección).
    //   4) texto libre que haya escrito el miembro en la inscripción.
    const participantData = {
      competition_id: id,
      driver_name: signup.name,
      category_id: signup.category_id,
    };

    const hasOrganizerVehicleId = typeof vehicle_id === 'string' && vehicle_id.trim().length > 0;
    const hasOrganizerModel = typeof vehicle_model === 'string' && vehicle_model.trim().length > 0;

    if (hasOrganizerVehicleId) {
      participantData.vehicle_id = vehicle_id.trim();
    } else if (hasOrganizerModel) {
      participantData.vehicle_model = vehicle_model.trim();
    } else if (signup.vehicle_id) {
      participantData.vehicle_id = signup.vehicle_id;
    } else if (signup.vehicle && signup.vehicle.trim().length > 0) {
      participantData.vehicle_model = signup.vehicle.trim();
    } else {
      return res
        .status(400)
        .json({ error: 'Debes asignar un vehículo para aprobar esta inscripción.' });
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

    const access = await requireManageCompetition(supabase, req.user, id);
    if (!access.ok) return access.respond(res);

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
  try {
    const { id: timingId } = req.params;
    const { penalty_seconds } = req.body;

    if (typeof penalty_seconds !== 'number' || penalty_seconds < 0) {
      return res.status(400).json({ error: 'penalty_seconds debe ser un número positivo' });
    }

    const { data: timingRow, error: timingErr } = await supabase
      .from('competition_timings')
      .select('id, participant_id')
      .eq('id', timingId)
      .single();

    if (timingErr || !timingRow) {
      return res.status(404).json({ error: 'Tiempo no encontrado' });
    }

    const { data: partRow, error: partErr } = await supabase
      .from('competition_participants')
      .select('competition_id')
      .eq('id', timingRow.participant_id)
      .single();

    if (partErr || !partRow?.competition_id) {
      return res.status(404).json({ error: 'Tiempo no encontrado' });
    }

    const competitionId = partRow.competition_id;

    const access = await requireManageCompetition(supabase, req.user, competitionId);
    if (!access.ok) return access.respond(res);

    const result = await updateCompetitionTimingPenalty(
      supabase,
      competitionId,
      timingId,
      penalty_seconds,
    );
    if (result.error) return sendHandlerError(res, result.error);
    res.json({ success: true });
  } catch (error) {
    console.error('PATCH /competition-timings/:id/penalty', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 