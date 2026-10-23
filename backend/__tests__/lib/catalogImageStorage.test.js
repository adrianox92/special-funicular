const {
  catalogStoragePathFromPublicUrl,
  thumbStoragePathFromDetailPath,
  CATALOG_IMAGES_BUCKET,
} = require('../../lib/catalogImageStorage');

describe('catalogStoragePathFromPublicUrl', () => {
  it('extrae la clave tras el nombre del bucket', () => {
    const url = `https://abc.supabase.co/storage/v1/object/public/${CATALOG_IMAGES_BUCKET}/catalog/foo.webp`;
    expect(catalogStoragePathFromPublicUrl(url)).toBe('catalog/foo.webp');
  });

  it('ignora query string', () => {
    const url = `https://x.test/${CATALOG_IMAGES_BUCKET}/catalog/a.jpg?token=1`;
    expect(catalogStoragePathFromPublicUrl(url)).toBe('catalog/a.jpg');
  });

  it('devuelve null si no coincide el bucket', () => {
    expect(catalogStoragePathFromPublicUrl('https://evil.test/other-bucket/path')).toBeNull();
  });

  it('devuelve null para entrada vacía', () => {
    expect(catalogStoragePathFromPublicUrl('')).toBeNull();
    expect(catalogStoragePathFromPublicUrl(null)).toBeNull();
  });
});

describe('thumbStoragePathFromDetailPath', () => {
  it('añade -thumb al objeto de detalle', () => {
    expect(thumbStoragePathFromDetailPath('catalog/foo.webp')).toBe('catalog/foo-thumb.webp');
  });

  it('no genera sibling de un thumb', () => {
    expect(thumbStoragePathFromDetailPath('catalog/foo-thumb.webp')).toBeNull();
  });
});
