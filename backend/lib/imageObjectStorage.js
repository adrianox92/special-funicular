/**
 * Almacenamiento de objetos de imagen: Cloudflare R2 (subidas nuevas) o Supabase Storage (legacy).
 *
 * IMAGE_STORAGE_PROVIDER=r2 activa R2 si R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * y R2_BUCKET están definidos; si falta alguno se sube a Supabase.
 * El bucket de R2 es privado: la clave es `<bucket lógico>/<ruta>` y la URL guardada en BD es
 * `<PUBLIC_IMAGE_ORIGIN>/api/img/r2/<bucket>/<ruta>`, que sirve el proxy de Vercel.
 * Los borrados eligen proveedor según la URL guardada en BD.
 */
const { STORAGE_CACHE_CONTROL_SECONDS, STORAGE_UPLOAD_CACHE } = require('./storageCacheControl');
const { publicImageOrigin } = require('./publicCatalogImageUrls');
const { resolveR2Config, describeR2Error } = require('../../frontend/api/_lib/r2Config');

const R2_PROXY_PATH_PREFIX = '/api/img/r2/';

const PROVIDER_SUPABASE = 'supabase';
const PROVIDER_R2 = 'r2';
const R2_DELETE_BATCH = 1000;

let r2ClientOverride = null;
let r2ClientCached = null;
let r2ClientKey = '';

function trimSlashes(s) {
  return String(s || '').replace(/^\/+|\/+$/g, '');
}

function r2Config(env = process.env) {
  const cfg = resolveR2Config(env);
  return cfg.ok ? cfg : null;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'r2'|'supabase'}
 */
function uploadProvider(env = process.env) {
  const wanted = String(env.IMAGE_STORAGE_PROVIDER || '').trim().toLowerCase();
  if (wanted !== PROVIDER_R2) return PROVIDER_SUPABASE;
  const cfg = resolveR2Config(env);
  if (!cfg.ok) {
    console.warn(`[imageObjectStorage] IMAGE_STORAGE_PROVIDER=r2 pero ${cfg.reason}; se usa Supabase`);
    return PROVIDER_SUPABASE;
  }
  return PROVIDER_R2;
}

function r2Client(env = process.env) {
  if (r2ClientOverride) return r2ClientOverride;
  const cfg = r2Config(env);
  if (!cfg) throw new Error('Cloudflare R2 no está configurado');
  const key = `${cfg.endpoint}:${cfg.accessKeyId}`;
  if (r2ClientCached && r2ClientKey === key) return r2ClientCached;
  const { S3Client } = require('@aws-sdk/client-s3');
  r2ClientCached = new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  r2ClientKey = key;
  return r2ClientCached;
}

async function r2Send(command, env = process.env) {
  try {
    return await r2Client(env).send(command);
  } catch (err) {
    const cfg = r2Config(env);
    throw describeR2Error(err, cfg ? cfg.host : 'R2');
  }
}

/** Solo tests: inyecta un cliente con `send(command)`. */
function setR2ClientForTests(client) {
  r2ClientOverride = client || null;
}

function r2ObjectKey(bucket, objectPath) {
  return `${trimSlashes(bucket)}/${trimSlashes(objectPath)}`;
}

