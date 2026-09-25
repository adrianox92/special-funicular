'use strict';

const { MAX_USER_API_KEYS, generateApiKey, normalizeKeyName, buildStoredKeyFields } = require('./apiKeyGenerate');

function isMissingTable(error) {
  return error && error.code === '42P01';
}

function activeRows(rows) {
  return (rows || []).filter((row) => !row.revoked_at);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function listUserApiKeys(supabase, userId) {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id, user_id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return { error, keys: [] };
  return { error: null, keys: data || [] };
}

/**
 * Oldest non-revoked key (the "default" used by GET /me and login).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function getDefaultUserApiKey(supabase, userId, { includeSecretCols } = {}) {
  const select = includeSecretCols
    ? 'id, user_id, name, key_prefix, api_key_hash, api_key_enc, created_at, last_used_at, revoked_at'
    : 'id, user_id, name, key_prefix, created_at, last_used_at, revoked_at';
  const { data, error } = await supabase
    .from('user_api_keys')
    .select(select)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) return { error, key: null, active: [] };
  const active = activeRows(data);
  return { error: null, key: active[0] || null, active, all: data || [] };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ name?: string|null }} [opts]
 */
async function createUserApiKey(supabase, userId, opts = {}) {
  const listed = await listUserApiKeys(supabase, userId);
  if (listed.error) return { error: listed.error };
  const activeCount = listed.keys.filter((k) => !k.revoked_at).length;
  if (activeCount >= MAX_USER_API_KEYS) {
    return { error: { status: 400, message: `Máximo de ${MAX_USER_API_KEYS} API keys activas` } };
  }

  const plain = generateApiKey();
  let fields;
  try {
    fields = buildStoredKeyFields(plain, {
      user_id: userId,
      name: normalizeKeyName(opts.name),
    });
  } catch (encErr) {
    return { error: { status: 503, message: encErr.message || 'API_KEY_ENCRYPT_SECRET no configurada correctamente', cause: encErr } };
  }

  const { data, error } = await supabase
    .from('user_api_keys')
    .insert([fields])
    .select('id, name, key_prefix, created_at')
    .single();
  if (error) return { error };
  return { error: null, api_key: plain, row: data };
}

/**
 * Rotate the default (oldest active) key. Additional keys are left intact.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
async function rotateDefaultUserApiKey(supabase, userId) {
  const { error: fetchError, key, active } = await getDefaultUserApiKey(supabase, userId, {
    includeSecretCols: true,
  });
  if (fetchError) return { error: fetchError };

  const plain = generateApiKey();
  let fields;
  try {
    fields = buildStoredKeyFields(plain);
  } catch (encErr) {
    return { error: { status: 503, message: encErr.message || 'API_KEY_ENCRYPT_SECRET no configurada correctamente', cause: encErr } };
  }

  if (!key) {
    const { data, error } = await supabase
      .from('user_api_keys')
      .insert([{ user_id: userId, ...fields }])
      .select('id, name, key_prefix, created_at')
      .single();
    if (error) return { error };
    return { error: null, api_key: plain, row: data, created: true };
  }

  const { data, error } = await supabase
    .from('user_api_keys')
    .update({
      api_key_hash: fields.api_key_hash,
      api_key_enc: fields.api_key_enc,
      key_prefix: fields.key_prefix,
      revoked_at: null,
    })
    .eq('id', key.id)
    .select('id, name, key_prefix, created_at')
    .single();
  if (error) return { error };
  return { error: null, api_key: plain, row: data, created: false, remaining_active: active.length };
}

/**
 * Soft-revoke. At least one active key must remain.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} keyId
 */
async function revokeUserApiKey(supabase, userId, keyId) {
  const listed = await listUserApiKeys(supabase, userId);
  if (listed.error) return { error: listed.error };
  const target = listed.keys.find((k) => k.id === keyId);
  if (!target || target.revoked_at) {
    return { error: { status: 404, message: 'API key no encontrada' } };
  }
  const activeCount = listed.keys.filter((k) => !k.revoked_at).length;
  if (activeCount <= 1) {
    return { error: { status: 400, message: 'Debe quedar al menos una API key activa' } };
  }

  const revokedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('user_api_keys')
    .update({ revoked_at: revokedAt })
    .eq('id', keyId)
    .eq('user_id', userId)
    .select('id, revoked_at')
    .single();
  if (error) return { error };
  return { error: null, row: data };
}

function publicKeyListItem(row) {
  return {
    id: row.id,
    name: row.name || null,
    key_prefix: row.key_prefix || null,
    created_at: row.created_at,
    last_used_at: row.last_used_at || null,
    revoked_at: row.revoked_at || null,
  };
}

module.exports = {
  MAX_USER_API_KEYS,
  isMissingTable,
  listUserApiKeys,
  getDefaultUserApiKey,
  createUserApiKey,
  rotateDefaultUserApiKey,
  revokeUserApiKey,
  publicKeyListItem,
};
