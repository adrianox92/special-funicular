import React from 'react';
import { Trophy, User, Car, X } from 'lucide-react';

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
        <h2 className="highlight-title">
          <Trophy className="highlight-icon" />
          Mejor vuelta de la prueba
        </h2>
        <p className="highlight-subtitle">Récord de vuelta entre todos los participantes</p>
        <div className="highlight-content">
          <div className="no-best-lap">
            <X className="no-lap-icon" />
            <p className="no-lap-text">Sin tiempos registrados</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="best-lap-highlight best-lap-highlight--has-lap">
      <h2 className="highlight-title">
        <Trophy className="highlight-icon" />
        Mejor vuelta de la prueba
      </h2>
      <p className="highlight-subtitle">Récord de vuelta entre todos los participantes</p>
      <div className="highlight-content">
        <div className="best-lap-hero-time" aria-label={`Mejor vuelta ${formatBestLap(bestLap)}`}>
          {formatBestLap(bestLap)}
        </div>
        <div className="best-lap-info">
          <div className="best-lap-pilot">
            <p className="pilot-label">
              <User className="label-icon" />
              Piloto <span className="pilot-name">{participant.driver_name}</span>
            </p>
            
            {participant.team_name && (
              <span className="team-name">{participant.team_name}</span>
            )}
          </div>
          
          <div className="best-lap-vehicle pb-2">
            <p className="vehicle-label">
              <Car className="label-icon" />
              Vehículo <span className="vehicle-brand">{participant.vehicle_brand}</span> <span className="vehicle-name">{participant.vehicle_name} </span>
            </p>            
          </div>
        </div>
      </div>
    </div>
  );
};

export default BestLapHighlight; 