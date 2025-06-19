import React from 'react';

const RoundProgressGrid = ({ competition, participants }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    const milliseconds = Math.floor((timestamp % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const getRoundStatus = (participant, roundNumber) => {
    const round = participant.rounds?.find(r => r.round_number === roundNumber);
    
    if (!round) {
      return 'pending';
    }
    
    if (round.time_timestamp) {
      return 'completed';
    }
    
    return 'in-progress';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in-progress':
        return '⏳';
      case 'pending':
      default:
        return '⏸️';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'round-completed';
      case 'in-progress':
        return 'round-in-progress';
      case 'pending':
      default:
        return 'round-pending';
    }
  };

  return (
    <div className="round-progress-grid">
      <h2 className="grid-title">Progreso por Rondas</h2>
      
      <div className="grid-container">
        <div className="grid-header">
          <div className="participant-header">Piloto</div>
          {Array.from({ length: competition.rounds }, (_, i) => (
            <div key={i + 1} className="round-header">
              R{i + 1}
            </div>
          ))}
        </div>
        
        <div className="grid-body">
          {participants.map((participant) => (
            <div key={participant.id} className="participant-row">
              <div className="participant-cell">
                <div className="participant-info">
                  <span className="participant-name">{participant.driver_name} </span>
                  <span className="participant-vehicle">{participant.vehicle_name}</span>
                </div>
              </div>
              
              {Array.from({ length: competition.rounds }, (_, i) => {
                const roundNumber = i + 1;
                const status = getRoundStatus(participant, roundNumber);
                const round = participant.rounds?.find(r => r.round_number === roundNumber);
                
                return (
                  <div key={roundNumber} className={`round-cell ${getStatusClass(status)}`}>
                    <div className="round-content">
                      <span className="round-icon">{getStatusIcon(status)}</span>
                      {round?.time_timestamp && (
                        <span className="round-time">
                          {formatTime(round.time_timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      <div className="grid-legend">
        <div className="legend-item">
          <span className="legend-icon">✅</span>
          <span className="legend-text">Completada</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">⏳</span>
          <span className="legend-text">En progreso</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">⏸️</span>
          <span className="legend-text">Pendiente</span>
        </div>
      </div>
    </div>
  );
};

export default RoundProgressGrid; 