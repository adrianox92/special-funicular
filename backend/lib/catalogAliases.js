'use strict';

const ALIAS_TYPES = ['market', 'short', 'shop_prefix', 'legacy_typo'];
const ALIAS_TYPE_SET = new Set(ALIAS_TYPES);
const MAX_ALIASES = 40;
const ALIAS_PUBLIC_FIELDS = [
  'id',
  'alias_reference',
  'alias_type',
  'market',
  'brand_label',
  'ean',
  'source',
  'source_url',
  'created_at',
];

function escapeIlikePattern(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function normalizeReference(ref) {
  return String(ref ?? '')
    .trim()
    .toUpperCase();
}

function normalizeEan(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > 32) return { invalid: true, message: 'ean: máximo 32 caracteres' };
  return s;
}

function parseEanFromBody(raw, { requiredUndefined = true } = {}) {
  if (raw === undefined) {
    return requiredUndefined ? { provided: false, value: null } : { provided: true, value: null };
  }
  const n = normalizeEan(raw);
  if (n && typeof n === 'object' && n.invalid) {
    return { ok: false, error: n.message };
  }
  return { provided: true, ok: true, value: n };
}

function parseOptionalHttpUrl(raw) {
  if (raw == null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (!s) return { ok: true, value: null };
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, error: 'source_url debe usar http o https' };
    }
    const out = u.toString();
    if (out.length > 500) return { ok: false, error: 'source_url demasiado larga' };
    return { ok: true, value: out };
  } catch {
    return { ok: false, error: 'source_url no válida' };
  }
}

function clipOptionalText(raw, max, field) {
  if (raw == null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (!s) return { ok: true, value: null };
  if (s.length > max) return { ok: false, error: `${field}: máximo ${max} caracteres` };
  return { ok: true, value: s };
}

function parseOneAlias(raw, index) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: `aliases[${index}]: objeto requerido` };
  }
  const alias_reference = normalizeReference(raw.alias_reference ?? raw.reference);
  if (!alias_reference) {
    return { ok: false, error: `aliases[${index}]: alias_reference es obligatorio` };
  }
  if (alias_reference.length > 64) {
    return { ok: false, error: `aliases[${index}]: alias_reference demasiado larga` };
  }
  const typeRaw = raw.alias_type != null && String(raw.alias_type).trim() !== ''
    ? String(raw.alias_type).trim()
    : 'market';
  if (!ALIAS_TYPE_SET.has(typeRaw)) {
    return {
      ok: false,
      error: `aliases[${index}]: alias_type debe ser ${ALIAS_TYPES.join(', ')}`,
    };
  }
  const market = clipOptionalText(raw.market, 16, `aliases[${index}].market`);
  if (!market.ok) return market;
  const brand_label = clipOptionalText(raw.brand_label, 80, `aliases[${index}].brand_label`);
  if (!brand_label.ok) return brand_label;
  const ean = normalizeEan(raw.ean);
  if (ean && typeof ean === 'object' && ean.invalid) {
    return { ok: false, error: `aliases[${index}].${ean.message}` };
  }
  const source = clipOptionalText(raw.source, 80, `aliases[${index}].source`);
  if (!source.ok) return source;
  const sourceUrl = parseOptionalHttpUrl(raw.source_url);
  if (!sourceUrl.ok) return { ok: false, error: `aliases[${index}].${sourceUrl.error}` };

  return {
    ok: true,
    value: {
      alias_reference,
      alias_type: typeRaw,
      market: market.value ? market.value.toUpperCase() : null,
      brand_label: brand_label.value,
      ean: ean || null,
      source: source.value,
      source_url: sourceUrl.value,
    },
  };
}

/**
 * @returns {{ provided: boolean, ok?: boolean, error?: string, aliases?: object[] }}
 */
