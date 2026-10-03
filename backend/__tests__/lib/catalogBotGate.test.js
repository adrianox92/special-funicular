'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const {
  classifyCatalogUserAgent,
  decideCatalogAccess,
  verifyGoogleCrawlerIp,
  resetGoogleVerifyCache,
  catalogBotGateMiddleware,
  catalogInternalHeaders,
  INTERNAL_SSR_UA,
  isGoogleRdnsHostname,
} = require('../../lib/catalogBotGate');

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0';
const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const GOOGLEBOT_IMAGE = 'Googlebot-Image/1.0';
const GOOGLEBOT_VIDEO = 'Googlebot-Video/1.0';
const GOOGLE_INSPECT =
  'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)';
const GOOGLE_EXTENDED =
  'Mozilla/5.0 (compatible; Google-Extended/1.0; +https://developers.google.com/search/docs/crawling-indexing/google-extended)';

describe('classifyCatalogUserAgent', () => {
  test('navegadores habituales', () => {
    expect(classifyCatalogUserAgent(CHROME)).toBe('browser');
    expect(classifyCatalogUserAgent(FIREFOX)).toBe('browser');
  });

  test('familia de indexación de Google', () => {
    expect(classifyCatalogUserAgent(GOOGLEBOT)).toBe('google-index');
    expect(classifyCatalogUserAgent(GOOGLEBOT_IMAGE)).toBe('google-index');
    expect(classifyCatalogUserAgent(GOOGLEBOT_VIDEO)).toBe('google-index');
    expect(classifyCatalogUserAgent(GOOGLE_INSPECT)).toBe('google-index');
  });

  test('crawlers de Google que no indexan Search no pasan', () => {
    expect(classifyCatalogUserAgent(GOOGLE_EXTENDED)).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('GoogleOther')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('Mozilla/5.0 (compatible; Storebot-Google/1.0)')).toBe(
      'blocked-bot',
    );
  });

  test('otros motores e IA', () => {
    expect(classifyCatalogUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(
      'blocked-bot',
    );
    expect(classifyCatalogUserAgent('GPTBot')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('ClaudeBot')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('CCBot/2.0')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('PerplexityBot')).toBe('blocked-bot');
  });

  test('herramientas de scraping', () => {
    expect(classifyCatalogUserAgent('curl/8.5.0')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('Wget/1.21')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('python-requests/2.31.0')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('Scrapy/2.11.0')).toBe('blocked-bot');
    expect(classifyCatalogUserAgent('node')).toBe('blocked-bot');
  });

  test('SSR interno y vacío', () => {
    expect(classifyCatalogUserAgent(INTERNAL_SSR_UA)).toBe('internal-ssr');
    expect(classifyCatalogUserAgent('')).toBe('unknown');
    expect(classifyCatalogUserAgent('CustomClient/1.0')).toBe('unknown');
  });
});

