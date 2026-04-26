/**
 * Importación heurística de vehículos desde CSV/Excel.
 * Columnas con nombres distintos → mapeo sugerido + normalización de tipos.
 */

const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const {
  parseImportPurchaseDateToIso,
  parseImportCommercialReleaseYear,
} = require('./importDateParse');

const DEFAULT_SCALE_FACTOR = 32;

/**
 * xlsx, xlsm, xlsb, xls, xltx, xltm — el paquete `xlsx` (SheetJS) los lee como libro.
 * @param {string} mimetype
 * @param {string} fileName
 */
/**
 * Letra de columna estilo Excel (0 → A, 25 → Z, 26 → AA).
 * @param {number} index
 */
function excelColumnLetters(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Cabecera vacía o generada por SheetJS/csv (p. ej. __EMPTY, __EMPTY_1).
 * @param {unknown} h
 */
function isBlankOrAutoHeaderName(h) {
  if (h == null) return true;
  const s = String(h).trim();
  if (s === '') return true;
  if (/^__EMPTY(_\d+)?$/i.test(s)) return true;
  return false;
}

/**
 * Sustituye __EMPTY* y cabeceras vacías por A, B, C… (como en Excel) para los desplegables de mapeo.
 * @param {Record<string, unknown>[]} rows
 * @returns {{ rows: Record<string, unknown>[], headers: string[] }}
 */
function normalizeBlankColumnHeaders(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rows: Array.isArray(rows) ? rows : [], headers: [] };
  }
  const order = Object.keys(rows[0]);
  const rename = new Map();
  const taken = new Set();
  for (const k of order) {
    if (!isBlankOrAutoHeaderName(k)) taken.add(String(k).trim());
  }
  for (let i = 0; i < order.length; i++) {
    const oldKey = order[i];
    if (!isBlankOrAutoHeaderName(oldKey)) continue;
    let name = excelColumnLetters(i);
    if (taken.has(name)) {
      name = `Col${excelColumnLetters(i)}`;
    }
    if (taken.has(name)) {
      name = `Col${i + 1}`;
    }
    let n = 0;
    while (taken.has(name)) {
      n += 1;
      name = `Col${i + 1}_${n}`;
    }
    taken.add(name);
    rename.set(oldKey, name);
  }
  if (rename.size === 0) {
    return { rows, headers: order };
  }
  const newRows = rows.map((row) => {
    const out = {};
    for (const k of order) {
      const newKey = rename.has(k) ? rename.get(k) : k;
      if (Object.prototype.hasOwnProperty.call(row, k)) {
        out[newKey] = row[k];
      }
    }
    return out;
  });
  const newHeaders = order.map((k) => (rename.has(k) ? rename.get(k) : k));
  return { rows: newRows, headers: newHeaders };
}

function isExcelImportFile(mimetype, fileName) {
  const m = String(mimetype || '').toLowerCase();
  const n = String(fileName || '');
  if (m.includes('spreadsheet')) return true;
  if (m.includes('excel')) return true;
  if (m.startsWith('application/vnd.ms-excel')) return true;
  if (m.includes('ms-excel.sheet.macro')) return true;
  if (m.includes('sheet.bin')) return true;
  if (m.includes('spreadsheetml.template')) return true;
  if (m.includes('template.macro')) return true;
  return /\.(xlsx|xlsm|xlsb|xls|xltx|xltm)$/i.test(n);
}

/**
 * Fila de cabecera: la que más celdas no vacías tiene en las primeras filas (p. ej. títulos en fila 3
 * con filas 1-2 en blanco).
 * @param {unknown[][]} aoa
 * @param {number} [maxScan]
 */
function findHeaderRowIndexInAoa(aoa, maxScan = 40) {
  if (!Array.isArray(aoa) || aoa.length === 0) return 0;
  const scan = Math.min(maxScan, aoa.length);
  let bestI = 0;
  let bestC = 0;
  for (let i = 0; i < scan; i++) {
    const row = aoa[i] || [];
    const c = row.filter((cell) => cell != null && String(cell).trim() !== '').length;
    if (c > bestC) {
      bestC = c;
      bestI = i;
    }
  }
  return bestC > 0 ? bestI : 0;
}

