import {
  buildLoginPath,
  isSafeReturnUrl,
  persistReturnUrl,
  resolveReturnUrl,
  AUTH_RETURN_STORAGE_KEY,
  withIntent,
} from '../../utils/authReturnUrl';

describe('authReturnUrl', () => {
  test('acepta paths relativos seguros', () => {
    expect(isSafeReturnUrl('/catalogo/abc/foo')).toBe(true);
    expect(isSafeReturnUrl('/en/catalog/abc/foo?intent=rate')).toBe(true);
  });

  test('rechaza open redirects', () => {
    expect(isSafeReturnUrl('https://evil.example')).toBe(false);
    expect(isSafeReturnUrl('//evil.example')).toBe(false);
    expect(isSafeReturnUrl('/\\evil')).toBe(false);
    expect(isSafeReturnUrl('javascript:alert(1)')).toBe(false);
  });

  test('buildLoginPath prioriza registro y returnUrl', () => {
    expect(buildLoginPath({ register: true, returnUrl: '/catalogo/x/y' })).toBe(
      '/login?register=true&returnUrl=%2Fcatalogo%2Fx%2Fy',
    );
  });

  test('resolveReturnUrl lee query y storage', () => {
    const store = {
      data: {},
      getItem(k) { return this.data[k] ?? null; },
      setItem(k, v) { this.data[k] = v; },
      removeItem(k) { delete this.data[k]; },
    };
    persistReturnUrl('/de/katalog/a/b', { storage: store });
    expect(store.data[AUTH_RETURN_STORAGE_KEY]).toBe('/de/katalog/a/b');
    const params = new URLSearchParams('returnUrl=%2Fen%2Fcatalog%2Fx');
    expect(resolveReturnUrl(params, { storage: store })).toBe('/en/catalog/x');
  });

  test('withIntent conserva el path y añade intent', () => {
    expect(withIntent('/catalogo/id/slug', '', 'addToGarage')).toBe(
      '/catalogo/id/slug?intent=addToGarage',
    );
  });
});
