const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getAnonClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { v4: uuidv4 } = require('uuid');
const { calculatePoints } = require('../lib/pointsCalculator');
const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('../lib/distanceCalculator');
const { deriveCompetitionAverageFromTotalAndLaps } = require('../lib/competitionTimingDerivation');
const {
  canViewCompetition,
  requireViewCompetition,
  requireManageCompetition,
} = require('../lib/competitionPermissions');

const supabase = getAnonClient();

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
    const { data: owned, error: e1 } = await supabase
      .from('competitions')
      .select(`
        *,
        competition_participants(count),
        circuits(id, name, num_lanes, lane_lengths)
      `)
      .eq('organizer', req.user.id)
      .order('created_at', { ascending: false });

    if (e1) {
      console.error('Error al obtener competiciones:', e1);
      return res.status(500).json({ error: e1.message });
    }

    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', req.user.id);

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
        .neq('organizer', req.user.id)
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

    const canView = await canViewCompetition(supabase, req.user.id, competition);
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
    const { name, num_slots, rounds, circuit_name, circuit_id } = req.body;

    const access = await requireManageCompetition(supabase, req.user.id, id, 'id, num_slots, rounds, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const existingComp = access.competition;

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
          .eq('user_id', req.user.id)
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

// Eliminar una competición
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const access = await requireManageCompetition(supabase, req.user.id, id);
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

    const access = await requireManageCompetition(supabase, req.user.id, competitionId, 'id, num_slots, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

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
      req.user.id,
      competitionId,
      'id, num_slots, organizer, club_id',
    );
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

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
      .eq('owner_user_id', req.user.id);

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
        .eq('user_id', req.user.id);
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

    const access = await requireViewCompetition(supabase, req.user.id, competitionId);
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

    const access = await requireManageCompetition(supabase, req.user.id, competitionId);
    if (!access.ok) return access.respond(res);

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

    const access = await requireManageCompetition(supabase, req.user.id, competitionId);
    if (!access.ok) return access.respond(res);

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

    const access = await requireViewCompetition(supabase, req.user.id, id, 'id, num_slots, rounds, organizer, club_id');
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
      lane, 
      driver, 
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      setup_snapshot,
      circuit,
      circuit_id,
      round_number,
      did_not_participate,
    } = req.body;

    const isDnp = Boolean(did_not_participate);

    const access = await requireManageCompetition(supabase, req.user.id, competitionId, 'id, rounds, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

    // Verificar que el participante existe y pertenece a esta competición
    const { data: participant, error: partError } = await supabase
      .from('competition_participants')
      .select('id, vehicle_id')
      .eq('id', participant_id)
      .eq('competition_id', competitionId)
      .single();

    if (partError || !participant) {
      return res.status(404).json({ error: 'Participante no encontrado en esta competición' });
    }

    // Obtener scale_factor del vehículo si el participante tiene uno
    let scaleFactor = DEFAULT_SCALE_FACTOR;
    if (participant.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('scale_factor')
        .eq('id', participant.vehicle_id)
        .single();
      if (vehicle?.scale_factor) scaleFactor = vehicle.scale_factor;
    }

    // Validaciones de tiempo (saltadas para NP)
    let derivedAverage = null;
    if (!isDnp) {
      if (!best_lap_time || !total_time || laps === undefined || laps === null || laps === '') {
        return res.status(400).json({ error: 'Mejor vuelta, tiempo total y vueltas son requeridos' });
      }

      derivedAverage = deriveCompetitionAverageFromTotalAndLaps(total_time, laps);
      if (!derivedAverage) {
        return res.status(400).json({
          error: 'Tiempo total debe ser mm:ss.mmm y el número de vueltas un entero mayor que 0',
        });
      }
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
    const timingData = isDnp
      ? {
          participant_id,
          did_not_participate: true,
          best_lap_time: '00:00.000',
          total_time: '00:00.000',
          laps: 0,
          average_time: '00:00.000',
          round_number,
          timing_date: timing_date || new Date().toISOString().split('T')[0],
        }
      : {
          participant_id,
          did_not_participate: false,
          best_lap_time,
          total_time,
          laps,
          average_time: derivedAverage.average_time,
          average_time_timestamp: derivedAverage.average_time_timestamp,
          round_number,
          timing_date: timing_date || new Date().toISOString().split('T')[0],
        };

    // Campos opcionales (no aplican a NP)
    if (!isDnp) {
      if (lane) timingData.lane = lane;
      if (driver) timingData.driver = driver;
      if (best_lap_timestamp) timingData.best_lap_timestamp = best_lap_timestamp;
      if (total_time_timestamp) timingData.total_time_timestamp = total_time_timestamp;
      if (setup_snapshot) timingData.setup_snapshot = setup_snapshot;
    }
    let circuitLaneLengths = [];
    if (!isDnp && circuit_id) {
      const { data: circuit, error: circuitError } = await supabase
        .from('circuits')
        .select('name, lane_lengths')
        .eq('id', circuit_id)
        .eq('user_id', req.user.id)
        .single();
      if (!circuitError && circuit) {
        timingData.circuit_id = circuit_id;
        timingData.circuit = circuit.name;
        circuitLaneLengths = Array.isArray(circuit.lane_lengths) ? circuit.lane_lengths : [];
      }
    } else if (!isDnp && circuit) {
      timingData.circuit = circuit;
    }

    // Calcular distancia y velocidad (no aplica a NP)
    if (!isDnp) {
      const distanceSpeed = calculateDistanceAndSpeed({
        laps,
        lane,
        circuitLaneLengths,
        totalTimeSeconds: total_time_timestamp,
        bestLapSeconds: best_lap_timestamp,
        scaleFactor,
      });
      if (distanceSpeed) {
        Object.assign(timingData, distanceSpeed);
      }
    }

    const { data, error } = await supabase
      .from('competition_timings')
      .insert([timingData])
      .select()
      .single();

    if (error) {
      console.error('Error al registrar tiempo:', error);
      return res.status(500).json({ error: error.message });
    }

    // Actualizar odómetro del vehículo si el participante tiene uno (no aplica a NP)
    if (!isDnp && participant.vehicle_id) {
      try {
        await updateVehicleOdometer(supabase, participant.vehicle_id);
      } catch (odometerError) {
        console.warn('Error al actualizar odómetro:', odometerError);
      }
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

    const access = await requireViewCompetition(supabase, req.user.id, competitionId);
    if (!access.ok) return access.respond(res);

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
      lane, 
      driver, 
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      setup_snapshot,
      circuit,
      circuit_id,
      did_not_participate,
    } = req.body;

    const isDnp = Boolean(did_not_participate);

    const access = await requireManageCompetition(supabase, req.user.id, competitionId);
    if (!access.ok) return access.respond(res);

    // Verificar que el tiempo existe y pertenece a esta competición
    const { data: existingTiming, error: timingError } = await supabase
      .from('competition_timings')
      .select('id, participant_id, lane, total_time_timestamp, best_lap_timestamp, circuit_id')
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

    // Obtener scale_factor del vehículo
    let scaleFactor = DEFAULT_SCALE_FACTOR;
    if (participant.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('scale_factor')
        .eq('id', participant.vehicle_id)
        .single();
      if (vehicle?.scale_factor) scaleFactor = vehicle.scale_factor;
    }

    // Validaciones de tiempo (saltadas para NP)
    let derivedAverage = null;
    if (!isDnp) {
      if (!best_lap_time || !total_time || laps === undefined || laps === null || laps === '') {
        return res.status(400).json({ error: 'Mejor vuelta, tiempo total y vueltas son requeridos' });
      }

      derivedAverage = deriveCompetitionAverageFromTotalAndLaps(total_time, laps);
      if (!derivedAverage) {
        return res.status(400).json({
          error: 'Tiempo total debe ser mm:ss.mmm y el número de vueltas un entero mayor que 0',
        });
      }
    }

    // Actualizar el tiempo
    const updateData = isDnp
      ? {
          did_not_participate: true,
          best_lap_time: '00:00.000',
          total_time: '00:00.000',
          laps: 0,
          average_time: '00:00.000',
          average_time_timestamp: null,
          best_lap_timestamp: null,
          total_time_timestamp: null,
          penalty_seconds: 0,
          track_length_meters: null,
          total_distance_meters: null,
          avg_speed_kmh: null,
          avg_speed_scale_kmh: null,
          best_lap_speed_kmh: null,
          best_lap_speed_scale_kmh: null,
        }
      : {
          did_not_participate: false,
          best_lap_time,
          total_time,
          laps,
          average_time: derivedAverage.average_time,
          average_time_timestamp: derivedAverage.average_time_timestamp,
        };

    // Campos opcionales y cálculos de circuito/distancia (saltados cuando es NP)
    if (isDnp) {
      if (timing_date) updateData.timing_date = timing_date;
      updateData.lane = null;
      updateData.driver = null;
      updateData.setup_snapshot = null;
      updateData.circuit_id = null;
      updateData.circuit = null;
    } else {
      if (lane !== undefined) updateData.lane = lane;
      if (driver !== undefined) updateData.driver = driver;
      if (timing_date) updateData.timing_date = timing_date;
      if (best_lap_timestamp !== undefined) updateData.best_lap_timestamp = best_lap_timestamp;
      if (total_time_timestamp !== undefined) updateData.total_time_timestamp = total_time_timestamp;
      if (setup_snapshot !== undefined) updateData.setup_snapshot = setup_snapshot;
      let circuitLaneLengths = [];
      if (circuit_id !== undefined) {
        if (circuit_id) {
          const { data: circuit, error: circuitError } = await supabase
            .from('circuits')
            .select('name, lane_lengths')
            .eq('id', circuit_id)
            .eq('user_id', req.user.id)
            .single();
          if (!circuitError && circuit) {
            updateData.circuit_id = circuit_id;
            updateData.circuit = circuit.name;
            circuitLaneLengths = Array.isArray(circuit.lane_lengths) ? circuit.lane_lengths : [];
          }
        } else {
          updateData.circuit_id = null;
          updateData.circuit = null;
        }
      } else if (circuit !== undefined) {
        updateData.circuit = circuit;
      } else if (existingTiming.circuit_id) {
        const { data: circuit } = await supabase
          .from('circuits')
          .select('lane_lengths')
          .eq('id', existingTiming.circuit_id)
          .single();
        if (circuit) {
          circuitLaneLengths = Array.isArray(circuit.lane_lengths) ? circuit.lane_lengths : [];
        }
      }

      const effectiveLane = lane !== undefined ? lane : existingTiming.lane;
      const effectiveTotalTime = total_time_timestamp ?? existingTiming.total_time_timestamp;
      const effectiveBestLap = best_lap_timestamp ?? existingTiming.best_lap_timestamp;
      const distanceSpeed = calculateDistanceAndSpeed({
        laps,
        lane: effectiveLane,
        circuitLaneLengths,
        totalTimeSeconds: effectiveTotalTime,
        bestLapSeconds: effectiveBestLap,
        scaleFactor,
      });
      if (distanceSpeed) {
        Object.assign(updateData, distanceSpeed);
      } else {
        updateData.track_length_meters = null;
        updateData.total_distance_meters = null;
        updateData.avg_speed_kmh = null;
        updateData.avg_speed_scale_kmh = null;
        updateData.best_lap_speed_kmh = null;
        updateData.best_lap_speed_scale_kmh = null;
      }
    }

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

    // Actualizar odómetro del vehículo si el participante tiene uno (no aplica a NP)
    if (!isDnp && participant.vehicle_id) {
      try {
        await updateVehicleOdometer(supabase, participant.vehicle_id);
      } catch (odometerError) {
        console.warn('Error al actualizar odómetro:', odometerError);
      }
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

    const access = await requireManageCompetition(supabase, req.user.id, competitionId);
    if (!access.ok) return access.respond(res);

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

// Exportar datos de competición en CSV
router.get('/:id/export/csv', async (req, res) => {
  try {
    const { id: competitionId } = req.params;

    const access = await requireViewCompetition(supabase, req.user.id, competitionId, '*');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

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

    const access = await requireViewCompetition(supabase, req.user.id, competitionId, '*');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

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

    const access = await requireManageCompetition(supabase, req.user.id, id);
    if (!access.ok) return access.respond(res);

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

    const access = await requireViewCompetition(supabase, req.user.id, id);
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

    const access = await requireManageCompetition(supabase, req.user.id, id);
    if (!access.ok) return access.respond(res);

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

    const access = await requireManageCompetition(supabase, req.user.id, id);
    if (!access.ok) return access.respond(res);

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

    const access = await requireViewCompetition(supabase, req.user.id, id);
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
    const { rule_type, description, points_structure } = req.body;

    const access = await requireManageCompetition(supabase, req.user.id, id);
    if (!access.ok) return access.respond(res);

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

    const access = await requireManageCompetition(supabase, req.user.id, id);
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

      const access = await requireViewCompetition(supabase, req.user.id, id, 'id, num_slots, organizer, club_id');
      if (!access.ok) return access.respond(res);
      const competition = access.competition;

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

      const { count: signupsCount, error: countError } = await supabase
        .from('competition_signups')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', id);
      if (countError) {
        console.error('signups count', countError);
        return res.status(500).json({ error: countError.message });
      }
      if ((signupsCount ?? 0) >= competition.num_slots) {
        return res.status(400).json({ error: 'No hay plazas disponibles en esta competición' });
      }

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

      const { data: signup, error: signupError } = await supabase
        .from('competition_signups')
        .insert([
          {
            competition_id: id,
            name: displayName,
            email,
            vehicle: vehicleText,
            vehicle_id: vehicleIdValue,
            category_id: categoryId,
          },
        ])
        .select(`*, competition_categories(name), vehicles(id, model, manufacturer, type)`)
        .single();

      if (signupError) {
        console.error('signup insert', signupError);
        return res.status(500).json({ error: signupError.message });
      }

      res.status(201).json({
        message: 'Inscripción enviada correctamente',
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

    const access = await requireManageCompetition(supabase, req.user.id, id);
    if (!access.ok) return access.respond(res);

    const { data, error } = await supabase
      .from('competition_signups')
      .select(`
        *,
        competition_categories(name),
        vehicles(id, model, manufacturer, type)
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

    const access = await requireManageCompetition(supabase, req.user.id, id, 'id, num_slots, organizer, club_id');
    if (!access.ok) return access.respond(res);
    const competition = access.competition;

    const { data: signup, error: signupError } = await supabase
      .from('competition_signups')
      .select('*')
      .eq('id', signupId)
      .eq('competition_id', id)
      .single();

    if (signupError || !signup) {
      return res.status(404).json({ error: 'Inscripción no encontrada' });
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

    const access = await requireManageCompetition(supabase, req.user.id, id);
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