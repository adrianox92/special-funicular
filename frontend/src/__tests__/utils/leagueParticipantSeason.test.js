import {
  findStandingRow,
  buildParticipantSeason,
  raceAppearance,
  participantKeyFromRow,
  matcherFromParticipantKey,
  formatOverrideTooltip,
} from '../../utils/leagueParticipantSeason';

const scored = (id, name, order) => ({
  competition_id: id,
  competition_name: name,
  competition_status: 'closed',
  order_index: order,
  public_slug: `${id}-slug`,
  has_results: true,
});

describe('leagueParticipantSeason util', () => {
  test('encuentra por id y email', () => {
    const standings = [
      { league_participant_id: 'lp-1', name: 'Ana', email: 'ana@test.com' },
      { league_participant_id: 'lp-2', name: 'Luis', email: null },
    ];
    expect(findStandingRow(standings, { leagueParticipantId: 'lp-2' }).name).toBe('Luis');
    expect(findStandingRow(standings, { email: 'ANA@test.com' }).league_participant_id).toBe('lp-1');
  });

  test('shape: DNS descartado vs no figura vs pendiente', () => {
    const row = {
      league_participant_id: 'lp-1',
      name: 'Ana',
      email: 'ana@test.com',
      position: 1,
      total_points: 43,
      dropped_competitions: 1,
      by_competition: {
        c1: { points: 25, position: 1, dropped: false },
        c2: { points: 18, position: 2, dropped: false },
        c3: { points: 0, position: null, dropped: true, result_status: 'dns' },
      },
    };
    const season = buildParticipantSeason(
      {
        league: { name: 'Liga', counting_races: 2 },
        competitions: [
          scored('c1', 'P1', 0),
          scored('c2', 'P2', 1),
          scored('c3', 'P3', 2),
          scored('c4', 'P4', 3),
          {
            competition_id: 'c5',
            competition_name: 'P5',
            competition_status: 'published',
            has_results: false,
            order_index: 4,
            public_slug: 'c5-slug',
          },
        ],
        standings: [row],
      },
      { leagueParticipantId: 'lp-1' },
    );

    expect(season.found).toBe(true);
    expect(season.total_points).toBe(43);
    expect(season.dropped.map((r) => r.competition_id)).toEqual(['c3']);
    expect(season.dropped[0].appearance).toBe('dns');
    expect(season.races.find((r) => r.competition_id === 'c4').appearance).toBe('absent');
    expect(season.races.find((r) => r.competition_id === 'c5').appearance).toBe('pending');
    expect(season.counting.map((r) => r.competition_id)).toEqual(['c1', 'c2']);
    expect(season.participant.email).toBeNull();
  });

  test('proyecta override en la carrera', () => {
    const season = buildParticipantSeason(
      {
        league: { name: 'Liga', counting_races: 2 },
        competitions: [scored('c1', 'P1', 0)],
        standings: [
          {
            league_participant_id: 'lp-1',
            name: 'Ana',
            position: 1,
            total_points: 20,
            by_competition: {
              c1: {
                points: 20,
                position: 2,
                dropped: false,
                overridden: true,
                override: { points: 20, reason: 'Acta' },
              },
            },
          },
        ],
      },
      { leagueParticipantId: 'lp-1' },
    );
    expect(season.races[0].overridden).toBe(true);
    expect(season.races[0].override.reason).toBe('Acta');
    expect(season.races[0].points).toBe(20);
  });

  test('empty states', () => {
    expect(
      buildParticipantSeason(
        { league: { name: 'X' }, competitions: [], standings: [{ name: 'A', by_competition: {} }] },
        { name: 'A' },
      ).empty_reason,
    ).toBe('no_competitions');

    expect(
      buildParticipantSeason(
        {
          league: { name: 'X' },
          competitions: [scored('c1', 'P1', 0)],
          standings: [{ name: 'A', by_competition: {} }],
        },
        { name: 'A' },
      ).empty_reason,
    ).toBe('no_results');
  });

  test('appearance helpers', () => {
    expect(raceAppearance({ competition_status: 'closed', has_results: true }, null)).toBe('absent');
    expect(raceAppearance({ competition_status: 'closed', has_results: true }, { result_status: 'dsq' })).toBe('dsq');
    expect(participantKeyFromRow({ league_participant_id: 'lp-1', name: 'A' })).toBe('lp-1');
    expect(matcherFromParticipantKey('name:Ada')).toEqual({ name: 'Ada' });
  });

  test('tooltip de override incluye motivo y autor opcional', () => {
    const t = (key, opts) => {
      if (key === 'standings.adjustedBadge') return 'Ajustado';
      if (key === 'standings.adjustedBy') return `por ${opts.name}`;
      return key;
    };
    expect(formatOverrideTooltip({ reason: 'Acta' }, t)).toBe('Ajustado · Acta');
    expect(
      formatOverrideTooltip(
        { reason: 'Acta', updated_by_label: 'María' },
        t,
        { includeAuthor: true },
      ),
    ).toBe('Ajustado · Acta · por María');
  });
});
