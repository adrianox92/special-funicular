const {
  POSTGREST_IN_FILTER_CHUNK,
  chunkArray,
  estimateInFilterUrlChars,
} = require('../../lib/postgrestInFilter');
const { fetchVehicleTimingsForVehicleIds } = require('../../lib/fetchVehicleTimingsForVehicleIds');
const { fetchVehicleImagesForVehicleIds } = require('../../lib/fetchVehicleImagesForVehicleIds');
const { logDbError, extractErrorFields, inferLikelyCause } = require('../../lib/logDbError');

describe('postgrestInFilter', () => {
  test('chunkArray divide en trozos del tamaño indicado', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('estimateInFilterUrlChars crece con UUIDs', () => {
    const ids = Array.from({ length: 660 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    const chars = estimateInFilterUrlChars(ids);
    expect(chars).toBeGreaterThan(20_000);
    expect(chunkArray(ids, POSTGREST_IN_FILTER_CHUNK).length).toBe(9);
  });
});

describe('fetchVehicleTimingsForVehicleIds', () => {
  test('consulta en lotes y fusiona resultados ordenados', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    const calls = [];

    const supabase = {
      from(table) {
        expect(table).toBe('vehicle_timings');
        return {
          select() {
            return this;
          },
          in(_col, chunk) {
            calls.push(chunk.length);
            return this;
          },
          order() {
            return this;
          },
          async limit() {
            const chunkIndex = calls.length - 1;
            return {
              data: [
                {
                  vehicle_id: chunkIndex === 0 ? 'id-0' : 'id-100',
                  timing_date: chunkIndex === 0 ? '2024-02-01T00:00:00Z' : '2024-01-01T00:00:00Z',
                  circuit_id: null,
                  circuit: 'Test',
                  circuits: null,
                },
              ],
              error: null,
            };
          },
        };
      },
    };

    const { data, error, meta } = await fetchVehicleTimingsForVehicleIds(supabase, ids, { limit: 8000 });

    expect(error).toBeNull();
    expect(meta.chunkCount).toBe(2);
    expect(calls).toEqual([80, 70]);
    expect(data).toHaveLength(2);
    expect(data[0].timing_date).toBe('2024-02-01T00:00:00Z');
  });
});

describe('fetchVehicleImagesForVehicleIds', () => {
  test('consulta imágenes en lotes y fusiona filas', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    const calls = [];

    const supabase = {
      from(table) {
        expect(table).toBe('vehicle_images');
        return {
          select() {
            return this;
          },
          in(_col, chunk) {
            calls.push(chunk.length);
            return this;
          },
          async order() {
            const chunkIndex = calls.length - 1;
            return {
              data: [
                {
                  vehicle_id: chunkIndex === 0 ? 'id-0' : 'id-100',
                  image_url: `https://example.com/${chunkIndex}.jpg`,
                  view_type: 'front',
                },
              ],
              error: null,
            };
          },
        };
      },
    };

    const { data, error, meta } = await fetchVehicleImagesForVehicleIds(supabase, ids);

    expect(error).toBeNull();
    expect(meta.chunkCount).toBe(2);
    expect(meta.vehicleCount).toBe(150);
    expect(calls).toEqual([80, 70]);
    expect(data).toHaveLength(2);
    expect(data[0].vehicle_id).toBe('id-0');
    expect(data[1].vehicle_id).toBe('id-100');
  });
});

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
      expect(result.fields).toContain('foo=bar');
      expect(result.raw).toContain('"message":"Bad Request"');
    });

    test('normaliza message vacío típico de HEAD count', () => {
      const result = extractErrorFields({ message: '' });
      expect(result.message).toBe('Empty error message');
      expect(result.raw).toContain('"message":""');
    });
  });

  describe('inferLikelyCause', () => {
    test('detecta URL demasiado larga en filtro in', () => {
      expect(
        inferLikelyCause('Bad Request', { inFilterChars: 24_000, vehicleCount: 660 }),
      ).toBe('postgrest_in_filter_url_too_long');
    });

    test('detecta HEAD count que oculta el body del error', () => {
      expect(
        inferLikelyCause('Empty error message', { status: 500, competitionId: 'c1' }),
      ).toBe('postgrest_head_count_hides_error_body');
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
    });

    test('incluye likelyCause cuando el filtro in es enorme', () => {
      logDbError(
        'GET /api/dashboard/action-items vehicle_timings',
        { message: 'Bad Request' },
        { vehicleCount: 660, inFilterChars: 24_424, limit: 8000 },
      );

      const line = consoleErrorSpy.mock.calls[0][0];
      expect(line).toContain('likelyCause=postgrest_in_filter_url_too_long');
      expect(line).toContain('inFilterChars=24424');
      expect(line).toContain('vehicleCount=660');
    });
  });
});
