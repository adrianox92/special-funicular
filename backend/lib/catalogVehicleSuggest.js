'use strict';

const { findCatalogItemIdsByAliasOrEan, escapeIlikePattern } = require('./catalogAliases');
const { CATALOG_TECH_SPEC_SELECT } = require('./catalogTechSpecs');

const SUGGEST_SELECT = [
  'id',
  'reference',
  'ean',
  'manufacturer_id',
  'manufacturer',
  'manufacturer_logo_url',
  'model_name',
  'vehicle_type',
  'traction',
  'motor_position',
  'commercial_release_year',
  'discontinued',
  'upcoming_release',
  'dorsal',
  'limited_edition',
  'limited_edition_total',
  'image_url',
  'car_make',
  'car_model',
  CATALOG_TECH_SPEC_SELECT,
].join(', ');

const VARIANT_TOKENS = new Set([
  'aw',
  'sw',
  'r',
  'hs',
  'homeseries',
  'home',
  'series',
  'evo',
  'evo2',
  'evo3',
  'gt',
  'gt3',
  '4x4',
  '2wd',
  'awd',
  'le',
  'limited',
  'pro',
  'club',
]);

function trimStr(value) {
  return value == null ? '' : String(value).trim();
}

function normalize(value) {
  return trimStr(value).toLowerCase();
}

