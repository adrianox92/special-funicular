/**
 * Rutas unificadas para el detalle de competición.
 */
export function competitionDetailPath(id, { section = 'setup', tab } = {}) {
  const params = new URLSearchParams();
  if (section && section !== 'setup') params.set('section', section);
  if (tab) params.set('tab', tab);
  const qs = params.toString();
  return `/competitions/${id}${qs ? `?${qs}` : ''}`;
}

export const COMPETITION_SECTIONS = new Set(['setup', 'timings']);

export function resolveCompetitionSection(value) {
  return COMPETITION_SECTIONS.has(value) ? value : 'setup';
}
