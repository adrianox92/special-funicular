import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../lib/axios';
import { Spinner } from '../components/ui/spinner';
import { usePresentationLive } from '../hooks/usePresentationLive';
import { findNextPilot } from '../utils/findNextPilot';
import TvDashboard from '../components/presentation/broadcast/TvDashboard';
import OverlayBroadcast from '../components/presentation/broadcast/OverlayBroadcast';
import BroadcastShell from '../components/presentation/broadcast/BroadcastShell';
import BroadcastHeader from '../components/presentation/broadcast/BroadcastHeader';
import BroadcastStatsBar from '../components/presentation/broadcast/BroadcastStatsBar';
import BroadcastLeaderboard from '../components/presentation/broadcast/BroadcastLeaderboard';
import BroadcastRoundPanel from '../components/presentation/broadcast/BroadcastRoundPanel';
import BroadcastSpotlight from '../components/presentation/broadcast/BroadcastSpotlight';
import BroadcastProgressMatrix from '../components/presentation/broadcast/BroadcastProgressMatrix';
import BroadcastPodium from '../components/presentation/broadcast/BroadcastPodium';
import { Radio, Users, Clock3 } from 'lucide-react';
import '../styles/BroadcastPresentation.css';

const ROTATE_SCENES = ['ranking', 'bestlap', 'nextpilot', 'round', 'progress'];
const DEFAULT_ROTATE_INTERVAL_S = 12;

function parseSceneParam(raw) {
  const value = (raw || 'all').toLowerCase();
  if (['ranking', 'bestlap', 'nextpilot', 'round', 'progress', 'all'].includes(value)) return value;
  return 'all';
}

const StandardPresentation = ({
  competition,
  status,
  globalBestLap,
  participants,
  displayedParticipants,
  categoryParticipants,
  hasCategoryRules,
  activeCategory,
  onCategoryChange,
  isLive,
  lastUpdated,
  rankingTitle,
  rankingSubtitle,
}) => {
  const { t } = useTranslation('presentation');

  const nextPilotInfo = useMemo(
    () => findNextPilot(participants, competition?.rounds),
    [participants, competition?.rounds],
  );

  const currentRound = status?.current_round ?? nextPilotInfo?.roundNumber ?? 1;

  const timeLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  const showCategoryTabs = hasCategoryRules && categoryParticipants.length > 0;

  return (
    <BroadcastShell>
      <div className="broadcast-live-bar" aria-live="polite">
        <div className="broadcast-live-bar-left">
          <span
            className="broadcast-live-pill"
            title={isLive ? t('liveConnected') : t('liveReconnecting')}
          >
            <Radio className="broadcast-live-pill-icon" aria-hidden />
            <span className={`broadcast-live-dot${isLive ? '' : ' is-reconnecting'}`} aria-hidden />
            <span>{isLive ? t('live') : t('reconnecting')}</span>
          </span>
          <span className="broadcast-live-meta">
            <Users className="broadcast-live-meta-icon" aria-hidden />
            {t('pilots', { count: participants.length })}
          </span>
        </div>
        <div className="broadcast-live-bar-right">
          <span className="broadcast-live-refresh">
            <Clock3 className="broadcast-live-meta-icon" aria-hidden />
            {t('updated', { time: timeLabel })}
          </span>
        </div>
      </div>

      <BroadcastHeader competition={competition} status={status} />
      <BroadcastStatsBar participantsCount={participants.length} status={status} />

      {showCategoryTabs && (
        <div className="broadcast-category-tabs" role="tablist" aria-label={t('categoryTabs')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'general'}
            className={`broadcast-category-tab${activeCategory === 'general' ? ' is-active' : ''}`}
            onClick={() => onCategoryChange('general')}
          >
            {t('general')}
          </button>
          {categoryParticipants.map((group) => (
            <button
              key={group.category_id}
              type="button"
              role="tab"
              aria-selected={activeCategory === group.category_id}
              className={`broadcast-category-tab${activeCategory === group.category_id ? ' is-active' : ''}`}
              onClick={() => onCategoryChange(group.category_id)}
            >
              {group.category_name}
            </button>
          ))}
        </div>
      )}

      <div className="broadcast-grid">
        <div className="broadcast-grid-main">
          <BroadcastPodium participants={displayedParticipants} />
          <BroadcastLeaderboard
            participants={displayedParticipants}
            title={rankingTitle}
            subtitle={rankingSubtitle}
          />
        </div>
        <aside className="broadcast-grid-sidebar">
          <BroadcastSpotlight globalBestLap={globalBestLap} nextPilotInfo={nextPilotInfo} />
          <BroadcastRoundPanel participants={participants} roundNumber={currentRound} />
          <BroadcastProgressMatrix competition={competition} participants={participants} />
        </aside>
      </div>
    </BroadcastShell>
  );
};

const CompetitionPresentation = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('presentation');
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
  const [status, setStatus] = useState(null);
  const [globalBestLap, setGlobalBestLap] = useState(null);
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
      setStatus(response.data.status || null);
      setGlobalBestLap(response.data.global_best_lap || null);
      setParticipants(response.data.participants);
      setCategoryParticipants(response.data.category_participants || []);
      setHasCategoryRules(Boolean(response.data.has_category_rules));
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching competition data:', err);
      setError(t('errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

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
      return t('generalRanking');
    }
    const group = categoryParticipants.find((g) => g.category_id === activeCategory);
    return group?.category_name
      ? t('categoryRanking', { category: group.category_name })
      : t('categoryRanking', { category: '' });
  }, [activeCategory, categoryParticipants, hasCategoryRules, t]);

  const rankingSubtitle = useMemo(() => {
    if (activeCategory === 'general' && hasCategoryRules) {
      return t('rankingSubtitleGeneral');
    }
    if (activeCategory !== 'general') {
      return t('rankingSubtitleCategory');
    }
    return t('rankingSubtitleDefault');
  }, [activeCategory, hasCategoryRules, t]);

  const effectiveScene = overlayMode
    ? rotateMode
      ? activeScene
      : sceneParam === 'all'
        ? 'ranking'
        : sceneParam
    : 'all';

  const sharedProps = {
    competition,
    status,
    globalBestLap,
    participants,
    displayedParticipants,
    categoryParticipants,
    hasCategoryRules,
    activeCategory,
    onCategoryChange: setActiveCategory,
    isLive,
    lastUpdated,
    rankingTitle,
    rankingSubtitle,
  };

  if (loading) {
    return (
      <div className={`broadcast-loading${overlayMode ? ' broadcast-shell--overlay' : ''}`}>
        <Spinner className="size-12 text-primary" />
        {!overlayMode && <p className="mt-3 text-muted-foreground">{t('loading')}</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`broadcast-error${overlayMode ? ' broadcast-shell--overlay' : ''}`}>
        <div className="broadcast-error-box">
          <h4>{t('error')}</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className={`broadcast-error${overlayMode ? ' broadcast-shell--overlay' : ''}`}>
        <div className="broadcast-error-box">
          <h4 className="font-semibold">{t('notFound')}</h4>
          <p>{t('notFoundDesc')}</p>
        </div>
      </div>
    );
  }

  if (overlayMode) {
    return <OverlayBroadcast scene={effectiveScene} {...sharedProps} />;
  }

  if (tvMode) {
    return <TvDashboard {...sharedProps} />;
  }

  return <StandardPresentation {...sharedProps} />;
};

export default CompetitionPresentation;
