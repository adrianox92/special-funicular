import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Badge, ProgressBar, Table, Alert, 
  Spinner, Button, Modal
} from 'react-bootstrap';
import { 
  FaTrophy, FaUsers, FaFlag, FaClock, FaCheck, FaExclamationTriangle,
  FaDownload, FaFilePdf, FaMedal, FaStar, FaRoute
} from 'react-icons/fa';
import axios from '../lib/axios';

const CompetitionStatus = () => {
  const { slug } = useParams();
  const [competitionData, setCompetitionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [rules, setRules] = useState([]);

  useEffect(() => {
    loadCompetitionStatus();
  }, [slug]);

  const loadCompetitionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/public-signup/${slug}/status`);
      setCompetitionData(response.data);
      // Cargar reglas públicas
      const rulesResponse = await axios.get(`/public-signup/${slug}/rules`);
      setRules(rulesResponse.data);
    } catch (error) {
      console.error('Error al cargar el estado de la competición:', error);
      setError(error.response?.data?.error || 'Error al cargar los datos de la competición');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return time;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPositionBadge = (position) => {
    if (position === 1) return { bg: 'warning', icon: <FaTrophy /> };
    if (position === 2) return { bg: 'secondary', icon: <FaMedal /> };
    if (position === 3) return { bg: 'danger', icon: <FaMedal /> };
    return { bg: 'light', icon: null };
  };

  const getStatusBadge = (isCompleted) => {
    return isCompleted ? 
      { bg: 'success', text: 'Finalizada', icon: <FaCheck /> } :
      { bg: 'primary', text: 'En Curso', icon: <FaClock /> };
  };

  const handleExportPdf = () => {
    setShowPdfModal(true);
    // Aquí se implementaría la lógica de exportación PDF
  };

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <Spinner animation="border" role="status" className="mb-3">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
          <p>Cargando estado de la competición...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }

  if (!competitionData) {
    return (
      <Container className="py-5">
        <Alert variant="warning">
          <Alert.Heading>Competición no encontrada</Alert.Heading>
          <p>No se pudo encontrar la competición solicitada.</p>
        </Alert>
      </Container>
    );
  }

  const { competition, status, participants, global_best_lap } = competitionData;
  const statusBadge = getStatusBadge(status.is_completed);

  return (
    <Container className="py-4">
      {/* Header de la competición */}
      <Card className="mb-4 competition-status-header">
        <Card.Body className="text-center">
          <Row>
            <Col md={8}>
              <h1 className="mb-3">{competition.name}</h1>
              <div className="d-flex justify-content-center align-items-center gap-3 mb-3">
                <Badge bg={statusBadge.bg} className="fs-6 px-3 py-2">
                  {statusBadge.icon} {statusBadge.text}
                </Badge>
                {competition.circuit_name && (
                  <Badge bg="info" className="fs-6 px-3 py-2">
                    <FaRoute /> {competition.circuit_name}
                  </Badge>
                )}
              </div>
              <p className="text-light mb-0">
                Creada el {formatDate(competition.created_at)}
              </p>
            </Col>
            <Col md={4} className="d-flex align-items-center justify-content-center">
              <div className="text-center">
                <div className="display-4 text-warning mb-2">
                  <FaTrophy />
                </div>
                <h5 className="text-light">Competición Pública</h5>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Estadísticas generales */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center h-100 status-card">
            <Card.Body>
              <div className="display-6 text-primary mb-2">
                <FaUsers />
              </div>
              <h4>{status.participants_count}</h4>
              <p className="text-muted mb-0">Participantes</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 status-card">
            <Card.Body>
              <div className="display-6 text-success mb-2">
                <FaFlag />
              </div>
              <h4>{competition.rounds}</h4>
              <p className="text-muted mb-0">Rondas</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 status-card">
            <Card.Body>
              <div className="display-6 text-info mb-2">
                <FaClock />
              </div>
              <h4>{status.times_registered}</h4>
              <p className="text-muted mb-0">Tiempos Registrados</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 status-card">
            <Card.Body>
              <div className="display-6 text-warning mb-2">
                <FaStar />
              </div>
              <h4>{status.progress_percentage}%</h4>
              <p className="text-muted mb-0">Progreso</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Barra de progreso */}
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="mb-0">Progreso de la Competición</h5>
            <span className="text-muted">
              {status.times_registered} de {status.total_required_times} tiempos
            </span>
          </div>
          <ProgressBar 
            now={status.progress_percentage} 
            variant={status.is_completed ? 'success' : 'primary'}
            className="competition-progress"
          />
          <div className="mt-2 text-muted small">
            {status.is_completed ? 
              '¡Competición completada!' : 
              `${status.times_remaining} tiempos restantes`
            }
          </div>
        </Card.Body>
      </Card>

      {/* Mejor vuelta global */}
      {global_best_lap && (
        <Card className="mb-4 global-best-lap">
          <Card.Body className="text-center">
            <div className="display-6 text-warning mb-2">
              <FaTrophy />
            </div>
            <h4>Mejor Vuelta Global</h4>
            <div className="display-5 text-warning fw-bold mb-2">
              {formatTime(global_best_lap.time)}
            </div>
            <p className="text-muted mb-0">
              Por <strong>{global_best_lap.driver}</strong>
            </p>
          </Card.Body>
        </Card>
      )}

      {/* Clasificación */}
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <FaTrophy className="me-2" />
            Clasificación General
          </h5>
          {status.is_completed && (
            <Button 
              variant="outline-primary" 
              size="sm"
              onClick={handleExportPdf}
            >
              <FaDownload className="me-1" />
              Exportar PDF
            </Button>
          )}
        </Card.Header>
        <Card.Body>
          {participants.length > 0 ? (
            <Table responsive bordered hover className="mb-4">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Piloto</th>
                  <th>Vehículo</th>
                  <th>Rondas completadas</th>
                  <th>Mejor vuelta</th>
                  <th>Tiempo total</th>
                  <th>Dif. Líder</th>
                  <th>Dif. Anterior</th>
                  {rules.length > 0 && <th>Puntos</th>}
                </tr>
              </thead>
              <tbody>
                {participants.map((participant, idx) => {
                  // Calcular diferencia con el líder
                  let leaderDiff = '-';
                  let previousDiff = '-';
                  if (idx > 0 && participants[0].total_time && participant.total_time) {
                    const leaderTime = parseFloat(participants[0].total_time.split(':')[0]) * 60 + parseFloat(participants[0].total_time.split(':')[1]);
                    const currentTime = parseFloat(participant.total_time.split(':')[0]) * 60 + parseFloat(participant.total_time.split(':')[1]);
                    const diff = currentTime - leaderTime;
                    const diffMinutes = Math.floor(diff / 60);
                    const diffSeconds = (diff % 60).toFixed(3);
                    leaderDiff = diffMinutes > 0 ? `+${diffMinutes}:${diffSeconds.padStart(6, '0')}` : `+${diffSeconds}`;
                  }
                  if (idx > 0 && participants[idx - 1].total_time && participant.total_time) {
                    const previousTime = parseFloat(participants[idx - 1].total_time.split(':')[0]) * 60 + parseFloat(participants[idx - 1].total_time.split(':')[1]);
                    const currentTime = parseFloat(participant.total_time.split(':')[0]) * 60 + parseFloat(participant.total_time.split(':')[1]);
                    const diff = currentTime - previousTime;
                    const diffMinutes = Math.floor(diff / 60);
                    const diffSeconds = (diff % 60).toFixed(3);
                    previousDiff = diffMinutes > 0 ? `+${diffMinutes}:${diffSeconds.padStart(6, '0')}` : `+${diffSeconds}`;
                  }
                  return (
                    <tr key={participant.participant_id}>
                      <td>{participant.position}</td>
                      <td>{participant.driver_name}</td>
                      <td>{participant.vehicle_info}</td>
                      <td>{participant.rounds_completed}</td>
                      <td>{formatTime(participant.best_lap_time)}</td>
                      <td>{formatTime(participant.total_time)}</td>
                      <td>{leaderDiff}</td>
                      <td>{previousDiff}</td>
                      {rules.length > 0 && <td>{participant.points || 0}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted">No hay participantes registrados</p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Detalles por participante */}
      {participants.length > 0 && (
        <Card>
          <Card.Header>
            <h5 className="mb-0">
              <FaUsers className="me-2" />
              Detalles por Participante
            </h5>
          </Card.Header>
          <Card.Body>
            <Row>
              {participants.map((participant) => (
                <Col key={participant.participant_id} lg={6} xl={4} className="mb-3">
                  <Card className="h-100 participant-detail-card">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h6 className="mb-1 fw-bold">{participant.driver_name}</h6>
                          <small className="text-muted">{participant.vehicle_info}</small>
                        </div>
                        <Badge bg={getPositionBadge(participant.position).bg} className="badge-custom">
                          {participant.position}º
                        </Badge>
                      </div>
                      
                      <div className="mb-3">
                        <div className="d-flex justify-content-between mb-1">
                          <small className="text-muted">Progreso:</small>
                          <small className="text-muted">
                            {participant.rounds_completed}/{competition.rounds}
                          </small>
                        </div>
                        <ProgressBar 
                          now={(participant.rounds_completed / competition.rounds) * 100}
                          variant={participant.rounds_completed >= competition.rounds ? 'success' : 'primary'}
                          size="sm"
                          className="progress-bar-custom"
                        />
                      </div>

                      <div className="row text-center">
                        <div className="col-6">
                          <div className="text-primary fw-bold">
                            {formatTime(participant.best_lap_time)}
                          </div>
                          <small className="text-muted">Mejor Vuelta</small>
                        </div>
                        <div className="col-6">
                          <div className="text-success fw-bold">
                            {formatTime(participant.total_time)}
                          </div>
                          <small className="text-muted">Total</small>
                        </div>
                      </div>

                      {participant.timings.length > 0 && (
                        <div className="mt-3">
                          <small className="text-muted d-block mb-2">Tiempos por ronda:</small>
                          <div className="row g-1">
                            {participant.timings.map((timing) => (
                              <div key={timing.id} className="col-6">
                                <div className="round-timing-chip">
                                  <small className="fw-bold">R{timing.round_number}</small>
                                  <div className="text-muted small">
                                    {formatTime(timing.total_time)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Aviso de empate en mejor vuelta */}
      {competitionData.best_time_ties_message && (
        <Alert variant="warning" className="mb-3">
          {competitionData.best_time_ties_message}
          {competitionData.best_time_ties && competitionData.best_time_ties.length > 0 && (
            <ul className="mb-0 mt-2">
              {competitionData.best_time_ties.map(tie => (
                <li key={tie.round}>Ronda {tie.round}: tiempo {tie.time}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      {/* Modal para exportación PDF */}
      <Modal show={showPdfModal} onHide={() => setShowPdfModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Exportar Resultados</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Funcionalidad de exportación PDF en desarrollo.</p>
          <p>Esta función permitirá descargar un reporte completo de la competición en formato PDF.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPdfModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CompetitionStatus; 