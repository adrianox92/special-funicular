import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered } from 'lucide-react';
import { buildPresentationRoundLeaderboard } from '../../../utils/presentationRoundStandings';
import {
  formatTimeFromSeconds,
  formatGapSeconds,
  roundAdjustedSeconds,
} from '../../../utils/presentationFormatters';

const BroadcastRoundPanel = ({ participants, roundNumber }) => {
  const { t } = useTranslation('presentation');

  const { rows, isComplete } = useMemo(
    () => buildPresentationRoundLeaderboard(participants, roundNumber),
    [participants, roundNumber],
  );

  return (
    <section className="broadcast-panel broadcast-round-panel">
      <div className="broadcast-panel-header">
        <h2 className="broadcast-panel-title">
          <ListOrdered className="broadcast-panel-icon" aria-hidden />
          {t('roundPanelTitle', { round: roundNumber })}
        </h2>
        <p className="broadcast-panel-subtitle">
          {t('roundPanelSubtitle')}
          {isComplete ? ` · ${t('roundCompleteBadge')}` : ''}
        </p>
      </div>
      <div className="broadcast-table-wrap">
        <table className="broadcast-table broadcast-table--round">
          <thead>
            <tr>
              <th>{t('colPosition')}</th>
              <th>{t('colDriver')}</th>
              <th>{t('colTotalTime')}</th>
              <th className="broadcast-col-secondary">{t('colPenalty')}</th>
              <th className="broadcast-col-secondary">{t('colBestLap')}</th>
              <th className="broadcast-col-gap">{t('colGapLeader')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { participant, round, kind, position, leaderGapSeconds } = row;
              const adj = round ? roundAdjustedSeconds(round) : null;
              return (
                <tr key={`${participant.id}-${kind}`} className={kind !== 'raced' ? `broadcast-round-${kind}` : ''}>
                  <td className="broadcast-cell-pos">
                    {kind === 'raced' ? position : kind === 'np' ? 'NP' : '—'}
                  </td>
                  <td>
                    <div className="broadcast-driver">
                      <span className="broadcast-driver-name">{participant.driver_name}</span>
                      {participant.team_name && (
                        <span className="broadcast-driver-team">{participant.team_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="broadcast-cell-time">
                    {kind === 'raced' ? formatTimeFromSeconds(adj) : kind === 'np' ? 'NP' : '—'}
                  </td>
                  <td className="broadcast-col-secondary broadcast-cell-penalty">
                    {round && Number(round.penalty_seconds) > 0
                      ? `+${Number(round.penalty_seconds).toFixed(3)} s`
                      : '—'}
                  </td>
                  <td className="broadcast-col-secondary broadcast-cell-lap">
                    {round?.best_lap_seconds ? formatTimeFromSeconds(round.best_lap_seconds) : '—'}
                  </td>
                  <td className="broadcast-col-gap">{formatGapSeconds(leaderGapSeconds)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default BroadcastRoundPanel;
