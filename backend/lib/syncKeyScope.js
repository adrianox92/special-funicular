'use strict';

const PERSONAL_GARAGE_PATHS = new Set(['/vehicles', '/circuits', '/timings']);

function clubScopeClubId(req) {
  if (req?.apiKeyContext?.type === 'club' && req.apiKeyContext.clubId) {
    return req.apiKeyContext.clubId;
  }
  return null;
}

function isPersonalGaragePath(reqPath) {
  const path = String(reqPath || '').split('?')[0];
  return PERSONAL_GARAGE_PATHS.has(path);
}

function clubIdFromSyncPath(reqPath) {
  const path = String(reqPath || '').split('?')[0];
  const match = path.match(/^\/clubs\/([^/]+)/);
  if (!match) return null;
  if (match[1] === 'admin') return null;
  return match[1];
}

/**
 * Club/station keys may only touch that club's roster + competitions.
 * Personal-garage routes stay 403 (additive: personal keys unchanged).
 */
function enforceClubKeyScope(req, res, next) {
  const scopedClubId = clubScopeClubId(req);
  if (!scopedClubId) return next();

  if (isPersonalGaragePath(req.path)) {
    return res.status(403).json({
      error: 'Esta API key de club no puede acceder al garaje personal',
    });
  }

  const pathClubId = clubIdFromSyncPath(req.path);
  if (pathClubId && pathClubId !== scopedClubId) {
    return res.status(403).json({ error: 'Sin permiso' });
  }

  return next();
}

module.exports = {
  PERSONAL_GARAGE_PATHS,
  clubScopeClubId,
  isPersonalGaragePath,
  clubIdFromSyncPath,
  enforceClubKeyScope,
};
