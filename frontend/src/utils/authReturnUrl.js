/**
 * returnUrl seguro para login/registro (evita open redirect).
 */

export const AUTH_RETURN_STORAGE_KEY = 'slotdb-auth-return';

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeReturnUrl(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v.startsWith('/')) return false;
  if (v.startsWith('//')) return false;
  if (v.includes('\\')) return false;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(v)) return false;
  if (/[\s<>]/.test(v)) return false;
  return true;
}

/**
 * @param {URLSearchParams|null|undefined} searchParams
 * @param {{ storage?: Storage }} [opts]
 * @returns {string|null}
 */
export function resolveReturnUrl(searchParams, opts = {}) {
  const fromQuery = searchParams && typeof searchParams.get === 'function' ? searchParams.get('returnUrl') : null;
  if (isSafeReturnUrl(fromQuery)) return fromQuery.trim();
  try {
    const storage = opts.storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    const stored = storage ? storage.getItem(AUTH_RETURN_STORAGE_KEY) : null;
    if (isSafeReturnUrl(stored)) return stored.trim();
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {string|null|undefined} returnUrl
 * @param {{ storage?: Storage }} [opts]
 */
export function persistReturnUrl(returnUrl, opts = {}) {
  try {
    const storage = opts.storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    if (!storage) return;
    if (isSafeReturnUrl(returnUrl)) storage.setItem(AUTH_RETURN_STORAGE_KEY, returnUrl.trim());
    else storage.removeItem(AUTH_RETURN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ storage?: Storage }} [opts]
 */
export function clearStoredReturnUrl(opts = {}) {
  try {
    const storage = opts.storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    storage?.removeItem(AUTH_RETURN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ register?: boolean, returnUrl?: string|null, intent?: string|null }} [opts]
 * @returns {string}
 */
export function buildLoginPath(opts = {}) {
  const params = new URLSearchParams();
  if (opts.register) params.set('register', 'true');
  if (isSafeReturnUrl(opts.returnUrl)) params.set('returnUrl', opts.returnUrl.trim());
  if (opts.intent) params.set('intent', String(opts.intent));
  const q = params.toString();
  return q ? `/login?${q}` : '/login';
}

/**
 * Combina el path actual con un intent para volver a la ficha tras el auth.
 * @param {string} pathname
 * @param {string} [search]
 * @param {string} [intent]
 */
export function withIntent(pathname, search = '', intent) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (intent) params.set('intent', intent);
  else params.delete('intent');
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}
