import React, { useState, useEffect } from 'react';
import { Card, Form, Row, Col, Table, Badge, Alert, Spinner } from 'react-bootstrap';
import { FaTrophy, FaClock, FaCar, FaChartLine } from 'react-icons/fa';
import api from '../lib/axios';
import './LaneComparisonChart.css';

const LaneComparisonChart = () => {
  const [circuits, setCircuits] = useState([]);
  const [selectedCircuit, setSelectedCircuit] = useState('');
  const [laneData, setLaneData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar circuitos únicos
  useEffect(() => {
    const loadCircuits = async () => {
      try {
        const response = await api.get('/timings');
        const uniqueCircuits = [...new Set(response.data
          .filter(t => t.circuit)
          .map(t => t.circuit))];
        setCircuits(uniqueCircuits.sort());
      } catch (err) {
        console.error('Error al cargar circuitos:', err);
      }
    };
    loadCircuits();
  }, []);

  // Cargar datos de carriles cuando se selecciona un circuito
  useEffect(() => {
    if (selectedCircuit) {
      loadLaneData(selectedCircuit);
    }
  }, [selectedCircuit]);

  const loadLaneData = async (circuit) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/timings');
      const circuitTimings = response.data.filter(t => t.circuit === circuit);
      
      // Agrupar por vehículo + vueltas para tener todos los tiempos de cada vehículo
      const vehicleAllTimes = {};
      circuitTimings.forEach(timing => {
        const vehicleKey = `${timing.vehicle_id}-${timing.laps || 'sin-vueltas'}`;
        if (!vehicleAllTimes[vehicleKey]) {
          vehicleAllTimes[vehicleKey] = [];
        }
        vehicleAllTimes[vehicleKey].push(timing);
      });

      // Para cada vehículo, encontrar su mejor tiempo y asignarlo al carril correspondiente
      const lanes = {};
      Object.values(vehicleAllTimes).forEach(vehicleTimings => {
        // Ordenar por mejor tiempo
        const sortedTimings = vehicleTimings.sort((a, b) => 
          getSeconds(a.best_lap_time) - getSeconds(b.best_lap_time)
        );
        
        const bestTiming = sortedTimings[0];
        const lane = bestTiming.lane || 'Sin carril';
        
        if (!lanes[lane]) {
          lanes[lane] = [];
        }
        
        // Añadir el mejor tiempo del vehículo, pero guardar también todos los tiempos para comparativas
        lanes[lane].push({
          ...bestTiming,
          allLaneTimes: sortedTimings // Guardar todos los tiempos para comparativas
        });
      });

      // Procesar cada carril
      const processedLanes = {};
      Object.keys(lanes).forEach(lane => {
        const laneTimings = lanes[lane];
        
        // Ordenar por mejor tiempo
        const sortedVehicles = laneTimings
          .sort((a, b) => getSeconds(a.best_lap_time) - getSeconds(b.best_lap_time));

        processedLanes[lane] = {
          vehicles: sortedVehicles,
          totalVehicles: sortedVehicles.length,
          bestTime: sortedVehicles[0]?.best_lap_time || 'N/A',
          averageTime: calculateAverageTime(sortedVehicles),
          fastestVehicle: sortedVehicles[0]
        };
      });

      setLaneData(processedLanes);
    } catch (err) {
      console.error('Error al cargar datos de carriles:', err);
      setError('Error al cargar los datos de carriles');
    } finally {
      setLoading(false);
    }
  };

  const getSeconds = (timeStr) => {
    if (!timeStr) return Infinity;
    const [minutes, seconds] = timeStr.split(':');
    const [secs, ms] = seconds.split('.');
    return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
  };

  const calculateAverageTime = (vehicles) => {
    if (vehicles.length === 0) return 'N/A';
    
    const totalSeconds = vehicles.reduce((sum, v) => sum + getSeconds(v.best_lap_time), 0);
    const avgSeconds = totalSeconds / vehicles.length;
    
    const minutes = Math.floor(avgSeconds / 60);
    const remainingSeconds = (avgSeconds % 60).toFixed(3);
    return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    return timeStr;
  };

  const getLaneBadgeColor = (lane) => {
    if (lane === '1') return 'bg-primary';
    if (lane === '2') return 'bg-success';
    if (lane === '3') return 'bg-info';
    if (lane === '4') return 'bg-warning';
    if (lane === '5') return 'bg-danger';
    if (lane === '6') return 'bg-secondary';
    if (lane === '7') return 'bg-dark';
    if (lane === '8') return 'bg-light';
    return 'bg-secondary';
  };

  const calculateLaneDifferences = () => {
    if (!selectedCircuit || Object.keys(laneData).length === 0) return null;

    const lanes = Object.keys(laneData).sort();
    if (lanes.length < 2) return null;

    const differences = {};
    
    // Comparar cada carril con el carril 1 (si existe)
    const referenceLane = lanes.find(l => l === '1') || lanes[0];
    const referenceData = laneData[referenceLane];
    
    lanes.forEach(lane => {
      if (lane !== referenceLane) {
        const currentLaneData = laneData[lane];
        const refBestTime = getSeconds(referenceData.bestTime);
        const laneBestTime = getSeconds(currentLaneData.bestTime);
        
        if (refBestTime !== Infinity && laneBestTime !== Infinity) {
          const diff = laneBestTime - refBestTime;
          differences[lane] = {
            difference: diff.toFixed(3),
            percentage: ((diff / refBestTime) * 100).toFixed(1),
            isSlower: diff > 0
          };
        }
      }
    });

    return differences;
  };

  // Función para obtener la diferencia de tiempo del mismo vehículo entre carriles
  const getVehicleLaneDifference = (vehicle, currentLane) => {
    if (!vehicle.allLaneTimes || vehicle.allLaneTimes.length < 2) return null;
    
    // Determinar el carril de referencia (carril 1 si existe, sino el primero disponible)
    const allLanes = Object.keys(laneData).sort();
    const referenceLane = allLanes.find(l => l === '1') || allLanes[0];
    
    // Si solo hay un carril disponible, no hay diferencia
    if (allLanes.length < 2) return null;
    
    // Si estamos en el carril de referencia, buscar el tiempo en otro carril para comparar
    if (currentLane === referenceLane) {
      // Buscar un carril alternativo para comparar
      const alternativeLane = allLanes.find(l => l !== referenceLane);
      if (!alternativeLane) return null;
      
      const alternativeTiming = vehicle.allLaneTimes.find(t => t.lane === alternativeLane);
      if (!alternativeTiming) return null;
      
      const altTime = getSeconds(alternativeTiming.best_lap_time);
      const currentTime = getSeconds(vehicle.best_lap_time);
      
      if (altTime === Infinity || currentTime === Infinity) return null;
      
      const diff = currentTime - altTime;
      return {
        seconds: diff,
        isSlower: diff > 0,
        isFaster: diff < 0,
        referenceTime: alternativeTiming.best_lap_time,
        referenceLane: alternativeLane
      };
    }
    
    // Buscar el tiempo del mismo vehículo en el carril de referencia
    const referenceTiming = vehicle.allLaneTimes.find(t => t.lane === referenceLane);
    
    if (!referenceTiming) return null;
    
    const refTime = getSeconds(referenceTiming.best_lap_time);
    const currentTime = getSeconds(vehicle.best_lap_time);
    
    if (refTime === Infinity || currentTime === Infinity) return null;
    
    const diff = currentTime - refTime;
    return {
      seconds: diff,
      isSlower: diff > 0,
      isFaster: diff < 0,
      referenceTime: referenceTiming.best_lap_time,
      referenceLane: referenceLane
    };
  };

  const getFastestVehiclesByLane = () => {
    if (!selectedCircuit || Object.keys(laneData).length === 0) return null;

    const fastestByLane = {};
    Object.keys(laneData).forEach(lane => {
      const fastest = laneData[lane].vehicles[0];
      if (fastest) {
        fastestByLane[lane] = {
          vehicle: `${fastest.vehicle_manufacturer} ${fastest.vehicle_model}`,
          time: fastest.best_lap_time,
          seconds: getSeconds(fastest.best_lap_time)
        };
      }
    });

    return fastestByLane;
  };

  const laneDifferences = calculateLaneDifferences();
  const fastestByLane = getFastestVehiclesByLane();

  return (
    <Card className="h-100">
      <Card.Header className="d-flex align-items-center">
        <FaChartLine className="me-2" />
        <h6 className="mb-0">Comparativa de Carriles</h6>
      </Card.Header>
      <Card.Body>
        <div className="circuit-selector">
          <Form.Group>
            <Form.Label className="fw-bold">Seleccionar Circuito</Form.Label>
            <Form.Select
              value={selectedCircuit}
              onChange={(e) => setSelectedCircuit(e.target.value)}
              size="lg"
            >
              <option value="">Selecciona un circuito</option>
              {circuits.map(circuit => (
                <option key={circuit} value={circuit}>{circuit}</option>
              ))}
            </Form.Select>
          </Form.Group>
                     <div className="mt-2">
             <small className="text-muted">
               <strong>Nota:</strong> Cada vehículo aparece solo en el carril donde hizo su mejor tiempo.
               <br />
               <strong>Comparativa:</strong> La diferencia muestra cuánto más rápido/lento es el mismo vehículo en este carril vs otro carril disponible. Si solo hay un carril, se muestra "Único carril disponible".
             </small>
           </div>
        </div>

        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              <Spinner animation="border" role="status" size="lg">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="danger" className="mb-3 error-alert">
            <Alert.Heading>Error</Alert.Heading>
            {error}
          </Alert>
        )}

        {selectedCircuit && !loading && Object.keys(laneData).length > 0 && (
          <>
            {/* Resumen de carriles */}
            <Row className="mb-4">
              {Object.keys(laneData).map(lane => (
                <Col key={lane} xs={12} sm={6} lg={3} className="mb-3">
                  <Card className="text-center h-100 lane-summary-card">
                    <Card.Body className="py-3">
                      <Badge className={`${getLaneBadgeColor(lane)} fs-6 mb-3 lane-badge`}>
                        Carril {lane}
                      </Badge>
                      <div className="h3 mb-1 text-primary fw-bold">
                        {laneData[lane].totalVehicles}
                      </div>
                      <small className="text-muted d-block mb-3">Vehículos</small>
                      <div className="mt-3">
                        <div className="time-display mb-1">
                          {formatTime(laneData[lane].bestTime)}
                        </div>
                        <small className="text-muted">Mejor tiempo</small>
                        <div className="average-time mt-1">
                          Promedio: {laneData[lane].averageTime}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>

                         {/* Comparativa de tiempos */}
             <div className="mb-4">
               <h6 className="section-header">
                 <FaClock className="me-2" />
                 Comparativa con Carril de Referencia
               </h6>
               <div className="mb-3">
                 <small className="text-muted">
                   <strong>Carril de Referencia:</strong> Se usa como base para comparar el rendimiento del mismo vehículo en diferentes carriles. El carril 1 es la referencia si existe, sino se usa el primero disponible.
                 </small>
               </div>
               
               {Object.keys(laneData).length < 2 ? (
                 <Alert variant="info" className="text-center">
                   <strong>Información:</strong> Solo hay un carril disponible en este circuito, por lo que no es posible realizar comparativas entre carriles.
                 </Alert>
               ) : laneDifferences && Object.keys(laneDifferences).length > 0 ? (
                 <Table striped bordered hover size="sm" className="comparison-table">
                   <thead>
                     <tr>
                       <th>Carril</th>
                       <th>Diferencia</th>
                       <th>Porcentaje</th>
                       <th>Estado</th>
                     </tr>
                   </thead>
                   <tbody>
                     {Object.keys(laneDifferences).map(lane => {
                       const diff = laneDifferences[lane];
                       const lanes = Object.keys(laneData).sort();
                       const referenceLane = lanes.find(l => l === '1') || lanes[0];
                       
                       return (
                         <tr key={lane}>
                           <td>
                             <Badge className={`${getLaneBadgeColor(lane)} lane-badge`}>
                               Carril {lane}
                             </Badge>
                           </td>
                           <td className="font-monospace fw-bold">
                             <span className={diff.isSlower ? 'danger-indicator' : 'success-indicator'}>
                               {diff.isSlower ? '+' : ''}{diff.difference}s
                             </span>
                             <div className="mt-1">
                               <small className="text-muted">
                                 vs Carril {referenceLane}
                               </small>
                             </div>
                           </td>
                           <td>
                             <span className={diff.isSlower ? 'warning-indicator' : 'success-indicator'}>
                               {diff.isSlower ? '+' : ''}{diff.percentage}%
                             </span>
                           </td>
                           <td>
                             <Badge 
                               variant={diff.isSlower ? 'warning' : 'success'}
                               className="d-flex align-items-center difference-indicator"
                             >
                               {diff.isSlower ? (
                                 <>
                                   <FaClock className="me-1" />
                                   Más lento
                                 </>
                               ) : (
                                 <>
                                   <FaTrophy className="me-1" />
                                   Más rápido
                                 </>
                               )}
                             </Badge>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </Table>
               ) : (
                 <Alert variant="warning" className="text-center">
                   <strong>Atención:</strong> No se pueden calcular diferencias entre carriles con los datos disponibles.
                 </Alert>
               )}
             </div>

            {/* Vehículos más rápidos por carril */}
            {fastestByLane && (
              <div className="mb-4">
                <h6 className="section-header">
                  <FaCar className="me-2" />
                  Vehículos Más Rápidos por Carril
                </h6>
                <Row>
                  {Object.keys(fastestByLane).map(lane => {
                    const fastest = fastestByLane[lane];
                    return (
                      <Col key={lane} xs={12} sm={6} lg={4} className="mb-3">
                        <Card className="h-100 fastest-vehicle-card">
                          <Card.Body className="text-center">
                            <Badge className={`${getLaneBadgeColor(lane)} fs-6 mb-3 lane-badge`}>
                              Carril {lane}
                            </Badge>
                            <div className="h6 mb-2 text-primary fw-bold">
                              {fastest.vehicle}
                            </div>
                            <div className="time-display mb-2">
                              {fastest.time}
                            </div>
                            <small className="text-muted">Mejor tiempo</small>
                          </Card.Body>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            )}

                         {/* Tabla detallada de todos los vehículos */}
             <div>
               <h6 className="section-header">
                 <FaChartLine className="me-2" />
                 Ranking Detallado por Carril
               </h6>
               {Object.keys(laneData).map(lane => (
                 <div key={lane} className="mb-4">
                   <h6 className="mb-3">
                     <Badge className={`${getLaneBadgeColor(lane)} lane-badge`}>
                       Carril {lane}
                     </Badge>
                     <span className="ms-3 fw-bold text-muted">
                       ({laneData[lane].totalVehicles} vehículos)
                     </span>
                   </h6>
                   <Table striped bordered hover size="sm" className="ranking-table">
                     <thead>
                       <tr>
                         <th>Pos</th>
                         <th>Vehículo</th>
                         <th>Mejor Vuelta</th>
                         <th>Diferencia</th>
                         <th>Vueltas</th>
                         <th>Fecha</th>
                       </tr>
                     </thead>
                     <tbody>
                                               {laneData[lane].vehicles.map((vehicle, index) => {
                          // Calcular diferencia del mismo vehículo entre carriles
                          const timeDifference = getVehicleLaneDifference(vehicle, lane);

                         return (
                           <tr key={`${lane}-${vehicle.id}`}>
                             <td>
                               <Badge 
                                 variant={index === 0 ? 'warning' : 'secondary'}
                                 className={`d-flex align-items-center justify-content-center position-badge ${
                                   index === 0 ? 'first' : 
                                   index === 1 ? 'second' : 
                                   index === 2 ? 'third' : 'other'
                                 }`}
                               >
                                 {index === 0 ? <FaTrophy className="me-1" /> : ''}
                                 {index + 1}
                               </Badge>
                             </td>
                             <td className="fw-bold">
                               {vehicle.vehicle_manufacturer} {vehicle.vehicle_model}
                             </td>
                             <td className="time-display">
                               {vehicle.best_lap_time}
                             </td>
                             <td>
                               {timeDifference ? (
                                 <div className="d-flex align-items-center">
                                   <span className={`fw-bold ${
                                     timeDifference.isFaster ? 'success-indicator' : 
                                     timeDifference.isSlower ? 'danger-indicator' : 'text-muted'
                                   }`}>
                                     {timeDifference.isFaster ? '-' : timeDifference.isSlower ? '+' : ''}
                                     {Math.abs(timeDifference.seconds).toFixed(3)}s
                                   </span>
                                   <small className="text-muted ms-2">
                                     vs Carril {timeDifference.referenceLane}
                                   </small>
                                 </div>
                               ) : Object.keys(laneData).length < 2 ? (
                                 <span className="text-muted fst-italic">Único carril disponible</span>
                               ) : (
                                 <span className="text-muted fst-italic">Sin comparativa disponible</span>
                               )}
                             </td>
                             <td>
                               <Badge variant="info">
                                 {vehicle.laps || 'N/A'}
                               </Badge>
                             </td>
                             <td>
                               {new Date(vehicle.timing_date).toLocaleDateString()}
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </Table>
                 </div>
               ))}
             </div>
          </>
        )}

        {selectedCircuit && !loading && Object.keys(laneData).length === 0 && (
          <Alert variant="info" className="text-center">
            <Alert.Heading>Sin Datos</Alert.Heading>
            <p className="mb-0">
              No hay datos de tiempos registrados para el circuito <strong>{selectedCircuit}</strong>.
            </p>
            <small className="text-muted">
              Intenta seleccionar otro circuito o registra algunos tiempos primero.
            </small>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default LaneComparisonChart;
