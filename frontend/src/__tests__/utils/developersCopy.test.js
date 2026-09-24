import es from '../../i18n/locales/es/developers.json';
import en from '../../i18n/locales/en/developers.json';
import de from '../../i18n/locales/de/developers.json';
import { DEVELOPERS_CHANGELOG } from '../../content/developersChangelog';
import { getDocumentTitle } from '../../utils/documentTitle';
import i18n from '../../i18n';
import {
  PARTNER_API_LOCAL_ORIGIN,
  PARTNER_API_PRODUCTION_ORIGIN,
  PARTNER_OPENAPI_PRODUCTION_URL,
  PARTNER_SWAGGER_LOCAL_URL,
  PARTNER_SWAGGER_PRODUCTION_URL,
} from '../../utils/partnerApiUrls';

const FORBIDDEN = [
  /slot\s*lap\s*timer/i,
  /slotlaptimer/i,
  /lap\s*counter/i,
  /ds-?200/i,
  /ds200-manager/i,
  /staging\.slotdatabase/i,
];

function leafEntries(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return leafEntries(value, path);
    }
    return [[path, String(value)]];
  });
}

function leafKeys(obj) {
  return leafEntries(obj)
    .map(([path]) => path)
    .sort();
}

describe('developers i18n', () => {
  test('mismas claves ES / EN / DE', () => {
    const keys = leafKeys(es);
    expect(leafKeys(en)).toEqual(keys);
    expect(leafKeys(de)).toEqual(keys);
    leafEntries(es).forEach(([path, value]) => {
      expect(value.length).toBeGreaterThan(0);
      expect(String(leafEntries(en).find(([p]) => p === path)?.[1] || '').length).toBeGreaterThan(0);
      expect(String(leafEntries(de).find(([p]) => p === path)?.[1] || '').length).toBeGreaterThan(0);
    });
  });

  test('copy pública no cita clientes internos ni staging (D13, D14)', () => {
    [es, en, de].forEach((bundle) => {
      const blob = leafEntries(bundle)
        .map(([, value]) => value)
        .join('\n');
      FORBIDDEN.forEach((re) => {
        expect(blob).not.toMatch(re);
      });
    });
  });

  test('changelog v1.0.0 tiene claves editables', () => {
    expect(DEVELOPERS_CHANGELOG[0].version).toBe('1.0.0');
    DEVELOPERS_CHANGELOG.forEach((entry) => {
      expect(es.changelog[entry.titleKey]).toBeTruthy();
      entry.noteKeys.forEach((key) => {
        expect(es.changelog[key]).toBeTruthy();
      });
    });
  });
});

describe('partner API URLs', () => {
  test('producción y local, sin staging', () => {
    expect(PARTNER_SWAGGER_PRODUCTION_URL).toBe('https://api.slotdatabase.es/api/docs');
    expect(PARTNER_OPENAPI_PRODUCTION_URL).toBe('https://api.slotdatabase.es/api/docs/openapi.yaml');
    expect(PARTNER_SWAGGER_LOCAL_URL).toBe('http://localhost:5001/api/docs');
    expect(PARTNER_API_PRODUCTION_ORIGIN).not.toMatch(/staging/i);
    expect(PARTNER_API_LOCAL_ORIGIN).not.toMatch(/staging/i);
  });
});

describe('documentTitle /developers', () => {
  test('título de sección Slot Database API', async () => {
    await i18n.loadNamespaces(['meta']);
    await i18n.changeLanguage('es');
    expect(getDocumentTitle('/developers')).toContain('Slot Database API');
    expect(getDocumentTitle('/en/developers')).toContain('Slot Database API');
  });
});
