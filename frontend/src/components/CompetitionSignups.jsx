import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Badge, Modal, Form, Alert, ListGroup, ListGroupItem,
  Spinner, Row, Col 
} from 'react-bootstrap';
import { 
  FaUsers, FaCheck, FaTimes, FaUser, FaEnvelope, FaCar, FaTag,
  FaCalendar, FaExclamationTriangle, FaEdit
} from 'react-icons/fa';
import axios from '../lib/axios';

const CompetitionSignups = ({ competitionId, onSignupApproved }) => {
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);
  
  // Estados para el modal de aprobación
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedSignup, setSelectedSignup] = useState(null);
  const [approveForm, setApproveForm] = useState({
    vehicle_id: '',
    vehicle_model: ''
  });
  const [vehicles, setVehicles] = useState([]);

  // Cargar inscripciones
  const loadSignups = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}/signups`);
      setSignups(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar inscripciones:', err);
      setError('Error al cargar las inscripciones');
    } finally {
      setLoading(false);
    }
  };

  // Cargar vehículos del usuario
  const loadVehicles = async () => {
    try {
      const response = await axios.get('/competitions/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Error al cargar vehículos:', err);
    }
  };

  useEffect(() => {
    loadSignups();
    loadVehicles();
  }, [competitionId]);

  // Abrir modal de aprobación
  const openApproveModal = (signup) => {
    setSelectedSignup(signup);
    setApproveForm({
      vehicle_id: '',
      vehicle_model: signup.vehicle // Por defecto usar el vehículo de la inscripción
    });
    setShowApproveModal(true);
  };

  // Aprobar inscripción
  const handleApproveSignup = async (e) => {
    e.preventDefault();
    
    if (!approveForm.vehicle_id && !approveForm.vehicle_model.trim()) {
      setApproveError('Debes especificar un vehículo');
      return;
    }

    try {
      setApproving(true);
      setApproveError(null);
      
      const approveData = {};
      if (approveForm.vehicle_id) {
        approveData.vehicle_id = approveForm.vehicle_id;
      } else {
        approveData.vehicle_model = approveForm.vehicle_model.trim();
      }

      await axios.post(`/competitions/${competitionId}/signups/${selectedSignup.id}/approve`, approveData);
      
      setShowApproveModal(false);
      setSelectedSignup(null);
      setApproveForm({ vehicle_id: '', vehicle_model: '' });
      
      // Recargar inscripciones y notificar al componente padre
      loadSignups();
      if (onSignupApproved) {
        onSignupApproved();
      }
    } catch (err) {
      console.error('Error al aprobar inscripción:', err);
      setApproveError(err.response?.data?.error || 'Error al aprobar la inscripción');
    } finally {
      setApproving(false);
    }
  };

  // Rechazar inscripción
  const handleRejectSignup = async (signupId) => {
    if (!window.confirm('¿Estás seguro de que quieres rechazar esta inscripción?')) {
      return;
    }

    try {
      await axios.delete(`/competitions/${competitionId}/signups/${signupId}`);
      loadSignups();
      if (onSignupApproved) {
        onSignupApproved();
      }
    } catch (err) {
      console.error('Error al rechazar inscripción:', err);
      alert('Error al rechazar la inscripción');
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <Card.Header>
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <FaUsers /> Inscripciones Públicas
          </h6>
        </Card.Header>
        <Card.Body className="text-center py-4">
          <Spinner animation="border" size="sm">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
          <p className="mt-2 mb-0">Cargando inscripciones...</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Card.Header>
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <FaUsers /> Inscripciones a través del formulario pendientes de validar ({signups.length})
          </h6>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {signups.length === 0 ? (
            <div className="text-center py-4">
              <FaUsers size={32} className="text-muted mb-3" />
              <p className="text-muted mb-0">No hay inscripciones pendientes</p>
            </div>
          ) : (
            <ListGroup variant="flush">
              {signups.map((signup) => (
                <ListGroupItem key={signup.id} className="px-0">
                  <Row className="align-items-center">
                    <Col md={8}>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <FaUser className="text-primary" />
                        <strong>{signup.name}</strong>
                        <Badge bg="info" className="ms-auto">
                          <FaCalendar className="me-1" />
                          {formatDate(signup.created_at)}
                        </Badge>
                      </div>
                      
                      <div className="d-flex align-items-center gap-2 mb-1 text-muted">
                        <FaEnvelope className="me-1" />
                        <small>{signup.email}</small>
                      </div>
                      
                      <div className="d-flex align-items-center gap-2 mb-1 text-muted">
                        <FaCar className="me-1" />
                        <small>{signup.vehicle}</small>
                      </div>
                      
                      {signup.competition_categories && (
                        <div className="d-flex align-items-center gap-2 text-muted">
                          <FaTag className="me-1" />
                          <small>{signup.competition_categories.name}</small>
                        </div>
                      )}
                    </Col>
                    
                    <Col md={4} className="text-end">
                      <div className="d-flex gap-2 justify-content-end">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => openApproveModal(signup)}
                          className="d-flex align-items-center gap-1"
                        >
                          <FaCheck /> Aprobar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRejectSignup(signup.id)}
                          className="d-flex align-items-center gap-1"
                        >
                          <FaTimes /> Rechazar
                        </Button>
                      </div>
                    </Col>
                  </Row>
                </ListGroupItem>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {/* Modal de aprobación */}
      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCheck className="me-2 text-success" />
            Aprobar Inscripción
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleApproveSignup}>
          <Modal.Body>
            {approveError && (
              <Alert variant="danger" className="mb-3">
                {approveError}
              </Alert>
            )}

            {selectedSignup && (
              <div className="mb-3">
                <h6>Información del solicitante:</h6>
                <p className="mb-1"><strong>Nombre:</strong> {selectedSignup.name}</p>
                <p className="mb-1"><strong>Email:</strong> {selectedSignup.email}</p>
                <p className="mb-1"><strong>Vehículo propuesto:</strong> {selectedSignup.vehicle}</p>
                {selectedSignup.competition_categories && (
                  <p className="mb-0"><strong>Categoría:</strong> {selectedSignup.competition_categories.name}</p>
                )}
              </div>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Vehículo para la competición</Form.Label>
              <Form.Select
                value={approveForm.vehicle_id}
                onChange={(e) => setApproveForm({
                  ...approveForm, 
                  vehicle_id: e.target.value,
                  vehicle_model: e.target.value ? '' : approveForm.vehicle_model
                })}
              >
                <option value="">Seleccionar vehículo de mi colección</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.manufacturer} {vehicle.model} ({vehicle.type})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                O especifica un modelo personalizado abajo
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Modelo personalizado</Form.Label>
              <Form.Control
                type="text"
                value={approveForm.vehicle_model}
                onChange={(e) => setApproveForm({
                  ...approveForm, 
                  vehicle_model: e.target.value,
                  vehicle_id: e.target.value ? '' : approveForm.vehicle_id
                })}
                placeholder="Ej: Scalextric Ferrari F1, Carrera Porsche 911..."
                disabled={!!approveForm.vehicle_id}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="success"
              disabled={approving}
              className="d-flex align-items-center gap-2"
            >
              {approving ? (
                <>
                  <Spinner animation="border" size="sm" />
                  Aprobando...
                </>
              ) : (
                <>
                  <FaCheck /> Aprobar Participante
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default CompetitionSignups; 