import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Button, Badge, Modal, Form, Alert, 
  ListGroup, ListGroupItem, Tab, Tabs, Image, ProgressBar, Table 
} from 'react-bootstrap';
import { 
  FaPlus, FaUsers, FaCar, FaUser, FaTrash, FaEdit, FaArrowLeft,
  FaCheck, FaTimes, FaTrophy, FaExclamationTriangle, FaClock,
  FaTags, FaCog, FaLink
} from 'react-icons/fa';
import axios from '../lib/axios';
import CompetitionSignups from '../components/CompetitionSignups';
import CompetitionCategories from '../components/CompetitionCategories';
import CompetitionRulesPanel from '../components/CompetitionRulesPanel';

const CompetitionParticipants = () => {
  const { id: competitionId } = useParams();
  const navigate = useNavigate();
  
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('participants');
  
  // Estados para el modal de añadir participante
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    vehicle_id: '',
    driver_name: '',
    vehicle_model: '',
    category_id: ''
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [participantType, setParticipantType] = useState('own'); // 'own' o 'external'

  // Estados para el modal de editar participante
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editForm, setEditForm] = useState({
    vehicle_id: '',
    driver_name: '',
    vehicle_model: '',
    category_id: ''
  });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState(null);

  const [timesRegistered, setTimesRegistered] = useState(0);

  // Cargar datos de la competición
  const loadCompetition = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}`);
      setCompetition(response.data);
      setParticipants(response.data.participants || []);
      setError(null);
    } catch (err) {
      console.error('Error al cargar competición:', err);
      setError('Error al cargar la competición');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  // Cargar vehículos del usuario
  const loadVehicles = useCallback(async () => {
    try {
      const response = await axios.get('/competitions/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Error al cargar vehículos:', err);
    }
  }, []);

  // Cargar número de tiempos registrados
  const loadTimesRegistered = useCallback(async () => {
    try {
      const response = await axios.get(`/competitions/${competitionId}/progress`);
      setTimesRegistered(response.data.times_registered || 0);
    } catch (err) {
      setTimesRegistered(0);
    }
  }, [competitionId]);

  useEffect(() => {
    loadCompetition();
    loadVehicles();
    loadTimesRegistered();
  }, [loadCompetition, loadVehicles, loadTimesRegistered]);

  // Manejar añadir participante
  const handleAddParticipant = useCallback(async (e) => {
    e.preventDefault();
    
    if (!addForm.driver_name.trim()) {
      setAddError('El nombre del piloto es requerido');
      return;
    }

    if (!addForm.category_id) {
      setAddError('Debes seleccionar una categoría');
      return;
    }

    if (participantType === 'own' && !addForm.vehicle_id) {
      setAddError('Debes seleccionar un vehículo');
      return;
    }

    if (participantType === 'external' && !addForm.vehicle_model.trim()) {
      setAddError('Debes especificar el modelo del vehículo');
      return;
    }

    try {
      setAdding(true);
      setAddError(null);
      
      const participantData = {
        driver_name: addForm.driver_name.trim(),
        category_id: addForm.category_id
      };

      if (participantType === 'own') {
        participantData.vehicle_id = addForm.vehicle_id;
      } else {
        participantData.vehicle_model = addForm.vehicle_model.trim();
      }

      await axios.post(`/competitions/${competitionId}/participants`, participantData);
      
      setShowAddModal(false);
      setAddForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
      setParticipantType('own');
      loadCompetition(); // Recargar datos
    } catch (err) {
      console.error('Error al añadir participante:', err);
      setAddError(err.response?.data?.error || 'Error al añadir el participante');
    } finally {
      setAdding(false);
    }
  }, [addForm, participantType, competitionId, loadCompetition]);

  // Manejar editar participante
  const handleEditParticipant = useCallback(async (e) => {
    e.preventDefault();
    
    if (!editForm.driver_name.trim()) {
      setEditError('El nombre del piloto es requerido');
      return;
    }

    if (!editForm.category_id) {
      setEditError('Debes seleccionar una categoría');
      return;
    }

    try {
      setEditing(true);
      setEditError(null);
      
      const participantData = {
        driver_name: editForm.driver_name.trim(),
        category_id: editForm.category_id
      };

      if (editForm.vehicle_id) {
        participantData.vehicle_id = editForm.vehicle_id;
      } else if (editForm.vehicle_model) {
        participantData.vehicle_model = editForm.vehicle_model.trim();
      }

      await axios.put(`/competitions/${competitionId}/participants/${editingParticipant.id}`, participantData);
      
      setShowEditModal(false);
      setEditingParticipant(null);
      setEditForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
      loadCompetition(); // Recargar datos
    } catch (err) {
      console.error('Error al editar participante:', err);
      setEditError(err.response?.data?.error || 'Error al editar el participante');
    } finally {
      setEditing(false);
    }
  }, [editForm, editingParticipant, competitionId, loadCompetition]);

  // Abrir modal de edición
  const openEditModal = useCallback((participant) => {
    setEditingParticipant(participant);
    setEditForm({
      vehicle_id: participant.vehicle_id || '',
      driver_name: participant.driver_name,
      vehicle_model: participant.vehicle_model || '',
      category_id: participant.category_id || ''
    });
    setShowEditModal(true);
  }, []);

  // Manejar eliminación de participante
  const handleDeleteParticipant = useCallback(async (participantId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este participante?')) {
      return;
    }

    try {
      await axios.delete(`/competitions/${competitionId}/participants/${participantId}`);
      loadCompetition(); // Recargar datos
    } catch (err) {
      console.error('Error al eliminar participante:', err);
      alert('Error al eliminar el participante');
    }
  }, [competitionId, loadCompetition]);

  // Obtener información del vehículo
  const getVehicleInfo = useCallback((participant) => {
    if (participant.vehicle_id && participant.vehicles) {
      return {
        model: participant.vehicles.model,
        manufacturer: participant.vehicles.manufacturer,
        type: 'own'
      };
    } else if (participant.vehicle_model) {
      return {
        model: participant.vehicle_model,
        manufacturer: 'Externo',
        type: 'external'
      };
    }
    return null;
  }, []);

  // Obtener nombre de la categoría
  const getCategoryName = useCallback((categoryId) => {
    if (!competition?.categories) return 'Sin categoría';
    const category = competition.categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Sin categoría';
  }, [competition?.categories]);

  // Generar enlace público
  const generatePublicLink = () => {
    // Solo mostrar enlace público si hay public_slug Y hay categorías configuradas
    if (competition?.public_slug && competition.categories && competition.categories.length > 0) {
      return `${window.location.origin}/competitions/signup/${competition.public_slug}`;
    }
    return null;
  };

  // Generar enlace público del estado
  const generateStatusLink = () => {
    if (competition?.public_slug) {
      return `${window.location.origin}/competitions/status/${competition.public_slug}`;
    }
    return null;
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

  if (error) {
    return (
      <Container>
        <Alert variant="danger">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!competition) {
    return (
      <Container>
        <Alert variant="warning">
          Competición no encontrada
        </Alert>
      </Container>
    );
  }

  const isFull = participants.length >= competition.num_slots;
  const canStartCompetition = participants.length > 0; // Al menos 1 participante
  const publicLink = generatePublicLink();
  const statusLink = generateStatusLink();

  return (
    <Container>
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center mb-3">
            <Button
              variant="outline-secondary" 
              onClick={() => navigate('/competitions')}
              className="me-3"
            >
              <FaArrowLeft /> Volver
            </Button>
            <div className="flex-grow-1">
              <h1 className="mb-1">🏁 {competition.name}</h1>
              <p className="text-muted mb-0">Gestionar competición</p>
            </div>
            <div className="d-flex gap-2">
              {publicLink && (
                <Button
                  variant="outline-info"
                  onClick={() => {
                    navigator.clipboard.writeText(publicLink);
                    alert('Enlace copiado al portapapeles');
                  }}
                  className="d-flex align-items-center gap-1"
                  title="Copiar enlace de inscripción pública"
                >
                  <FaLink /> Formulario de inscripción
                </Button>
              )}
              
              <Button
                variant="info"
                onClick={() => navigate(`/competitions/${competitionId}/timings`)}
                className="d-flex align-items-center gap-1"
                disabled={!canStartCompetition}
                title={!canStartCompetition ? 'Necesitas al menos un participante para gestionar tiempos' : 'Gestionar tiempos de la competición'}
              >
                <FaClock /> Gestionar Tiempos
                {!canStartCompetition && (
                  <Badge bg="warning" text="dark" className="ms-1">
                    Sin participantes
                  </Badge>
                )}
                {canStartCompetition && !isFull && (
                  <Badge bg="info" text="dark" className="ms-1">
                    {participants.length} participantes
                  </Badge>
                )}
                {isFull && (
                  <Badge bg="success" text="dark" className="ms-1">
                    Completa
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Información de la competición */}
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Body>
              <Row>
                <Col md={3}>
                  <div className="d-flex align-items-center mb-2">
                    <FaUsers className="me-2 text-primary" />
                    <strong>Participantes:</strong>
                    <Badge 
                      bg={isFull ? 'success' : participants.length > 0 ? 'primary' : 'secondary'} 
                      className="ms-2"
                    >
                      {participants.length}/{competition.num_slots}
                    </Badge>
                  </div>
                  <ProgressBar 
                    now={(participants.length / competition.num_slots) * 100} 
                    className="mb-2"
                  />
                  {isFull && (
                    <div className="d-flex align-items-center text-success">
                      <FaCheck className="me-2" />
                      <small>Competición completa</small>
                    </div>
                  )}
                  {participants.length > 0 && !isFull && (
                    <div className="d-flex align-items-center text-info">
                      <FaClock className="me-2" />
                      <small>Lista para comenzar</small>
                    </div>
                  )}
                  {participants.length === 0 && (
                    <div className="d-flex align-items-center text-muted">
                      <FaExclamationTriangle className="me-2" />
                      <small>Sin participantes</small>
                    </div>
                  )}
                </Col>
                <Col md={3}>
                  <div className="d-flex align-items-center mb-2">
                    <FaTrophy className="me-2 text-warning" />
                    <strong>Estado:</strong>
                    <Badge 
                      bg={isFull ? 'success' : participants.length > 0 ? 'info' : 'secondary'} 
                      className="ms-2"
                    >
                      {isFull ? 'Completa' : participants.length > 0 ? 'Lista' : 'Vacía'}
                    </Badge>
                  </div>
                  {!isFull && participants.length > 0 && (
                    <div className="d-flex align-items-center text-muted">
                      <FaExclamationTriangle className="me-2" />
                      <small>Puedes comenzar con {participants.length} participantes</small>
                    </div>
                  )}
                  {participants.length === 0 && (
                    <div className="d-flex align-items-center text-muted">
                      <FaExclamationTriangle className="me-2" />
                      <small>Añade al menos un participante</small>
                    </div>
                  )}
                </Col>
                <Col md={3}>
                  <div className="d-flex align-items-center mb-2">
                    <FaTrophy className="me-2 text-info" />
                    <strong>Rondas:</strong>
                    <Badge bg="info" className="ms-2">
                      {competition.rounds}
                    </Badge>
                  </div>
                  <div className="d-flex align-items-center text-muted">
                    <small>Total de tiempos: {participants.length * competition.rounds}</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="d-flex align-items-center mb-2">
                    <FaLink className="me-2 text-success" />
                    <strong>Enlace público:</strong>
                  </div>
                  {publicLink ? (
                    <div className="d-flex align-items-center">
                      <span
                        className="text-primary fw-bold text-break"
                        style={{ cursor: 'pointer', userSelect: 'all' }}
                        onClick={() => { navigator.clipboard.writeText(statusLink); alert('Enlace copiado al portapapeles'); }}
                        title="Haz clic para copiar el enlace"
                      >
                        {statusLink}
                      </span>
                    </div>
                  ) : !competition.public_slug ? (
                    <div className="d-flex align-items-center text-muted">
                      <FaTimes className="me-2" />
                      <small>No disponible</small>
                    </div>
                  ) : !competition.categories || competition.categories.length === 0 ? (
                    <div className="d-flex align-items-center text-warning">
                      <FaExclamationTriangle className="me-2" />
                      <small>Sin categorías</small>
                    </div>
                  ) : (
                    <div className="d-flex align-items-center text-muted">
                      <FaTimes className="me-2" />
                      <small>No disponible</small>
                    </div>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Pestañas */}
      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
        <Tab eventKey="participants" title={
          <span className="d-flex align-items-center gap-1">
            <FaUsers /> Participantes ({participants.length})
          </span>
        }>
          <Row className="mb-3">
            <Col>
              <div className="d-flex justify-content-between align-items-center">
                <h5>Participantes Confirmados</h5>
                <Button
                  variant="primary"
                  className="d-flex align-items-center gap-2"
                  onClick={() => setShowAddModal(true)}
                  disabled={!competition.categories || competition.categories.length === 0}
                >
                  <FaPlus /> Añadir Participante
                </Button>
              </div>
            </Col>
          </Row>

          {/* Lista de participantes */}
          {participants.length === 0 ? (
            <Card className="text-center py-5">
              <Card.Body>
                <FaUsers size={48} className="text-muted mb-3" />
                <h4>No hay participantes</h4>
                <p className="text-muted mb-4">
                  Añade el primer participante para empezar
                </p>
                <Button 
                  variant="primary" 
                  onClick={() => setShowAddModal(true)}
                  className="d-flex align-items-center gap-2 mx-auto"
                >
                  <FaPlus /> Añadir Primer Participante
                </Button>
              </Card.Body>
            </Card>
          ) : (
            <Table responsive bordered hover>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Piloto</th>
                  <th>Categoría</th>
                  <th>Vehículo</th>
                  {competition && competition.rules && competition.rules.length > 0 && <th>Puntos</th>}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant, idx) => (
                  <tr key={participant.id}>
                    <td>{idx + 1}</td>
                    <td>{participant.driver_name}</td>
                    <td>
                      <Badge bg="info" className="d-flex align-items-center gap-1">
                        <FaTags size={10} />
                        {getCategoryName(participant.category_id)}
                      </Badge>
                    </td>
                    <td>{getVehicleInfo(participant).manufacturer} {getVehicleInfo(participant).model}</td>
                    {competition && competition.rules && competition.rules.length > 0 && <td>{participant.points || 0}</td>}
                    <td>
                          <div className="d-flex gap-1">
                            <Button 
                              variant="outline-primary" 
                              size="sm"
                              onClick={() => openEditModal(participant)}
                            >
                              <FaEdit />
                            </Button>
                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              onClick={() => handleDeleteParticipant(participant.id)}
                            >
                              <FaTrash />
                            </Button>
                          </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>

        <Tab eventKey="signups" title={
          <span className="d-flex align-items-center gap-1">
            <FaUsers /> Inscripciones ({competition?.signups_count || 0})
          </span>
        }>
          <CompetitionSignups 
            competitionId={competitionId} 
            onSignupApproved={loadCompetition}
          />
        </Tab>

        <Tab eventKey="categories" title={
          <span className="d-flex align-items-center gap-1">
            <FaTags /> Categorías ({competition?.categories?.length || 0})
          </span>
        }>
          <CompetitionCategories 
            competitionId={competitionId}
            onCategoryChange={loadCompetition}
          />
        </Tab>

        <Tab eventKey="rules" title={
          <span className="d-flex align-items-center gap-1">
            <FaTrophy /> Reglas
          </span>
        }>
          <CompetitionRulesPanel 
            competitionId={competitionId}
            onRuleChange={() => {}}
          />
        </Tab>
      </Tabs>

      {/* Modal para añadir participante */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaPlus className="me-2" />
            Añadir Participante
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddParticipant}>
          <Modal.Body>
            {addError && (
              <Alert variant="danger" className="mb-3">
                {addError}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Tipo de participante</Form.Label>
              <div>
                <Form.Check
                  inline
                  type="radio"
                  name="participantType"
                  id="own"
                  label="De mi colección"
                  checked={participantType === 'own'}
                  onChange={() => setParticipantType('own')}
                />
                <Form.Check
                  inline
                  type="radio"
                  name="participantType"
                  id="external"
                  label="Externo"
                  checked={participantType === 'external'}
                  onChange={() => setParticipantType('external')}
                />
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Categoría *</Form.Label>
              <Form.Select
                value={addForm.category_id}
                onChange={e => setAddForm({ ...addForm, category_id: e.target.value })}
                required
              >
                <option value="">Selecciona una categoría</option>
                {competition.categories && competition.categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nombre del piloto *</Form.Label>
              <Form.Control
                type="text"
                value={addForm.driver_name}
                onChange={(e) => setAddForm({...addForm, driver_name: e.target.value})}
                placeholder="Nombre del piloto"
                required
              />
            </Form.Group>

            {participantType === 'own' ? (
              <Form.Group className="mb-3">
                <Form.Label>Vehículo *</Form.Label>
                <Form.Select
                  value={addForm.vehicle_id}
                  onChange={(e) => setAddForm({...addForm, vehicle_id: e.target.value})}
                  required
                >
                  <option value="">Selecciona un vehículo</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.manufacturer} {vehicle.model} ({vehicle.type})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            ) : (
              <Form.Group className="mb-3">
                <Form.Label>Modelo del vehículo *</Form.Label>
                <Form.Control
                  type="text"
                  value={addForm.vehicle_model}
                  onChange={(e) => setAddForm({...addForm, vehicle_model: e.target.value})}
                  placeholder="Ej: Scalextric Ferrari F1, Carrera Porsche 911..."
                  required
                />
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={adding}
              className="d-flex align-items-center gap-2"
            >
              {adding ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  Añadiendo...
                </>
              ) : (
                <>
                  <FaPlus /> Añadir Participante
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal para editar participante */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaEdit className="me-2" />
            Editar Participante
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditParticipant}>
          <Modal.Body>
            {editError && (
              <Alert variant="danger" className="mb-3">
                {editError}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Nombre del piloto *</Form.Label>
              <Form.Control
                type="text"
                value={editForm.driver_name}
                onChange={(e) => setEditForm({...editForm, driver_name: e.target.value})}
                placeholder="Nombre del piloto"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Categoría *</Form.Label>
              <Form.Select
                value={editForm.category_id}
                onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                required
              >
                <option value="">Selecciona una categoría</option>
                {competition.categories && competition.categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Vehículo</Form.Label>
              <Form.Select
                value={editForm.vehicle_id}
                onChange={(e) => setEditForm({...editForm, vehicle_id: e.target.value})}
              >
                <option value="">Selecciona un vehículo</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.manufacturer} {vehicle.model} ({vehicle.type})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>O modelo personalizado</Form.Label>
              <Form.Control
                type="text"
                value={editForm.vehicle_model}
                onChange={(e) => setEditForm({...editForm, vehicle_model: e.target.value})}
                placeholder="Ej: Scalextric Ferrari F1, Carrera Porsche 911..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={editing}
              className="d-flex align-items-center gap-2"
            >
              {editing ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  Guardando...
                </>
              ) : (
                <>
                  <FaEdit /> Guardar Cambios
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default CompetitionParticipants; 