/**
 * Asegura claves únicas para cabeceras duplicadas.
 * @param {string} key
 * @param {Set<string>} used
 * @param {number} j
 */
function makeUniqueKey(key, used, j) {
  let k = key;
  let n = 0;
  while (used.has(k)) {
    n += 1;
    k = `${key}_${j + 1}_${n}`;
  }
  return k;
}

/**
 * `sheet_to_json` en modo objeto **omite** columnas vacías: la columna F pasa a ser la 5.ª clave y se
 * etiquetaba con la letra E. Con matriz 2D conservamos j real → letra Excel (A, B, …) alinear con la vista.
 * @param {import('xlsx').WorkSheet} sheet
 * @returns {{ rows: Record<string, unknown>[], headers: string[], firstDataRow1Based: number }}
 */
function parseExcelSheetToRowsWithColAlignment(sheet) {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (!Array.isArray(aoa) || aoa.length === 0) {
    return { rows: [], headers: [], firstDataRow1Based: 2 };
  }
  const headerIndex = findHeaderRowIndexInAoa(aoa);
  const header = aoa[headerIndex] || [];
  const scanEnd = Math.min(aoa.length, headerIndex + 2000);
  let width = header.length;
  for (let r = headerIndex; r < scanEnd; r++) {
    const row = aoa[r] || [];
    width = Math.max(width, row.length);
  }
  if (width === 0) {
    return { rows: [], headers: [], firstDataRow1Based: headerIndex + 2 };
  }
  const used = new Set();
  const headerKeys = [];
  for (let j = 0; j < width; j++) {
    const cell = header[j];
    const t = cell == null ? '' : String(cell).trim();
    let k = t === '' || isBlankOrAutoHeaderName(t) ? excelColumnLetters(j) : t;
    k = makeUniqueKey(String(k), used, j);
    used.add(k);
    headerKeys.push(k);
  }
  const rows = [];
  for (let r = headerIndex + 1; r < aoa.length; r++) {
    const line = aoa[r] || [];
    const o = {};
    for (let j = 0; j < width; j++) {
      const v = line[j];
      o[headerKeys[j]] = v == null || v === undefined ? '' : v;
    }
    rows.push(o);
  }
  const firstDataRow1Based = headerIndex + 2;
  return { rows, headers: headerKeys, firstDataRow1Based };
}

/** Campos destino en `vehicles` (excl. user_id, imágenes). */
const VEHICLE_IMPORT_TARGET_FIELDS = [
  { key: 'model', label: 'Modelo', required: true },
  { key: 'manufacturer', label: 'Marca', required: true },
  { key: 'type', label: 'Tipo', required: false },
  { key: 'traction', label: 'Tracción', required: false },
  { key: 'motor_position', label: 'Posición motor', required: false },
  { key: 'price', label: 'Precio (€)', required: false },
  { key: 'purchase_date', label: 'Fecha compra', required: false },
  { key: 'purchase_place', label: 'Lugar compra', required: false },
  { key: 'modified', label: 'Modificado', required: false },
  { key: 'digital', label: 'Digital', required: false },
  { key: 'museo', label: 'Museo', required: false },
  { key: 'taller', label: 'Taller', required: false },
  { key: 'anotaciones', label: 'Anotaciones', required: false },
  { key: 'reference', label: 'Referencia', required: false },
  { key: 'scale_factor', label: 'Escala (denominador)', required: false },
  { key: 'commercial_release_year', label: 'Año comercialización', required: false },
];

const IGNORE_FIELD = '__ignore__';

/**
 * En la ficha de vehículo (p. ej. alta manual) son obligatorios modelo, fabricante y tipo;
 * en el importador solo exigimos marca+modelo. Si el usuario no mapea el tipo, conviene
 * rellenarlo tras importar.
 * @type {{ key: string, label: string, hint: string }[]}
 */
