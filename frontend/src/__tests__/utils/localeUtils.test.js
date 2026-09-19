import { localizePath, stripLocalePrefix } from '../../i18n/localeUtils';

describe('localeUtils catalog paths', () => {
  test('stripLocalePrefix canónico /catalogo desde EN y DE', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(stripLocalePrefix(`/en/catalog/${id}/porsche`)).toBe(`/catalogo/${id}/porsche`);
    expect(stripLocalePrefix(`/de/katalog/${id}/porsche`)).toBe(`/catalogo/${id}/porsche`);
    expect(stripLocalePrefix('/en/catalog')).toBe('/catalogo');
    expect(stripLocalePrefix('/catalogo/scalextric')).toBe('/catalogo/scalextric');
  });

  test('localizePath reconstruye la ficha equivalente', () => {
    const rest = '/catalogo/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/porsche';
    expect(localizePath('en', rest)).toBe('/en/catalog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/porsche');
    expect(localizePath('de', rest)).toBe('/de/katalog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/porsche');
    expect(localizePath('es', rest)).toBe(rest);
  });
});
