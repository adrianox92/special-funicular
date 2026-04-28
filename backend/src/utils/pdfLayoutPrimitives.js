/**
 * Piezas visuales compartidas entre PDF de ficha técnica (vehículo) y resultados de competición.
 */

const path = require('path');
const fs = require('fs');

const HEADER_LOGO_PATH = path.join(__dirname, '../../assets/logo-header.png');

function isJpegBuffer(buf) {
  return buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
}
function isPngBuffer(buf) {
  return buf.length >= 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';
}

/** Marca producto para cabeceras PDF */
const PDF_BRAND = 'Slot Database';

let headerLogoCache = false;
function getHeaderLogoBuffer() {
  if (headerLogoCache !== false) return headerLogoCache;
  try {
    if (fs.existsSync(HEADER_LOGO_PATH)) {
      const buf = fs.readFileSync(HEADER_LOGO_PATH);
      headerLogoCache = buf.length > 0 && (isPngBuffer(buf) || isJpegBuffer(buf)) ? buf : null;
    } else {
      headerLogoCache = null;
    }
  } catch {
    headerLogoCache = null;
  }
  return headerLogoCache;
}

const COLORS = {
  header: '#1a1a2e',
  accent: '#e94560',
  rowAlt: '#f5f5f5',
  text: '#1a1a2e',
  textMuted: '#666666',
  border: '#dddddd',
};

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 36;

/**
 * Distribuye totalW puntos usando partes proporcionales (método residuo mayor → suma exacta).
 */
function normalizeColumnWidths(colWidths, totalW = CONTENT_WIDTH) {
  const n = colWidths.length;
  if (!n) return [];
  let weightSum = colWidths.reduce((a, b) => a + b, 0);
  if (!weightSum) weightSum = n;
  const raw = colWidths.map((w) => (totalW * w) / weightSum);
  const floor = raw.map((r) => Math.floor(r));
  let remainderPts = totalW - floor.reduce((a, b) => a + b, 0);
  const ordering = raw
    .map((r, i) => ({ i, frac: r - floor[i] }))
    .sort((a, b) => b.frac - a.frac)
    .map((x) => x.i);
  const out = floor.slice();
  for (let j = 0; j < remainderPts; j += 1) {
    out[ordering[j % n]] += 1;
  }
  return out;
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {string} genDate
 * @param {string} documentLabel — p. ej. «Ficha Técnica» o «Resultados de competición»
 */
function drawHeader(doc, genDate, documentLabel) {
  const savedTop = doc.page.margins.top;
  doc.page.margins.top = 0;
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT).fill(COLORS.header);
  const logo = getHeaderLogoBuffer();
  const maxW = 128;
  const maxH = 22;
  const yImg = (HEADER_HEIGHT - maxH) / 2;
  let usedLogo = false;
  if (logo) {
    try {
      doc.image(logo, MARGIN, yImg, { fit: [maxW, maxH] });
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold');
      doc.text(`· ${documentLabel}`, MARGIN + maxW + 6, 12, { width: 260, lineBreak: false });
      usedLogo = true;
    } catch {
      usedLogo = false;
    }
  }
  if (!usedLogo) {
    doc.fillColor('white').fontSize(14).font('Helvetica-Bold');
    doc.text(`${PDF_BRAND} · ${documentLabel}`, MARGIN, 11, { width: 360, lineBreak: false });
  }
  doc.fontSize(10).font('Helvetica');
  doc.text(`Generado: ${genDate}`, PAGE_WIDTH - MARGIN - 120, 13, { width: 120, align: 'right', lineBreak: false });
  doc.restore();
  doc.page.margins.top = savedTop;
}

/**
 * @param {import('pdfkit').PDFDocument} doc
 * @param {string} leftLine — texto pie izquierda (odómetro, nombre competición, etc.)
 */
function drawFooter(doc, pageNum, totalPages, genDate, leftLine) {
  const footerY = PAGE_HEIGHT - 28;
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.moveTo(MARGIN, footerY - 6).lineTo(PAGE_WIDTH - MARGIN, footerY - 6).stroke();
  doc.fillColor(COLORS.textMuted).fontSize(9).font('Helvetica');
  doc.text(leftLine || '', MARGIN, footerY, { width: 200, lineBreak: false });
  doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_WIDTH / 2 - 30, footerY, { width: 60, align: 'center', lineBreak: false });
  doc.text(genDate, PAGE_WIDTH - MARGIN - 100, footerY, { width: 100, align: 'right', lineBreak: false });
  doc.restore();
  doc.page.margins.bottom = savedBottom;
}

