import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimeFromSeconds } from '../../../utils/presentationFormatters';

const BroadcastPodium = ({ participants }) => {
  const { t } = useTranslation('presentation');

  const top3 = [...participants]
    .filter((p) => Number(p.position) > 0)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .slice(0, 3);

  if (top3.length === 0) return null;

  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const podiumClass = (pos) => {
    if (pos === 1) return 'broadcast-podium-place--gold';
    if (pos === 2) return 'broadcast-podium-place--silver';
    if (pos === 3) return 'broadcast-podium-place--bronze';
    return '';
  };

  return (
    <div className="broadcast-podium" aria-label={t('podiumAria')}>
      {order.map((p) => (
        <div
          key={p.id}
          className={`broadcast-podium-place ${podiumClass(Number(p.position))}`}
        >
          <span className="broadcast-podium-pos">{t('podiumPosition', { position: p.position })}</span>
          <span className="broadcast-podium-name">{p.driver_name}</span>
          {p.team_name && <span className="broadcast-podium-team">{p.team_name}</span>}
          <span className="broadcast-podium-time">{formatTimeFromSeconds(p.total_time_timestamp)}</span>
          {p.points != null && (
            <span className="broadcast-podium-points">{t('podiumPoints', { count: p.points })}</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default BroadcastPodium;