const VEHICLE_SUGGEST_COMPLETE_IN_APP_IF_UNMAPPED = [
  {
    key: 'type',
    label: 'Tipo',
    /** Texto orientativo (p. ej. toasts o integraciones) */
    hint: 'Tras importar, edita el vehículo y elige el tipo (obligatorio en el formulario de alta).',
  },
];

/**
 * @param {Record<string, string | null | undefined> | null | undefined} mapping
 * @returns {{ key: string, label: string, hint: string }[]}
 */
function suggestAfterImportForMapping(mapping) {
  if (!mapping || typeof mapping !== 'object') return [...VEHICLE_SUGGEST_COMPLETE_IN_APP_IF_UNMAPPED];
  return VEHICLE_SUGGEST_COMPLETE_IN_APP_IF_UNMAPPED.filter((f) => {
    const col = mapping[f.key];
    return col == null || col === '' || col === IGNORE_FIELD;
  });
}

/**
 * @param {string} s
 */
function stripDiacritics(s) {
  return String(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * @param {string} h
 */
function normalizeHeaderForMatch(h) {
  return stripDiacritics(String(h ?? '').trim())
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} h
 */
function headerSlug(h) {
  return normalizeHeaderForMatch(h).replace(/\s+/g, '_');
}

/** @type {Record<string, string[]>} keyword → lista de sinónimos (snake o frase) */
const FIELD_KEYWORD_HINTS = {
  // Evitar "coche" suelto: p.ej. "Marca del coche" es fabricante, no modelo.
  model: ['modelo', 'model', 'nombre', 'name', 'car', 'vehiculo', 'vehicle', 'slot', 'denominacion', 'denominación'],
  manufacturer: ['fabricante', 'manufacturer', 'marca', 'brand', 'make', 'maker', 'company'],
  type: ['tipo', 'type', 'categoria', 'categoría', 'category', 'clase', 'class'],
  traction: ['traccion', 'tracción', 'traction', 'drive', 'awd', 'rwd', 'fwd'],
  motor_position: [
    'motor_position',
    'posicion_motor',
    'posición_motor',
    'pos motor',
    'layout',
    'inline',
    'transverse',
  ],
  price: ['precio', 'price', 'cost', 'coste', 'importe', 'eur', '€', 'pvp'],
  purchase_date: [
    'fecha_compra',
    'fecha compra',
    'purchase_date',
    'comprado',
    'adquisicion',
    'adquisición',
    'date_purchase',
  ],
  purchase_place: [
    'lugar',
    'purchase_place',
    'tienda',
    'shop',
    'donde',
    'origen',
    'vendedor',
  ],
  modified: ['modificado', 'modified', 'tuning', 'alterado'],
  digital: ['digital', 'dsc', 'digitalizado'],
  museo: ['museo', 'museum', 'coleccion', 'colección', 'exposicion'],
  taller: ['taller', 'workshop', 'reparacion', 'reparación'],
  anotaciones: ['anotaciones', 'notas', 'notes', 'comentarios', 'observaciones', 'descripcion', 'descripción'],
  reference: ['referencia', 'reference', 'ref', 'sku', 'codigo', 'código', 'part number', 'pn'],
  scale_factor: ['escala', 'scale', 'scale_factor', '1/32', '1:32', 'denominador'],
  commercial_release_year: [
    'año',
    'ano',
    'year',
    'commercial_release',
    'lanzamiento',
    'release',
    'comercializacion',
    'comercialización',
  ],
};

/**
 * @param {string} cell
 */
function parseBoolCell(cell) {
  if (cell == null || cell === '') return null;
  if (typeof cell === 'boolean') return cell;
  const s = String(cell).trim().toLowerCase();
  if (['1', 'true', 'yes', 'sí', 'si', 'x', 's', 'y'].includes(s)) return true;
  if (['0', 'false', 'no', 'n'].includes(s)) return false;
  return null;
}

/**
 * @param {string|number} raw
 */
function parsePriceCell(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  let s = String(raw).trim().replace(/\s/g, '');
  // 1.234,56 → 1234.56
  if (/,/.test(s) && /\./.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/,/.test(s) && !/\./.test(s)) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) s = parts[0].replace(/\./g, '') + '.' + parts[1];
    else s = s.replace(/,/g, '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string|number} raw
 */
function parseScaleFactorCell(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    if (n >= 1 && n <= 999) return n;
  }
  const s = String(raw).trim();
  const m = s.match(/1\s*[:/]\s*(\d+)/i);
  if (m) {
    const d = parseInt(m[1], 10);
    if (d >= 1 && d <= 999) return d;
  }
  const n2 = parseInt(s.replace(/\D/g, ''), 10);
  if (Number.isFinite(n2) && n2 >= 1 && n2 <= 999) return n2;
  return null;
}

/**
 * @param {string|number} raw
 */
function parseOptionalMotorPositionFromCell(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'inline' || s === 'angular' || s === 'transverse') return s;
  if (s === 'en_linea' || s === 'en línea' || s === 'en linea' || s === 'lineal') return 'inline';
  if (s === 'en_angular' || s === 'en angular') return 'angular';
  if (s === 'transversal' || s === 'transversa' || s === 'en_transversal' || s === 'en transversal') {
    return 'transverse';
  }
  return null;
}

/**
 * Año de comercialización (entero) o null — ver importDateParse.
 * @param {string|number|Date} raw
 */
function parseYearFromCell(raw) {
  return parseImportCommercialReleaseYear(raw);
}

/**
 * Fecha de compra YYYY-MM-DD o null — ver importDateParse.
 * @param {string|number|Date} raw
 */
function parsePurchaseDateCell(raw) {
  return parseImportPurchaseDateToIso(raw);
}

/**
 * Puntuación de cabecera frente a un campo.
 * @param {string} norm
 * @param {string} fieldKey
 */
function headerScoreForField(norm, fieldKey) {
  const hints = FIELD_KEYWORD_HINTS[fieldKey] || [];
  let best = 0;
  const slug = norm.replace(/\s+/g, '_');
  for (const h of hints) {
    const hn = normalizeHeaderForMatch(h);
    if (norm === hn) best = Math.max(best, 100);
    else if (norm.includes(hn) || hn.includes(norm)) best = Math.max(best, 70);
    else if (slug === headerSlug(h)) best = Math.max(best, 90);
  }
  return best;
}

/**
 * @param {string} col
 * @param {unknown[]} values
 * @param {string} fieldKey
 */
function sampleScoreForField(col, values, fieldKey) {
  const nonEmpty = values
    .filter((v) => v != null && String(v).trim() !== '')
    .slice(0, 20)
    .map((v) => v);
  if (nonEmpty.length === 0) return 0;
  let score = 0;
  if (fieldKey === 'price') {
    const ok = nonEmpty.filter((v) => parsePriceCell(v) != null).length;
    if (ok / nonEmpty.length > 0.5) score += 40;
  } else if (fieldKey === 'scale_factor') {
    const ok = nonEmpty.filter((v) => parseScaleFactorCell(v) != null).length;
    if (ok / nonEmpty.length > 0.4) score += 35;
  } else if (fieldKey === 'commercial_release_year') {
    const ok = nonEmpty.filter((v) => parseYearFromCell(v) != null).length;
    if (ok / nonEmpty.length > 0.5) score += 40;
  } else if (fieldKey === 'purchase_date') {
    const ok = nonEmpty.filter((v) => parsePurchaseDateCell(v) != null).length;
    if (ok / nonEmpty.length > 0.4) score += 35;
  } else if (
    fieldKey === 'modified' ||
    fieldKey === 'digital' ||
    fieldKey === 'museo' ||
    fieldKey === 'taller'
  ) {
    const ok = nonEmpty.filter((v) => parseBoolCell(v) != null).length;
    if (ok / nonEmpty.length > 0.5) score += 30;
  } else if (fieldKey === 'motor_position') {
    const ok = nonEmpty.filter((v) => parseOptionalMotorPositionFromCell(v) != null).length;
    if (ok / nonEmpty.length > 0.4) score += 30;
  }
  return score;
}

/**
 * @param {string[]} originalHeaders
 * @param {Record<string, unknown>[]} rows
 * @returns {Record<string, string | null>}
 */
function inferColumnMapping(originalHeaders, rows) {
  const mapping = {};
  for (const f of VEHICLE_IMPORT_TARGET_FIELDS) {
    mapping[f.key] = null;
  }
  const scores = {};
  for (const f of VEHICLE_IMPORT_TARGET_FIELDS) {
    scores[f.key] = {};
  }

  for (const col of originalHeaders) {
    const norm = normalizeHeaderForMatch(col);
    for (const f of VEHICLE_IMPORT_TARGET_FIELDS) {
      const key = f.key;
      let s = headerScoreForField(norm, key);
      const values = rows.map((r) => r[col]);
      s += sampleScoreForField(col, values, key);
      scores[key][col] = s;
    }
  }

  const usedCols = new Set();
  const fieldKeys = VEHICLE_IMPORT_TARGET_FIELDS.map((f) => f.key);
  // Asignar greedy por mejor score global
  const pairs = [];
  for (const fk of fieldKeys) {
    for (const col of originalHeaders) {
      const s = scores[fk][col] || 0;
      if (s > 0) pairs.push({ fk, col, s });
    }
  }
  pairs.sort((a, b) => b.s - a.s);
  for (const { fk, col, s } of pairs) {
    if (usedCols.has(col)) continue;
    if (mapping[fk] != null) continue;
    if (s < 25) continue;
    mapping[fk] = col;
    usedCols.add(col);
  }

  return mapping;
}

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, string | null | undefined>} mapping
 * @returns {{ values: Record<string, unknown>, errors: string[], warnings: string[] }}
 */
