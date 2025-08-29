import React, { useState, useEffect } from 'react';
import { Table, Spinner, Alert, Container, Form, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaArrowUp, FaArrowDown, FaMinus, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import api from '../lib/axios';
import TimingSpecsModal from './TimingSpecsModal';
import './TimingsList.css';

const TimingsList = () => {
  const [timings, setTimings] = useState([]);
  const [vehicles, setVehicles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTiming, setSelectedTiming] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
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
      
      // Debug: Verificar qué position_change vienen del backend (comentado para limpiar logs)
      // timingsResponse.data.forEach(timing => {
      //   if (timing.position_change !== null && timing.position_change !== undefined && timing.position_change !== 0) {
      //     console.log(`🔍 Backend timing con position_change:`, timing);
      //   }
      // });
      
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

  // Función para convertir tiempo a segundos
  const getSeconds = (timeStr) => {
    const [minutes, seconds] = timeStr.split(':');
    const [secs, ms] = seconds.split('.');
    return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
  };

  // Función para agrupar tiempos por vehículo + circuito + carril + vueltas
  const groupTimings = (timings) => {
    const groups = {};
    
    timings.forEach(timing => {
      const key = `${timing.vehicle_id}-${timing.circuit || 'sin-circuito'}-${timing.lane || 'sin-carril'}-${timing.laps || 'sin-vueltas'}`;
      
      if (!groups[key]) {
        groups[key] = {
          key,
          vehicle_id: timing.vehicle_id,
          vehicle_manufacturer: timing.vehicle_manufacturer,
          vehicle_model: timing.vehicle_model,
          circuit: timing.circuit || 'Sin circuito',
          lane: timing.lane || 'Sin carril',
          sessions: [],
          best_time: null,
          last_session: null,
          total_sessions: 0,
          improvement: null
        };
      }
      
      groups[key].sessions.push(timing);
      groups[key].total_sessions++;
      
      // Calcular el mejor tiempo de vuelta
      const currentLapTime = getSeconds(timing.best_lap_time);
      if (!groups[key].best_time || currentLapTime < groups[key].best_time.seconds) {
        groups[key].best_time = {
          ...timing,
          seconds: currentLapTime
        };
      }
      
      // Calcular la sesión más reciente por fecha
      const currentDate = new Date(timing.timing_date);
      if (!groups[key].last_session || currentDate > new Date(groups[key].last_session.timing_date)) {
        groups[key].last_session = timing;
      }
    });
    
    // Calcular mejoras para cada grupo (tanto en vuelta como en tiempo total)
    Object.values(groups).forEach(group => {
      if (group.sessions.length > 1) {
        // Ordenar por mejor tiempo de vuelta
        const sortedByLapTime = group.sessions
          .map(s => ({ ...s, lapSeconds: getSeconds(s.best_lap_time) }))
          .sort((a, b) => a.lapSeconds - b.lapSeconds);
        
        // Ordenar por tiempo total
        const sortedByTotalTime = group.sessions
          .map(s => ({ ...s, totalSeconds: getSeconds(s.total_time) }))
          .sort((a, b) => a.totalSeconds - b.totalSeconds);
        
        const bestLap = sortedByLapTime[0];
        const previousLap = sortedByLapTime[1];
        const bestTotal = sortedByTotalTime[0];
        const previousTotal = sortedByTotalTime[1];
        
        group.improvement = {
          // Mejora en tiempo de vuelta
          lap_time_diff: previousLap ? (previousLap.lapSeconds - bestLap.lapSeconds).toFixed(3) : null,
          lap_percentage: previousLap ? ((previousLap.lapSeconds - bestLap.lapSeconds) / previousLap.lapSeconds * 100).toFixed(1) : null,
          lap_sessions_ago: previousLap ? group.total_sessions - 1 : null,
          
          // Mejora en tiempo total
          total_time_diff: previousTotal ? (previousTotal.totalSeconds - bestTotal.totalSeconds).toFixed(3) : null,
          total_percentage: previousTotal ? ((previousTotal.totalSeconds - bestTotal.totalSeconds) / previousTotal.totalSeconds * 100).toFixed(1) : null,
          total_sessions_ago: previousTotal ? group.total_sessions - 1 : null,
          
          // Información de las mejores marcas
          best_lap_session: bestLap,
          best_total_session: bestTotal
        };
      }
    });
    
    return groups;
  };

  // Función para calcular el ranking del circuito (posiciones globales)
  const calculateCircuitRanking = (groupedTimings) => {
    const circuitRankings = {};
    
    // Agrupar por circuito - TODAS las entradas (vehículo+carril+vueltas) en ranking global
    Object.values(groupedTimings).forEach(group => {
      const circuit = group.circuit;
      if (!circuitRankings[circuit]) {
        circuitRankings[circuit] = [];
      }
      circuitRankings[circuit].push({
        ...group,
        best_lap_seconds: getSeconds(group.best_time.best_lap_time),
        best_total_seconds: getTotalSeconds(group.best_time.total_time)
      });
    });
    
    // Ordenar cada circuito por mejor tiempo de vuelta GLOBALMENTE (todas las entradas juntas)
    Object.keys(circuitRankings).forEach(circuit => {
      circuitRankings[circuit].sort((a, b) => a.best_lap_seconds - b.best_lap_seconds);
      
      // Añadir posición GLOBAL y diferencias
      circuitRankings[circuit].forEach((entry, index) => {
        entry.circuit_position = index + 1;
        
        if (index === 0) {
          // Primero del circuito
          entry.circuit_gap_to_leader = 0;
          entry.circuit_gap_to_previous = 0;
        } else {
          // Diferencia con el líder del circuito
          entry.circuit_gap_to_leader = (entry.best_lap_seconds - circuitRankings[circuit][0].best_lap_seconds).toFixed(3);
          
          // Diferencia con el anterior clasificado
          const previous = circuitRankings[circuit][index - 1];
          entry.circuit_gap_to_previous = (entry.best_lap_seconds - previous.best_lap_seconds).toFixed(3);
        }
        
        // Diferencia con el mejor tiempo total del circuito
        const bestTotalInCircuit = Math.min(...circuitRankings[circuit].map(e => e.best_total_seconds));
        entry.circuit_gap_to_best_total = (entry.best_total_seconds - bestTotalInCircuit).toFixed(3);
      });
    });
    
    return circuitRankings;
  };

  // Función para convertir tiempo total a segundos
  const getTotalSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const [minutes, seconds] = timeStr.split(':');
    const [secs, ms] = seconds.split('.');
    return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
  };

  // Función para obtener el color del badge según el carril
  const getLaneBadgeColor = (lane) => {
    if (lane === '1') return 'bg-primary';
    if (lane === '2') return 'bg-success';
    if (lane === '3') return 'bg-info';
    if (lane === '4') return 'bg-warning';
    if (lane === '5') return 'bg-danger';
    if (lane === '6') return 'bg-secondary';
    if (lane === '7') return 'bg-dark';
    if (lane === '8') return 'bg-light';
    return 'bg-secondary'; // Default color para carriles sin especificar
  };

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const groupedTimings = groupTimings(timings);
  const circuitRankings = calculateCircuitRanking(groupedTimings);
  
  // Añadir información del ranking a cada grupo usando datos del backend
  Object.values(groupedTimings).forEach(group => {
    // Buscar la información de ranking desde el timing del backend que ya tiene los datos correctos
    // Priorizar: 1) circuit_ranking, 2) current_position directamente, 3) position_change
    let timingWithRanking = group.sessions.find(session => session.circuit_ranking);
    
    if (!timingWithRanking) {
      // Si no hay circuit_ranking, buscar el que tenga current_position directamente del backend
      timingWithRanking = group.sessions.find(session => 
        session.current_position !== null && session.current_position !== undefined
      );
    }
    
    if (!timingWithRanking) {
      // Como último recurso, buscar el que tenga position_change del backend
      timingWithRanking = group.sessions.find(session => 
        session.position_change !== null && session.position_change !== undefined
      );
    }
    
    if (timingWithRanking) {
      if (timingWithRanking.circuit_ranking) {
        // Usar datos de circuit_ranking
        group.circuit_ranking = {
          position: timingWithRanking.circuit_ranking.position,
          previous_position: timingWithRanking.circuit_ranking.previous_position,
          position_change: timingWithRanking.circuit_ranking.position_change,
          gap_to_leader: timingWithRanking.circuit_ranking.gap_to_leader,
          gap_to_previous: timingWithRanking.circuit_ranking.gap_to_previous
        };
        
        // console.log(`🔍 Ranking (circuit_ranking) para ${group.vehicle_manufacturer} ${group.vehicle_model}:`, group.circuit_ranking);
      } else {
        // Usar datos directos de la tabla vehicle_timings
        group.circuit_ranking = {
          position: timingWithRanking.current_position,
          previous_position: timingWithRanking.previous_position,
          position_change: timingWithRanking.position_change,
          gap_to_leader: null,
          gap_to_previous: null
        };
        
        // console.log(`🔍 Ranking (directo) para ${group.vehicle_manufacturer} ${group.vehicle_model}:`, group.circuit_ranking);
      }
    } else {
      // Si no hay información del backend, usar el cálculo local como fallback
      const circuitRanking = circuitRankings[group.circuit];
      if (circuitRanking) {
        const rankingEntry = circuitRanking.find(entry => entry.key === group.key);
        if (rankingEntry) {
          group.circuit_ranking = {
            position: rankingEntry.circuit_position,
            gap_to_leader: rankingEntry.circuit_gap_to_leader,
            gap_to_previous: rankingEntry.circuit_gap_to_previous,
            gap_to_best_total: rankingEntry.circuit_gap_to_best_total,
            position_change: 0 // Sin información de cambio desde cálculo local
          };
          
          // console.log(`⚠️ Usando cálculo local para ${group.vehicle_manufacturer} ${group.vehicle_model}:`, group.circuit_ranking);
        }
      }
    }
  });
  
  const filteredGroups = Object.values(groupedTimings).filter(group => {
    const matchesVehicle = !filter.vehicle || group.vehicle_id === filter.vehicle;
    const matchesDateFrom = !filter.dateFrom || new Date(group.best_time.timing_date) >= new Date(filter.dateFrom);
    const matchesDateTo = !filter.dateTo || new Date(group.best_time.timing_date) <= new Date(filter.dateTo);
    const matchesCircuit = !filter.circuit || group.circuit.toLowerCase().includes(filter.circuit.toLowerCase());
    const matchesLane = !filter.lane || group.lane.toLowerCase().includes(filter.lane.toLowerCase());
    return matchesVehicle && matchesDateFrom && matchesDateTo && matchesCircuit && matchesLane;
  }).sort((a, b) => {
    // Ordenar por posición del backend si está disponible, sino por tiempo
    const aPosition = a.circuit_ranking?.position || 999;
    const bPosition = b.circuit_ranking?.position || 999;
    
    if (aPosition !== bPosition) {
      return aPosition - bPosition;
    }
    
    // Si las posiciones son iguales o no hay datos, ordenar por tiempo como fallback
    return a.best_time.seconds - b.best_time.seconds;
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

      {/* Información de especificaciones disponibles */}
      {timings.length > 0 && (
        <div className="mb-3 p-3 bg-light rounded">
          <div className="row align-items-center">
            <div className="col-md-3">
              <strong>Total de registros:</strong> {timings.length}
            </div>
            <div className="col-md-3">
              <strong>Combinaciones únicas:</strong> {Object.keys(groupedTimings).length}
            </div>
            <div className="col-md-3">
              <strong>Circuitos únicos:</strong> {Object.keys(circuitRankings).length}
            </div>
            <div className="col-md-3 text-end">
              <strong>Con configuración técnica:</strong> {timings.filter(t => t.setup_snapshot).length} 
              <span className="text-muted ms-2">
                ({((timings.filter(t => t.setup_snapshot).length / timings.length) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Circuito</th>
              <th>Carril</th>
              <th>Vueltas</th>
              <th>Posición</th>
              <th>Mejor Vuelta</th>
              <th>Tiempo Total</th>
              <th>Sesiones</th>
              <th>Mejora</th>
              <th>Última Sesión</th>
              <th className="text-center">Configuración</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.length === 0 ? (
              <tr>
                <td colSpan="11" className="text-center">
                  No hay registros de tiempo
                </td>
              </tr>
            ) : (
              filteredGroups.map(group => (
                <React.Fragment key={group.key}>
                  {/* Fila principal con el mejor tiempo */}
                  <tr className="group-header" style={{ backgroundColor: '#f8f9fa', fontWeight: '600' }}>
                    <td>
                      <div className="d-flex align-items-center">
                        {group.sessions.length > 1 && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => toggleGroup(group.key)}
                            className="p-0 me-2 text-decoration-none"
                            style={{ minWidth: 'auto', color: '#6c757d' }}
                            title={expandedGroups.has(group.key) ? 'Ocultar historial' : 'Ver historial completo'}
                          >
                            {expandedGroups.has(group.key) ? <FaChevronDown /> : <FaChevronRight />}
                          </Button>
                        )}
                        <Link to={`/vehicles/${group.vehicle_id}`}>
                          {group.vehicle_manufacturer} {group.vehicle_model}
                        </Link>
                      </div>
                    </td>
                    <td>{group.circuit}</td>
                    <td>
                      <span className={`badge ${getLaneBadgeColor(group.lane)}`}>
                        {group.lane}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-info">
                        {group.best_time.laps || 'N/A'}
                      </span>
                    </td>
                    <td>
                      {group.circuit_ranking ? (
                        <div className="text-center">
                          <div className="position-badge mb-1">
                            <span className={`badge ${group.circuit_ranking.position === 1 ? 'bg-warning' : 'bg-secondary'} fs-6`}>
                              P{group.circuit_ranking.position}
                            </span>
                          </div>
                          {group.circuit_ranking.position_change !== undefined && group.circuit_ranking.position_change !== null && group.circuit_ranking.position_change !== 0 && (
                            <div className="position-change">
                              {group.circuit_ranking.position_change > 0 ? (
                                <span className="text-success fw-bold d-flex align-items-center justify-content-center" style={{ fontSize: '0.8em' }}>
                                  <FaArrowUp className="me-1" />
                                  +{group.circuit_ranking.position_change}
                                </span>
                              ) : group.circuit_ranking.position_change < 0 ? (
                                <span className="text-danger fw-bold d-flex align-items-center justify-content-center" style={{ fontSize: '0.8em' }}>
                                  <FaArrowDown className="me-1" />
                                  {group.circuit_ranking.position_change}
                                </span>
                              ) : (
                                <span className="text-muted fw-bold d-flex align-items-center justify-content-center" style={{ fontSize: '0.8em' }}>
                                  <FaMinus className="me-1" />
                                  =
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="font-monospace fw-bold">
                      {group.best_time.best_lap_time}
                      {group.circuit_ranking && group.circuit_ranking.position > 1 && (
                        <div className="mt-1">
                          <small className="text-muted">
                            <span className="text-danger" style={{ fontSize: '0.9em' }}>
                              +{group.circuit_ranking.gap_to_leader}s al líder
                            </span>
                            <br />
                            <span className="text-warning" style={{ fontSize: '0.9em' }}>
                              +{group.circuit_ranking.gap_to_previous}s al anterior
                            </span>
                          </small>
                        </div>
                      )}
                    </td>
                    <td className="font-monospace fw-bold">
                      {group.best_time.total_time}
                    </td>
                    <td>
                      <span className="badge bg-primary">{group.total_sessions}</span>
                    </td>
                    <td>
                      {group.improvement ? (
                        <div className="improvement-indicator">
                          {/* Mejora en tiempo de vuelta */}
                          <div className="mb-2">
                            <strong className="text-primary">Mejor Vuelta:</strong>
                            <br />
                            <span className="text-success fw-bold">
                              -{group.improvement.lap_time_diff}s
                            </span>
                            <br />
                            <small className="text-muted">
                              {group.improvement.lap_percentage}% mejor
                            </small>
                          </div>
                          
                          {/* Mejora en tiempo total */}
                          <div>
                            <strong className="text-primary">Mejor Total:</strong>
                            <br />
                            <span className="text-success fw-bold">
                              -{group.improvement.total_time_diff}s
                            </span>
                            <br />
                            <small className="text-muted">
                              {group.improvement.total_percentage}% mejor
                            </small>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">Primera sesión</span>
                      )}
                    </td>
                    <td>{new Date(group.last_session.timing_date).toLocaleDateString()}</td>
                    <td className="text-center">
                      {group.best_time.setup_snapshot ? (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            setSelectedTiming(group.best_time);
                            setShowSpecsModal(true);
                          }}
                          title="Ver especificaciones técnicas del mejor tiempo"
                          className="d-flex align-items-center justify-content-center mx-auto"
                          style={{ minWidth: '40px' }}
                        >
                          🔧
                        </Button>
                      ) : (
                        <span className="text-muted small">-</span>
                      )}
                    </td>
                  </tr>
                  
                  {/* Filas expandibles con historial */}
                  {expandedGroups.has(group.key) && group.sessions.length > 1 && (
                    group.sessions
                      .map(session => ({
                        ...session,
                        lapSeconds: getSeconds(session.best_lap_time),
                        totalSeconds: getTotalSeconds(session.total_time)
                      }))
                      .sort((a, b) => {
                        // Ordenar primero por tiempo de vuelta, luego por tiempo total
                        if (a.lapSeconds !== b.lapSeconds) {
                          return a.lapSeconds - b.lapSeconds;
                        }
                        return a.totalSeconds - b.totalSeconds;
                      })
                      .map((session, index) => (
                        <tr key={`${session.id}-${index}`} className="group-detail" style={{ backgroundColor: '#ffffff', fontSize: '0.9em' }}>
                          <td colSpan="2" className="ps-4">
                            <small className="text-muted">
                              {new Date(session.timing_date).toLocaleDateString()}
                            </small>
                          </td>
                          <td>
                            <span className={`badge ${getLaneBadgeColor(session.lane)}`}>
                              {session.lane}
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-info">
                              {session.laps || 'N/A'}
                            </span>
                          </td>
                          <td className="font-monospace">
                            {session.best_lap_time}
                            {index === 0 && <span className="badge bg-success ms-2">Mejor Vuelta</span>}
                          </td>
                          <td className="font-monospace">
                            {session.total_time}
                            {session.totalSeconds === group.improvement?.best_total_session?.totalSeconds && (
                              <span className="badge bg-info ms-2">Mejor Total</span>
                            )}
                          </td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td className="text-center">
                            {session.setup_snapshot && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedTiming(session);
                                  setShowSpecsModal(true);
                                }}
                                title="Ver especificaciones técnicas de esta sesión"
                                className="d-flex align-items-center justify-content-center mx-auto"
                                style={{ minWidth: '40px' }}
                              >
                                🔧
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                  
                  {/* Eliminar la fila del botón expandir/contraer */}
                </React.Fragment>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <TimingSpecsModal
        show={showSpecsModal}
        onHide={() => setShowSpecsModal(false)}
        setupSnapshot={selectedTiming?.setup_snapshot}
        timing={selectedTiming}
      />
    </Container>
  );
};

export default TimingsList; 