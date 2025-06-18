const PDFDocument = require('pdfkit');

function formatTime(time) {
  if (!time) return '-';
  // Si ya está en formato mm:ss.mmm, devolver tal cual
  if (typeof time === 'string' && time.includes(':')) return time.replace('.', ',');
  // Si es número de segundos, convertir a mm:ss.mmm
  const t = typeof time === 'number' ? time : parseFloat(time);
  if (isNaN(t)) return '-';
  const minutes = Math.floor(t / 60);
  const seconds = (t % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`.replace('.', ',');
}

function getVehicleInfo(participant) {
  if (participant.vehicles) {
    return `${participant.vehicles.manufacturer} ${participant.vehicles.model}`;
  } else if (participant.vehicle_model) {
    return participant.vehicle_model;
  }
  return 'Sin vehículo';
}

function drawTableRow(doc, x, y, colWidths, rowData, options = {}) {
  // Calcula la altura máxima de la fila
  const heights = rowData.map((cell, i) =>
    doc.heightOfString(cell, { width: colWidths[i], ...options })
  );
  const rowHeight = Math.max(...heights, 16);

  // Escribe cada celda
  let colX = x;
  rowData.forEach((cell, i) => {
    if (options.bold) doc.font('Helvetica-Bold');
    else doc.font('Helvetica');
    doc.fontSize(options.fontSize || 9)
      .text(cell, colX, y, { width: colWidths[i], continued: false });
    colX += colWidths[i];
  });

  // Línea inferior (eliminada)
  // if (options.underline) {
  //   doc.moveTo(x, y + rowHeight).lineTo(x + colWidths.reduce((a, b) => a + b, 0), y + rowHeight).stroke();
  // }

  return rowHeight;
}

async function generateCompetitionPDF(competition, participants, timings) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Título principal
      doc.font('Helvetica-Bold').fontSize(24)
         .text('Reporte de Competición', { align: 'center' })
         .moveDown(1.5);

      // Información de la competición en dos columnas, con más espacio vertical
      doc.font('Helvetica-Bold').fontSize(16).text(competition.name, { align: 'center' });
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(12);
      const infoX = 80;
      let infoY = doc.y;
      const labelWidth = 90;
      const valueX = infoX + labelWidth + 10;
      const lineHeight = 18;
      doc.text('Circuito:', infoX, infoY);
      doc.text(competition.circuit_name || 'No especificado', valueX, infoY);
      infoY += lineHeight;
      doc.text('Rondas:', infoX, infoY);
      doc.text(competition.rounds.toString(), valueX, infoY);
      infoY += lineHeight;
      doc.text('Participantes:', infoX, infoY);
      doc.text(participants.length.toString(), valueX, infoY);
      infoY += lineHeight;
      doc.text('Fecha:', infoX, infoY);
      doc.text(new Date().toLocaleDateString('es-ES'), valueX, infoY);
      doc.moveDown(4);

      // Calcular estadísticas por participante
      const participantStats = {};
      participants.forEach(participant => {
        const participantTimings = timings.filter(t => t.participant_id === participant.id);
        
        if (participantTimings.length > 0) {
          const bestLap = Math.min(...participantTimings.map(t => parseFloat(t.best_lap_time) || Infinity));
          const totalLaps = participantTimings.reduce((sum, t) => sum + (parseInt(t.laps) || 0), 0);
          const totalTime = participantTimings.reduce((sum, t) => sum + (parseFloat(t.total_time) || 0), 0);
          
          participantStats[participant.id] = {
            bestLap: bestLap === Infinity ? 0 : bestLap,
            totalLaps,
            totalTime,
            roundsCompleted: participantTimings.length
          };
        } else {
          participantStats[participant.id] = {
            bestLap: 0,
            totalLaps: 0,
            totalTime: 0,
            roundsCompleted: 0
          };
        }
      });

      // Ordenar participantes por mejor vuelta
      const sortedParticipants = participants.slice().sort((a, b) => {
        const aBestLap = participantStats[a.id].bestLap;
        const bBestLap = participantStats[b.id].bestLap;
        if (aBestLap === 0 && bBestLap === 0) return 0;
        if (aBestLap === 0) return 1;
        if (bBestLap === 0) return -1;
        return aBestLap - bBestLap;
      });

      // RANKING GENERAL
      doc.font('Helvetica-Bold').fontSize(16)
         .text('RANKING GENERAL', { align: 'center' })
         .moveDown(0.7);

      // Tabla de ranking
      const tableX = 50;
      let tableY = doc.y;
      const colWidths = [25, 70, 90, 50, 40, 60, 40];
      const headers = ['Pos', 'Piloto', 'Vehículo', 'Mejor Vuelta', 'Vueltas', 'Tiempo Total', 'Rondas'];
      drawTableRow(doc, tableX, tableY, colWidths, headers, { bold: true, fontSize: 8 });
      tableY += 18;

      sortedParticipants.forEach((participant, index) => {
        if (tableY > 750) {
          doc.addPage();
          tableY = 50;
          drawTableRow(doc, tableX, tableY, colWidths, headers, { bold: true, fontSize: 8 });
          tableY += 18;
        }
        const stats = participantStats[participant.id];
        const rowData = [
          `${index + 1}º`,
          participant.driver_name,
          getVehicleInfo(participant),
          formatTime(stats.bestLap),
          stats.totalLaps.toString(),
          formatTime(stats.totalTime),
          stats.roundsCompleted.toString()
        ];
        const rowHeight = drawTableRow(doc, tableX, tableY, colWidths, rowData, { fontSize: 8 });
        tableY += rowHeight + 1;
      });

      doc.moveDown(2);

      // DATOS POR RONDA
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(16)
         .text('DATOS POR RONDA', { align: 'center' })
         .moveDown(0.7);

      for (let round = 1; round <= competition.rounds; round++) {
        if (doc.y > 650) {
          doc.addPage();
          doc.font('Helvetica-Bold').fontSize(16).text('DATOS POR RONDA (continuación)', { align: 'center' }).moveDown(0.7);
        }
        doc.font('Helvetica-Bold').fontSize(12)
           .text(`Ronda ${round}`, { align: 'center' })
           .moveDown(0.3);

        const roundTimings = timings.filter(t => t.round_number === round);
        if (roundTimings.length > 0) {
          const roundColWidths = [70, 90, 50, 40, 60, 60, 30];
          const roundHeaders = ['Piloto', 'Vehículo', 'Mejor Vuelta', 'Vueltas', 'Tiempo Total', 'Tiempo Prom.', 'Carril'];
          let roundY = doc.y;
          drawTableRow(doc, tableX, roundY, roundColWidths, roundHeaders, { bold: true, fontSize: 8 });
          roundY += 16;

          // Ordenar tiempos de la ronda por mejor vuelta
          const sortedRoundTimings = roundTimings.slice().sort((a, b) => {
            const aBestLap = parseFloat(a.best_lap_time) || Infinity;
            const bBestLap = parseFloat(b.best_lap_time) || Infinity;
            return aBestLap - bBestLap;
          });

          sortedRoundTimings.forEach((timing) => {
            if (roundY > 750) {
              doc.addPage();
              roundY = 50;
              drawTableRow(doc, tableX, roundY, roundColWidths, roundHeaders, { bold: true, fontSize: 8 });
              roundY += 16;
            }
            const participant = participants.find(p => p.id === timing.participant_id);
            if (participant) {
              const rowData = [
                participant.driver_name,
                getVehicleInfo(participant),
                formatTime(timing.best_lap_time),
                timing.laps.toString(),
                formatTime(timing.total_time),
                formatTime(timing.average_time),
                timing.lane || '-'
              ];
              const rowHeight = drawTableRow(doc, tableX, roundY, roundColWidths, rowData, { fontSize: 8 });
              roundY += rowHeight + 1;
            }
          });
          doc.y = roundY + 8;
        } else {
          doc.font('Helvetica').fontSize(11)
             .text('No hay datos registrados para esta ronda', { align: 'center' });
          doc.moveDown(1);
        }
      }

      // ESTADÍSTICAS ADICIONALES
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(16)
         .text('ESTADÍSTICAS ADICIONALES', { align: 'center' })
         .moveDown(0.7);

      // Mejor vuelta de la competición
      const allBestLaps = timings
        .map(t => parseFloat(t.best_lap_time))
        .filter(t => !isNaN(t) && t > 0);
      
      if (allBestLaps.length > 0) {
        const overallBestLap = Math.min(...allBestLaps);
        const bestLapTiming = timings.find(t => parseFloat(t.best_lap_time) === overallBestLap);
        const bestLapParticipant = participants.find(p => p.id === bestLapTiming.participant_id);

        doc.font('Helvetica-Bold').fontSize(12)
           .text('Mejor Vuelta de la Competición', { align: 'left' })
           .moveDown(0.3);

        doc.font('Helvetica').fontSize(11);
        doc.text(`Piloto: ${bestLapParticipant.driver_name}`);
        doc.text(`Vehículo: ${getVehicleInfo(bestLapParticipant)}`);
        doc.text(`Tiempo: ${formatTime(overallBestLap)}`);
        doc.text(`Ronda: ${bestLapTiming.round_number}`);
        doc.text(`Carril: ${bestLapTiming.lane || 'No especificado'}`);
        doc.moveDown(1);
      }

      // Participante con más vueltas
      const participantWithMostLaps = sortedParticipants.reduce((max, participant) => {
        const stats = participantStats[participant.id];
        const maxStats = participantStats[max.id];
        return stats.totalLaps > maxStats.totalLaps ? participant : max;
      });
      const mostLapsStats = participantStats[participantWithMostLaps.id];

      doc.font('Helvetica-Bold').fontSize(12)
         .text('Más Vueltas Completadas', { align: 'left' })
         .moveDown(0.3);
      doc.font('Helvetica').fontSize(11);
      doc.text(`Piloto: ${participantWithMostLaps.driver_name}`);
      doc.text(`Vehículo: ${getVehicleInfo(participantWithMostLaps)}`);
      doc.text(`Vueltas totales: ${mostLapsStats.totalLaps}`);
      doc.text(`Rondas completadas: ${mostLapsStats.roundsCompleted}`);
      doc.moveDown(1);

      // Participante con más rondas completadas
      const participantWithMostRounds = sortedParticipants.reduce((max, participant) => {
        const stats = participantStats[participant.id];
        const maxStats = participantStats[max.id];
        return stats.roundsCompleted > maxStats.roundsCompleted ? participant : max;
      });
      const mostRoundsStats = participantStats[participantWithMostRounds.id];

      doc.font('Helvetica-Bold').fontSize(12)
         .text('Más Rondas Completadas', { align: 'left' })
         .moveDown(0.3);
      doc.font('Helvetica').fontSize(11);
      doc.text(`Piloto: ${participantWithMostRounds.driver_name}`);
      doc.text(`Vehículo: ${getVehicleInfo(participantWithMostRounds)}`);
      doc.text(`Rondas completadas: ${mostRoundsStats.roundsCompleted}/${competition.rounds}`);

      doc.end();
    } catch (error) {
      console.error('Error en generateCompetitionPDF:', error);
      reject(error);
    }
  });
}

module.exports = { generateCompetitionPDF }; 