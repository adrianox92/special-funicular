/**
 * Heurísticas Setup Intelligence v1: correlación cambios de componente ↔ tiempos.
 */

const timeToSeconds = (val) => {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})\.(\d{1,3})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3].padStart(3, '0'), 10) / 1000;
  const n = parseFloat(str.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

const formatTime = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;
};

const laneKey = (t) => `${t.circuit_id || t.circuit || ''}::${t.lane}`;

const aggregateBestByLane = (sessions) => {
  const map = {};
  sessions.forEach((t) => {
    if (t.lane == null || String(t.lane).trim() === '') return;
    const k = laneKey(t);
    const sec = t.best_lap_timestamp ?? timeToSeconds(t.best_lap_time);
    if (sec == null || Number.isNaN(sec)) return;
    if (!map[k] || sec < map[k].bestSec) {
      map[k] = {
        lane: t.lane,
        circuit: t.circuit || t.circuits?.name || '—',
        bestSec: sec,
      };
    }
  });
  return map;
};

/**
 * @param {Array<{ label: string; keyDiffs: string[]; sessions: object[] }>} configGroups — orden cronológico
 * @returns {Array<{ change: string; lane: string; circuit: string; deltaSec: number; before: string; after: string; direction: 'improved'|'worsened'|'neutral' }>}
 */
export function computeSetupChangeInsights(configGroups) {
  if (!Array.isArray(configGroups) || configGroups.length < 2) return [];
  const insights = [];

  for (let i = 1; i < configGroups.length; i++) {
    const prev = configGroups[i - 1];
    const curr = configGroups[i];
    const changeSummary = (curr.keyDiffs || []).join('; ') || curr.label;
    const prevByLane = aggregateBestByLane(prev.sessions || []);
    const currByLane = aggregateBestByLane(curr.sessions || []);

    Object.keys(currByLane).forEach((k) => {
      if (!prevByLane[k]) return;
      const delta = currByLane[k].bestSec - prevByLane[k].bestSec;
      if (Math.abs(delta) < 0.02) {
        insights.push({
          change: changeSummary,
          lane: String(currByLane[k].lane),
          circuit: currByLane[k].circuit,
          deltaSec: delta,
          before: formatTime(prevByLane[k].bestSec),
          after: formatTime(currByLane[k].bestSec),
          direction: 'neutral',
        });
        return;
      }
      insights.push({
        change: changeSummary,
        lane: String(currByLane[k].lane),
        circuit: currByLane[k].circuit,
        deltaSec: Math.abs(delta),
        before: formatTime(prevByLane[k].bestSec),
        after: formatTime(currByLane[k].bestSec),
        direction: delta < 0 ? 'improved' : 'worsened',
      });
    });
  }

  return insights.sort((a, b) => b.deltaSec - a.deltaSec).slice(0, 8);
}

/**
 * Objetivo de vuelta guiado según PB y consistencia media.
 * @param {{ best_lap_seconds?: number|null; consistency_score?: number|null; average_lap_seconds?: number|null }} baseline
 */
export function computeSuggestedTrainingTarget(baseline) {
  const pb = baseline?.best_lap_seconds;
  if (pb == null || !Number.isFinite(pb)) return null;

  const consistency = baseline?.consistency_score;
  let delta = 0.2;
  if (consistency != null && Number.isFinite(Number(consistency))) {
    const c = Number(consistency);
    if (c >= 90) delta = 0.1;
    else if (c >= 80) delta = 0.15;
    else if (c >= 65) delta = 0.2;
    else delta = 0.25;
  } else if (baseline?.average_lap_seconds != null) {
    const avg = Number(baseline.average_lap_seconds);
    if (Number.isFinite(avg) && avg - pb > 0.4) delta = 0.25;
  }

  const targetSeconds = Math.max(0, pb - delta);
  return { targetSeconds, deltaSeconds: delta, consistency: consistency ?? null };
}

const parseSnapshot = (snapshot) => {
  if (!snapshot) return [];
  try {
    return typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
  } catch {
    return [];
  }
};

const snapshotFingerprint = (snapshot) => {
  const specs = parseSnapshot(snapshot);
  if (!Array.isArray(specs) || specs.length === 0) return null;
  const sorted = [...specs].sort((a, b) => String(a.component_type).localeCompare(String(b.component_type)));
  return JSON.stringify(sorted.map((c) => ({
    component_type: c.component_type,
    element: c.element,
    teeth: c.teeth,
    rpm: c.rpm,
  })));
};

const componentDiffs = (prevSnap, currSnap) => {
  const prev = parseSnapshot(prevSnap);
  const curr = parseSnapshot(currSnap);
  const prevByType = {};
  const currByType = {};
  prev.forEach((c) => {
    const t = c.component_type || 'other';
    if (!prevByType[t]) prevByType[t] = [];
    prevByType[t].push(c);
  });
  curr.forEach((c) => {
    const t = c.component_type || 'other';
    if (!currByType[t]) currByType[t] = [];
    currByType[t].push(c);
  });
  const types = new Set([...Object.keys(prevByType), ...Object.keys(currByType)]);
  const diffs = [];
  types.forEach((type) => {
    const pStr = (prevByType[type] || []).map((x) => `${x.element}|${x.teeth}|${x.rpm}`).sort().join(';');
    const cStr = (currByType[type] || []).map((x) => `${x.element}|${x.teeth}|${x.rpm}`).sort().join(';');
    if (pStr !== cStr) diffs.push({ component_type: type, summary: `${type}: ${pStr || '—'} → ${cStr || '—'}` });
  });
  return diffs;
};

