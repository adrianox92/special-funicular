const PDFDocument = require('pdfkit');
const axios = require('axios');

function getComponentShortDescription(component) {
  // Descripción resumida para la tabla
  let desc = '';
  if (component.manufacturer) desc += `${component.manufacturer}`;
  if (component.material) desc += desc ? `, ${component.material}` : `${component.material}`;
  if (component.size) desc += desc ? `, ${component.size}` : `${component.size}`;
  if (component.color) desc += desc ? `, ${component.color}` : `${component.color}`;
  return desc;
}

async function generateVehicleSpecsPDF(vehicle, technicalSpecs, modifications) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Iniciando generación de PDF con:', {
        vehicleModel: vehicle.model,
        techSpecsCount: technicalSpecs?.length,
        modsCount: modifications?.length
      });

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true // Habilitar buffer de páginas
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Título
      doc.fontSize(24)
         .text('Ficha Técnica', { align: 'center' })
         .moveDown();

      // Datos básicos e imagen en la misma "fila"
      let imageBuffer = null;
      let imageError = false;
      if (vehicle.image) {
        try {
          const imageResponse = await axios.get(vehicle.image, { responseType: 'arraybuffer', timeout: 5000 });
          const contentType = imageResponse.headers['content-type'];
          if (contentType && (contentType.includes('jpeg') || contentType.includes('png'))) {
            imageBuffer = Buffer.from(imageResponse.data);
          } else {
            imageError = true;
          }
        } catch (error) {
          imageError = true;
        }
      }
      // Definir posiciones
      const leftX = 50;
      const topY = doc.y;
      const imageWidth = 180;
      const imageHeight = 120;
      const gap = 30;
      const dataWidth = 250;
      // Dibujar datos básicos
      doc.fontSize(18).fillColor('black').text(`${vehicle.manufacturer} ${vehicle.model}`, leftX, topY);
      doc.moveDown(0.5);
      const basicData = [
        ['Tipo', vehicle.type],
        ['Tracción', vehicle.traction],
        ['Precio Original', `${Number(vehicle.price).toFixed(2)}€`],
        ['Precio Actual', `${Number(vehicle.total_price).toFixed(2) || Number(vehicle.price).toFixed(2)}€`],
        ['Fecha de Compra', new Date(vehicle.purchase_date).toLocaleDateString()],
        ['Digital', vehicle.digital ? 'Sí' : 'No'],
        ['Modificado', vehicle.modified ? 'Sí' : 'No']
      ];
      let y = doc.y;
      basicData.forEach(([label, value]) => {
        doc.fontSize(12)
           .text(label, leftX, y)
           .text(value, leftX + 100, y);
        y += 18;
      });
      // Dibujar imagen a la derecha de los datos
      if (imageBuffer) {
        try {
          doc.image(imageBuffer, leftX + dataWidth + gap, topY, {
            fit: [imageWidth, imageHeight],
            align: 'right',
            valign: 'top'
          });
        } catch (e) {
          doc.fontSize(10).fillColor('red').text('No se pudo mostrar la imagen (formato no soportado).', leftX + dataWidth + gap, topY + 40, { width: imageWidth });
        }
      } else if (imageError) {
        doc.fontSize(10).fillColor('red').text('No se pudo cargar la imagen del vehículo o el formato no es compatible (solo JPG/PNG).', leftX + dataWidth + gap, topY + 40, { width: imageWidth });
      }
      doc.moveDown(4);
      // Especificaciones técnicas
      if (technicalSpecs && technicalSpecs.length > 0 && technicalSpecs.some(spec => spec.components && spec.components.length > 0)) {
        console.log('Procesando especificaciones técnicas:', technicalSpecs.length);
        doc.fontSize(16).fillColor('black').text('Especificaciones Técnicas').moveDown();
        technicalSpecs.forEach((spec, index) => {
          console.log(`Procesando especificación técnica ${index + 1}:`, spec);
          if (spec.components && Array.isArray(spec.components) && spec.components.length > 0) {
            let y = doc.y;
            doc.fontSize(12)
               .text('Componente', 50, y)
               .text('Descripción', 200, y, { width: 200 })
               .text('Precio', 450, y);
            y += 20;
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 10;
            spec.components.forEach(component => {
              if (y > 700) {
                doc.addPage();
                y = 50;
              }
              // Calcular altura de cada celda
              doc.fontSize(10);
              const compName = component.element || component.name || '';
              const desc = getComponentShortDescription(component);
              const price = component.price ? `${component.price}€` : '';
              const nameHeight = doc.heightOfString(compName, { width: 140 });
              const descHeight = doc.heightOfString(desc, { width: 240 });
              const priceHeight = doc.heightOfString(price, { width: 60 });
              const rowHeight = Math.max(nameHeight, descHeight, priceHeight, 16);
              doc.text(compName, 50, y, { width: 140 });
              doc.text(desc, 200, y, { width: 240 });
              doc.text(price, 450, y, { width: 60 });
              y += rowHeight + 4;
            });
            doc.moveDown(2);
          } else {
            console.log(`Especificación técnica ${index + 1} no tiene componentes`);
          }
        });
      }
      // Modificaciones
      if (modifications && modifications.length > 0 && modifications.some(mod => mod.components && mod.components.length > 0)) {
        // Solo agregar nueva página si hay especificaciones técnicas previas y no estamos ya al inicio de una página
        if (
          technicalSpecs && technicalSpecs.length > 0 && technicalSpecs.some(spec => spec.components && spec.components.length > 0)
          && doc.y > 100 // Si ya hemos escrito algo en la página
        ) {
          doc.addPage();
        }
        doc.moveDown(2);
        doc.fontSize(16).fillColor('black').text('Modificaciones Realizadas', { align: 'center' }).moveDown();
        let totalModCost = 0;
        modifications.forEach((mod, index) => {
          if (mod.components && Array.isArray(mod.components) && mod.components.length > 0) {
            let y = doc.y;
            doc.fontSize(12)
               .text('Componente', 50, y)
               .text('Descripción', 200, y, { width: 200 })
               .text('Precio', 450, y);
            y += 20;
            doc.moveTo(50, y).lineTo(550, y).stroke();
            y += 10;
            mod.components.forEach(component => {
              if (y > 700) {
                doc.addPage();
                y = 50;
              }
              doc.fontSize(10);
              const compName = component.element || component.name || '';
              const desc = getComponentShortDescription(component);
              const price = component.price ? `${Number(component.price).toFixed(2)}€` : '';
              const nameHeight = doc.heightOfString(compName, { width: 140 });
              const descHeight = doc.heightOfString(desc, { width: 240 });
              const priceHeight = doc.heightOfString(price, { width: 60 });
              const rowHeight = Math.max(nameHeight, descHeight, priceHeight, 16);
              totalModCost += component.price ? Number(component.price) : 0;
              doc.text(compName, 50, y, { width: 140 });
              doc.text(desc, 200, y, { width: 240 });
              doc.text(price, 450, y, { width: 60 });
              y += rowHeight + 4;
            });
            doc.moveDown(2);
          }
        });
        doc.fontSize(12)
           .text(`Costo total de modificaciones: ${totalModCost.toFixed(2)}€`, 350, doc.y + 10, { align: 'right' });
      }
      doc.end();
      console.log('PDF generado exitosamente');
    } catch (error) {
      console.error('Error en generateVehicleSpecsPDF:', error);
      reject(error);
    }
  });
}

module.exports = { generateVehicleSpecsPDF }; 