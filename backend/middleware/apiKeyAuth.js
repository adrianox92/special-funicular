const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'No se proporcionó API key. Usa el header X-API-Key.' });
  }

  try {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('user_id')
      .eq('api_key', apiKey.trim())
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'API key inválida o expirada' });
    }

    req.user = { id: data.user_id };
    next();
  } catch (error) {
    console.error('Error en middleware de API key:', error);
    return res.status(401).json({ error: 'Error de autenticación' });
  }
};

module.exports = apiKeyAuth;