function mapRowToVehicleValues(row, mapping) {
  const errors = [];
  const warnings = [];
  const get = (field) => {
    const col = mapping[field];
    if (col == null || col === '' || col === IGNORE_FIELD) return undefined;
    if (!Object.prototype.hasOwnProperty.call(row, col)) return undefined;
    return row[col];
  };

  const str = (v) => (v == null ? '' : String(v).trim());

  const model = str(get('model'));
  const manufacturer = str(get('manufacturer'));
  const type = str(get('type'));

  if (!model) errors.push('Falta modelo');
  if (!manufacturer) errors.push('Falta marca');
  const typeCol = mapping.type;
  const typeColumnMapped =
    typeCol != null && String(typeCol).trim() !== '' && typeCol !== IGNORE_FIELD;
  if (!type && typeColumnMapped) {
    warnings.push(
      'Sin tipo en esta fila: en la ficha de vehículo el tipo es obligatorio — complétalo editando el vehículo o revisa el Excel.',
    );
  }

  const tractionRaw = get('traction');
  const traction = tractionRaw == null || str(tractionRaw) === '' ? null : str(tractionRaw);

  const motorRaw = get('motor_position');
  const motor_position = parseOptionalMotorPositionFromCell(motorRaw);
  if (motorRaw != null && str(motorRaw) !== '' && motor_position == null) {
    warnings.push('Posición de motor no reconocida; se guardará vacía');
  }

  const price = parsePriceCell(get('price'));
  if (get('price') != null && str(get('price')) !== '' && price == null) {
    warnings.push('Precio no numérico; se ignorará');
  }

  let modified = false;
  const mRaw = get('modified');
  if (mRaw != null && str(mRaw) !== '') {
    const b = parseBoolCell(mRaw);
    modified = b === true;
    if (b == null) warnings.push('Modificado: valor no reconocido, se asume no');
  }

  let digital = false;
  const dRaw = get('digital');
  if (dRaw != null && str(dRaw) !== '') {
    const b = parseBoolCell(dRaw);
    digital = b === true;
    if (b == null) warnings.push('Digital: valor no reconocido, se asume no');
  }

  let museo = false;
  const muRaw = get('museo');
  if (muRaw != null && str(muRaw) !== '') {
    const b = parseBoolCell(muRaw);
    museo = b === true;
  }

  let taller = false;
  const tRaw = get('taller');
  if (tRaw != null && str(tRaw) !== '') {
    const b = parseBoolCell(tRaw);
    taller = b === true;
  }

  const purchase_date = parsePurchaseDateCell(get('purchase_date'));
  if (get('purchase_date') != null && str(get('purchase_date')) !== '' && !purchase_date) {
    warnings.push('Fecha de compra no reconocida');
  }

  const purchase_place = (() => {
    const v = get('purchase_place');
    return v == null || str(v) === '' ? null : str(v);
  })();

  const anotaciones = (() => {
    const v = get('anotaciones');
    return v == null || str(v) === '' ? null : str(v);
  })();

  const reference = (() => {
    const v = get('reference');
    return v == null || str(v) === '' ? null : str(v);
  })();

  let scale_factor = parseScaleFactorCell(get('scale_factor'));
  if (scale_factor == null) scale_factor = DEFAULT_SCALE_FACTOR;
  if (get('scale_factor') != null && str(get('scale_factor')) !== '' && parseScaleFactorCell(get('scale_factor')) == null) {
    warnings.push('Escala no reconocida; se usa 1:32');
  }

  const commercial_release_year = parseYearFromCell(get('commercial_release_year'));
  if (
    get('commercial_release_year') != null &&
    str(get('commercial_release_year')) !== '' &&
    commercial_release_year == null
  ) {
    warnings.push('Año comercial no reconocido');
  }

  const priceNum = price;
  const total_price = modified ? null : priceNum != null ? priceNum : null;

  const values = {
    model: model || null,
    manufacturer: manufacturer || null,
    type: type || null,
    traction,
    motor_position,
    price: priceNum,
    total_price,
    purchase_date: purchase_date || null,
    purchase_place,
    modified,
    digital,
    museo,
    taller,
    anotaciones,
    reference,
    scale_factor,
    commercial_release_year: commercial_release_year || null,
    catalog_item_id: null,
  };

  return { values, errors, warnings };
}

