/**
 * Resuelve el usuario de un access token JWT sin pegarle a /auth/v1/user en cada
 * request. getClaims verifica la firma (JWKS cacheado); getUser queda como fallback
 * si getClaims no está o falla. No se acepta el JWT sin verificar.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} token
 * @returns {Promise<{ user: object|null, error: object|null, source: 'claims'|'getUser' }>}
 */
function userFromJwtClaims(claims) {
  if (!claims || typeof claims !== 'object' || !claims.sub) return null;
  const meta = claims.user_metadata && typeof claims.user_metadata === 'object' ? claims.user_metadata : {};
  const app = claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {};
  const email = claims.email || meta.email || null;
  return {
    id: claims.sub,
    email,
    role: claims.role || 'authenticated',
    aud: claims.aud,
    app_metadata: app,
    user_metadata: meta,
    created_at: claims.created_at || null,
    is_anonymous: claims.is_anonymous === true,
  };
}

async function resolveAuthUser(supabase, token) {
  if (!token) {
    return { user: null, error: { message: 'missing token' }, source: 'getUser' };
  }

  if (supabase?.auth && typeof supabase.auth.getClaims === 'function') {
    try {
      const { data, error } = await supabase.auth.getClaims(token);
      const claims = data && (data.claims || data);
      if (!error && claims) {
        const user = userFromJwtClaims(claims);
        if (user) {
          return { user, error: null, source: 'claims' };
        }
      }
    } catch {
      // firma inválida / JWKS: caer a getUser
    }
  }

  const { data, error } = await supabase.auth.getUser(token);
  return { user: data?.user || null, error: error || null, source: 'getUser' };
}

module.exports = {
  userFromJwtClaims,
  resolveAuthUser,
};
