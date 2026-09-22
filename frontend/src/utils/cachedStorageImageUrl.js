/**
 * Reescribe URLs públicas de Supabase Storage a un proxy same-origin
 * (`/api/img/<bucket>/<path>`) para que Vercel/CDN cachee los bytes.
 *
 * CJS para que SSR (Node) y SPA (webpack) compartan la misma fuente.
 * La invalidación es por clave: cada subida usa un path único
 * (`catalog/<timestamp>-<rand>.webp`); un `image_url` nuevo cambia la URL cacheada.
 */

const ALLOWED_BUCKETS = Object.freeze(['catalog-images', 'vehicle-images']);
const STORAGE_PUBLIC_PREFIX = '/storage/v1/object/public/';
const PROXY_PREFIX = '/api/img/';
const MAX_OBJECT_PATH_LEN = 512;

function allowedBucketsSet() {
  return new Set(ALLOWED_BUCKETS);
}

function isSupabaseStorageHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'supabase.co' || host.endsWith('.supabase.co');
}

function hostFromMaybeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(s) ? s : `https://${s}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Hosts permitidos: REACT_APP_SUPABASE_URL / SUPABASE_URL y lista extra.
 * Añade la variante `*.storage.supabase.co` del mismo project ref.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Set<string>}
 */
function allowedStorageHostsFromEnv(env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {};
  const hosts = new Set();
  const rawParts = [e.REACT_APP_SUPABASE_URL, e.SUPABASE_URL, e.STORAGE_IMAGE_ALLOWED_HOSTS];
  for (const raw of rawParts) {
    if (!raw) continue;
    for (const part of String(raw).split(',')) {
      const host = hostFromMaybeUrl(part);
      if (!host) continue;
      hosts.add(host);
      if (host.endsWith('.supabase.co') && !host.endsWith('.storage.supabase.co')) {
        const ref = host.slice(0, -'.supabase.co'.length);
        if (ref && !ref.includes('.')) {
          hosts.add(`${ref}.storage.supabase.co`);
        }
      }
    }
  }
  return hosts;
}

function primaryStorageHost(hosts) {
  if (!hosts || hosts.size === 0) return '';
  for (const host of hosts) {
    if (host.endsWith('.supabase.co') && !host.endsWith('.storage.supabase.co')) {
      return host;
    }
  }
  return hosts.values().next().value || '';
}

function isSafeObjectPath(objectPath) {
  const p = String(objectPath || '');
  if (!p || p.length > MAX_OBJECT_PATH_LEN) return false;
  if (p.startsWith('/') || p.endsWith('/')) return false;
  if (p.includes('..') || p.includes('//') || p.includes('\\')) return false;
  return /^[A-Za-z0-9._\-/]+$/.test(p);
}

function hostIsAllowed(hostname, allowedHosts) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (allowedHosts && allowedHosts.size > 0) return allowedHosts.has(host);
  return isSupabaseStorageHost(host);
}

/**
 * @param {unknown} rawUrl
 * @param {{ allowedHosts?: Set<string> }} [opts]
 * @returns {{ host: string, bucket: string, objectPath: string, sourceUrl: string }|null}
 */
function parseAllowedStorageUrl(rawUrl, opts) {
  if (rawUrl == null) return null;
  const s = String(rawUrl).trim();
  if (!s || s.startsWith('blob:') || s.startsWith('data:') || s.startsWith('/')) return null;

  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const allowedHosts = opts && opts.allowedHosts;
  if (!hostIsAllowed(url.hostname, allowedHosts)) return null;

  let pathname = url.pathname || '';
  try {
    pathname = decodeURI(pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith(STORAGE_PUBLIC_PREFIX)) return null;

  const rest = pathname.slice(STORAGE_PUBLIC_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const bucket = rest.slice(0, slash);
  const objectPath = rest.slice(slash + 1);
  if (!allowedBucketsSet().has(bucket) || !isSafeObjectPath(objectPath)) return null;

  const sourceUrl = `${url.origin}${STORAGE_PUBLIC_PREFIX}${bucket}/${objectPath}`;
  return { host: url.hostname.toLowerCase(), bucket, objectPath, sourceUrl };
}

function proxyPathFor(bucket, objectPath) {
  const encoded = String(objectPath)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${PROXY_PREFIX}${bucket}/${encoded}`;
}

function isProxyEnabled(opts) {
  if (opts && Object.prototype.hasOwnProperty.call(opts, 'enabled')) {
    return Boolean(opts.enabled);
  }
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    return true;
  }
  if (typeof window === 'undefined') return true;
  const host = window.location && window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  return true;
}

