const XLSX = require('xlsx');
const vehicleImport = require('../../lib/vehicleImport');

describe('vehicleImport', () => {
  test('parsePriceCell maneja coma decimal europea', () => {
    expect(vehicleImport.parsePriceCell('1.234,56')).toBeCloseTo(1234.56);
    expect(vehicleImport.parsePriceCell('99,50')).toBeCloseTo(99.5);
    expect(vehicleImport.parsePriceCell('42')).toBe(42);
  });

  test('parseBoolCell reconoce sí/no', () => {
    expect(vehicleImport.parseBoolCell('Sí')).toBe(true);
    expect(vehicleImport.parseBoolCell('no')).toBe(false);
    expect(vehicleImport.parseBoolCell('')).toBe(null);
  });

  test('parseScaleFactorCell acepta 1:32 y 32', () => {
    expect(vehicleImport.parseScaleFactorCell('1:32')).toBe(32);
    expect(vehicleImport.parseScaleFactorCell('1/43')).toBe(43);
    expect(vehicleImport.parseScaleFactorCell(24)).toBe(24);
  });

  test('inferColumnMapping asigna fabricante y modelo', () => {
    const headers = ['Marca del coche', 'Nombre modelo', 'Tipo vehiculo'];
    const rows = [
      { 'Marca del coche': 'NSR', 'Nombre modelo': '911', 'Tipo vehiculo': 'GT' },
      { 'Marca del coche': 'Scaleauto', 'Nombre modelo': 'Clio', 'Tipo vehiculo': 'Turismo' },
    ];
    const m = vehicleImport.inferColumnMapping(headers, rows);
    expect(m.manufacturer).toBe('Marca del coche');
    expect(m.model).toBe('Nombre modelo');
    expect(m.type).toBe('Tipo vehiculo');
  });

  test('suggestAfterImportForMapping lista Tipo si no está mapeado', () => {
    expect(vehicleImport.suggestAfterImportForMapping(null).some((x) => x.key === 'type')).toBe(true);
    expect(vehicleImport.suggestAfterImportForMapping({ type: 'ColA' })).toEqual([]);
  });

  test('mapRowToVehicleValues: sin tipo no es error; aviso por fila solo si la columna está mapeada y vacía', () => {
    const row1 = { A: 'M', B: 'X' };
    const m1 = { model: 'B', manufacturer: 'A', type: null, traction: null, motor_position: null, price: null, purchase_date: null, purchase_place: null, modified: null, digital: null, museo: null, taller: null, anotaciones: null, reference: null, scale_factor: null, commercial_release_year: null };
    const o1 = vehicleImport.mapRowToVehicleValues(row1, m1);
    expect(o1.errors).toEqual([]);
    expect(o1.warnings).toEqual([]);

    const row2 = { A: 'M', B: 'X', C: '' };
    const m2 = { ...m1, type: 'C' };
    const o2 = vehicleImport.mapRowToVehicleValues(row2, m2);
    expect(o2.errors).toEqual([]);
    expect(o2.warnings.length).toBe(1);
    expect(o2.warnings[0]).toMatch(/Sin tipo en esta fila/);
  });

  test('mapRowToVehicleValues con mapeo explícito', () => {
    const row = { A: 'Porsche', B: '991', C: 'GT', D: '123,45', E: '32' };
    const mapping = {
      manufacturer: 'A',
      model: 'B',
      type: 'C',
      price: 'D',
      scale_factor: 'E',
      traction: null,
      motor_position: null,
      purchase_date: null,
      purchase_place: null,
      modified: null,
      digital: null,
      museo: null,
      taller: null,
      anotaciones: null,
      reference: null,
      commercial_release_year: null,
    };
    const { values, errors } = vehicleImport.mapRowToVehicleValues(row, mapping);
    expect(errors).toEqual([]);
    expect(values.manufacturer).toBe('Porsche');
    expect(values.model).toBe('991');
    expect(values.type).toBe('GT');
    expect(values.price).toBeCloseTo(123.45);
    expect(values.scale_factor).toBe(32);
  });

  test('Excel: columna A vacía + cabecera en fila 3 → Fabricante en clave/índice F (letra F)', () => {
    const aoa = [
      ['', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
      ['', 'ID', 'Ref.', 'Marca', 'Modelo / Versión', 'Fabricante', 'Color', 'Año', 'Dorsal'],
      ['', '1', 'R1', 'M', 'V', 'Scalextric Tech', 'rojo', 2020, 7],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Scalextric');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const { headers, firstDataRow1Based, rows } = vehicleImport.parseImportFileBuffer(buf, {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      originalname: 'coches.xlsx',
      sheetIndex: 0,
    });
    expect(firstDataRow1Based).toBe(4);
    const fabIdx = headers.indexOf('Fabricante');
    expect(fabIdx).toBe(5);
    expect(vehicleImport.excelColumnLetters(fabIdx)).toBe('F');
    expect(rows[0].Fabricante).toMatch(/Scalextric/);
  });

  test('parseImportFileBuffer lee CSV con cabecera', () => {
    const buf = Buffer.from('modelo,fabricante,tipo\nX,Y,Z\n', 'utf8');
    const { rows, headers } = vehicleImport.parseImportFileBuffer(buf, {
      mimetype: 'text/csv',
      originalname: 't.csv',
    });
    expect(headers).toEqual(['modelo', 'fabricante', 'tipo']);
    expect(rows).toHaveLength(1);
    expect(rows[0].modelo).toBe('X');
  });

  test('excelColumnLetters: índice 0 → A, 25 → Z, 26 → AA', () => {
    expect(vehicleImport.excelColumnLetters(0)).toBe('A');
    expect(vehicleImport.excelColumnLetters(25)).toBe('Z');
    expect(vehicleImport.excelColumnLetters(26)).toBe('AA');
  });

  test('mapSampleRowsToPreviewItems aplica el mapeo a filas de muestra', () => {
    const sampleDataRows = [
      { index: 0, sheetRow: 2, data: { A: '911', B: 'Porsche', C: 'GT' } },
    ];
    const mapping = {
      model: 'A',
      manufacturer: 'B',
      type: 'C',
      traction: null,
      motor_position: null,
      price: null,
      purchase_date: null,
      purchase_place: null,
      modified: null,
      digital: null,
      museo: null,
      taller: null,
      anotaciones: null,
      reference: null,
      scale_factor: null,
      commercial_release_year: null,
    };
    const items = vehicleImport.mapSampleRowsToPreviewItems(sampleDataRows, mapping);
    expect(items[0].ok).toBe(true);
    expect(items[0].values.model).toBe('911');
    expect(items[0].values.manufacturer).toBe('Porsche');
    expect(items[0].values.type).toBe('GT');
  });

  test('normalizeBlankColumnHeaders renombra __EMPTY a A, B, C', () => {
    const rows = [
      { __EMPTY: 'a', __EMPTY_1: 'b', Marca: 'X' },
      { __EMPTY: 'c', __EMPTY_1: 'd', Marca: 'Y' },
    ];
    const { rows: out, headers } = vehicleImport.normalizeBlankColumnHeaders(rows);
    expect(headers[0]).toBe('A');
    expect(headers[1]).toBe('B');
    expect(headers[2]).toBe('Marca');
    expect(out[0].A).toBe('a');
    expect(out[0].B).toBe('b');
    expect(out[0].Marca).toBe('X');
  });

  test('isExcelImportFile reconoce xlsm y xlsb por nombre o MIME', () => {
    const { isExcelImportFile } = vehicleImport;
    expect(isExcelImportFile('', 'datos.xlsm')).toBe(true);
    expect(isExcelImportFile('', 'libro.xlsb')).toBe(true);
    expect(isExcelImportFile('application/vnd.ms-excel.sheet.macroEnabled.12', 'a.xlsx')).toBe(true);
    expect(isExcelImportFile('text/plain', 'notas.txt')).toBe(false);
  });

  test('duplicateKeyForVehicle usa referencia o fabricante+modelo', () => {
    expect(
      vehicleImport.duplicateKeyForVehicle({
        reference: 'ABC-12',
        manufacturer: 'M',
        model: 'X',
      })
    ).toMatch(/ref:ABC-12/);
    expect(
      vehicleImport.duplicateKeyForVehicle({
        reference: null,
        manufacturer: 'M',
        model: 'X',
      })
    ).toBe('m:m|mod:x');
  });
});
