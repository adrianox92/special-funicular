import React from 'react';
import { Trophy, Flag, Users } from 'lucide-react';

const CompetitionHeader = ({ competition }) => {
  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'En curso';
      case 'finished':
        return 'Finalizada';
      case 'pending':
        return 'Pendiente';
      default:
        // Valores inesperados o ausentes: no asumir «en curso»
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
            <Trophy className="title-icon" />
            {competition.name}
          </h1>
          <div className="competition-meta presentation-competition-meta">
            <span className="rounds-info meta-pill">
              <Flag className="meta-icon" aria-hidden />
              <span>
                {competition.rounds} {competition.rounds === 1 ? 'ronda' : 'rondas'}
              </span>
            </span>

            {competition.category && (
              <span className="category-info meta-pill">
                <Users className="meta-icon" aria-hidden />
                <span>{competition.category}</span>
              </span>
            )}

            <span className={`status-badge ${getStatusClass(competition.status)}`}>
              {getStatusText(competition.status)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionHeader;
