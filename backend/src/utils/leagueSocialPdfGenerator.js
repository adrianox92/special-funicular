/**
 * PDF compacto (A5 apaisado) para compartir clasificación de liga en redes.
 */
const PDFDocument = require('pdfkit');
const { COLORS } = require('./pdfLayoutPrimitives');

const PODIUM_COLORS = ['#d4af37', '#c0c0c0', '#cd7f32'];

/**
 * @param {object} league
 * @param {object} opts
 * @param {Array} opts.standings
 * @param {string|null} [opts.clubName]
 */
async function generateLeagueSocialPDF(league, opts = {}) {
  const standings = opts.standings || [];
  const clubName = opts.clubName || null;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A5',
        layout: 'landscape',
        margins: { top: 36, bottom: 44, left: 36, right: 36 },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const margin = 36;
      const contentW = pageW - margin * 2;

      doc.fillColor(COLORS.text);
      doc.fontSize(18).font('Helvetica-Bold');
      doc.text(String(league.name || 'Liga'), margin, margin, {
        width: contentW,
        align: 'center',
      });

      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      const meta = [
        clubName ? `Club: ${clubName}` : null,
        league.counting_races ? `Cuentan ${league.counting_races} pruebas` : null,
        new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      ]
        .filter(Boolean)
        .join('  ·  ');
      doc.text(meta || 'Clasificación de liga', margin, doc.y, { width: contentW, align: 'center' });

      doc.moveDown(1.2);

      const top3 = standings.slice(0, 3);
      const podiumW = contentW / 3;
      const baseY = doc.y + 60;

      top3.forEach((row, i) => {
        const x = margin + i * podiumW + podiumW / 2 - 30;
        const color = PODIUM_COLORS[i] || '#888';
        doc.fillColor(color);
        doc.circle(x + 30, baseY - 20, 18).fill();
        doc.fillColor(COLORS.text);
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text(String(i + 1), x + 22, baseY - 28, { width: 16, align: 'center' });
        doc.fontSize(9).font('Helvetica');
        doc.text(String(row.name || ''), x - 10, baseY + 4, { width: 80, align: 'center' });
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`${row.total_points} pts`, x - 10, baseY + 22, { width: 80, align: 'center' });
      });

      doc.moveDown(4);
      doc.fontSize(9).font('Helvetica');
      const rest = standings.slice(3, 10);
      rest.forEach((row) => {
        doc.text(`${row.position}. ${row.name} — ${row.total_points} pts`, margin, doc.y, {
          width: contentW,
        });
        doc.moveDown(0.3);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateLeagueSocialPDF };
