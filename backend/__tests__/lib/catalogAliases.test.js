const {
  parseAliasesFromBody,
  parseEanFromBody,
  catalogSearchOrClause,
  catalogReferenceOrClause,
  parseImportAliases,
} = require('../../lib/catalogAliases');

describe('catalogAliases parsers', () => {
  test('parseEanFromBody trata vacío como null y rechaza textos largos', () => {
    expect(parseEanFromBody(undefined).provided).toBe(false);
    expect(parseEanFromBody('').value).toBeNull();
    expect(parseEanFromBody(' 8436572913332 ').value).toBe('8436572913332');
    expect(parseEanFromBody('x'.repeat(33)).ok).toBe(false);
  });

  test('parseAliasesFromBody acepta JSON string y normaliza la referencia', () => {
    const parsed = parseAliasesFromBody({
      aliases: JSON.stringify([
        {
          alias_reference: 'a10068x300',
          alias_type: 'market',
          market: 'int',
          ean: '8436572910000',
          brand_label: 'SCX',
        },
      ]),
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.provided).toBe(true);
    expect(parsed.aliases).toEqual([
      expect.objectContaining({
        alias_reference: 'A10068X300',
        alias_type: 'market',
        market: 'INT',
        ean: '8436572910000',
        brand_label: 'SCX',
      }),
    ]);
  });

  test('parseAliasesFromBody rechaza tipo inválido y duplicados', () => {
    expect(
      parseAliasesFromBody({ aliases: [{ alias_reference: 'X', alias_type: 'other' }] }).ok,
    ).toBe(false);
    expect(
      parseAliasesFromBody({
        aliases: [{ alias_reference: 'A10068X300' }, { alias_reference: 'a10068x300' }],
      }).ok,
    ).toBe(false);
  });

  test('parseImportAliases une JSON y columnas sueltas', () => {
    const parsed = parseImportAliases({
      aliases: '[{"alias_reference":"SCX-U10521","alias_type":"shop_prefix"}]',
      alias_reference: 'SU10521',
      alias_type: 'short',
      alias_ean: '123',
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.aliases.map((a) => a.alias_reference)).toEqual(['SCX-U10521', 'SU10521']);
    expect(parsed.aliases[1]).toEqual(
      expect.objectContaining({ alias_type: 'short', ean: '123' }),
    );
  });

  test('or-clauses de búsqueda incluyen ean e ids de alias', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(catalogSearchOrClause('U10521', [id])).toContain('ean.ilike.%U10521%');
    expect(catalogSearchOrClause('U10521', [id])).toContain(`id.in.(${id})`);
    expect(catalogReferenceOrClause('U10521X300')).toContain('reference.ilike.%U10521X300%');
  });
});
