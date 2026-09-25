'use strict';

const { generateApiKey, buildStoredKeyFields } = require('./apiKeyGenerate');

function isMissingTable(error) {
  return error && error.code === '42P01';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} clubId
 */
async function getClubApiKeyMeta(supabase, clubId) {
  const { data, error } = await supabase
    .from('club_api_keys')
    .select('id, club_id, key_prefix, created_at, last_used_at, created_by')
    .eq('club_id', clubId)
    .maybeSingle();
  if (error) return { error, row: null };
  return { error: null, row: data || null };
}

/**
 * Create or rotate the single club/station key (v1: one key per club).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} clubId
 * @param {string} createdBy
 */
async function rotateClubApiKey(supabase, clubId, createdBy) {
  const plain = generateApiKey();
  let fields;
  try {
    fields = buildStoredKeyFields(plain, {
      club_id: clubId,
      created_by: createdBy || null,
    });
  } catch (encErr) {
    return {
      error: {
        status: 503,
        message: encErr.message || 'API_KEY_ENCRYPT_SECRET no configurada correctamente',
        cause: encErr,
      },
    };
  }

  const existing = await getClubApiKeyMeta(supabase, clubId);
  if (existing.error) return { error: existing.error };

  if (!existing.row) {
    const { data, error } = await supabase
      .from('club_api_keys')
      .insert([fields])
      .select('id, key_prefix, created_at')
      .single();
    if (error) return { error };
    return { error: null, api_key: plain, row: data, created: true };
  }

  const { data, error } = await supabase
    .from('club_api_keys')
    .update({
      api_key_hash: fields.api_key_hash,
      api_key_enc: fields.api_key_enc,
      key_prefix: fields.key_prefix,
      created_by: createdBy || existing.row.created_by,
    })
    .eq('id', existing.row.id)
    .select('id, key_prefix, created_at')
    .single();
  if (error) return { error };
  return { error: null, api_key: plain, row: data, created: false };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} apiKeyHash
 */
async function findClubApiKeyByHash(supabase, apiKeyHash) {
  const { data, error } = await supabase
    .from('club_api_keys')
    .select('id, club_id, created_by, last_used_at')
    .eq('api_key_hash', apiKeyHash)
    .maybeSingle();
  if (error) return { error, row: null };
  return { error: null, row: data || null };
}

module.exports = {
  isMissingTable,
  getClubApiKeyMeta,
  rotateClubApiKey,
  findClubApiKeyByHash,
};
