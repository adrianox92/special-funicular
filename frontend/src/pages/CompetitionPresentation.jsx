import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../lib/axios';
import CompetitionHeader from '../components/presentation/CompetitionHeader';
import LiveRankingTable from '../components/presentation/LiveRankingTable';
import RoundProgressGrid from '../components/presentation/RoundProgressGrid';
import BestLapHighlight from '../components/presentation/BestLapHighlight';
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
  }, [slug]);

  if (loading) {
    return (
      <div className="presentation-loading">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-3 text-light">Cargando competición...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="presentation-error">
        <div className="alert alert-danger" role="alert">
          <h4>Error</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="presentation-error">
        <div className="alert alert-warning" role="alert">
          <h4>Competición no encontrada</h4>
          <p>La competición solicitada no existe o no está disponible.</p>
        </div>
      </div>
    );
  }

  // Calcular mejor vuelta absoluta
  const bestLap = participants.reduce((best, participant) => {
    if (participant.best_lap && (!best || participant.best_lap < best)) {
      return participant.best_lap;
    }
    return best;
  }, null);

  const bestLapParticipant = participants.find(p => p.best_lap === bestLap);

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