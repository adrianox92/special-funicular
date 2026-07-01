import React from 'react';
import { Flag, User, Car } from 'lucide-react';

const NextPilotHighlight = ({ nextPilot, roundNumber }) => {
  if (!nextPilot) {
    return (
      <div className="next-pilot-highlight">
        <h2 className="highlight-title">
          <Flag className="highlight-icon" />
          Próximo piloto
        </h2>
        <p className="highlight-subtitle">Siguiente salida a pista</p>
        <div className="highlight-content">
          <div className="no-best-lap">
            <p className="no-lap-text">Todas las tandas completadas</p>
          </div>
        </div>
      </div>
    );
  }

  const { participant } = nextPilot;

  return (
    <div className="next-pilot-highlight next-pilot-highlight--active">
      <h2 className="highlight-title">
        <Flag className="highlight-icon" />
        Próximo piloto
      </h2>
      <p className="highlight-subtitle">
        Ronda {roundNumber ?? nextPilot.roundNumber} · Siguiente salida a pista
      </p>
      <div className="highlight-content">
        <div className="next-pilot-hero-name" aria-label={`Próximo piloto ${participant.driver_name}`}>
          {participant.driver_name}
        </div>
        <div className="best-lap-info">
          {participant.team_name && (
            <div className="best-lap-pilot">
              <span className="team-name">{participant.team_name}</span>
            </div>
          )}
          <div className="best-lap-vehicle pb-2">
            <p className="vehicle-label">
              <Car className="label-icon" />
              Vehículo{' '}
              <span className="vehicle-brand">{participant.vehicle_brand}</span>{' '}
              <span className="vehicle-name">{participant.vehicle_name}</span>
            </p>
          </div>
          <p className="pilot-label">
            <User className="label-icon" />
            Posición actual: {participant.position > 0 ? `P${participant.position}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NextPilotHighlight;
