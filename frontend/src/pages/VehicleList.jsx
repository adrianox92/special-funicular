import React, { useState, useEffect } from 'react';
import VehicleCard from '../components/VehicleCard';
import { Container, Row, Col, Form, Button, Pagination } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { FiDownload } from 'react-icons/fi';

const VehicleList = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    manufacturer: '',
    type: '',
    modified: '',
    digital: '',
  });

  const loadVehicles = async (page = 1) => {
    try {
      const response = await api.get(`/vehicles?page=${page}&limit=25`);
      // Asegurarnos de que vehicles sea un array
      const vehiclesData = Array.isArray(response.data.vehicles) ? response.data.vehicles : [];
      setVehicles(vehiclesData);
      setFiltered(vehiclesData);
      setPagination(response.data.pagination || {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0
      });
    } catch (error) {
      console.error('Error al cargar vehículos:', error);
      // En caso de error, establecer arrays vacíos
      setVehicles([]);
      setFiltered([]);
      setPagination({
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0
      });
    }
  };

  useEffect(() => {
    loadVehicles(currentPage);
  }, [currentPage]);

  useEffect(() => {
    const result = vehicles.filter(v => {
      const m = filters.manufacturer ? v.manufacturer?.toLowerCase().includes(filters.manufacturer.toLowerCase()) : true;
      const t = filters.type ? v.type === filters.type : true;
      const mo = filters.modified === ''
        ? true
        : filters.modified === 'Sí'
        ? v.modified
        : !v.modified;
      const d = filters.digital === ''
        ? true
        : filters.digital === 'Digital'
        ? v.digital
        : !v.digital;
      return m && t && mo && d;
    });
    setFiltered(result);
  }, [filters, vehicles]);

  const handleDeleteVehicle = (vehicleId) => {
    setVehicles(prevVehicles => prevVehicles.filter(v => v.id !== vehicleId));
    setFiltered(prevFiltered => prevFiltered.filter(v => v.id !== vehicleId));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    const items = [];
    const maxPages = 5; // Número máximo de páginas a mostrar
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxPages - 1);

    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }

    // Botón "Anterior"
    items.push(
      <Pagination.Prev
        key="prev"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      />
    );

    // Primera página
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => handlePageChange(1)}>
          1
        </Pagination.Item>
      );
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis-start" disabled />);
      }
    }

    // Páginas numeradas
    for (let number = startPage; number <= endPage; number++) {
      items.push(
        <Pagination.Item
          key={number}
          active={number === currentPage}
          onClick={() => handlePageChange(number)}
        >
          {number}
        </Pagination.Item>
      );
    }

    // Última página
    if (endPage < pagination.totalPages) {
      if (endPage < pagination.totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis-end" disabled />);
      }
      items.push(
        <Pagination.Item
          key={pagination.totalPages}
          onClick={() => handlePageChange(pagination.totalPages)}
        >
          {pagination.totalPages}
        </Pagination.Item>
      );
    }

    // Botón "Siguiente"
    items.push(
      <Pagination.Next
        key="next"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === pagination.totalPages}
      />
    );

    return items;
  };

  const exportToCSV = async () => {
    try {
      // Obtener todos los vehículos sin paginación
      const response = await api.get('/vehicles/export');
      const vehicles = response.data.vehicles;

      // Preparar los datos para el CSV
      const headers = [
        'ID',
        'Modelo',
        'Referencia',
        'Fabricante',
        'Tipo',
        'Tracción',
        'Precio Original (€)',
        'Precio Total (€)',
        'Fecha de Compra',
        'Lugar de Compra',
        'Modificado',
        'Digital',
        'Especificaciones Técnicas',
        'Modificaciones'
      ];

      // Obtener las especificaciones técnicas y modificaciones para cada vehículo
      const vehiclesWithDetails = await Promise.all(
        vehicles.map(async (vehicle) => {
          const [specsResponse, modsResponse] = await Promise.all([
            api.get(`/vehicles/${vehicle.id}/specs`),
            api.get(`/vehicles/${vehicle.id}/modifications`)
          ]);

          return {
            ...vehicle,
            specs: specsResponse.data,
            modifications: modsResponse.data
          };
        })
      );

      // Convertir los datos a formato CSV
      const csvContent = [
        headers.join(','),
        ...vehiclesWithDetails.map(vehicle => {
          const specs = vehicle.specs.map(spec => 
            `${spec.component_type}: ${spec.element} (${spec.manufacturer})`
          ).join('; ');
          
          const mods = vehicle.modifications.map(mod => 
            `${mod.component_type}: ${mod.element} (${mod.manufacturer}) - ${mod.price}€`
          ).join('; ');

          return [
            vehicle.id,
            `"${vehicle.model}"`,
            `"${vehicle.reference || ''}"`,
            `"${vehicle.manufacturer}"`,
            `"${vehicle.type}"`,
            `"${vehicle.traction || ''}"`,
            vehicle.price || '',
            vehicle.total_price || '',
            vehicle.purchase_date || '',
            `"${vehicle.purchase_place || ''}"`,
            vehicle.modified ? 'Sí' : 'No',
            vehicle.digital ? 'Sí' : 'No',
            `"${specs}"`,
            `"${mods}"`
          ].join(',');
        })
      ].join('\n');

      // Crear y descargar el archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `coleccion_vehiculos_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error al exportar a CSV:', error);
      alert('Error al exportar los datos a CSV');
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-2">Mi Colección</h1>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={exportToCSV}>
            <FiDownload className="me-2" />
            Exportar CSV
          </Button>
          <Button variant="primary" onClick={() => navigate('/vehicles/new')}>
            Añadir Vehículo
          </Button>
        </div>
      </div>
      <Row className="mb-4 g-2">
        <Col md={3}>
          <Form.Control
            placeholder="Buscar por fabricante..."
            onChange={e => setFilters({ ...filters, manufacturer: e.target.value })}
          />
        </Col>
        <Col md={2}>
          <Form.Select onChange={e => setFilters({ ...filters, type: e.target.value })}>
            <option value="">Todos los tipos</option>
            <option>Rally</option>
            <option>GT</option>
            <option>LMP</option>
            <option>Clásico</option>
            <option>DTM</option>
            <option>F1</option>
            <option>Camiones</option>
            <option>Raid</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Select onChange={e => setFilters({ ...filters, modified: e.target.value })}>
            <option value="">Modificado/Serie</option>
            <option value="Sí">Modificado</option>
            <option value="No">Serie</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Select onChange={e => setFilters({ ...filters, digital: e.target.value })}>
            <option value="">Digital/Analógico</option>
            <option value="Digital">Digital</option>
            <option value="Analógico">Analógico</option>
          </Form.Select>
        </Col>
      </Row>

      <Row xs={1} sm={2} md={3} lg={4}>
        {filtered.map(vehicle => (
          <Col key={vehicle.id}>
            <VehicleCard 
              vehicle={vehicle} 
              onDelete={handleDeleteVehicle}
            />
          </Col>
        ))}
      </Row>

      {pagination.totalPages > 1 && (
        <div className="d-flex justify-content-center mt-4">
          <Pagination>
            {renderPagination()}
          </Pagination>
        </div>
      )}
    </Container>
  );
};

export default VehicleList;
