const { sendPromoRedeemedEmail } = require('../../lib/promoRedeemMailer');

describe('sendPromoRedeemedEmail', () => {
  const originalEnv = process.env;
  let fetchMock;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 're_test';
    process.env.LICENSE_ADMIN_EMAILS = 'admin@example.com, other@example.com';
    process.env.RESEND_FROM = 'Slot Database <hello@example.com>';
    process.env.FRONTEND_URL = 'https://slotdatabase.example';
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

  it('skips when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendPromoRedeemedEmail({
      promoId: 1,
      code: 'ABCD-EFGH-IJKL',
      assignedEmail: 'user@example.com',
    });
    expect(result).toEqual({ ok: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips when LICENSE_ADMIN_EMAILS is empty', async () => {
    process.env.LICENSE_ADMIN_EMAILS = '';
    const result = await sendPromoRedeemedEmail({
      promoId: 1,
      code: 'ABCD-EFGH-IJKL',
      assignedEmail: 'user@example.com',
    });
    expect(result).toEqual({ ok: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a Resend email to license admins', async () => {
    const result = await sendPromoRedeemedEmail({
      promoId: 42,
      code: 'ABCD-EFGH-IJKL',
      assignedEmail: 'piloto@example.com',
      userId: 'user-123',
      note: 'Reviewer iOS',
      redeemedAt: '2026-09-15T10:00:00.000Z',
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer re_test');
    expect(options.headers['Idempotency-Key']).toBe('promo-redeemed/42');

    const body = JSON.parse(options.body);
    expect(body.from).toBe('Slot Database <hello@example.com>');
    expect(body.to).toEqual(['admin@example.com', 'other@example.com']);
    expect(body.subject).toContain('piloto@example.com');
    expect(body.html).toContain('ABCD-EFGH-IJKL');
    expect(body.html).toContain('piloto@example.com');
    expect(body.html).toContain('Reviewer iOS');
    expect(body.html).toContain('https://slotdatabase.example/admin/lap-timer-licenses');
    expect(body.text).toContain('ABCD-EFGH-IJKL');
  });

  it('escapes HTML in user-provided fields', async () => {
    await sendPromoRedeemedEmail({
      promoId: 7,
      code: 'AAAA-BBBB-CCCC',
      assignedEmail: 'a<b>@example.com',
      note: '<script>alert(1)</script>',
      userId: 'id"><img>',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.html).not.toContain('<script>');
    expect(body.html).toContain('&lt;script&gt;');
    expect(body.html).toContain('a&lt;b&gt;@example.com');
  });

  it('returns ok:false when Resend fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    });

    const result = await sendPromoRedeemedEmail({
      promoId: 1,
      code: 'ABCD-EFGH-IJKL',
      assignedEmail: 'user@example.com',
    });
    expect(result).toEqual({ ok: false });
  });
});
