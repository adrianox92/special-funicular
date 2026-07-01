/**
 * Análisis de stint sobre timing_laps (funciones puras).
 */

function lapSeconds(lap) {
  const v = lap?.lap_time_seconds ?? lap?.time_seconds ?? lap?.time;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeLaps(laps) {
  return (laps || [])
    .map((l, i) => ({
      lap_number: l.lap_number ?? l.lapNumber ?? i + 1,
      lap_time_seconds: lapSeconds(l),
    }))
    .filter((l) => l.lap_time_seconds != null)
    .sort((a, b) => a.lap_number - b.lap_number);
}

function linearTrendSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * @param {object[]} laps
 * @param {{ firstN?: number, lastN?: number, streakK?: number }} [opts]
 */
export function analyzeStint(laps, opts = {}) {
  const firstN = opts.firstN ?? 3;
  const lastN = opts.lastN ?? 3;
  const streakK = opts.streakK ?? 3;
  const normalized = normalizeLaps(laps);
  const times = normalized.map((l) => l.lap_time_seconds);

  if (times.length === 0) {
    return {
      firstNMean: null,
      lastNMean: null,
      deltaFirstLast: null,
      trendSlope: 0,
      trend: 'insufficient',
      bestStreak: null,
      lapCount: 0,
    };
  }

  const firstSlice = times.slice(0, Math.min(firstN, times.length));
  const lastSlice = times.slice(Math.max(0, times.length - lastN));
  const firstNMean = firstSlice.reduce((a, b) => a + b, 0) / firstSlice.length;
  const lastNMean = lastSlice.reduce((a, b) => a + b, 0) / lastSlice.length;
  const deltaFirstLast = lastNMean - firstNMean;
  const trendSlope = linearTrendSlope(times);

  let trend = 'stable';
  if (trendSlope > 0.02) trend = 'degrading';
  else if (trendSlope < -0.02) trend = 'improving';

  let bestStreak = null;
  if (times.length >= streakK) {
    let bestSum = Infinity;
    let bestStart = 0;
    for (let i = 0; i <= times.length - streakK; i++) {
      const window = times.slice(i, i + streakK);
      const sum = window.reduce((a, b) => a + b, 0);
      if (sum < bestSum) {
        bestSum = sum;
        bestStart = i;
      }
    }
    bestStreak = {
      startLap: normalized[bestStart].lap_number,
      endLap: normalized[bestStart + streakK - 1].lap_number,
      average: bestSum / streakK,
      k: streakK,
    };
  }

  return {
    firstNMean,
    lastNMean,
    deltaFirstLast,
    trendSlope,
    trend,
    bestStreak,
    lapCount: times.length,
  };
}

/**
 * Marca out-lap (vuelta 1) si > media + 1.5σ.
 * @param {object[]} laps
 */
export function detectOutLap(laps) {
  const normalized = normalizeLaps(laps);
  const times = normalized.map((l) => l.lap_time_seconds);
  if (times.length < 2) {
    return normalized.map((l) => ({ ...l, isOutLap: false }));
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((s, v) => s + (v - mean) ** 2, 0) / times.length;
  const sigma = Math.sqrt(variance);
  const threshold = mean + 1.5 * sigma;

  return normalized.map((l) => ({
    ...l,
    isOutLap: l.lap_number === 1 && l.lap_time_seconds > threshold,
  }));
}

/**
 * Serie para gráfica de decay vs media móvil.
 * @param {object[]} laps
 * @param {{ window?: number }} [opts]
 */
export function computePaceDecay(laps, opts = {}) {
  const window = opts.window ?? 3;
  const normalized = normalizeLaps(laps);
  const times = normalized.map((l) => l.lap_time_seconds);

  return normalized.map((l, i) => {
    let rolling = null;
    if (i >= window - 1) {
      const slice = times.slice(i - window + 1, i + 1);
      rolling = slice.reduce((a, b) => a + b, 0) / slice.length;
    }
    return {
      lap: l.lap_number,
      time: l.lap_time_seconds,
      deltaVsRollingAvg: rolling != null ? l.lap_time_seconds - rolling : null,
    };
  });
}
