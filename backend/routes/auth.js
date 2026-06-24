const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const { hashApiKey } = require('../lib/apiKeyHash');
const { encryptApiKey, decryptApiKey } = require('../lib/apiKeyEncrypt');
const { removeAllObjectsInVehicleFolder } = require('../lib/vehicleImageStorage');
const authMiddleware = require('../middleware/auth');

const isProd = process.env.NODE_ENV === 'production';

function serverConfigErrorResponse(res, status, logError, devDetail) {
  if (logError) console.error(logError);
  const message = isProd ? 'Error de configuración del servidor' : devDetail;
  return res.status(status).json({ error: message });
}

function getSupabase() {
  return getAnonClient();
}

function getSupabaseAdmin() {
  const c = getServiceClient();
  if (!c) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  }
  return c;
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
 * Public endpoint: authenticate with email/password and return API key.
 * Never regenerates an existing key; creates one only on first login.
 * Rows with hash-only (pre-migration) are migrated once on login.
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
      .select('api_key_hash, api_key_enc, created_at')
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

    if (existing?.api_key_enc) {
      try {
        const plain = decryptApiKey(existing.api_key_enc);
        return res.json({
          api_key: plain,
          created_at: existing.created_at,
          regenerated: false,
          source: 'existing',
        });
      } catch (decryptErr) {
        console.error('Error al descifrar api_key_enc:', decryptErr);
        return serverConfigErrorResponse(
          res,
          500,
          decryptErr,
          'Error al descifrar la API key almacenada',
        );
      }
    }

    if (existing && !existing.api_key_enc) {
      const apiKey = generateApiKey();
      const apiKeyHash = hashApiKey(apiKey);
      let apiKeyEnc;
      try {
        apiKeyEnc = encryptApiKey(apiKey);
      } catch (encErr) {
        return serverConfigErrorResponse(
          res,
          503,
          encErr,
          encErr.message || 'API_KEY_ENCRYPT_SECRET no configurada correctamente',
        );
      }

      const { data: updated, error: updateError } = await getSupabaseAdmin()
        .from('user_api_keys')
        .update({ api_key_hash: apiKeyHash, api_key_enc: apiKeyEnc })
        .eq('user_id', userId)
        .select('created_at')
        .single();

      if (updateError) {
        if (updateError.code === '42P01') {
          return serverConfigErrorResponse(
            res,
            503,
            updateError,
            'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
          );
        }
        return serverConfigErrorResponse(
          res,
          500,
          updateError,
          `Error al migrar la API key: ${updateError.message}`,
        );
      }

      return res.json({
        api_key: apiKey,
        created_at: updated?.created_at ?? existing.created_at,
        regenerated: true,
        source: 'migrated',
      });
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    let apiKeyEnc;
    try {
      apiKeyEnc = encryptApiKey(apiKey);
    } catch (encErr) {
      return serverConfigErrorResponse(
        res,
        503,
        encErr,
        encErr.message || 'API_KEY_ENCRYPT_SECRET no configurada correctamente',
      );
    }

    const { data: inserted, error: insertError } = await getSupabaseAdmin()
      .from('user_api_keys')
      .insert([{ user_id: userId, api_key_hash: apiKeyHash, api_key_enc: apiKeyEnc }])
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
      regenerated: false,
      source: 'created',
    });
  } catch (error) {
    console.error('Error en POST /api/auth/api-key:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/auth/account/delete
 * Baja definitiva: valida contraseña, limpia imágenes en Storage y elimina el usuario en Auth (CASCADE en BD).
 * Usa 403 si la contraseña no coincide (evita que el cliente interprete 401 como token JWT inválido y reintente refresh).
 */
async function deleteAccountHandler(req, res) {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      return res.status(400).json({ error: 'Se requiere la contraseña' });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return serverConfigErrorResponse(
        res,
        503,
        null,
        'SUPABASE_SERVICE_ROLE_KEY no está definida',
      );
    }

    const admin = getSupabaseAdmin();
    const { data: fullUser, error: guErr } = await admin.auth.admin.getUserById(req.user.id);
    if (guErr || !fullUser?.user) {
      return res.status(401).json({ error: 'No se pudo verificar la cuenta' });
    }

    const identities = fullUser.user.identities || [];
    const hasEmailProvider = identities.some((i) => i.provider === 'email');
    if (!hasEmailProvider) {
      return res.status(422).json({
        error:
          'Esta cuenta usa solo inicio de sesión social (por ejemplo Google). La eliminación con contraseña no está disponible. Contacta con soporte si necesitas borrar la cuenta.',
      });
    }

    const email = fullUser.user.email || req.user.email;
    if (!email) {
      return res.status(400).json({ error: 'La cuenta no tiene email asociado' });
    }

    const { error: signErr } = await getSupabase().auth.signInWithPassword({ email, password });
    if (signErr) {
      return res.status(403).json({ error: 'Contraseña incorrecta' });
    }

    const { data: vehicles, error: vErr } = await admin.from('vehicles').select('id').eq('user_id', req.user.id);
    if (vErr) {
      console.error(vErr);
      return res.status(500).json({ error: isProd ? 'Error al borrar la cuenta' : vErr.message });
    }

    for (const row of vehicles || []) {
      try {
        await removeAllObjectsInVehicleFolder(admin, row.id);
      } catch (storageErr) {
        console.error('Storage cleanup:', storageErr);
        return res.status(500).json({
          error: isProd ? 'Error al borrar archivos' : String(storageErr.message || storageErr),
        });
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(req.user.id);
    if (delErr) {
      console.error(delErr);
      return res.status(500).json({ error: isProd ? 'Error al borrar la cuenta' : delErr.message });
    }

    return res.status(204).send();
  } catch (e) {
    console.error('POST /api/auth/account/delete:', e);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

router.post('/account/delete', authMiddleware, deleteAccountHandler);

module.exports = router;