function drawSectionTitle(doc, text) {
  const y = doc.y;
  doc.save();
  doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fill(COLORS.header);
  doc.fillColor('white').fontSize(12).font('Helvetica-Bold');
  doc.text(text, MARGIN + 8, y + 6, { width: CONTENT_WIDTH - 16 });
  doc.restore();
  doc.y = y + 32;
}

function toDisplayString(value) {
  if (value == null || value === '' || value === 'null' || value === 'undefined') return '-';
  return String(value);
}

function drawInfoTable(doc, rows) {
  const col1Width = 140;
  const col2Width = CONTENT_WIDTH - col1Width;
  let y = doc.y;

  rows.forEach(([label, value], i) => {
    const displayValue = toDisplayString(value);
    const rowHeight = 18;
    if (i % 2 === 1) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(COLORS.rowAlt);
    }
    doc.fillColor(COLORS.textMuted).fontSize(10).font('Helvetica');
    doc.text(String(label), MARGIN + 8, y + 4, { width: col1Width - 16 });
    doc.fillColor(COLORS.text).font('Helvetica');
    doc.text(displayValue, MARGIN + col1Width + 8, y + 4, { width: col2Width - 16 });
    y += rowHeight;
  });
  doc.y = y + 12;
}

/**
 * Tabla tipo listado competitivo / por ronda: cabecera en color acento y filas alternas.
 * @param {number[]} colWidths — suma ≈ CONTENT_WIDTH
 * @param {string[]} headers
 * @param {string[][]} rows
 */
function drawAccentDataTable(doc, colWidths, headers, rows, options = {}) {
  const minYBreak = options.minYForNewPage != null ? options.minYForNewPage : 120;
  const headerRowH = options.headerRowHeight != null ? options.headerRowHeight : 26;
  const fontSize = options.fontSize != null ? options.fontSize : 8;
  const widths = normalizeColumnWidths(colWidths, CONTENT_WIDTH);
  const totalW = CONTENT_WIDTH;

  const drawHeaderBand = (y) => {
    doc.save();
    doc.rect(MARGIN, y, totalW, headerRowH).fill(COLORS.accent);
    doc.fillColor('white').fontSize(Math.min(10, fontSize + 1)).font('Helvetica-Bold');
    let hx = MARGIN + 8;
    headers.forEach((h, i) => {
      const cw = Math.max(10, widths[i] - 16);
      doc.text(String(h), hx, y + 5, { width: cw, lineGap: 1 });
      hx += widths[i];
    });
    doc.restore();
  };

  let y = doc.y;
  drawHeaderBand(y);
  y += headerRowH + 6;

  rows.forEach((cells, i) => {
    if (y > PAGE_HEIGHT - minYBreak) {
      doc.addPage();
      y = doc.y;
      drawHeaderBand(y);
      y += headerRowH + 6;
    }
    const lineH = Math.max(
      ...cells.map((cell, ci) =>
        Math.max(doc.heightOfString(String(cell ?? ''), { width: Math.max(10, widths[ci] - 16) }), 14)
      ),
      16
    );

    if (i % 2 === 1) {
      doc.rect(MARGIN, y, totalW, lineH + 8).fill(COLORS.rowAlt);
    }

    doc.fillColor(COLORS.text).fontSize(fontSize).font('Helvetica');
    let cx = MARGIN + 8;
    cells.forEach((cell, ci) => {
      doc.text(String(cell ?? '-'), cx, y + 4, { width: Math.max(10, widths[ci] - 16) });
      cx += widths[ci];
    });
    y += lineH + 10;
  });
  doc.y = y + 8;
}

module.exports = {
  PDF_BRAND,
  COLORS,
  MARGIN,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  CONTENT_WIDTH,
  HEADER_HEIGHT,
  getHeaderLogoBuffer,
  drawHeader,
  drawFooter,
  drawSectionTitle,
  drawInfoTable,
  toDisplayString,
  drawAccentDataTable,
  normalizeColumnWidths,
};
