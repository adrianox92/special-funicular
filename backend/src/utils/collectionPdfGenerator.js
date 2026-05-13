const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const {
  COLORS,
  MARGIN,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  CONTENT_WIDTH,
  HEADER_HEIGHT,
  drawHeader,
  drawFooter,
  normalizeColumnWidths,
} = require('./pdfLayoutPrimitives');

/** PDFKit solo incrusta JPEG y PNG; las subidas pueden ser WebP. */
function isJpegBuffer(buf) {
  return buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
}
function isPngBuffer(buf) {
  return buf.length >= 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';
}

async function bufferForPdfKitImage(buf) {
  if (!buf || buf.length === 0) return null;
  if (isJpegBuffer(buf) || isPngBuffer(buf)) return buf;
  try {
    return await sharp(buf).rotate().png().toBuffer();
  } catch {
    return null;
  }
}

function formatPurchaseDate(iso) {
  if (iso == null || iso === '') return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-ES');
  } catch {
    return '-';
  }
}

function formatBrandModel(manufacturer, model) {
  const a = manufacturer != null && String(manufacturer).trim() !== '' ? String(manufacturer).trim() : null;
  const b = model != null && String(model).trim() !== '' ? String(model).trim() : null;
  if (a && b) return `${a} · ${b}`;
  if (b) return b;
  if (a) return a;
  return '-';
}

function formatEuro(amount) {
  return `${Number(amount).toFixed(2)} €`;
}

/**
 * @returns {{ kind: 'single', text: string } | { kind: 'dual', baseLine: string, totalLine: string }}
 */
function resolvePriceParts(row) {
  const price = row.price != null && row.price !== '' ? Number(row.price) : null;
  const total = row.total_price != null && row.total_price !== '' ? Number(row.total_price) : null;
  const priceOk = price != null && !Number.isNaN(price);
  const totalOk = total != null && !Number.isNaN(total);
  if (priceOk && totalOk && total !== price) {
    return {
      kind: 'dual',
      baseLine: `Compra: ${formatEuro(price)}`,
      totalLine: `Total: ${formatEuro(total)}`,
    };
  }
  if (totalOk) return { kind: 'single', text: formatEuro(total) };
  if (priceOk) return { kind: 'single', text: formatEuro(price) };
  return { kind: 'single', text: '-' };
}

function measurePriceColumnHeight(doc, parts, width, fontSize) {
  if (parts.kind === 'single') {
    doc.fontSize(fontSize).font('Helvetica');
    return Math.max(doc.heightOfString(parts.text, { width }), 14);
  }
  doc.fontSize(fontSize - 1).font('Helvetica');
  const h1 = doc.heightOfString(parts.baseLine, { width, lineGap: 2 });
  doc.fontSize(fontSize).font('Helvetica-Bold');
  const h2 = doc.heightOfString(parts.totalLine, { width, lineGap: 2 });
  return h1 + 6 + h2;
}

function drawPriceColumn(doc, parts, x, y, width, fontSize) {
  if (parts.kind === 'single') {
    doc.fillColor(COLORS.text).fontSize(fontSize).font('Helvetica');
    doc.text(parts.text, x, y, { width });
    return;
  }
  doc.fillColor(COLORS.textMuted).fontSize(fontSize - 1).font('Helvetica');
  doc.text(parts.baseLine, x, y, { width, lineGap: 2 });
  const h1 = doc.heightOfString(parts.baseLine, { width, lineGap: 2 });
  doc.fillColor(COLORS.text).fontSize(fontSize).font('Helvetica-Bold');
  doc.text(parts.totalLine, x, y + h1 + 6, { width, lineGap: 2 });
}

async function fetchImageBuffer(imageUrl) {
  if (!imageUrl) return null;
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    const raw = Buffer.from(imageResponse.data);
    if (raw.length === 0) return null;
    return bufferForPdfKitImage(raw);
  } catch {
    return null;
  }
}

function drawTableHeaderBand(doc, y, widths, headers, headerRowH) {
  doc.save();
  doc.rect(MARGIN, y, CONTENT_WIDTH, headerRowH).fill(COLORS.accent);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
  let hx = MARGIN + 8;
  headers.forEach((h, i) => {
    const cw = Math.max(10, widths[i] - 16);
    doc.text(String(h), hx, y + 6, { width: cw, lineGap: 1 });
    hx += widths[i];
  });
  doc.restore();
}

/**
 * @param {Array<{ imageUrl?: string | null, manufacturer?: unknown, model?: unknown, purchase_date?: unknown, price?: unknown, total_price?: unknown }>} rows
 * @returns {Promise<Buffer>}
 */
