/**
 * Imágenes de vehículo (Supabase Storage): ver ../lib/processVehicleImageBuffer.js,
 * ../lib/vehicleImageStorage.js — VEHICLE_IMAGE_MAX_UPLOAD_BYTES (default 12MB),
 * VEHICLE_IMAGE_MAX_EDGE_PX, VEHICLE_IMAGE_OUTPUT_FORMAT (webp|jpeg), etc.
 */
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { removeObjectByPublicUrl, removeAllObjectsInVehicleFolder } = require('../lib/vehicleImageStorage');
const { saveVehicleImagesFromMultipart } = require('../lib/vehicleImageUpload');
const { tryCopyCatalogImageToVehicleFront } = require('../lib/copyCatalogToVehicleImage');
const { generateVehicleSpecsPDF } = require('../src/utils/pdfGenerator');
const { updatePositionsAfterNewTiming } = require('../lib/positionTracker');
const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('../lib/distanceCalculator');
const { updateVehicleTotalPrice, getOrCreateBaseSpecs } = require('../lib/vehicleSpecs');
const { insertReturnedComponentToInventory } = require('../lib/inventoryReturnFromComponent');
const { deductInventoryQuantity, restoreInventoryQuantity } = require('../lib/inventoryStockOps');
const { parseSupplyVoltageVolts } = require('../lib/pilotProfileUtils');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/** Columnas permitidas para GET /vehicles y /vehicles/export (ordenación). */
const VEHICLE_SORT_COLUMNS = {
  purchase_date: 'purchase_date',
  created_at: 'created_at',
  total_distance_meters: 'total_distance_meters',
  updated_at: 'updated_at',
};

function parseVehicleCommercialYearFromBody(body) {
  const raw = body.commercial_release_year ?? body.commercial_release_date;
  if (raw == null || raw === '') return null;
  const n = parseInt(String(raw).trim(), 10);
  if (Number.isFinite(n) && n >= 1900 && n <= 2100) return n;
  const s = String(raw).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const y = parseInt(s.slice(0, 4), 10);
    return y >= 1900 && y <= 2100 ? y : null;
  }
  return null;
}

/** inline | angular | transverse — misma semántica que slot_catalog_items.motor_position */
function parseOptionalMotorPosition(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'inline' || s === 'angular' || s === 'transverse') return s;
  if (s === 'en_linea' || s === 'en línea' || s === 'en linea' || s === 'lineal') return 'inline';
  if (s === 'en_angular' || s === 'en angular') return 'angular';
  if (s === 'transversal' || s === 'transversa' || s === 'en_transversal' || s === 'en transversal') return 'transverse';
  return null;
}

function parseVehicleSort(req) {
  const raw = String(req.query.sort || 'purchase_date').toLowerCase();
  const sortKey = Object.prototype.hasOwnProperty.call(VEHICLE_SORT_COLUMNS, raw) ? raw : 'purchase_date';
  const dirRaw = String(req.query.dir || 'desc').toLowerCase();
  const ascending = dirRaw === 'asc';
  return { column: VEHICLE_SORT_COLUMNS[sortKey], ascending };
}

/** Solo campos editables del formulario; evita enviar id, user_id, odómetro, etc. desde multipart mal parseado. */
const VEHICLE_PUT_BODY_KEYS = [
  'model',
  'manufacturer',
  'type',
  'traction',
  'motor_position',
  'price',
  'purchase_date',
  'purchase_place',
  'anotaciones',
  'reference',
  'total_price',
  'commercial_release_year',
  'catalog_item_id',
];

/** Evita cadenas "null"/"undefined" o vacíos mal interpretados por Postgres (date, numeric, etc.) */
function normalizeFormScalar(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '' || t === 'null' || t === 'undefined') return null;
    return value;
  }
  return value;
}

function vehicleScalarFieldsFromBody(body) {
  const o = {};
  for (const k of VEHICLE_PUT_BODY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
    let v = body[k];
    v = normalizeFormScalar(v);
    if (k === 'purchase_date') {
      o[k] = v;
    } else if (k === 'commercial_release_year') {
      if (v == null || v === '') o[k] = null;
      else {
        const n = parseInt(String(v).trim(), 10);
        o[k] = Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : null;
      }
    } else if (k === 'price' || k === 'total_price') {
      if (v == null) o[k] = null;
      else {
        const n = Number(v);
        o[k] = Number.isNaN(n) ? null : n;
      }
    } else if (k === 'motor_position') {
      o[k] = parseOptionalMotorPosition(v);
    } else {
      o[k] = v;
    }
  }
  return o;
}

/** Nulos al final en ASC y al principio en DESC para odómetro y última modificación. */
function orderOptsForVehicleSort(column, ascending) {
  if (column === 'total_distance_meters' || column === 'updated_at') {
    return { ascending, nullsFirst: !ascending };
  }
  return { ascending, nullsFirst: false };
}

const VEHICLE_IMAGE_MAX_UPLOAD_BYTES =
  Number(process.env.VEHICLE_IMAGE_MAX_UPLOAD_BYTES) > 0
    ? Number(process.env.VEHICLE_IMAGE_MAX_UPLOAD_BYTES)
    : 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VEHICLE_IMAGE_MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      const err = new Error('Solo se permiten archivos de imagen.');
      err.code = 'INVALID_IMAGE_TYPE';
      cb(err);
    }
  },
});

/** multipart field `images`; respuestas 413/400 para límites y tipo */
function runVehicleImageUpload(req, res, next) {
  upload.array('images')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'La imagen supera el tamaño máximo permitido.',
        });
      }
    }
    if (err.code === 'INVALID_IMAGE_TYPE') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  });
}

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

const COMPONENT_PAYLOAD_KEYS = [
  'component_type', 'element', 'manufacturer', 'material', 'size', 'teeth',
  'color', 'rpm', 'gaus', 'price', 'url', 'sku', 'description', 'mounted_qty'
];

function pickComponentFields(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const k of COMPONENT_PAYLOAD_KEYS) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

function modificationSnapshotFromRow(row) {
  const o = {};
  for (const k of COMPONENT_PAYLOAD_KEYS) {
    o[k] = row[k] ?? null;
  }
  return o;
}

