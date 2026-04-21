const { getServiceClient } = require('../lib/supabaseClients');
const { hashApiKey } = require('../lib/apiKeyHash');

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
      .select('user_id')
      .eq('api_key_hash', apiKeyHash)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'API key inválida o expirada' });
    }

    req.user = { id: data.user_id };
    next();
  } catch (err) {
    console.error('Error en middleware de API key:', err);
    return res.status(401).json({ error: 'Error de autenticación' });
  }
};

module.exports = apiKeyAuth;
