export const CATALOG_ALIAS_TYPES = ['market', 'short', 'shop_prefix', 'legacy_typo'];

export function emptyCatalogAlias() {
  return {
    alias_reference: '',
    alias_type: 'market',
    market: '',
    brand_label: '',
    ean: '',
    source: '',
    source_url: '',
  };
}

export function aliasFormFromRow(row) {
  return {
    id: row.id,
    alias_reference: row.alias_reference ?? row.reference ?? '',
    alias_type: CATALOG_ALIAS_TYPES.includes(row.alias_type) ? row.alias_type : 'market',
    market: row.market ?? '',
    brand_label: row.brand_label ?? '',
    ean: row.ean ?? '',
    source: row.source ?? '',
    source_url: row.source_url ?? '',
  };
}

export function aliasesFormFromItem(item) {
  if (!Array.isArray(item?.aliases)) return [];
  return item.aliases.map(aliasFormFromRow);
}

export function aliasesPayloadFromForm(aliases) {
  return (aliases || [])
    .map((a) => ({
      alias_reference: String(a.alias_reference ?? '').trim(),
      alias_type: CATALOG_ALIAS_TYPES.includes(a.alias_type) ? a.alias_type : 'market',
      market: String(a.market ?? '').trim(),
      brand_label: String(a.brand_label ?? '').trim(),
      ean: String(a.ean ?? '').trim(),
      source: String(a.source ?? '').trim(),
      source_url: String(a.source_url ?? '').trim(),
    }))
    .filter((a) => a.alias_reference);
}
