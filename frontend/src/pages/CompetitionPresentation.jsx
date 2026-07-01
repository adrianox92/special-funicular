import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Radio, Users, Clock3 } from 'lucide-react';
import axios from '../lib/axios';
import CompetitionHeader from '../components/presentation/CompetitionHeader';
import LiveRankingTable from '../components/presentation/LiveRankingTable';
import RoundProgressGrid from '../components/presentation/RoundProgressGrid';
import BestLapHighlight from '../components/presentation/BestLapHighlight';
import NextPilotHighlight from '../components/presentation/NextPilotHighlight';
import { Spinner } from '../components/ui/spinner';
import { usePresentationLive } from '../hooks/usePresentationLive';
import { findNextPilot } from '../utils/findNextPilot';
import '../styles/CompetitionPresentation.css';

const ROTATE_SCENES = ['ranking', 'bestlap', 'nextpilot'];
const DEFAULT_ROTATE_INTERVAL_S = 12;

function parseSceneParam(raw) {
  const value = (raw || 'all').toLowerCase();
  if (['ranking', 'bestlap', 'nextpilot', 'all'].includes(value)) return value;
  return 'all';
}

const CompetitionPresentation = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const overlayMode = searchParams.get('overlay') === '1';
  const tvMode = searchParams.get('tv') === '1';
  const sceneParam = parseSceneParam(searchParams.get('scene'));
  const rotateMode = searchParams.get('rotate') === '1';
  const rotateIntervalSec = Math.max(
    5,
    Number.parseInt(searchParams.get('interval') || String(DEFAULT_ROTATE_INTERVAL_S), 10) ||
      DEFAULT_ROTATE_INTERVAL_S,
  );

  const [activeScene, setActiveScene] = useState(
    overlayMode && rotateMode ? ROTATE_SCENES[0] : sceneParam === 'all' ? 'all' : sceneParam,
  );
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
    if (!overlayMode || !rotateMode) {
      setActiveScene(sceneParam === 'all' ? 'all' : sceneParam);
      return undefined;
    }
    setActiveScene(ROTATE_SCENES[0]);
    const timer = setInterval(() => {
      setActiveScene((current) => {
        const idx = ROTATE_SCENES.indexOf(current);
        const next = idx >= 0 ? ROTATE_SCENES[(idx + 1) % ROTATE_SCENES.length] : ROTATE_SCENES[0];
        return next;
      });
    }, rotateIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [overlayMode, rotateMode, rotateIntervalSec, sceneParam]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('presentation-mode');
    if (tvMode) root.classList.add('presentation-mode-tv');
    if (overlayMode) root.classList.add('presentation-mode-overlay');
    return () => {
      root.classList.remove('presentation-mode', 'presentation-mode-tv', 'presentation-mode-overlay');
    };
  }, [tvMode, overlayMode]);

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

  const bestLap = useMemo(
    () =>
      participants.reduce((best, participant) => {
        const lap = participant.best_lap;
        if (lap == null || Number.isNaN(Number(lap)) || lap <= 0) return best;
        if (best == null || lap < best) return lap;
        return best;
      }, null),
    [participants],
  );

  const bestLapParticipant = useMemo(
    () =>
      participants.find(
        (p) => p.best_lap != null && p.best_lap > 0 && p.best_lap === bestLap,
      ),
    [participants, bestLap],
  );

  const nextPilotInfo = useMemo(
    () => findNextPilot(participants, competition?.rounds),
    [participants, competition?.rounds],
  );

  const effectiveScene = overlayMode
    ? rotateMode
      ? activeScene
      : sceneParam === 'all'
        ? 'ranking'
        : sceneParam
    : 'all';

  const showChrome = !overlayMode;
  const showCategoryTabs = showChrome && hasCategoryRules && categoryParticipants.length > 0;
  const showFullDashboard = !overlayMode && effectiveScene === 'all';

  const timeLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  if (loading) {
    return (
      <div className={`presentation-loading${overlayMode ? ' presentation-loading--overlay' : ''}`}>
        <Spinner className="size-12 text-primary" />
        {!overlayMode && <p className="mt-3 text-muted-foreground">Cargando competición...</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`presentation-error${overlayMode ? ' presentation-error--overlay' : ''}`}>
        <div className="presentation-error-box">
          <h4 className="text-destructive">Error</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className={`presentation-error${overlayMode ? ' presentation-error--overlay' : ''}`}>
        <div className="presentation-error-box">
          <h4 className="text-foreground font-semibold">Competición no encontrada</h4>
          <p>La competición solicitada no existe o no está disponible.</p>
        </div>
      </div>
    );
  }

  const renderScene = () => {
    if (effectiveScene === 'ranking') {
      return (
        <div className="presentation-scene presentation-scene--ranking">
          <LiveRankingTable
            participants={displayedParticipants}
            title={rankingTitle}
            subtitle={rankingSubtitle}
            autoScroll={overlayMode}
          />
        </div>
      );
    }
    if (effectiveScene === 'bestlap') {
      return (
        <div className="presentation-scene presentation-scene--bestlap">
          <BestLapHighlight bestLap={bestLap} participant={bestLapParticipant} />
        </div>
      );
    }
    if (effectiveScene === 'nextpilot') {
      return (
        <div className="presentation-scene presentation-scene--nextpilot">
          <NextPilotHighlight nextPilot={nextPilotInfo} roundNumber={nextPilotInfo?.roundNumber} />
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`presentation-container${overlayMode ? ' presentation-overlay-mode' : ''}`}>
      <div className="presentation-content">
        {showChrome && (
          <div className="presentation-live-bar" aria-live="polite">
            <div className="presentation-live-bar-left">
              <span
                className="presentation-live-pill"
                title={
                  isLive
                    ? 'Conectado en tiempo real'
                    : 'Reconectando… actualización periódica de respaldo'
                }
              >
                <Radio className="presentation-live-pill-icon" aria-hidden />
                <span className={`presentation-live-dot${isLive ? '' : ' is-reconnecting'}`} aria-hidden />
                <span>{isLive ? 'En vivo' : 'En directo'}</span>
              </span>
              <span className="presentation-live-meta">
                <Users className="presentation-live-meta-icon" aria-hidden />
                {participants.length} {participants.length === 1 ? 'piloto' : 'pilotos'}
              </span>
            </div>
            <div className="presentation-live-bar-right">
              <span className="presentation-live-refresh" title="Última actualización de datos">
                <Clock3 className="presentation-live-meta-icon" aria-hidden />
                Actualizado {timeLabel}
              </span>
            </div>
          </div>
        )}

        {showChrome && <CompetitionHeader competition={competition} />}

        {showCategoryTabs && (
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

        {showFullDashboard ? (
          <div className="presentation-main">
            <div className="presentation-left">
              <LiveRankingTable
                participants={displayedParticipants}
                title={rankingTitle}
                subtitle={rankingSubtitle}
              />
            </div>

            <div className="presentation-right">
              <BestLapHighlight bestLap={bestLap} participant={bestLapParticipant} />
              <NextPilotHighlight
                nextPilot={nextPilotInfo}
                roundNumber={nextPilotInfo?.roundNumber}
              />
              <RoundProgressGrid competition={competition} participants={participants} />
            </div>
          </div>
        ) : (
          renderScene()
        )}
      </div>
    </div>
  );
};

export default CompetitionPresentation;
