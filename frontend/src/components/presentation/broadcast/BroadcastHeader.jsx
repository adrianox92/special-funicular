import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Trophy, Flag } from 'lucide-react';

const BroadcastHeader = ({ competition, status, compact = false }) => {
  const { t } = useTranslation('presentation');

  const getStatusText = (s) => {
    switch (s) {
      case 'active':
        return t('statusActive');
      case 'finished':
        return t('statusFinished');
      case 'pending':
        return t('statusPending');
      default:
        return t('statusUnknown');
    }
  };

  const getStatusClass = (s) => {
    switch (s) {
      case 'active':
        return 'broadcast-status--active';
      case 'finished':
        return 'broadcast-status--finished';
      default:
        return 'broadcast-status--pending';
    }
  };

  const progressPct = status?.progress_percentage ?? 0;

  return (
    <header className={`broadcast-header${compact ? ' broadcast-header--compact' : ''}`}>
      <div className="broadcast-header-main">
        <h1 className="broadcast-header-title">
          <Trophy className="broadcast-header-icon" aria-hidden />
          {competition.name}
        </h1>
        <div className="broadcast-header-meta">
          {competition.circuit_name && (
            <span className="broadcast-meta-pill">
              <MapPin className="broadcast-meta-icon" aria-hidden />
              {competition.circuit_name}
            </span>
          )}
          <span className="broadcast-meta-pill">
            <Flag className="broadcast-meta-icon" aria-hidden />
            {t('rounds', { count: competition.rounds })}
          </span>
          {competition.num_slots != null && competition.num_slots > 0 && (
            <span className="broadcast-meta-pill">{t('slots', { count: competition.num_slots })}</span>
          )}
          <span className={`broadcast-status ${getStatusClass(competition.status)}`}>
            {getStatusText(competition.status)}
          </span>
        </div>
      </div>
      {status && !compact && (
        <div className="broadcast-header-progress">
          <div className="broadcast-progress-labels">
            <span>{t('progressTitle')}</span>
            <span>
              {t('progressTimes', {
                registered: status.times_registered,
                total: status.total_required_times,
              })}
            </span>
          </div>
          <div
            className="broadcast-progress-bar"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="broadcast-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {status.current_round != null && (
            <span className="broadcast-round-indicator">
              {t('roundCurrent', {
                current: status.current_round,
                total: competition.rounds,
              })}
            </span>
          )}
        </div>
      )}
    </header>
  );
};

export default BroadcastHeader;
