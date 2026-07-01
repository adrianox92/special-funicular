/**
 * Dedup de sesiones multi-fuente: misma fuente, circuito, carril y ventana temporal (~2 min).
 * @param {object[]} sessions
 * @returns {object[]} sesiones con flag `dedup_group_id` opcional
 */
export function deduplicateTimings(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.timing_date).getTime() - new Date(a.timing_date).getTime(),
  );

  const WINDOW_MS = 2 * 60 * 1000;
  const groups = [];

  for (const session of sorted) {
    const t = new Date(session.timing_date).getTime();
    const key = [
      session.recorded_from || 'web',
      session.circuit_id || session.circuit || '',
      session.lane ?? '',
      session.vehicle_id || '',
    ].join('|');

    let placed = false;
    for (const group of groups) {
      if (group.key !== key) continue;
      const anchor = group.items[0];
      const anchorT = new Date(anchor.timing_date).getTime();
      if (Math.abs(anchorT - t) <= WINDOW_MS) {
        group.items.push(session);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({ key, items: [session] });
    }
  }

  const out = [];
  let groupCounter = 0;
  for (const group of groups) {
    const gid = group.items.length > 1 ? `dup-${++groupCounter}` : null;
    for (const item of group.items) {
      out.push({ ...item, dedup_group_id: gid });
    }
  }

  return out.sort((a, b) => new Date(b.timing_date).getTime() - new Date(a.timing_date).getTime());
}

/** Agrupa sesiones por día para timeline. */
export function groupTimingsByDay(sessions) {
  const map = new Map();
  for (const s of sessions) {
    const d = new Date(s.timing_date);
    const dayKey = Number.isNaN(d.getTime())
      ? 'unknown'
      : d.toISOString().slice(0, 10);
    if (!map.has(dayKey)) map.set(dayKey, []);
    map.get(dayKey).push(s);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
