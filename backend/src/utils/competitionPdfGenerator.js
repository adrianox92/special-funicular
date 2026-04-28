const PDFDocument = require('pdfkit');
const {
  COLORS,
  MARGIN,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  CONTENT_WIDTH,
  HEADER_HEIGHT,
  drawHeader,
  drawFooter,
  drawSectionTitle,
  drawInfoTable,
  drawAccentDataTable,
} = require('./pdfLayoutPrimitives');
const { isUsableBestLapTimeString, lapTimeStringToSeconds } = require('../../lib/pointsCalculator');

function formatTime(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'string' && value.includes(':')) return value.replace('.', ',');
  const t = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(t)) return '-';
  const minutes = Math.floor(t / 60);
  const seconds = (t % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`.replace('.', ',');
}

function formatDiffShort(leaderSec, curSec) {
  if (leaderSec == null || curSec == null) return '-';
  const d = curSec - leaderSec;
  if (d <= 0 || Number.isNaN(d)) return '-';
  const minutes = Math.floor(d / 60);
  const sec = (d % 60).toFixed(3);
  return `+${String(minutes).padStart(2, '0')}:${sec.padStart(6, '0')}`.replace('.', ',');
}

function competitionTitleLeftLine(competitionName) {
  const n = competitionName ? String(competitionName).slice(0, 80) : 'Competición';
  return `Resultados - ${n}`;
}

/**
 * @param {object} competition
 * @param {Array} participants — filas competition_participants (no usado salvo compat; el ranking va en sorted)
 * @param {Array} timings
 * @param {object} opts
 * @param {Array} opts.sortedParticipants — de calculatePoints
 * @param {Array} [opts.rules]
 */
async function generateCompetitionPDF(competition, _participants, timings, opts = {}) {
  const sortedParticipants = opts.sortedParticipants || [];
  const rules = opts.rules || [];
  const hasPoints =
    rules.length > 0 || sortedParticipants.some((p) => (p.points || 0) > 0);
  const leaderSec = sortedParticipants[0]?.total_time_seconds ?? null;

  return new Promise((resolve, reject) => {
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
        margins: { top: HEADER_HEIGHT + 20, bottom: 44, left: MARGIN, right: MARGIN },
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor(COLORS.text);

      drawSectionTitle(doc, 'Datos generales');
      drawInfoTable(doc, [
        ['Competición', competition.name],
        ['Circuito', competition.circuit_name || 'No especificado'],
        ['Rondas', String(competition.rounds)],
        ['Participantes', String(sortedParticipants.length)],
      ]);

      doc.moveDown(0.5);

      drawSectionTitle(doc, 'Clasificación general');

      const rankHeaders = hasPoints
        ? ['Pos.', 'Piloto', 'Vehic.', 'Rond.', 'Mejor', 'Total', 'Pen.', 'Dif.lider', 'Dif.ant.', 'Pts']
        : ['Pos.', 'Piloto', 'Vehic.', 'Rond.', 'Mejor', 'Total', 'Pen.', 'Dif.lider', 'Dif.ant.'];

      const colWidthsRank = hasPoints
        ? [34, 86, 86, 32, 48, 48, 38, 52, 52, 32]
        : [38, 90, 90, 34, 50, 50, 40, 56, 56];

      const rowsRank = sortedParticipants.map((p, index) => {
        const prev = index > 0 ? sortedParticipants[index - 1] : null;
        const pen = p.penalty_seconds != null ? Number(p.penalty_seconds).toFixed(1) : '0';
        const base = [
          String(p.position),
          p.driver_name || '-',
          (p.vehicle_info || '-').slice(0, 42),
          String(p.rounds_completed),
          formatTime(p.best_lap_time),
          p.total_time || '-',
          pen,
          formatDiffShort(leaderSec, p.total_time_seconds),
          prev && prev.total_time_seconds != null && p.total_time_seconds != null
            ? formatDiffShort(prev.total_time_seconds, p.total_time_seconds)
            : '-',
        ];
        if (hasPoints) base.push(String(p.points != null ? p.points : 0));
        return base;
      });

      drawAccentDataTable(doc, colWidthsRank, rankHeaders, rowsRank, {
        fontSize: 8,
        minYForNewPage: 100,
        headerRowHeight: 28,
      });

      doc.addPage();

      drawSectionTitle(doc, 'Datos por ronda');

      for (let round = 1; round <= competition.rounds; round++) {
        let roundTimings = timings.filter((t) => t.round_number === round);
        roundTimings = roundTimings.slice().sort((a, b) => {
          const ae = lapTimeStringToSeconds(a.best_lap_time);
          const be = lapTimeStringToSeconds(b.best_lap_time);
          if (ae == null && be == null) return 0;
          if (ae == null) return 1;
          if (be == null) return -1;
          return ae - be;
        });

        doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold');
        doc.text(`Ronda ${round}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.4);
        doc.font('Helvetica');

        if (roundTimings.length === 0) {
          doc.fillColor(COLORS.textMuted).fontSize(10);
          doc.text('Sin tiempos registrados en esta ronda.', MARGIN, doc.y);
          doc.moveDown(1.2);
          continue;
        }

        const hRound = ['Piloto', 'Vehic.', 'NP', 'Mejor', 'Vueltas', 'Total', 'Pen.', 'Carril'];
        const wRound = [100, 120, 28, 48, 32, 48, 32, 32];
        const rowsR = roundTimings.map((timing) => {
          const sp = sortedParticipants.find((x) => x.participant_id === timing.participant_id);
          return [
            sp ? sp.driver_name : '-',
            sp ? String(sp.vehicle_info || '-').slice(0, 36) : '-',
            timing.did_not_participate ? 'Sí' : 'No',
            formatTime(timing.best_lap_time),
            String(timing.laps != null ? timing.laps : ''),
            formatTime(timing.total_time),
            Number(timing.penalty_seconds) ? Number(timing.penalty_seconds).toFixed(1) : '0',
            timing.lane || '-',
          ];
        });

        drawAccentDataTable(doc, wRound, hRound, rowsR, {
          fontSize: 8,
          minYForNewPage: 110,
          headerRowHeight: 26,
        });
        doc.moveDown(0.3);
      }

      doc.addPage();
      drawSectionTitle(doc, 'Estadísticas');

      const allBest = timings
        .filter((t) => !t.did_not_participate && isUsableBestLapTimeString(t.best_lap_time))
        .map((t) => ({ t, sec: lapTimeStringToSeconds(t.best_lap_time) }))
        .filter((x) => x.sec != null);

      if (allBest.length > 0) {
        const best = allBest.reduce((a, b) => (a.sec <= b.sec ? a : b));
        const sp = sortedParticipants.find((x) => x.participant_id === best.t.participant_id);
        doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold');
        doc.text('Mejor vuelta de la competición', MARGIN, doc.y);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        doc.text(`Piloto: ${sp ? sp.driver_name : '-'}`);
        doc.text(`Tiempo: ${formatTime(best.t.best_lap_time)}`);
        doc.text(`Ronda: ${best.t.round_number}`);
        doc.moveDown(0.8);
      }

      const mostLaps = sortedParticipants.slice().sort((a, b) => (b.total_laps || 0) - (a.total_laps || 0))[0];
      if (mostLaps && (mostLaps.total_laps || 0) > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text);
        doc.text('Más vueltas completadas', MARGIN, doc.y);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        doc.text(`Piloto: ${mostLaps.driver_name}`);
        doc.text(`Vueltas totales: ${mostLaps.total_laps}`);
        doc.moveDown(0.8);
      }

      const mostRounds = sortedParticipants.slice().sort((a, b) => (b.rounds_completed || 0) - (a.rounds_completed || 0))[0];
      if (mostRounds) {
        doc.font('Helvetica-Bold').fontSize(11);
        doc.text('Más rondas registradas', MARGIN, doc.y);
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        doc.text(`Piloto: ${mostRounds.driver_name}`);
        doc.text(`Rondas: ${mostRounds.rounds_completed} / ${competition.rounds}`);
      }

      const totalPages = doc.bufferedPageRange().count;
      const leftFoot = competitionTitleLeftLine(competition.name);
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawHeader(doc, genDate, 'Resultados de competición');
        drawFooter(doc, i + 1, totalPages, genDate, leftFoot);
      }

      doc.end();
    } catch (error) {
      console.error('Error en generateCompetitionPDF:', error);
      reject(error);
    }
  });
}

module.exports = { generateCompetitionPDF };
