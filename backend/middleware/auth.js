const { getAnonClient } = require('../lib/supabaseClients');

const supabase = getAnonClient();

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Formato de token inválido' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(401).json({ error: 'Error de autenticación' });
  }
};

/** Autenticación opcional: adjunta req.user si hay token válido; continúa sin usuario si no. */
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = user;
    }
  } catch (error) {
    console.error('Error en middleware de autenticación opcional:', error);
  }

  next();
};

module.exports = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware; 