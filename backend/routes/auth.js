const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { hashApiKey } = require('../lib/apiKeyHash');

const isProd = process.env.NODE_ENV === 'production';

function serverConfigErrorResponse(res, status, logError, devDetail) {
  if (logError) console.error(logError);
  const message = isProd ? 'Error de configuración del servidor' : devDetail;
  return res.status(status).json({ error: message });
}

let _supabase = null;
let _supabaseAdmin = null;

function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  return _supabase;
}

function getSupabaseAdmin() {
  if (!_supabaseAdmin)
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  return _supabaseAdmin;
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicia sesión y obtiene un token JWT (solo para pruebas en Swagger)
 *     tags:
 *       - Autenticación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token JWT y datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 user:
 *                   type: object
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ error: error.message });
  }
  res.json({
    access_token: data.session.access_token,
    user: data.user,
  });
});

/**
 * POST /api/auth/api-key
 * Public endpoint: authenticate with email/password and return API key
 * (creates one if not exists). CORS permisivo for external apps.
 */
router.post('/api-key', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Se requieren email y password' });
    }

    const { data: authData, error: authError } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      return res.status(401).json({ error: authError.message });
    }

    const userId = authData.user.id;

    let { data: existing, error: fetchError } = await getSupabaseAdmin()
      .from('user_api_keys')
      .select('api_key_hash, created_at')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      if (fetchError.code === '42P01') {
        return serverConfigErrorResponse(
          res,
          503,
          fetchError,
          'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
        );
      }
      return serverConfigErrorResponse(
        res,
        500,
        fetchError,
        `Error al obtener la API key: ${fetchError.message}`,
      );
    }

    if (!existing) {
      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);
      const { data: inserted, error: insertError } = await getSupabaseAdmin()
      .from('user_api_keys')
        .insert([{ user_id: userId, api_key_hash: apiKeyHash }])
        .select('created_at')
        .single();

      if (insertError) {
        if (insertError.code === '42P01') {
          return serverConfigErrorResponse(
            res,
            503,
            insertError,
            'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
          );
        }
        return serverConfigErrorResponse(
          res,
          500,
          insertError,
          `Error al crear la API key: ${insertError.message}`,
        );
      }

      return res.json({
        api_key: apiKey,
        created_at: inserted.created_at,
      });
    }

    return res.json({
      api_key: null,
      key_exists: true,
      created_at: existing.created_at,
      message:
        'Ya existe una API key. El texto completo no se puede recuperar. Regenera la clave desde Perfil en la web si la necesitas de nuevo.',
    });
  } catch (error) {
    console.error('Error en POST /api/auth/api-key:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
