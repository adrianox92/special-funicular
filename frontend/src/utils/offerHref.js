const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

/** Mismo destino que «Ver en tienda»: el acortador /go/{code}. */
export function offerHref(shortCode) {
  if (!shortCode) return null;
  if (process.env.NODE_ENV === 'production') {
    return `/go/${encodeURIComponent(shortCode)}`;
  }
  const base = String(API_BASE).replace(/\/$/, '');
  return `${base}/go/${encodeURIComponent(shortCode)}`;
}
