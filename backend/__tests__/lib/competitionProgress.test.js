const { buildCompetitionProgress } = require('../../lib/competitionProgress');

describe('competitionProgress', () => {
  it('exports buildCompetitionProgress function', () => {
    expect(typeof buildCompetitionProgress).toBe('function');
  });
});
