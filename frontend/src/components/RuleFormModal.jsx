import React, { useState, useEffect } from 'react';
import { 
  Modal, Form, Button, Alert, Row, Col, InputGroup, Spinner
} from 'react-bootstrap';
import { 
  FaTrophy, FaPlus, FaTrash, FaSave, FaTimes
} from 'react-icons/fa';
import axios from '../lib/axios';

const RuleFormModal = ({ 
  show, 
  onHide, 
  rule, 
  competitionId, 
  onSave, 
  disabled = false 
}) => {
  const [formData, setFormData] = useState({
    rule_type: 'per_round',
    description: '',
    points_structure: {
      "1": 10,
      "2": 8,
      "3": 6,
      "4": 4,
      "5": 2
    },
    use_bonus_best_lap: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (show) {
      if (rule) {
        // Editar regla existente
        setFormData({
          rule_type: rule.rule_type,
          description: rule.description || '',
          points_structure: rule.points_structure,
          use_bonus_best_lap: rule.use_bonus_best_lap || false
        });
      } else {
        // Crear nueva regla
        setFormData({
          rule_type: 'per_round',
          description: '',
          points_structure: {
            "1": 10,
            "2": 8,
            "3": 6,
            "4": 4,
            "5": 2
          },
          use_bonus_best_lap: false
        });
      }
      setError(null);
    }
  }, [show, rule]);

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
    setError('');
    setSaving(true);

    try {
      // Validaciones
      if (!formData.rule_type) {
        setError('Debes seleccionar un tipo de regla');
        return;
      }

      if (!formData.description?.trim()) {
        setError('Debes especificar una descripción');
        return;
      }

      if (formData.rule_type === 'per_round' || formData.rule_type === 'final') {
        if (!formData.points_structure || Object.keys(formData.points_structure).length === 0) {
          setError('Debes especificar al menos una posición con puntos');
          return;
        }
      }

      const ruleData = {
        ...formData,
        competition_id: rule ? undefined : competitionId,
        is_template: false
      };
      
      if (rule) {
        // Actualizar regla existente
        await axios.put(`/competition-rules/${rule.id}`, ruleData);
      } else {
        // Crear nueva regla
        await axios.post(`/competition-rules`, ruleData);
      }
      
      onHide();
      if (onSave) {
        onSave();
      }
    } catch (err) {
      console.error('Error al guardar regla:', err);
      setError(err.response?.data?.error || 'Error al guardar la regla');
    } finally {
      setSaving(false);
    }
  };

  // Obtener descripción del tipo de regla
  const getRuleTypeDescription = (type) => {
    switch (type) {
      case 'per_round':
        return 'Por ronda';
      case 'final':
        return 'Final';
      default:
        return type;
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FaTrophy className="me-2" />
          {rule ? 'Editar Regla' : 'Nueva Regla de Puntuación'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
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
                  disabled={disabled}
                >
                  <option value="per_round">Por ronda</option>
                  <option value="final">Final</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  {formData.rule_type === 'per_round' 
                    ? 'Los puntos se asignan en cada ronda individual'
                    : 'Los puntos se asignan al final de la competición'
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
                  disabled={disabled}
                />
              </Form.Group>
            </Col>
          </Row>

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
                  disabled={disabled}
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
                          disabled={disabled}
                        />
                        <Button
                          variant="outline-danger"
                          onClick={() => removePosition(position)}
                          disabled={disabled || Object.keys(formData.points_structure).length === 1}
                        >
                          <FaTrash />
                        </Button>
                      </InputGroup>
                    </Col>
                  ))}
              </Row>
            </div>
          </Form.Group>

          {formData.rule_type === 'per_round' && (
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Aplicar bonus por mejor vuelta de la ronda"
                checked={formData.use_bonus_best_lap}
                onChange={(e) => setFormData({ ...formData, use_bonus_best_lap: e.target.checked })}
                disabled={disabled}
              />
              <Form.Text className="text-muted">
                Si está activado, el participante con la mejor vuelta de cada ronda recibirá 1 punto adicional.
              </Form.Text>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={saving}>
            <FaTimes className="me-2" />
            Cancelar
          </Button>
          <Button 
            type="submit" 
            variant="primary"
            disabled={saving || disabled}
            className="d-flex align-items-center gap-2"
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" />
                Guardando...
              </>
            ) : (
              <>
                <FaSave /> {rule ? 'Actualizar' : 'Crear'}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default RuleFormModal; 