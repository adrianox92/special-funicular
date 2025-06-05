const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateVehicleSpecsPDF } = require('../utils/pdfGenerator');

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Obtener todos los vehículos
router.get('/', async (req, res) => {
  try {
    const vehicles = await db.all('SELECT * FROM vehicles ORDER BY purchase_date DESC');
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un vehículo específico
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un nuevo vehículo
router.post('/', async (req, res) => {
  try {
    const { model, manufacturer, type, traction, price, total_price, purchase_date, purchase_place, modified, digital } = req.body;
    const result = await db.run(
      'INSERT INTO vehicles (model, manufacturer, type, traction, price, total_price, purchase_date, purchase_place, modified, digital) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [model, manufacturer, type, traction, price, total_price, purchase_date, purchase_place, modified ? 1 : 0, digital ? 1 : 0]
    );
    res.json({ id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un vehículo
router.put('/:id', async (req, res) => {
  try {
    const { model, manufacturer, type, traction, price, total_price, purchase_date, purchase_place, modified, digital } = req.body;
    await db.run(
      'UPDATE vehicles SET model = ?, manufacturer = ?, type = ?, traction = ?, price = ?, total_price = ?, purchase_date = ?, purchase_place = ?, modified = ?, digital = ? WHERE id = ?',
      [model, manufacturer, type, traction, price, total_price, purchase_date, purchase_place, modified ? 1 : 0, digital ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Vehículo actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un vehículo
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Vehículo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir imagen de vehículo
router.post('/:id/images', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna imagen' });
    }

    const { view_type } = req.body;
    if (!view_type) {
      return res.status(400).json({ error: 'El tipo de vista es requerido' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    // Verificar si ya existe una imagen para este tipo de vista
    const existingImage = await db.get(
      'SELECT * FROM vehicle_images WHERE vehicle_id = ? AND view_type = ?',
      [req.params.id, view_type]
    );

    if (existingImage) {
      // Actualizar la imagen existente
      await db.run(
        'UPDATE vehicle_images SET image_url = ? WHERE vehicle_id = ? AND view_type = ?',
        [imageUrl, req.params.id, view_type]
      );
    } else {
      // Insertar nueva imagen
      await db.run(
        'INSERT INTO vehicle_images (vehicle_id, view_type, image_url) VALUES (?, ?, ?)',
        [req.params.id, view_type, imageUrl]
      );
    }

    // Actualizar la imagen principal del vehículo si es la primera imagen
    const vehicle = await db.get('SELECT image FROM vehicles WHERE id = ?', [req.params.id]);
    if (!vehicle.image) {
      await db.run('UPDATE vehicles SET image = ? WHERE id = ?', [imageUrl, req.params.id]);
    }

    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener imágenes de un vehículo
router.get('/:id/images', async (req, res) => {
  try {
    const images = await db.all('SELECT * FROM vehicle_images WHERE vehicle_id = ?', [req.params.id]);
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar imagen de vehículo
router.delete('/:id/images/:viewType', async (req, res) => {
  try {
    const { id, viewType } = req.params;
    
    // Obtener la URL de la imagen antes de eliminarla
    const image = await db.get(
      'SELECT image_url FROM vehicle_images WHERE vehicle_id = ? AND view_type = ?',
      [id, viewType]
    );

    if (!image) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Eliminar la imagen de la base de datos
    await db.run(
      'DELETE FROM vehicle_images WHERE vehicle_id = ? AND view_type = ?',
      [id, viewType]
    );

    // Eliminar el archivo físico
    const imagePath = path.join(__dirname, '../../', image.image_url);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Si era la imagen principal, actualizar el vehículo
    const vehicle = await db.get('SELECT image FROM vehicles WHERE id = ?', [id]);
    if (vehicle && vehicle.image === image.image_url) {
      // Buscar otra imagen para establecer como principal
      const otherImage = await db.get('SELECT image_url FROM vehicle_images WHERE vehicle_id = ? LIMIT 1', [id]);
      await db.run('UPDATE vehicles SET image = ? WHERE id = ?', [otherImage ? otherImage.image_url : null, id]);
    }

    res.json({ message: 'Imagen eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para generar y descargar la ficha técnica en PDF
router.get('/:id/specs-pdf', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    
    // Obtener datos del vehículo
    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Obtener especificaciones técnicas y modificaciones
    const specs = await db.all(`
      SELECT * FROM technical_specs 
      WHERE vehicle_id = ? 
      ORDER BY is_modification ASC, component_type ASC
    `, [vehicleId]);

    // Separar especificaciones técnicas y modificaciones
    const technicalSpecs = specs.filter(spec => !spec.is_modification);
    const modifications = specs.filter(spec => spec.is_modification);

    // Generar el PDF
    const pdfBuffer = await generateVehicleSpecsPDF(vehicle, technicalSpecs, modifications);

    // Configurar headers para la descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ficha-tecnica-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    
    // Enviar el PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar el PDF:', error);
    res.status(500).json({ error: 'Error al generar la ficha técnica' });
  }
});

module.exports = router; 