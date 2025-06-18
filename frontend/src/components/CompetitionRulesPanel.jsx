import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Badge, Alert, ListGroup, ListGroupItem,
  Spinner, Row, Col, Offcanvas
} from 'react-bootstrap';
import { 
  FaTrophy, FaPlus, FaEdit, FaTrash, FaExclamationTriangle, 
  FaCog, FaCopy, FaList, FaMagic
} from 'react-icons/fa';
import axios from '../lib/axios';
import RuleFormModal from './RuleFormModal';
import TemplatesDrawer from './TemplatesDrawer';

const CompetitionRulesPanel = ({ competitionId, onRuleChange }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para modales y drawers
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  
  // Añadir lógica para deshabilitar el botón de nueva regla si hay tiempos registrados
  const [competition, setCompetition] = useState(null);
  const [timesRegistered, setTimesRegistered] = useState(0);

  useEffect(() => {
    if (competitionId) {
      axios.get(`/competitions/${competitionId}`).then(res => setCompetition(res.data)).catch(() => {});
      axios.get(`/competitions/${competitionId}/progress`).then(res => setTimesRegistered(res.data.times_registered || 0)).catch(() => setTimesRegistered(0));
    }
  }, [competitionId]);

  // Cargar reglas de la competición
  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competition-rules/competition/${competitionId}`);
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

  // Abrir modal para crear/editar regla
  const openRuleModal = (rule = null) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  // Abrir drawer de plantillas
  const openTemplatesDrawer = () => {
    setShowTemplatesDrawer(true);
  };

  // Eliminar regla
  const handleDelete = async (ruleId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta regla? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await axios.delete(`/competition-rules/${ruleId}`);
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
      default:
        return type;
    }
  };

  // Obtener color del badge según el tipo
  const getRuleTypeColor = (type) => {
    switch (type) {
      case 'per_round':
        return 'primary';
      case 'final':
        return 'success';
      case 'best_time_per_round':
        return 'warning';
      default:
        return 'secondary';
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
          <div className="d-flex gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={openTemplatesDrawer}
              disabled={timesRegistered > 0}
              className="d-flex align-items-center gap-1"
            >
              <FaMagic /> Aplicar Plantilla
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openRuleModal()}
              disabled={timesRegistered > 0}
              className="d-flex align-items-center gap-1"
            >
              <FaPlus /> Nueva Regla
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {timesRegistered > 0 && (
            <Alert variant="warning" className="mb-3">
              <FaExclamationTriangle className="me-2" />
              No se pueden modificar las reglas porque ya hay tiempos registrados en la competición.
            </Alert>
          )}

          {rules.length === 0 ? (
            <div className="text-center py-4">
              <FaTrophy size={32} className="text-muted mb-3" />
              <p className="text-muted mb-3">No hay reglas de puntuación definidas</p>
              <div className="d-flex gap-2 justify-content-center">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={openTemplatesDrawer}
                  className="d-flex align-items-center gap-1"
                >
                  <FaMagic /> Aplicar Plantilla
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openRuleModal()}
                  className="d-flex align-items-center gap-1"
                >
                  <FaPlus /> Crear Primera Regla
                </Button>
              </div>
            </div>
          ) : (
            <ListGroup variant="flush">
              {rules.map((rule) => (
                <ListGroupItem key={rule.id} className="px-0">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <Badge bg={getRuleTypeColor(rule.rule_type)}>
                          {getRuleTypeDescription(rule.rule_type)}
                        </Badge>
                        {rule.use_bonus_best_lap && (
                          <Badge bg="info" className="d-flex align-items-center gap-1">
                            <FaCog size={10} /> Bonus
                          </Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-muted mb-1 small">{rule.description}</p>
                      )}
                    </div>
                    <div className="d-flex gap-1">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => openRuleModal(rule)}
                        className="d-flex align-items-center gap-1"
                        disabled={timesRegistered > 0}
                        title="Editar regla"
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                        className="d-flex align-items-center gap-1"
                        disabled={timesRegistered > 0}
                        title="Eliminar regla"
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-1">
                    {rule.rule_type === 'best_time_per_round' ? (
                      <Badge bg="success" className="me-1">
                        {rule.points_structure.points} pts por mejor vuelta
                      </Badge>
                    ) : (
                      Object.entries(rule.points_structure)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([position, points]) => (
                          <Badge key={position} bg="success" className="me-1">
                            {position}º: {points} pts
                          </Badge>
                        ))
                    )}
                  </div>
                </ListGroupItem>
              ))}
            </ListGroup>
          )}
        </Card.Body>
      </Card>

      {/* Modal para crear/editar regla */}
      <RuleFormModal
        show={showRuleModal}
        onHide={() => setShowRuleModal(false)}
        rule={editingRule}
        competitionId={competitionId}
        onSave={() => {
          loadRules();
          if (onRuleChange) onRuleChange();
        }}
        disabled={timesRegistered > 0}
      />

      {/* Drawer de plantillas */}
      <TemplatesDrawer
        show={showTemplatesDrawer}
        onHide={() => setShowTemplatesDrawer(false)}
        competitionId={competitionId}
        onTemplateApplied={() => {
          loadRules();
          if (onRuleChange) onRuleChange();
        }}
        disabled={timesRegistered > 0}
      />
    </>
  );
};

export default CompetitionRulesPanel; 