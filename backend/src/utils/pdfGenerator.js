const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const { modificationLineTotal } = require('../../lib/componentPricing');
const {
  COLORS,
  MARGIN,
  PAGE_WIDTH,
  CONTENT_WIDTH,
  HEADER_HEIGHT,
  drawHeader,
  drawFooter,
  drawSectionTitle,
  drawInfoTable,
  toDisplayString,
} = require('./pdfLayoutPrimitives');

/** PDFKit solo incrusta JPEG y PNG; las subidas usan WebP por defecto (processVehicleImageBuffer). */
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

function formatComponentPriceColumn(component) {
  const pu = component.price != null && !isNaN(Number(component.price)) ? Number(component.price) : null;
  if (pu == null) return '-';
  let q = parseInt(component.mounted_qty, 10);
  if (Number.isNaN(q) || q < 1) q = 1;
  const line = modificationLineTotal(component.price, component.mounted_qty);
  if (q <= 1) return `${pu.toFixed(2)} €`;
  return `${q} × ${pu.toFixed(2)} € = ${line.toFixed(2)} €`;
}

function drawComponentsTable(doc, components, options = {}) {
  const { minYForNewPage = 150 } = options;
  const colWidths = [120, 140, 120, 100];
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
    const price = formatComponentPriceColumn(component);

    const lineH = Math.max(
      doc.heightOfString(compName, { width: colWidths[0] - 16 }),
      doc.heightOfString(manufacturer, { width: colWidths[1] - 16 }),
      doc.heightOfString(detail, { width: colWidths[2] - 16 }),
      doc.heightOfString(price, { width: colWidths[3] - 16 }),
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
  const basePrice = vehicle.price != null && !isNaN(Number(vehicle.price)) ? Number(vehicle.price) : 0;
  // Siempre sumar modificaciones al precio de compra cuando existan
  const totalPrice = basePrice + (totalModCost || 0);

  doc.save();
  doc.strokeColor(COLORS.border).lineWidth(0.5);
  // Altura del recuadro: dejar aire bajo la última línea (52 pt era corto; el texto en y+44 invadía el borde).
  const priceBoxHeight = 64;
  doc.rect(MARGIN, baseY, CONTENT_WIDTH, priceBoxHeight).stroke();
  doc.fillColor(COLORS.text).fontSize(10).font('Helvetica');
  doc.text('Precio base:', MARGIN + 12, baseY + 12);
  doc.text(formatPrice(vehicle.price), PAGE_WIDTH - MARGIN - 100, baseY + 12, { width: 90, align: 'right' });
  doc.text('Coste modificaciones:', MARGIN + 12, baseY + 28);
  doc.text(formatPrice(totalModCost), PAGE_WIDTH - MARGIN - 100, baseY + 28, { width: 90, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text('Precio total:', MARGIN + 12, baseY + 44);
  doc.text(formatPrice(totalPrice), PAGE_WIDTH - MARGIN - 100, baseY + 44, { width: 90, align: 'right' });
  doc.restore();
  const gapBelowPriceBox = 20;
  doc.y = baseY + priceBoxHeight + gapBelowPriceBox;
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
            totalModCost += modificationLineTotal(c.price, c.mounted_qty);
          });
        });
      }

      const odometer = formatDistance(vehicle.total_distance_meters);
      const opts = { genDate };

      // Imagen (incl. WebP → PNG; antes solo se aceptaba JPEG/PNG por Content-Type y se perdía la foto)
      let imageBuffer = null;
      if (vehicle.image) {
        try {
          const imageResponse = await axios.get(vehicle.image, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });
          const raw = Buffer.from(imageResponse.data);
          if (raw.length > 0) {
            imageBuffer = await bufferForPdfKitImage(raw);
          }
        } catch (_) {}
      }

      const imgWidth = 160;
      const imgHeight = 110;
      const imgX = PAGE_WIDTH - MARGIN - imgWidth;
      const imgY = doc.y;

      if (imageBuffer) {
        try {
          doc.image(imageBuffer, imgX, imgY, {
            fit: [imgWidth, imgHeight],
          });
        } catch (_) {
          doc.rect(imgX, imgY, imgWidth, imgHeight).fill(COLORS.rowAlt);
          doc.fillColor(COLORS.textMuted).fontSize(9);
          doc.text('Sin imagen', imgX, imgY + imgHeight / 2 - 6, {
            width: imgWidth,
            align: 'center',
          });
        }
      } else {
        doc.rect(imgX, imgY, imgWidth, imgHeight).fill(COLORS.rowAlt);
        doc.fillColor(COLORS.textMuted).fontSize(9);
        doc.text('Sin imagen', imgX, imgY + imgHeight / 2 - 6, {
          width: imgWidth,
          align: 'center',
        });
      }

      const dataWidth = imgX - MARGIN - 20;
      doc.fillColor(COLORS.text).fontSize(16).font('Helvetica-Bold');
      doc.text(`${vehicle.manufacturer ?? ''} ${vehicle.model ?? ''}`.trim() || '-', MARGIN, doc.y, {
        width: dataWidth,
      });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.textMuted);
      const refVal = vehicle.reference != null && vehicle.reference !== '' && String(vehicle.reference) !== 'null'
        ? ` · ${vehicle.reference}`
        : '';
      doc.text(refVal.trim() || '-', MARGIN, doc.y, { width: dataWidth });
      doc.moveDown(0.5);

      const scaleStr = vehicle.scale_factor ? `1:${vehicle.scale_factor}` : '-';
      const motorLbl =
        vehicle.motor_position === 'inline'
          ? 'en línea'
          : vehicle.motor_position === 'angular'
            ? 'angular'
            : vehicle.motor_position === 'transverse'
              ? 'transversal'
              : vehicle.motor_position
                ? String(vehicle.motor_position)
                : '-';
      doc.fillColor(COLORS.text).fontSize(10);
      doc.text(
        `Escala: ${scaleStr} · Tipo: ${vehicle.type || '-'} · Tracción: ${vehicle.traction || '-'} · Motor: ${motorLbl}`,
        MARGIN,
        doc.y,
        {
          width: dataWidth,
        },
      );
      doc.moveDown(0.8);

      drawBadges(doc, vehicle);
      doc.y = Math.max(doc.y, imgY + imgHeight + 16);

      // Información de compra
      drawSectionTitle(doc, 'Información de compra');
      const basePrice = vehicle.price != null && !isNaN(Number(vehicle.price)) ? Number(vehicle.price) : 0;
      const computedTotalPrice = basePrice + (totalModCost || 0);
      const purchaseRows = [
        ['Fecha de compra', vehicle.purchase_date ? new Date(vehicle.purchase_date).toLocaleDateString('es-ES') : '-'],
        ['Lugar de compra', vehicle.purchase_place],
        ['Precio base', formatPrice(vehicle.price)],
        ['Precio total', formatPrice(computedTotalPrice)],
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
        drawHeader(doc, genDate, 'Ficha Técnica');
        drawFooter(doc, i + 1, totalPages, genDate, `Odómetro: ${odometer}`);
      }

      doc.end();
    } catch (error) {
      console.error('Error en generateVehicleSpecsPDF:', error);
      reject(error);
    }
  });
}

module.exports = { generateVehicleSpecsPDF };