function parseAliasesFromBody(body) {
  if (body == null || body.aliases === undefined) {
    return { provided: false, ok: true, aliases: [] };
  }
  let raw = body.aliases;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return { provided: true, ok: true, aliases: [] };
    try {
      raw = JSON.parse(s);
    } catch {
      return { provided: true, ok: false, error: 'aliases debe ser un JSON array' };
    }
  }
  if (!Array.isArray(raw)) {
    return { provided: true, ok: false, error: 'aliases debe ser un array' };
  }
  if (raw.length > MAX_ALIASES) {
    return { provided: true, ok: false, error: `aliases: máximo ${MAX_ALIASES}` };
  }
  const aliases = [];
  const seen = new Set();
  for (let i = 0; i < raw.length; i++) {
    const parsed = parseOneAlias(raw[i], i);
    if (!parsed.ok) return { provided: true, ok: false, error: parsed.error };
    const key = parsed.value.alias_reference.toLowerCase();
    if (seen.has(key)) {
      return {
        provided: true,
        ok: false,
        error: `aliases: referencia duplicada ${parsed.value.alias_reference}`,
      };
    }
    seen.add(key);
    aliases.push(parsed.value);
  }
  return { provided: true, ok: true, aliases };
}

function parseImportAliases(row) {
  const fromJson = parseAliasesFromBody({
    aliases: row.aliases ?? row.Aliases ?? row.alias_json ?? row.alias,
  });
  if (!fromJson.ok) return fromJson;
  const list = [...fromJson.aliases];
  const singleRef = normalizeReference(
    row.alias_reference ?? row.alias_ref ?? row.referencia_alternativa ?? '',
  );
  if (singleRef) {
    const one = parseOneAlias(
      {
        alias_reference: singleRef,
        alias_type: row.alias_type ?? row.tipo_alias ?? 'market',
        market: row.alias_market ?? row.market ?? row.mercado ?? null,
        brand_label: row.alias_brand_label ?? row.brand_label ?? null,
        ean: row.alias_ean ?? row.ean_alias ?? null,
        source: row.alias_source ?? row.source ?? null,
        source_url: row.alias_source_url ?? row.source_url ?? null,
      },
      list.length,
    );
    if (!one.ok) return { provided: true, ok: false, error: one.error };
    if (!list.some((a) => a.alias_reference === one.value.alias_reference)) {
      list.push(one.value);
    }
  }
  return { provided: list.length > 0 || fromJson.provided, ok: true, aliases: list };
}

