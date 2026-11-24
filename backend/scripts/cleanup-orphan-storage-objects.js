/**
 * Lista (y con --apply borra) objetos de Supabase Storage en catalog-images y vehicle-images
 * que ninguna fila de la BD referencia. NO se ejecuta en CI/deploy.
 *
 * Uso (desde backend/):
 *   node scripts/cleanup-orphan-storage-objects.js           # dry-run
 *   node scripts/cleanup-orphan-storage-objects.js --apply
 *
 * La miniatura `-thumb` de una imagen de catálogo referenciada cuenta como referenciada.
 * Se respetan los objetos de las últimas 24 h: una subida puede estar a medias de guardar su fila.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { getServiceClient } = require('../lib/supabaseClients');
const {
  CATALOG_IMAGES_BUCKET,
  catalogStoragePathFromPublicUrl,
  thumbStoragePathFromDetailPath,
} = require('../lib/catalogImageStorage');
const { VEHICLE_IMAGES_BUCKET, storagePathFromPublicUrl } = require('../lib/vehicleImageStorage');

const APPLY = process.argv.includes('--apply');
const LIST_PAGE = 100;
const DB_PAGE = 1000;
const REMOVE_BATCH = 100;
const GRACE_MS = 24 * 60 * 60 * 1000;

const CATALOG_URL_COLUMNS = [
  ['slot_catalog_items', 'image_url'],
  ['slot_catalog_brands', 'logo_url'],
  ['slot_catalog_insert_requests', 'proposed_image_url'],
  ['catalog_shops', 'logo_url'],
  ['seller_profiles', 'logo_url'],
];
const VEHICLE_URL_COLUMNS = [['vehicle_images', 'image_url']];

async function walkPrefix(storage, prefix, onFile) {
  let offset = 0;
  for (;;) {
    const { data, error } = await storage.list(prefix, {
      limit: LIST_PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(error.message);
    const entries = data || [];
    if (entries.length === 0) break;
    for (const entry of entries) {
      const id = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = !entry.id && !entry.metadata;
      if (isFolder) {
        await walkPrefix(storage, id, onFile);
      } else {
        onFile(id, entry);
      }
    }
    if (entries.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }
}

async function fetchColumnValues(supabase, table, column) {
  const values = [];
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .not(column, 'is', null)
      .order(column, { ascending: true })
      .range(from, from + DB_PAGE - 1);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    const rows = data || [];
    for (const row of rows) values.push(row[column]);
    if (rows.length < DB_PAGE) break;
  }
  return values;
}

async function referencedPaths(supabase, columns, toPath, withThumb) {
  const refs = new Set();
  for (const [table, column] of columns) {
    const urls = await fetchColumnValues(supabase, table, column);
    for (const url of urls) {
      const p = toPath(url);
      if (!p) continue;
      refs.add(p);
      if (withThumb) {
        const thumb = thumbStoragePathFromDetailPath(p);
        if (thumb) refs.add(thumb);
      }
    }
  }
  return refs;
}

async function scanBucket(supabase, bucket, refs) {
  const storage = supabase.storage.from(bucket);
  const cutoff = Date.now() - GRACE_MS;
  const orphans = [];
  let scanned = 0;
  let bytes = 0;
  let recent = 0;

  await walkPrefix(storage, '', (objectPath, entry) => {
    scanned += 1;
    if (refs.has(objectPath)) return;
    const created = Date.parse(entry.created_at || entry.updated_at || '');
    if (Number.isFinite(created) && created > cutoff) {
      recent += 1;
      return;
    }
    orphans.push(objectPath);
    bytes += Number(entry.metadata && entry.metadata.size) || 0;
  });

  let removed = 0;
  let failed = 0;
  if (APPLY) {
    for (let i = 0; i < orphans.length; i += REMOVE_BATCH) {
      const chunk = orphans.slice(i, i + REMOVE_BATCH);
      const { error } = await storage.remove(chunk);
      if (error) {
        failed += chunk.length;
        console.warn(`  remove fail ${bucket} (${chunk[0]}…): ${error.message}`);
      } else {
        removed += chunk.length;
      }
    }
  } else {
    for (const p of orphans.slice(0, 20)) console.log(`  would remove ${bucket}/${p}`);
  }

  return {
    bucket,
    scanned,
    referenced: refs.size,
    orphans: orphans.length,
    orphanMb: Math.round((bytes / 1024 / 1024) * 10) / 10,
    skippedRecent: recent,
    removed,
    failed,
  };
}

async function main() {
  const supabase = getServiceClient();
  if (!supabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY es obligatoria');
  }
  console.log(`[orphans] apply=${APPLY}`);

  const catalogRefs = await referencedPaths(supabase, CATALOG_URL_COLUMNS, catalogStoragePathFromPublicUrl, true);
  const vehicleRefs = await referencedPaths(supabase, VEHICLE_URL_COLUMNS, storagePathFromPublicUrl, false);

  const results = [];
  results.push(await scanBucket(supabase, CATALOG_IMAGES_BUCKET, catalogRefs));
  results.push(await scanBucket(supabase, VEHICLE_IMAGES_BUCKET, vehicleRefs));

  for (const r of results) console.log(JSON.stringify({ ...r, apply: APPLY }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
