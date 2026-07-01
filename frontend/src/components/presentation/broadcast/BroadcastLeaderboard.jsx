import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatTimeFromSeconds,
  formatBestLapFromSeconds,
  formatGapSeconds,
  formatPenaltySeconds,
} from '../../../utils/presentationFormatters';
import { useLeaderboardHighlight } from './useLeaderboardHighlight';

const OVERLAY_SCROLL_PX_PER_SEC = 28;
const OVERLAY_SCROLL_PAUSE_START_MS = 1800;
const OVERLAY_SCROLL_PAUSE_END_MS = 2400;

function useOverlayAutoScroll(containerRef, enabled, itemCount) {
  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    let phase = 'start-pause';
    let phaseEndsAt = performance.now() + OVERLAY_SCROLL_PAUSE_START_MS;
    let lastFrame = 0;

    const step = (now) => {
      const el = containerRef.current;
      if (!el) {
        rafId = requestAnimationFrame(step);
        return;
      }

      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      if (maxScroll <= 4) {
        el.scrollTop = 0;
        rafId = requestAnimationFrame(step);
        return;
      }

      if (phase === 'start-pause' || phase === 'end-pause') {
        if (now >= phaseEndsAt) {
          if (phase === 'end-pause') {
            el.scrollTop = 0;
            phase = 'start-pause';
            phaseEndsAt = now + OVERLAY_SCROLL_PAUSE_START_MS;
          } else {
            phase = 'scrolling';
            lastFrame = now;
          }
        }
      } else if (phase === 'scrolling') {
        const dt = Math.min((now - lastFrame) / 1000, 0.05);
        lastFrame = now;
        const next = el.scrollTop + OVERLAY_SCROLL_PX_PER_SEC * dt;
        if (next >= maxScroll) {
          el.scrollTop = maxScroll;
          phase = 'end-pause';
          phaseEndsAt = now + OVERLAY_SCROLL_PAUSE_END_MS;
        } else {
          el.scrollTop = next;
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [containerRef, enabled, itemCount]);
}

const BroadcastLeaderboard = ({
  participants,
  title,
  subtitle,
  autoScroll = false,
  compact = false,
}) => {
  const { t } = useTranslation('presentation');
  const scrollRef = useRef(null);
  const { getHighlightClass } = useLeaderboardHighlight(participants);

  const ordered = useMemo(
    () =>
      [...participants].sort((a, b) => {
        const posA = Number(a.position);
        const posB = Number(b.position);
        if (Number.isFinite(posA) && Number.isFinite(posB)) return posA - posB;
        return (a.total_time_timestamp || 0) - (b.total_time_timestamp || 0);
      }),
    [participants],
  );

  const showPoints = ordered.some((p) => p.points != null);
  const showPenalty = ordered.some((p) => Number(p.penalties) > 0);
  const showLaps = ordered.some((p) => Number(p.total_laps) > 0);
  const showPowerStage = ordered.some((p) => Number(p.power_stage_points) > 0);

  const withGaps = useMemo(() => {
    const leader = ordered[0]?.total_time_timestamp || 0;
    return ordered.map((p, index) => {
      const cur = p.total_time_timestamp || 0;
      const prev = index > 0 ? ordered[index - 1].total_time_timestamp || 0 : 0;
      return {
        ...p,
        leaderGap: index > 0 && leader > 0 && cur > 0 ? cur - leader : null,
        previousGap: index > 0 && prev > 0 && cur > 0 ? cur - prev : null,
      };
    });
  }, [ordered]);

  useOverlayAutoScroll(scrollRef, autoScroll, withGaps.length);

  const getPositionClass = (pos) => {
    if (pos === 1) return 'broadcast-pos-gold';
    if (pos === 2) return 'broadcast-pos-silver';
    if (pos === 3) return 'broadcast-pos-bronze';
    return '';
  };

  return (
    <section
      className={`broadcast-panel broadcast-leaderboard${autoScroll ? ' broadcast-leaderboard--scroll' : ''}${compact ? ' broadcast-leaderboard--compact' : ''}`}
      aria-live="polite"
    >
      {(title || subtitle) && (
        <div className="broadcast-panel-header">
          {title && <h2 className="broadcast-panel-title">{title}</h2>}
          {subtitle && <p className="broadcast-panel-subtitle">{subtitle}</p>}
        </div>
      )}
      <div
        ref={scrollRef}
        className={`broadcast-table-wrap${autoScroll ? ' broadcast-table-wrap--scroll' : ''}`}
      >
        <table className="broadcast-table">
          <thead>
            <tr>
              <th>{t('colPosition')}</th>
              <th>{t('colDriver')}</th>
              <th className="broadcast-col-vehicle">{t('colVehicle')}</th>
              <th>{t('colTotalTime')}</th>
              {showPenalty && <th className="broadcast-col-secondary">{t('colPenalty')}</th>}
              <th className="broadcast-col-secondary">{t('colBestLap')}</th>
              <th className="broadcast-col-gap">{t('colGapLeader')}</th>
              <th className="broadcast-col-gap">{t('colGapPrevious')}</th>
              {showLaps && <th className="broadcast-col-secondary">{t('colLaps')}</th>}
              {showPowerStage && <th className="broadcast-col-secondary">{t('colPowerStage')}</th>}
              {showPoints && <th>{t('colPoints')}</th>}
            </tr>
          </thead>
          <tbody>
            {withGaps.map((p) => {
              const pos = Number(p.position) || 0;
              const highlight = getHighlightClass(p.id);
              return (
                <tr
                  key={p.id}
                  className={`${getPositionClass(pos)}${highlight ? ` broadcast-row-${highlight}` : ''}`}
                >
                  <td className="broadcast-cell-pos">{pos > 0 ? pos : '—'}</td>
                  <td>
                    <div className="broadcast-driver">
                      <span className="broadcast-driver-name">{p.driver_name}</span>
                      {p.team_name && <span className="broadcast-driver-team">{p.team_name}</span>}
                    </div>
                  </td>
                  <td className="broadcast-col-vehicle">
                    <div className="broadcast-vehicle">
                      <span>{p.vehicle_name}</span>
                      {p.vehicle_brand && <span className="broadcast-vehicle-brand">{p.vehicle_brand}</span>}
                    </div>
                  </td>
                  <td className="broadcast-cell-time">{formatTimeFromSeconds(p.total_time_timestamp)}</td>
                  {showPenalty && (
                    <td className="broadcast-col-secondary broadcast-cell-penalty">
                      {Number(p.penalties) > 0 ? formatPenaltySeconds(p.penalties) : '—'}
                    </td>
                  )}
                  <td className="broadcast-col-secondary broadcast-cell-lap">
                    {formatBestLapFromSeconds(p.best_lap)}
                  </td>
                  <td className="broadcast-col-gap">{formatGapSeconds(p.leaderGap)}</td>
                  <td className="broadcast-col-gap">{formatGapSeconds(p.previousGap)}</td>
                  {showLaps && (
                    <td className="broadcast-col-secondary">{p.total_laps ?? '—'}</td>
                  )}
                  {showPowerStage && (
                    <td className="broadcast-col-secondary">{p.power_stage_points ?? '—'}</td>
                  )}
                  {showPoints && <td className="broadcast-cell-points">{p.points ?? '—'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default BroadcastLeaderboard;
