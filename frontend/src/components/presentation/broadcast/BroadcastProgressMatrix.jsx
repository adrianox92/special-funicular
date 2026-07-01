import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Clock, Pause, Ban, Grid3X3 } from 'lucide-react';
import { formatTimeFromSeconds } from '../../../utils/presentationFormatters';

const BroadcastProgressMatrix = ({ competition, participants, compact = false }) => {
  const { t } = useTranslation('presentation');

  const getRoundStatus = (participant, roundNumber) => {
    const round = participant.rounds?.find((r) => r.round_number === roundNumber);
    if (!round) return 'pending';
    if (round.did_not_participate) return 'dnp';
    if (round.time_timestamp != null && round.time_timestamp > 0) return 'completed';
    return 'pending';
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'dnp':
        return <Ban />;
      default:
        return <Pause />;
    }
  };

  return (
    <section className={`broadcast-panel broadcast-progress-matrix${compact ? ' broadcast-progress-matrix--compact' : ''}`}>
      <div className="broadcast-panel-header">
        <h2 className="broadcast-panel-title">
          <Grid3X3 className="broadcast-panel-icon" aria-hidden />
          {t('progressMatrixTitle')}
        </h2>
        <p className="broadcast-panel-subtitle">{t('progressMatrixSubtitle')}</p>
      </div>
      <div className="broadcast-matrix-wrap">
        <div className="broadcast-matrix-header">
          <div className="broadcast-matrix-pilot-col">{t('colDriver')}</div>
          {Array.from({ length: competition.rounds }, (_, i) => (
            <div key={i + 1} className="broadcast-matrix-round-col">
              {t('roundLabel', { number: i + 1 })}
            </div>
          ))}
        </div>
        <div className="broadcast-matrix-body">
          {participants.map((p) => (
            <div key={p.id} className="broadcast-matrix-row">
              <div className="broadcast-matrix-pilot-col">
                <span className="broadcast-driver-name">{p.driver_name}</span>
                <span className="broadcast-vehicle-brand">{p.vehicle_name}</span>
              </div>
              {Array.from({ length: competition.rounds }, (_, i) => {
                const roundNum = i + 1;
                const status = getRoundStatus(p, roundNum);
                const round = p.rounds?.find((r) => r.round_number === roundNum);
                const penalty = round?.penalty_seconds > 0 ? `+${round.penalty_seconds}s` : null;
                return (
                  <div
                    key={roundNum}
                    className={`broadcast-matrix-cell broadcast-matrix-cell--${status}`}
                    title={penalty ? `${t('colPenalty')}: ${penalty}` : undefined}
                  >
                    <span className="broadcast-matrix-icon">{statusIcon(status)}</span>
                    {status === 'dnp' && <span className="broadcast-matrix-np">NP</span>}
                    {status === 'completed' && round?.time_timestamp > 0 && (
                      <span className="broadcast-matrix-time">
                        {formatTimeFromSeconds(round.time_timestamp)}
                      </span>
                    )}
                    {penalty && status === 'completed' && (
                      <span className="broadcast-matrix-penalty">{penalty}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!compact && (
        <div className="broadcast-matrix-legend">
          <span className="broadcast-legend-item"><CheckCircle aria-hidden /> {t('legendCompleted')}</span>
          <span className="broadcast-legend-item"><Ban aria-hidden /> {t('legendDnp')}</span>
          <span className="broadcast-legend-item"><Clock aria-hidden /> {t('legendInProgress')}</span>
          <span className="broadcast-legend-item"><Pause aria-hidden /> {t('legendPending')}</span>
        </div>
      )}
    </section>
  );
};

export default BroadcastProgressMatrix;
