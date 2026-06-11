'use strict';

const { safeFilenamePart } = require('./competitionCsvGenerator');

/**
 * @param {object} payload — resultado de computeLeagueStandings
 */
function generateLeagueCSV(payload) {
  const { league, standings = [], competitions = [] } = payload;
  const closedCompetitions = competitions.filter((c) => c.competition_status === 'closed');

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
      const entry = row.by_competition?.[comp.competition_id];
      if (!entry) {
        cols.push('—');
      } else if (entry.dropped) {
        cols.push(`(${entry.points ?? 0})`);
      } else {
        cols.push(entry.points ?? 0);
      }
    }
    cols.push(row.total_points);
    csv += `${cols.join(',')}\n`;
  }

  return csv;
}

module.exports = { generateLeagueCSV, safeFilenamePart };
