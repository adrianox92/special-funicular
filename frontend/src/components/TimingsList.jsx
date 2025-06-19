import React, { useState, useEffect } from 'react';
import { Table, Spinner, Alert, Container, Form, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import TimingSpecsModal from './TimingSpecsModal';

const TimingsList = () => {
  const [timings, setTimings] = useState([]);
  const [vehicles, setVehicles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTiming, setSelectedTiming] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [filter, setFilter] = useState({
    vehicle: '',
    dateFrom: '',
    dateTo: '',
    circuit: '',
    lane: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar vehículos para el filtro
      const vehiclesResponse = await api.get('/vehicles');
      const vehiclesMap = {};
      vehiclesResponse.data.vehicles.forEach(vehicle => {
        vehiclesMap[vehicle.id] = vehicle;
      });
      setVehicles(vehiclesMap);

      // Cargar todos los tiempos en una sola llamada
      console.log('Cargando tiempos...');
      const timingsResponse = await api.get('/timings');
      console.log('Tiempos cargados:', timingsResponse.data);
      setTimings(timingsResponse.data);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setError(error.response?.data?.error || 'Error al cargar los tiempos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const filteredTimings = timings.filter(timing => {
    const matchesVehicle = !filter.vehicle || timing.vehicle_id === filter.vehicle;
    const matchesDateFrom = !filter.dateFrom || new Date(timing.timing_date) >= new Date(filter.dateFrom);
    const matchesDateTo = !filter.dateTo || new Date(timing.timing_date) <= new Date(filter.dateTo);
    const matchesCircuit = !filter.circuit || (timing.circuit && timing.circuit.toLowerCase().includes(filter.circuit.toLowerCase()));
    const matchesLane = !filter.lane || (timing.lane && timing.lane.toLowerCase().includes(filter.lane.toLowerCase()));
    return matchesVehicle && matchesDateFrom && matchesDateTo && matchesCircuit && matchesLane;
  }).sort((a, b) => {
    // Convertir los tiempos a segundos para comparar
    const getSeconds = (timeStr) => {
      const [minutes, seconds] = timeStr.split(':');
      const [secs, ms] = seconds.split('.');
      return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
    };
    return getSeconds(a.best_lap_time) - getSeconds(b.best_lap_time);
  });

  if (loading) {
    return (
      <Container className="mt-4 text-center">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={loadData}>
            Reintentar
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="mb-2">Tabla de Tiempos</h1>
      
      <div className="mb-4">
        <Row>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Filtrar por Vehículo</Form.Label>
              <Form.Select
                name="vehicle"
                value={filter.vehicle}
                onChange={handleFilterChange}
              >
                <option value="">Todos los vehículos</option>
                {Object.values(vehicles).map(vehicle => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.manufacturer} {vehicle.model}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Fecha Desde</Form.Label>
              <Form.Control
                type="date"
                name="dateFrom"
                value={filter.dateFrom}
                onChange={handleFilterChange}
              />
            </Form.Group>
          </Col>
          <Col md={2}>
            <Form.Group>
              <Form.Label>Fecha Hasta</Form.Label>
              <Form.Control
                type="date"
                name="dateTo"
                value={filter.dateTo}
                onChange={handleFilterChange}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label>Filtrar por Circuito</Form.Label>
              <Form.Control
                type="text"
                name="circuit"
                value={filter.circuit}
                onChange={handleFilterChange}
                placeholder="Nombre del circuito"
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label>Filtrar por Carril</Form.Label>
              <Form.Control
                type="text"
                name="lane"
                value={filter.lane}
                onChange={handleFilterChange}
                placeholder="Número de carril"
              />
            </Form.Group>
          </Col>
        </Row>
      </div>

      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Vehículo</th>
              <th>Mejor Vuelta</th>
              <th>Diferencia</th>
              <th>Tiempo Total</th>
              <th>Vueltas</th>
              <th>Tiempo Promedio</th>
              <th>Carril</th>
              <th>Circuito</th>
              <th>Especificaciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTimings.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center">
                  No hay registros de tiempo
                </td>
              </tr>
            ) : (
              filteredTimings.map(timing => (
                <tr key={`${timing.vehicle_id}-${timing.id}`}>
                  <td>{new Date(timing.timing_date).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/vehicles/${timing.vehicle_id}`}>
                      {timing.vehicle_manufacturer} {timing.vehicle_model}
                    </Link>
                  </td>
                  <td className="font-monospace">{timing.best_lap_time}</td>
                  <td className="font-monospace">{timing.time_diff}</td>
                  <td className="font-monospace">{timing.total_time}</td>
                  <td>{timing.laps}</td>
                  <td className="font-monospace">{timing.average_time}</td>
                  <td>{timing.lane || '-'}</td>
                  <td>{timing.circuit || '-'}</td>
                  <td>
                    {timing.setup_snapshot && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => {
                          setSelectedTiming(timing);
                          setShowSpecsModal(true);
                        }}
                        title="Ver especificaciones técnicas"
                      >
                        🔧
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <TimingSpecsModal
        show={showSpecsModal}
        onHide={() => setShowSpecsModal(false)}
        setupSnapshot={selectedTiming?.setup_snapshot}
      />
    </Container>
  );
};

export default TimingsList; 