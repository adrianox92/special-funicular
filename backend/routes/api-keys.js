const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
// Service role key bypasses RLS so the server can read/write user_api_keys by user_id from JWT
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);

router.use(authMiddleware);

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/api-keys/me
 * Returns the user's API key. Creates one automatically if it doesn't exist.
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;

    let { data: existing, error: fetchError } = await supabase
      .from('user_api_keys')
      .select('api_key, created_at')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error al obtener API key:', fetchError);
      if (fetchError.code === '42P01') {
        return res.status(503).json({
          error: 'La tabla user_api_keys no existe. Ejecuta la migración: en Supabase SQL Editor ejecuta el contenido de backend/scripts/add-api-keys.sql'
        });
      }
      return res.status(500).json({ error: 'Error al obtener la API key' });
    }

    if (!existing) {
      const apiKey = generateApiKey();
      const { data: inserted, error: insertError } = await supabase
        .from('user_api_keys')
        .insert([{ user_id: userId, api_key: apiKey }])
        .select('api_key, created_at')
        .single();

      if (insertError) {
        console.error('Error al crear API key:', insertError);
        if (insertError.code === '42P01') {
          return res.status(503).json({
            error: 'La tabla user_api_keys no existe. Ejecuta la migración: en Supabase SQL Editor ejecuta el contenido de backend/scripts/add-api-keys.sql'
          });
        }
        return res.status(500).json({ error: 'Error al crear la API key' });
      }

      return res.json({
        api_key: inserted.api_key,
        created_at: inserted.created_at,
      });
    }

    res.json({
      api_key: existing.api_key,
      created_at: existing.created_at,
    });
  } catch (error) {
    console.error('Error en GET /api/api-keys/me:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/api-keys/regenerate
 * Deletes the current API key and creates a new one.
 */
router.post('/regenerate', async (req, res) => {
  try {
    const userId = req.user.id;

    const { error: deleteError } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error al eliminar API key anterior:', deleteError);
      if (deleteError.code === '42P01') {
        return res.status(503).json({
          error: 'La tabla user_api_keys no existe. Ejecuta la migración: en Supabase SQL Editor ejecuta el contenido de backend/scripts/add-api-keys.sql'
        });
      }
      return res.status(500).json({ error: 'Error al regenerar la API key' });
    }

    const apiKey = generateApiKey();
    const { data: inserted, error: insertError } = await supabase
      .from('user_api_keys')
      .insert([{ user_id: userId, api_key: apiKey }])
      .select('api_key, created_at')
      .single();

    if (insertError) {
      console.error('Error al crear nueva API key:', insertError);
      if (insertError.code === '42P01') {
        return res.status(503).json({
          error: 'La tabla user_api_keys no existe. Ejecuta la migración: en Supabase SQL Editor ejecuta el contenido de backend/scripts/add-api-keys.sql'
        });
      }
      return res.status(500).json({ error: 'Error al regenerar la API key' });
    }

    res.json({
      api_key: inserted.api_key,
      created_at: inserted.created_at,
      message: 'API key regenerada correctamente',
    });
  } catch (error) {
    console.error('Error en POST /api/api-keys/regenerate:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
