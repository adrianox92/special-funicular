import React, { useMemo } from 'react';
import { formatTimeDiff } from '../../utils/formatTimeDiff';

const LiveRankingTable = ({ participants }) => {
  /** Mismo criterio que la clasificación pública: puntos → tiempo (orden del API / calculatePoints). */
  const orderedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const posA = Number(a.position);
      const posB = Number(b.position);
      if (Number.isFinite(posA) && Number.isFinite(posB)) {
        return posA - posB;
      }
      const timeA = a.total_time_timestamp || 0;
      const timeB = b.total_time_timestamp || 0;
      if (timeA > 0 && timeB > 0) return timeA - timeB;
      if (timeA > 0 && timeB === 0) return -1;
      if (timeA === 0 && timeB > 0) return 1;
      return 0;
    });
  }, [participants]);

  // Formatea segundos (float o int) a mm:ss.mmm
  const formatTime = (timestamp) => {
    if (timestamp === null || timestamp === undefined || isNaN(timestamp) || Number(timestamp) <= 0) {
      return '—';
    }
    const totalMs = Math.round(Number(timestamp) * 1000);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Formatea mejor vuelta (float o string) a mm:ss.mmm
  const formatBestLap = (bestLap) => {
    if (!bestLap || isNaN(Number(bestLap)) || Number(bestLap) <= 0) return '—';
    const lap = Number(bestLap);
    const minutes = Math.floor(lap / 60);
    const seconds = Math.floor(lap % 60);
    const milliseconds = Math.round((lap - Math.floor(lap)) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const getPositionClass = (position) => {
    switch (position) {
      case 1:
        return 'position-gold';
      case 2:
        return 'position-silver';
      case 3:
        return 'position-bronze';
      default:
        return '';
    }
  };

  const formatGap = (seconds) => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
    const corrected = Math.round(seconds * 1000) / 1000;
    return formatTimeDiff(corrected);
  };

  const showPointsColumn = orderedParticipants.some(
    (p) => p.points !== undefined && p.points !== null
  );

  const participantsWithGaps = orderedParticipants.map((participant, index) => {
    const cur = participant.total_time_timestamp || 0;
    const leader = orderedParticipants[0]?.total_time_timestamp || 0;
    const prev =
      index > 0 ? orderedParticipants[index - 1].total_time_timestamp || 0 : 0;

    let leaderGap = null;
    if (index > 0 && leader > 0 && cur > 0) {
      leaderGap = cur - leader;
    }

    let previousGap = null;
    if (index > 0 && prev > 0 && cur > 0) {
      previousGap = cur - prev;
    }

    return {
      ...participant,
      leaderGap,
      previousGap
    };
  });

  return (
    <div className="live-ranking-table">
      <div className="table-title-block">
        <h2 className="table-title">Clasificación general</h2>
        <p className="table-subtitle">Orden por puntos y tiempo · Se actualiza automáticamente</p>
      </div>
      <div className="table-container">
        <table className="ranking-table">
          <thead>
            <tr>
              <th className="position-col">Pos</th>
              <th className="driver-col">Piloto</th>
              <th className="vehicle-col">Vehículo</th>
              <th className="time-col">Tiempo Total</th>
              <th className="penalty-col">Penalización</th>
              <th className="best-lap-col">Mejor Vuelta</th>
              <th className="gap-leader-col">Dif. Líder</th>
              <th className="gap-previous-col">Dif. Anterior</th>
              {showPointsColumn && <th className="points-col">Puntos</th>}
            </tr>
          </thead>
          <tbody>
            {participantsWithGaps.map((participant) => {
              const position = Number(participant.position) || 0;
              const dispPos = position > 0 ? position : '—';

              return (
                <tr key={participant.id} className={getPositionClass(position)}>
                  <td className="position-cell">
                    <span className="position-number">{dispPos}</span>
                  </td>
                  <td className="driver-cell">
                    <div className="driver-info">
                      <span className="driver-name">{participant.driver_name}</span>
                      {participant.team_name && (
                        <span className="team-name">{participant.team_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="vehicle-cell">
                    <div className="vehicle-info">
                      <span className="vehicle-name">{participant.vehicle_name}</span>
                      <span className="vehicle-brand">{participant.vehicle_brand}</span>
                    </div>
                  </td>
                  <td className="time-cell">
                    <span className="total-time">
                      {formatTime(participant.total_time_timestamp)}
                    </span>
                  </td>
                  <td className="penalty-cell">
                    {participant.penalties > 0 ? (
                      <span className="penalty-time">+{formatTime(participant.penalties)}</span>
                    ) : (
                      <span className="no-penalty">-</span>
                    )}
                  </td>
                  <td className="best-lap-cell">
                    <span className="best-lap-time">
                      {formatBestLap(participant.best_lap)}
                    </span>
                  </td>
                  <td className="gap-leader-cell">
                    <span className="gap-leader">
                      {participant.leaderGap == null
                        ? '—'
                        : formatGap(participant.leaderGap)}
                    </span>
                  </td>
                  <td className="gap-previous-cell">
                    <span className="gap-previous">
                      {participant.previousGap == null
                        ? '—'
                        : formatGap(participant.previousGap)}
                    </span>
                  </td>
                  {showPointsColumn && (
                    <td className="points-cell">
                      {participant.points != null ? participant.points : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveRankingTable;
