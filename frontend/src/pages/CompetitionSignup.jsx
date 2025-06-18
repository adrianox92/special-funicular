import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Form, Button, Alert, Badge,
  Spinner, Modal, ProgressBar 
} from 'react-bootstrap';
import { 
  FaTrophy, FaUsers, FaCalendar, FaFlag, FaCheckCircle,
  FaExclamationTriangle, FaArrowLeft, FaCar
} from 'react-icons/fa';
import axios from '../lib/axios';

const CompetitionSignup = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [status, setStatus] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category_id: '',
    vehicle: ''
  });

  // Cargar información de la competición
  const loadCompetition = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/public-signup/${slug}`);
      setCompetition(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar competición:', err);
      if (err.response?.status === 404) {
        setError('Competición no encontrada');
      } else {
        setError('Error al cargar la información de la competición');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompetition();
    axios.get(`/public-signup/${slug}/status`).then(res => setStatus(res.data.status)).catch(() => {});
  }, [slug]);

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setSubmitError('El nombre es requerido');
      return;
    }

    if (!formData.email.trim()) {
      setSubmitError('El email es requerido');
      return;
    }

    if (!formData.category_id) {
      setSubmitError('Debes seleccionar una categoría');
      return;
    }

    if (!formData.vehicle.trim()) {
      setSubmitError('El vehículo es requerido');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      
      await axios.post(`/public-signup/${slug}/signup`, formData);
      
      setShowSuccessModal(true);
      setFormData({ name: '', email: '', category_id: '', vehicle: '' });
    } catch (err) {
      console.error('Error al enviar inscripción:', err);
      setSubmitError(err.response?.data?.error || 'Error al enviar la inscripción');
    } finally {
      setSubmitting(false);
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <Spinner animation="border" role="status" className="mb-3">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
          <p>Cargando información de la competición...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Row className="justify-content-center">
          <Col md={8}>
            <Card className="text-center py-5">
              <Card.Body>
                <FaExclamationTriangle size={48} className="text-danger mb-3" />
                <h4>Error</h4>
                <p className="text-muted mb-4">{error}</p>
                <Button 
                  variant="outline-primary" 
                  onClick={() => navigate('/')}
                  className="d-flex align-items-center gap-2 mx-auto"
                >
                  <FaArrowLeft /> Volver al inicio
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container>
      <Row className="justify-content-center">
        <Col lg={10}>
          {/* Header */}
          <Row className="mb-4">
            <Col>
              <div className="d-flex align-items-center gap-3 mb-3">
                <Button 
                  variant="outline-secondary" 
                  onClick={() => navigate('/')}
                  size="sm"
                  className="d-flex align-items-center gap-2"
                >
                  <FaArrowLeft /> Volver
                </Button>
                <h1 className="mb-0">🏁 Inscripción a Competición</h1>
              </div>
            </Col>
          </Row>

          <Row>
            {/* Información de la competición */}
            <Col lg={4} className="mb-4">
              <Card className="h-100">
                <Card.Header className="bg-primary text-white">
                  <h5 className="mb-0 d-flex align-items-center gap-2">
                    <FaTrophy /> {competition.name}
                  </h5>
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <div className="d-flex align-items-center text-muted mb-2">
                      <FaUsers className="me-2" />
                      <small>Plazas: {competition.signups_count}/{competition.num_slots}</small>
                    </div>
                    <ProgressBar 
                      now={(competition.signups_count / competition.num_slots) * 100} 
                      variant={competition.signups_count >= competition.num_slots ? 'danger' : 'success'}
                      className="mb-2"
                    />
                    {competition.signups_count >= competition.num_slots && (
                      <Badge bg="danger" className="w-100">¡Completo!</Badge>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <div className="d-flex align-items-center text-muted mb-1">
                      <FaCalendar className="me-2" />
                      <small>Creada: {formatDate(competition.created_at)}</small>
                    </div>
                    <div className="d-flex align-items-center text-muted mb-1">
                      <FaTrophy className="me-2" />
                      <small>Rondas: {competition.rounds}</small>
                    </div>
                    {competition.circuit_name && (
                      <div className="d-flex align-items-center text-muted mb-1">
                        <FaFlag className="me-2" />
                        <small>Circuito: {competition.circuit_name}</small>
                      </div>
                    )}
                  </div>

                  {competition.categories && competition.categories.length > 0 && (
                    <div>
                      <h6 className="mb-2">Categorías disponibles:</h6>
                      <div className="d-flex flex-wrap gap-1">
                        {competition.categories.map((category) => (
                          <Badge key={category.id} bg="info" className="me-1 mb-1">
                            {category.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Formulario de inscripción */}
            <Col lg={8}>
              <Card>
                <Card.Header>
                  <h5 className="mb-0">📝 Formulario de Inscripción</h5>
                </Card.Header>
                <Card.Body>
                  {competition.signups_count >= competition.num_slots ? (
                    <Alert variant="warning">
                      <FaExclamationTriangle className="me-2" />
                      <strong>¡Competición completa!</strong> No hay plazas disponibles en este momento.
                    </Alert>
                  ) : (
                    <Form onSubmit={handleSubmit} disabled={status && status.times_registered > 0}>
                      {submitError && (
                        <Alert variant="danger" className="mb-3">
                          {submitError}
                        </Alert>
                      )}

                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Nombre completo *</Form.Label>
                            <Form.Control
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              placeholder="Tu nombre completo"
                              required
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Email *</Form.Label>
                            <Form.Control
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({...formData, email: e.target.value})}
                              placeholder="tu@email.com"
                              required
                            />
                          </Form.Group>
                        </Col>
                      </Row>

                      {competition.categories && competition.categories.length > 0 ? (
                        <Form.Group className="mb-3">
                          <Form.Label>Categoría *</Form.Label>
                          <Form.Select
                            value={formData.category_id}
                            onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                            required
                          >
                            <option value="">Selecciona una categoría</option>
                            {competition.categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Form.Select>
                          <Form.Text className="text-muted">
                            Selecciona la categoría en la que quieres competir
                          </Form.Text>
                        </Form.Group>
                      ) : (
                        <Alert variant="warning" className="mb-3">
                          <FaExclamationTriangle className="me-2" />
                          <strong>No hay categorías disponibles</strong> para esta competición. 
                          Contacta al organizador para más información.
                        </Alert>
                      )}

                      <Form.Group className="mb-4">
                        <Form.Label>Vehículo con el que competirás *</Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.vehicle}
                          onChange={(e) => setFormData({...formData, vehicle: e.target.value})}
                          placeholder="Ej: Scalextric Ferrari F1, Carrera Porsche 911..."
                          required
                        />
                        <Form.Text className="text-muted">
                          Especifica el modelo y marca de tu vehículo
                        </Form.Text>
                      </Form.Group>

                      <div className="d-grid">
                        <Button 
                          type="submit" 
                          variant="primary" 
                          size="lg"
                          disabled={submitting || (status && status.times_registered > 0)}
                          className="d-flex align-items-center justify-content-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <Spinner animation="border" size="sm" />
                              Enviando inscripción...
                            </>
                          ) : (status && status.times_registered > 0) ? (
                            <>
                              <FaExclamationTriangle /> Ya no es posible inscribirse porque la competición ha comenzado.
                            </>
                          ) : (
                            <>
                              <FaCheckCircle /> Enviar Inscripción
                            </>
                          )}
                        </Button>
                      </div>

                      {status && status.times_registered > 0 && (
                        <Alert variant="warning" className="mt-3">
                          Ya no es posible inscribirse porque la competición ha comenzado.
                        </Alert>
                      )}
                    </Form>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* Modal de éxito */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-success">
            <FaCheckCircle className="me-2" />
            ¡Inscripción enviada!
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Tu inscripción ha sido enviada correctamente. El organizador de la competición revisará tu solicitud y te contactará si es necesario.</p>
          <p className="text-muted mb-0">
            <strong>Competición:</strong> {competition.name}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSuccessModal(false)}>
            Cerrar
          </Button>
          <Button variant="primary" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default CompetitionSignup; 