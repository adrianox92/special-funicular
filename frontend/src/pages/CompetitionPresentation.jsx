import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Radio, Users, Clock3 } from 'lucide-react';
import axios from '../lib/axios';
import CompetitionHeader from '../components/presentation/CompetitionHeader';
import LiveRankingTable from '../components/presentation/LiveRankingTable';
import RoundProgressGrid from '../components/presentation/RoundProgressGrid';
import BestLapHighlight from '../components/presentation/BestLapHighlight';
import { Spinner } from '../components/ui/spinner';
import { usePresentationLive } from '../hooks/usePresentationLive';
import '../styles/CompetitionPresentation.css';

const CompetitionPresentation = () => {
  const { slug } = useParams();
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [categoryParticipants, setCategoryParticipants] = useState([]);
  const [hasCategoryRules, setHasCategoryRules] = useState(false);
  const [activeCategory, setActiveCategory] = useState('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await axios.get(`/public-signup/${slug}/presentation`);
      setCompetition(response.data.competition);
      setParticipants(response.data.participants);
      setCategoryParticipants(response.data.category_participants || []);
      setHasCategoryRules(Boolean(response.data.has_category_rules));
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching competition data:', err);
      setError('Error al cargar los datos de la competición');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const { isLive } = usePresentationLive(slug, fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    document.documentElement.classList.add('presentation-mode');
    return () => document.documentElement.classList.remove('presentation-mode');
  }, []);

  const displayedParticipants = useMemo(() => {
    if (activeCategory === 'general' || !hasCategoryRules) {
      return participants;
    }
    const group = categoryParticipants.find((g) => g.category_id === activeCategory);
    return group?.participants || [];
  }, [activeCategory, categoryParticipants, hasCategoryRules, participants]);

  const rankingTitle = useMemo(() => {
    if (activeCategory === 'general' || !hasCategoryRules) {
      return 'Clasificación general';
    }
    const group = categoryParticipants.find((g) => g.category_id === activeCategory);
    return group?.category_name ? `Clasificación — ${group.category_name}` : 'Clasificación por categoría';
  }, [activeCategory, categoryParticipants, hasCategoryRules]);

  const rankingSubtitle = useMemo(() => {
    if (activeCategory === 'general' && hasCategoryRules) {
      return 'Orden por tiempo total · Se actualiza automáticamente';
    }
    if (activeCategory !== 'general') {
      return 'Orden por puntos y tiempo dentro de la categoría · Se actualiza automáticamente';
    }
    return 'Orden por puntos y tiempo · Se actualiza automáticamente';
  }, [activeCategory, hasCategoryRules]);

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
            <span className="presentation-live-pill" title={isLive ? 'Conectado en tiempo real' : 'Reconectando… actualización periódica de respaldo'}>
              <Radio className="presentation-live-pill-icon" aria-hidden />
              <span className={`presentation-live-dot${isLive ? '' : ' is-reconnecting'}`} aria-hidden />
              <span>{isLive ? 'En vivo' : 'En directo'}</span>
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

        {hasCategoryRules && categoryParticipants.length > 0 && (
          <div className="presentation-category-tabs" role="tablist" aria-label="Clasificación por categoría">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'general'}
              className={`presentation-category-tab${activeCategory === 'general' ? ' is-active' : ''}`}
              onClick={() => setActiveCategory('general')}
            >
              General
            </button>
            {categoryParticipants.map((group) => (
              <button
                key={group.category_id}
                type="button"
                role="tab"
                aria-selected={activeCategory === group.category_id}
                className={`presentation-category-tab${activeCategory === group.category_id ? ' is-active' : ''}`}
                onClick={() => setActiveCategory(group.category_id)}
              >
                {group.category_name}
              </button>
            ))}
          </div>
        )}

        <div className="presentation-main">
          <div className="presentation-left">
            <LiveRankingTable
              participants={displayedParticipants}
              title={rankingTitle}
              subtitle={rankingSubtitle}
            />
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