function normalizeComponentValue(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(n) && String(n) === String(Number(v))) return n;
  return String(v);
}

function modificationSnapshotsDiffer(prev, next) {
  for (const k of COMPONENT_PAYLOAD_KEYS) {
    if (normalizeComponentValue(prev[k]) !== normalizeComponentValue(next[k])) return true;
  }
  return false;
}

function listChangedSnapshotKeys(prev, next) {
  return COMPONENT_PAYLOAD_KEYS.filter(
    (k) => normalizeComponentValue(prev[k]) !== normalizeComponentValue(next[k])
  );
}

function parseChangeEffectiveDate(raw) {
  if (raw == null || raw === '') {
    return new Date().toISOString().slice(0, 10);
  }
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date().toISOString().slice(0, 10);
  }
  return s;
}

/**
 * @swagger
 * /api/vehicles/export:
 *   get:
 *     summary: Exporta todos los vehículos del usuario
 *     tags:
 *       - Vehículos
 *     responses:
 *       200:
 *         description: Exportación de vehículos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *
 * /api/vehicles/{id}:
 *   get:
 *     summary: Obtiene un vehículo por ID
 *     tags:
 *       - Vehículos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del vehículo
 *     responses:
 *       200:
 *         description: Detalles del vehículo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *   put:
 *     summary: Actualiza un vehículo por ID y sus imágenes
 *     tags:
 *       - Vehículos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del vehículo
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Vehículo actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *
 * /api/vehicles/{id}/images:
 *   get:
 *     summary: Obtiene las imágenes de un vehículo
 *     tags:
 *       - Vehículos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del vehículo
 *     responses:
 *       200:
 *         description: Imágenes del vehículo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *
 * /api/vehicles:
 *   post:
 *     summary: Crea un nuevo vehículo
 *     tags:
 *       - Vehículos
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Vehículo creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *
 * /api/vehicles/{id}/images/{viewType}:
 *   delete:
 *     summary: Elimina una imagen específica de un vehículo
 *     tags:
 *       - Vehículos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del vehículo
 *       - in: path
 *         name: viewType
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo de vista de la imagen
 *     responses:
 *       200:
 *         description: Imagen eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
// Endpoint para exportar vehículos (opcionalmente filtrados)
router.get('/export', async (req, res) => {
  try {
    const { manufacturer, type, modified, digital, filterMuseo, filterTaller } = req.query;
    const { column: sortColumn, ascending } = parseVehicleSort(req);
    const orderOpts = orderOptsForVehicleSort(sortColumn, ascending);

    let query = supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', req.user.id)
      .order(sortColumn, orderOpts);

    if (manufacturer && String(manufacturer).trim()) {
      query = query.ilike('manufacturer', `%${String(manufacturer).trim()}%`);
    }
    if (type && String(type).trim()) {
      query = query.eq('type', String(type).trim());
    }
    if (modified === 'Sí' || modified === 'true') {
      query = query.eq('modified', true);
    } else if (modified === 'No' || modified === 'false') {
      query = query.eq('modified', false);
    }
    if (digital === 'Digital' || digital === 'true') {
      query = query.eq('digital', true);
    } else if (digital === 'Analógico' || digital === 'false') {
      query = query.eq('digital', false);
    }
    const museoFilter = filterMuseo === 'true' || filterMuseo === true;
    const tallerFilter = filterTaller === 'true' || filterTaller === true;
    if (museoFilter && tallerFilter) {
      query = query.or('museo.eq.true,taller.eq.true');
    } else if (museoFilter) {
      query = query.eq('museo', true);
    } else if (tallerFilter) {
      query = query.eq('taller', true);
    }

    const { data: vehicles, error: vehiclesError } = await query;

    if (vehiclesError) throw vehiclesError;

    res.json({ vehicles });
  } catch (error) {
    console.error('Error en /vehicles/export:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Obtiene la lista de vehículos del usuario autenticado
 *     tags:
 *       - Vehículos
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número de página para la paginación
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Cantidad de resultados por página
 *     responses:
 *       200:
 *         description: Lista de vehículos y paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       model:
 *                         type: string
 *                       manufacturer:
 *                         type: string
 *                       image:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *             examples:
 *               ejemplo:
 *                 value:
 *                   vehicles:
 *                     - id: "1"
 *                       model: "Audi R8"
 *                       manufacturer: "Audi"
 *                       image: "https://.../audi.jpg"
 *                   pagination:
 *                     total: 1
 *                     page: 1
 *                     limit: 25
 *                     totalPages: 1
 */
