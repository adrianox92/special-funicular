import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, Flag, ArrowRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';

const RecentCompetitions = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadRecentCompetitions = async () => {
      try {
        const response = await axios.get('/api/competitions/my-competitions');
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
        <CardHeader>
          <h6 className="font-semibold flex items-center gap-2">
            <Trophy className="size-4" />
            Competiciones Recientes
          </h6>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Spinner className="size-6 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <h6 className="font-semibold flex items-center gap-2">
            <Trophy className="size-4" />
            Competiciones Recientes
          </h6>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (competitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h6 className="font-semibold flex items-center gap-2">
            <Trophy className="size-4" />
            Competiciones Recientes
          </h6>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">No tienes competiciones creadas</p>
          <div className="text-sm text-muted-foreground mb-4">
            <p className="mb-2">💡 <strong>Flujo recomendado:</strong></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Crea una competición</li>
              <li>Añade todos los participantes</li>
              <li>Gestiona los tiempos por ronda</li>
            </ol>
          </div>
          <Button size="sm" onClick={() => navigate('/competitions')}>
            Crear Primera Competición
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h6 className="font-semibold flex items-center gap-2">
          <Trophy className="size-4" />
          Competiciones Recientes
        </h6>
        <Button variant="outline" size="sm" onClick={() => navigate('/competitions')}>
          Ver Todas
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {competitions.map((competition) => (
            <div
              key={competition.id}
              className="flex justify-between items-center p-4 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/competitions/${competition.id}/participants`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h6 className="font-medium truncate">{competition.name}</h6>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant={competition.participants_count >= competition.num_slots ? 'default' : 'secondary'}>
                      {competition.participants_count}/{competition.num_slots}
                    </Badge>
                    {competition.participants_count >= competition.num_slots && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="size-3" />
                        Tiempos
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {formatDate(competition.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {competition.rounds} rondas
                  </span>
                  {competition.circuit_name && (
                    <span className="flex items-center gap-1">
                      <Flag className="size-3" />
                      {competition.circuit_name}
                    </span>
                  )}
                </div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground shrink-0 ml-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentCompetitions;