/**
 * @param {Buffer} buffer
 * @param {{ mimetype?: string, originalname?: string, sheetIndex?: number }} opts
 * @returns {{ rows: Record<string, unknown>[], headers: string[], sheetName?: string, firstDataRow1Based: number }}
 */
function parseImportFileBuffer(buffer, opts) {
  const mime = String(opts.mimetype || '');
  const name = String(opts.originalname || '');
  const sheetIndex = Math.max(0, parseInt(String(opts.sheetIndex ?? 0), 10) || 0);

  let rows = [];
  let headers = [];
  let sheetName;

  let firstDataRow1Based = 2;

  if (mime.includes('csv') || name.toLowerCase().endsWith('.csv')) {
    const text = buffer.toString('utf8');
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
    if (rows.length > 0) {
      headers = Object.keys(rows[0]);
    }
  } else if (isExcelImportFile(mime, name)) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sn = wb.SheetNames[sheetIndex];
    if (!sn) {
      const err = new Error('Hoja no encontrada');
      err.code = 'SHEET_NOT_FOUND';
      throw err;
    }
    sheetName = sn;
    const sheet = wb.Sheets[sn];
    const parsed = parseExcelSheetToRowsWithColAlignment(sheet);
    rows = parsed.rows;
    headers = parsed.headers;
    firstDataRow1Based = parsed.firstDataRow1Based;
  } else {
    const err = new Error(
      'Formato no soportado. Usa CSV o Excel (.xlsx, .xlsm, .xlsb, .xls, .xltx, .xltm).',
    );
    err.code = 'UNSUPPORTED_FORMAT';
    throw err;
  }

  const normalized = normalizeBlankColumnHeaders(rows);
  rows = normalized.rows;
  headers = normalized.headers;

  return { rows, headers, sheetName, firstDataRow1Based };
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {Record<string, string | null | undefined>} mapping
 * @param {{ rowOffset?: number, firstDataRow1Based?: number }} opt — fila 1-based de la primera fila de datos
 */
