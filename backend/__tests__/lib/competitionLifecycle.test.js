'use strict';

const {
  STATUS,
  promoteCompetitionToRunningOnFirstTiming,
} = require('../../lib/competitionLifecycle');

describe('competitionLifecycle — auto running', () => {
  it('no promueve si ya había tiempos', async () => {
    const supabase = { from: jest.fn() };
    const result = await promoteCompetitionToRunningOnFirstTiming(
      supabase,
      'comp-1',
      STATUS.PUBLISHED,
      3,
    );
    expect(result.promoted).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('no promueve si la competición no está publicada', async () => {
    const supabase = { from: jest.fn() };
    const result = await promoteCompetitionToRunningOnFirstTiming(
      supabase,
      'comp-1',
      STATUS.CLOSED,
      0,
    );
    expect(result.promoted).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('promueve published → running en el primer tiempo', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'comp-1' }, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const eqStatus = jest.fn().mockReturnValue({ select });
    const eqId = jest.fn().mockReturnValue({ eq: eqStatus });
    const update = jest.fn().mockReturnValue({ eq: eqId });
    const from = jest.fn().mockReturnValue({ update });
    const supabase = { from };

    const result = await promoteCompetitionToRunningOnFirstTiming(
      supabase,
      'comp-1',
      STATUS.PUBLISHED,
      0,
    );

    expect(result.promoted).toBe(true);
    expect(from).toHaveBeenCalledWith('competitions');
    expect(update).toHaveBeenCalledWith({ status: STATUS.RUNNING });
    expect(eqId).toHaveBeenCalledWith('id', 'comp-1');
    expect(eqStatus).toHaveBeenCalledWith('status', STATUS.PUBLISHED);
  });
});
