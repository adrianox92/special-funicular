import {
  aliasesFormFromItem,
  aliasesPayloadFromForm,
  emptyCatalogAlias,
} from '../../data/catalogAliases';

describe('catalogAliases form helpers', () => {
  test('aliasesPayloadFromForm omite filas vacías y recorta campos', () => {
    expect(
      aliasesPayloadFromForm([
        emptyCatalogAlias(),
        {
          alias_reference: ' a10068x300 ',
          alias_type: 'market',
          market: ' int ',
          brand_label: ' SCX ',
          ean: ' 8436572913349 ',
          source: ' scu ',
          source_url: ' https://example.com ',
        },
      ]),
    ).toEqual([
      {
        alias_reference: 'a10068x300',
        alias_type: 'market',
        market: 'int',
        brand_label: 'SCX',
        ean: '8436572913349',
        source: 'scu',
        source_url: 'https://example.com',
      },
    ]);
  });

  test('aliasesFormFromItem mapea la respuesta del API', () => {
    expect(
      aliasesFormFromItem({
        aliases: [{ id: '1', alias_reference: 'SU10616', alias_type: 'short', ean: '1' }],
      }),
    ).toEqual([
      expect.objectContaining({
        id: '1',
        alias_reference: 'SU10616',
        alias_type: 'short',
        ean: '1',
      }),
    ]);
  });
});
