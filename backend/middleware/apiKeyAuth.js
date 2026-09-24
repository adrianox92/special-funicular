const { getServiceClient } = require('../lib/supabaseClients');
const { hashApiKey } = require('../lib/apiKeyHash');
const { findClubApiKeyByHash } = require('../lib/clubApiKeys');

function touchLastUsed(supabase, table, id) {
  if (!supabase || !id || typeof supabase.from !== 'function') return;
  try {
    const query = supabase.from(table);
    if (typeof query.update !== 'function') return;
    Promise.resolve(query.update({ last_used_at: new Date().toISOString() }).eq('id', id)).catch(
      () => {},
    );
  } catch {
    // best-effort
  }
}

const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'No se proporcionó API key. Usa el header X-API-Key.' });
  }

  const supabaseAdmin = getServiceClient();
  if (!supabaseAdmin) {
    console.error('apiKeyAuth: SUPABASE_SERVICE_ROLE_KEY no configurada');
    return res.status(503).json({ error: 'Error de configuración del servidor' });
  }

  try {
    const apiKeyHash = hashApiKey(apiKey);
    const { data, error } = await supabaseAdmin
      .from('user_api_keys')
      .select('id, user_id, revoked_at')
      .eq('api_key_hash', apiKeyHash)
      .maybeSingle();

    if (!error && data && !data.revoked_at) {
      req.user = { id: data.user_id };
      req.apiKeyContext = { type: 'user', keyId: data.id, userId: data.user_id };
      touchLastUsed(supabaseAdmin, 'user_api_keys', data.id);
      return next();
    }

    const clubLookup = await findClubApiKeyByHash(supabaseAdmin, apiKeyHash);
    if (!clubLookup.error && clubLookup.row) {
      const clubId = clubLookup.row.club_id;
      const { data: club } = await supabaseAdmin
        .from('clubs')
        .select('owner_user_id')
        .eq('id', clubId)
        .maybeSingle();
      const ownerId = club?.owner_user_id || clubLookup.row.created_by || null;
      if (!ownerId) {
        return res.status(401).json({ error: 'API key inválida o expirada' });
      }

      req.user = { id: ownerId };
      req.apiKeyContext = {
        type: 'club',
        keyId: clubLookup.row.id,
        clubId,
        createdBy: clubLookup.row.created_by || null,
        userId: ownerId,
      };
      touchLastUsed(supabaseAdmin, 'club_api_keys', clubLookup.row.id);
      return next();
    }

    return res.status(401).json({ error: 'API key inválida o expirada' });
  } catch (err) {
    console.error('Error en middleware de API key:', err);
    return res.status(401).json({ error: 'Error de autenticación' });
  }
};

module.exports = apiKeyAuth;
