/**
 * Proxy same-origin de imágenes públicas de Supabase Storage y del bucket privado de R2 (`/api/img/r2/...`).
 * Cachea en el edge (Vercel CDN) con s-maxage largo e immutable.
 * Solo permite hosts de nuestro proyecto y buckets catalog-images / vehicle-images.
 */
const {
  resolveStorageImageRequest,
  pathSegmentsFromReq,
} = require('../src/utils/cachedStorageImageUrl');
const { allowImgRateLimit, allowImgHotlink } = require('./_lib/imgAccessControl');
const { isBlockedClientIp } = require('./_lib/catalogBotGate');
const { fetchR2Object } = require('./_lib/r2Fetch');

const FETCH_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024;
const LONG_CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';

function sendText(res, status, message, cache) {
  res.status(status);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.send(message);
}

function setImageCacheHeaders(res) {
  res.setHeader('Cache-Control', LONG_CACHE);
  res.setHeader('CDN-Cache-Control', LONG_CACHE);
  res.setHeader('Vercel-CDN-Cache-Control', LONG_CACHE);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function isImageContentType(ct) {
  const s = String(ct || '').toLowerCase();
  return s.startsWith('image/');
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).setHeader('Allow', 'GET, HEAD').send('Method Not Allowed');
    return;
  }

  if (isBlockedClientIp(req)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  const limited = allowImgRateLimit(req);
  if (!limited.ok) {
    res.setHeader('Retry-After', String(limited.retryAfterSec || 1));
    sendText(res, 429, 'Too many requests');
    return;
  }

  const hotlink = allowImgHotlink(req);
  if (!hotlink.ok) {
    sendText(res, hotlink.status, hotlink.message);
    return;
  }

  const q = req.query || {};
  const queryUrl = q.u != null ? String(Array.isArray(q.u) ? q.u[0] : q.u) : '';
  const resolved = resolveStorageImageRequest({
    pathSegments: pathSegmentsFromReq(req),
    queryUrl: queryUrl || undefined,
  });

  if (!resolved.ok) {
    sendText(res, resolved.status, resolved.message, resolved.status === 503 ? 'no-store' : 'public, max-age=60');
    return;
  }

  let upstream;
  try {
    const ctrl =
      typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? AbortSignal.timeout(FETCH_MS)
        : undefined;
    if (resolved.provider === 'r2') {
      upstream = await fetchR2Object(resolved.bucket, resolved.objectPath, { signal: ctrl });
      if (!upstream) {
        sendText(res, 503, 'Origen R2 no configurado');
        return;
      }
    } else {
      upstream = await fetch(resolved.sourceUrl, {
        redirect: 'manual',
        headers: { Accept: 'image/*,*/*;q=0.8' },
        signal: ctrl,
      });
    }
  } catch (e) {
    console.error('[api/img] fetch failed', resolved.provider === 'r2' ? 'r2' : resolved.sourceUrl, e);
    const hint = e && /R2_ACCOUNT_ID|R2_JURISDICTION/.test(String(e.message || '')) ? `: ${e.message}` : '';
    sendText(res, 502, `Bad gateway fetching image${hint}`);
    return;
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    sendText(res, 400, 'Redirect de Storage no permitido');
    return;
  }
  if (upstream.status === 404) {
    sendText(res, 404, 'Not found', 'public, max-age=60');
    return;
  }
  if (!upstream.ok) {
    console.error('[api/img] upstream', resolved.provider === 'r2' ? 'r2' : resolved.sourceUrl, upstream.status);
    sendText(res, 502, `Bad gateway fetching image (${upstream.status})`);
    return;
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!isImageContentType(contentType)) {
    sendText(res, 400, 'Tipo de contenido no permitido');
    return;
  }

  const declaredLen = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BYTES) {
    sendText(res, 413, 'Imagen demasiado grande');
    return;
  }

  let buffer;
  try {
    const ab = await upstream.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) {
      sendText(res, 413, 'Imagen demasiado grande');
      return;
    }
    buffer = Buffer.from(ab);
  } catch (e) {
    console.error('[api/img] read failed', e);
    sendText(res, 502, 'Bad gateway fetching image');
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', contentType.split(';')[0].trim());
  res.setHeader('Content-Length', String(buffer.length));
  setImageCacheHeaders(res);
  const etag = upstream.headers.get('etag');
  if (etag) res.setHeader('ETag', etag);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.send(buffer);
};
