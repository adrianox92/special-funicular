'use strict';

const crypto = require('crypto');
const { getServiceClient } = require('./supabaseClients');

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LEN = 256;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** In-process fallback when the table is missing or the DB write fails. */
const memoryStore = new Map();
const inFlight = new Map();

function nowMs() {
  return Date.now();
}

function pruneMemory(now = nowMs()) {
  for (const [k, row] of memoryStore) {
    if (row.expiresAt <= now) memoryStore.delete(k);
  }
}

function ownerScopeFromReq(req) {
  if (req.apiKeyContext?.type === 'club' && req.apiKeyContext.clubId) {
    return `club:${req.apiKeyContext.clubId}`;
  }
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return null;
}

function requestPath(req) {
  const raw = req.originalUrl || req.url || req.path || '';
  return String(raw).split('?')[0];
}

function requestFingerprint(req) {
  const method = String(req.method || '').toUpperCase();
  const path = requestPath(req);
  let body = '';
  try {
    body = JSON.stringify(req.body || {});
  } catch {
    body = '';
  }
  return crypto.createHash('sha256').update(`${method}\n${path}\n${body}`).digest('hex');
}

function parseIdempotencyKey(raw) {
  if (raw == null) return { key: null };
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return { key: null };
  const key = value.trim();
  if (!key) return { key: null };
  if (key.length > MAX_KEY_LEN) {
    return { error: 'Idempotency-Key demasiado larga (máx. 256)' };
  }
  return { key };
}

function memoryLookup(scope, key) {
  pruneMemory();
  const row = memoryStore.get(`${scope}\0${key}`);
  if (!row) return null;
  if (row.expiresAt <= nowMs()) {
    memoryStore.delete(`${scope}\0${key}`);
    return null;
  }
  return row;
}

function memorySave(scope, key, record) {
  memoryStore.set(`${scope}\0${key}`, {
    ...record,
    expiresAt: nowMs() + DEFAULT_TTL_MS,
  });
}

async function dbLookup(scope, key) {
  const sb = getServiceClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('sync_idempotency_keys')
      .select('method, path, request_fingerprint, status_code, response_body, expires_at')
      .eq('owner_scope', scope)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= nowMs()) return null;
    return {
      method: data.method,
      path: data.path,
      fingerprint: data.request_fingerprint,
      statusCode: data.status_code,
      body: data.response_body,
    };
  } catch {
    return null;
  }
}

async function dbSave(scope, key, record) {
  const sb = getServiceClient();
  if (!sb) return;
  const expiresAt = new Date(nowMs() + DEFAULT_TTL_MS).toISOString();
  try {
    await sb.from('sync_idempotency_keys').upsert(
      {
        owner_scope: scope,
        idempotency_key: key,
        method: record.method,
        path: record.path,
        request_fingerprint: record.fingerprint,
        status_code: record.statusCode,
        response_body: record.body,
        expires_at: expiresAt,
      },
      { onConflict: 'owner_scope,idempotency_key' },
    );
  } catch {
    // Memory store already holds the replay.
  }
}

async function lookupRecord(scope, key) {
  const mem = memoryLookup(scope, key);
  if (mem) return mem;
  const db = await dbLookup(scope, key);
  if (db) {
    memorySave(scope, key, db);
    return db;
  }
  return null;
}

async function saveRecord(scope, key, record) {
  memorySave(scope, key, record);
  await dbSave(scope, key, record);
}

function flightKey(scope, key) {
  return `${scope}\0${key}`;
}

/**
 * Additive: missing Idempotency-Key keeps current behavior.
 */
function syncIdempotencyMiddleware(req, res, next) {
  if (!MUTATING_METHODS.has(String(req.method || '').toUpperCase())) {
    return next();
  }

  const parsed = parseIdempotencyKey(req.headers['idempotency-key']);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  if (!parsed.key) return next();

  const scope = ownerScopeFromReq(req);
  if (!scope) return next();

  const fingerprint = requestFingerprint(req);
  const method = String(req.method).toUpperCase();
  const path = requestPath(req);
  const key = parsed.key;
  const lockId = flightKey(scope, key);

  const run = async () => {
    const existing = await lookupRecord(scope, key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return res.status(409).json({
          error: 'Idempotency-Key reutilizada con un cuerpo o ruta distinto',
        });
      }
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(existing.statusCode).json(existing.body);
    }

    if (inFlight.has(lockId)) {
      return res.status(409).json({
        error: 'Una petición con esta Idempotency-Key ya está en curso',
      });
    }
    inFlight.set(lockId, true);

    const originalJson = res.json.bind(res);
    res.json = function idempotentJson(body) {
      const statusCode = res.statusCode || 200;
      const shouldStore = statusCode < 500 && statusCode !== 429;
      const done = () => {
        inFlight.delete(lockId);
      };
      if (shouldStore) {
        const record = { method, path, fingerprint, statusCode, body };
        Promise.resolve(saveRecord(scope, key, record)).finally(done);
      } else {
        done();
      }
      return originalJson(body);
    };

    res.on('finish', () => {
      inFlight.delete(lockId);
    });

    return next();
  };

  run().catch((err) => {
    inFlight.delete(lockId);
    next(err);
  });
}

function resetIdempotencyStoreForTests() {
  memoryStore.clear();
  inFlight.clear();
}

module.exports = {
  DEFAULT_TTL_MS,
  MAX_KEY_LEN,
  ownerScopeFromReq,
  requestFingerprint,
  parseIdempotencyKey,
  syncIdempotencyMiddleware,
  resetIdempotencyStoreForTests,
};
