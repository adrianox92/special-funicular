'use strict';

const {
  DNS_SYNC_RULE,
  matchPilot,
  pickSessionsForPilot,
  mergeLeagueAndCompetitionPilots,
  buildSyncPlan,
  summarizePlan,
  filterPlanBySessionIds,
  buildCompetitionTimingPayload,
  isMissingRelationError,
  applyLeagueTimingSync,
} = require('../../lib/leagueTimingSync');

const heatSession = (id, extras = {}) => ({
  id,
  vehicle_id: extras.vehicle_id || 'veh-ana',
  best_lap_time: extras.best_lap_time || '00:05.100',
  total_time: extras.total_time || '01:00.000',
  laps: extras.laps ?? 12,
  session_type: extras.session_type || 'HEAT',
  circuit_id: extras.circuit_id || 'cir-1',
  timing_date: extras.timing_date || '2026-09-20',
  created_at: extras.created_at || '2026-09-20T10:00:00Z',
  owner_email: extras.owner_email,
  owner_name: extras.owner_name,
});

describe('leagueTimingSync — matching', () => {
  const pilots = [
    {
      name: 'Ana Ruiz',
      email: 'ana@test.com',
      vehicle_ids: ['veh-ana'],
      league_participant_id: 'lp-ana',
    },
    {
      name: 'Luis Pérez',
      email: null,
      vehicle_ids: [],
      league_participant_id: 'lp-luis',
    },
  ];

  it('prioriza vehículo, luego email, luego nombre normalizado', () => {
    expect(matchPilot(pilots, { vehicleId: 'veh-ana' }).reason).toBe('vehicle');
    expect(matchPilot(pilots, { email: 'ANA@test.com' }).pilot.league_participant_id).toBe('lp-ana');
    expect(matchPilot(pilots, { name: 'Luis  Perez' }).pilot.league_participant_id).toBe('lp-luis');
    expect(matchPilot(pilots, { name: 'Nadie' }).pilot).toBeNull();
  });
});

describe('leagueTimingSync — merge de pilotos', () => {
  it('fusiona inscrito de liga y participante de prueba por email/nombre', () => {
    const pilots = mergeLeagueAndCompetitionPilots({
      leagueParticipants: [
        { id: 'lp-1', name: 'Ana Ruiz', email: 'ana@test.com', vehicle_id: null, status: 'confirmed' },
        { id: 'lp-wait', name: 'Espera', email: 'w@test.com', status: 'waitlist' },
      ],
      competitionParticipants: [
        { id: 'cp-1', driver_name: 'Ana Ruiz', vehicle_id: 'veh-ana', vehicle_model: 'Porsche' },
        { id: 'cp-2', driver_name: 'Invitado', vehicle_id: 'veh-guest' },
      ],
      signups: [{ name: 'Ana Ruiz', email: 'ana@test.com' }],
    });

    expect(pilots).toHaveLength(2);
    const ana = pilots.find((p) => p.league_participant_id === 'lp-1');
    expect(ana.competition_participant_id).toBe('cp-1');
    expect(ana.vehicle_ids).toEqual(['veh-ana']);
    expect(pilots.find((p) => p.name === 'Espera')).toBeUndefined();
    expect(pilots.find((p) => p.name === 'Invitado').league_participant_id).toBeNull();
  });
});

describe('leagueTimingSync — selección de sesiones', () => {
  it('prefiere HEAT del mismo circuito y asigna rondas en orden cronológico', () => {
    const picks = pickSessionsForPilot(
      [
        heatSession('s-train', { session_type: 'TRAINING', timing_date: '2026-09-22' }),
        heatSession('s-old', { timing_date: '2026-09-18', created_at: '2026-09-18T10:00:00Z' }),
        heatSession('s-new', { timing_date: '2026-09-21', created_at: '2026-09-21T10:00:00Z' }),
        heatSession('s-other', { circuit_id: 'cir-other', timing_date: '2026-09-23' }),
      ],
      { maxRounds: 2, circuitId: 'cir-1' },
    );

    expect(picks.map((p) => p.session.id)).toEqual(['s-old', 's-new']);
    expect(picks.map((p) => p.round_number)).toEqual([1, 2]);
  });

  it('ignora sesiones sin tiempo usable', () => {
    expect(pickSessionsForPilot([
      { id: 'bad', vehicle_id: 'veh-ana', laps: 0, best_lap_time: '00:00.000', total_time: '00:00.000' },
    ])).toEqual([]);
  });
});