describe('decideCatalogAccess', () => {
  const env = {};

  test('Chrome pasa sin verificar IP', async () => {
    const d = await decideCatalogAccess({ userAgent: CHROME, ip: '1.2.3.4', env });
    expect(d).toEqual({ allow: true, reason: 'browser', class: 'browser' });
  });

  test('GPTBot / Bing / curl no pasan', async () => {
    for (const ua of ['GPTBot', 'bingbot', 'curl/8.0', 'ClaudeBot', '']) {
      const d = await decideCatalogAccess({ userAgent: ua, ip: '1.2.3.4', env });
      expect(d.allow).toBe(false);
    }
  });

  test('Googlebot verificado pasa', async () => {
    const d = await decideCatalogAccess(
      { userAgent: GOOGLEBOT, ip: '66.249.66.1', env },
      { verifyGoogleCrawlerIp: async () => ({ ok: true, reason: 'verified' }) },
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toBe('google-verified');
  });

  test('Googlebot con IP que no es de Google no pasa', async () => {
    const d = await decideCatalogAccess(
      { userAgent: GOOGLEBOT, ip: '203.0.113.9', env },
      { verifyGoogleCrawlerIp: async () => ({ ok: false, reason: 'not-google-rdns' }) },
    );
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('google-unverified:not-google-rdns');
  });

  test('fallo de red al verificar Googlebot no tumba el índice (fail-open)', async () => {
    const d = await decideCatalogAccess(
      { userAgent: GOOGLEBOT, ip: '66.249.66.1', env },
      { verifyGoogleCrawlerIp: async () => ({ ok: false, reason: 'lookup-error' }) },
    );
    expect(d.allow).toBe(true);
    expect(d.reason).toBe('google-verify-error-open');
  });

  test('InspectionTool / Image / Video verificados pasan', async () => {
    for (const ua of [GOOGLE_INSPECT, GOOGLEBOT_IMAGE, GOOGLEBOT_VIDEO]) {
      const d = await decideCatalogAccess(
        { userAgent: ua, ip: '66.249.66.1', env },
        { verifyGoogleCrawlerIp: async () => ({ ok: true, reason: 'verified' }) },
      );
      expect(d.allow).toBe(true);
    }
  });

  test('SSR interno sin secreto configurado pasa (deploy sin env extra)', async () => {
    const d = await decideCatalogAccess({
      userAgent: INTERNAL_SSR_UA,
      env: {},
    });
    expect(d.allow).toBe(true);
    expect(d.reason).toBe('internal-ssr');
  });

  test('SSR interno exige el secreto si está configurado', async () => {
    const denied = await decideCatalogAccess({
      userAgent: INTERNAL_SSR_UA,
      internalToken: 'nope',
      env: { CATALOG_INTERNAL_SECRET: 's3cret' },
    });
    expect(denied.allow).toBe(false);

    const allowed = await decideCatalogAccess({
      userAgent: INTERNAL_SSR_UA,
      internalToken: 's3cret',
      env: { CATALOG_INTERNAL_SECRET: 's3cret' },
    });
    expect(allowed.allow).toBe(true);
    expect(allowed.reason).toBe('internal-ssr-secret');
  });

  test('CATALOG_BOT_GATE=off desactiva el filtro', async () => {
    const d = await decideCatalogAccess({
      userAgent: 'GPTBot',
      env: { CATALOG_BOT_GATE: 'off' },
    });
    expect(d.allow).toBe(true);
    expect(d.reason).toBe('gate-disabled');
  });
});

describe('verifyGoogleCrawlerIp', () => {
  beforeEach(() => resetGoogleVerifyCache());

  test('PTR + A coincidente', async () => {
    const result = await verifyGoogleCrawlerIp('66.249.66.1', {
      reverseLookup: async () => ['crawl-66-249-66-1.googlebot.com'],
      forwardLookup: async () => [{ address: '66.249.66.1', family: 4 }],
    });
    expect(result).toEqual({ ok: true, reason: 'verified' });
  });

  test('PTR que no es de Google', async () => {
    const result = await verifyGoogleCrawlerIp('203.0.113.9', {
      reverseLookup: async () => ['scraper.example.net'],
      forwardLookup: async () => [{ address: '203.0.113.9', family: 4 }],
    });
    expect(result).toEqual({ ok: false, reason: 'not-google-rdns' });
  });

  test('hostname de Google pero A distinta (spoof)', async () => {
    const result = await verifyGoogleCrawlerIp('203.0.113.9', {
      reverseLookup: async () => ['crawl.googlebot.com'],
      forwardLookup: async () => [{ address: '66.249.66.1', family: 4 }],
    });
    expect(result).toEqual({ ok: false, reason: 'fwd-mismatch' });
  });

  test('isGoogleRdnsHostname solo acepta googlebot.com / google.com', () => {
    expect(isGoogleRdnsHostname('crawl-1.googlebot.com')).toBe(true);
    expect(isGoogleRdnsHostname('geo.google.com')).toBe(true);
    expect(isGoogleRdnsHostname('notgoogle.com')).toBe(false);
    expect(isGoogleRdnsHostname('googlebot.com.evil.example')).toBe(false);
  });
});

describe('catalogInternalHeaders', () => {
  test('añade el secreto solo si existe', () => {
    expect(catalogInternalHeaders({})).toEqual({
      Accept: 'application/json, */*',
      'User-Agent': INTERNAL_SSR_UA,
    });
    expect(catalogInternalHeaders({ CATALOG_INTERNAL_SECRET: 'abc' })['X-Catalog-Internal']).toBe(
      'abc',
    );
  });
});

describe('catalogBotGateMiddleware (HTTP)', () => {
  function appWithGate(deps) {
    const app = express();
    app.use(catalogBotGateMiddleware({ env: {}, deps }));
    app.get('/api/public/catalog/items', (_req, res) => res.json({ items: ['ref-1'] }));
    return app;
  }

  test('navegador recibe el listado; bot no', async () => {
    const app = appWithGate({
      verifyGoogleCrawlerIp: async () => ({ ok: true, reason: 'verified' }),
    });

    const browser = await request(app)
      .get('/api/public/catalog/items')
      .set('User-Agent', CHROME)
      .expect(200);
    expect(browser.body).toEqual({ items: ['ref-1'] });

    const bot = await request(app)
      .get('/api/public/catalog/items')
      .set('User-Agent', 'GPTBot')
      .expect(403);
    expect(bot.body.code).toBe('catalog_bot_denied');
    expect(bot.headers['x-robots-tag']).toMatch(/noindex/);

    const curl = await request(app)
      .get('/api/public/catalog/items')
      .set('User-Agent', 'curl/8.5.0')
      .expect(403);
    expect(curl.body.code).toBe('catalog_bot_denied');
  });

  test('Googlebot verificado recibe el listado; Googlebot falso no', async () => {
    const app = appWithGate({
      verifyGoogleCrawlerIp: async (ip) =>
        ip === '66.249.66.1'
          ? { ok: true, reason: 'verified' }
          : { ok: false, reason: 'not-google-rdns' },
    });

    await request(app)
      .get('/api/public/catalog/items')
      .set('User-Agent', GOOGLEBOT)
      .set('X-Forwarded-For', '66.249.66.1')
      .expect(200);

    await request(app)
      .get('/api/public/catalog/items')
      .set('User-Agent', GOOGLEBOT)
      .set('X-Forwarded-For', '203.0.113.9')
      .expect(403);
  });

  test('OPTIONS (CORS) no se filtra', async () => {
    const app = appWithGate();
    const res = await request(app)
      .options('/api/public/catalog/items')
      .set('User-Agent', 'curl/8.5.0');
    expect(res.status).not.toBe(403);
  });
});

describe('robots.txt del catálogo', () => {
  const robots = fs.readFileSync(
    path.join(__dirname, '../../../frontend/public/robots.txt'),
    'utf8',
  );

  test('bloquea el catálogo para * y lo abre a Googlebot', () => {
    const star = robots.split('User-agent: Googlebot')[0];
    expect(star).toContain('Disallow: /catalogo');
    expect(star).toContain('Disallow: /en/catalog');
    expect(star).toContain('Disallow: /de/katalog');
    expect(star).toContain('Disallow: /api/public/catalog');
    expect(star).toContain('Disallow: /sitemap-catalog-');

    const google = robots.split('User-agent: Googlebot')[1].split('User-agent: Googlebot-Image')[0];
    expect(google).toContain('Allow: /catalogo');
    expect(google).toContain('Allow: /en/catalog');
    expect(google).toContain('Allow: /de/katalog');
    expect(google).toContain('Allow: /sitemap-catalog-');
  });
});

describe('copia frontend/backend del módulo', () => {
  test('frontend/api/_lib/catalogBotGate.js es idéntico a backend/lib', () => {
    const backend = fs.readFileSync(path.join(__dirname, '../../lib/catalogBotGate.js'), 'utf8');
    const frontend = fs.readFileSync(
      path.join(__dirname, '../../../frontend/api/_lib/catalogBotGate.js'),
      'utf8',
    );
    expect(frontend).toBe(backend);
  });
});