const laneKeyFromTiming = (t) => `${t.circuit_id || t.circuit || ''}::${t.lane}`;

/**
 * Ranking histórico de impacto por component_type (transiciones consecutivas).
 * @param {object[]} timings — con setup_snapshot, orden cronológico irrelevante (se ordena)
 */
export function computeComponentImpactRankings(timings = [], opts = {}) {
  const minTransitions = opts.minTransitions ?? 3;
  const withSnap = (timings || []).filter((t) => t.setup_snapshot);
  if (withSnap.length < 2) return [];

  const sorted = [...withSnap].sort((a, b) => new Date(a.timing_date) - new Date(b.timing_date));
  const accum = {};

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const fpPrev = snapshotFingerprint(prev.setup_snapshot);
    const fpCurr = snapshotFingerprint(curr.setup_snapshot);
    if (!fpPrev || !fpCurr || fpPrev === fpCurr) continue;

    const prevSec = prev.best_lap_timestamp ?? timeToSeconds(prev.best_lap_time);
    const currSec = curr.best_lap_timestamp ?? timeToSeconds(curr.best_lap_time);
    if (prevSec == null || currSec == null) continue;
    if (String(prev.lane ?? '') !== String(curr.lane ?? '')) continue;
    if (laneKeyFromTiming(prev) !== laneKeyFromTiming(curr)) continue;

    const delta = currSec - prevSec;
    const diffs = componentDiffs(prev.setup_snapshot, curr.setup_snapshot);
    diffs.forEach((d) => {
      if (!accum[d.component_type]) {
        accum[d.component_type] = { component_type: d.component_type, totalDelta: 0, count: 0, evidence: [] };
      }
      accum[d.component_type].totalDelta += delta;
      accum[d.component_type].count += 1;
      accum[d.component_type].evidence.push({
        timingDate: curr.timing_date,
        lane: curr.lane,
        deltaSec: delta,
        summary: d.summary,
      });
    });
  }

  return Object.values(accum)
    .filter((r) => r.count >= minTransitions)
    .map((r) => ({
      ...r,
      avgDeltaSec: r.totalDelta / r.count,
    }))
    .sort((a, b) => a.avgDeltaSec - b.avgDeltaSec);
}

/**
 * Configs estancadas: ≥ minSessions sin mejora PB > threshold en minDays.
 */
export function detectStagnantConfigs(configGroups = [], opts = {}) {
  const minSessions = opts.minSessions ?? 3;
  const minDays = opts.minDays ?? 30;
  const pbThreshold = opts.pbThreshold ?? 0.02;
  const stagnant = [];

  (configGroups || []).forEach((cg) => {
    const sessions = cg.sessions || cg.timings || [];
    if (sessions.length < minSessions) return;
    const sorted = [...sessions].sort((a, b) => new Date(a.timing_date) - new Date(b.timing_date));
    const firstDate = new Date(sorted[0].timing_date);
    const lastDate = new Date(sorted[sorted.length - 1].timing_date);
    const spanDays = (lastDate - firstDate) / (86400000);
    if (spanDays < minDays) return;

    const bestLaps = sorted
      .map((s) => s.best_lap_timestamp ?? timeToSeconds(s.best_lap_time))
      .filter((v) => v != null);
    if (bestLaps.length < 2) return;
    const firstBest = bestLaps[0];
    const overallBest = Math.min(...bestLaps);
    if (firstBest - overallBest < pbThreshold) {
      stagnant.push({
        label: cg.label,
        sessionCount: sessions.length,
        spanDays: Math.round(spanDays),
        pbImprovementSec: firstBest - overallBest,
        lastDate: sorted[sorted.length - 1].timing_date,
      });
    }
  });

  return stagnant;
}

/**
 * Plantillas i18n para sugerencias accionables.
 */
export function buildSetupSuggestions(rankings = [], stagnant = []) {
  const suggestions = [];

  rankings.slice(0, 5).forEach((r) => {
    if (r.avgDeltaSec < -0.02) {
      suggestions.push({
        type: 'component_positive',
        key: 'analysis.suggestComponentImprove',
        params: {
          component: r.component_type,
          delta: Math.abs(r.avgDeltaSec).toFixed(3),
          sessions: r.count,
        },
      });
    } else if (r.avgDeltaSec > 0.02) {
      suggestions.push({
        type: 'component_negative',
        key: 'analysis.suggestComponentRevert',
        params: {
          component: r.component_type,
          delta: r.avgDeltaSec.toFixed(3),
          sessions: r.count,
        },
      });
    }
  });

  stagnant.slice(0, 3).forEach((s) => {
    suggestions.push({
      type: 'stagnant',
      key: 'analysis.suggestStagnant',
      params: {
        config: s.label,
        sessions: s.sessionCount,
        days: s.spanDays,
      },
    });
  });

  return suggestions;
}

export { formatTime as formatSetupInsightTime };
