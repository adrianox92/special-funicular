/**
 * Clientes Supabase para Node: sin persistencia de sesión ni auto-refresh (evita timers
 * huérfanos y crecimiento de RAM en el proceso del servidor).
 */
const { createClient } = require('@supabase/supabase-js');

const SERVER_AUTH_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let _anon = null;
/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let _service = null;

/**
 * Singleton anon (SUPABASE_KEY): rutas servidor con RLS o llamadas sin JWT de usuario.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getAnonClient() {
  if (_anon) return _anon;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL y SUPABASE_KEY son obligatorias');
  }
  _anon = createClient(url, key, SERVER_AUTH_OPTIONS);
  return _anon;
}

/**
 * Singleton service role (bypass RLS). null si falta SUPABASE_SERVICE_ROLE_KEY.
 * @returns {import('@supabase/supabase-js').SupabaseClient|null}
 */
function getServiceClient() {
  if (_service) return _service;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _service = createClient(url, key, SERVER_AUTH_OPTIONS);
  return _service;
}

/**
 * Preferencia service; si no hay clave de servicio, anon (mismo patrón que notifier).
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getServiceOrAnonClient() {
  return getServiceClient() || getAnonClient();
}

/**
 * Cliente por petición con JWT del usuario en headers (RLS). Crear uno por request;
 * al terminar la petición debe quedar libre para GC (sin timers de refresh).
 * @param {string|undefined} authorizationHeaderOrBareToken - p. ej. req.headers.authorization o token sin prefijo
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createUserScopedClient(authorizationHeaderOrBareToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL y SUPABASE_KEY son obligatorias');
  }
  let token = String(authorizationHeaderOrBareToken || '').trim();
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }
  return createClient(url, key, {
    ...SERVER_AUTH_OPTIONS,
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

/**
 * Para scripts/migraciones con URL y clave explícitas (mismas opciones de servidor).
 * @param {string} url
 * @param {string} key
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createServerClient(url, key) {
  if (!url || !key) {
    throw new Error('createServerClient: url y key son obligatorias');
  }
  return createClient(url, key, SERVER_AUTH_OPTIONS);
}

module.exports = {
  getAnonClient,
  getServiceClient,
  getServiceOrAnonClient,
  createUserScopedClient,
  createServerClient,
};
