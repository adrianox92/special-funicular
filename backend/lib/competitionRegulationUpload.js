const REGULATION_BUCKET = 'competition-regulations';
const REGULATION_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
function normalizeRegulationUrl(url) {
  if (url == null || url === '') return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * @param {string} mimeType
 */
function isAllowedRegulationMime(mimeType) {
  return ALLOWED_MIMES.has(mimeType);
}

/**
 * @param {string} originalName
 */
function resolveContentType(originalName, mimeType) {
  if (mimeType && isAllowedRegulationMime(mimeType)) return mimeType;
  const ext = String(originalName || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  return (ext && MIME_BY_EXT[ext]) || 'application/pdf';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null|undefined} storagePath
 */
function getRegulationPublicUrl(supabase, storagePath) {
  if (!storagePath) return null;
  const { data } = supabase.storage.from(REGULATION_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} row
 */
function appendRegulationFileUrl(supabase, row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    regulation_file_url: getRegulationPublicUrl(supabase, row.regulation_file_path),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 * @param {Buffer} params.buffer
 * @param {string} params.originalName
 * @param {string} [params.mimeType]
 * @param {string} params.competitionId
 * @param {string} [params.categoryId]
 * @returns {Promise<{ publicUrl: string, storagePath: string, fileName: string }>}
 */
async function uploadRegulationFile(
  supabase,
  { buffer, originalName, mimeType, competitionId, categoryId }
) {
  const safe = String(originalName || 'reglamento.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  const contentType = resolveContentType(safe, mimeType);
  const prefix = categoryId
    ? `competitions/${competitionId}/categories/${categoryId}`
    : `competitions/${competitionId}/regulation`;
  const storagePath = `${prefix}/${Date.now()}-${safe}`;

  const { error } = await supabase.storage.from(REGULATION_BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const publicUrl = getRegulationPublicUrl(supabase, storagePath);
  return { publicUrl, storagePath, fileName: safe };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null|undefined} storagePath
 */
async function removeRegulationFile(supabase, storagePath) {
  if (!storagePath) return;
  const { error } = await supabase.storage.from(REGULATION_BUCKET).remove([storagePath]);
  if (error) console.error('[competitionRegulationUpload] remove', error.message);
}

module.exports = {
  REGULATION_BUCKET,
  REGULATION_MAX_BYTES,
  ALLOWED_MIMES,
  normalizeRegulationUrl,
  isAllowedRegulationMime,
  getRegulationPublicUrl,
  appendRegulationFileUrl,
  uploadRegulationFile,
  removeRegulationFile,
};
