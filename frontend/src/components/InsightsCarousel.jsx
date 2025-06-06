import React, { useState, useEffect } from 'react';
import { Carousel, Card, Spinner, Button } from 'react-bootstrap';
import { FaRobot, FaSync } from 'react-icons/fa';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';

const InsightsCarousel = () => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const { user } = useAuth();

  const fetchInsights = async (forceRegenerate = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/insights-ia${forceRegenerate ? '?force=true' : ''}`);
      setInsights(response.data.insights);
    } catch (err) {
      setError('Error al cargar los insights. Por favor, intenta de nuevo más tarde.');
      console.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await fetchInsights(true);
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="text-center my-4">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Cargando insights...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mb-4 border-danger">
        <Card.Body className="text-center">
          <p className="text-danger mb-0">{error}</p>
          <Button 
            variant="outline-primary" 
            size="sm" 
            className="mt-2"
            onClick={() => fetchInsights()}
          >
            Reintentar
          </Button>
        </Card.Body>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card className="mb-4">
        <Card.Body className="text-center">
          <p className="mb-0">No hay insights disponibles.</p>
          <Button 
            variant="primary" 
            size="sm" 
            className="mt-2"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Generando...
              </>
            ) : (
              <>
                <FaSync className="me-2" />
                Generar Insights
              </>
            )}
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-4 insights-carousel">
      <Card.Header className="d-flex justify-content-between align-items-center bg-primary text-white">
        <div className="d-flex align-items-center">
          <FaRobot className="me-2" />
          <h5 className="mb-0">Insights de IA</h5>
        </div>
        <Button
          variant="light"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerating}
          title="Regenerar insights"
        >
          {regenerating ? (
            <Spinner as="span" animation="border" size="sm" />
          ) : (
            <FaSync />
          )}
        </Button>
      </Card.Header>
      <Card.Body className="p-0">
        <Carousel
          indicators={false}
          interval={10000}
          controls={insights.length > 1}
          className="insights-carousel-inner"
        >
          {insights.map((insight, index) => (
            <Carousel.Item key={index}>
              <div className="p-4">
                <h6 className="text-primary mb-3">{insight.title || `Insight ${index + 1}`}</h6>
                <p className="mb-0">{insight.content || insight}</p>
              </div>
            </Carousel.Item>
          ))}
        </Carousel>
      </Card.Body>
    </Card>
  );
};

export default InsightsCarousel; 