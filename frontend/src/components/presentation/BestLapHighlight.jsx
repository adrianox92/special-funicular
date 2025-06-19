import React from 'react';

const BestLapHighlight = ({ bestLap, participant }) => {
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

  if (!bestLap || !participant) {
    return (
      <div className="best-lap-highlight">
        <h2 className="highlight-title">Mejor Vuelta</h2>
        <div className="highlight-content">
          <div className="no-best-lap">
            <span className="no-lap-icon">⏱️</span>
            <p className="no-lap-text">Sin tiempos registrados</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="best-lap-highlight">
      <h2 className="highlight-title">🏆 Mejor Vuelta</h2>
      
      <div className="highlight-content">
        <div className="best-lap-info">
          <div className="best-lap-time">
            <span className="time-label">Tiempo</span>
            <span className="time-value">{formatBestLap(bestLap)}</span>
          </div>
          
          <div className="best-lap-pilot">
            <span className="pilot-label">Piloto</span>
            <span className="pilot-name">{participant.driver_name}</span>
            {participant.team_name && (
              <span className="team-name">{participant.team_name}</span>
            )}
          </div>
          
          <div className="best-lap-vehicle">
            <span className="vehicle-label">Vehículo</span>
            <span className="vehicle-name">{participant.vehicle_name}</span>
            <span className="vehicle-brand">{participant.vehicle_brand}</span>
          </div>
        </div>
        
        <div className="best-lap-badge">
          <span className="badge-icon">🏆</span>
          <span className="badge-text">Mejor Vuelta</span>
        </div>
      </div>
    </div>
  );
};

export default BestLapHighlight; 