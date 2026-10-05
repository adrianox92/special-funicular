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
import esInventory from '../../i18n/locales/es/inventory.json';
import enInventory from '../../i18n/locales/en/inventory.json';
import deInventory from '../../i18n/locales/de/inventory.json';
import esSeller from '../../i18n/locales/es/seller.json';
import enSeller from '../../i18n/locales/en/seller.json';
import deSeller from '../../i18n/locales/de/seller.json';
import esHelp from '../../i18n/locales/es/help.json';
import enHelp from '../../i18n/locales/en/help.json';
import deHelp from '../../i18n/locales/de/help.json';
import esProfile from '../../i18n/locales/es/profile.json';
import enProfile from '../../i18n/locales/en/profile.json';
import deProfile from '../../i18n/locales/de/profile.json';
import esCompetitions from '../../i18n/locales/es/competitions.json';
import enCompetitions from '../../i18n/locales/en/competitions.json';
import deCompetitions from '../../i18n/locales/de/competitions.json';

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

  test('catalog tech spec labels: distancia entre ejes y eje delantero/trasero', () => {
    expect(esCatalog.techSpecs.fields.wheelbaseMm).toBe('Distancia entre ejes (mm)');
    expect(enCatalog.techSpecs.fields.wheelbaseMm).toBe('Wheelbase (mm)');
    expect(deCatalog.techSpecs.fields.wheelbaseMm).toBe('Radstand (mm)');
    expect(esCatalog.techSpecs.fields.frontAxleLengthMm).toBe('Eje delantero (mm)');
    expect(esCatalog.techSpecs.fields.rearAxleLengthMm).toBe('Eje trasero (mm)');
    expect(enCatalog.techSpecs.fields.frontAxleLengthMm).toBe('Front axle (mm)');
    expect(enCatalog.techSpecs.fields.rearAxleLengthMm).toBe('Rear axle (mm)');
    expect(deCatalog.techSpecs.fields.frontAxleLengthMm).toBe('Vorderachse (mm)');
    expect(deCatalog.techSpecs.fields.rearAxleLengthMm).toBe('Hinterachse (mm)');
    const axleLabels = [
      esCatalog.techSpecs.fields.frontAxleLengthMm,
      esCatalog.techSpecs.fields.rearAxleLengthMm,
      enCatalog.techSpecs.fields.frontAxleLengthMm,
      deCatalog.techSpecs.fields.frontAxleLengthMm,
    ].join(' ');
    expect(axleLabels.toLowerCase()).not.toMatch(/vía|via |track|achslänge|axle length|longitud de eje/);
    const fieldsJson = JSON.stringify({
      es: esCatalog.techSpecs.fields,
      en: enCatalog.techSpecs.fields,
      de: deCatalog.techSpecs.fields,
    });
    expect(fieldsJson).not.toMatch(/batalla/i);
    expect(fieldsJson).not.toMatch(/axleWidth|axle_width|Ancho de eje/i);
  });
  test('inventory', () => expectSameKeys(esInventory, enInventory, deInventory));
  test('seller', () => expectSameKeys(esSeller, enSeller, deSeller));
  test('help', () => expectSameKeys(esHelp, enHelp, deHelp));
  test('profile', () => expectSameKeys(esProfile, enProfile, deProfile));
  test('competitions manage', () => {
    expectSameKeys(esCompetitions.manage, enCompetitions.manage, deCompetitions.manage);
  });
  test('common cookies', () => {
    expectSameKeys(esCommon.cookies, enCommon.cookies, deCommon.cookies);
  });
});
