import React, { useState, useMemo } from 'react';
import { Card, Table, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Bar } from 'recharts';
import { Link } from 'react-router-dom';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercentage = (value) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);
};

const IncrementBar = ({ value, maxValue, basePrice, totalPrice }) => {
  const width = Math.min(Math.abs(value) / maxValue * 100, 100);
  
  // Determinar el color basado en el valor
  const getColor = (value, averageIncrement) => {
    if (value <= 0) return '#6c757d'; // Gris para valores negativos o cero
    if (value > averageIncrement * 1.5) return '#198754'; // Verde para incrementos altos
    if (value > averageIncrement) return '#fd7e14'; // Naranja para incrementos medios
    return '#dc3545'; // Rojo para incrementos bajos
  };

  const color = getColor(value, maxValue / 2); // Usamos la mitad del máximo como promedio aproximado
  
  const tooltipContent = (
    <Tooltip id={`tooltip-${value}`}>
      <div className="text-start">
        <div>Coste original: {formatCurrency(basePrice)}</div>
        <div>→ Total: {formatCurrency(totalPrice)}</div>
        <div className="fw-bold">Incremento: {formatPercentage(value)}</div>
      </div>
    </Tooltip>
  );

  return (
    <OverlayTrigger
      placement="top"
      overlay={tooltipContent}
      delay={{ show: 250, hide: 400 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'help' }}>
        <div style={{ 
          width: '60px', 
          height: '8px', 
          backgroundColor: '#e9ecef',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${width}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.3s ease, background-color 0.3s ease'
          }} />
        </div>
        <span style={{ 
          color: color,
          fontSize: '0.875rem',
          fontWeight: value > 0 ? 'bold' : 'normal'
        }}>
          {formatPercentage(value)}
        </span>
      </div>
    </OverlayTrigger>
  );
};

const TopCostTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({
    key: 'incrementPercentage',
    direction: 'desc'
  });

  // Calcular el promedio de incremento para colores contextuales
  const averageIncrement = useMemo(() => {
    if (!data.length) return 0;
    const sum = data.reduce((acc, vehicle) => acc + vehicle.incrementPercentage, 0);
    return sum / data.length;
  }, [data]);

  const sortedData = useMemo(() => {
    const sorted = [...data];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [data, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Calcular el máximo incremento para escalar las barras
  const maxIncrement = Math.max(...data.map(item => Math.abs(item.incrementPercentage)));

  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <Card.Title className="mb-4">Top 5 Vehículos por Coste</Card.Title>
        <div className="table-responsive">
          <Table hover>
            <thead>
              <tr>
                <th>Modelo</th>
                <th 
                  style={{ cursor: 'pointer' }}
                  onClick={() => requestSort('basePrice')}
                >
                  Precio Base {getSortIcon('basePrice')}
                </th>
                <th 
                  style={{ cursor: 'pointer' }}
                  onClick={() => requestSort('totalPrice')}
                >
                  Precio Total {getSortIcon('totalPrice')}
                </th>
                <th 
                  style={{ cursor: 'pointer' }}
                  onClick={() => requestSort('incrementPercentage')}
                >
                  Incremento {getSortIcon('incrementPercentage')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>
                    <div className="d-flex align-items-center">
                      <Link to={`/vehicles/${vehicle.id}`} className="text-decoration-none">
                        <span className="me-2">{`${vehicle.manufacturer} ${vehicle.model}`}</span>
                      </Link>
                      {vehicle.modified && (
                        <Badge bg="primary" className="ms-2">Mod</Badge>
                      )}
                    </div>
                  </td>
                  <td>{formatCurrency(vehicle.basePrice)}</td>
                  <td>{formatCurrency(vehicle.totalPrice)}</td>
                  <td>
                    <IncrementBar 
                      value={vehicle.incrementPercentage} 
                      maxValue={maxIncrement}
                      basePrice={vehicle.basePrice}
                      totalPrice={vehicle.totalPrice}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TopCostTable; 