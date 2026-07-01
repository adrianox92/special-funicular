import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, Users, Clock3 } from 'lucide-react';
import BroadcastShell from './BroadcastShell';
import BroadcastHeader from './BroadcastHeader';
import BroadcastStatsBar from './BroadcastStatsBar';
import BroadcastLeaderboard from './BroadcastLeaderboard';
import BroadcastRoundPanel from './BroadcastRoundPanel';
import BroadcastSpotlight from './BroadcastSpotlight';
import BroadcastProgressMatrix from './BroadcastProgressMatrix';
import BroadcastPodium from './BroadcastPodium';
import { useBroadcastLayout } from './useBroadcastLayout';
import { findNextPilot } from '../../../utils/findNextPilot';

const TvDashboard = ({
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
  const { useMobileTabs } = useBroadcastLayout();
  const [mobileTab, setMobileTab] = useState('general');

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

  const mainContent = (
    <>
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
    </>
  );

  const mobileContent = (
    <>
      {mobileTab === 'general' && (
        <div className="broadcast-mobile-panel">
          <BroadcastPodium participants={displayedParticipants} />
          <BroadcastLeaderboard
            participants={displayedParticipants}
            title={rankingTitle}
            subtitle={rankingSubtitle}
          />
          <BroadcastSpotlight globalBestLap={globalBestLap} nextPilotInfo={nextPilotInfo} />
        </div>
      )}
      {mobileTab === 'round' && (
        <div className="broadcast-mobile-panel">
          <BroadcastRoundPanel participants={participants} roundNumber={currentRound} />
        </div>
      )}
      {mobileTab === 'progress' && (
        <div className="broadcast-mobile-panel">
          <BroadcastProgressMatrix competition={competition} participants={participants} />
        </div>
      )}
    </>
  );

  return (
    <BroadcastShell variant="tv">
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

      {useMobileTabs ? (
        <>
          {mobileContent}
          <nav className="broadcast-mobile-tabs" aria-label={t('categoryTabs')}>
            {['general', 'round', 'progress'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`broadcast-mobile-tab${mobileTab === tab ? ' is-active' : ''}`}
                onClick={() => setMobileTab(tab)}
              >
                {t(`mobileTab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`)}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <div className="broadcast-grid">{mainContent}</div>
      )}
    </BroadcastShell>
  );
};

export default TvDashboard;
