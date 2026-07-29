const { logDbError, extractErrorFields } = require('../../lib/logDbError');

describe('logDbError', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('extractErrorFields', () => {
    test('extrae campos PostgREST típicos', () => {
      const result = extractErrorFields({
        message: 'Bad Request',
        code: 'PGRST102',
        details: 'Invalid query',
        hint: 'Check filter',
      });

      expect(result.message).toBe('Bad Request');
      expect(result.fields).toEqual([
        'code=PGRST102',
        'details=Invalid query',
        'hint=Check filter',
      ]);
      expect(result.raw).toBeUndefined();
    });

    test('añade raw cuando solo hay mensaje genérico', () => {
      const err = { message: 'Bad Request', foo: 'bar' };
      const result = extractErrorFields(err);

      expect(result.message).toBe('Bad Request');
      expect(result.fields).toEqual([]);
      expect(result.raw).toBe(JSON.stringify(err));
    });
  });

  describe('logDbError', () => {
    test('formatea línea con label, campos y meta', () => {
      logDbError(
        'GET /api/vehicles list',
        {
          message: 'Bad Request',
          code: 'PGRST102',
          details: 'column does not exist',
        },
        { userId: 'u1', page: 1, limit: 25 },
      );

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const line = consoleErrorSpy.mock.calls[0][0];
      expect(line).toContain('[GET /api/vehicles list] Bad Request');
      expect(line).toContain('code=PGRST102');
      expect(line).toContain('details=column does not exist');
      expect(line).toContain('userId=u1');
      expect(line).toContain('page=1');
      expect(line).toContain('limit=25');
    });

    test('incluye raw en errores mínimos', () => {
      logDbError('action-items vehicle_timings', { message: 'Bad Request' }, { vehicleCount: 42 });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const line = consoleErrorSpy.mock.calls[0][0];
      expect(line).toContain('[action-items vehicle_timings] Bad Request');
      expect(line).toContain('raw={"message":"Bad Request"}');
      expect(line).toContain('vehicleCount=42');
    });
  });
});
