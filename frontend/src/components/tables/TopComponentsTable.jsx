import React, { useState, useMemo } from 'react';
import { Card, Table, Badge, OverlayTrigger, Tooltip, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiExternalLink } from 'react-icons/fi';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const componentTypeLabels = {
  chassis: 'Chasis',
  motor: 'Motor',
  crown: 'Corona',
  pinion: 'Piñón',
  guide: 'Guía',
  front_axle: 'Eje Delantero',
  rear_axle: 'Eje Trasero',
  front_wheel: 'Rueda Delantera',
  rear_wheel: 'Rueda Trasera',
  front_rim: 'Llanta Delantera',
  rear_rim: 'Llanta Trasera',
  other: 'Otros'
};

const TopComponentsTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({
    key: 'totalInvestment',
    direction: 'desc'
  });

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

  const renderVehiclesTooltip = (vehicles) => (
    <Tooltip id={`tooltip-vehicles-${vehicles[0]?.id}`}>
      <div className="text-start">
        <strong>Vehículos que lo utilizan:</strong>
        {vehicles.map((vehicle, index) => (
          <div key={index} className="mt-1">
            {vehicle.manufacturer} {vehicle.model}
          </div>
        ))}
      </div>
    </Tooltip>
  );

  const renderComponentLinks = (component) => {
    if (!component.urls || component.urls.length === 0) {
      return component.name;
    }

    if (component.urls.length === 1) {
      return (
        <a 
          href={component.urls[0]} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-decoration-none"
        >
          {component.name}
          <FiExternalLink className="ms-1" size={14} />
        </a>
      );
    }

    return (
      <Dropdown>
        <Dropdown.Toggle 
          variant="link" 
          className="text-decoration-none p-0 border-0 text-dark"
        >
          {component.name}
          <FiExternalLink className="ms-1" size={14} />
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {component.urls.map((url, index) => (
            <Dropdown.Item 
              key={index} 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Enlace {index + 1}
              <FiExternalLink className="ms-1" size={14} />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  };

  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <Card.Title className="mb-4">Top 10 Componentes más Utilizados</Card.Title>
        <div className="table-responsive">
          <Table hover>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Componente</th>
                <th>SKU</th>
                <th 
                  style={{ cursor: 'pointer' }}
                  onClick={() => requestSort('unitPrice')}
                >
                  Precio Unitario {getSortIcon('unitPrice')}
                </th>
                <th 
                  style={{ cursor: 'pointer' }}
                  onClick={() => requestSort('totalInvestment')}
                >
                  Inversión Total {getSortIcon('totalInvestment')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((component) => (
                <tr key={component.id}>
                  <td>{componentTypeLabels[component.component_type] || component.component_type}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      {renderComponentLinks(component)}
                      <OverlayTrigger
                        placement="top"
                        delay={{ show: 250, hide: 400 }}
                        overlay={renderVehiclesTooltip(component.vehicles)}
                      >
                        <Badge bg="info" className="ms-2" style={{ cursor: 'help' }}>
                          {component.usageCount}
                        </Badge>
                      </OverlayTrigger>
                    </div>
                  </td>
                  <td>{component.sku}</td>
                  <td>{formatCurrency(component.unitPrice)}</td>
                  <td>{formatCurrency(component.totalInvestment)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TopComponentsTable; 