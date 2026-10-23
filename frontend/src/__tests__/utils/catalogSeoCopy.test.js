import esCatalog from '../../i18n/locales/es/catalog.json';
import enCatalog from '../../i18n/locales/en/catalog.json';
import deCatalog from '../../i18n/locales/de/catalog.json';
import {
  buildCatalogItemImageAlt,
  buildCatalogItemMetaDescription,
  buildCatalogItemPageTitle,
  buildItemJsonLd,
  buildPublicCatalogListMeta,
} from '../../utils/catalogSeoCopy';

function leafKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) return leafKeys(value, path);
    return [path];
  }).sort();
}

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

  const similar = [
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      manufacturer: 'Ninco',
      reference: '50601',
      model_name: 'Porsche 911 GT3',
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      manufacturer: 'Scalextric',
      reference: 'C3990',
      model_name: 'Porsche 911 GT3',
    },
  ];

  test('JSON-LD incluye ItemList e isSimilarTo cuando hay 2 o más', () => {
    const json = buildItemJsonLd({
      item: { ...item, similar },
      origin: 'https://www.slotdatabase.es',
      canonicalUrl: 'https://www.slotdatabase.es/catalogo/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/porsche-911-gt3',
      description: 'Ficha',
      locale: 'es',
    });
    const product = json['@graph'][1];
    const list = json['@graph'][2];
    expect(product.isSimilarTo).toEqual([
      'https://www.slotdatabase.es/catalogo/dddddddd-dddd-4ddd-8ddd-dddddddddddd/porsche-911-gt3',
      'https://www.slotdatabase.es/catalogo/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/porsche-911-gt3',
    ]);
    expect(list).toMatchObject({
      '@type': 'ItemList',
      name: 'Vehículos similares',
    });
    expect(list.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        url: product.isSimilarTo[0],
        name: 'Ninco · 50601 · Porsche 911 GT3',
      },
      {
        '@type': 'ListItem',
        position: 2,
        url: product.isSimilarTo[1],
        name: 'Scalextric · C3990 · Porsche 911 GT3',
      },
    ]);

    const en = buildItemJsonLd({
      item: { ...item, similar },
      origin: 'https://www.slotdatabase.es',
      canonicalUrl: 'https://www.slotdatabase.es/en/catalog/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/porsche-911-gt3',
      description: 'Listing',
      locale: 'en',
    });
    expect(en['@graph'][2].name).toBe('Similar vehicles');
    expect(en['@graph'][1].isSimilarTo[0]).toBe(
      'https://www.slotdatabase.es/en/catalog/dddddddd-dddd-4ddd-8ddd-dddddddddddd/porsche-911-gt3',
    );
  });

  test('JSON-LD omite similares si hay menos de 2', () => {
    const json = buildItemJsonLd({
      item: { ...item, similar: [similar[0]] },
      origin: 'https://www.slotdatabase.es',
      canonicalUrl: 'https://www.slotdatabase.es/catalogo/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/porsche-911-gt3',
      description: 'Ficha',
      locale: 'es',
    });
    expect(json['@graph']).toHaveLength(2);
    expect(json['@graph'][1].isSimilarTo).toBeUndefined();
  });

  test('claves de catálogo es/en/de coinciden, incluidos los similares', () => {
    const keys = leafKeys(esCatalog);
    expect(leafKeys(enCatalog)).toEqual(keys);
    expect(leafKeys(deCatalog)).toEqual(keys);
    expect(esCatalog.detail.similarTitle).toBe('Vehículos similares');
    expect(enCatalog.detail.similarAria).toBe('Similar vehicles carousel');
    expect(deCatalog.seo.similarTitle).toBe('Ähnliche Fahrzeuge');
  });

  test('listado filtrado localiza el recuento', () => {
    const en = buildPublicCatalogListMeta({ manufacturerName: 'Ninco', total: 2 }, 'en');
    expect(en.description).toMatch(/2 models/);
    expect(en.description).not.toMatch(/encontrados/);
    const es = buildPublicCatalogListMeta({ manufacturerName: 'Ninco', total: 2 }, 'es');
    expect(es.description).toMatch(/2 modelos/);
  });
});
