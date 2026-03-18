const PDFDocument = require('pdfkit');
const axios = require('axios');

// Paleta de colores
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
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '-';
  const m = Number(meters);
  if (m < 1000) return `${m.toFixed(1)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatPrice(val) {
  if (val == null || val === '' || isNaN(Number(val))) return '-';
  return `${Number(val).toFixed(2)} €`;
}

function getComponentShortDescription(component) {
  let desc = '';
  if (component.manufacturer) desc += component.manufacturer;
  if (component.material) desc += desc ? `, ${component.material}` : component.material;
  if (component.size) desc += desc ? `, ${component.size}` : component.size;
  if (component.color) desc += desc ? `, ${component.color}` : component.color;
  return desc || '-';
}

const HEADER_HEIGHT = 36;

function drawHeader(doc, genDate) {
  const savedTop = doc.page.margins.top;
  doc.page.margins.top = 0;
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT).fill(COLORS.header);
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold');
  doc.text('Scalextric Collection · Ficha Técnica', MARGIN, 11, { width: 300, lineBreak: false });
  doc.fontSize(10).font('Helvetica');
  doc.text(`Generado: ${genDate}`, PAGE_WIDTH - MARGIN - 120, 13, { width: 120, align: 'right', lineBreak: false });
  doc.restore();
  doc.page.margins.top = savedTop;
}

function drawFooter(doc, pageNum, totalPages, odometer, genDate) {
  const PAGE_HEIGHT = 841.89;
  const footerY = PAGE_HEIGHT - 28;
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.moveTo(MARGIN, footerY - 6).lineTo(PAGE_WIDTH - MARGIN, footerY - 6).stroke();
  doc.fillColor(COLORS.textMuted).fontSize(9).font('Helvetica');
  doc.text(`Odómetro: ${odometer}`, MARGIN, footerY, { lineBreak: false });
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

function drawInfoTable(doc, rows) {
  const col1Width = 140;
  const col2Width = CONTENT_WIDTH - col1Width;
  let y = doc.y;

  rows.forEach(([label, value], i) => {
    if (!value && value !== 0) value = '-';
    const rowHeight = 18;
    if (i % 2 === 1) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(COLORS.rowAlt);
    }
    doc.fillColor(COLORS.textMuted).fontSize(10).font('Helvetica');
    doc.text(String(label), MARGIN + 8, y + 4, { width: col1Width - 16 });
    doc.fillColor(COLORS.text).font('Helvetica');
    doc.text(String(value), MARGIN + col1Width + 8, y + 4, { width: col2Width - 16 });
    y += rowHeight;
  });
  doc.y = y + 12;
}

function drawBadges(doc, vehicle) {
  const badges = [];
  if (vehicle.digital) badges.push('Digital');
  if (vehicle.modified) badges.push('Modificado');
  if (vehicle.museo) badges.push('Museo');
  if (vehicle.taller) badges.push('Taller');
  if (badges.length === 0) return;

  let x = MARGIN;
  const y = doc.y;
  badges.forEach((label) => {
    const w = doc.widthOfString(label) + 16;
    doc.save();
    doc.roundedRect(x, y, w, 20, 4).fill(COLORS.accent);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text(label, x + 8, y + 5, { width: w - 16 });
    doc.restore();
    x += w + 6;
  });
  doc.y = y + 28;
}

function drawComponentsTable(doc, components, options = {}) {
  const { minYForNewPage = 150 } = options;
  const colWidths = [120, 140, 140, 80];
  const headerY = doc.y;

  doc.save();
  doc.rect(MARGIN, headerY, CONTENT_WIDTH, 22).fill(COLORS.accent);
  doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
  doc.text('Componente', MARGIN + 8, headerY + 6, { width: colWidths[0] - 16 });
  doc.text('Fabricante', MARGIN + colWidths[0] + 8, headerY + 6, { width: colWidths[1] - 16 });
  doc.text('Detalle', MARGIN + colWidths[0] + colWidths[1] + 8, headerY + 6, { width: colWidths[2] - 16 });
  doc.text('Precio', MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + 8, headerY + 6, { width: colWidths[3] - 16 });
  doc.restore();

  let y = headerY + 28;
  components.forEach((component, i) => {
    if (y > 750 - minYForNewPage) {
      doc.addPage();
      y = doc.y;
      doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(COLORS.accent);
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
      doc.text('Componente', MARGIN + 8, y + 6, { width: colWidths[0] - 16 });
      doc.text('Fabricante', MARGIN + colWidths[0] + 8, y + 6, { width: colWidths[1] - 16 });
      doc.text('Detalle', MARGIN + colWidths[0] + colWidths[1] + 8, y + 6, { width: colWidths[2] - 16 });
      doc.text('Precio', MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + 8, y + 6, { width: colWidths[3] - 16 });
      y += 28;
    }

    const compName = component.element || component.name || '-';
    const manufacturer = component.manufacturer || '-';
    const detail = [component.material, component.size, component.color].filter(Boolean).join(', ') || '-';
    const price = component.price != null && !isNaN(Number(component.price))
      ? `${Number(component.price).toFixed(2)} €`
      : '-';

    const lineH = Math.max(
      doc.heightOfString(compName, { width: colWidths[0] - 16 }),
      doc.heightOfString(manufacturer, { width: colWidths[1] - 16 }),
      doc.heightOfString(detail, { width: colWidths[2] - 16 }),
      16
    );

    if (i % 2 === 1) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, lineH + 8).fill(COLORS.rowAlt);
    }
    doc.fillColor(COLORS.text).fontSize(9).font('Helvetica');
    doc.text(compName, MARGIN + 8, y + 4, { width: colWidths[0] - 16 });
    doc.text(manufacturer, MARGIN + colWidths[0] + 8, y + 4, { width: colWidths[1] - 16 });
    doc.text(detail, MARGIN + colWidths[0] + colWidths[1] + 8, y + 4, { width: colWidths[2] - 16 });
    doc.text(price, MARGIN + colWidths[0] + colWidths[1] + colWidths[2] + 8, y + 4, { width: colWidths[3] - 16 });
    y += lineH + 12;
  });
  doc.y = y + 16;
}

function drawPriceSummary(doc, vehicle, totalModCost) {
  const baseY = doc.y;
  const totalPrice = vehicle.total_price != null && !isNaN(Number(vehicle.total_price))
    ? Number(vehicle.total_price)
    : (vehicle.price != null && !isNaN(Number(vehicle.price)) ? Number(vehicle.price) : 0);

  doc.save();
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  doc.rect(MARGIN, baseY, CONTENT_WIDTH, 52).stroke();
  doc.fillColor(COLORS.text).fontSize(10).font('Helvetica');
  doc.text('Precio base:', MARGIN + 12, baseY + 12);
  doc.text(formatPrice(vehicle.price), PAGE_WIDTH - MARGIN - 100, baseY + 12, { width: 90, align: 'right' });
  doc.text('Coste modificaciones:', MARGIN + 12, baseY + 28);
  doc.text(formatPrice(totalModCost), PAGE_WIDTH - MARGIN - 100, baseY + 28, { width: 90, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Precio total:', MARGIN + 12, baseY + 44);
  doc.text(formatPrice(totalPrice), PAGE_WIDTH - MARGIN - 100, baseY + 44, { width: 90, align: 'right' });
  doc.restore();
  doc.y = baseY + 60;
}

async function generateVehicleSpecsPDF(vehicle, technicalSpecs, modifications) {
  return new Promise(async (resolve, reject) => {
    try {
      const genDate = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: HEADER_HEIGHT + 20, bottom: 50, left: MARGIN, right: MARGIN },
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let totalModCost = 0;
      if (modifications?.length) {
        modifications.forEach((mod) => {
          (mod.components || []).forEach((c) => {
            if (c.price != null && !isNaN(Number(c.price))) totalModCost += Number(c.price);
          });
        });
      }

      const odometer = formatDistance(vehicle.total_distance_meters);
      const opts = { genDate };

      // Imagen
      let imageBuffer = null;
      if (vehicle.image) {
        try {
          const imageResponse = await axios.get(vehicle.image, {
            responseType: 'arraybuffer',
            timeout: 5000,
          });
          const ct = imageResponse.headers['content-type'] || '';
          if (ct.includes('jpeg') || ct.includes('png')) {
            imageBuffer = Buffer.from(imageResponse.data);
          }
        } catch (_) {}
      }

      const imgWidth = 160;
      const imgHeight = 110;
      const imgX = PAGE_WIDTH - MARGIN - imgWidth - 4;
      const imgY = doc.y;

      if (imageBuffer) {
        try {
          doc.rect(imgX, imgY, imgWidth + 4, imgHeight + 4).stroke(COLORS.border);
          doc.image(imageBuffer, imgX + 2, imgY + 2, {
            fit: [imgWidth, imgHeight],
          });
        } catch (_) {
          doc.rect(imgX, imgY, imgWidth + 4, imgHeight + 4).fill(COLORS.rowAlt);
          doc.fillColor(COLORS.textMuted).fontSize(9);
          doc.text('Sin imagen', imgX + 2, imgY + imgHeight / 2 - 6, {
            width: imgWidth,
            align: 'center',
          });
        }
      } else {
        doc.rect(imgX, imgY, imgWidth + 4, imgHeight + 4).fill(COLORS.rowAlt);
        doc.fillColor(COLORS.textMuted).fontSize(9);
        doc.text('Sin imagen', imgX + 2, imgY + imgHeight / 2 - 6, {
          width: imgWidth,
          align: 'center',
        });
      }

      const dataWidth = imgX - MARGIN - 20;
      doc.fillColor(COLORS.text).fontSize(16).font('Helvetica-Bold');
      doc.text(`${vehicle.manufacturer || ''} ${vehicle.model || ''}`.trim(), MARGIN, doc.y, {
        width: dataWidth,
      });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.textMuted);
      const ref = vehicle.reference ? ` · ${vehicle.reference}` : '';
      doc.text(`${ref}`.trim() || '-', MARGIN, doc.y, { width: dataWidth });
      doc.moveDown(0.5);

      const scaleStr = vehicle.scale_factor ? `1:${vehicle.scale_factor}` : '-';
      doc.fillColor(COLORS.text).fontSize(10);
      doc.text(`Escala: ${scaleStr} · Tipo: ${vehicle.type || '-'} · Tracción: ${vehicle.traction || '-'}`, MARGIN, doc.y, {
        width: dataWidth,
      });
      doc.moveDown(0.8);

      drawBadges(doc, vehicle);
      doc.y = Math.max(doc.y, imgY + imgHeight + 16);

      // Información de compra
      drawSectionTitle(doc, 'Información de compra');
      const purchaseRows = [
        ['Fecha de compra', vehicle.purchase_date ? new Date(vehicle.purchase_date).toLocaleDateString('es-ES') : '-'],
        ['Lugar de compra', vehicle.purchase_place || '-'],
        ['Precio base', formatPrice(vehicle.price)],
        ['Precio total', formatPrice(vehicle.total_price || vehicle.price)],
      ];
      drawInfoTable(doc, purchaseRows);

      drawPriceSummary(doc, vehicle, totalModCost);

      // Especificaciones técnicas
      const techComponents = (technicalSpecs || []).flatMap((s) => s.components || []);
      if (techComponents.length > 0) {
        drawSectionTitle(doc, 'Especificaciones técnicas');
        drawComponentsTable(doc, techComponents, opts);
      }

      // Modificaciones
      const modComponents = (modifications || []).flatMap((m) => m.components || []);
      if (modComponents.length > 0) {
        if (doc.y > 600) {
          doc.addPage();
        }
        drawSectionTitle(doc, 'Modificaciones realizadas');
        drawComponentsTable(doc, modComponents, opts);
        doc.fillColor(COLORS.text).fontSize(10).font('Helvetica-Bold');
        doc.text(`Total modificaciones: ${formatPrice(totalModCost)}`, PAGE_WIDTH - MARGIN - 150, doc.y, {
          width: 140,
          align: 'right',
        });
      }

      // Anotaciones
      if (vehicle.anotaciones && String(vehicle.anotaciones).trim()) {
        const anotacionesY = doc.y + 16;
        if (anotacionesY > 680) {
          doc.addPage();
        } else {
          doc.y = anotacionesY;
        }
        drawSectionTitle(doc, 'Anotaciones');
        doc.fillColor(COLORS.text).fontSize(10).font('Helvetica');
        doc.text(String(vehicle.anotaciones).trim(), MARGIN, doc.y, {
          width: CONTENT_WIDTH,
          align: 'left',
        });
      }

      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawHeader(doc, genDate);
        drawFooter(doc, i + 1, totalPages, odometer, genDate);
      }

      doc.end();
    } catch (error) {
      console.error('Error en generateVehicleSpecsPDF:', error);
      reject(error);
    }
  });
}

module.exports = { generateVehicleSpecsPDF };
