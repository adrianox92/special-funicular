import React from 'react';

const LiveRankingTable = ({ participants }) => {
  // Ordenar participantes por tiempo total + penalizaciones
  const sortedParticipants = [...participants].sort((a, b) => {
    const timeA = a.total_time_timestamp || 0;
    const timeB = b.total_time_timestamp || 0;
    
    // Si ambos tienen tiempo, ordenar por tiempo
    if (timeA > 0 && timeB > 0) {
      return timeA - timeB;
    }
    
    // Si solo A tiene tiempo, A va primero
    if (timeA > 0 && timeB === 0) {
      return -1;
    }
    
    // Si solo B tiene tiempo, B va primero
    if (timeA === 0 && timeB > 0) {
      return 1;
    }
    
    // Si ninguno tiene tiempo, mantener orden original
    return 0;
  });

  // Filtrar participantes sin tiempo (opcional - comentar si quieres mostrarlos al final)
  const participantsWithTime = sortedParticipants.filter(p => (p.total_time_timestamp || 0) > 0);

  // Formatea segundos (float o int) a mm:ss.mmm
  const formatTime = (timestamp) => {
    if (timestamp === null || timestamp === undefined || isNaN(timestamp)) return '--:--.---';
    const totalMs = Math.round(Number(timestamp) * 1000);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Formatea mejor vuelta (float o string) a mm:ss.mmm
  const formatBestLap = (bestLap) => {
    if (!bestLap || isNaN(Number(bestLap))) return '--:--.---';
    const lap = Number(bestLap);
    const minutes = Math.floor(lap / 60);
    const seconds = Math.floor(lap % 60);
    const milliseconds = Math.round((lap - Math.floor(lap)) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const getPositionClass = (position) => {
    switch (position) {
      case 1:
        return 'position-gold';
      case 2:
        return 'position-silver';
      case 3:
        return 'position-bronze';
      default:
        return '';
    }
  };

  // Formatea diferencia en formato +XX.XXX
  const formatGap = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '-';
    if (seconds === 0) return '-';
    
    // Corregir errores de precisión de punto flotante
    const correctedSeconds = Math.round(seconds * 1000) / 1000;
    
    const minutes = Math.floor(correctedSeconds / 60);
    const remainingSeconds = (correctedSeconds % 60).toFixed(3);
    
    if (minutes > 0) {
      return `+${minutes}:${remainingSeconds.padStart(6, '0')}`;
    } else {
      return `+${remainingSeconds}`;
    }
  };

  // Calcular diferencias
  const participantsWithGaps = participantsWithTime.map((participant, index) => {
    const totalTime = participant.total_time_timestamp || 0; // Ya incluye penalizaciones
    
    // Diferencia con el líder
    let leaderGap = null;
    if (index > 0 && participantsWithTime[0].total_time_timestamp > 0) {
      const leaderTime = participantsWithTime[0].total_time_timestamp || 0; // Ya incluye penalizaciones
      if (totalTime > 0 && leaderTime > 0) {
        leaderGap = totalTime - leaderTime;
      }
    }
    
    // Diferencia con el anterior
    let previousGap = null;
    if (index > 0 && participantsWithTime[index - 1].total_time_timestamp > 0) {
      const previousTime = participantsWithTime[index - 1].total_time_timestamp || 0; // Ya incluye penalizaciones
      if (totalTime > 0 && previousTime > 0) {
        previousGap = totalTime - previousTime;
      }
    }
    
    return {
      ...participant,
      leaderGap,
      previousGap
    };
  });

  return (
    <div className="live-ranking-table">
      <h2 className="table-title">Clasificación en Vivo</h2>
      
      <div className="table-container">
        <table className="ranking-table">
          <thead>
            <tr>
              <th className="position-col">Pos</th>
              <th className="driver-col">Piloto</th>
              <th className="vehicle-col">Vehículo</th>
              <th className="time-col">Tiempo Total</th>
              <th className="penalty-col">Penalización</th>
              <th className="best-lap-col">Mejor Vuelta</th>
              <th className="gap-leader-col">Dif. Líder</th>
              <th className="gap-previous-col">Dif. Anterior</th>
            </tr>
          </thead>
          <tbody>
            {participantsWithGaps.map((participant, index) => {
              const position = index + 1;
              const totalTime = participant.total_time_timestamp || 0; // Ya incluye penalizaciones
              
              return (
                <tr key={participant.id} className={getPositionClass(position)}>
                  <td className="position-cell">
                    <span className="position-number">{position}</span>
                  </td>
                  <td className="driver-cell">
                    <div className="driver-info">
                      <span className="driver-name">{participant.driver_name}</span>
                      {participant.team_name && (
                        <span className="team-name">{participant.team_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="vehicle-cell">
                    <div className="vehicle-info">
                      <span className="vehicle-name">{participant.vehicle_name}</span>
                      <span className="vehicle-brand">{participant.vehicle_brand}</span>
                    </div>
                  </td>
                  <td className="time-cell">
                    <span className="total-time">
                      {formatTime(participant.total_time_timestamp)}
                    </span>
                  </td>
                  <td className="penalty-cell">
                    {participant.penalties > 0 ? (
                      <span className="penalty-time">+{formatTime(participant.penalties)}</span>
                    ) : (
                      <span className="no-penalty">-</span>
                    )}
                  </td>
                  <td className="best-lap-cell">
                    <span className="best-lap-time">
                      {formatBestLap(participant.best_lap)}
                    </span>
                  </td>
                  <td className="gap-leader-cell">
                    <span className="gap-leader">
                      {formatGap(participant.leaderGap)}
                    </span>
                  </td>
                  <td className="gap-previous-cell">
                    <span className="gap-previous">
                      {formatGap(participant.previousGap)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveRankingTable; 