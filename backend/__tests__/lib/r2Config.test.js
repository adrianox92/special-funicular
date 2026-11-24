const { resolveR2Config, describeR2Error } = require('../../../frontend/api/_lib/r2Config');

const ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const BASE = {
  R2_ACCOUNT_ID: ID,
  R2_ACCESS_KEY_ID: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'slotdatabase-images',
};

describe('resolveR2Config', () => {
  test('Account ID válido da el endpoint de la cuenta', () => {
    expect(resolveR2Config(BASE)).toMatchObject({
      ok: true,
      accountId: ID,
      host: `${ID}.r2.cloudflarestorage.com`,
      endpoint: `https://${ID}.r2.cloudflarestorage.com`,
    });
  });

  test('extrae el ID y la jurisdicción si se pega la URL del endpoint', () => {
    expect(resolveR2Config({ ...BASE, R2_ACCOUNT_ID: `https://${ID.toUpperCase()}.r2.cloudflarestorage.com/slotdatabase-images` }))
      .toMatchObject({ ok: true, host: `${ID}.r2.cloudflarestorage.com` });
    expect(resolveR2Config({ ...BASE, R2_ACCOUNT_ID: `https://${ID}.eu.r2.cloudflarestorage.com` })).toMatchObject({
      ok: true,
      host: `${ID}.eu.r2.cloudflarestorage.com`,
    });
  });

  test('R2_JURISDICTION=eu usa el endpoint europeo', () => {
    expect(resolveR2Config({ ...BASE, R2_JURISDICTION: 'EU' })).toMatchObject({
      ok: true,
      host: `${ID}.eu.r2.cloudflarestorage.com`,
    });
    expect(resolveR2Config({ ...BASE, R2_JURISDICTION: 'mars' })).toMatchObject({ ok: false, missing: false });
  });

  test('rechaza formatos que no son un Account ID', () => {
    for (const bad of ['acc123', 'cfat_XXXXXXXXXXXXXXXX', `${ID}0`]) {
      expect(resolveR2Config({ ...BASE, R2_ACCOUNT_ID: bad })).toMatchObject({ ok: false, missing: false });
    }
  });

  test('detecta el Access Key ID pegado como Account ID', () => {
    const out = resolveR2Config({ ...BASE, R2_ACCOUNT_ID: BASE.R2_ACCESS_KEY_ID });
    expect(out).toMatchObject({ ok: false, missing: false });
    expect(out.reason).toMatch(/R2_ACCESS_KEY_ID/);
  });

  test('variables vacías cuentan como no configurado', () => {
    expect(resolveR2Config({ ...BASE, R2_BUCKET: '' })).toMatchObject({ ok: false, missing: true });
  });
});

describe('describeR2Error', () => {
  test('traduce el handshake failure de Cloudflare', () => {
    const tls = Object.assign(
      new Error('write EPROTO C07C:error:0A000410:SSL routines:ssl3_read_bytes:sslv3 alert handshake failure:SSL alert number 40'),
      { code: 'EPROTO' },
    );
    expect(describeR2Error(tls, `${ID}.r2.cloudflarestorage.com`).message).toMatch(/revisa R2_ACCOUNT_ID/);
  });

  test('deja pasar otros errores', () => {
    const other = new Error('AccessDenied');
    expect(describeR2Error(other, 'h')).toBe(other);
  });
});
