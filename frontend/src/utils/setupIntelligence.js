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

export { formatTime as formatSetupInsightTime };
