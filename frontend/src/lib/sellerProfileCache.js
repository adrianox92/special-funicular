/** Caché en memoria: evita GET /store-listings/my/profile al remontar Navbar en cada ruta. */
let cache = { userId: null, hasProfile: false, loaded: false };

export function getCachedSellerProfile(userId) {
  if (!userId || cache.userId !== userId || !cache.loaded) return null;
  return cache.hasProfile;
}

export function setCachedSellerProfile(userId, hasProfile) {
  cache = { userId, hasProfile: Boolean(hasProfile), loaded: true };
}

export function invalidateSellerProfileCache() {
  cache = { userId: null, hasProfile: false, loaded: false };
}