describe('leagueTimingSync — plan y overrides', () => {
  const ana = {
    name: 'Ana Ruiz',
    email: 'ana@test.com',
    league_participant_id: 'lp-ana',
    competition_participant_id: 'cp-ana',
    vehicle_ids: ['veh-ana'],
  };
  const luis = {
    name: 'Luis Pérez',
    email: 'luis@test.com',
    league_participant_id: 'lp-luis',
    competition_participant_id: null,
    vehicle_ids: [],
  };

  it('empareja por vehículo y deja al resto “no figura” (sin DNS)', () => {
    const plan = buildSyncPlan({
      pilots: [ana, luis],
      sessions: [heatSession('s1')],
      competitionId: 'comp-1',
      maxRounds: 1,
    });

    expect(plan.matched).toHaveLength(1);
    expect(plan.matched[0].name).toBe('Ana Ruiz');
    expect(plan.unmatched_participants.map((p) => p.name)).toEqual(['Luis Pérez']);
    expect(plan.dns_rule.id).toBe('no_auto_dns');
    expect(plan.empty_reason).toBeNull();
  });

  it('empareja por email del dueño de la sesión si no hay vehículo en la ficha', () => {
    const plan = buildSyncPlan({
      pilots: [luis],
      sessions: [heatSession('s-email', {
        vehicle_id: 'veh-x',
        owner_email: 'luis@test.com',
      })],
      competitionId: 'comp-1',
    });

    expect(plan.matched[0].match_reason).toBe('email');
    expect(plan.matched[0].league_participant_id).toBe('lp-luis');
  });

  it('no pisa overrides: marca skip y no inventa filas nuevas', () => {
    const plan = buildSyncPlan({
      pilots: [ana, luis],
      sessions: [heatSession('s1')],
      overrides: [
        { competition_id: 'comp-1', league_participant_id: 'lp-ana', points: 22 },
      ],
      competitionId: 'comp-1',
    });

    expect(plan.matched[0].has_override).toBe(true);
    expect(plan.skipped_overrides).toHaveLength(1);
    expect(plan.skipped_overrides[0].league_participant_id).toBe('lp-ana');
    expect(plan.unmatched_participants).toHaveLength(1);
    expect(summarizePlan(plan)).toMatchObject({
      matched_count: 1,
      skipped_override_count: 1,
      unmatched_participant_count: 1,
    });
  });

  it('no crea match para sesiones de no inscritos (sin fila de descarte)', () => {
    const plan = buildSyncPlan({
      pilots: [ana],
      sessions: [heatSession('s-guest', {
        vehicle_id: 'veh-guest',
        owner_name: 'Invitado',
        owner_email: 'guest@test.com',
      })],
      competitionId: 'comp-1',
    });

    expect(plan.matched).toHaveLength(0);
    expect(plan.unmatched_sessions).toHaveLength(1);
    expect(plan.empty_reason).toBe('no_matches');
  });

  it('filtra el plan por session_ids', () => {
    const plan = buildSyncPlan({
      pilots: [ana],
      sessions: [
        heatSession('s1', { timing_date: '2026-09-18' }),
        heatSession('s2', { timing_date: '2026-09-21' }),
      ],
      competitionId: 'comp-1',
      maxRounds: 2,
    });
    const filtered = filterPlanBySessionIds(plan, ['s2']);
    expect(filtered.matched[0].rounds).toHaveLength(1);
    expect(filtered.matched[0].rounds[0].session_id).toBe('s2');
    expect(filtered.matched[0].rounds[0].round_number).toBe(1);
  });
});

describe('leagueTimingSync — payload de competición', () => {
  it('deriva el promedio desde total y vueltas', () => {
    const built = buildCompetitionTimingPayload(heatSession('s1'), 'cp-1', 1);
    expect(built.error).toBeUndefined();
    expect(built.data.participant_id).toBe('cp-1');
    expect(built.data.round_number).toBe(1);
    expect(built.data.did_not_participate).toBe(false);
    expect(built.data.average_time).toBe('00:05.000');
  });

  it('rechaza tiempos inválidos', () => {
    expect(buildCompetitionTimingPayload({
      ...heatSession('s1'),
      total_time: 'bad',
      average_time: null,
    }, 'cp-1', 1).error).toBe('invalid_time');
  });
});

