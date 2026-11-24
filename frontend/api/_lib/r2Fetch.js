/**
 * Lectura de objetos del bucket privado de Cloudflare R2 con firma AWS SigV4 (GET, payload sin firmar).
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 * Basta un token de solo lectura sobre el bucket.
 */
const crypto = require('crypto');

const REGION = 'auto';
const SERVICE = 's3';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

function r2ReadConfig(env = process.env) {
  const accountId = String(env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(env.R2_BUCKET || '').trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeS3PathSegment(seg) {
  return encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function amzDates(now) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * URL y cabeceras firmadas para GET de `<logicalBucket>/<objectPath>` en R2.
 * @param {{ accountId: string, accessKeyId: string, secretAccessKey: string, bucket: string }} cfg
 * @param {string} logicalBucket
 * @param {string} objectPath
 * @param {Date} [now]
 */
function signR2GetRequest(cfg, logicalBucket, objectPath, now = new Date()) {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const key = `${logicalBucket}/${objectPath}`;
  const canonicalUri = `/${[cfg.bucket, ...key.split('/')].map(encodeS3PathSegment).join('/')}`;
  const { amzDate, dateStamp } = amzDates(now);
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'GET',
    canonicalUri,
    '',
    `host:${host}`,
    `x-amz-content-sha256:${UNSIGNED_PAYLOAD}`,
    `x-amz-date:${amzDate}`,
    '',
    signedHeaders,
    UNSIGNED_PAYLOAD,
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, dateStamp), REGION), SERVICE),
    'aws4_request',
  );
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      'x-amz-content-sha256': UNSIGNED_PAYLOAD,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/**
 * @param {string} logicalBucket
 * @param {string} objectPath
 * @param {{ env?: NodeJS.ProcessEnv, signal?: AbortSignal }} [opts]
 * @returns {Promise<Response|null>} null si R2 no está configurado
 */
async function fetchR2Object(logicalBucket, objectPath, opts = {}) {
  const cfg = r2ReadConfig(opts.env || process.env);
  if (!cfg) return null;
  const signed = signR2GetRequest(cfg, logicalBucket, objectPath);
  return fetch(signed.url, {
    method: 'GET',
    redirect: 'manual',
    headers: signed.headers,
    signal: opts.signal,
  });
}

module.exports = {
  r2ReadConfig,
  signR2GetRequest,
  fetchR2Object,
};
