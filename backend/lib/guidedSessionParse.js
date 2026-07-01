/**
 * Parsea y valida guided_session desde body de sync (objeto o campos sueltos).
 * @param {Record<string, unknown>} body
 * @returns {{ ok: true, guidedSession: object|null } | { ok: false, error: string }}
 */
function parseGuidedSessionFromBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: true, guidedSession: null };
  }

  const rawObj = body.guided_session ?? body.guidedSession;
  const hasFlat =
    body.baseline_lap_seconds != null ||
    body.baselineLapSeconds != null ||
    body.target_improvement_ms != null ||
    body.targetImprovementMs != null ||
    body.laps_on_target != null ||
    body.lapsOnTarget != null ||
    body.best_improvement_ms != null ||
    body.bestImprovementMs != null ||
    body.guided === true ||
    body.guided === 'true';

  if (rawObj == null && !hasFlat) {
    return { ok: true, guidedSession: null };
  }

  const src =
    rawObj != null && typeof rawObj === 'object' && !Array.isArray(rawObj)
      ? rawObj
      : body;

  const baseline = numField(src, 'baseline_lap_seconds', 'baselineLapSeconds');
  const targetMs = numField(src, 'target_improvement_ms', 'targetImprovementMs');
  const lapsOnTarget = intField(src, 'laps_on_target', 'lapsOnTarget');
  const totalLaps = intField(src, 'total_laps', 'totalLaps');
  const bestImprovementMs = numField(src, 'best_improvement_ms', 'bestImprovementMs');

  if (baseline == null || !Number.isFinite(baseline) || baseline <= 0 || baseline > 600) {
    return { ok: false, error: 'guided_session.baseline_lap_seconds debe ser un número entre 0 y 600' };
  }
  if (targetMs == null || !Number.isFinite(targetMs) || targetMs < 0 || targetMs > 60000) {
    return { ok: false, error: 'guided_session.target_improvement_ms debe ser un entero entre 0 y 60000' };
  }
  if (lapsOnTarget == null || !Number.isInteger(lapsOnTarget) || lapsOnTarget < 0) {
    return { ok: false, error: 'guided_session.laps_on_target debe ser un entero >= 0' };
  }
  if (bestImprovementMs != null && (!Number.isFinite(bestImprovementMs) || bestImprovementMs < 0 || bestImprovementMs > 60000)) {
    return { ok: false, error: 'guided_session.best_improvement_ms debe ser un entero entre 0 y 60000' };
  }
  if (totalLaps != null && (!Number.isInteger(totalLaps) || totalLaps < 0)) {
    return { ok: false, error: 'guided_session.total_laps debe ser un entero >= 0' };
  }
  if (totalLaps != null && lapsOnTarget > totalLaps) {
    return { ok: false, error: 'guided_session.laps_on_target no puede superar total_laps' };
  }

  const guidedSession = {
    baseline_lap_seconds: baseline,
    target_improvement_ms: Math.round(targetMs),
    laps_on_target: lapsOnTarget,
    best_improvement_ms: bestImprovementMs != null ? Math.round(bestImprovementMs) : 0,
  };
  if (totalLaps != null) {
    guidedSession.total_laps = totalLaps;
  }

  return { ok: true, guidedSession };
}

function numField(obj, snake, camel) {
  const raw = obj[snake] !== undefined && obj[snake] !== null && obj[snake] !== ''
    ? obj[snake]
    : obj[camel];
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

function intField(obj, snake, camel) {
  const n = numField(obj, snake, camel);
  if (n == null) return null;
  return Math.floor(n);
}

module.exports = {
  parseGuidedSessionFromBody,
};