/**
 * @param {unknown} rawUrl
 * @param {{ origin?: string, enabled?: boolean, allowedHosts?: Set<string> }} [opts]
 * @returns {string}
 */
function cachedStorageImageUrl(rawUrl, opts) {
  if (rawUrl == null) return '';
  const s = String(rawUrl).trim();
  if (!s) return '';
  if (s.startsWith('blob:') || s.startsWith('data:') || s.startsWith('/')) return s;
  if (!isProxyEnabled(opts)) return s;

  const parsed = parseAllowedStorageUrl(s, opts);
  if (!parsed) return s;

  const rel = proxyPathFor(parsed.bucket, parsed.objectPath);
  const origin = opts && opts.origin != null ? String(opts.origin).replace(/\/+$/, '') : '';
  return origin ? `${origin}${rel}` : rel;
}

/**
 * Resuelve la petición del proxy a una URL de Storage permitida.
 * @param {{ pathSegments?: string[], queryUrl?: string, env?: NodeJS.ProcessEnv }} input
 */
function resolveStorageImageRequest(input) {
  const env = (input && input.env) || (typeof process !== 'undefined' ? process.env : {}) || {};
  const allowedHosts = allowedStorageHostsFromEnv(env);
  const queryUrl = input && input.queryUrl;

  if (queryUrl) {
    const parsed = parseAllowedStorageUrl(queryUrl, {
      allowedHosts: allowedHosts.size > 0 ? allowedHosts : undefined,
    });
    if (!parsed) {
      return { ok: false, status: 400, message: 'URL de imagen no permitida' };
    }
    if (allowedHosts.size > 0 && !allowedHosts.has(parsed.host)) {
      return { ok: false, status: 400, message: 'Host de Storage no permitido' };
    }
    if (allowedHosts.size === 0 && !isSupabaseStorageHost(parsed.host)) {
      return { ok: false, status: 400, message: 'Host de Storage no permitido' };
    }
    return {
      ok: true,
      sourceUrl: parsed.sourceUrl,
      bucket: parsed.bucket,
      objectPath: parsed.objectPath,
    };
  }

  const segments = ((input && input.pathSegments) || []).map((s) => String(s || '')).filter(Boolean);
  if (segments.length < 2) {
    return { ok: false, status: 400, message: 'Ruta de imagen inválida' };
  }
  const bucket = segments[0];
  const objectPath = segments.slice(1).join('/');
  if (!allowedBucketsSet().has(bucket) || !isSafeObjectPath(objectPath)) {
    return { ok: false, status: 400, message: 'Ruta de imagen no permitida' };
  }

  const host = primaryStorageHost(allowedHosts);
  if (!host) {
    return { ok: false, status: 503, message: 'Origen de Storage no configurado' };
  }
  return {
    ok: true,
    sourceUrl: `https://${host}${STORAGE_PUBLIC_PREFIX}${bucket}/${objectPath}`,
    bucket,
    objectPath,
  };
}

function pathSegmentsFromReq(req) {
  const q = (req && req.query) || {};
  if (q.p) {
    const p = Array.isArray(q.p) ? q.p.join('/') : String(q.p);
    return p.split('/').filter(Boolean).map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    });
  }
  if (q.path) {
    const parts = [].concat(q.path);
    return parts.map((seg) => {
      try {
        return decodeURIComponent(String(seg));
      } catch {
        return String(seg);
      }
    }).filter(Boolean);
  }
  const rawUrl = req && req.url ? String(req.url) : '';
  const qIdx = rawUrl.indexOf('?');
  const pathname = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);
  if (pathname.startsWith(PROXY_PREFIX) && pathname.length > PROXY_PREFIX.length) {
    return pathname
      .slice(PROXY_PREFIX.length)
      .split('/')
      .filter(Boolean)
      .map((seg) => {
        try {
          return decodeURIComponent(seg);
        } catch {
          return seg;
        }
      });
  }
  return [];
}

module.exports = {
  ALLOWED_BUCKETS,
  STORAGE_PUBLIC_PREFIX,
  PROXY_PREFIX,
  allowedStorageHostsFromEnv,
  primaryStorageHost,
  isSafeObjectPath,
  isSupabaseStorageHost,
  parseAllowedStorageUrl,
  cachedStorageImageUrl,
  resolveStorageImageRequest,
  pathSegmentsFromReq,
};
