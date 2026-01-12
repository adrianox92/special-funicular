import React, { useState, useEffect } from 'react';
import { Table, Spinner, Alert, Container, Form, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
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
    const parsed = parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
    // #region agent log
    if (Number.isNaN(parsed)) {
      fetch('http://127.0.0.1:7242/ingest/7cb16915-a7a1-47f6-b806-7fb95e244063',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-pre',hypothesisId:'H2',location:'TimingsList.jsx:getSeconds',message:'Parsed lap time is NaN',data:{timeStr},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return parsed;
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7cb16915-a7a1-47f6-b806-7fb95e244063',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'TimingsList.jsx:best_time',message:'Best time updated for group',data:{groupKey:key,lapSeconds:currentLapTime,totalSeconds:getTotalSeconds(timing.total_time),timingId:timing.id},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7cb16915-a7a1-47f6-b806-7fb95e244063',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-pre',hypothesisId:'H3',location:'TimingsList.jsx:group_sort',message:'Group sorted by lap time',data:{groupKey:group.key,orderedSessions:sortedByLapTime.map(s=>({id:s.id,lapSeconds:s.lapSeconds,bestLap:s.best_lap_time,timingDate:s.timing_date}))},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        
        // Ordenar por tiempo total
        const sortedByTotalTime = group.sessions
          .map(s => ({ ...s, totalSeconds: getTotalSeconds(s.total_time) }))
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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7cb16915-a7a1-47f6-b806-7fb95e244063',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'TimingsList.jsx:circuit_ranking',message:'Circuit ranking entry',data:{circuit,position:entry.circuit_position,bestLapSeconds:entry.best_lap_seconds,gapToLeader:entry.circuit_gap_to_leader,gapToPrev:entry.circuit_gap_to_previous,groupKey:entry.key},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
  
  // Añadir información del ranking a cada grupo - SIEMPRE usar cálculo local para posición y gaps
  // El backend puede tener datos desactualizados, así que priorizamos el cálculo local basado en tiempos
  Object.values(groupedTimings).forEach(group => {
    const localRankingEntry = circuitRankings[group.circuit]?.find(entry => entry.key === group.key);
    
    if (localRankingEntry) {
      // SIEMPRE usar el cálculo local para posición y gaps (basado en tiempos reales)
      group.circuit_ranking = {
        position: localRankingEntry.circuit_position,
        gap_to_leader: localRankingEntry.circuit_gap_to_leader,
        gap_to_previous: localRankingEntry.circuit_gap_to_previous,
        gap_to_best_total: localRankingEntry.circuit_gap_to_best_total,
        position_change: null // Se intentará obtener del backend si está disponible
      };
      
      // Intentar obtener position_change del backend si está disponible (solo para mostrar cambio de posición)
      let timingWithRanking = group.sessions.find(session => session.circuit_ranking);
      if (!timingWithRanking) {
        timingWithRanking = group.sessions.find(session => 
          session.current_position !== null && session.current_position !== undefined
        );
      }
      if (!timingWithRanking) {
        timingWithRanking = group.sessions.find(session => 
          session.position_change !== null && session.position_change !== undefined
        );
      }
      
      if (timingWithRanking) {
        if (timingWithRanking.circuit_ranking) {
          group.circuit_ranking.previous_position = timingWithRanking.circuit_ranking.previous_position;
          group.circuit_ranking.position_change = timingWithRanking.circuit_ranking.position_change;
        } else if (timingWithRanking.current_position !== null && timingWithRanking.current_position !== undefined) {
          group.circuit_ranking.previous_position = timingWithRanking.previous_position;
          group.circuit_ranking.position_change = timingWithRanking.position_change;
        }
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7cb16915-a7a1-47f6-b806-7fb95e244063',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-post-fix',hypothesisId:'H1',location:'TimingsList.jsx:group_ranking',message:'Group ranking assigned (using local calculation)',data:{groupKey:group.key,position:group.circuit_ranking?.position,bestLapSeconds:group.best_time?.seconds,gapToLeader:group.circuit_ranking?.gap_to_leader,gapToPrev:group.circuit_ranking?.gap_to_previous,positionChange:group.circuit_ranking?.position_change},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  });
  
  const filteredGroups = Object.values(groupedTimings).filter(group => {
    const matchesVehicle = !filter.vehicle || group.vehicle_id === filter.vehicle;
    const matchesDateFrom = !filter.dateFrom || new Date(group.best_time.timing_date) >= new Date(filter.dateFrom);
    const matchesDateTo = !filter.dateTo || new Date(group.best_time.timing_date) <= new Date(filter.dateTo);
    const matchesCircuit = !filter.circuit || group.circuit.toLowerCase().includes(filter.circuit.toLowerCase());
    const matchesLane = !filter.lane || group.lane.toLowerCase().includes(filter.lane.toLowerCase());
    return matchesVehicle && matchesDateFrom && matchesDateTo && matchesCircuit && matchesLane;
  }).sort((a, b) => {
    // Ordenar SIEMPRE por tiempo de vuelta (el cálculo local ya ordenó correctamente)
    // Si están en el mismo circuito, usar posición del cálculo local
    // Si están en circuitos diferentes, ordenar por tiempo directamente
    if (a.circuit === b.circuit) {
      // Mismo circuito: usar posición del cálculo local
      const aPosition = a.circuit_ranking?.position || 999;
      const bPosition = b.circuit_ranking?.position || 999;
      
      if (aPosition !== bPosition) {
        return aPosition - bPosition;
      }
    }
    
    // Si las posiciones son iguales, circuitos diferentes, o no hay datos, ordenar por tiempo de vuelta
    return a.best_time.seconds - b.best_time.seconds;
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7cb16915-a7a1-47f6-b806-7fb95e244063',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H4',location:'TimingsList.jsx:filteredGroups',message:'Filtered groups order',data:filteredGroups.map(g=>({groupKey:g.key,position:g.circuit_ranking?.position || null,bestLapSeconds:g.best_time?.seconds})),timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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