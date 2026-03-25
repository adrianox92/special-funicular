const crypto = require('crypto');

/**
 * SHA-256 hex digest of the API key (UTF-8), for storage and lookup.
 * Must match PostgreSQL: encode(digest(api_key, 'sha256'), 'hex') with pgcrypto.
 */
function hashApiKey(plain) {
  if (plain == null || typeof plain !== 'string') {
    throw new TypeError('API key must be a non-null string');
  }
  return crypto.createHash('sha256').update(plain.trim(), 'utf8').digest('hex');
}

module.exports = { hashApiKey };
