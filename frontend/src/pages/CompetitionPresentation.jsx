import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Radio, Users, Clock3 } from 'lucide-react';
import axios from '../lib/axios';
import CompetitionHeader from '../components/presentation/CompetitionHeader';
import LiveRankingTable from '../components/presentation/LiveRankingTable';
import RoundProgressGrid from '../components/presentation/RoundProgressGrid';
import BestLapHighlight from '../components/presentation/BestLapHighlight';
import { Spinner } from '../components/ui/spinner';
import '../styles/CompetitionPresentation.css';

const CompetitionPresentation = () => {
  const { slug } = useParams();
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await axios.get(`/public-signup/${slug}/presentation`);
      setCompetition(response.data.competition);
      setParticipants(response.data.participants);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching competition data:', err);
      setError('Error al cargar los datos de la competición');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    document.documentElement.classList.add('presentation-mode');
    return () => document.documentElement.classList.remove('presentation-mode');
  }, []);

  if (loading) {
    return (
      <div className="presentation-loading">
        <Spinner className="size-12 text-primary" />
        <p className="mt-3 text-muted-foreground">Cargando competición...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="presentation-error">
        <div className="presentation-error-box">
          <h4 className="text-destructive">Error</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="presentation-error">
        <div className="presentation-error-box">
          <h4 className="text-foreground font-semibold">Competición no encontrada</h4>
          <p>La competición solicitada no existe o no está disponible.</p>
        </div>
      </div>
    );
  }

  // Mejor vuelta absoluta: solo pilotos con al menos una ronda disputada (best_lap > 0 en API)
  const bestLap = participants.reduce((best, participant) => {
    const lap = participant.best_lap;
    if (lap == null || Number.isNaN(Number(lap)) || lap <= 0) return best;
    if (best == null || lap < best) return lap;
    return best;
  }, null);

  const bestLapParticipant = participants.find(
    (p) => p.best_lap != null && p.best_lap > 0 && p.best_lap === bestLap
  );

  const timeLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div className="presentation-container">
      <div className="presentation-content">
        <div className="presentation-live-bar" aria-live="polite">
          <div className="presentation-live-bar-left">
            <span className="presentation-live-pill" title="La clasificación se actualiza sola">
              <Radio className="presentation-live-pill-icon" aria-hidden />
              <span className="presentation-live-dot" aria-hidden />
              <span>En directo</span>
            </span>
            <span className="presentation-live-meta">
              <Users className="presentation-live-meta-icon" aria-hidden />
              {participants.length}{' '}
              {participants.length === 1 ? 'piloto' : 'pilotos'}
            </span>
          </div>
          <div className="presentation-live-bar-right">
            <span className="presentation-live-refresh" title="Última actualización de datos">
              <Clock3 className="presentation-live-meta-icon" aria-hidden />
              Actualizado {timeLabel}
            </span>
          </div>
        </div>

        <CompetitionHeader competition={competition} />
        
        <div className="presentation-main">
          <div className="presentation-left">
            <LiveRankingTable participants={participants} />
          </div>
          
          <div className="presentation-right">
            <BestLapHighlight 
              bestLap={bestLap} 
              participant={bestLapParticipant}
            />
            <RoundProgressGrid 
              competition={competition} 
              participants={participants}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionPresentation; 