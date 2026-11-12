const STORAGE_KEY = 'slotdb_marketing_consent_pending';

export function stashPendingMarketingConsent(consented) {
  try {
    localStorage.setItem(STORAGE_KEY, consented ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekPendingMarketingConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    return raw === '1';
  } catch {
    return null;
  }
}

/** Devuelve true/false si había una elección pendiente, o null. */
export function consumePendingMarketingConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    localStorage.removeItem(STORAGE_KEY);
    return raw === '1';
  } catch {
    return null;
  }
}

/**
 * El alta solo escribe opt-in si el usuario lo pidió y aún no hay
 * preferencia guardada. No reactiva un consentimiento ya retirado.
 */
export function shouldWriteSignupOptIn(existing, pending, metaOptIn) {
  const wantsOptIn = pending === true || metaOptIn === true;
  if (!wantsOptIn) return false;
  if (existing && existing.updated_at) return false;
  return true;
}
