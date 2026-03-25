const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const { hashApiKey } = require('../lib/apiKeyHash');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';

function serverConfigError(res, status, logErr, devDetail) {
  if (logErr) console.error(logErr);
  const message = isProd ? 'Error de configuración del servidor' : devDetail;
  return res.status(status).json({ error: message });
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

router.use(authMiddleware);

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/api-keys/me
 * Returns the user's API key when recién creada en esta sesión no aplica; si solo hay hash, no se expone el texto.
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;

    let { data: existing, error: fetchError } = await supabase
      .from('user_api_keys')
      .select('api_key_hash, created_at')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      if (fetchError.code === '42P01') {
        return serverConfigError(
          res,
          503,
          fetchError,
          'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
        );
      }
      return serverConfigError(
        res,
        500,
        fetchError,
        `Error al obtener la API key: ${fetchError.message}`,
      );
    }

    if (!existing) {
      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);
      const { data: inserted, error: insertError } = await supabase
        .from('user_api_keys')
        .insert([{ user_id: userId, api_key_hash: apiKeyHash }])
        .select('created_at')
        .single();

      if (insertError) {
        if (insertError.code === '42P01') {
          return serverConfigError(
            res,
            503,
            insertError,
            'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
          );
        }
        return serverConfigError(
          res,
          500,
          insertError,
          `Error al crear la API key: ${insertError.message}`,
        );
      }

      return res.json({
        api_key: apiKey,
        key_exists: false,
        created_at: inserted.created_at,
      });
    }

    return res.json({
      api_key: null,
      key_exists: true,
      created_at: existing.created_at,
      message:
        'La clave solo se muestra al crearla o al regenerarla. Usa «Regenerar» si necesitas una nueva.',
    });
  } catch (error) {
    console.error('Error en GET /api/api-keys/me:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/api-keys/regenerate
 */
router.post('/regenerate', async (req, res) => {
  try {
    const userId = req.user.id;

    const { error: deleteError } = await supabase.from('user_api_keys').delete().eq('user_id', userId);

    if (deleteError) {
      if (deleteError.code === '42P01') {
        return serverConfigError(
          res,
          503,
          deleteError,
          'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
        );
      }
      return res.status(500).json({ error: 'Error al regenerar la API key' });
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const { data: inserted, error: insertError } = await supabase
      .from('user_api_keys')
      .insert([{ user_id: userId, api_key_hash: apiKeyHash }])
      .select('created_at')
      .single();

    if (insertError) {
      if (insertError.code === '42P01') {
        return serverConfigError(
          res,
          503,
          insertError,
          'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
        );
      }
      return res.status(500).json({ error: 'Error al regenerar la API key' });
    }

    res.json({
      api_key: apiKey,
      created_at: inserted.created_at,
      message: 'API key regenerada correctamente',
    });
  } catch (error) {
    console.error('Error en POST /api/api-keys/regenerate:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
