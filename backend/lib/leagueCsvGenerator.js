'use strict';

const { safeFilenamePart } = require('./competitionCsvGenerator');
const { isLeagueCompetitionVisibleInStandings } = require('./leagueStandings');

/**
 * Celda de clasificación: puntos, DNS/DSQ; paréntesis si está descartada.
 * @param {{ points?: number, dropped?: boolean, result_status?: string|null }|null|undefined} entry
 */
function formatStandingCellCsv(entry) {
  if (!entry) return '—';
  const status = entry.result_status ? String(entry.result_status).toUpperCase() : null;
  const inner = status || String(entry.points ?? 0);
  return entry.dropped ? `(${inner})` : inner;
}

/**
 * @param {object} payload — resultado de computeLeagueStandings
 */
function generateLeagueCSV(payload) {
  const { league, standings = [], competitions = [] } = payload;
  const closedCompetitions = competitions.filter(isLeagueCompetitionVisibleInStandings);

  let csv = '';
  csv += `Liga: ${league.name}\n`;
  csv += `Estado: ${league.status}\n`;
  if (league.counting_races) {
    csv += `Pruebas que cuentan: ${league.counting_races}\n`;
  }
  csv += `Participantes: ${standings.length}\n`;
  csv += `Fecha exportación: ${new Date().toISOString().split('T')[0]}\n\n`;

  const headers = ['Pos', 'Piloto', 'Email', ...closedCompetitions.map((c) => c.competition_name), 'Total'];
  csv += `${headers.join(',')}\n`;

  for (const row of standings) {
    const cols = [
      row.position,
      `"${String(row.name).replace(/"/g, '""')}"`,
      `"${String(row.email || '').replace(/"/g, '""')}"`,
    ];
    for (const comp of closedCompetitions) {
      cols.push(formatStandingCellCsv(row.by_competition?.[comp.competition_id]));
    }
    cols.push(row.total_points);
    csv += `${cols.join(',')}\n`;
  }

  return csv;
}

module.exports = { generateLeagueCSV, formatStandingCellCsv, safeFilenamePart };
