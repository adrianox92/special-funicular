const {
  hourInMadrid,
  formatPct,
  buildEmail,
  runCatalogGapReport,
} = require('../../lib/catalogGapReport');

describe('catalogGapReport', () => {
  const originalEnv = process.env;
  let fetchMock;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM = 'Slot Database <hello@example.com>';
    process.env.FRONTEND_URL = 'https://slotdatabase.example';
    process.env.CATALOG_GAP_REPORT_TO = 'adrianpalomera17@gmail.com';
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    delete global.fetch;
  });

  it('formatPct usa coma decimal es-ES', () => {
    expect(formatPct(166, 1000)).toBe('16,6%');
    expect(formatPct(0, 0)).toBe('0,0%');
  });

  it('hourInMadrid es 9 a las 07:00 UTC en CEST (verano)', () => {
    // 17 sep 2026 07:00 UTC = 09:00 Europe/Madrid
    expect(hourInMadrid(new Date('2026-09-17T07:00:00.000Z'))).toBe(9);
    expect(hourInMadrid(new Date('2026-09-17T08:00:00.000Z'))).toBe(10);
  });

  it('hourInMadrid es 9 a las 08:00 UTC en CET (invierno)', () => {
    expect(hourInMadrid(new Date('2026-01-15T08:00:00.000Z'))).toBe(9);
    expect(hourInMadrid(new Date('2026-01-15T07:00:00.000Z'))).toBe(8);
  });

  it('no envía fuera de las 9:00 Madrid salvo force', async () => {
    const result = await runCatalogGapReport({
      now: new Date('2026-09-17T10:00:00.000Z'),
      admin: {},
    });
    expect(result).toMatchObject({ skipped: true, reason: 'not_nine_am_madrid' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía el informe con cobertura y top de referencias', async () => {
    const admin = mockAdmin({
      total: 1000,
      linked: 166,
      missing: {
        total: 3,
        rows: [
          {
            reference: 'NIN-123',
            sample_manufacturer: 'Ninco',
            sample_model: 'GT3',
            linkable_vehicle_count: 12,
            linkable_distinct_user_count: 5,
          },
          {
            reference: '<script>',
            sample_manufacturer: 'Scalextric',
            sample_model: 'R8',
            vehicle_count: 4,
            distinct_user_count: 2,
          },
        ],
      },
    });

    const result = await runCatalogGapReport({
      force: true,
      now: new Date('2026-09-17T12:00:00.000Z'),
      admin,
    });

    expect(result.sent).toBe(true);
    expect(result.coverage).toEqual({ total: 1000, linked: 166 });
    expect(result.missing_total).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith('admin_vehicle_refs_missing_catalog', {
      p_limit: 40,
      p_offset: 0,
      p_only_unlinked: true,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers.Authorization).toBe('Bearer re_test');
    expect(options.headers['Idempotency-Key']).toMatch(/^catalog-gap-report\/2026-09-17\/force-/);

    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['adrianpalomera17@gmail.com']);
    expect(body.subject).toContain('16,6%');
    expect(body.html).toContain('NIN-123');
    expect(body.html).toContain('Ninco');
    expect(body.html).toContain('12');
    expect(body.html).not.toContain('<script>');
    expect(body.html).toContain('&lt;script&gt;');
    expect(body.html).toContain('https://slotdatabase.example/admin/dashboard');
    expect(body.text).toContain('NIN-123');
  });

  it('envía a las 9:00 Madrid sin force (07:00 UTC en CEST)', async () => {
    const admin = mockAdmin({
      total: 10,
      linked: 2,
      missing: { total: 0, rows: [] },
    });
    const result = await runCatalogGapReport({
      now: new Date('2026-09-17T07:00:00.000Z'),
      admin,
    });
    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const key = fetchMock.mock.calls[0][1].headers['Idempotency-Key'];
    expect(key).toBe('catalog-gap-report/2026-09-17');
  });

  it('omite el envío si falta RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY;
    const admin = mockAdmin({
      total: 10,
      linked: 2,
      missing: { total: 0, rows: [] },
    });
    const result = await runCatalogGapReport({ force: true, admin });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_resend_key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buildEmail incluye filas y cobertura', () => {
    const { subject, text } = buildEmail({
      coverage: { total: 10, linked: 2 },
      missing: {
        total: 1,
        rows: [
          {
            reference: 'ABC',
            sample_manufacturer: 'Ninco',
            sample_model: 'Cup',
            linkable_vehicle_count: 3,
            linkable_distinct_user_count: 1,
          },
        ],
      },
      now: new Date('2026-09-17T07:00:00.000Z'),
    });
    expect(subject).toContain('20,0%');
    expect(text).toContain('ABC');
    expect(text).toContain('3 vehículos');
  });
});

function mockAdmin({ total, linked, missing }) {
  let fromCalls = 0;
  return {
    from: jest.fn(() => {
      fromCalls += 1;
      if (fromCalls === 1) {
        return {
          select: jest.fn().mockResolvedValue({ count: total, error: null }),
        };
      }
      return {
        select: jest.fn(() => ({
          not: jest.fn().mockResolvedValue({ count: linked, error: null }),
        })),
      };
    }),
    rpc: jest.fn().mockResolvedValue({ data: missing, error: null }),
  };
}
