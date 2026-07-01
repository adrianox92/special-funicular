import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Gauge, Flag, Clock3 } from 'lucide-react';

const BroadcastStatsBar = ({ participantsCount, status }) => {
  const { t } = useTranslation('presentation');

  if (!status) return null;

  return (
    <div className="broadcast-stats-bar" aria-label={t('progressTitle')}>
      <div className="broadcast-stat">
        <Users className="broadcast-stat-icon" aria-hidden />
        <div className="broadcast-stat-content">
          <span className="broadcast-stat-label">{t('statsPilots')}</span>
          <span className="broadcast-stat-value">{participantsCount}</span>
        </div>
      </div>
      <div className="broadcast-stat">
        <Gauge className="broadcast-stat-icon" aria-hidden />
        <div className="broadcast-stat-content">
          <span className="broadcast-stat-label">{t('statsProgress')}</span>
          <span className="broadcast-stat-value">{status.progress_percentage}%</span>
        </div>
      </div>
      <div className="broadcast-stat">
        <Flag className="broadcast-stat-icon" aria-hidden />
        <div className="broadcast-stat-content">
          <span className="broadcast-stat-label">{t('statsCurrentRound')}</span>
          <span className="broadcast-stat-value">
            {t('roundLabel', { number: status.current_round ?? '—' })}
          </span>
        </div>
      </div>
      <div className="broadcast-stat">
        <Clock3 className="broadcast-stat-icon" aria-hidden />
        <div className="broadcast-stat-content">
          <span className="broadcast-stat-label">{t('statsTimes')}</span>
          <span className="broadcast-stat-value">
            {status.times_registered}/{status.total_required_times}
          </span>
        </div>
      </div>
      {status.times_remaining > 0 && (
        <div className="broadcast-stat broadcast-stat--muted">
          <span className="broadcast-stat-label">{t('progressRemaining', { count: status.times_remaining })}</span>
        </div>
      )}
    </div>
  );
};

export default BroadcastStatsBar;