function r2PublicUrl(bucket, objectPath, env = process.env) {
  const encoded = r2ObjectKey(bucket, objectPath)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${publicImageOrigin(env)}${R2_PROXY_PATH_PREFIX}${encoded}`;
}

/**
 * URL de un objeto R2 servido por el proxy (`…/api/img/r2/…`), sin importar el origen.
 * @param {string} publicUrl
 * @returns {boolean}
 */
function isR2PublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return false;
  try {
    return new URL(publicUrl, 'https://placeholder.invalid').pathname.startsWith(R2_PROXY_PATH_PREFIX);
  } catch {
    return false;
  }
}

/**
 * @param {string} publicUrl
 * @returns {'r2'|'supabase'}
 */
function providerForUrl(publicUrl) {
  return isR2PublicUrl(publicUrl) ? PROVIDER_R2 : PROVIDER_SUPABASE;
}

/**
 * Sube un objeto y devuelve su URL pública.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} bucket bucket lógico (`catalog-images`, `vehicle-images`)
 * @param {string} objectPath
 * @param {Buffer} buffer
 * @param {string} contentType
 * @param {{ upsert?: boolean, env?: NodeJS.ProcessEnv }} [opts]
 */
async function uploadObject(supabase, bucket, objectPath, buffer, contentType, opts = {}) {
  const env = opts.env || process.env;
  if (uploadProvider(env) === PROVIDER_R2) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await r2Send(
      new PutObjectCommand({
        Bucket: r2Config(env).bucket,
        Key: r2ObjectKey(bucket, objectPath),
        Body: buffer,
        ContentType: contentType,
        CacheControl: `public, max-age=${STORAGE_CACHE_CONTROL_SECONDS}, immutable`,
      }),
      env,
    );
    return r2PublicUrl(bucket, objectPath, env);
  }

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: !!opts.upsert,
    ...STORAGE_UPLOAD_CACHE,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'r2'|'supabase'} provider
 * @param {string} bucket
 * @param {string[]} paths
 * @returns {Promise<{ error: Error|null }>}
 */
async function removeObjects(supabase, provider, bucket, paths, env = process.env) {
  const list = (paths || []).filter(Boolean);
  if (list.length === 0) return { error: null };
  if (provider === PROVIDER_R2) {
    try {
      const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
      for (let i = 0; i < list.length; i += R2_DELETE_BATCH) {
        const chunk = list.slice(i, i + R2_DELETE_BATCH);
        const out = await r2Send(
          new DeleteObjectsCommand({
            Bucket: r2Config(env).bucket,
            Delete: { Objects: chunk.map((p) => ({ Key: r2ObjectKey(bucket, p) })), Quiet: true },
          }),
          env,
        );
        if (out && Array.isArray(out.Errors) && out.Errors.length > 0) {
          return { error: new Error(out.Errors[0].Message || 'Error borrando en R2') };
        }
      }
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }
  const { error } = await supabase.storage.from(bucket).remove(list);
  return { error: error || null };
}

async function removeSupabasePrefix(supabase, bucket, prefix) {
  const folder = trimSlashes(prefix);
  const limit = 100;
  let previousFirst = null;
  for (;;) {
    const { data: files, error } = await supabase.storage.from(bucket).list(folder, {
      limit,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(error.message);
    if (!files || files.length === 0) break;
    // remove() puede no borrar nada sin error (RLS); evita un bucle infinito.
    if (files[0].name === previousFirst) throw new Error(`No se pudo vaciar ${bucket}/${folder}`);
    previousFirst = files[0].name;
    const paths = files.map((f) => `${folder}/${f.name}`);
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) throw new Error(removeError.message);
    if (files.length < limit) break;
  }
}

async function removeR2Prefix(bucket, prefix, env = process.env) {
  const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
  const r2Bucket = r2Config(env).bucket;
  const keyPrefix = `${r2ObjectKey(bucket, prefix)}/`;
  let token;
  do {
    const page = await r2Send(
      new ListObjectsV2Command({ Bucket: r2Bucket, Prefix: keyPrefix, ContinuationToken: token }),
      env,
    );
    const keys = (page.Contents || []).map((o) => o.Key).filter(Boolean);
    if (keys.length > 0) {
      const out = await r2Send(
        new DeleteObjectsCommand({
          Bucket: r2Bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
        env,
      );
      if (out && Array.isArray(out.Errors) && out.Errors.length > 0) {
        throw new Error(out.Errors[0].Message || 'Error borrando en R2');
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

/**
 * Borra todo lo que cuelga de `prefix` en Supabase y, si R2 está configurado, también en R2.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} bucket
 * @param {string} prefix carpeta sin barra final (p. ej. `vehicles/<id>`)
 */
async function removePrefix(supabase, bucket, prefix, env = process.env) {
  await removeSupabasePrefix(supabase, bucket, prefix);
  if (r2ClientOverride || r2Config(env)) {
    await removeR2Prefix(bucket, prefix, env);
  }
}

module.exports = {
  PROVIDER_R2,
  PROVIDER_SUPABASE,
  uploadProvider,
  r2Config,
  r2ObjectKey,
  r2PublicUrl,
  isR2PublicUrl,
  providerForUrl,
  uploadObject,
  removeObjects,
  removePrefix,
  setR2ClientForTests,
};
