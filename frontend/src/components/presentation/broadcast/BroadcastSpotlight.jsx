import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Flag, User, Car } from 'lucide-react';
import { formatBestLapFromSeconds } from '../../../utils/presentationFormatters';

const BroadcastSpotlight = ({ globalBestLap, nextPilotInfo, showBestLap = true, showNextPilot = true }) => {
  const { t } = useTranslation('presentation');

  const hasBestLap = globalBestLap?.time_seconds > 0;

  return (
    <div className={`broadcast-spotlight${!showBestLap || !showNextPilot ? ' broadcast-spotlight--single' : ''}`}>
      {showBestLap && (
      <div className="broadcast-spotlight-card broadcast-spotlight-card--bestlap">
        <h3 className="broadcast-spotlight-title">
          <Trophy className="broadcast-spotlight-icon" aria-hidden />
          {t('bestLapTitle')}
        </h3>
        {hasBestLap ? (
          <>
            <div className="broadcast-spotlight-hero">{formatBestLapFromSeconds(globalBestLap.time_seconds)}</div>
            <p className="broadcast-spotlight-meta">
              {t('bestLapRound', { round: globalBestLap.round_number })}
            </p>
            <div className="broadcast-spotlight-detail">
              <p>
                <User className="broadcast-spotlight-detail-icon" aria-hidden />
                {globalBestLap.driver_name}
                {globalBestLap.team_name && (
                  <span className="broadcast-driver-team"> · {globalBestLap.team_name}</span>
                )}
              </p>
              {(globalBestLap.vehicle_brand || globalBestLap.vehicle_name) && (
                <p>
                  <Car className="broadcast-spotlight-detail-icon" aria-hidden />
                  {globalBestLap.vehicle_brand} {globalBestLap.vehicle_name}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="broadcast-spotlight-empty">{t('noTimesRegistered')}</p>
        )}
      </div>
      )}

      {showNextPilot && (
      <div className="broadcast-spotlight-card broadcast-spotlight-card--next">
        <h3 className="broadcast-spotlight-title">
          <Flag className="broadcast-spotlight-icon" aria-hidden />
          {t('nextPilotTitle')}
        </h3>
        {nextPilotInfo ? (
          <>
            <div className="broadcast-spotlight-hero broadcast-spotlight-hero--name">
              {nextPilotInfo.participant.driver_name}
            </div>
            <p className="broadcast-spotlight-meta">
              {t('nextPilotSubtitle', { round: nextPilotInfo.roundNumber })}
            </p>
            <div className="broadcast-spotlight-detail">
              {nextPilotInfo.participant.team_name && (
                <p>{nextPilotInfo.participant.team_name}</p>
              )}
              <p>
                <Car className="broadcast-spotlight-detail-icon" aria-hidden />
                {nextPilotInfo.participant.vehicle_brand} {nextPilotInfo.participant.vehicle_name}
              </p>
              {nextPilotInfo.participant.position > 0 && (
                <p>
                  {t('nextPilotPosition', { position: nextPilotInfo.participant.position })}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="broadcast-spotlight-empty">{t('allRoundsComplete')}</p>
        )}
      </div>
      )}
    </div>
  );
};

export default BroadcastSpotlight;
