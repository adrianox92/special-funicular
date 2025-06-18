import React, { useState, useEffect } from 'react';
import { 
  Offcanvas, Button, Card, Badge, Alert, ListGroup, ListGroupItem,
  Spinner, Row, Col, Form, InputGroup
} from 'react-bootstrap';
import { 
  FaMagic, FaCopy, FaTimes, FaSearch, FaTrophy, FaCog, FaCheck
} from 'react-icons/fa';
import axios from '../lib/axios';

const TemplatesDrawer = ({ 
  show, 
  onHide, 
  competitionId, 
  onTemplateApplied, 
  disabled = false 
}) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Cargar plantillas
  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/competition-rules/templates');
      setTemplates(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar plantillas:', err);
      setError('Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      loadTemplates();
    }
  }, [show]);

  // Aplicar plantilla
  const applyTemplate = async (templateId) => {
    try {
      setApplying(true);
      await axios.post(`/competition-rules/apply-template/${templateId}`, {
        competition_id: competitionId
      });
      
      if (onTemplateApplied) {
        onTemplateApplied();
      }
      onHide();
    } catch (err) {
      console.error('Error al aplicar plantilla:', err);
      alert(err.response?.data?.error || 'Error al aplicar la plantilla');
    } finally {
      setApplying(false);
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

  // Filtrar plantillas por búsqueda
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getRuleTypeDescription(template.rule_type).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" size="lg">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>
          <FaMagic className="me-2" />
          Aplicar Plantilla de Reglas
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        {disabled && (
          <Alert variant="warning" className="mb-3">
            <FaTimes className="me-2" />
            No se pueden aplicar plantillas porque ya hay tiempos registrados en la competición.
          </Alert>
        )}

        {/* Barra de búsqueda */}
        <Form.Group className="mb-3">
          <InputGroup>
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Buscar plantillas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Form.Group>

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm">
              <span className="visually-hidden">Cargando...</span>
            </Spinner>
            <p className="mt-2 mb-0">Cargando plantillas...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-4">
            <FaMagic size={32} className="text-muted mb-3" />
            <p className="text-muted mb-0">
              {searchTerm ? 'No se encontraron plantillas que coincidan con la búsqueda' : 'No hay plantillas disponibles'}
            </p>
          </div>
        ) : (
          <ListGroup variant="flush">
            {filteredTemplates.map((template) => (
              <ListGroupItem key={template.id} className="px-0 mb-3">
                <Card>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="flex-grow-1">
                        <h6 className="mb-1">{template.name}</h6>
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <Badge bg={getRuleTypeColor(template.rule_type)}>
                            {getRuleTypeDescription(template.rule_type)}
                          </Badge>
                          {template.use_bonus_best_lap && (
                            <Badge bg="info" className="d-flex align-items-center gap-1">
                              <FaCog size={10} /> Bonus
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-muted mb-2 small">{template.description}</p>
                        )}
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => applyTemplate(template.id)}
                        disabled={disabled || applying}
                        className="d-flex align-items-center gap-1"
                      >
                        {applying ? (
                          <>
                            <Spinner animation="border" size="sm" />
                            Aplicando...
                          </>
                        ) : (
                          <>
                            <FaCopy /> Aplicar
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <div className="d-flex flex-wrap gap-1">
                      {template.rule_type === 'best_time_per_round' ? (
                        <Badge bg="success" className="me-1">
                          {template.points_structure.points} pts por mejor vuelta
                        </Badge>
                      ) : (
                        Object.entries(template.points_structure)
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .map(([position, points]) => (
                            <Badge key={position} bg="success" className="me-1">
                              {position}º: {points} pts
                            </Badge>
                          ))
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </ListGroupItem>
            ))}
          </ListGroup>
        )}

        <div className="mt-3 p-3 bg-light rounded">
          <h6 className="mb-2">
            <FaTrophy className="me-2" />
            ¿Qué son las plantillas?
          </h6>
          <p className="text-muted small mb-0">
            Las plantillas son sistemas de puntuación predefinidos que puedes aplicar a tu competición. 
            Una vez aplicada, la plantilla se convierte en una regla específica para tu competición y 
            puedes modificarla según tus necesidades.
          </p>
        </div>
      </Offcanvas.Body>
    </Offcanvas>
  );
};

export default TemplatesDrawer; 