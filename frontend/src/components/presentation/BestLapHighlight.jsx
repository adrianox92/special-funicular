import React from 'react';
import { FaTrophy, FaClock, FaUser, FaCar, FaTimes } from 'react-icons/fa';

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
          <FaTrophy className="highlight-icon" />
          Mejor Vuelta
        </h2>
        <div className="highlight-content">
          <div className="no-best-lap">
            <FaTimes className="no-lap-icon" />
            <p className="no-lap-text">Sin tiempos registrados</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="best-lap-highlight">
      <h2 className="highlight-title">
        <FaTrophy className="highlight-icon" />
        Mejor Vuelta
      </h2>
      
      <div className="highlight-content">
        <div className="best-lap-info">
          <div className="best-lap-time">
            <p className="time-label">
              <FaClock className="label-icon" />
              Tiempo <span className="time-value">{formatBestLap(bestLap)}</span>
            </p>
            
          </div>
          
          <div className="best-lap-pilot">
            <p className="pilot-label">
              <FaUser className="label-icon" />
              Piloto <span className="pilot-name">{participant.driver_name}</span>
            </p>
            
            {participant.team_name && (
              <span className="team-name">{participant.team_name}</span>
            )}
          </div>
          
          <div className="best-lap-vehicle pb-2">
            <p className="vehicle-label">
              <FaCar className="label-icon" />
              Vehículo <span className="vehicle-brand">{participant.vehicle_brand}</span> <span className="vehicle-name">{participant.vehicle_name} </span>
            </p>            
          </div>
        </div>
      </div>
    </div>
  );
};

export default BestLapHighlight; 