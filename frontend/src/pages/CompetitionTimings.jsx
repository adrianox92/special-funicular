import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Button, Badge, Modal, Form, Alert, 
  ProgressBar, Table, Nav, Tab, Tabs, ButtonGroup
} from 'react-bootstrap';
import { 
  FaPlus, FaEdit, FaTrash, FaArrowLeft, FaClock, FaCheck, 
  FaExclamationTriangle, FaTrophy, FaUsers, FaFlag, FaDownload, FaFileCsv, FaFilePdf
} from 'react-icons/fa';
import axios from '../lib/axios';

const CompetitionTimings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [timings, setTimings] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para el formulario
  const [showModal, setShowModal] = useState(false);
  const [editingTiming, setEditingTiming] = useState(null);
  const [activeTab, setActiveTab] = useState('aggregated');
  
  const [formData, setFormData] = useState({
    participant_id: '',
    round_number: '',
    best_lap_time: '',
    total_time: '',
    laps: '',
    average_time: '',
    lane: ''
  });

  const [rules, setRules] = useState([]);
  const [pointsByParticipant, setPointsByParticipant] = useState({});

  // Cargar datos de la competición
  useEffect(() => {
    loadCompetitionData();
  }, [id]);

  const loadCompetitionData = async () => {
    try {
      setLoading(true);
      
      // Cargar competición
      const compResponse = await axios.get(`/competitions/${id}`);
      setCompetition(compResponse.data);
      
      // Cargar participantes
      const partResponse = await axios.get(`/competitions/${id}/participants`);
      setParticipants(partResponse.data);
      
      // Cargar tiempos
      const timingsResponse = await axios.get(`/competitions/${id}/timings`);
      setTimings(timingsResponse.data);
      
      // Cargar progreso
      const progressResponse = await axios.get(`/competitions/${id}/progress`);
      setProgress(progressResponse.data);
      
      // Cargar reglas
      const rulesResponse = await axios.get(`/competitions/${id}/rules`);
      setRules(rulesResponse.data);
      
      // Calcular puntos
      setTimeout(() => {
        setPointsByParticipant(
          calculatePoints(partResponse.data, timingsResponse.data, rulesResponse.data, compResponse.data)
        );
      }, 0);
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setError(error.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleShowModal = (timing = null) => {
    if (timing) {
      setEditingTiming(timing);
      setFormData({
        participant_id: timing.participant_id,
        round_number: timing.round_number,
        best_lap_time: timing.best_lap_time,
        total_time: timing.total_time,
        laps: timing.laps,
        average_time: timing.average_time,
        lane: timing.lane || ''
      });
    } else {
      setEditingTiming(null);
      setFormData({
        participant_id: '',
        round_number: '',
        best_lap_time: '',
        total_time: '',
        laps: '',
        average_time: '',
        lane: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTiming(null);
    setFormData({
      participant_id: '',
      round_number: '',
      best_lap_time: '',
      total_time: '',
      laps: '',
      average_time: '',
      lane: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar que hay participantes disponibles para la ronda seleccionada
    if (formData.round_number && getAvailableParticipantsForRound(formData.round_number).length === 0) {
      alert('No hay participantes disponibles para esta ronda. Todos ya tienen tiempo registrado.');
      return;
    }
    
    try {
      if (editingTiming) {
        // Actualizar tiempo existente
        await axios.put(`/competitions/${id}/timings/${editingTiming.id}`, formData);
      } else {
        // Crear nuevo tiempo
        await axios.post(`/competitions/${id}/timings`, formData);
      }
      
      handleCloseModal();
      loadCompetitionData(); // Recargar datos
    } catch (error) {
      console.error('Error al guardar tiempo:', error);
      setError(error.response?.data?.error || 'Error al guardar el tiempo');
    }
  };

  const handleDeleteTiming = async (timingId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este tiempo?')) {
      return;
    }
    
    try {
      await axios.delete(`/competitions/${id}/timings/${timingId}`);
      loadCompetitionData(); // Recargar datos
    } catch (error) {
      console.error('Error al eliminar tiempo:', error);
      setError(error.response?.data?.error || 'Error al eliminar el tiempo');
    }
  };

  const getParticipantName = (participantId) => {
    const participant = participants.find(p => p.id === participantId);
    return participant ? participant.driver_name : 'Desconocido';
  };

  const getVehicleInfo = (participantId) => {
    const participant = participants.find(p => p.id === participantId);
    if (!participant) return 'Desconocido';
    
    if (participant.vehicles) {
      return `${participant.vehicles.manufacturer} ${participant.vehicles.model}`;
    } else if (participant.vehicle_model) {
      return participant.vehicle_model;
    }
    return 'Sin vehículo';
  };

  // Función para obtener participantes disponibles para una ronda específica
  const getAvailableParticipantsForRound = (roundNumber) => {
    if (!roundNumber) return participants;
    
    // Obtener los IDs de participantes que ya tienen tiempo en esta ronda
    const participantsWithTimeInRound = timings
      .filter(timing => timing.round_number === parseInt(roundNumber))
      .map(timing => timing.participant_id);
    
    // Filtrar participantes que no tienen tiempo en esta ronda
    return participants.filter(participant => 
      !participantsWithTimeInRound.includes(participant.id)
    );
  };

  // Función para verificar si todos los pilotos han completado todas las rondas
  const isCompetitionComplete = () => {
    if (!competition || participants.length === 0) return false;
    
    const totalRequiredTimes = participants.length * competition.rounds;
    const actualTimes = timings.length;
    
    return actualTimes >= totalRequiredTimes;
  };

  // Función para obtener participantes que han completado todas las rondas
  const getParticipantsWithAllRounds = () => {
    const participantRounds = {};
    
    // Contar rondas completadas por cada participante
    timings.forEach(timing => {
      const participantId = timing.participant_id;
      if (!participantRounds[participantId]) {
        participantRounds[participantId] = new Set();
      }
      participantRounds[participantId].add(timing.round_number);
    });
    
    // Filtrar participantes que han completado todas las rondas
    return participants.filter(participant => 
      participantRounds[participant.id] && 
      participantRounds[participant.id].size >= competition.rounds
    );
  };

  // Función para calcular tiempos agregados por participante
  const getAggregatedTimes = () => {
    const aggregatedData = {};
    timings.forEach(timing => {
      const key = String(timing.participant_id);
      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          id: key,
          participant_id: key,
          total_time_seconds: 0,
          best_lap_time: null,
          rounds_completed: 0,
          total_laps: 0
        };
      }
      // Convertir tiempo total a segundos
      const timeParts = timing.total_time.split(':');
      const timeInSeconds = parseFloat(timeParts[0]) * 60 + parseFloat(timeParts[1]);
      aggregatedData[key].total_time_seconds += timeInSeconds;
      // Actualizar mejor vuelta
      const lapTimeParts = timing.best_lap_time.split(':');
      const lapTimeInSeconds = parseFloat(lapTimeParts[0]) * 60 + parseFloat(lapTimeParts[1]);
      if (!aggregatedData[key].best_lap_time || 
          lapTimeInSeconds < (() => {
            const bestParts = aggregatedData[key].best_lap_time.split(':');
            return parseFloat(bestParts[0]) * 60 + parseFloat(bestParts[1]);
          })()) {
        aggregatedData[key].best_lap_time = timing.best_lap_time;
      }
      aggregatedData[key].rounds_completed += 1;
      aggregatedData[key].total_laps += timing.laps;
    });
    return Object.values(aggregatedData)
      .sort((a, b) => {
        const aCompleted = a.rounds_completed >= (competition?.rounds || 0);
        const bCompleted = b.rounds_completed >= (competition?.rounds || 0);
        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;
        return a.total_time_seconds - b.total_time_seconds;
      })
      .map((data, index) => {
        const totalMinutes = Math.floor(data.total_time_seconds / 60);
        const totalSeconds = (data.total_time_seconds % 60).toFixed(3);
        const totalTimeFormatted = `${String(totalMinutes).padStart(2, '0')}:${totalSeconds.padStart(6, '0')}`;
        return {
          ...data,
          position: index + 1,
          total_time_formatted: totalTimeFormatted,
          has_completed_all_rounds: data.rounds_completed >= (competition?.rounds || 0)
        };
      });
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return time;
  };

  const getRoundStatus = (roundNumber) => {
    const roundTimings = timings.filter(t => t.round_number === roundNumber);
    const totalParticipants = participants.length;
    
    if (roundTimings.length === 0) {
      return { status: 'pending', text: 'Pendiente', color: 'secondary' };
    } else if (roundTimings.length === totalParticipants) {
      return { status: 'completed', text: 'Completada', color: 'success' };
    } else {
      return { status: 'partial', text: 'Parcial', color: 'warning' };
    }
  };

  // Funciones de exportación
  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`/competitions/${id}/export/csv`, {
        responseType: 'blob'
      });

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `competicion_${competition.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar CSV:', error);
      alert('Error al exportar los datos a CSV');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await axios.get(`/competitions/${id}/export/pdf`, {
        responseType: 'blob'
      });

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `competicion_${competition.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al exportar los datos a PDF');
    }
  };

  // Lógica para calcular puntos
  const calculatePoints = (participants, timings, rules, competition) => {
    if (!rules || rules.length === 0) return {};
    const points = {};
    // Sumar puntos por ronda (todas las reglas per_round)
    rules.filter(r => r.rule_type === 'per_round').forEach(rule => {
      const points_structure = rule.points_structure || {};
      for (let round = 1; round <= competition.rounds; round++) {
        // Filtrar tiempos de la ronda
        const roundTimings = timings.filter(t => t.round_number === round);
        // Ordenar por tiempo total ascendente
        const sorted = [...roundTimings].sort((a, b) => {
          const timeA = parseFloat(a.total_time.split(':')[0]) * 60 + parseFloat(a.total_time.split(':')[1]);
          const timeB = parseFloat(b.total_time.split(':')[0]) * 60 + parseFloat(b.total_time.split(':')[1]);
          return timeA - timeB;
        });
        sorted.forEach((timing, idx) => {
          const pos = (idx + 1).toString();
          const pts = points_structure[pos] || 0;
          // Usar timing.participant_id como string para la clave
          const key = String(timing.participant_id);
          points[key] = (points[key] || 0) + pts;
        });
      }
    });
    // Sumar puntos finales (todas las reglas final)
    rules.filter(r => r.rule_type === 'final').forEach(rule => {
      const points_structure = rule.points_structure || {};
      // Usar la función getAggregatedTimes para obtener el ranking
      const agg = getAggregatedTimes();
      agg.forEach((data, idx) => {
        const pos = (idx + 1).toString();
        const pts = points_structure[pos] || 0;
        // Usar data.id como string para la clave
        const key = String(data.id);
        points[key] = (points[key] || 0) + pts;
      });
    });
    return points;
  };

  if (loading) {
    return (
      <Container className="mt-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
        <p className="text-center mt-3">Cargando...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  // Verificar que la competición tenga al menos un participante antes de permitir gestionar tiempos
  if (competition && participants.length === 0) {
    return (
      <Container className="mt-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex align-items-center mb-3">
              <Button
                variant="outline-secondary"
                onClick={() => navigate(`/competitions/${id}/participants`)}
                className="me-3"
              >
                <FaArrowLeft /> Volver
              </Button>
              <div className="flex-grow-1">
                <h1 className="mb-1">⏱️ Tiempos de Competición</h1>
                <p className="text-muted mb-0">{competition?.name}</p>
              </div>
            </div>
          </Col>
        </Row>
        
        <Alert variant="warning" className="text-center py-5">
          <FaExclamationTriangle size={48} className="mb-3 text-warning" />
          <h4>Sin Participantes</h4>
          <p className="mb-3">
            No puedes gestionar tiempos hasta que haya al menos un participante registrado.
          </p>
          <div className="d-flex align-items-center justify-content-center mb-3">
            <Badge bg="warning" className="me-2">
              {participants.length}/{competition.num_slots} participantes
            </Badge>
            <span className="text-muted">
              Añade al menos un participante para comenzar
            </span>
          </div>
          <Button 
            variant="primary" 
            onClick={() => navigate(`/competitions/${id}/participants`)}
            className="d-flex align-items-center gap-2 mx-auto"
          >
            <FaUsers /> Añadir Participantes
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center mb-3">
            <Button
              variant="outline-secondary"
              onClick={() => navigate(`/competitions/${id}/participants`)}
              className="me-3"
            >
              <FaArrowLeft /> Volver
            </Button>
            <div className="flex-grow-1">
              <h1 className="mb-1">⏱️ Tiempos de Competición</h1>
              <p className="text-muted mb-0">{competition?.name}</p>
            </div>
            <div className="d-flex gap-2">
              {isCompetitionComplete() && (
                <>
                  <Button
                    variant="outline-success"
                    onClick={handleExportCSV}
                    className="d-flex align-items-center gap-2"
                  >
                    <FaFileCsv /> CSV
                  </Button>
                  <Button
                    variant="outline-danger"
                    onClick={handleExportPDF}
                    className="d-flex align-items-center gap-2"
                  >
                    <FaFilePdf /> PDF
                  </Button>
                </>
              )}
              <Button
                variant="primary"
                onClick={() => handleShowModal()}
                className="d-flex align-items-center gap-2"
                disabled={participants.length === 0 || isCompetitionComplete()}
              >
                <FaPlus /> 
                {isCompetitionComplete() ? 'Competición Completada' : 'Registrar Tiempo'}
                {participants.length > 0 && !isCompetitionComplete() && (
                  <Badge bg="light" text="dark" className="ms-2">
                    {participants.length} participantes
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Progreso de la competición */}
      {progress && (
        <Card className="mb-4">
          <Card.Body>
            <h5 className="card-title">📊 Progreso de la Competición</h5>
            <div className="d-flex align-items-center mb-3">
              <div className="flex-grow-1 me-3">
                <ProgressBar 
                  now={progress.progress_percentage} 
                  className="mb-2"
                  style={{ height: '10px' }}
                />
              </div>
              <span className="text-muted">{progress.progress_percentage}%</span>
            </div>
            <Row>
              <Col xs={12} sm={3}>
                <div className="text-center">
                  <small className="text-muted d-block">Participantes</small>
                  <h6 className="mb-0">{progress.participants_count}</h6>
                </div>
              </Col>
              <Col xs={12} sm={3}>
                <div className="text-center">
                  <small className="text-muted d-block">Rondas</small>
                  <h6 className="mb-0">{progress.rounds}</h6>
                </div>
              </Col>
              <Col xs={12} sm={3}>
                <div className="text-center">
                  <small className="text-muted d-block">Tiempos Registrados</small>
                  <h6 className="mb-0">{progress.times_registered} / {progress.total_required_times}</h6>
                </div>
              </Col>
              <Col xs={12} sm={3}>
                <div className="text-center">
                  <small className="text-muted d-block">Estado</small>
                  <Badge bg={progress.is_completed ? 'success' : 'warning'}>
                    {progress.is_completed ? 'Completada' : ' En Progreso'}
                  </Badge>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Mensaje cuando la competición está completa */}
      {isCompetitionComplete() && (
        <Alert variant="success" className="mb-4">
          <div className="d-flex align-items-center">
            <FaTrophy className="me-2" size={20} />
            <div>
              <strong>¡Competición Completada!</strong>
              <p className="mb-0 mt-1">
                Todos los participantes han completado todas las rondas. Ya no se pueden registrar más tiempos.
                Revisa la pestaña "Tiempos Agregados" para ver la clasificación final.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Tabs para diferentes vistas */}
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="rounds" title="Vista por Rondas">
          <Row>
            {Array.from({ length: competition?.rounds || 0 }, (_, i) => i + 1).map(roundNumber => {
              const roundTimings = timings.filter(t => t.round_number === roundNumber);
              const roundStatus = getRoundStatus(roundNumber);
              
              // Ordenar por tiempo total de menor a mayor
              const sortedTimings = [...roundTimings].sort((a, b) => {
                const timeAParts = a.total_time.split(':');
                const timeBParts = b.total_time.split(':');
                const timeA = parseFloat(timeAParts[0]) * 60 + parseFloat(timeAParts[1]);
                const timeB = parseFloat(timeBParts[0]) * 60 + parseFloat(timeBParts[1]);
                return timeA - timeB;
              });
              
              // Encontrar el mejor tiempo de vuelta de la ronda
              const bestLapTime = sortedTimings.length > 0 ? 
                sortedTimings.reduce((best, current) => {
                  const currentParts = current.best_lap_time.split(':');
                  const bestParts = best.best_lap_time.split(':');
                  const currentTime = parseFloat(currentParts[0]) * 60 + parseFloat(currentParts[1]);
                  const bestTime = parseFloat(bestParts[0]) * 60 + parseFloat(bestParts[1]);
                  return currentTime < bestTime ? current : best;
                }) : null;
              
              return (
                <Col xs={12} md={6} lg={4} key={roundNumber} className="mb-3">
                  <Card>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">Ronda {roundNumber}</h6>
                        <Badge bg={roundStatus.color}>
                          {roundStatus.text}
                        </Badge>
                      </div>
                      
                      {sortedTimings.length > 0 ? (
                        <Table size="sm" className="mb-0 timing-table">
                          <thead>
                            <tr>
                              <th>Pos</th>
                              <th>Piloto</th>
                              <th>Total</th>
                              <th>Dif</th>
                              <th>Mejor</th>
                              <th>Vueltas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedTimings.map((timing, index) => {
                              const isBestLap = bestLapTime && timing.id === bestLapTime.id;
                              const timeDiff = index === 0 ? '-' : 
                                (() => {
                                  const currentParts = timing.total_time.split(':');
                                  const leaderParts = sortedTimings[0].total_time.split(':');
                                  const currentTime = parseFloat(currentParts[0]) * 60 + parseFloat(currentParts[1]);
                                  const leaderTime = parseFloat(leaderParts[0]) * 60 + parseFloat(leaderParts[1]);
                                  const diff = currentTime - leaderTime;
                                  const diffMinutes = Math.floor(diff / 60);
                                  const diffSeconds = (diff % 60).toFixed(3);
                                  return diffMinutes > 0 ? 
                                    `+${diffMinutes}:${diffSeconds.padStart(6, '0')}` : 
                                    `+${diffSeconds}`;
                                })();
                              
                              return (
                                <tr key={timing.id}>
                                  <td>
                                    <Badge bg={index === 0 ? 'success' : 'secondary'} className="badge-custom">
                                      {index + 1}
                                    </Badge>
                                  </td>
                                  <td>{getParticipantName(timing.participant_id)}</td>
                                  <td className="fw-bold">{formatTime(timing.total_time)}</td>
                                  <td className="text-muted small">{timeDiff}</td>
                                  <td className={isBestLap ? 'fw-bold text-warning bg-warning bg-opacity-10' : ''}>
                                    {formatTime(timing.best_lap_time)}
                                    {isBestLap && <span className="ms-1">🏆</span>}
                                  </td>
                                  <td>{timing.laps}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      ) : (
                        <p className="text-muted mb-0 small">No hay tiempos registrados</p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Tab>

        <Tab eventKey="participants" title="Vista por Participantes">
          <Row>
            {participants.map(participant => {
              const participantTimings = timings.filter(t => t.participant_id === participant.id);
              const completedRounds = participantTimings.length;
              const totalRounds = competition?.rounds || 0;
              
              return (
                <Col xs={12} md={6} lg={4} key={participant.id} className="mb-3">
                  <Card>
                    <Card.Body>
                      <h6 className="card-title">{participant.driver_name}</h6>
                      <p className="text-muted small mb-3">{getVehicleInfo(participant.id)}</p>
                      
                      <div className="d-flex align-items-center mb-3">
                        <div className="flex-grow-1 me-3">
                          <ProgressBar 
                            now={(completedRounds / totalRounds) * 100}
                            style={{ height: '8px' }}
                          />
                        </div>
                        <small className="text-muted">{completedRounds}/{totalRounds}</small>
                      </div>

                      {participantTimings.length > 0 ? (
                        <Table size="sm" className="mb-0 timing-table">
                          <thead>
                            <tr>
                              <th>Ronda</th>
                              <th>Mejor</th>
                              <th>Total</th>
                              <th>Promedio</th>
                              <th>Vueltas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participantTimings.map((timing) => (
                              <tr key={timing.id}>
                                <td>{timing.round_number}</td>
                                <td>{formatTime(timing.best_lap_time)}</td>
                                <td>{formatTime(timing.total_time)}</td>
                                <td>{formatTime(timing.average_time)}</td>
                                <td>{timing.laps}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <p className="text-muted mb-0 small">Sin tiempos registrados</p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Tab>

        <Tab eventKey="aggregated" title="Tiempos Agregados">
          <Card>
            <Card.Body>
              <h6 className="card-title mb-3">🏆 Clasificación General</h6>
              {(() => {
                const aggregatedTimes = getAggregatedTimes();
                return aggregatedTimes.length > 0 ? (
                  <Table responsive className="timing-table">
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Piloto</th>
                        <th>Vehículo</th>
                        <th>Mejor Vuelta</th>
                        <th>Tiempo Total</th>
                        <th>Dif. Líder</th>
                        <th>Dif. Anterior</th>
                        <th>Rondas</th>
                        <th>Vueltas</th>
                        <th>Puntos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregatedTimes.map((data, index) => {
                        // Calcular diferencia con el líder (posición 1)
                        const leaderDiff = index === 0 ? '-' : 
                          (() => {
                            const leaderTime = aggregatedTimes[0].total_time_seconds;
                            const currentTime = data.total_time_seconds;
                            const diff = currentTime - leaderTime;
                            const diffMinutes = Math.floor(diff / 60);
                            const diffSeconds = (diff % 60).toFixed(3);
                            return diffMinutes > 0 ? 
                              `+${diffMinutes}:${diffSeconds.padStart(6, '0')}` : 
                              `+${diffSeconds}`;
                          })();
                        
                        // Calcular diferencia con el anterior
                        const previousDiff = index === 0 ? '-' : 
                          (() => {
                            const previousTime = aggregatedTimes[index - 1].total_time_seconds;
                            const currentTime = data.total_time_seconds;
                            const diff = currentTime - previousTime;
                            const diffMinutes = Math.floor(diff / 60);
                            const diffSeconds = (diff % 60).toFixed(3);
                            return diffMinutes > 0 ? 
                              `+${diffMinutes}:${diffSeconds.padStart(6, '0')}` : 
                              `+${diffSeconds}`;
                          })();
                        
                        return (
                          <tr key={data.id}>
                            <td>
                              <Badge 
                                bg={data.position === 1 ? 'success' : data.position === 2 ? 'warning' : data.position === 3 ? 'info' : 'secondary'} 
                                className="badge-custom"
                              >
                                {data.position}
                              </Badge>
                            </td>
                            <td className="fw-bold">{getParticipantName(data.participant_id)}</td>
                            <td className="text-muted">{getVehicleInfo(data.participant_id)}</td>
                            <td className="text-warning fw-bold">{formatTime(data.best_lap_time)}</td>
                            <td className="fw-bold fs-6">{data.total_time_formatted}</td>
                            <td className="difference-column difference-leader">{leaderDiff}</td>
                            <td className="difference-column difference-previous">{previousDiff}</td>
                            <td>
                              <Badge bg="info" className="badge-custom">
                                {data.rounds_completed}/{competition?.rounds || 0}
                              </Badge>
                            </td>
                            <td>{data.total_laps}</td>
                            <td>{pointsByParticipant[data.id] || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted">No hay tiempos registrados para mostrar clasificación</p>
                  </div>
                );
              })()}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Modal para añadir/editar tiempo */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingTiming ? 'Editar Tiempo' : 'Registrar Nuevo Tiempo'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {!editingTiming && (
              <Alert variant="info" className="mb-3">
                <strong>💡 Consejo:</strong> Selecciona primero la ronda y luego el participante. 
                Solo se mostrarán los participantes que aún no tienen tiempo registrado para esa ronda.
              </Alert>
            )}
            <Row>
              <Col xs={12} sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ronda *</Form.Label>
                  <Form.Select
                    value={formData.round_number}
                    onChange={(e) => {
                      setFormData({
                        ...formData, 
                        round_number: e.target.value,
                        participant_id: '' // Resetear participante al cambiar ronda
                      });
                    }}
                    required
                  >
                    <option value="">Seleccionar ronda</option>
                    {Array.from({ length: competition?.rounds || 0 }, (_, i) => i + 1).map(round => (
                      <option key={round} value={round}>
                        Ronda {round}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col xs={12} sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Participante *</Form.Label>
                  <Form.Select
                    value={formData.participant_id}
                    onChange={(e) => setFormData({...formData, participant_id: e.target.value})}
                    required
                    disabled={!formData.round_number}
                  >
                    <option value="">
                      {!formData.round_number 
                        ? 'Selecciona primero una ronda' 
                        : 'Seleccionar participante'
                      }
                    </option>
                    {getAvailableParticipantsForRound(formData.round_number).map(participant => (
                      <option key={participant.id} value={participant.id}>
                        {participant.driver_name} - {getVehicleInfo(participant.id)}
                      </option>
                    ))}
                  </Form.Select>
                  {formData.round_number && getAvailableParticipantsForRound(formData.round_number).length === 0 && (
                    <Form.Text className="text-warning">
                      Todos los participantes ya tienen tiempo registrado para esta ronda
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mejor Vuelta *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.best_lap_time}
                    onChange={(e) => setFormData({...formData, best_lap_time: e.target.value})}
                    placeholder="00:00.000"
                    required
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tiempo Total *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.total_time}
                    onChange={(e) => setFormData({...formData, total_time: e.target.value})}
                    placeholder="00:00.000"
                    required
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Número de Vueltas *</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.laps}
                    onChange={(e) => setFormData({...formData, laps: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tiempo Promedio *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.average_time}
                    onChange={(e) => setFormData({...formData, average_time: e.target.value})}
                    placeholder="00:00.000"
                    required
                  />
                  <Form.Text className="text-muted">
                    Tiempo promedio por vuelta
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Carril</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.lane}
                    onChange={(e) => setFormData({...formData, lane: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!formData.round_number || !formData.participant_id || isCompetitionComplete()}
            >
              {isCompetitionComplete() ? 'Competición Completada' : 'Registrar Tiempo'}
            </button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default CompetitionTimings;