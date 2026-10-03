import esLanding from '../../i18n/locales/es/landing.json';
import enLanding from '../../i18n/locales/en/landing.json';
import deLanding from '../../i18n/locales/de/landing.json';
import esLegal from '../../i18n/locales/es/legal.json';
import enLegal from '../../i18n/locales/en/legal.json';
import deLegal from '../../i18n/locales/de/legal.json';
import esSrm from '../../i18n/locales/es/slotRaceManager.json';
import enSrm from '../../i18n/locales/en/slotRaceManager.json';
import deSrm from '../../i18n/locales/de/slotRaceManager.json';
import esCatalog from '../../i18n/locales/es/catalog.json';
import enCatalog from '../../i18n/locales/en/catalog.json';
import deCatalog from '../../i18n/locales/de/catalog.json';
import esCommon from '../../i18n/locales/es/common.json';
import enCommon from '../../i18n/locales/en/common.json';
import deCommon from '../../i18n/locales/de/common.json';

function leafKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return leafKeys(value, path);
    }
    return [path];
  }).sort();
}

function expectSameKeys(es, en, de) {
  const keys = leafKeys(es);
  expect(leafKeys(en)).toEqual(keys);
  expect(leafKeys(de)).toEqual(keys);
}

describe('i18n key parity es/en/de', () => {
  test('landing', () => expectSameKeys(esLanding, enLanding, deLanding));
  test('legal', () => expectSameKeys(esLegal, enLegal, deLegal));
  test('slotRaceManager', () => expectSameKeys(esSrm, enSrm, deSrm));
  test('catalog', () => expectSameKeys(esCatalog, enCatalog, deCatalog));
  test('common cookies', () => {
    expectSameKeys(esCommon.cookies, enCommon.cookies, deCommon.cookies);
  });
});
