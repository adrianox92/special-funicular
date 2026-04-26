import React from 'react';
import { CheckCircle, Clock, Pause, ListOrdered, Ban } from 'lucide-react';

const RoundProgressGrid = ({ competition, participants }) => {
  const formatTime = (timestamp) => {
    if (timestamp == null || timestamp === '' || !timestamp) return '--:--';
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

    if (round.did_not_participate) {
      return 'dnp';
    }
    
    if (round.time_timestamp != null && round.time_timestamp > 0) {
      return 'completed';
    }
    
    return 'in-progress';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'dnp':
        return <Ban />;
      case 'in-progress':
        return <Clock />;
      case 'pending':
      default:
        return <Pause />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'round-completed';
      case 'dnp':
        return 'round-dnp';
      case 'in-progress':
        return 'round-in-progress';
      case 'pending':
      default:
        return 'round-pending';
    }
  };

  return (
    <div className="round-progress-grid">
      <div className="grid-title-block">
        <h2 className="grid-title">
          <ListOrdered className="grid-icon" />
          Progreso por rondas
        </h2>
        <p className="grid-subtitle">Estado de cada tanda · Leyenda al pie</p>
      </div>
      
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
                  <span className="participant-name">{participant.driver_name}</span>
                  <span className="participant-vehicle">{participant.vehicle_name}</span>
                </div>
              </div>
              
              {Array.from({ length: competition.rounds }, (_, i) => {
                const roundNumber = i + 1;
                const status = getRoundStatus(participant, roundNumber);
                const round = participant.rounds?.find(r => r.round_number === roundNumber);
                const isDnp = status === 'dnp';
                
                return (
                  <div key={roundNumber} className={`round-cell ${getStatusClass(status)}`}>
                    <div className="round-content">
                      <span className="round-icon">{getStatusIcon(status)}</span>
                      {isDnp && (
                        <span className="round-np-label">NP</span>
                      )}
                      {!isDnp && round?.time_timestamp != null && round.time_timestamp > 0 && (
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
          <CheckCircle className="legend-icon" />
          <span className="legend-text">Completada</span>
        </div>
        <div className="legend-item">
          <Ban className="legend-icon" />
          <span className="legend-text">NP (no participó)</span>
        </div>
        <div className="legend-item">
          <Clock className="legend-icon" />
          <span className="legend-text">En progreso</span>
        </div>
        <div className="legend-item">
          <Pause className="legend-icon" />
          <span className="legend-text">Pendiente</span>
        </div>
      </div>
    </div>
  );
};

export default RoundProgressGrid;
