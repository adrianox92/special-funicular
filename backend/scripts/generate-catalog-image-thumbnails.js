/**
 * Idempotente: genera sibling `-thumb` (lado largo 400px, webp/jpeg) para objetos
 * existentes en catalog-images que aún no lo tienen. NO se ejecuta en CI/deploy.
 *
 * Uso (desde backend/):
 *   node scripts/generate-catalog-image-thumbnails.js           # dry-run
 *   node scripts/generate-catalog-image-thumbnails.js --apply
 *
 * Omite logos de marca (brands/) y objetos que ya son `-thumb`.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { getServiceClient } = require('../lib/supabaseClients');
const { processVehicleImageBuffer, DEFAULT_THUMB_EDGE } = require('../lib/processVehicleImageBuffer');
const { STORAGE_UPLOAD_CACHE } = require('../lib/storageCacheControl');
const {
  CATALOG_IMAGES_BUCKET,
  thumbStoragePathFromDetailPath,
} = require('../lib/catalogImageStorage');

const APPLY = process.argv.includes('--apply');
const PAGE = 100;

function isThumbName(name) {
  return /-thumb\.[A-Za-z0-9]+$/.test(String(name || ''));
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

async function objectExists(storage, objectPath) {
  const dir = objectPath.includes('/') ? objectPath.slice(0, objectPath.lastIndexOf('/')) : '';
  const base = objectPath.slice(objectPath.lastIndexOf('/') + 1);
  const { data, error } = await storage.list(dir, { limit: 1000, search: base });
  if (error) return false;
  return (data || []).some((e) => e.name === base);
}

async function main() {
  const supabase = getServiceClient();
  if (!supabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY es obligatoria');
  }
  const storage = supabase.storage.from(CATALOG_IMAGES_BUCKET);
  let scanned = 0;
  let skipped = 0;
  let created = 0;
  let failed = 0;

  console.log(`[thumbnails] bucket=${CATALOG_IMAGES_BUCKET} apply=${APPLY} edge=${DEFAULT_THUMB_EDGE}`);

  await walkPrefix(storage, 'catalog', async (objectPath, entry) => {
    scanned += 1;
    if (isThumbName(entry.name) || isThumbName(objectPath)) {
      skipped += 1;
      return;
    }
    const thumbPath = thumbStoragePathFromDetailPath(objectPath);
    if (!thumbPath) {
      skipped += 1;
      return;
    }
    const exists = await objectExists(storage, thumbPath);
    if (exists) {
      skipped += 1;
      return;
    }
    if (!APPLY) {
      created += 1;
      if (created <= 20) console.log(`  would create ${thumbPath} from ${objectPath}`);
      return;
    }
    const { data, error } = await storage.download(objectPath);
    if (error || !data) {
      failed += 1;
      console.warn(`  download fail ${objectPath}: ${error?.message}`);
      return;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    try {
      const thumb = await processVehicleImageBuffer(buffer, data.type || 'image/webp', {
        maxEdgePx: DEFAULT_THUMB_EDGE,
      });
      const { error: upErr } = await storage.upload(thumbPath, thumb.buffer, {
        contentType: thumb.contentType,
        upsert: false,
        ...STORAGE_UPLOAD_CACHE,
      });
      if (upErr) {
        failed += 1;
        console.warn(`  upload fail ${thumbPath}: ${upErr.message}`);
        return;
      }
      created += 1;
    } catch (e) {
      failed += 1;
      console.warn(`  process fail ${objectPath}: ${e.message}`);
    }
  });

  console.log(
    JSON.stringify({
      scanned,
      skippedExistingOrThumb: skipped,
      createdOrWouldCreate: created,
      failed,
      apply: APPLY,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
