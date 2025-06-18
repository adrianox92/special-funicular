const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @swagger
 * /api/timings:
 *   get:
 *     summary: Obtiene todos los tiempos de todos los vehículos del usuario
 *     tags:
 *       - Tiempos
 *     parameters:
 *       - in: query
 *         name: circuit
 *         schema:
 *           type: string
 *         description: Filtrar por nombre de circuito
 *     responses:
 *       200:
 *         description: Lista de tiempos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
// Obtener todos los tiempos de todos los vehículos del usuario
router.get('/', async (req, res) => {
  try {
    const { circuit } = req.query;
    // Primero obtenemos todos los vehículos del usuario
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, model, manufacturer')
      .eq('user_id', req.user.id);

    if (vehiclesError) {
      return res.status(500).json({ error: 'Error al obtener los vehículos' });
    }

    if (!vehicles || vehicles.length === 0) {
      return res.json([]);
    }

    // Obtenemos los IDs de los vehículos
    const vehicleIds = vehicles.map(v => v.id);

    // Creamos un mapa de vehículos para acceso rápido
    const vehiclesMap = vehicles.reduce((acc, vehicle) => {
      acc[vehicle.id] = vehicle;
      return acc;
    }, {});

    // Obtenemos todos los tiempos de los vehículos del usuario
    let timingsQuery = supabase
      .from('vehicle_timings')
      .select('*')
      .in('vehicle_id', vehicleIds)
      .order('timing_date', { ascending: false });
    if (circuit) {
      timingsQuery = timingsQuery.ilike('circuit', `%${circuit}%`);
    }
    const { data: timings, error: timingsError } = await timingsQuery;

    if (timingsError) {
      return res.status(500).json({ error: 'Error al obtener los tiempos' });
    }

    // Enriquecer los tiempos con la información del vehículo
    let enrichedTimings = timings.map(timing => ({
      ...timing,
      vehicle_model: vehiclesMap[timing.vehicle_id]?.model,
      vehicle_manufacturer: vehiclesMap[timing.vehicle_id]?.manufacturer
    }));

    // Calcular diferencias
    // Ordenar por best_lap_time ascendente (mejor primero)
    enrichedTimings = enrichedTimings.sort((a, b) => {
      // Convertir a segundos para comparar
      const parseTime = (t) => {
        if (!t) return Infinity;
        const match = t.match(/^([0-9]{2}):([0-9]{2})\.([0-9]{3})$/);
        if (!match) return Infinity;
        const [, min, sec, ms] = match.map(Number);
        return min * 60 + sec + ms / 1000;
      };
      return parseTime(a.best_lap_time) - parseTime(b.best_lap_time);
    });
    let bestTime = null;
    let prevTime = null;
    enrichedTimings = enrichedTimings.map((timing, idx) => {
      const parseTime = (t) => {
        if (!t) return null;
        const match = t.match(/^([0-9]{2}):([0-9]{2})\.([0-9]{3})$/);
        if (!match) return null;
        const [, min, sec, ms] = match.map(Number);
        return min * 60 + sec + ms / 1000;
      };
      const thisTime = parseTime(timing.best_lap_time);
      if (idx === 0) {
        bestTime = thisTime;
        prevTime = thisTime;
        return {
          ...timing,
          time_diff: '—'
        };
      } else {
        const diffBest = (thisTime - bestTime).toFixed(3).padStart(6, '0');
        const diffPrev = (thisTime - prevTime).toFixed(3).padStart(6, '0');
        prevTime = thisTime;
        return {
          ...timing,
          time_diff: `${diffBest} (${diffPrev})`
        };
      }
    });

    res.json(enrichedTimings);
  } catch (err) {
    console.error('Error al obtener tiempos:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 