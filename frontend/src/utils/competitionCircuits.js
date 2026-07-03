/**
 * Opciones de circuito para formularios de competición.
 * GET /circuits ya incluye personales y de club; al filtrar por club concreto
 * solo deben mostrarse los del club seleccionado + personales (sin club_id).
 */
export function buildCompetitionCircuitOptions(circuits, clubCircuits, clubId) {
  const list = Array.isArray(circuits) ? circuits : [];
  const clubList = Array.isArray(clubCircuits) ? clubCircuits : [];

  if (clubId) {
    return [
      ...clubList.map((c) => ({ ...c, source: 'club' })),
      ...list.filter((c) => !c.club_id).map((c) => ({ ...c, source: 'personal' })),
    ];
  }

  return list.map((c) => ({ ...c, source: c.club_id ? 'club' : 'personal' }));
}

export function competitionCircuitLabel(circuit) {
  return circuit.source === 'club' ? `[Club] ${circuit.name}` : circuit.name;
}
