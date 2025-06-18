import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Badge, Modal, Form, Alert, ListGroup, ListGroupItem,
  Spinner, Row, Col, InputGroup 
} from 'react-bootstrap';
import { 
  FaTrophy, FaPlus, FaEdit, FaTrash, FaExclamationTriangle, FaCog
} from 'react-icons/fa';
import axios from '../lib/axios';

const CompetitionRules = ({ competitionId, onRuleChange }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  // Estados para el modal
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    rule_type: 'per_round',
    description: '',
    points_structure: {
      "1": 10,
      "2": 8,
      "3": 6,
      "4": 5,
      "5": 4
    }
  });

  // Añadir lógica para deshabilitar el botón de nueva regla si hay tiempos registrados
  const [competition, setCompetition] = useState(null);
  const [timesRegistered, setTimesRegistered] = useState(0);
  useEffect(() => {
    if (competitionId) {
      axios.get(`/competitions/${competitionId}`).then(res => setCompetition(res.data)).catch(() => {});
      axios.get(`/competitions/${competitionId}/progress`).then(res => setTimesRegistered(res.data.times_registered || 0)).catch(() => setTimesRegistered(0));
    }
  }, [competitionId]);

  // Cargar reglas
  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}/rules`);
      setRules(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar reglas:', err);
      setError('Error al cargar las reglas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [competitionId]);

  // Abrir modal para crear/editar
  const openModal = (rule = null) => {
    setEditingRule(rule);
    if (rule) {
      setFormData({
        rule_type: rule.rule_type,
        description: rule.description || '',
        points_structure: rule.points_structure
      });
    } else {
      setFormData({
        rule_type: 'per_round',
        description: '',
        points_structure: {
          "1": 10,
          "2": 8,
          "3": 6,
          "4": 5,
          "5": 4
        }
      });
    }
    setShowModal(true);
    setSaveError(null);
  };

  // Actualizar estructura de puntos
  const updatePointsStructure = (position, points) => {
    const newStructure = { ...formData.points_structure };
    if (points === '' || points === null) {
      delete newStructure[position];
    } else {
      newStructure[position] = parseInt(points) || 0;
    }
    setFormData({ ...formData, points_structure: newStructure });
  };

  // Añadir nueva posición
  const addPosition = () => {
    const positions = Object.keys(formData.points_structure).map(Number);
    const nextPosition = positions.length > 0 ? Math.max(...positions) + 1 : 1;
    setFormData({
      ...formData,
      points_structure: {
        ...formData.points_structure,
        [nextPosition]: 0
      }
    });
  };

  // Eliminar posición
  const removePosition = (position) => {
    const newStructure = { ...formData.points_structure };
    delete newStructure[position];
    setFormData({ ...formData, points_structure: newStructure });
  };

  // Guardar regla
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.rule_type) {
      setSaveError('El tipo de regla es requerido');
      return;
    }

    if (Object.keys(formData.points_structure).length === 0) {
      setSaveError('Debes definir al menos una posición con puntos');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      
      if (editingRule) {
        // Actualizar regla existente
        await axios.put(`/competitions/${competitionId}/rules/${editingRule.id}`, formData);
      } else {
        // Crear nueva regla
        await axios.post(`/competitions/${competitionId}/rules`, formData);
      }
      
      setShowModal(false);
      setEditingRule(null);
      setFormData({
        rule_type: 'per_round',
        description: '',
        points_structure: { "1": 10, "2": 8, "3": 6, "4": 5, "5": 4 }
      });
      
      // Recargar reglas y notificar al componente padre
      loadRules();
      if (onRuleChange) {
        onRuleChange();
      }
    } catch (err) {
      console.error('Error al guardar regla:', err);
      setSaveError(err.response?.data?.error || 'Error al guardar la regla');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar regla
  const handleDelete = async (ruleId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta regla? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await axios.delete(`/competitions/${competitionId}/rules/${ruleId}`);
      loadRules();
      if (onRuleChange) {
        onRuleChange();
      }
    } catch (err) {
      console.error('Error al eliminar regla:', err);
      alert('Error al eliminar la regla');
    }
  };

  // Obtener descripción del tipo de regla
  const getRuleTypeDescription = (type) => {
    switch (type) {
      case 'per_round':
        return 'Por ronda';
      case 'final':
        return 'Final';
      case 'best_time_per_round':
        return 'Mejor tiempo por ronda';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <Card.Header>
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <FaTrophy /> Reglas de Puntuación
          </h6>
        </Card.Header>
        <Card.Body className="text-center py-4">
          <Spinner animation="border" size="sm">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
          <p className="mt-2 mb-0">Cargando reglas...</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0 d-flex align-items-center gap-2">
            <FaTrophy /> Reglas de Puntuación ({rules.length})
          </h6>
          <Button
            variant="primary"
            className="mb-3"
            onClick={() => openModal()}
            disabled={timesRegistered > 0}
          >
            <FaPlus /> Nueva Regla
          </Button>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {rules.length === 0 ? (
            <div className="text-center py-4">
              <FaTrophy size={32} className="text-muted mb-3" />
              <p className="text-muted mb-3">No hay reglas de puntuación definidas</p>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => openModal()}
                className="d-flex align-items-center gap-1 mx-auto"
              >
                <FaPlus /> Crear Primera Regla
              </Button>
            </div>
          ) : (
            <ListGroup variant="flush">
              {rules.map((rule) => (
                <ListGroupItem key={rule.id} className="px-0">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <Badge bg="primary" className="me-2">
                        {getRuleTypeDescription(rule.rule_type)}
                      </Badge>
                      {rule.description && (
                        <span className="text-muted">{rule.description}</span>
                      )}
                    </div>
                    <div className="d-flex gap-1">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => openModal(rule)}
                        className="d-flex align-items-center gap-1"
                        disabled={timesRegistered > 0}
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                        className="d-flex align-items-center gap-1"
                        disabled={timesRegistered > 0}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-1">
                    {Object.entries(rule.points_structure)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([position, points]) => (
                        <Badge key={position} bg="success" className="me-1">
                          {position}º: {points} pts
                        </Badge>
                      ))}
                  </div>
                </ListGroupItem>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {/* Modal para crear/editar regla */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrophy className="me-2" />
            {editingRule ? 'Editar Regla' : 'Nueva Regla de Puntuación'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
          <Modal.Body>
            {saveError && (
              <Alert variant="danger" className="mb-3">
                {saveError}
              </Alert>
            )}

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tipo de regla *</Form.Label>
                  <Form.Select
                    value={formData.rule_type}
                    onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                    required
                  >
                    <option value="per_round">Por ronda</option>
                    <option value="final">Final</option>
                    <option value="best_time_per_round">Mejor tiempo por ronda</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {formData.rule_type === 'per_round' 
                      ? 'Los puntos se asignan en cada ronda individual'
                      : formData.rule_type === 'final'
                        ? 'Los puntos se asignan solo al final de la competición'
                        : 'Los puntos se asignan al mejor tiempo de cada ronda'
                    }
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Descripción (opcional)</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ej: Puntuación estándar F1"
                  />
                </Form.Group>
              </Col>
            </Row>

            {formData.rule_type === 'best_time_per_round' ? (
              <Form.Group className="mb-3">
                <Form.Label>Puntos extra para el mejor tiempo global de cada ronda *</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={formData.points_structure?.points || ''}
                  onChange={e => setFormData({
                    ...formData,
                    points_structure: { points: parseInt(e.target.value) || 0 }
                  })}
                  required
                />
                <Form.Text className="text-muted">
                  El participante con el mejor tiempo global de cada ronda recibirá estos puntos adicionales.
                </Form.Text>
              </Form.Group>
            ) : (
            <Form.Group className="mb-3">
              <Form.Label>Estructura de puntos *</Form.Label>
              <div className="border rounded p-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted">Define los puntos para cada posición</span>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={addPosition}
                    className="d-flex align-items-center gap-1"
                  >
                    <FaPlus /> Añadir posición
                  </Button>
                </div>
                
                <Row>
                  {Object.entries(formData.points_structure)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([position, points]) => (
                      <Col key={position} md={4} className="mb-2">
                        <InputGroup size="sm">
                          <InputGroup.Text>{position}º</InputGroup.Text>
                          <Form.Control
                            type="number"
                            value={points}
                            onChange={(e) => updatePointsStructure(position, e.target.value)}
                            min="0"
                            placeholder="Puntos"
                          />
                          <Button
                            variant="outline-danger"
                            onClick={() => removePosition(position)}
                            disabled={Object.keys(formData.points_structure).length === 1}
                          >
                            <FaTrash />
                          </Button>
                        </InputGroup>
                      </Col>
                    ))}
                </Row>
              </div>
            </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={saving || (competition && competition.times_registered > 0)}
              className="d-flex align-items-center gap-2"
            >
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" />
                  Guardando...
                </>
              ) : (
                <>
                  <FaPlus /> {editingRule ? 'Actualizar' : 'Crear'}
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default CompetitionRules; 