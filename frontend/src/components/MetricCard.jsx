import React from 'react';
import { Card, OverlayTrigger, Tooltip } from 'react-bootstrap';

const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  details,
  valueColor,
  threshold,
  formatValue,
  formatSubtitle
}) => {
  // Determinar el color del valor basado en el contexto
  const getValueColor = () => {
    if (valueColor) return valueColor;
    
    if (threshold && typeof value === 'number') {
      if (value <= threshold.good) return 'success';
      if (value <= threshold.warning) return 'warning';
      return 'danger';
    }

    // Para porcentajes de incremento
    if (typeof value === 'string' && value.includes('%')) {
      const percentage = parseFloat(value);
      if (percentage <= 0) return 'secondary';
      if (percentage > 50) return 'danger';
      return 'success';
    }

    return 'primary';
  };

  const renderTooltip = (props) => (
    <Tooltip {...props}>
      <div>
        {details && Object.entries(details).map(([key, value]) => {
          if (value === undefined || value === null) return null;
          return (
            <div key={key} className="mb-1">
              <strong>{key}:</strong> {value}
            </div>
          );
        })}
      </div>
    </Tooltip>
  );

  const renderValue = () => {
    if (value === undefined || value === null) return 'N/A';
    if (formatValue) {
      return formatValue(value);
    }
    return value;
  };

  const renderSubtitle = () => {
    if (!subtitle) return null;
    if (formatSubtitle) {
      return formatSubtitle(subtitle);
    }
    return subtitle;
  };

  const renderDetails = () => {
    if (!details) return null;

    const formatDetailValue = (value) => {
      if (value === undefined || value === null) return 'No especificado';
      if (typeof value === 'number') {
        return value.toLocaleString('es-ES', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
      return value;
    };
  };

  const cardContent = (
    <div className="d-flex flex-column h-100">
      <div className="d-flex align-items-center mb-2">
        <i className={`bi ${icon} fs-4 me-2`}></i>
        <h5 className="mb-0">{title}</h5>
      </div>
      <div className="mt-auto">
        <div className={`fs-4 fw-bold text-${getValueColor()}`}>
          {renderValue()}
        </div>
        {renderSubtitle() && (
          <div className="text-muted mt-1">
            {renderSubtitle()}
          </div>
        )}
        {renderDetails()}
      </div>
    </div>
  );

  return (
    <Card className="h-100">
      <Card.Body>
        {details && Object.values(details).some(v => v !== undefined && v !== null) ? (
          <OverlayTrigger
            placement="top"
            delay={{ show: 250, hide: 400 }}
            overlay={renderTooltip}
          >
            {cardContent}
          </OverlayTrigger>
        ) : (
          cardContent
        )}
      </Card.Body>
    </Card>
  );
};

export default MetricCard; 