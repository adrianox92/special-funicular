'use strict';

const { formatStandingCellCsv, generateLeagueCSV } = require('../../lib/leagueCsvGenerator');

describe('leagueCsvGenerator — DNS / DSQ', () => {
  it('formatea ausencia, puntos, DNS y descarte', () => {
    expect(formatStandingCellCsv(null)).toBe('—');
    expect(formatStandingCellCsv({ points: 18 })).toBe('18');
    expect(formatStandingCellCsv({ points: 0, result_status: 'dns' })).toBe('DNS');
    expect(formatStandingCellCsv({ points: 0, result_status: 'dsq', dropped: true })).toBe('(DSQ)');
    expect(formatStandingCellCsv({ points: 4, dropped: true })).toBe('(4)');
    expect(formatStandingCellCsv({ points: 15, overridden: true })).toBe('15*');
    expect(formatStandingCellCsv({
      points: 12,
      overridden: true,
      result_status: 'dns',
      dropped: true,
    })).toBe('(12*)');
  });

  it('exporta DNS en la columna de la prueba', () => {
    const csv = generateLeagueCSV({
      league: { name: 'Liga test', status: 'running', counting_races: 2 },
      competitions: [
        { competition_id: 'c1', competition_name: 'Ronda 1', competition_status: 'closed' },
        { competition_id: 'c2', competition_name: 'Ronda 2', competition_status: 'closed' },
      ],
      standings: [
        {
          position: 1,
          name: 'Ana',
          email: 'ana@test.com',
          total_points: 25,
          by_competition: {
            c1: { points: 25, dropped: false },
            c2: { points: 0, result_status: 'dns', dropped: true },
          },
        },
      ],
    });

    expect(csv).toContain('Pruebas que cuentan: 2');
    expect(csv).toMatch(/25,DNS,25|25,\(DNS\),25/);
    expect(csv).toContain('(DNS)');
  });
});
