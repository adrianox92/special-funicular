/**
 * AES-256-GCM encrypt/decrypt for API keys.
 *
 * Requires env var API_KEY_ENCRYPT_SECRET — a 64-char hex string (32 bytes).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Stored format (base64): [ IV (12 bytes) | Auth tag (16 bytes) | Ciphertext ]
 */
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const ALGO = 'aes-256-gcm';

function getSecret() {
  const hex = process.env.API_KEY_ENCRYPT_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error('API_KEY_ENCRYPT_SECRET must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

function encryptApiKey(plain) {
  const secret = getSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, secret, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptApiKey(encoded) {
  const secret = getSecret();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, secret, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

module.exports = { encryptApiKey, decryptApiKey };
