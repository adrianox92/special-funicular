import React, { useState, useEffect } from 'react';
import { Card, ListGroup, ListGroupItem, Badge, Button } from 'react-bootstrap';
import { FaTrophy, FaUsers, FaCalendar, FaFlag, FaArrowRight, FaClock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from '../lib/axios';

const RecentCompetitions = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadRecentCompetitions = async () => {
      try {
        const response = await axios.get('/api/competitions/my-competitions');
        // Tomar solo las 5 más recientes
        setCompetitions(response.data.slice(0, 5));
        setError(null);
      } catch (err) {
        console.error('Error al cargar competiciones recientes:', err);
        setError('Error al cargar las competiciones');
      } finally {
        setLoading(false);
      }
    };

    loadRecentCompetitions();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <Card.Header>
          <h6 className="mb-0">
            <FaTrophy className="me-2" />
            Competiciones Recientes
          </h6>
        </Card.Header>
        <Card.Body className="text-center">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Card.Header>
          <h6 className="mb-0">
            <FaTrophy className="me-2" />
            Competiciones Recientes
          </h6>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-0">{error}</p>
        </Card.Body>
      </Card>
    );
  }

  if (competitions.length === 0) {
    return (
      <Card>
        <Card.Header>
          <h6 className="mb-0">
            <FaTrophy className="me-2" />
            Competiciones Recientes
          </h6>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-3">No tienes competiciones creadas</p>
          <div className="small text-muted mb-3">
            <p className="mb-1">💡 <strong>Flujo recomendado:</strong></p>
            <ol className="mb-0">
              <li>Crea una competición</li>
              <li>Añade todos los participantes</li>
              <li>Gestiona los tiempos por ronda</li>
            </ol>
          </div>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => navigate('/competitions')}
          >
            Crear Primera Competición
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <FaTrophy className="me-2" />
          Competiciones Recientes
        </h6>
        <Button 
          variant="outline-primary" 
          size="sm"
          onClick={() => navigate('/competitions')}
        >
          Ver Todas
        </Button>
      </Card.Header>
      <ListGroup variant="flush">
        {competitions.map((competition) => (
          <ListGroupItem 
            key={competition.id} 
            className="d-flex justify-content-between align-items-center cursor-pointer"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/competitions/${competition.id}/participants`)}
          >
            <div className="flex-grow-1">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <h6 className="mb-0">{competition.name}</h6>
                <div className="d-flex gap-1">
                  <Badge 
                    bg={competition.participants_count >= competition.num_slots ? 'success' : 'primary'}
                    className="ms-2"
                  >
                    {competition.participants_count}/{competition.num_slots}
                  </Badge>
                  {competition.participants_count >= competition.num_slots && (
                    <Badge bg="success" className="ms-1">
                      <FaClock className="me-1" />
                      Tiempos
                    </Badge>
                  )}
                </div>
              </div>
              <div className="d-flex align-items-center text-muted small">
                <FaCalendar className="me-1" />
                <span className="me-3">{formatDate(competition.created_at)}</span>
                <FaUsers className="me-1" />
                <span className="me-3">{competition.rounds} rondas</span>
                {competition.circuit_name && (
                  <>
                    <FaFlag className="me-1" />
                    <span>{competition.circuit_name}</span>
                  </>
                )}
              </div>
            </div>
            <FaArrowRight className="text-muted" />
          </ListGroupItem>
        ))}
      </ListGroup>
    </Card>
  );
};

export default RecentCompetitions; 