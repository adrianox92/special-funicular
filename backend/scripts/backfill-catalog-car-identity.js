/**
 * Rellena car_make y car_model de las fichas ya creadas.
 * No pisa car_identity_source = manual. Se puede ejecutar más de una vez.
 */
require('dotenv').config();

const { getServiceClient } = require('../lib/supabaseClients');
const { catalogCarIdentityColumns } = require('../lib/catalogCarIdentity');

const PAGE = 1000;
const CHUNK = 100;

function sameIdentity(row, next) {
  return (
    (row.car_make || null) === next.car_make &&
    (row.car_model || null) === next.car_model &&
    row.car_identity_source === 'auto'
  );
}

async function loadAll(supabase) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('slot_catalog_items')
      .select('id, model_name, car_make, car_model, car_identity_source')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function updateChunk(supabase, ids, columns) {
  const { error } = await supabase
    .from('slot_catalog_items')
    .update(columns)
    .in('id', ids);
  if (error) throw error;
}

async function main() {
  const supabase = getServiceClient();
  if (!supabase) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const rows = await loadAll(supabase);
  const groups = new Map();
  let skippedManual = 0;
  let unchanged = 0;
  let withModel = 0;
  let makeOnly = 0;
  let empty = 0;

  for (const row of rows) {
    const next = catalogCarIdentityColumns(row.model_name, row.car_identity_source);
    if (!next) {
      skippedManual += 1;
      continue;
    }
    if (sameIdentity(row, next)) {
      unchanged += 1;
      continue;
    }
    if (next.car_make && next.car_model) withModel += 1;
    else if (next.car_make) makeOnly += 1;
    else empty += 1;
    const key = `${next.car_make || ''}\u0000${next.car_model || ''}`;
    if (!groups.has(key)) groups.set(key, { columns: next, ids: [] });
    groups.get(key).ids.push(row.id);
  }

  let updated = 0;
  for (const group of groups.values()) {
    for (let i = 0; i < group.ids.length; i += CHUNK) {
      const ids = group.ids.slice(i, i + CHUNK);
      await updateChunk(supabase, ids, group.columns);
      updated += ids.length;
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        updated,
        unchanged,
        skippedManual,
        withMakeAndModel: withModel,
        makeOnly,
        stillEmpty: empty,
        groups: groups.size,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
