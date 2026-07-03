jest.mock('@supabase/supabase-js', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    createClient: jest.fn(() => mockSupabase),
  };
});

jest.mock('../../lib/supabaseClients', () => {
  const { mockSupabase } = require('../mocks/supabase');
  return {
    getAnonClient: jest.fn(() => mockSupabase),
    getServiceClient: jest.fn(() => mockSupabase),
    getServiceOrAnonClient: jest.fn(() => mockSupabase),
    createUserScopedClient: jest.fn(() => mockSupabase),
    createServerClient: jest.fn(() => mockSupabase),
  };
});

const request = require('supertest');
const app = require('../../server');
const { mockSupabase } = require('../mocks/supabase');

const AUTH_USER_ID = 'user-aaa';
const OTHER_USER_ID = 'user-bbb';
const AUTH_HEADER = { Authorization: 'Bearer test-token' };

function createQueryBuilder(resolveValue = { data: null, error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveValue),
    maybeSingle: jest.fn().mockResolvedValue(resolveValue),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

describe('Competition Rules Templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
      error: null,
    });
  });

  describe('GET /api/competition-rules/templates', () => {
    test('devuelve plantillas del sistema y propias, excluyendo las de otros usuarios', async () => {
      const allTemplates = [
        { id: '1', name: 'Sistema', is_template: true, created_by: null, created_at: '2024-01-01' },
        { id: '2', name: 'Mía', is_template: true, created_by: AUTH_USER_ID, created_at: '2024-02-01' },
        { id: '3', name: 'Ajena', is_template: true, created_by: OTHER_USER_ID, created_at: '2024-03-01' },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competition_rules') {
          const builder = createQueryBuilder();
          builder.or.mockImplementation(() =>
            Promise.resolve({
              data: allTemplates.filter(
                (t) => t.created_by == null || t.created_by === AUTH_USER_ID
              ),
              error: null,
            })
          );
          return builder;
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .get('/api/competition-rules/templates')
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((t) => t.id)).toEqual(['1', '2']);
      expect(res.body.some((t) => t.created_by === OTHER_USER_ID)).toBe(false);
    });
  });

  describe('POST /api/competition-rules', () => {
    test('exige nombre al crear plantilla', async () => {
      const res = await request(app)
        .post('/api/competition-rules')
        .set(AUTH_HEADER)
        .send({
          rule_type: 'per_round',
          points_structure: { '1': 10 },
          is_template: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/nombre/i);
    });
  });

  describe('POST /api/competition-rules/:id/save-as-template', () => {
    const sourceRule = {
      id: 'rule-1',
      is_template: false,
      competition_id: 'comp-1',
      league_id: null,
      rule_type: 'per_round',
      description: 'Regla custom',
      points_structure: { '1': 10, '2': 8 },
      use_bonus_best_lap: true,
      target_rounds: null,
    };

    test('clona una regla existente como plantilla personal', async () => {
      const savedTemplate = {
        id: 'tpl-1',
        name: 'Mi plantilla',
        is_template: true,
        created_by: AUTH_USER_ID,
        rule_type: 'per_round',
        points_structure: { '1': 10, '2': 8 },
        use_bonus_best_lap: true,
      };

      let insertCalled = false;

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competition_rules') {
          const builder = createQueryBuilder();
          builder.single.mockImplementation(() => {
            if (insertCalled) {
              return Promise.resolve({ data: savedTemplate, error: null });
            }
            return Promise.resolve({ data: sourceRule, error: null });
          });
          builder.insert.mockImplementation(() => {
            insertCalled = true;
            return builder;
          });
          return builder;
        }
        if (table === 'competitions') {
          return createQueryBuilder({
            data: { id: 'comp-1', organizer: AUTH_USER_ID },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .post('/api/competition-rules/rule-1/save-as-template')
        .set(AUTH_HEADER)
        .send({ name: 'Mi plantilla' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Mi plantilla');
      expect(res.body.is_template).toBe(true);
    });

    test('rechaza guardar plantilla sin permisos sobre la regla', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competition_rules') {
          return createQueryBuilder({ data: sourceRule, error: null });
        }
        if (table === 'competitions') {
          return createQueryBuilder({
            data: { id: 'comp-1', organizer: OTHER_USER_ID },
            error: null,
          });
        }
        return createQueryBuilder();
      });

      const res = await request(app)
        .post('/api/competition-rules/rule-1/save-as-template')
        .set(AUTH_HEADER)
        .send({ name: 'Intento' });

      expect(res.status).toBe(403);
    });

    test('exige nombre', async () => {
      const res = await request(app)
        .post('/api/competition-rules/rule-1/save-as-template')
        .set(AUTH_HEADER)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/nombre/i);
    });
  });

  describe('PUT/DELETE plantillas ajenas', () => {
    const foreignTemplate = {
      id: 'tpl-foreign',
      is_template: true,
      created_by: OTHER_USER_ID,
      rule_type: 'per_round',
      points_structure: { '1': 5 },
    };

    beforeEach(() => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'competition_rules') {
          return createQueryBuilder({ data: foreignTemplate, error: null });
        }
        return createQueryBuilder();
      });
    });

    test('PUT devuelve 403 para plantilla de otro usuario', async () => {
      const res = await request(app)
        .put('/api/competition-rules/tpl-foreign')
        .set(AUTH_HEADER)
        .send({ name: 'Robada' });

      expect(res.status).toBe(403);
    });

    test('DELETE devuelve 403 para plantilla de otro usuario', async () => {
      const res = await request(app)
        .delete('/api/competition-rules/tpl-foreign')
        .set(AUTH_HEADER);

      expect(res.status).toBe(403);
    });
  });
});
