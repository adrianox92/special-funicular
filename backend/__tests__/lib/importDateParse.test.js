const {
  parseImportPurchaseDateToIso,
  parseImportCommercialReleaseYear,
} = require('../../lib/importDateParse');

describe('importDateParse', () => {
  describe('parseImportPurchaseDateToIso', () => {
    test('acepta ISO, hora o zona: usa la parte de fecha (calendario)', () => {
      expect(parseImportPurchaseDateToIso('2019-11-30')).toBe('2019-11-30');
      expect(parseImportPurchaseDateToIso('2019-11-30T12:00:00')).toBe('2019-11-30');
      expect(parseImportPurchaseDateToIso('2019-11-30T00:00:00.000Z')).toBe('2019-11-30');
    });

    test('d/m/Y y d-m-Y (europeo), años de 2 cifras', () => {
      expect(parseImportPurchaseDateToIso('5/3/2018')).toBe('2018-03-05');
      expect(parseImportPurchaseDateToIso('5/3/18')).toBe('2018-03-05');
      expect(parseImportPurchaseDateToIso('15-12-2019')).toBe('2019-12-15');
      expect(parseImportPurchaseDateToIso('15.03.2019')).toBe('2019-03-15');
    });

    test('Y/m/d o Y.m.d con una cifra en mes/día', () => {
      expect(parseImportPurchaseDateToIso('2019/2/1')).toBe('2019-02-01');
    });

    test('año sobrante en celda de fecha: primer día (YYYY)', () => {
      expect(parseImportPurchaseDateToIso(2020)).toBe('2020-01-01');
      expect(parseImportPurchaseDateToIso('2017')).toBe('2017-01-01');
    });

    test('números 1900–2100 int no son serial Excel', () => {
      expect(parseImportPurchaseDateToIso(2019)).toBe('2019-01-01');
    });

    test('serial Excel (días) y con decimales', () => {
      // 2020-01-01 aprox. en 1900 date system
      expect(parseImportPurchaseDateToIso(43831)).toBe('2020-01-01');
      const half = 43831 + 0.5;
      expect(parseImportPurchaseDateToIso(half)).toBe('2020-01-01');
    });

    test('serial en texto y coma decimal (EU)', () => {
      expect(parseImportPurchaseDateToIso('43831,5')).toBe('2020-01-01');
    });

    test('fechas con espacios o Date', () => {
      expect(parseImportPurchaseDateToIso('  2010-04-20  ')).toBe('2010-04-20');
      const d = new Date(2015, 4, 9);
      expect(parseImportPurchaseDateToIso(d)).toBe('2015-05-09');
    });
  });

  describe('parseImportCommercialReleaseYear', () => {
    test('año, texto y número', () => {
      expect(parseImportCommercialReleaseYear(2020)).toBe(2020);
      expect(parseImportCommercialReleaseYear('2014')).toBe(2014);
    });

    test('de fecha o ISO: extrae el año', () => {
      expect(parseImportCommercialReleaseYear('2019-06-15')).toBe(2019);
      expect(parseImportCommercialReleaseYear('3/1/2015')).toBe(2015);
    });

    test('de serial Excel', () => {
      expect(parseImportCommercialReleaseYear(43831)).toBe(2020);
      expect(parseImportCommercialReleaseYear('43831')).toBe(2020);
    });
  });
});