async function generateCollectionVehiclesPDF(rows) {
  const genDate = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const headerRowH = 26;
  const minYBreak = 110;
  const fontSize = 9;
  /** Pesos relativos: miniatura, marca/modelo, fecha, precio (columna precio un poco más ancha para dos líneas) */
  const colWeights = [108, 220, 92, 126];
  const widths = normalizeColumnWidths(colWeights);
  const headers = ['Imagen', 'Marca y modelo', 'Compra', 'Precio'];

  const imageBuffers = [];
  for (const row of rows) {
    imageBuffers.push(await fetchImageBuffer(row.imageUrl || null));
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: HEADER_HEIGHT + 20, bottom: 44, left: MARGIN, right: MARGIN },
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor(COLORS.text);

      if (!rows.length) {
        doc.fontSize(11).font('Helvetica').fillColor(COLORS.textMuted);
        doc.text('No hay vehículos que coincidan con los filtros seleccionados.', MARGIN, doc.y, {
          width: CONTENT_WIDTH,
        });
        doc.moveDown(1);
      } else {
        let y = doc.y;
        drawTableHeaderBand(doc, y, widths, headers, headerRowH);
        y += headerRowH + 6;

        rows.forEach((row, i) => {
          const marcaModelo = formatBrandModel(row.manufacturer, row.model);
          const compra = formatPurchaseDate(row.purchase_date);
          const priceParts = resolvePriceParts(row);

          const innerThumbW = Math.max(20, widths[0] - 16);
          const innerThumbH = 56;
          const textBlockW = Math.max(10, widths[1] - 16);
          const priceColW = Math.max(10, widths[3] - 16);
          const hBrand = doc.heightOfString(marcaModelo, { width: textBlockW });
          const hPrice = measurePriceColumnHeight(doc, priceParts, priceColW, fontSize);
          const lineH = Math.max(innerThumbH + 14, hBrand + 12, hPrice + 12, 28);

          if (y > PAGE_HEIGHT - minYBreak) {
            doc.addPage();
            y = doc.y;
            drawTableHeaderBand(doc, y, widths, headers, headerRowH);
            y += headerRowH + 6;
          }

          if (i % 2 === 1) {
            doc.rect(MARGIN, y, CONTENT_WIDTH, lineH + 8).fill(COLORS.rowAlt);
          }

          const imgBuf = imageBuffers[i];
          const imgX = MARGIN + 8;
          const imgY = y + 6;
          if (imgBuf) {
            try {
              doc.image(imgBuf, imgX, imgY, {
                fit: [innerThumbW, innerThumbH],
              });
            } catch {
              doc.fillColor(COLORS.textMuted).fontSize(8).font('Helvetica');
              doc.text('—', imgX, imgY + innerThumbH / 2 - 4, { width: innerThumbW });
            }
          } else {
            doc.save();
            doc.roundedRect(imgX, imgY, innerThumbW, innerThumbH, 3).stroke(COLORS.border);
            doc.fillColor(COLORS.textMuted).fontSize(7).font('Helvetica');
            doc.text('Sin imagen', imgX + 4, imgY + innerThumbH / 2 - 4, {
              width: innerThumbW - 8,
              align: 'center',
            });
            doc.restore();
          }

          doc.fillColor(COLORS.text).fontSize(fontSize).font('Helvetica');
          let cx = MARGIN + widths[0] + 8;
          doc.text(marcaModelo, cx, y + 6, { width: textBlockW, lineGap: 2 });
          cx += widths[1];
          doc.text(compra, cx, y + 6, {
            width: Math.max(10, widths[2] - 16),
          });
          cx += widths[2];
          drawPriceColumn(doc, priceParts, cx, y + 6, priceColW, fontSize);

          y += lineH + 10;
        });

        doc.y = y + 6;
      }

      const totalPages = doc.bufferedPageRange().count;
      const n = rows.length;
      const leftFoot =
        n === 0 ? 'Mi colección · 0 vehículos' : n === 1 ? 'Mi colección · 1 vehículo' : `Mi colección · ${n} vehículos`;

      for (let i = 0; i < totalPages; i += 1) {
        doc.switchToPage(i);
        drawHeader(doc, genDate, 'Listado de vehículos');
        drawFooter(doc, i + 1, totalPages, genDate, leftFoot);
      }

      doc.end();
    } catch (error) {
      console.error('Error en generateCollectionVehiclesPDF:', error);
      reject(error);
    }
  });
}

module.exports = { generateCollectionVehiclesPDF };
