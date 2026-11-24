/**
 * Configuración de Cloudflare R2 compartida por la API (Render) y /api/img (Vercel).
 *
 * R2_ACCOUNT_ID: 32 caracteres hex (Dashboard → R2 → Account details). Si se pega la URL
 * del endpoint S3 se extrae el ID. R2_JURISDICTION=eu|fedramp para buckets con jurisdicción;
 * si el endpoint pegado ya la incluye, se toma de ahí.
 */
const ACCOUNT_ID_RE = /^[0-9a-f]{32}$/;
const JURISDICTIONS = new Set(['eu', 'fedramp']);

function parseAccountInput(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const fromHost = s.match(/([0-9a-f]{32})(?:\.(eu|fedramp))?\.r2\.cloudflarestorage\.com/);
  if (fromHost) return { accountId: fromHost[1], jurisdiction: fromHost[2] || '' };
  return { accountId: s, jurisdiction: '' };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: true, accountId: string, accessKeyId: string, secretAccessKey: string, bucket: string, host: string, endpoint: string }
 *   | { ok: false, missing: boolean, reason: string }}
 */
function resolveR2Config(env = process.env) {
  const parsed = parseAccountInput(env.R2_ACCOUNT_ID);
  const accessKeyId = String(env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(env.R2_BUCKET || '').trim();
  if (!parsed.accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return { ok: false, missing: true, reason: 'faltan variables R2_*' };
  }
  if (!ACCOUNT_ID_RE.test(parsed.accountId)) {
    return { ok: false, missing: false, reason: 'R2_ACCOUNT_ID no tiene formato de Account ID (32 caracteres hex)' };
  }
  if (parsed.accountId === accessKeyId.toLowerCase()) {
    return { ok: false, missing: false, reason: 'R2_ACCOUNT_ID es igual a R2_ACCESS_KEY_ID; pon el Account ID de la cuenta' };
  }
  const jurisdiction = String(env.R2_JURISDICTION || parsed.jurisdiction || '').trim().toLowerCase();
  if (jurisdiction && !JURISDICTIONS.has(jurisdiction)) {
    return { ok: false, missing: false, reason: `R2_JURISDICTION no válida: ${jurisdiction}` };
  }
  const host = `${parsed.accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`;
  return {
    ok: true,
    accountId: parsed.accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    host,
    endpoint: `https://${host}`,
  };
}

/**
 * Traduce el fallo TLS que da Cloudflare cuando el host de la cuenta no existe.
 * @param {unknown} err
 * @param {string} host
 */
function describeR2Error(err, host) {
  const msg = String((err && err.message) || err || '');
  const code = err && err.code;
  if (code === 'EPROTO' || /handshake failure|alert number 40/i.test(msg)) {
    return new Error(
      `No se pudo conectar con R2 (${host}): revisa R2_ACCOUNT_ID (Account ID, no el Access Key ID) y R2_JURISDICTION si el bucket es de la UE`,
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

module.exports = {
  resolveR2Config,
  describeR2Error,
};
