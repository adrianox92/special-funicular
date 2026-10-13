/**
 * Idempotente: pone cacheControl largo en objetos existentes del bucket catalog-images.
 * NO se ejecuta en CI ni en deploy. Solo a mano, contra staging/prod, con service role.
 *
 * Uso (desde backend/):
 *   node scripts/update-catalog-images-cache-control.js           # dry-run
 *   node scripts/update-catalog-images-cache-control.js --apply
 *
 * Los nombres de objeto son únicos (timestamp+hash); max-age=1y immutable es seguro.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { getServiceClient } = require('../lib/supabaseClients');
const {
  STORAGE_CACHE_CONTROL_SECONDS,
  STORAGE_UPLOAD_CACHE,
  isLongLivedCacheControl,
} = require('../lib/storageCacheControl');
const { CATALOG_IMAGES_BUCKET } = require('../lib/catalogImageStorage');

const APPLY = process.argv.includes('--apply');
const PAGE = 100;

function cacheControlOf(obj) {
  return obj?.metadata?.cacheControl || obj?.metadata?.cache_control || '';
}

async function listPage(storage, prefix, offset) {
  const { data, error } = await storage.list(prefix, {
    limit: PAGE,
    offset,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(error.message);
  return data || [];
}

async function walkPrefix(storage, prefix, onFile) {
  let offset = 0;
  for (;;) {
    const entries = await listPage(storage, prefix, offset);
    if (entries.length === 0) break;
    for (const entry of entries) {
      const id = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = !entry.id && !entry.metadata;
      if (isFolder) {
        await walkPrefix(storage, id, onFile);
      } else {
        await onFile(id, entry);
      }
    }
    if (entries.length < PAGE) break;
    offset += PAGE;
  }
}

async function main() {
  const supabase = getServiceClient();
  if (!supabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY es obligatoria');
  }
  const storage = supabase.storage.from(CATALOG_IMAGES_BUCKET);
  let scanned = 0;
  let skipped = 0;
  let updated = 0;
  let failed = 0;

  console.log(`[cache-control] bucket=${CATALOG_IMAGES_BUCKET} apply=${APPLY}`);

  await walkPrefix(storage, '', async (objectPath, entry) => {
    scanned += 1;
    if (isLongLivedCacheControl(cacheControlOf(entry))) {
      skipped += 1;
      return;
    }
    if (!APPLY) {
      updated += 1;
      if (updated <= 20) {
        console.log(`  would update ${objectPath} (cacheControl=${cacheControlOf(entry) || 'empty'})`);
      }
      return;
    }
    const { data, error } = await storage.download(objectPath);
    if (error || !data) {
      failed += 1;
      console.warn(`  download fail ${objectPath}: ${error?.message}`);
      return;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const contentType = entry.metadata?.mimetype || data.type || 'application/octet-stream';
    const { error: upErr } = await storage.upload(objectPath, buffer, {
      contentType,
      upsert: true,
      ...STORAGE_UPLOAD_CACHE,
    });
    if (upErr) {
      failed += 1;
      console.warn(`  upload fail ${objectPath}: ${upErr.message}`);
      return;
    }
    updated += 1;
  });

  console.log(
    JSON.stringify({
      scanned,
      skippedAlreadyLong: skipped,
      updatedOrWouldUpdate: updated,
      failed,
      cacheControl: STORAGE_CACHE_CONTROL_SECONDS,
      apply: APPLY,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
