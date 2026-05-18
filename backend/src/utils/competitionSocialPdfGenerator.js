/**
 * PDF compacto (A5 apaisado) para compartir en redes: podio + gráfico de barras de tiempos totales.
 */
const PDFDocument = require('pdfkit');
const { COLORS } = require('./pdfLayoutPrimitives');

function formatTime(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'string' && value.includes(':')) return value.replace('.', ',');
  const t = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(t)) return '-';
  const minutes = Math.floor(t / 60);
  const seconds = (t % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`.replace('.', ',');
}

const PODIUM_COLORS = ['#d4af37', '#c0c0c0', '#cd7f32'];

/**
 * @param {object} competition
 * @param {object} opts
 * @param {Array} opts.sortedParticipants — de calculatePoints
 * @param {Array} [opts.rules]
 * @param {string|null} [opts.clubName]
 */
async function generateCompetitionSocialPDF(competition, opts = {}) {
  const sortedParticipants = opts.sortedParticipants || [];
  const rules = opts.rules || [];
  const clubName = opts.clubName || null;
  const hasPoints =
    rules.length > 0 || sortedParticipants.some((p) => (p.points || 0) > 0);

  const genDate = new Date(competition.created_at || Date.now()).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

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
      const pageH = doc.page.height;
      const margin = 36;
      const contentW = pageW - margin * 2;

      doc.fillColor(COLORS.text);
      doc.fontSize(18).font('Helvetica-Bold');
      doc.text(String(competition.name || 'Competición'), margin, margin, {
        width: contentW,
        align: 'center',
      });

      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      const meta = [
        competition.circuit_name ? `Circuito: ${competition.circuit_name}` : null,
        `${competition.rounds || '-'} rondas`,
        genDate,
      ]
        .filter(Boolean)
        .join('  ·  ');
      doc.text(meta, margin, doc.y, { width: contentW, align: 'center' });

      doc.moveDown(1.2);

      // --- Podio top 3 ---
      // Misma altura en las tres columnas: las alturas escalonadas dejaban el 3º demasiado bajo
      // y los offsets fijos hacían solaparse "Total" y "Pts".
      const top3 = sortedParticipants.slice(0, 3);
      const podiumY = doc.y;
      // Altura extra para nombres largos (varias líneas dentro del ancho de columna).
      const podiumH = 158;
      const colW = contentW / 3;

      top3.forEach((p, idx) => {
        const x = margin + idx * colW + 6;
        const w = colW - 12;
        const h = podiumH;
        const yBase = podiumY;

        doc.save();
        doc.roundedRect(x, yBase, w, h, 6).fill(PODIUM_COLORS[idx]);
        doc.restore();

        doc.fillColor('#1a1a2e');
        let ty = yBase + 8;
        const textOpts = { width: w, align: 'center', lineGap: 1 };

        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(['1º', '2º', '3º'][idx], x, ty, textOpts);
        ty = doc.y + 3;

        const driverName = String(p.driver_name || '-').trim().slice(0, 120);
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(driverName, x, ty, { ...textOpts, lineGap: 2 });
        ty = doc.y + 3;

        doc.fontSize(7).fillColor('#333');
        doc.text(String(p.vehicle_info || '-').slice(0, 36), x, ty, textOpts);
        ty = doc.y + 2;

        doc.fontSize(8).fillColor('#1a1a2e');
        doc.text(`Mejor: ${formatTime(p.best_lap_time)}`, x, ty, textOpts);
        ty = doc.y + 2;

        doc.text(`Total: ${p.total_time || '-'}`, x, ty, textOpts);
        if (hasPoints) {
          ty = doc.y + 2;
          doc.text(`Pts: ${p.points != null ? p.points : 0}`, x, ty, textOpts);
        }
      });

      doc.y = podiumY + podiumH + 16;

      // --- Barras horizontales (top 8) ---
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text);
      doc.text('Tiempos totales (top 8)', margin, doc.y, { width: contentW });
      doc.moveDown(0.4);

      const chartTop = doc.y;
      const chartH = 120;
      const barAreaW = contentW - margin - 120;
      const labelW = 108;

      const top8 = sortedParticipants.slice(0, 8);
      const secs = top8.map((p) =>
        p.total_time_seconds != null && Number.isFinite(Number(p.total_time_seconds))
          ? Number(p.total_time_seconds)
          : null
      );
      const validSecs = secs.filter((s) => s != null && s > 0);
      const maxSec = validSecs.length ? Math.max(...validSecs) : 1;

      const rowH = chartH / Math.max(top8.length, 1);

      top8.forEach((p, i) => {
        const y = chartTop + i * rowH + 2;
        const sec = secs[i];
        const ratio = sec != null && sec > 0 ? sec / maxSec : 0;
        const barW = Math.max(ratio * barAreaW, sec ? 4 : 2);

        doc.fontSize(8).font('Helvetica').fillColor(COLORS.text);
        doc.text(`${p.position}.`.slice(0, 4), margin, y + 4, { width: 22, align: 'left' });
        doc.text(String(p.driver_name || '-').slice(0, 18), margin + 22, y + 4, {
          width: labelW - 22,
        });

        doc.save();
        doc.rect(margin + labelW, y + 3, barW, rowH - 8).fill(COLORS.accent);
        doc.restore();

        doc.fontSize(7).fillColor(COLORS.textMuted);
        doc.text(p.total_time || '-', margin + labelW + barW + 6, y + 5, { width: 80 });
      });

      doc.y = chartTop + chartH + 12;

      // Footer
      doc.fontSize(8).fillColor(COLORS.textMuted).font('Helvetica');
      const footParts = [];
      if (clubName) footParts.push(clubName);
      footParts.push('slotdatabase.es');
      doc.text(footParts.join(' · '), margin, pageH - margin - 14, {
        width: contentW,
        align: 'center',
      });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateCompetitionSocialPDF };
