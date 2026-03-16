const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { generateVehicleSpecsPDF } = require('../src/utils/pdfGenerator');
const { updatePositionsAfterNewTiming } = require('../lib/positionTracker');
const { calculateDistanceAndSpeed, updateVehicleOdometer, DEFAULT_SCALE_FACTOR } = require('../lib/distanceCalculator');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configuración de multer para guardar imágenes localmente (puedes adaptar a S3/Supabase Storage si lo necesitas)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: multer.memoryStorage() });

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

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
// Endpoint para exportar todos los vehículos
router.get('/export', async (req, res) => {
  try {
    // Obtener todos los vehículos sin paginación
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', req.user.id)
      .order('purchase_date', { ascending: false });

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
      .order('purchase_date', { ascending: false })
      .range(from, to);

    if (vehiclesError) throw vehiclesError;

    // Obtener los IDs de los vehículos para buscar sus imágenes
    const vehicleIds = vehicles.map(v => v.id);

    // Traer las imágenes solo para los vehículos de la página actual
    const { data: images, error: imageError } = await supabase
      .from('vehicle_images')
      .select('vehicle_id, image_url')
      .in('vehicle_id', vehicleIds);

    if (imageError) throw imageError;

    // Asociar la primera imagen por vehicle_id
    const imagesMap = new Map();
    for (const img of images) {
      if (!imagesMap.has(img.vehicle_id)) {
        imagesMap.set(img.vehicle_id, img.image_url);
      }
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
router.put('/:id', upload.array('images'), async (req, res) => {
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
      ...req.body,
      modified: req.body.modified === 'true',
      digital: req.body.digital === 'true'
    };
    if (req.body.scale_factor != null) {
      const sf = parseInt(req.body.scale_factor, 10);
      updateData.scale_factor = !isNaN(sf) ? sf : DEFAULT_SCALE_FACTOR;
    }

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

    // Subir nuevas imágenes si las hay
    if (req.files && req.files.length > 0) {
      const validViewTypes = [
        'front', 'left', 'right', 'rear', 'top', 'chassis', 'three_quarters'
      ];
      for (const file of req.files) {
        let view_type = file.originalname;
        if (!validViewTypes.includes(view_type)) {
          // Si viene un texto libre, puedes ignorar o mapear aquí si lo deseas
          continue; // o haz un mapeo si lo necesitas
        }
        const ext = path.extname(file.originalname) || '.jpg';
        const filePath = `vehicles/${id}/${Date.now()}-${view_type}${ext}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from('vehicle-images')
          .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
        if (storageError) return res.status(500).json({ error: storageError.message });
        const { data: publicUrlData } = supabase.storage.from('vehicle-images').getPublicUrl(filePath);
        const imageUrl = publicUrlData.publicUrl;
        // Eliminar imagen anterior de ese tipo (opcional, si quieres solo una por tipo)
        await supabase.from('vehicle_images').delete().eq('vehicle_id', id).eq('view_type', view_type);
        // Insertar la nueva
        const { error: imgError } = await supabase
          .from('vehicle_images')
          .insert([{ vehicle_id: id, image_url: imageUrl, view_type }]);
        if (imgError) return res.status(500).json({ error: imgError.message });
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear un vehículo
router.post('/', upload.array('images'), async (req, res) => {
  try {
    const { model, manufacturer, type, traction, price, purchase_date, purchase_place, modified, digital, reference, scale_factor } = req.body;
    
    // Si no está modificado, el total_price será igual al price
    const total_price = modified === 'true' ? null : Number(price);
    const scaleFactor = scale_factor != null ? parseInt(scale_factor, 10) : DEFAULT_SCALE_FACTOR;
    
    // Añadir user_id al crear el vehículo
    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        { 
          model, 
          manufacturer, 
          type, 
          traction, 
          price, 
          total_price,
          purchase_date,
          purchase_place, 
          modified, 
          digital,
          reference,
          scale_factor: !isNaN(scaleFactor) ? scaleFactor : DEFAULT_SCALE_FACTOR,
          user_id: req.user.id 
        }
      ])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Subir imágenes a Supabase Storage y registrar en vehicle_images
    if (req.files && req.files.length > 0) {
      const validViewTypes = [
        'front', 'left', 'right', 'rear', 'top', 'chassis', 'three_quarters'
      ];
      for (const file of req.files) {
        let view_type = file.originalname;
        if (!validViewTypes.includes(view_type)) {
          // Si viene un texto libre, puedes ignorar o mapear aquí si lo deseas
          continue; // o haz un mapeo si lo necesitas
        }
        const ext = path.extname(file.originalname) || '.jpg';
        const filePath = `vehicles/${data.id}/${Date.now()}-${view_type}${ext}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from('vehicle-images')
          .upload(filePath, file.buffer, { contentType: file.mimetype });
        if (storageError) return res.status(500).json({ error: storageError.message });
        // Obtener la URL pública
        const { data: publicUrlData } = supabase.storage.from('vehicle-images').getPublicUrl(filePath);
        const imageUrl = publicUrlData.publicUrl;
        // Guardar en la tabla vehicle_images
        const { error: imgError } = await supabase
          .from('vehicle_images')
          .insert([{ vehicle_id: data.id, image_url: imageUrl, view_type }]);
        if (imgError) return res.status(500).json({ error: imgError.message });
      }
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

    // Si encontramos la imagen, intentamos eliminarla del storage
    if (imageData && imageData.image_url) {
      const imageUrl = imageData.image_url;
      const storagePath = imageUrl.split('/vehicle-images/')[1];

      // Eliminar del storage de Supabase
      const { error: storageError } = await supabase.storage
        .from('vehicle-images')
        .remove([storagePath]);

      if (storageError) {
        console.error('Error al eliminar del storage:', storageError);
        // Continuamos aunque falle el storage
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

  // Primero eliminamos las imágenes asociadas
  const { error: imagesError } = await supabase
    .from('vehicle_images')
    .delete()
    .eq('vehicle_id', id);
    
  if (imagesError) {
    return res.status(500).json({ error: 'Error al eliminar las imágenes del vehículo' });
  }

  // Luego eliminamos el vehículo
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);

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
    // Asociar componentes a cada especificación
    const specsWithComponents = specs.map(spec => ({
      ...spec,
      components: components.filter(c => c.tech_spec_id === spec.id)
    }));
    res.json(specsWithComponents);
  } catch (err) {
    console.error('Error al obtener especificaciones técnicas:', err);
    res.status(500).json({ error: err.message });
  }
});

// Función auxiliar para recalcular el total_price de un vehículo
async function updateVehicleTotalPrice(vehicleId) {
  // Obtener el vehículo y sus datos
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('price, modified')
    .eq('id', vehicleId)
    .single();
  if (vehicleError) return;

  // Si el vehículo no está modificado, el total_price será igual al price
  if (!vehicle.modified) {
    await supabase
      .from('vehicles')
      .update({ total_price: Number(vehicle.price) })
      .eq('id', vehicleId);
    return;
  }

  const basePrice = vehicle && vehicle.price ? Number(vehicle.price) : 0;

  // Obtener todas las especificaciones técnicas de modificación
  const { data: modSpecs, error: modSpecsError } = await supabase
    .from('technical_specs')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('is_modification', true);
  if (modSpecsError) return;

  const modSpecIds = modSpecs.map(s => s.id);
  let modsTotal = 0;

  if (modSpecIds.length > 0) {
    // Obtener todos los componentes de esas modificaciones
    const { data: comps, error: compsError } = await supabase
      .from('components')
      .select('price')
      .in('tech_spec_id', modSpecIds);
    if (compsError) return;
    // Sumar los precios (ignorando nulls)
    modsTotal = comps.reduce((sum, c) => sum + (c.price ? Number(c.price) : 0), 0);
  }

  // Actualizar el vehículo con la suma del basePrice + modsTotal
  await supabase
    .from('vehicles')
    .update({ total_price: basePrice + modsTotal })
    .eq('id', vehicleId);
}

// Función auxiliar para obtener o crear las especificaciones técnicas base
async function getOrCreateBaseSpecs(vehicleId) {
  // Buscar las especificaciones existentes
  const { data: existingSpecs, error: fetchError } = await supabase
    .from('technical_specs')
    .select('*')
    .eq('vehicle_id', vehicleId);

  if (fetchError) throw fetchError;

  let specs = {
    modification: existingSpecs?.find(s => s.is_modification),
    technical: existingSpecs?.find(s => !s.is_modification)
  };

  // Crear las que no existan
  if (!specs.modification) {
    const { data: newModSpec, error: modError } = await supabase
      .from('technical_specs')
      .insert([{
        vehicle_id: vehicleId,
        is_modification: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (modError) throw modError;
    specs.modification = newModSpec;
  }

  if (!specs.technical) {
    const { data: newTechSpec, error: techError } = await supabase
      .from('technical_specs')
      .insert([{
        vehicle_id: vehicleId,
        is_modification: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (techError) throw techError;
    specs.technical = newTechSpec;
  }

  return specs;
}

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

    // Actualizar el componente específico
    const componentToUpdate = components[0];
    const { error: updateError } = await supabase
      .from('components')
      .update({
        ...componentToUpdate,
        updated_at: new Date().toISOString()
      })
      .eq('id', componentId);
    
    if (updateError) {
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

    res.json({ ...existingSpec, components: [updatedComponent] });
  } catch (err) {
    console.error('Error al actualizar componente:', err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un componente específico de una especificación técnica
router.delete('/:id/technical-specs/:specId/components/:componentId', async (req, res) => {
  try {
    const { id, specId, componentId } = req.params;
    
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

    res.json(timings);
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
      circuit_id
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
        console.log(`🔄 Actualizando posiciones para el circuito: ${circuitToStore}`);
        const positionUpdate = await updatePositionsAfterNewTiming(circuitToStore, timing.id);
        
        if (positionUpdate.success) {
          console.log(`✅ Posiciones actualizadas para el circuito: ${circuitToStore}`);
          // Enriquecer la respuesta con información de posiciones
          const enrichedTiming = {
            ...timing,
            position_updated: true,
            circuit_ranking: positionUpdate.ranking.find(r => r.vehicle_id === id)
          };
          res.status(201).json(enrichedTiming);
        } else {
          console.warn(`⚠️  No se pudieron actualizar las posiciones para el circuito: ${circuitToStore}`);
          res.status(201).json(timing);
        }
      } catch (positionError) {
        console.error(`❌ Error al actualizar posiciones para el circuito ${circuitToStore}:`, positionError);
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
      circuit_id
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

    console.log(`🔄 Actualizando tiempo ${timingId}:`, {
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
      console.log(`🔄 Recalculando posiciones debido a cambios en el tiempo...`);
      
      // Si cambió de circuito, actualizar ambos circuitos
      const circuitsToUpdate = new Set();
      if (previousCircuit) circuitsToUpdate.add(previousCircuit);
      if (newCircuit) circuitsToUpdate.add(newCircuit);

      let positionUpdates = [];
      
      for (const circuitToUpdate of circuitsToUpdate) {
        try {
          console.log(`🔄 Actualizando posiciones para el circuito: ${circuitToUpdate}`);
          const positionUpdate = await updatePositionsAfterNewTiming(circuitToUpdate, timingId);
          
          if (positionUpdate.success) {
            console.log(`✅ Posiciones actualizadas para el circuito: ${circuitToUpdate}`);
            positionUpdates.push({
              circuit: circuitToUpdate,
              success: true,
              ranking: positionUpdate.ranking
            });
          } else {
            console.warn(`⚠️ No se pudieron actualizar las posiciones para el circuito: ${circuitToUpdate}`);
            positionUpdates.push({
              circuit: circuitToUpdate,
              success: false,
              error: positionUpdate.error
            });
          }
        } catch (positionError) {
          console.error(`❌ Error al actualizar posiciones para el circuito ${circuitToUpdate}:`, positionError);
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
      console.log(`ℹ️ No se requiere recálculo de posiciones para el tiempo ${timingId}`);
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
        console.log(`🔄 Recalculando posiciones después de eliminar tiempo en circuito: ${deletedCircuit}`);
        const positionUpdate = await updatePositionsAfterNewTiming(deletedCircuit, null);
        
        if (positionUpdate.success) {
          console.log(`✅ Posiciones recalculadas para el circuito: ${deletedCircuit}`);
          res.json({ 
            message: 'Registro de tiempo eliminado correctamente',
            position_updated: true,
            circuit: deletedCircuit
          });
        } else {
          console.warn(`⚠️ No se pudieron recalcular las posiciones para el circuito: ${deletedCircuit}`);
          res.json({ message: 'Registro de tiempo eliminado correctamente' });
        }
      } catch (positionError) {
        console.error(`❌ Error al recalcular posiciones para el circuito ${deletedCircuit}:`, positionError);
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
    // Obtener imagen principal (preferiblemente tipo 'front', si no la primera disponible)
    let imageUrl = null;
    const { data: images, error: imagesError } = await supabase
      .from('vehicle_images')
      .select('image_url, view_type')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: true });
    if (!imagesError && images && images.length > 0) {
      const frontImg = images.find(img => img.view_type === 'front');
      imageUrl = frontImg ? frontImg.image_url : images[0].image_url;
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
  