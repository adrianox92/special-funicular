const express = require('express');
const { param } = require('express-validator');
const { getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const {
  MAX_USER_API_KEYS,
  isMissingTable,
  listUserApiKeys,
  getDefaultUserApiKey,
  createUserApiKey,
  rotateDefaultUserApiKey,
  revokeUserApiKey,
  publicKeyListItem,
} = require('../lib/userApiKeys');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';

function serverConfigError(res, status, logErr, devDetail) {
  if (logErr) console.error(logErr);
  const message = isProd ? 'Error de configuración del servidor' : devDetail;
  return res.status(status).json({ error: message });
}

function getSupabase() {
  const c = getServiceClient();
  if (!c) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  return c;
}

function handleKeyError(res, error, fallbackMessage) {
  if (!error) return res.status(500).json({ error: fallbackMessage });
  if (isMissingTable(error)) {
    return serverConfigError(
      res,
      503,
      error,
      'La tabla user_api_keys no existe. Ejecuta la migración SQL en Supabase.',
    );
  }
  if (error.status === 503) {
    return serverConfigError(res, 503, error.cause, error.message);
  }
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  return serverConfigError(res, 500, error, error.message || fallbackMessage);
}

router.use(authMiddleware);

/**
 * GET /api/api-keys
 * List personal keys (prefix only). Additive; does not replace /me.
 */
router.get('/', async (req, res) => {
  try {
    const { error, keys } = await listUserApiKeys(getSupabase(), req.user.id);
    if (error) return handleKeyError(res, error, 'Error al listar las API keys');
    res.json({
      keys: keys.map(publicKeyListItem),
      max_keys: MAX_USER_API_KEYS,
    });
  } catch (error) {
    console.error('Error en GET /api/api-keys:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/api-keys/me
 * Backward compatible: default (oldest active) key metadata.
 * Plaintext only when a key is created in this request.
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { error: fetchError, key: existing, active } = await getDefaultUserApiKey(
      getSupabase(),
      userId,
    );

    if (fetchError && fetchError.code !== 'PGRST116') {
      return handleKeyError(res, fetchError, `Error al obtener la API key: ${fetchError.message}`);
    }

    if (!existing) {
      const created = await createUserApiKey(getSupabase(), userId, { name: 'default' });
      if (created.error) {
        return handleKeyError(res, created.error, 'Error al crear la API key');
      }
      return res.json({
        api_key: created.api_key,
        key_exists: false,
        created_at: created.row.created_at,
        keys_count: 1,
      });
    }

    return res.json({
      api_key: null,
      key_exists: true,
      created_at: existing.created_at,
      keys_count: active.length,
      message:
        'La clave solo se muestra al crearla o al regenerarla. Usa «Regenerar» si necesitas una nueva.',
    });
  } catch (error) {
    console.error('Error en GET /api/api-keys/me:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/api-keys
 * Create an additional personal key. Body: { name? }
 */
router.post('/', async (req, res) => {
  try {
    const created = await createUserApiKey(getSupabase(), req.user.id, {
      name: req.body?.name,
    });
    if (created.error) {
      return handleKeyError(res, created.error, 'Error al crear la API key');
    }
    res.status(201).json({
      api_key: created.api_key,
      id: created.row.id,
      name: created.row.name,
      key_prefix: created.row.key_prefix,
      created_at: created.row.created_at,
    });
  } catch (error) {
    console.error('Error en POST /api/api-keys:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/api-keys/regenerate
 * Rotates the default (oldest active) key only. Extra keys stay valid.
 */
router.post('/regenerate', async (req, res) => {
  try {
    const rotated = await rotateDefaultUserApiKey(getSupabase(), req.user.id);
    if (rotated.error) {
      return handleKeyError(res, rotated.error, 'Error al regenerar la API key');
    }
    res.json({
      api_key: rotated.api_key,
      created_at: rotated.row.created_at,
      message: 'API key regenerada correctamente',
    });
  } catch (error) {
    console.error('Error en POST /api/api-keys/regenerate:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/api-keys/:id
 * Revoke one key. At least one active key must remain.
 */
router.delete('/:id', param('id').isUUID(), handleValidationErrors, async (req, res) => {
  try {
    const revoked = await revokeUserApiKey(getSupabase(), req.user.id, req.params.id);
    if (revoked.error) {
      return handleKeyError(res, revoked.error, 'Error al revocar la API key');
    }
    res.json({ ok: true, id: revoked.row.id, revoked_at: revoked.row.revoked_at });
  } catch (error) {
    console.error('Error en DELETE /api/api-keys/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
