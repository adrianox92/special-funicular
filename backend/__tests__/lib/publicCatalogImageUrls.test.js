const { rewritePublicCatalogMediaUrls } = require('../../../frontend/src/utils/cachedStorageImageUrl');

const STORAGE =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp';
const PROXY = '/api/img/catalog-images/catalog/1710000000-ab12cd.webp';
const ABSOLUTE = `https://www.slotdatabase.es${PROXY}`;

describe('rewritePublicCatalogMediaUrls', () => {
  test('reescribe image_url de items, logo de brands y similares', () => {
    const payload = {
      id: 'item-1',
      reference: 'C1234',
      image_url: STORAGE,
      manufacturer_logo_url: STORAGE,
      items: [{ id: 'list-1', image_url: STORAGE, manufacturer_logo_url: STORAGE, reference: 'A1' }],
      brands: [{ id: 'brand-1', name: 'Ninco', logo_url: STORAGE }],
      similar: [
        {
          id: 'sim-1',
          reference: '50601',
          image_url: STORAGE,
          manufacturer_logo_url: STORAGE,
        },
      ],
    };

    const out = rewritePublicCatalogMediaUrls(payload);

    expect(out.image_url).toBe(PROXY);
    expect(out.manufacturer_logo_url).toBe(PROXY);
    expect(out.reference).toBe('C1234');
    expect(out.items[0].image_url).toBe(PROXY);
    expect(out.items[0].manufacturer_logo_url).toBe(PROXY);
    expect(out.items[0].reference).toBe('A1');
    expect(out.brands[0].logo_url).toBe(PROXY);
    expect(out.brands[0].name).toBe('Ninco');
    expect(out.similar[0].image_url).toBe(PROXY);
    expect(out.similar[0].manufacturer_logo_url).toBe(PROXY);
    expect(out.similar[0].reference).toBe('50601');
    expect(payload.similar[0].image_url).toBe(STORAGE);
  });

  test('con origin deja la URL absoluta del proxy', () => {
    const out = rewritePublicCatalogMediaUrls(
      { similar: [{ id: 'sim-1', image_url: STORAGE }] },
      { origin: 'https://www.slotdatabase.es/' },
    );
    expect(out.similar[0].image_url).toBe(ABSOLUTE);
  });

  test('no reescribe URLs que no son de Storage', () => {
    const out = rewritePublicCatalogMediaUrls({
      similar: [{ id: 'sim-1', image_url: 'https://cdn.example/a.jpg' }],
      items: [{ image_url: '' }],
      brands: [{ logo_url: null }],
    });
    expect(out.similar[0].image_url).toBe('https://cdn.example/a.jpg');
    expect(out.items[0].image_url).toBe('');
    expect(out.brands[0].logo_url).toBeNull();
  });
});
