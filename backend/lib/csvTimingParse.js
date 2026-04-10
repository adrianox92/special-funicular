/**
 * CSV parsing for timing import: supports comma or semicolon delimiters and UTF-8 BOM.
 */

/**
 * @param {string} content
 * @returns {string}
 */
function stripBom(content) {
  if (typeof content !== 'string' || content.length === 0) return content;
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/**
 * @param {string} normalized
 * @returns {string}
 */
function getFirstLine(normalized) {
  const idx = normalized.indexOf('\n');
  return idx === -1 ? normalized : normalized.slice(0, idx);
}

/**
 * @param {string} firstLine
 * @returns {','|';'}
 */
function detectDelimiter(firstLine) {
  if (!firstLine) return ',';
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (c === ',') commas += 1;
      if (c === ';') semis += 1;
    }
  }
  if (semis > commas) return ';';
  return ',';
}

/**
 * RFC-style CSV row parser with configurable delimiter (comma or semicolon).
 * @param {string} content
 * @param {','|';'} delimiter
 * @returns {string[][]}
 */
function parseCsv(content, delimiter) {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) return [];
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (c === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  row.push(field.trim());
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
    rows.push(row);
  }
  return rows;
}

/**
 * @param {string} content
 * @returns {string[][]}
 */
function parseCsvAuto(content) {
  const stripped = stripBom(String(content ?? ''));
  const normalized = stripped.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) return [];
  const firstLine = getFirstLine(normalized);
  let delimiter = detectDelimiter(firstLine);
  let rows = parseCsv(normalized, delimiter);
  if (rows.length > 0 && rows[0].length === 1 && /;/.test(rows[0][0])) {
    delimiter = ';';
    rows = parseCsv(normalized, delimiter);
  }
  return rows;
}

/**
 * @param {string} content
 * @returns {Record<string, string>[]}
 */
function csvToObjects(content) {
  const rows = parseCsvAuto(content);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    if (!line || line.every((c) => c === '' || c == null)) continue;
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = line[j] != null ? String(line[j]) : '';
    });
    out.push(obj);
  }
  return out;
}

/**
 * @param {string} content
 * @returns {string[]}
 */
function csvHeadersNormalized(content) {
  const rows = parseCsvAuto(content);
  if (rows.length < 1) return [];
  return rows[0].map((h) => String(h).trim().toLowerCase());
}

module.exports = {
  stripBom,
  detectDelimiter,
  parseCsv,
  parseCsvAuto,
  csvToObjects,
  csvHeadersNormalized,
};
