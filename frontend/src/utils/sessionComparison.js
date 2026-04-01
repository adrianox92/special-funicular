const timeToSeconds = (val) => {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})\.(\d{1,3})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3].padStart(3, '0'), 10) / 1000;
  const n = parseFloat(str.replace(',', '.'));
  return isNaN(n) ? null : n;
};

const TIME_LOWER_IS_BETTER = ['best_lap_time', 'worst_lap_timestamp', 'average_time', 'total_time'];
const LOWER_IS_BETTER = [...TIME_LOWER_IS_BETTER, 'consistency_score'];
const HIGHER_IS_BETTER = ['laps', 'total_distance_meters', 'avg_speed_kmh', 'avg_speed_scale_kmh', 'best_lap_speed_kmh'];

export function getBetterSide(key, sessionA, sessionB) {
  const timestampKey = { best_lap_time: 'best_lap_timestamp', average_time: 'average_time_timestamp', total_time: 'total_time_timestamp' }[key];
  const a = timestampKey ? (sessionA?.[timestampKey] ?? sessionA?.[key]) : sessionA?.[key];
  const b = timestampKey ? (sessionB?.[timestampKey] ?? sessionB?.[key]) : sessionB?.[key];
  if (a == null && b == null) return null;
  if (a == null) return 'B';
  if (b == null) return 'A';

  if (!LOWER_IS_BETTER.includes(key) && !HIGHER_IS_BETTER.includes(key)) return null;

  const numA = TIME_LOWER_IS_BETTER.includes(key) ? timeToSeconds(a) : (typeof a === 'number' ? a : parseFloat(String(a).replace(',', '.')));
  const numB = TIME_LOWER_IS_BETTER.includes(key) ? timeToSeconds(b) : (typeof b === 'number' ? b : parseFloat(String(b).replace(',', '.')));
  if (numA == null || isNaN(numA)) return 'B';
  if (numB == null || isNaN(numB)) return 'A';
  if (numA === numB) return null;
  if (LOWER_IS_BETTER.includes(key)) return numA < numB ? 'A' : 'B';
  return numA > numB ? 'A' : 'B';
}