function looksLikeCatalogReference(value) {
  const t = trimStr(value);
  if (t.length < 3 || t.length > 28) return false;
  if (/\s/.test(t)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(t) && /\d/.test(t);
}

function looksLikeVehicleName(value) {
  const t = trimStr(value);
  if (t.length < 8) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 2 && /[A-Za-zÀ-ÿ]/.test(t);
}

function detectSwappedVehicleFields({ model, reference } = {}) {
  return looksLikeCatalogReference(model) && looksLikeVehicleName(reference);
}

function fieldsForCatalogSearch({ manufacturer, model, reference } = {}) {
  const mfg = trimStr(manufacturer);
  const modelTrim = trimStr(model);
  const refTrim = trimStr(reference);
  if (detectSwappedVehicleFields({ model, reference })) {
    return {
      manufacturer: mfg,
      model: refTrim,
      reference: modelTrim,
      swapped: true,
    };
  }
  if (looksLikeCatalogReference(modelTrim) && !refTrim) {
    return {
      manufacturer: mfg,
      model: '',
      reference: modelTrim,
      swapped: false,
    };
  }
  return {
    manufacturer: mfg,
    model: modelTrim,
    reference: refTrim,
    swapped: false,
  };
}

function isSearchableReference(ref) {
  const t = trimStr(ref);
  if (t.length >= 4) return true;
  return t.length >= 3 && looksLikeCatalogReference(t);
}

function shouldSearchCatalog(raw) {
  const fields = fieldsForCatalogSearch(raw);
  return isSearchableReference(fields.reference) || fields.model.length >= 3;
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9áéíóúüñ]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function scoreCatalogSuggestion(item, query) {
  let score = 0;
  const ref = normalize(item.reference);
  const qRef = normalize(query.reference);
  const mfg = normalize(item.manufacturer);
  const qMfg = normalize(query.manufacturer);
  const name = normalize(item.model_name);
  const qModel = normalize(query.model);
  const car = `${normalize(item.car_make)} ${normalize(item.car_model)}`.trim();

  if (qRef) {
    if (ref === qRef) score += 100;
    else if (normalize(item.ean) === qRef) score += 90;
    else if (ref.endsWith(qRef) || qRef.endsWith(ref)) score += 70;
    else if (ref.includes(qRef) || qRef.includes(ref)) score += 50;
  }
  if (qMfg) {
    if (mfg === qMfg) score += 40;
    else if (mfg.includes(qMfg) || qMfg.includes(mfg)) score += 22;
  }
  if (qModel) {
    if (name === qModel || car === qModel) score += 50;
    else if (name.includes(qModel) || qModel.includes(name) || car.includes(qModel)) score += 32;
    else {
      const qTokens = tokenize(qModel);
      const nameTokens = new Set([...tokenize(name), ...tokenize(car)]);
      const overlap = qTokens.filter((t) => nameTokens.has(t)).length;
      score += overlap * 8;
    }
  }
  return score;
}

function variantBits(item) {
  const bits = [];
  if (item.traction) bits.push(String(item.traction).trim());
  if (item.motor_position) bits.push(String(item.motor_position).trim());
  if (item.spec_system) bits.push(String(item.spec_system).trim());
  if (item.spec_body) bits.push(String(item.spec_body).trim());
  if (item.spec_color) bits.push(String(item.spec_color).trim());
  const nameTokens = tokenize(item.model_name).filter((t) => VARIANT_TOKENS.has(t));
  bits.push(...nameTokens.map((t) => t.toUpperCase()));
  const refSuffix = String(item.reference || '').match(/[A-Za-z]{1,6}$/);
  if (refSuffix && VARIANT_TOKENS.has(refSuffix[0].toLowerCase())) {
    bits.push(refSuffix[0].toUpperCase());
  }
  if (item.limited_edition) bits.push('LE');
  if (item.dorsal != null && String(item.dorsal).trim() !== '') bits.push(`#${String(item.dorsal).trim()}`);
  return [...new Set(bits.filter(Boolean))];
}

function coreGroupKey(item) {
  const mfg = normalize(item.manufacturer);
  if (item.car_make && item.car_model) {
    return `${mfg}|car:${normalize(item.car_make)}|${normalize(item.car_model)}`;
  }
  const nameTokens = tokenize(item.model_name).filter((t) => !VARIANT_TOKENS.has(t) && !/^\d+$/.test(t));
  const coreName = nameTokens.slice(0, 5).join(' ');
  const refBase = normalize(item.reference).replace(/[a-z]+$/i, '');
  if (coreName.length >= 4) return `${mfg}|name:${coreName}`;
  if (refBase.length >= 4) return `${mfg}|ref:${refBase}`;
  return `id:${item.id}`;
}

function uniqueBitsInGroup(items) {
  const counts = new Map();
  const perItem = items.map((item) => variantBits(item));
  for (const bits of perItem) {
    for (const bit of bits) {
      counts.set(bit, (counts.get(bit) || 0) + 1);
    }
  }
  return items.map((item, i) => {
    const distinctive = perItem[i].filter((bit) => counts.get(bit) !== items.length);
    return { ...item, variant_bits: distinctive.length ? distinctive : perItem[i] };
  });
}

function groupCatalogVariants(items) {
  const buckets = new Map();
  for (const item of items) {
    const key = coreGroupKey(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  const groups = [];
  for (const [key, members] of buckets.entries()) {
    const decorated = uniqueBitsInGroup(members);
    groups.push({
      key,
      variant_group: members.length > 1,
      items: decorated,
    });
  }
  groups.sort((a, b) => {
    const aScore = Math.max(...a.items.map((i) => i.score || 0));
    const bScore = Math.max(...b.items.map((i) => i.score || 0));
    return bScore - aScore;
  });
  const flat = groups.flatMap((g) => g.items);
  return { groups, items: flat };
}

async function fetchRows(sb, apply) {
  let query = sb.from('slot_catalog_items_with_ratings').select(SUGGEST_SELECT);
  query = apply(query);
  const { data, error } = await query.limit(20);
  if (error) throw error;
  return data || [];
}

async function suggestCatalogItemsForVehicle(sb, rawFields = {}) {
  const fields = fieldsForCatalogSearch(rawFields);
  if (!shouldSearchCatalog(fields)) {
    return { items: [], groups: [], swapped: fields.swapped };
  }

  const queries = [];
  const { manufacturer: mfg, model, reference: ref } = fields;

  if (isSearchableReference(ref)) {
    const pattern = `%${escapeIlikePattern(ref)}%`;
    queries.push(fetchRows(sb, (q) => q.ilike('reference', pattern)));
    queries.push(
      findCatalogItemIdsByAliasOrEan(sb, ref, { limit: 20 }).then(async (ids) => {
        if (!ids.length) return [];
        return fetchRows(sb, (q) => q.in('id', ids));
      }),
    );
    if (mfg.length >= 2) {
      queries.push(
        fetchRows(sb, (q) =>
          q.ilike('manufacturer', `%${escapeIlikePattern(mfg)}%`).ilike('reference', pattern),
        ),
      );
    }
  }

  if (model.length >= 3) {
    const modelPattern = `%${escapeIlikePattern(model)}%`;
    const modelOr = `model_name.ilike.${modelPattern},car_make.ilike.${modelPattern},car_model.ilike.${modelPattern}`;
    if (mfg.length >= 2) {
      queries.push(
        fetchRows(sb, (q) => q.ilike('manufacturer', `%${escapeIlikePattern(mfg)}%`).or(modelOr)),
      );
    } else {
      queries.push(fetchRows(sb, (q) => q.or(modelOr)));
    }
  }

  const settled = await Promise.allSettled(queries);
  const byId = new Map();
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const row of result.value || []) {
      if (row?.id) byId.set(row.id, row);
    }
  }

  const scored = Array.from(byId.values())
    .map((item) => ({
      ...item,
      score: scoreCatalogSuggestion(item, fields),
      variant_bits: variantBits(item),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.reference || '').localeCompare(String(b.reference || '')))
    .slice(0, 12);

  const grouped = groupCatalogVariants(scored);
  return { ...grouped, swapped: fields.swapped };
}

module.exports = {
  SUGGEST_SELECT,
  looksLikeCatalogReference,
  looksLikeVehicleName,
  detectSwappedVehicleFields,
  fieldsForCatalogSearch,
  shouldSearchCatalog,
  scoreCatalogSuggestion,
  variantBits,
  groupCatalogVariants,
  suggestCatalogItemsForVehicle,
};
