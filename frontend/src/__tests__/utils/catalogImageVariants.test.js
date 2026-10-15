const {
  withThumbSuffix,
  isThumbPath,
  catalogThumbUrl,
} = require('../../utils/catalogImageVariants');

const DETAIL =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp';

describe('catalogImageVariants', () => {
  test('añade -thumb antes de la extensión', () => {
    expect(withThumbSuffix('catalog/1710000000-ab12cd.webp')).toBe(
      'catalog/1710000000-ab12cd-thumb.webp',
    );
    expect(catalogThumbUrl(DETAIL)).toBe(
      'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd-thumb.webp',
    );
  });

  test('no duplica -thumb', () => {
    const thumb = catalogThumbUrl(DETAIL);
    expect(catalogThumbUrl(thumb)).toBe(thumb);
    expect(isThumbPath(thumb)).toBe(true);
  });

  test('variantes opt1400 también reciben sibling -thumb', () => {
    expect(withThumbSuffix('catalog/foo-opt1400.webp')).toBe('catalog/foo-opt1400-thumb.webp');
  });

  test('vacío o null', () => {
    expect(catalogThumbUrl('')).toBe('');
    expect(catalogThumbUrl(null)).toBe('');
  });

  test('funciona sobre URLs ya reescritas a /api/img (absoluta y relativa)', () => {
    expect(
      catalogThumbUrl(
        'https://www.slotdatabase.es/api/img/catalog-images/catalog/1710000000-ab12cd.webp',
      ),
    ).toBe(
      'https://www.slotdatabase.es/api/img/catalog-images/catalog/1710000000-ab12cd-thumb.webp',
    );
    expect(catalogThumbUrl('/api/img/catalog-images/catalog/1710000000-ab12cd.webp')).toBe(
      '/api/img/catalog-images/catalog/1710000000-ab12cd-thumb.webp',
    );
  });
});