function buildPreviewResults(rows, mapping, opt = {}) {
  const rowOffset = opt.firstDataRow1Based ?? opt.rowOffset ?? 2;
  const results = [];
  const max = Math.min(rows.length, 5000);
  for (let i = 0; i < max; i++) {
    const row = rows[i];
    const { values, errors, warnings } = mapRowToVehicleValues(row, mapping);
    const emptyRow = Object.values(row).every(
      (v) => v == null || (typeof v === 'string' && v.trim() === '') || v === '',
    );
    if (emptyRow) {
      results.push({
        index: i,
        sheetRow: i + rowOffset,
        skip: true,
        values: null,
        errors: [],
        warnings: [],
      });
      continue;
    }
    results.push({
      index: i,
      sheetRow: i + rowOffset,
      skip: false,
      values,
      errors,
      warnings,
      ok: errors.length === 0,
    });
  }
  return results;
}

const PREVIEW_LIMIT_DEFAULT = 150;

/**
 * Primeras filas no vacías del fichero (misma lógica que buildPreviewResults) para vista previa en vivo.
 * @param {Record<string, unknown>[]} rows
 * @param {number} [limit]
 * @param {{ firstDataRow1Based?: number }} [opt]
 * @returns {{ index: number, sheetRow: number, data: Record<string, unknown> }[]}
 */
