import React from 'react';
import { Modal, Button, Table } from 'react-bootstrap';

const TimingSpecsModal = ({ show, onHide, setupSnapshot }) => {
  if (!setupSnapshot) return null;

  const specs = JSON.parse(setupSnapshot);

  const groupByComponentType = (specs) => {
    const groups = {};
    specs.forEach(spec => {
      if (!groups[spec.component_type]) {
        groups[spec.component_type] = [];
      }
      groups[spec.component_type].push(spec);
    });
    return groups;
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

  const getColumnsForType = (type) => {
    const baseColumns = ['Componente', 'Fabricante', 'Referencia', 'Material', 'Tamaño', 'Precio'];
    
    switch (type) {
      case 'motor':
        return [...baseColumns.slice(0, 5), 'RPM', 'Gaus', ...baseColumns.slice(5)];
      case 'crown':
      case 'pinion':
        return [...baseColumns.slice(0, 5), 'Dientes', ...baseColumns.slice(5)];
      default:
        return baseColumns;
    }
  };

  const renderComponentCell = (component, column) => {
    switch (column) {
      case 'Componente':
        return component.url ? (
          <a href={component.url} target="_blank" rel="noopener noreferrer">
            {component.element}
          </a>
        ) : component.element;
      case 'Fabricante':
        return component.manufacturer || '-';
      case 'Referencia':
        return component.sku || '-';
      case 'Precio':
        return `€${component.price?.toFixed(2)}`;
      case 'RPM':
        return component.rpm || '-';
      case 'Gaus':
        return component.gaus || '-';
      case 'Dientes':
        return component.teeth || '-';
      case 'Material':
        return component.material || '-';
      case 'Tamaño':
        return component.size || '-';
      default:
        return '-';
    }
  };

  const groupedSpecs = groupByComponentType(specs);

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Especificaciones Técnicas</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {Object.entries(groupedSpecs).map(([type, components]) => (
          <div key={type} className="mb-4">
            <h5>{componentTypeLabels[type] || type}</h5>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  {getColumnsForType(type).map(column => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {components.map(component => (
                  <tr key={component.id}>
                    {getColumnsForType(type).map(column => (
                      <td key={`${component.id}-${column}`}>
                        {renderComponentCell(component, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TimingSpecsModal; 