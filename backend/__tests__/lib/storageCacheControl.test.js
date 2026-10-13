const {
  STORAGE_CACHE_CONTROL_SECONDS,
  STORAGE_UPLOAD_CACHE,
  isLongLivedCacheControl,
} = require('../../lib/storageCacheControl');

describe('storageCacheControl', () => {
  it('usa un año en segundos', () => {
    expect(STORAGE_CACHE_CONTROL_SECONDS).toBe('31536000');
    expect(STORAGE_UPLOAD_CACHE.cacheControl).toBe('31536000');
  });

  it('detecta cacheControl largo', () => {
    expect(isLongLivedCacheControl('31536000')).toBe(true);
    expect(isLongLivedCacheControl('public, max-age=31536000, immutable')).toBe(true);
    expect(isLongLivedCacheControl('max-age=3600')).toBe(false);
    expect(isLongLivedCacheControl('no-cache')).toBe(false);
    expect(isLongLivedCacheControl('')).toBe(false);
  });
});
