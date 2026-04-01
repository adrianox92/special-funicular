const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.use(authMiddleware);

/**
 * Escapa % y _ para usar en filtros ilike.
 * @param {string} s
 */
function escapeIlikePattern(s) {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Búsqueda global (vehículos, competiciones, circuitos, inventario)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resultados agrupados
 */
router.get('/', async (req, res) => {
  try {
    const raw = String(req.query.q ?? '').trim();
    if (raw.length < 2) {
      return res.json({ vehicles: [], competitions: [], circuits: [], inventory: [] });
    }

    const pattern = `%${escapeIlikePattern(raw)}%`;
    const userId = req.user.id;

    const [byModel, byManufacturer, competitionsRes, circuitsRes, invByName, invByRef] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, model, manufacturer')
        .eq('user_id', userId)
        .ilike('model', pattern)
        .limit(10),
      supabase
        .from('vehicles')
        .select('id, model, manufacturer')
        .eq('user_id', userId)
        .ilike('manufacturer', pattern)
        .limit(10),
      supabase
        .from('competitions')
        .select('id, name')
        .eq('organizer', userId)
        .ilike('name', pattern)
        .limit(5),
      supabase
        .from('circuits')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', pattern)
        .limit(5),
      supabase
        .from('inventory_items')
        .select('id, name, reference, category')
        .eq('user_id', userId)
        .ilike('name', pattern)
        .limit(10),
      supabase
        .from('inventory_items')
        .select('id, name, reference, category')
        .eq('user_id', userId)
        .ilike('reference', pattern)
        .limit(10),
    ]);

    const vehicleMap = new Map();
    for (const row of [...(byModel.data || []), ...(byManufacturer.data || [])]) {
      if (row?.id && !vehicleMap.has(row.id)) vehicleMap.set(row.id, row);
    }
    const vehicles = Array.from(vehicleMap.values()).slice(0, 10);

    const invMap = new Map();
    for (const row of [...(invByName.data || []), ...(invByRef.data || [])]) {
      if (row?.id && !invMap.has(row.id)) invMap.set(row.id, row);
    }
    const inventory = Array.from(invMap.values()).slice(0, 10);

    if (byModel.error) console.error('GET /search vehicles model:', byModel.error);
    if (byManufacturer.error) console.error('GET /search vehicles manufacturer:', byManufacturer.error);
    if (competitionsRes.error) console.error('GET /search competitions:', competitionsRes.error);
    if (circuitsRes.error) console.error('GET /search circuits:', circuitsRes.error);
    if (invByName.error) console.error('GET /search inventory name:', invByName.error);
    if (invByRef.error) console.error('GET /search inventory reference:', invByRef.error);

    res.json({
      vehicles,
      competitions: competitionsRes.data || [],
      circuits: circuitsRes.data || [],
      inventory,
    });
  } catch (err) {
    console.error('GET /search:', err);
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

module.exports = router;
