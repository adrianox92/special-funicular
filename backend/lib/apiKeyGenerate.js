'use strict';

const crypto = require('crypto');
const { hashApiKey } = require('./apiKeyHash');
const { encryptApiKey } = require('./apiKeyEncrypt');

const MAX_USER_API_KEYS = 8;
const KEY_PREFIX_LEN = 8;
const MAX_KEY_NAME_LEN = 80;

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function keyPrefix(plain) {
  return String(plain).trim().slice(0, KEY_PREFIX_LEN);
}

function normalizeKeyName(name) {
  if (name == null) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_KEY_NAME_LEN);
}

function buildStoredKeyFields(plain, extras = {}) {
  return {
    api_key_hash: hashApiKey(plain),
    api_key_enc: encryptApiKey(plain),
    key_prefix: keyPrefix(plain),
    ...extras,
  };
}

module.exports = {
  MAX_USER_API_KEYS,
  KEY_PREFIX_LEN,
  MAX_KEY_NAME_LEN,
  generateApiKey,
  keyPrefix,
  normalizeKeyName,
  buildStoredKeyFields,
};
