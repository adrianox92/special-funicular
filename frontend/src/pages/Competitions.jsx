import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaUsers, FaCalendar, FaTrophy, FaFlag, FaClock } from 'react-icons/fa';
import axios from '../lib/axios';

const Competitions = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    num_slots: '',
    rounds: '1',
    circuit_name: ''
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const navigate = useNavigate();

  // Cargar competiciones
  const loadCompetitions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/competitions/my-competitions');
      setCompetitions(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar competiciones:', err);
      setError('Error al cargar las competiciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitions();
  }, []);

  // Manejar creación de competición
  const handleCreateCompetition = async (e) => {
    e.preventDefault();
    
    if (!createForm.name.trim() || !createForm.num_slots || !createForm.rounds) {
      setCreateError('Por favor, completa todos los campos');
      return;
    }

    if (createForm.num_slots <= 0) {
      setCreateError('El número de plazas debe ser mayor a 0');
      return;
    }

    if (createForm.rounds <= 0) {
      setCreateError('El número de rondas debe ser mayor a 0');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      
      const response = await axios.post('/competitions', {
        name: createForm.name.trim(),
        num_slots: parseInt(createForm.num_slots),
        rounds: parseInt(createForm.rounds),
        circuit_name: createForm.circuit_name.trim() || null
      });

      setShowCreateModal(false);
      setCreateForm({ name: '', num_slots: '', rounds: '1', circuit_name: '' });
      
      // Redirigir al paso 2 (añadir participantes)
      navigate(`/competitions/${response.data.id}/participants`);
    } catch (err) {
      console.error('Error al crear competición:', err);
      setCreateError(err.response?.data?.error || 'Error al crear la competición');
    } finally {
      setCreating(false);
    }
  };

  // Manejar eliminación de competición
  const handleDeleteCompetition = async (competitionId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta competición? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await axios.delete(`/competitions/${competitionId}`);
      loadCompetitions(); // Recargar la lista
    } catch (err) {
      console.error('Error al eliminar competición:', err);
      alert('Error al eliminar la competición');
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="mb-2">Mis Competiciones</h1>
              <p className="text-muted">Gestiona tus competiciones y participantes</p>
            </div>
            <Button 
              variant="primary" 
              onClick={() => setShowCreateModal(true)}
              className="d-flex align-items-center gap-2 btn-competition"
            >
              <FaPlus /> Nueva Competición
            </Button>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {competitions.length === 0 ? (
        <Card className="text-center py-5">
          <Card.Body>
            <FaTrophy size={48} className="text-muted mb-3" />
            <h4>No tienes competiciones</h4>
            <p className="text-muted mb-4">
              Crea tu primera competición para empezar a gestionar participantes
            </p>
            <Button 
              variant="primary" 
              onClick={() => setShowCreateModal(true)}
              className="d-flex align-items-center gap-2 mx-auto"
            >
              <FaPlus /> Crear Primera Competición
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {competitions.map((competition) => (
            <Col key={competition.id} lg={4} md={6} className="mb-4">
              <Card className="h-100 shadow-sm competition-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h5 className="card-title mb-0">{competition.name}</h5>
                    <Badge 
                      bg={competition.participants_count >= competition.num_slots ? 'success' : 'primary'}
                      className="ms-2 badge-custom"
                    >
                      {competition.participants_count}/{competition.num_slots}
                    </Badge>
                  </div>
                  
                  <div className="mb-3">
                    <div className="d-flex align-items-center text-muted mb-1">
                      <FaUsers className="me-2" />
                      <small>Participantes</small>
                    </div>
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

                  <div className="progress mb-3 competition-progress" style={{ height: '8px' }}>
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${(competition.participants_count / competition.num_slots) * 100}%` 
                      }}
                    />
                  </div>

                  <div className="d-flex gap-2">
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => navigate(`/competitions/${competition.id}/participants`)}
                      className="flex-fill"
                    >
                      Gestionar Participantes
                    </Button>
                    {competition.participants_count > 0 && (
                      <Button 
                        variant="outline-success" 
                        size="sm"
                        onClick={() => navigate(`/competitions/${competition.id}/timings`)}
                        className="flex-fill"
                      >
                        <FaClock /> Tiempos
                        {competition.participants_count < competition.num_slots && (
                          <Badge bg="info" text="dark" className="ms-1">
                            {competition.participants_count}
                          </Badge>
                        )}
                      </Button>
                    )}
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={() => handleDeleteCompetition(competition.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Modal para crear competición */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>🏁 Nueva Competición</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateCompetition}>
          <Modal.Body>
            {createError && (
              <Alert variant="danger" className="mb-3">
                {createError}
              </Alert>
            )}
            
            <Form.Group className="mb-3">
              <Form.Label>Nombre de la Competición</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ej: Copa de Invierno 2024"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Número de Plazas</Form.Label>
              <Form.Control
                type="number"
                min="1"
                max="50"
                placeholder="Ej: 8"
                value={createForm.num_slots}
                onChange={(e) => setCreateForm({ ...createForm, num_slots: e.target.value })}
                required
              />
              <Form.Text className="text-muted">
                Número máximo de participantes permitidos
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Número de Rondas</Form.Label>
              <Form.Control
                type="number"
                min="1"
                max="10"
                placeholder="Ej: 3"
                value={createForm.rounds}
                onChange={(e) => setCreateForm({ ...createForm, rounds: e.target.value })}
                required
              />
              <Form.Text className="text-muted">
                Número máximo de rondas permitidas
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nombre del Circuito</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ej: Circuito de Barcelona"
                value={createForm.circuit_name}
                onChange={(e) => setCreateForm({ ...createForm, circuit_name: e.target.value })}
              />
              <Form.Text className="text-muted">
                Opcional: Nombre del circuito donde se realizará la competición
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              disabled={creating}
              className="d-flex align-items-center gap-2"
            >
              {creating ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Creando...</span>
                  </div>
                  Creando...
                </>
              ) : (
                <>
                  <FaPlus /> Crear Competición
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Competitions; 