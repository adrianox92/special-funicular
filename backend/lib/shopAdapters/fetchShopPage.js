const { execFile } = require('child_process');

/** User-Agent identificable. Los adaptadores deben usarlo al pedir HTML de una tienda. */
const SHOP_USER_AGENT = 'SlotDatabaseCatalogBot/1.0 (+https://www.slotdatabase.es)';

function curlShopPage(url, timeoutMs = 12000) {
  const bin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  return new Promise((resolve, reject) => {
    execFile(bin, [
      '-sS', '-L', '--max-redirs', '5', '--max-time', String(seconds),
      '-A', SHOP_USER_AGENT,
      '-H', 'Accept: text/html,application/xhtml+xml',
      '-w', '\n__SLOTDB_HTTP__%{http_code}',
      url,
    ], { maxBuffer: 3 * 1024 * 1024, windowsHide: true, encoding: 'utf8' }, (err, stdout) => {
      const output = String(stdout || '');
      const marker = '\n__SLOTDB_HTTP__';
      const at = output.lastIndexOf(marker);
      if (at < 0) {
        reject(err || new Error('curl sin código HTTP'));
        return;
      }
      resolve({
        status: Number(output.slice(at + marker.length).trim()),
        body: output.slice(0, at),
      });
    });
  });
}

/**
 * GET de una ficha de producto.
 * 404 y 410 devuelven null (el producto ya no está). Otro estado HTTP lanza.
 * Un 403 de Node se reintenta con curl: Cloudflare deja pasar ese cliente
 * y bloquea el TLS de Node (Ministry of Hobby).
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, curlImpl?: typeof curlShopPage }} [opts]
 * @returns {Promise<string|null>}
 */
async function fetchShopPage(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || global.fetch;
  const timeoutMs = opts.timeoutMs ?? 12000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': SHOP_USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (res.status === 404 || res.status === 410) return null;
    if (res.status === 403 && /^https:\/\//i.test(url)) {
      return finishCurl(url, timeoutMs, opts.curlImpl || curlShopPage);
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function finishCurl(url, timeoutMs, curlImpl) {
  const result = await curlImpl(url, timeoutMs);
  if (result.status === 404 || result.status === 410) return null;
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`HTTP ${result.status}`);
  }
  return result.body;
}

module.exports = {
  SHOP_USER_AGENT,
  fetchShopPage,
  curlShopPage,
};
