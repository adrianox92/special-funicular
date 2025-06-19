import React from 'react';
import { Card, OverlayTrigger, Tooltip } from 'react-bootstrap';
import './MetricCard.css';

const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  details,
  valueColor,
  threshold,
  formatValue,
  formatSubtitle,
  trend,
  trendValue
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

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      case 'stable':
        return '→';
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'secondary';
    switch (trend) {
      case 'up':
        return 'success';
      case 'down':
        return 'danger';
      case 'stable':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const renderTooltip = (props) => (
    <Tooltip {...props} className="metric-tooltip">
      <div className="tooltip-content">
        {details && Object.entries(details).map(([key, value]) => {
          if (value === undefined || value === null) return null;
          return (
            <div key={key} className="tooltip-item">
              <span className="tooltip-label">{key}:</span>
              <span className="tooltip-value">{value}</span>
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
    <div className="metric-card-content">
      {/* Header con icono y título */}
      <div className="metric-header">
        <div className="metric-icon-container">
          <div className="metric-icon">
            {icon}
          </div>
        </div>
        <div className="metric-title-container">
          <h5 className="metric-title">{title}</h5>
          {trend && (
            <div className={`metric-trend metric-trend-${getTrendColor()}`}>
              <span className="trend-icon">{getTrendIcon()}</span>
              {trendValue && <span className="trend-value">{trendValue}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Valor principal */}
      <div className="metric-value-container">
        <div className={`metric-value metric-value-${getValueColor()}`}>
          {renderValue()}
        </div>
        {renderSubtitle() && (
          <div className="metric-subtitle">
            {renderSubtitle()}
          </div>
        )}
      </div>

      {/* Detalles adicionales */}
      {renderDetails()}
    </div>
  );

  return (
    <Card className="metric-card h-100">
      <Card.Body className="metric-card-body">
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