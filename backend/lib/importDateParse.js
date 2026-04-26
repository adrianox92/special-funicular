/**
 * Fechas leídas de CSV/Excel → formatos de la app:
 * - Fecha de compra: 'YYYY-MM-DD' (date ISO de Postgres / input type="date")
 * - Año comercialización: entero 1900–2100
 *
 * Soporta: serial Excel, ISO 8601 (con o sin hora), dd/mm/aaaa, d-m-a, aaaa/mm/dd, timestamps ms, etc.
 */

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

/**
 * @param {number} y
 * @param {number} m
 * @param {number} d
 */
function isValidYmd(y, m, d) {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Año 2 dígitos (20 → 2020, 99 → 1999) — corte 70, habitual en hojas.
 * @param {number} yy
 */
function expandTwoDigitYear(yy) {
  if (yy < 0 || yy > 99) return null;
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

/**
 * @param {number} serial
 * @returns {string|null} 'YYYY-MM-DD' UTC
 */
function excelSerialToIsoDate(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const days = Math.floor(serial);
  if (days <= 0) return null;
  const d = new Date(EXCEL_EPOCH_UTC_MS + days * 86400000);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (y < 1900 || y > 2100) return null;
  return `${y}-${pad2(m)}-${pad2(day)}`;
}

/**
 * @param {Date} d
 */
function dateToLocalYmdString(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Fecha de compra → 'YYYY-MM-DD' o null.
 * @param {unknown} raw
 * @returns {string|null}
 */
function parseImportPurchaseDateToIso(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : dateToLocalYmdString(raw);
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (isExcelSerialNumber(raw)) {
      return excelSerialToIsoDate(raw);
    }
    const n = Math.floor(raw);
    if (n >= 1900 && n <= 2100 && raw === n) {
      return `${n}-01-01`;
    }
    if (raw > 1e11 && raw < 1e14) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return dateToLocalYmdString(d);
    }
    return null;
  }

  const s0 = String(raw).trim();
  if (s0 === '') return null;

  // aaaa-m(m)-d(d) [T inicio de hora opcional] / RFC con zona
  let m = s0.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt\s](?:\d|:|Z|z|\+|-).*)?$/,
  );
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (isValidYmd(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  m = s0.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (isValidYmd(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  // d(d)/m(m)/a(aaa|aa)  — criterio Europa (d/m/Y) salvo 1a parte > 12 (entonces m/d imposible, es día)
  m = s0.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s|$|[Tt])/,
  );
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const yPart = m[3];
    let y = yPart.length === 2 ? expandTwoDigitYear(parseInt(yPart, 10)) : parseInt(yPart, 10);
    if (y == null) return null;
    let dd;
    let mo;
    if (a > 12) {
      dd = a;
      mo = b;
    } else if (b > 12) {
      mo = a;
      dd = b;
    } else {
      dd = a;
      mo = b;
    }
    if (isValidYmd(y, mo, dd)) return `${y}-${pad2(mo)}-${pad2(dd)}`;
  }

  m = s0.match(/^(\d{1,2})[.\s](\d{1,2})[.\s](\d{2}|\d{4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const yPart = m[3];
    const y = yPart.length === 2 ? expandTwoDigitYear(parseInt(yPart, 10)) : parseInt(yPart, 10);
    if (y == null) return null;
    let dd;
    let mo;
    if (a > 12) {
      dd = a;
      mo = b;
    } else if (b > 12) {
      mo = a;
      dd = b;
    } else {
      dd = a;
      mo = b;
    }
    if (isValidYmd(y, mo, dd)) return `${y}-${pad2(mo)}-${pad2(dd)}`;
  }

  // Sólo año 4 cifras (típico: columna con año y no fecha completa)
  m = s0.match(/^(\d{4})$/);
  if (m) {
    const y = parseInt(m[1], 10);
    if (y >= 1900 && y <= 2100) return `${y}-01-01`;
  }

  // Número en texto: serial de Excel p. ej. "43831" o "43000,5" (día+hora)
  const f = parseFloat(s0.replace(/,/g, '.').replace(/\s/g, ''));
  if (
    Number.isFinite(f) &&
    isExcelSerialNumber(f) &&
    /^\d+([.,]\d+)?$/.test(s0.replace(/\s/g, ''))
  ) {
    const r = excelSerialToIsoDate(f);
    if (r) return r;
  }

  const parsed = Date.parse(s0);
  if (!Number.isNaN(parsed)) {
    return dateToLocalYmdString(new Date(parsed));
  }

  return null;
}

/**
 * Días en serial Excel. Los enteros 1900–2100 son "año" (celda numérica), no días.
 * @param {number} n
 */
function isExcelSerialNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return false;
  const i = Math.floor(n);
  if (i === n && n >= 1900 && n <= 2100) return false;
  return n > 200 && n < 60000;
}

/**
 * Año de comercialización: entero 1900–2100 o null.
 * Acepta año solo, fechas (extrae el año) y serial Excel.
 * @param {unknown} raw
 * @returns {number|null}
 */
function parseImportCommercialReleaseYear(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (isExcelSerialNumber(raw)) {
      const iso = excelSerialToIsoDate(raw);
      if (iso) return parseInt(iso.slice(0, 4), 10);
    }
    const n = Math.floor(raw);
    if (n === raw && n >= 1900 && n <= 2100) return n;
    return null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    if (y >= 1900 && y <= 2100) return y;
    return null;
  }

  const s0 = String(raw).trim();
  if (s0 === '') return null;
  if (/^\d{4}$/.test(s0)) {
    const y = parseInt(s0, 10);
    if (y >= 1900 && y <= 2100) return y;
  }
  const maybeSerial = parseFloat(s0);
  if (Number.isFinite(maybeSerial) && isExcelSerialNumber(maybeSerial) && s0.replace(/\s/g, '') === String(maybeSerial)) {
    const iso = excelSerialToIsoDate(maybeSerial);
    if (iso) return parseInt(iso.slice(0, 4), 10);
  }

  const asDate = parseImportPurchaseDateToIso(s0);
  if (asDate) {
    return parseInt(asDate.slice(0, 4), 10);
  }
  return null;
}

module.exports = {
  parseImportPurchaseDateToIso,
  parseImportCommercialReleaseYear,
  isExcelSerialNumber,
  excelSerialToIsoDate,
};