describe('leagueTimingSync — apply no toca overrides', () => {
  it('escribe competition_timings y no modifica league_point_overrides', async () => {
    const tables = {};
    const supabase = {
      from: jest.fn((name) => {
        if (!tables[name]) {
          tables[name] = [];
        }
        const chain = {
          _filters: {},
          select() { return this; },
          insert(rows) {
            this._insert = rows;
            return this;
          },
          update(payload) {
            this._update = payload;
            return this;
          },
          eq(col, val) {
            this._filters[col] = val;
            return this;
          },
          in() { return this; },
          order() { return this; },
          limit() { return this; },
          async maybeSingle() {
            if (this._name === 'league_competitions') {
              return { data: { id: 'link-1' }, error: null };
            }
            if (this._name === 'competitions') {
              return { data: { id: 'comp-1', name: 'Ronda 1', status: 'published', rounds: 1, circuit_id: 'cir-1' }, error: null };
            }
            if (this._name === 'competition_timings' && !this._insert && !this._update) {
              return { data: null, error: null };
            }
            return { data: null, error: null };
          },
          async single() {
            if (this._insert && this._name === 'competition_timings') {
              tables.competition_timings.push(this._insert[0]);
              return { data: { id: 'ct-1' }, error: null };
            }
            if (this._update && this._name === 'competition_timings') {
              return { data: { id: 'ct-existing' }, error: null };
            }
            return { data: { id: 'row' }, error: null };
          },
          then(resolve) {
            if (this._name === 'league_participants') {
              return resolve({
                data: [
                  { id: 'lp-ana', name: 'Ana', email: 'ana@test.com', vehicle_id: 'veh-ana', status: 'confirmed' },
                ],
                error: null,
              });
            }
            if (this._name === 'competition_participants') {
              return resolve({
                data: [{ id: 'cp-ana', driver_name: 'Ana', vehicle_id: 'veh-ana' }],
                error: null,
              });
            }
            if (this._name === 'competition_signups') {
              return resolve({ data: [{ name: 'Ana', email: 'ana@test.com' }], error: null });
            }
            if (this._name === 'vehicle_timings') {
              return resolve({
                data: [heatSession('s1', { vehicle_id: 'veh-ana' })],
                error: null,
              });
            }
            if (this._name === 'league_point_overrides') {
              return resolve({
                data: [{ competition_id: 'comp-1', league_participant_id: 'lp-ana', points: 25 }],
                error: null,
              });
            }
            if (this._name === 'competition_timings' && this._count) {
              return resolve({ count: 0, error: null });
            }
            return resolve({ data: [], error: null });
          },
        };
        chain._name = name;
        const originalSelect = chain.select.bind(chain);
        chain.select = function select(cols, opts) {
          if (opts?.count === 'exact') chain._count = true;
          return originalSelect(cols, opts);
        };
        return chain;
      }),
    };

    const result = await applyLeagueTimingSync(supabase, 'lg-1', 'comp-1');

    expect(result.applied).toBe(true);
    expect(result.written.created_timings).toBe(1);
    expect(result.skipped_override_count).toBe(1);
    expect(tables.competition_timings).toHaveLength(1);
    expect(tables.competition_timings[0].participant_id).toBe('cp-ana');
    const overrideWrites = supabase.from.mock.calls.filter(([name]) => name === 'league_point_overrides');
    expect(overrideWrites).toHaveLength(1);
    expect(tables.league_point_overrides || []).toEqual([]);
  });
});

describe('leagueTimingSync — utilidades', () => {
  it('reconoce tabla de overrides ausente (G5 no desplegado)', () => {
    expect(isMissingRelationError({ message: 'relation "league_point_overrides" does not exist' })).toBe(true);
    expect(isMissingRelationError({ message: 'permission denied' })).toBe(false);
  });

  it('documenta la regla DNS', () => {
    expect(DNS_SYNC_RULE.id).toBe('no_auto_dns');
    expect(DNS_SYNC_RULE.summary).toMatch(/no figura/);
  });
});
