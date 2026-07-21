const express = require('express');
const { getServiceOrAnonClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const supabase = getServiceOrAnonClient();

router.use(authMiddleware);

/**
 * @swagger
 * /api/onboarding/status:
 *   get:
 *     summary: Estado del checklist de onboarding (vehículo, circuito, tiempo)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Flags derivados de datos del usuario
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;

    const [vehicleResult, circuitResult, timingResult] = await Promise.all([
      supabase.from('vehicles').select('id').eq('user_id', userId).limit(1),
      supabase
        .from('circuits')
        .select('id')
        .eq('user_id', userId)
        .is('club_id', null)
        .limit(1),
      supabase
        .from('vehicle_timings')
        .select(
          `
          id,
          vehicles!inner (
            id,
            user_id
          )
        `,
        )
        .eq('vehicles.user_id', userId)
        .limit(1),
    ]);

    if (vehicleResult.error) throw vehicleResult.error;
    if (circuitResult.error) throw circuitResult.error;
    if (timingResult.error) throw timingResult.error;

    const hasVehicle = (vehicleResult.data?.length ?? 0) > 0;
    const hasCircuit = (circuitResult.data?.length ?? 0) > 0;
    const hasTiming = (timingResult.data?.length ?? 0) > 0;
    const completed = hasVehicle && hasCircuit && hasTiming;

    res.json({ hasVehicle, hasCircuit, hasTiming, completed });
  } catch (error) {
    console.error('Error en GET /onboarding/status:', error);
    res.status(500).json({ error: 'Error al obtener estado de onboarding' });
  }
});

module.exports = router;