function collectSampleDataRowsForPreview(rows, limit = PREVIEW_LIMIT_DEFAULT, opt = {}) {
  const out = [];
  if (!Array.isArray(rows) || rows.length === 0) return out;
  const rowOffset = opt.firstDataRow1Based ?? 2;
  const max = Math.min(rows.length, 5000);
  for (let i = 0; i < max && out.length < limit; i++) {
    const row = rows[i];
    const emptyRow = Object.values(row).every(
      (v) => v == null || (typeof v === 'string' && v.trim() === '') || v === '',
    );
    if (emptyRow) continue;
    out.push({ index: i, sheetRow: i + rowOffset, data: row });
  }
  return out;
}

/**
 * Misma forma que devuelve import-preview (filas con datos) para un mapeo dado.
 * @param {{ index: number, sheetRow: number, data: Record<string, unknown> }[]} sampleDataRows
 * @param {Record<string, string | null | undefined>} mapping
 * @returns {Array<{ index: number, sheetRow: number, ok: boolean, errors: string[], warnings: string[], values: object | null }>}
 */
function mapSampleRowsToPreviewItems(sampleDataRows, mapping) {
  if (!Array.isArray(sampleDataRows)) return [];
  return sampleDataRows.map((item) => {
    const row = item.data;
    const { values, errors, warnings } = mapRowToVehicleValues(row, mapping);
    return {
      index: item.index,
      sheetRow: item.sheetRow,
      ok: errors.length === 0,
      errors,
      warnings,
      values,
    };
  });
}

/**
 * Clave lógica para duplicados por usuario.
 * @param {Record<string, unknown>} v
 */
function duplicateKeyForVehicle(v) {
  const ref = v.reference != null && String(v.reference).trim() !== '' ? String(v.reference).trim().toUpperCase() : null;
  const man = v.manufacturer != null ? String(v.manufacturer).trim().toLowerCase() : '';
  const mod = v.model != null ? String(v.model).trim().toLowerCase() : '';
  if (ref) return `ref:${ref}|m:${man}`;
  return `m:${man}|mod:${mod}`;
}

module.exports = {
  VEHICLE_IMPORT_TARGET_FIELDS,
  VEHICLE_SUGGEST_COMPLETE_IN_APP_IF_UNMAPPED,
  suggestAfterImportForMapping,
  IGNORE_FIELD,
  DEFAULT_SCALE_FACTOR,
  normalizeHeaderForMatch,
  inferColumnMapping,
  mapRowToVehicleValues,
  parseImportFileBuffer,
  buildPreviewResults,
  collectSampleDataRowsForPreview,
  mapSampleRowsToPreviewItems,
  PREVIEW_LIMIT_DEFAULT,
  duplicateKeyForVehicle,
  parsePriceCell,
  parseBoolCell,
  parseScaleFactorCell,
  parseOptionalMotorPositionFromCell,
  parseYearFromCell,
  parsePurchaseDateCell,
  isExcelImportFile,
  excelColumnLetters,
  isBlankOrAutoHeaderName,
  normalizeBlankColumnHeaders,
};
