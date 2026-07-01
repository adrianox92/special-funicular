import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';
import { getRecordedFromLabel, isLapTimerSession } from '../utils/recordedFromLabel';
import { formatDate, getIntlLocale } from '../utils/formatUtils';

function lapSeconds(timeStr) {
  if (!timeStr) return null;
  const [minutes, seconds] = timeStr.split(':');
  const [secs, ms] = (seconds || '0.0').split('.');
  return parseInt(minutes, 10) * 60 + parseInt(secs, 10) + parseInt((ms || '0').padStart(3, '0'), 10) / 1000;
}

/**
 * Colapsa sesiones duplicadas sincronizadas desde varias fuentes (mismo coche/circuito/carril/tiempo ~).
 * @param {Array} sessions
 */
export function deduplicateMultiSourceSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.timing_date).getTime() - new Date(a.timing_date).getTime(),
  );
  const kept = [];

  for (const session of sorted) {
    const sec = lapSeconds(session.best_lap_time);
    const dateMs = new Date(session.timing_date).getTime();
    const duplicateIdx = kept.findIndex((k) => {
      if (k.vehicle_id !== session.vehicle_id) return false;
      if ((k.circuit_id || k.circuit) !== (session.circuit_id || session.circuit)) return false;
      if (String(k.lane || '') !== String(session.lane || '')) return false;
      const kSec = lapSeconds(k.best_lap_time);
      if (sec == null || kSec == null || Math.abs(sec - kSec) > 0.05) return false;
      const kDate = new Date(k._primary?.timing_date || k.timing_date).getTime();
      return Math.abs(dateMs - kDate) <= 5 * 60 * 1000;
    });

    if (duplicateIdx >= 0) {
      const existing = kept[duplicateIdx];
      const sources = new Set(existing._sources || [existing._primary?.recorded_from || existing.recorded_from || 'web']);
      sources.add(session.recorded_from || 'web');
      existing._sources = [...sources];
      if (!existing._mergedIds) existing._mergedIds = [existing._primary?.id ?? existing.id];
      if (session.id != null) existing._mergedIds.push(session.id);
    } else {
      kept.push({
        ...session,
        _primary: session,
        _sources: [session.recorded_from || 'web'],
        _mergedIds: session.id != null ? [session.id] : [],
      });
    }
  }

  return kept.sort((a, b) => new Date(b.timing_date).getTime() - new Date(a.timing_date).getTime());
}

function getSessionVehicleLabel(session, fallbackLabel = '') {
  const fromSession = [session.vehicle_manufacturer, session.vehicle_model].filter(Boolean).join(' ').trim();
  return fromSession || fallbackLabel || null;
}

function SessionVehicleLabel({ session, fallbackLabel = '' }) {
  const label = getSessionVehicleLabel(session, fallbackLabel);
  if (!label) return null;

  if (session.vehicle_id) {
    return (
      <Link
        to={`/vehicles/${session.vehicle_id}`}
        className="text-sm font-medium text-primary hover:underline break-words"
      >
        {label}
      </Link>
    );
  }

  return <span className="text-sm font-medium break-words">{label}</span>;
}

function SourceBadges({ sources }) {
  const unique = [...new Set(sources || [])].filter(Boolean);
  if (unique.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {unique.map((src) => {
        const label = getRecordedFromLabel(src);
        if (!label) return null;
        return (
          <Badge
            key={src}
            variant={isLapTimerSession(src) ? 'default' : 'outline'}
            className="text-[10px]"
          >
            {label}
          </Badge>
        );
      })}
      {unique.length > 1 && (
        <Badge variant="secondary" className="text-[10px]">
          {unique.length}×
        </Badge>
      )}
    </div>
  );
}

/**
 * Timeline agrupado por día con badges recorded_from y deduplicación básica.
 */
export default function SessionTimeline({ sessions = [], vehicleLabel = '', defaultExpanded = false }) {
  const { t } = useTranslation('timings');
  const locale = getIntlLocale();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const deduped = useMemo(() => deduplicateMultiSourceSessions(sessions), [sessions]);

  const byDay = useMemo(() => {
    const map = new Map();
    deduped.forEach((s) => {
      const dayKey = String(s.timing_date || '').slice(0, 10);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey).push(s);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [deduped]);

  if (deduped.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 mt-0.5"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-controls="session-timeline-content"
            title={expanded ? t('timelineCollapse') : t('timelineExpand')}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
          <button
            type="button"
            className={cn(
              'min-w-0 flex-1 text-left rounded-md -m-1 p-1',
              'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-controls="session-timeline-content"
          >
            <CardTitle className="text-base">{t('timelineTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">{t('timelineHint')}</p>
          </button>
        </div>
      </CardHeader>
      {expanded && (
      <CardContent id="session-timeline-content" className="space-y-4 pt-0">
        {byDay.map(([day, daySessions]) => (
          <div key={day} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {formatDate(`${day}T12:00:00`, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <ul className="space-y-2 border-l-2 border-border ml-2 pl-3">
              {daySessions.map((s, idx) => (
                <li key={`${s.id}-${idx}`} className="text-sm space-y-1">
                  <SessionVehicleLabel session={s} fallbackLabel={vehicleLabel} />
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <span className="font-mono font-medium">{s.best_lap_time}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(s.timing_date).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[s.circuit || s.circuits?.name, s.lane ? t('lane', { lane: s.lane }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <SourceBadges sources={s._sources} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
      )}
    </Card>
  );
}

export { SourceBadges };