// Obtener todos los vehículos (con paginación)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { column: sortColumn, ascending } = parseVehicleSort(req);
    const orderOpts = orderOptsForVehicleSort(sortColumn, ascending);

    // Obtener el total de vehículos para la paginación
    const { count, error: countError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (countError) throw countError;
    
    // Obtener los vehículos paginados
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', req.user.id)
      .order(sortColumn, orderOpts)
      .range(from, to);

    if (vehiclesError) throw vehiclesError;

    // Obtener los IDs de los vehículos para buscar sus imágenes
    const vehicleIds = vehicles.map(v => v.id);

    // Traer las imágenes solo para los vehículos de la página actual
    const { data: images, error: imageError } = await supabase
      .from('vehicle_images')
      .select('vehicle_id, image_url, view_type')
      .in('vehicle_id', vehicleIds);

    if (imageError) throw imageError;

    // Agrupar imágenes por vehicle_id y seleccionar con prioridad:
    // three_quarters > left/right > primera disponible
    const imagesByVehicle = new Map();
    for (const img of images) {
      if (!imagesByVehicle.has(img.vehicle_id)) {
        imagesByVehicle.set(img.vehicle_id, []);
      }
      imagesByVehicle.get(img.vehicle_id).push(img);
    }

    const imagesMap = new Map();
    for (const [vehicleId, imgs] of imagesByVehicle) {
      const threeQuarters = imgs.find(i => i.view_type === 'three_quarters');
      if (threeQuarters) {
        imagesMap.set(vehicleId, threeQuarters.image_url);
        continue;
      }
      const lateral = imgs.find(i => i.view_type === 'left' || i.view_type === 'right');
      if (lateral) {
        imagesMap.set(vehicleId, lateral.image_url);
        continue;
      }
      imagesMap.set(vehicleId, imgs[0].image_url);
    }

    const result = vehicles.map(v => ({
      ...v,
      image: imagesMap.get(v.id) || null
    }));

    res.json({
      vehicles: result,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error en /vehicles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener un vehículo por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Vehículo no encontrado' });
  
  res.json(data);
});

// Obtener imágenes de un vehículo
router.get('/:id/images', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('vehicle_images')
    .select('image_url, view_type')
    .eq('vehicle_id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Actualizar un vehículo por ID y sus imágenes
router.put('/:id', runVehicleImageUpload, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el vehículo pertenece al usuario
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id, modified')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const updateData = {
      ...vehicleScalarFieldsFromBody(req.body),
      modified: req.body.modified === 'true',
      digital: req.body.digital === 'true',
      museo: req.body.museo === 'true',
      taller: req.body.taller === 'true',
    };
    if (req.body.scale_factor != null) {
      const sf = parseInt(req.body.scale_factor, 10);
      updateData.scale_factor = !isNaN(sf) ? sf : DEFAULT_SCALE_FACTOR;
    }

    delete updateData.created_at;
    delete updateData.updated_at;
    delete updateData.last_timing_created_at;
    updateData.updated_at = new Date().toISOString();

    // Si no está modificado, el total_price será igual al price
    if (updateData.modified === false) {
      updateData.total_price = Number(updateData.price);
    }

    // Actualizar datos del vehículo
    const { data, error } = await supabase
      .from('vehicles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    if (req.files && req.files.length > 0) {
      try {
        await saveVehicleImagesFromMultipart(supabase, id, req.files, { replacePerView: true });
      } catch (e) {
        if (e.code === 'INVALID_IMAGE') {
          return res.status(400).json({ error: e.message || 'No se pudo procesar la imagen' });
        }
        console.error('saveVehicleImagesFromMultipart (PUT)', e);
        return res.status(500).json({ error: e.message || 'Error al subir imágenes' });
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear un vehículo
router.post('/', runVehicleImageUpload, async (req, res) => {
  try {
    const {
      model,
      manufacturer,
      type,
      traction,
      motor_position,
      price,
      purchase_date,
      purchase_place,
      modified,
      digital,
      museo,
      taller,
      anotaciones,
      reference,
      scale_factor,
      commercial_release_year,
      commercial_release_date,
      catalog_item_id,
    } = req.body;

    // Campos numéricos: convertir vacío a null para evitar "invalid input syntax for type numeric"
    const priceNum = (price === '' || price == null) ? null : Number(price);
    const total_price = modified === 'true' ? null : (priceNum != null ? priceNum : null);
    const scaleFactor = (scale_factor === '' || scale_factor == null) ? DEFAULT_SCALE_FACTOR : parseInt(scale_factor, 10);

    const commercial_release_year_val = parseVehicleCommercialYearFromBody({
      commercial_release_year,
      commercial_release_date,
    });
    const catalog_item_id_val =
      catalog_item_id === '' || catalog_item_id == null ? null : String(catalog_item_id).trim();

    let catalogRow = null;
    if (catalog_item_id_val) {
      const { data: cr } = await supabase
        .from('slot_catalog_items_with_ratings')
        .select('*')
        .eq('id', catalog_item_id_val)
        .maybeSingle();
      catalogRow = cr;
    }

    const traction_val =
      traction != null && String(traction).trim() !== ''
        ? String(traction).trim()
        : catalogRow?.traction != null && String(catalogRow.traction).trim() !== ''
          ? String(catalogRow.traction).trim()
          : null;
    const motor_position_val =
      motor_position != null && String(motor_position).trim() !== ''
        ? parseOptionalMotorPosition(motor_position)
        : parseOptionalMotorPosition(catalogRow?.motor_position);

    // Añadir user_id al crear el vehículo
    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          model,
          manufacturer,
          type,
          traction: traction_val,
          motor_position: motor_position_val,
          price: priceNum,
          total_price,
          purchase_date: purchase_date || null,
          purchase_place: purchase_place || null,
          modified,
          digital,
          museo,
          taller,
          anotaciones,
          reference,
          scale_factor: !isNaN(scaleFactor) ? scaleFactor : DEFAULT_SCALE_FACTOR,
          commercial_release_year: commercial_release_year_val,
          catalog_item_id: catalog_item_id_val,
          user_id: req.user.id,
        },
      ])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    if (req.files && req.files.length > 0) {
      try {
        await saveVehicleImagesFromMultipart(supabase, data.id, req.files, { replacePerView: false });
      } catch (e) {
        if (e.code === 'INVALID_IMAGE') {
          return res.status(400).json({ error: e.message || 'No se pudo procesar la imagen' });
        }
        console.error('saveVehicleImagesFromMultipart (POST)', e);
        return res.status(500).json({ error: e.message || 'Error al subir imágenes' });
      }
    }

    try {
      await tryCopyCatalogImageToVehicleFront(supabase, data.id, catalogRow, req.files);
    } catch (e) {
      console.warn('[vehicles POST] tryCopyCatalogImageToVehicleFront', e.message);
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar una imagen específica de un vehículo
router.delete('/:id/images/:viewType', async (req, res) => {
  try {
    const { id, viewType } = req.params;
    
    // Primero obtener la información de la imagen para poder eliminarla del storage
    const { data: imageData, error: fetchError } = await supabase
      .from('vehicle_images')
      .select('image_url')
      .eq('vehicle_id', id)
      .eq('view_type', viewType)
      .single();

    if (imageData && imageData.image_url) {
      const { error: storageError } = await removeObjectByPublicUrl(supabase, imageData.image_url);
      if (storageError) {
        console.error('Error al eliminar del storage:', storageError);
      }
    }

    // Intentar eliminar el registro de la base de datos
    const { error: deleteError } = await supabase
      .from('vehicle_images')
      .delete()
      .eq('vehicle_id', id)
      .eq('view_type', viewType);

    // Si hay error al eliminar de la BD, lo reportamos
    if (deleteError) {
      console.error('Error al eliminar de la base de datos:', deleteError);
      return res.status(500).json({ error: deleteError.message });
    }

    // Devolvemos éxito independientemente de si la imagen existía o no
    res.json({ message: 'Operación completada' });
  } catch (err) {
    console.error('Error al eliminar imagen:', err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un vehículo por ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: existingVehicle, error: checkError } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', id)
    .eq('user_id', req.user.id)
    .single();

  if (checkError || !existingVehicle) {
    return res.status(404).json({ error: 'Vehículo no encontrado' });
  }

  try {
    await removeAllObjectsInVehicleFolder(supabase, id);
  } catch (storageErr) {
    console.error('removeAllObjectsInVehicleFolder', storageErr);
    return res.status(500).json({
      error: storageErr.message || 'Error al eliminar archivos del almacenamiento',
    });
  }

  const { error: imagesError } = await supabase.from('vehicle_images').delete().eq('vehicle_id', id);

  if (imagesError) {
    return res.status(500).json({ error: 'Error al eliminar las imágenes del vehículo' });
  }

  const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('user_id', req.user.id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Vehículo eliminado correctamente' });
});

// Obtener especificaciones técnicas de un vehículo (con componentes)
router.get('/:id/technical-specs', async (req, res) => {
  try {
    const { id } = req.params;
    // Verificar que el vehículo pertenece al usuario
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    // Obtener especificaciones técnicas
    const { data: specs, error: specsError } = await supabase
      .from('technical_specs')
      .select('*')
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false });
    if (specsError) {
      return res.status(500).json({ error: specsError.message });
    }
    // Obtener componentes para todas las especificaciones
    const specIds = specs.map(s => s.id);
    let components = [];
    if (specIds.length > 0) {
      const { data: comps, error: compsError } = await supabase
        .from('components')
        .select('*')
        .in('tech_spec_id', specIds);
      if (compsError) {
        return res.status(500).json({ error: compsError.message });
      }
      components = comps;
    }
    const modSpecIds = specs.filter(s => s.is_modification).map(s => s.id);
    const modComponentIds = components
      .filter(c => modSpecIds.includes(c.tech_spec_id))
      .map(c => c.id);
    let historyByComponentId = {};
    if (modComponentIds.length > 0) {
      const { data: histRows, error: histError } = await supabase
        .from('component_modification_history')
        .select('id, component_id, effective_date, previous_snapshot, created_at')
        .eq('vehicle_id', id)
        .eq('user_id', req.user.id)
        .in('component_id', modComponentIds)
        .order('effective_date', { ascending: false });
      if (!histError && histRows) {
        for (const row of histRows) {
          if (!historyByComponentId[row.component_id]) {
            historyByComponentId[row.component_id] = [];
          }
          historyByComponentId[row.component_id].push({
            id: row.id,
            effective_date: row.effective_date,
            previous_snapshot: row.previous_snapshot,
            created_at: row.created_at
          });
        }
      }
    }
    // Asociar componentes a cada especificación
    const specsWithComponents = specs.map(spec => ({
      ...spec,
      components: components
        .filter(c => c.tech_spec_id === spec.id)
        .map(c => ({
          ...c,
          change_history: spec.is_modification
            ? (historyByComponentId[c.id] || [])
            : undefined
        }))
    }));
    res.json(specsWithComponents);
  } catch (err) {
    console.error('Error al obtener especificaciones técnicas:', err);
    res.status(500).json({ error: err.message });
  }
});

// Crear un componente en una especificación técnica
router.post('/:id/technical-specs', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_modification, components } = req.body;

    // Verificar que el vehículo pertenece al usuario
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Obtener o crear las especificaciones base
    const specs = await getOrCreateBaseSpecs(id);
    const targetSpec = is_modification ? specs.modification : specs.technical;

    // Crear los componentes asociados
    let createdComponents = [];
    if (Array.isArray(components) && components.length > 0) {
      const compsToInsert = components.map(c => ({
        ...c,
        tech_spec_id: targetSpec.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      const { data: comps, error: compsError } = await supabase
        .from('components')
        .insert(compsToInsert)
        .select();
      if (compsError) {
        return res.status(500).json({ error: compsError.message });
      }
      createdComponents = comps;
    }

    if (is_modification) {
      await updateVehicleTotalPrice(id);
    }

    res.status(201).json({ ...targetSpec, components: createdComponents });
  } catch (err) {
    console.error('Error al crear componente:', err);
    res.status(500).json({ error: err.message });
  }
});

// Actualizar un componente específico en una especificación técnica
router.put('/:id/technical-specs/:specId/components/:componentId', async (req, res) => {
  try {
    const { id, specId, componentId } = req.params;
    const { is_modification, components, change_effective_date } = req.body;

    // Verificar que el vehículo pertenece al usuario
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id, user_id, model, manufacturer')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const returnRemovedToInventory = req.body.return_removed_to_inventory === true;

    // Verificar que la especificación pertenece al vehículo y es del tipo correcto
    const { data: existingSpec, error: specCheckError } = await supabase
      .from('technical_specs')
      .select('id, is_modification')
      .eq('id', specId)
      .eq('vehicle_id', id)
      .single();
    if (specCheckError || !existingSpec) {
      return res.status(404).json({ error: 'Especificación técnica no encontrada' });
    }
    if (existingSpec.is_modification !== is_modification) {
      return res.status(400).json({ error: 'Tipo de especificación incorrecto' });
    }

    // Verificar que el componente existe y pertenece a la especificación
    const { data: existingComponent, error: compCheckError } = await supabase
      .from('components')
      .select('*')
      .eq('id', componentId)
      .eq('tech_spec_id', specId)
      .single();
    if (compCheckError || !existingComponent) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    const pickedUpdate = pickComponentFields(components && components[0]);
    const prevSnap = modificationSnapshotFromRow(existingComponent);
    const nextSnap = { ...prevSnap, ...pickedUpdate };
    const shouldRecordHistory =
      is_modification === true && modificationSnapshotsDiffer(prevSnap, nextSnap);

    const changedKeys = listChangedSnapshotKeys(prevSnap, nextSnap);
    const onlyMountedQtyChanged = changedKeys.length === 1 && changedKeys[0] === 'mounted_qty';
    const oldQ = Math.max(1, parseInt(existingComponent.mounted_qty, 10) || 1);
    const newQ = Math.max(1, parseInt(nextSnap.mounted_qty, 10) || 1);

    let deductMeta = null;
    if (
      is_modification === true &&
      onlyMountedQtyChanged &&
      newQ > oldQ &&
      existingComponent.source_inventory_item_id
    ) {
      const delta = newQ - oldQ;
      const dres = await deductInventoryQuantity(supabase, {
        userId: req.user.id,
        itemId: existingComponent.source_inventory_item_id,
        qty: delta,
      });
      if (!dres.ok) {
        return res.status(409).json({ error: dres.error });
      }
      deductMeta = {
        itemId: existingComponent.source_inventory_item_id,
        qty: delta,
        quantityAfter: dres.newQuantity,
      };
    }

    let insertedHistoryId = null;
    if (shouldRecordHistory) {
      const effectiveDate = parseChangeEffectiveDate(change_effective_date);
      const { data: insertedHist, error: histInsertError } = await supabase
        .from('component_modification_history')
        .insert({
          user_id: req.user.id,
          vehicle_id: id,
          component_id: componentId,
          tech_spec_id: specId,
          effective_date: effectiveDate,
          previous_snapshot: prevSnap
        })
        .select('id')
        .single();
      if (histInsertError) {
        if (deductMeta) {
          await restoreInventoryQuantity(supabase, {
            userId: req.user.id,
            itemId: deductMeta.itemId,
            qty: deductMeta.qty,
            quantityMustBe: deductMeta.quantityAfter,
          });
        }
        return res.status(500).json({ error: histInsertError.message });
      }
      insertedHistoryId = insertedHist?.id;
    }

    const { error: updateError } = await supabase
      .from('components')
      .update({
        ...pickedUpdate,
        updated_at: new Date().toISOString()
      })
      .eq('id', componentId);

    if (updateError) {
      if (insertedHistoryId) {
        await supabase.from('component_modification_history').delete().eq('id', insertedHistoryId);
      }
      if (deductMeta) {
        await restoreInventoryQuantity(supabase, {
          userId: req.user.id,
          itemId: deductMeta.itemId,
          qty: deductMeta.qty,
          quantityMustBe: deductMeta.quantityAfter,
        });
      }
      return res.status(500).json({ error: updateError.message });
    }

    // Si es una modificación, actualizar el precio total del vehículo
    if (is_modification) {
      await updateVehicleTotalPrice(id);
    }

    // Obtener el componente actualizado
    const { data: updatedComponent, error: getUpdatedError } = await supabase
      .from('components')
      .select('*')
      .eq('id', componentId)
      .single();

    if (getUpdatedError) {
      return res.status(500).json({ error: getUpdatedError.message });
    }

    let inventoryReturnError = null;
    const skipReturnBecauseQtyIncrease = onlyMountedQtyChanged && newQ > oldQ;
    if (shouldRecordHistory && returnRemovedToInventory && !skipReturnBecauseQtyIncrease) {
      const vehicleLabel =
        [existingVehicle.manufacturer, existingVehicle.model].filter(Boolean).join(' ').trim() || null;
      let returnSnap = prevSnap;
      if (onlyMountedQtyChanged && newQ < oldQ) {
        returnSnap = { ...prevSnap, mounted_qty: oldQ - newQ };
      }
      const invResult = await insertReturnedComponentToInventory(supabase, {
        userId: req.user.id,
        snapshot: returnSnap,
        vehicleLabel,
      });
      if (!invResult.ok) {
        inventoryReturnError = invResult.error;
        console.error('insertReturnedComponentToInventory (PUT component):', invResult.error);
      }
    }

    res.json({
      ...existingSpec,
      components: [updatedComponent],
      ...(inventoryReturnError ? { inventory_return_error: inventoryReturnError } : {}),
      ...(deductMeta ? { inventory_deducted_qty: deductMeta.qty } : {}),
    });
  } catch (err) {
    console.error('Error al actualizar componente:', err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un componente específico de una especificación técnica
router.delete('/:id/technical-specs/:specId/components/:componentId', async (req, res) => {
  try {
    const { id, specId, componentId } = req.params;

    const returnToInventory =
      req.body?.return_to_inventory === true ||
      req.query.return_to_inventory === 'true' ||
      req.query.return_to_inventory === '1';

    // Verificar que el vehículo pertenece al usuario
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id, model, manufacturer')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Verificar que la especificación pertenece al vehículo
    const { data: existingSpec, error: specCheckError } = await supabase
      .from('technical_specs')
      .select('id, is_modification')
      .eq('id', specId)
      .eq('vehicle_id', id)
      .single();
    if (specCheckError || !existingSpec) {
      return res.status(404).json({ error: 'Especificación técnica no encontrada' });
    }

    // Verificar que el componente existe y pertenece a la especificación
    const { data: existingComponent, error: compCheckError } = await supabase
      .from('components')
      .select('*')
      .eq('id', componentId)
      .eq('tech_spec_id', specId)
      .single();
    if (compCheckError || !existingComponent) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }

    if (existingSpec.is_modification && returnToInventory) {
      const prevSnap = modificationSnapshotFromRow(existingComponent);
      const vehicleLabel =
        [existingVehicle.manufacturer, existingVehicle.model].filter(Boolean).join(' ').trim() || null;
      const invResult = await insertReturnedComponentToInventory(supabase, {
        userId: req.user.id,
        snapshot: prevSnap,
        vehicleLabel,
      });
      if (!invResult.ok) {
        console.error('insertReturnedComponentToInventory (DELETE component):', invResult.error);
        return res.status(500).json({
          error: `No se pudo añadir al inventario la pieza retirada: ${invResult.error}`,
        });
      }
    }

    // Eliminar solo el componente específico
    const { error: deleteError } = await supabase
      .from('components')
      .delete()
      .eq('id', componentId)
      .eq('tech_spec_id', specId);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    // Si era una modificación, actualizar el precio total
    if (existingSpec.is_modification) {
      await updateVehicleTotalPrice(id);
    }

    res.json({ message: 'Componente eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar componente:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener los tiempos de vuelta de un vehículo
router.get('/:id/timings', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el vehículo pertenece al usuario
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Obtener los tiempos ordenados por fecha descendente
    const { data: timings, error: timingsError } = await supabase
      .from('vehicle_timings')
      .select('*')
      .eq('vehicle_id', id)
      .order('timing_date', { ascending: false });

    if (timingsError) {
      return res.status(500).json({ error: timingsError.message });
    }

    // Enriquecer con has_laps (vueltas individuales en timing_laps)
    const timingIds = (timings || []).map(t => t.id).filter(Boolean);
    const timingsWithLapsSet = new Set();
    if (timingIds.length > 0) {
      const { data: lapsData } = await supabase
        .from('timing_laps')
        .select('timing_id')
        .in('timing_id', timingIds);
      (lapsData || []).forEach(l => timingsWithLapsSet.add(l.timing_id));
    }
    const enrichedTimings = (timings || []).map(t => ({
      ...t,
      has_laps: timingsWithLapsSet.has(t.id),
    }));

    res.json(enrichedTimings);
  } catch (err) {
    console.error('Error al obtener tiempos:', err);
    res.status(500).json({ error: err.message });
  }
});

// Crear un nuevo registro de tiempo
router.post('/:id/timings', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      best_lap_time, 
      total_time, 
      laps, 
      average_time, 
      lane, 
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      average_time_timestamp,
      circuit,
      circuit_id,
      supply_voltage_volts,
    } = req.body;

    // Verificar que el vehículo pertenece al usuario y obtener scale_factor
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id, scale_factor')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Obtener componentes de serie y modificaciones actuales
    const { data: specs, error: specsError } = await supabase
      .from('technical_specs')
      .select('id, is_modification')
      .eq('vehicle_id', id);
    if (specsError) {
      return res.status(500).json({ error: specsError.message });
    }
    const specIds = specs.map(s => s.id);
    let componentsSnapshot = [];
    if (specIds.length > 0) {
      const { data: comps, error: compsError } = await supabase
        .from('components')
        .select('*')
        .in('tech_spec_id', specIds);
      if (!compsError && comps) {
        componentsSnapshot = comps;
      }
    }

    // Resolver circuito: circuit_id tiene prioridad
  let circuitToStore = circuit;
    let circuitIdToStore = null;
    let circuitLaneLengths = [];
    if (circuit_id) {
      const { data: circuitRow, error: circuitError } = await supabase
        .from('circuits')
        .select('name, lane_lengths')
        .eq('id', circuit_id)
        .eq('user_id', req.user.id)
        .single();
      if (!circuitError && circuitRow) {
        circuitIdToStore = circuit_id;
        circuitToStore = circuitRow.name;
        circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
      }
    }

    // Calcular distancia y velocidad si hay circuito, carril y longitud
    const scaleFactor = req.body.scale_factor ?? existingVehicle.scale_factor ?? DEFAULT_SCALE_FACTOR;
    const distanceSpeed = calculateDistanceAndSpeed({
      laps,
      lane,
      circuitLaneLengths,
      totalTimeSeconds: total_time_timestamp,
      bestLapSeconds: best_lap_timestamp,
      scaleFactor,
    });

    const insertData = {
      vehicle_id: id,
      best_lap_time,
      total_time,
      laps,
      average_time,
      lane,
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      average_time_timestamp,
      circuit: circuitToStore,
      circuit_id: circuitIdToStore,
      setup_snapshot: JSON.stringify(componentsSnapshot),
      created_at: new Date().toISOString()
    };
    if (supply_voltage_volts !== undefined) {
      const pv = parseSupplyVoltageVolts(supply_voltage_volts);
      if (!pv.ok) {
        return res.status(400).json({ error: pv.error });
      }
      if (pv.volts != null) insertData.supply_voltage_volts = pv.volts;
    }
    if (distanceSpeed) {
      Object.assign(insertData, distanceSpeed);
    }

    // Crear el nuevo registro de tiempo con el snapshot
    const { data: timing, error: timingError } = await supabase
      .from('vehicle_timings')
      .insert([insertData])
      .select()
      .single();

    if (timingError) {
      return res.status(500).json({ error: timingError.message });
    }

    // Actualizar odómetro del vehículo
    try {
      await updateVehicleOdometer(supabase, id);
    } catch (odometerError) {
      console.warn('Error al actualizar odómetro:', odometerError);
    }

    // Actualizar posiciones del circuito si se especificó uno
    if (circuitToStore) {
      try {
        console.log(`Actualizando posiciones para el circuito: ${circuitToStore}`);
        const positionUpdate = await updatePositionsAfterNewTiming(circuitToStore, timing.id);
        
        if (positionUpdate.success) {
          console.log(`[OK] Posiciones actualizadas para el circuito: ${circuitToStore}`);
          // Enriquecer la respuesta con información de posiciones
          const enrichedTiming = {
            ...timing,
            position_updated: true,
            circuit_ranking: positionUpdate.ranking.find(r => r.vehicle_id === id)
          };
          res.status(201).json(enrichedTiming);
        } else {
          console.warn(`[WARN] No se pudieron actualizar las posiciones para el circuito: ${circuitToStore}`);
          res.status(201).json(timing);
        }
      } catch (positionError) {
        console.error(`[ERR] Error al actualizar posiciones para el circuito ${circuitToStore}:`, positionError);
        // Aún devolvemos el timing creado, pero sin información de posiciones
        res.status(201).json(timing);
      }
    } else {
      res.status(201).json(timing);
    }
  } catch (err) {
    console.error('Error al crear tiempo:', err);
    res.status(500).json({ error: err.message });
  }
});

// Actualizar un registro de tiempo
router.put('/:id/timings/:timingId', async (req, res) => {
  try {
    const { id, timingId } = req.params;
    const { 
      best_lap_time, 
      total_time, 
      laps, 
      average_time, 
      lane, 
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      average_time_timestamp,
      circuit,
      circuit_id,
      supply_voltage_volts,
    } = req.body;

    // Verificar que el vehículo pertenece al usuario y obtener scale_factor
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id, scale_factor')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    if (supply_voltage_volts !== undefined) {
      const pv = parseSupplyVoltageVolts(supply_voltage_volts);
      if (!pv.ok) {
        return res.status(400).json({ error: pv.error });
      }
    }

    // Verificar que el tiempo existe y pertenece al vehículo
    const { data: existingTiming, error: timingCheckError } = await supabase
      .from('vehicle_timings')
      .select('*')
      .eq('id', timingId)
      .eq('vehicle_id', id)
      .single();
    if (timingCheckError || !existingTiming) {
      return res.status(404).json({ error: 'Registro de tiempo no encontrado' });
    }

    // Resolver circuito: circuit_id tiene prioridad
    let circuitToStore = circuit;
    let circuitIdToStore = existingTiming.circuit_id;
    let circuitLaneLengths = [];
    if (circuit_id !== undefined) {
      if (circuit_id) {
        const { data: circuitRow, error: circuitError } = await supabase
          .from('circuits')
          .select('name, lane_lengths')
          .eq('id', circuit_id)
          .eq('user_id', req.user.id)
          .single();
        if (!circuitError && circuitRow) {
          circuitIdToStore = circuit_id;
          circuitToStore = circuitRow.name;
          circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
        }
      } else {
        circuitIdToStore = null;
        circuitToStore = null;
      }
    } else if (circuit !== undefined) {
      circuitToStore = circuit;
      circuitIdToStore = null;
    } else {
      circuitToStore = existingTiming.circuit;
      circuitIdToStore = existingTiming.circuit_id;
      if (circuitIdToStore) {
        const { data: circuitRow } = await supabase
          .from('circuits')
          .select('lane_lengths')
          .eq('id', circuitIdToStore)
          .single();
        if (circuitRow) {
          circuitLaneLengths = Array.isArray(circuitRow.lane_lengths) ? circuitRow.lane_lengths : [];
        }
      }
    }

    // Calcular distancia y velocidad
    const scaleFactor = req.body.scale_factor ?? existingVehicle.scale_factor ?? DEFAULT_SCALE_FACTOR;
    const distanceSpeed = calculateDistanceAndSpeed({
      laps,
      lane,
      circuitLaneLengths,
      totalTimeSeconds: total_time_timestamp,
      bestLapSeconds: best_lap_timestamp,
      scaleFactor,
    });

    // Detectar si hubo cambios que requieren recálculo de posiciones
    const previousCircuit = existingTiming.circuit;
    const newCircuit = circuitToStore;
    const previousBestLap = existingTiming.best_lap_time;
    const newBestLap = best_lap_time;
    const previousLane = existingTiming.lane;
    const newLane = lane;
    const previousLaps = existingTiming.laps;
    const newLaps = laps;

    // Determinar si necesitamos recalcular posiciones
    const needsPositionUpdate = (
      previousBestLap !== newBestLap ||  // Cambió el mejor tiempo de vuelta
      previousLane !== newLane ||        // Cambió el carril
      previousLaps !== newLaps ||        // Cambió el número de vueltas
      previousCircuit !== newCircuit     // Cambió el circuito
    );

    console.log(`Actualizando tiempo ${timingId}:`, {
      previousBestLap,
      newBestLap,
      previousCircuit,
      newCircuit,
      previousLane,
      newLane,
      previousLaps,
      newLaps,
      needsPositionUpdate
    });

    // Actualizar el registro
    const updatePayload = {
      best_lap_time,
      total_time,
      laps,
      average_time,
      lane,
      timing_date,
      best_lap_timestamp,
      total_time_timestamp,
      average_time_timestamp,
      circuit: circuitToStore,
      circuit_id: circuitIdToStore
    };
    if (supply_voltage_volts !== undefined) {
      const pv = parseSupplyVoltageVolts(supply_voltage_volts);
      updatePayload.supply_voltage_volts = pv.volts;
    }
    if (distanceSpeed) {
      Object.assign(updatePayload, distanceSpeed);
    } else {
      // Limpiar campos si no se puede calcular
      updatePayload.track_length_meters = null;
      updatePayload.total_distance_meters = null;
      updatePayload.avg_speed_kmh = null;
      updatePayload.avg_speed_scale_kmh = null;
      updatePayload.best_lap_speed_kmh = null;
      updatePayload.best_lap_speed_scale_kmh = null;
    }
    const { data: updatedTiming, error: updateError } = await supabase
      .from('vehicle_timings')
      .update(updatePayload)
      .eq('id', timingId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Actualizar odómetro del vehículo
    try {
      await updateVehicleOdometer(supabase, id);
    } catch (odometerError) {
      console.warn('Error al actualizar odómetro:', odometerError);
    }

    // Recalcular posiciones si es necesario
    if (needsPositionUpdate) {
      console.log(`Recalculando posiciones debido a cambios en el tiempo...`);
      
      // Si cambió de circuito, actualizar ambos circuitos
      const circuitsToUpdate = new Set();
      if (previousCircuit) circuitsToUpdate.add(previousCircuit);
      if (newCircuit) circuitsToUpdate.add(newCircuit);

      let positionUpdates = [];
      
      for (const circuitToUpdate of circuitsToUpdate) {
        try {
          console.log(`Actualizando posiciones para el circuito: ${circuitToUpdate}`);
          const positionUpdate = await updatePositionsAfterNewTiming(circuitToUpdate, timingId);
          
          if (positionUpdate.success) {
            console.log(`[OK] Posiciones actualizadas para el circuito: ${circuitToUpdate}`);
            positionUpdates.push({
              circuit: circuitToUpdate,
              success: true,
              ranking: positionUpdate.ranking
            });
          } else {
            console.warn(`[WARN] No se pudieron actualizar las posiciones para el circuito: ${circuitToUpdate}`);
            positionUpdates.push({
              circuit: circuitToUpdate,
              success: false,
              error: positionUpdate.error
            });
          }
        } catch (positionError) {
          console.error(`[ERR] Error al actualizar posiciones para el circuito ${circuitToUpdate}:`, positionError);
          positionUpdates.push({
            circuit: circuitToUpdate,
            success: false,
            error: positionError.message
          });
        }
      }

      // Enriquecer la respuesta con información de posiciones
      const enrichedTiming = {
        ...updatedTiming,
        position_updated: positionUpdates.some(u => u.success),
        position_updates: positionUpdates,
        circuit_ranking: positionUpdates.find(u => u.circuit === newCircuit && u.success)?.ranking?.find(r => r.vehicle_id === id)
      };
      
      res.json(enrichedTiming);
    } else {
      console.log(`[INFO] No se requiere recálculo de posiciones para el tiempo ${timingId}`);
      res.json(updatedTiming);
    }

  } catch (err) {
    console.error('Error al actualizar tiempo:', err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un registro de tiempo
router.delete('/:id/timings/:timingId', async (req, res) => {
  try {
    const { id, timingId } = req.params;

    // Verificar que el vehículo pertenece al usuario
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    if (checkError || !existingVehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Verificar que el tiempo existe y pertenece al vehículo
    const { data: existingTiming, error: timingCheckError } = await supabase
      .from('vehicle_timings')
      .select('*')
      .eq('id', timingId)
      .eq('vehicle_id', id)
      .single();
    if (timingCheckError || !existingTiming) {
      return res.status(404).json({ error: 'Registro de tiempo no encontrado' });
    }

    // Guardar información del circuito antes de eliminar
    const deletedCircuit = existingTiming.circuit;

    // Eliminar el registro
    const { error: deleteError } = await supabase
      .from('vehicle_timings')
      .delete()
      .eq('id', timingId);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    // Actualizar odómetro del vehículo
    try {
      await updateVehicleOdometer(supabase, id);
    } catch (odometerError) {
      console.warn('Error al actualizar odómetro:', odometerError);
    }

    // Recalcular posiciones si el tiempo eliminado tenía circuito
    if (deletedCircuit) {
      try {
        console.log(`Recalculando posiciones después de eliminar tiempo en circuito: ${deletedCircuit}`);
        const positionUpdate = await updatePositionsAfterNewTiming(deletedCircuit, null);
        
        if (positionUpdate.success) {
          console.log(`[OK] Posiciones recalculadas para el circuito: ${deletedCircuit}`);
          res.json({ 
            message: 'Registro de tiempo eliminado correctamente',
            position_updated: true,
            circuit: deletedCircuit
          });
        } else {
          console.warn(`[WARN] No se pudieron recalcular las posiciones para el circuito: ${deletedCircuit}`);
          res.json({ message: 'Registro de tiempo eliminado correctamente' });
        }
      } catch (positionError) {
        console.error(`[ERR] Error al recalcular posiciones para el circuito ${deletedCircuit}:`, positionError);
        // Aún devolvemos éxito en la eliminación, pero sin actualización de posiciones
        res.json({ message: 'Registro de tiempo eliminado correctamente' });
      }
    } else {
      res.json({ message: 'Registro de tiempo eliminado correctamente' });
    }

  } catch (err) {
    console.error('Error al eliminar tiempo:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para generar y descargar la ficha técnica en PDF
router.get('/:id/specs-pdf', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    // Obtener datos del vehículo
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single();
    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    // Obtener imagen principal (misma lógica que listado: three_quarters > left/right > primera disponible)
    let imageUrl = null;
    const { data: images, error: imagesError } = await supabase
      .from('vehicle_images')
      .select('image_url, view_type')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: true });
    if (!imagesError && images && images.length > 0) {
      const threeQuarters = images.find(img => img.view_type === 'three_quarters');
      if (threeQuarters) {
        imageUrl = threeQuarters.image_url;
      } else {
        const lateral = images.find(img => img.view_type === 'left' || img.view_type === 'right');
        imageUrl = lateral ? lateral.image_url : images[0].image_url;
      }
    }
    // Obtener especificaciones técnicas y sus componentes
    const { data: specs, error: specsError } = await supabase
      .from('technical_specs')
      .select(`*, components (*)`)
      .eq('vehicle_id', vehicleId)
      .order('is_modification', { ascending: true });
    if (specsError) {
      throw specsError;
    }
    // Separar especificaciones técnicas y modificaciones
    const technicalSpecs = specs.filter(spec => !spec.is_modification);
    const modifications = specs.filter(spec => spec.is_modification);
    // Pasar la imagen al generador de PDF
    const pdfBuffer = await generateVehicleSpecsPDF({ ...vehicle, image: imageUrl }, technicalSpecs, modifications);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ficha-tecnica-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar la ficha técnica', details: error.message, stack: error.stack });
  }
});

// Endpoint para obtener las especificaciones técnicas de un vehículo
router.get('/:id/specs', async (req, res) => {
  try {
    // Primero verificamos que el vehículo pertenece al usuario
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Obtenemos las especificaciones técnicas
    const { data: specs, error: specsError } = await supabase
      .from('technical_specs')
      .select('id, is_modification')
      .eq('vehicle_id', req.params.id);

    if (specsError) throw specsError;

    // Si no hay especificaciones, devolvemos array vacío
    if (!specs || specs.length === 0) {
      return res.json([]);
    }

    // Obtenemos los componentes asociados a las especificaciones
    const specIds = specs.map(s => s.id);
    const { data: components, error: componentsError } = await supabase
      .from('components')
      .select('*')
      .in('tech_spec_id', specIds);

    if (componentsError) throw componentsError;

    // Agrupamos los componentes por si son modificaciones o no
    const result = components.map(component => {
      const spec = specs.find(s => s.id === component.tech_spec_id);
      return {
        ...component,
        is_modification: spec?.is_modification || false
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error en /vehicles/:id/specs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener las modificaciones de un vehículo
router.get('/:id/modifications', async (req, res) => {
  try {
    // Primero verificamos que el vehículo pertenece al usuario
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Obtenemos las especificaciones técnicas que son modificaciones
    const { data: specs, error: specsError } = await supabase
      .from('technical_specs')
      .select('id')
      .eq('vehicle_id', req.params.id)
      .eq('is_modification', true);

    if (specsError) throw specsError;

    // Si no hay modificaciones, devolvemos array vacío
    if (!specs || specs.length === 0) {
      return res.json([]);
    }

    // Obtenemos los componentes asociados a las modificaciones
    const specIds = specs.map(s => s.id);
    const { data: components, error: componentsError } = await supabase
      .from('components')
      .select('*')
      .in('tech_spec_id', specIds);

    if (componentsError) throw componentsError;

    res.json(components || []);
  } catch (error) {
    console.error('Error en /vehicles/:id/modifications:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
  