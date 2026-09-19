import {
  buildCatalogItemImageAlt,
  buildCatalogItemMetaDescription,
  buildCatalogItemPageTitle,
  buildItemJsonLd,
  buildPublicCatalogListMeta,
} from '../../utils/catalogSeoCopy';

const item = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  model_name: 'Porsche 911 GT3',
  manufacturer: 'Scalextric',
  reference: 'C1234',
  vehicle_type: 'GT',
  traction: '4WD',
  commercial_release_year: 2024,
};

describe('catalogSeoCopy locale', () => {
  test('EN meta description no usa copy en español', () => {
    const desc = buildCatalogItemMetaDescription(item, 'en');
    expect(desc).toContain('slot car');
    expect(desc).toContain('C1234');
    expect(desc).toContain('Slot Database');
    expect(desc).not.toMatch(/coche slot/i);
    expect(desc).not.toMatch(/tracci[oó]n/i);
    expect(desc).not.toMatch(/catálogo público/i);
    expect(desc.toLowerCase()).toContain('traction');
    expect(desc.toLowerCase()).toContain('year');
  });

  test('DE meta description no usa copy en español', () => {
    const desc = buildCatalogItemMetaDescription(item, 'de');
    expect(desc).toContain('Slotcar');
    expect(desc).not.toMatch(/coche slot/i);
    expect(desc).not.toMatch(/tracci[oó]n/i);
    expect(desc).toContain('Antrieb');
    expect(desc).toContain('Jahr');
  });

  test('ES sigue usando copy en español', () => {
    const desc = buildCatalogItemMetaDescription(item, 'es');
    expect(desc).toMatch(/coche slot/i);
    expect(desc).toMatch(/tracci[oó]n/i);
  });

  test('image alt y título siguen el locale', () => {
    expect(buildCatalogItemImageAlt(item, 'en')).toMatch(/^Slot car,/);
    expect(buildCatalogItemImageAlt(item, 'de')).toMatch(/^Slotcar,/);
    expect(buildCatalogItemImageAlt(item, 'es')).toMatch(/^Coche slot,/);
    expect(buildCatalogItemPageTitle(item, 'en')).toContain('Slot Database');
    expect(buildCatalogItemPageTitle(item, 'en')).toContain('C1234');
  });

  test('JSON-LD breadcrumbs localizados', () => {
    const json = buildItemJsonLd({
      item,
      origin: 'https://www.slotdatabase.es',
      canonicalUrl: 'https://www.slotdatabase.es/en/catalog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/porsche-911-gt3',
      description: 'Slot car listing',
      locale: 'en',
    });
    const crumbs = json['@graph'][0].itemListElement;
    expect(crumbs[0].name).toBe('Home');
    expect(crumbs[1].name).toBe('Slot car reference catalog');
    expect(crumbs[0].item).toBe('https://www.slotdatabase.es/en');
    expect(json['@graph'][1].description).toBe('Slot car listing');
  });

  test('listado filtrado localiza el recuento', () => {
    const en = buildPublicCatalogListMeta({ manufacturerName: 'Ninco', total: 2 }, 'en');
    expect(en.description).toMatch(/2 models/);
    expect(en.description).not.toMatch(/encontrados/);
    const es = buildPublicCatalogListMeta({ manufacturerName: 'Ninco', total: 2 }, 'es');
    expect(es.description).toMatch(/2 modelos/);
  });
});
