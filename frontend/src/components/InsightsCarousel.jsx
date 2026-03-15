import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel';

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
    if (user) fetchInsights();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchInsights()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="mb-4">No hay insights disponibles.</p>
          <Button size="sm" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? (
              <><Spinner className="size-4 mr-2" />Generando...</>
            ) : (
              <><RefreshCw className="size-4 mr-2" />Generar Insights</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="size-5" />
          <h5 className="font-semibold">Insights de IA</h5>
        </div>
        <Button variant="secondary" size="sm" onClick={handleRegenerate} disabled={regenerating} title="Regenerar insights">
          {regenerating ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Carousel opts={{ align: 'start', loop: true }}>
          <CarouselContent>
            {insights.map((insight, index) => (
              <CarouselItem key={index}>
                <div className="p-4">
                  <h6 className="text-primary font-medium mb-3">{insight.title || `Insight ${index + 1}`}</h6>
                  <p>{insight.content || insight}</p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {insights.length > 1 && (
            <>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </>
          )}
        </Carousel>
      </CardContent>
    </Card>
  );
};

export default InsightsCarousel;
