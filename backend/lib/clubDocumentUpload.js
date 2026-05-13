const CLUB_DOCUMENTS_BUCKET = 'club-documents';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} clubId
 * @param {Buffer} buffer
 * @param {string} originalName
 * @returns {Promise<{ publicUrl: string, storagePath: string }>}
 */
async function uploadClubPdf(supabase, clubId, buffer, originalName) {
  const safe = String(originalName || 'document.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  const filePath = `clubs/${clubId}/${Date.now()}-${safe.endsWith('.pdf') ? safe : `${safe}.pdf`}`;
  const { error } = await supabase.storage.from(CLUB_DOCUMENTS_BUCKET).upload(filePath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(CLUB_DOCUMENTS_BUCKET).getPublicUrl(filePath);
  return { publicUrl: data.publicUrl, storagePath: filePath };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null|undefined} storagePath
 */
async function removeClubDocument(supabase, storagePath) {
  if (!storagePath) return;
  const { error } = await supabase.storage.from(CLUB_DOCUMENTS_BUCKET).remove([storagePath]);
  if (error) console.error('[clubDocumentUpload] remove', error.message);
}

module.exports = {
  CLUB_DOCUMENTS_BUCKET,
  uploadClubPdf,
  removeClubDocument,
};
