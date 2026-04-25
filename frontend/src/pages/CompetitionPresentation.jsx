import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

  const fetchData = async () => {
    try {
      const response = await axios.get(`/public-signup/${slug}/presentation`);
      setCompetition(response.data.competition);
      setParticipants(response.data.participants);
      setError(null);
    } catch (err) {
      console.error('Error fetching competition data:', err);
      setError('Error al cargar los datos de la competición');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-actualización cada 10 segundos
    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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

  return (
    <div className="presentation-container">
      <div className="presentation-content">
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