#!/usr/bin/env node
/**
 * Lanza peticiones HTTP repetidas y muestra la memoria RSS del **proceso de este script**
 * (no del servidor). Para medir el servidor, usar GET /health desde otro terminal o
 * `curl` contra Render y revisar los logs [MEM] en el dashboard.
 *
 * Uso:
 *   node scripts/mem-probe.js [URL] [iteraciones]
 *
 * Ejemplos:
 *   node scripts/mem-probe.js http://127.0.0.1:5001/health 500
 *   node scripts/mem-probe.js http://127.0.0.1:5001/sitemap.xml 200
 */

const http = require('http');
const https = require('https');

const urlStr = process.argv[2] || 'http://127.0.0.1:5001/health';
const iterations = Math.max(1, parseInt(process.argv[3] || '200', 10) || 200);

function requestOnce(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(url, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
  });
}

async function main() {
  console.log(`mem-probe: ${iterations} GET ${urlStr}`);
  let prev = process.memoryUsage().rss;
  for (let i = 0; i <= iterations; i++) {
    await requestOnce(urlStr);
    if (i > 0 && i % 50 === 0) {
      const rss = process.memoryUsage().rss;
      const deltaKb = Math.round((rss - prev) / 1024);
      console.log(
        `[iter ${i}] proceso script RSS ~${Math.round(rss / 1024 / 1024)} MB (Δ vs bloque anterior ${deltaKb} KB)`,
      );
      prev = rss;
    }
  }
  console.log('mem-probe: terminado');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
