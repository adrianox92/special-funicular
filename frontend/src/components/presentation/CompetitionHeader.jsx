import React from 'react';

const CompetitionHeader = ({ competition }) => {
  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'En Curso';
      case 'finished':
        return 'Finalizada';
      case 'pending':
        return 'Pendiente';
      default:
        return 'Desconocido';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'finished':
        return 'status-finished';
      case 'pending':
        return 'status-pending';
      default:
        return 'status-unknown';
    }
  };

  return (
    <div className="competition-header">
      <div className="header-content">
        <div className="header-main">
          <h1 className="competition-title">Competición: {competition.name}</h1>
          <div className="competition-meta">
            <span className="rounds-info">
              {competition.rounds} {competition.rounds === 1 ? 'Ronda' : 'Rondas'}
            </span>
            {competition.category && (
              <span className="category-info">
                {competition.category}
              </span>
            )}
            
          </div>
        </div>
        
        {competition.circuit_name && (
          <div className="circuit-info">
            <span className="circuit-name">{competition.circuit_name}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionHeader; 