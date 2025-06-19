import React from 'react';
import { FaTrophy, FaFlag, FaCalendarAlt, FaUsers } from 'react-icons/fa';

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
          <h1 className="competition-title">
            <FaTrophy className="title-icon" />
            {competition.name}
          </h1>
          <div className="competition-meta">
            <span className="rounds-info">
              <FaFlag className="meta-icon" />
              {competition.rounds} {competition.rounds === 1 ? 'Ronda' : 'Rondas'}
            </span>
            {competition.category && (
              <span className="category-info">
                <FaUsers className="meta-icon" />
                {competition.category}
              </span>
            )}
            <span className={`status-badge ${getStatusClass(competition.status)}`}>
              {getStatusText(competition.status)}
            </span>
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