function publicAliasRow(row) {
  if (!row) return null;
  const out = {};
  for (const k of ALIAS_PUBLIC_FIELDS) {
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}

async function fetchAliasesForCatalogItems(sb, itemIds) {
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await sb
    .from('slot_catalog_item_aliases')
    .select(`catalog_item_id, ${ALIAS_PUBLIC_FIELDS.join(', ')}`)
    .in('catalog_item_id', ids)
    .order('alias_reference', { ascending: true });
  if (error) {
    console.warn('[catalog] fetchAliasesForCatalogItems', error.message);
    return new Map();
  }
  const byItem = new Map();
  for (const row of data || []) {
    const list = byItem.get(row.catalog_item_id) || [];
    list.push(publicAliasRow(row));
    byItem.set(row.catalog_item_id, list);
  }
  return byItem;
}

async function attachAliasesToCatalogItems(sb, items) {
  if (!items) return items;
  const list = Array.isArray(items) ? items : [items];
  const ids = list.map((it) => it?.id).filter(Boolean);
  const byItem = await fetchAliasesForCatalogItems(sb, ids);
  const decorated = list.map((it) => ({
    ...it,
    aliases: byItem.get(it.id) || [],
  }));
  return Array.isArray(items) ? decorated : decorated[0];
}

async function findCatalogItemIdsByAliasOrEan(sb, q, { limit = 40, manufacturerId } = {}) {
  const term = String(q ?? '').trim();
  if (!term) return [];
  const pattern = `%${escapeIlikePattern(term)}%`;
  let query = sb
    .from('slot_catalog_item_aliases')
    .select('catalog_item_id')
    .or(`alias_reference.ilike.${pattern},ean.ilike.${pattern}`)
    .limit(limit);
  if (manufacturerId) query = query.eq('manufacturer_id', manufacturerId);
  const { data, error } = await query;
  if (error) {
    console.warn('[catalog] findCatalogItemIdsByAliasOrEan', error.message);
    return [];
  }
  return [...new Set((data || []).map((r) => r.catalog_item_id).filter(Boolean))];
}

function catalogSearchOrClause(q, extraIds = []) {
  const escaped = escapeIlikePattern(q);
  const parts = [
    `reference.ilike.%${escaped}%`,
    `model_name.ilike.%${escaped}%`,
    `manufacturer.ilike.%${escaped}%`,
    `ean.ilike.%${escaped}%`,
  ];
  if (extraIds.length) {
    parts.push(`id.in.(${extraIds.join(',')})`);
  }
  return parts.join(',');
}

function catalogReferenceOrClause(q, extraIds = []) {
  const escaped = escapeIlikePattern(q);
  const parts = [`reference.ilike.%${escaped}%`, `ean.ilike.%${escaped}%`];
  if (extraIds.length) {
    parts.push(`id.in.(${extraIds.join(',')})`);
  }
  return parts.join(',');
}

async function replaceCatalogItemAliases(sb, catalogItemId, aliases) {
  const { error: delErr } = await sb
    .from('slot_catalog_item_aliases')
    .delete()
    .eq('catalog_item_id', catalogItemId);
  if (delErr) return { error: delErr };
  if (!aliases?.length) return { error: null };
  const rows = aliases.map((a) => ({
    catalog_item_id: catalogItemId,
    alias_reference: a.alias_reference,
    alias_type: a.alias_type,
    market: a.market,
    brand_label: a.brand_label,
    ean: a.ean,
    source: a.source,
    source_url: a.source_url,
  }));
  const { error: insErr } = await sb.from('slot_catalog_item_aliases').insert(rows);
  return { error: insErr };
}

async function upsertCatalogItemAliases(sb, catalogItemId, aliases) {
  if (!aliases?.length) return { error: null };
  for (const a of aliases) {
    const { data: existing, error: findErr } = await sb
      .from('slot_catalog_item_aliases')
      .select('id')
      .eq('catalog_item_id', catalogItemId)
      .eq('alias_reference', a.alias_reference)
      .maybeSingle();
    if (findErr) return { error: findErr };
    if (existing) {
      const { error: upErr } = await sb
        .from('slot_catalog_item_aliases')
        .update({
          alias_type: a.alias_type,
          market: a.market,
          brand_label: a.brand_label,
          ean: a.ean,
          source: a.source,
          source_url: a.source_url,
        })
        .eq('id', existing.id);
      if (upErr) return { error: upErr };
    } else {
      const { error: insErr } = await sb.from('slot_catalog_item_aliases').insert([
        {
          catalog_item_id: catalogItemId,
          alias_reference: a.alias_reference,
          alias_type: a.alias_type,
          market: a.market,
          brand_label: a.brand_label,
          ean: a.ean,
          source: a.source,
          source_url: a.source_url,
        },
      ]);
      if (insErr) return { error: insErr };
    }
  }
  return { error: null };
}

function mapAliasWriteError(error) {
  if (!error) return null;
  if (error.code === '23505') {
    return { status: 409, error: 'Ya existe esa referencia alternativa para esta marca' };
  }
  if (error.code === '23514' || error.code === '23503') {
    return { status: 400, error: error.message };
  }
  return { status: 500, error: error.message };
}

async function findCatalogItemIdByReferenceOrAlias(sb, reference, manufacturerId) {
  const ref = normalizeReference(reference);
  if (!ref || !manufacturerId) return null;
  const { data: item } = await sb
    .from('slot_catalog_items')
    .select('id')
    .eq('reference', ref)
    .eq('manufacturer_id', manufacturerId)
    .maybeSingle();
  if (item?.id) return item.id;
  const { data: alias } = await sb
    .from('slot_catalog_item_aliases')
    .select('catalog_item_id')
    .eq('alias_reference', ref)
    .eq('manufacturer_id', manufacturerId)
    .maybeSingle();
  return alias?.catalog_item_id ?? null;
}

module.exports = {
  ALIAS_TYPES,
  MAX_ALIASES,
  normalizeEan,
  normalizeReference,
  parseEanFromBody,
  parseAliasesFromBody,
  parseImportAliases,
  attachAliasesToCatalogItems,
  fetchAliasesForCatalogItems,
  findCatalogItemIdsByAliasOrEan,
  catalogSearchOrClause,
  catalogReferenceOrClause,
  replaceCatalogItemAliases,
  upsertCatalogItemAliases,
  mapAliasWriteError,
  findCatalogItemIdByReferenceOrAlias,
  escapeIlikePattern,
};
