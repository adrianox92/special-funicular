import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ExternalLink, MapPin, UserPlus } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import CompetitionStatusBadge from '../CompetitionStatusBadge';
import { competitionDetailPath } from '../../utils/competitionRoutes';
import { getIntlLocale } from '../../utils/formatUtils';
import {
  CALENDAR_PHASES,
  groupLeagueCalendarItems,
  parseLeagueDate,
} from '../../utils/leagueSeasonCalendar';
import { cn } from '../../lib/utils';

function formatCalendarDate(value, locale) {
  const d = parseLeagueDate(value);
  if (!d) return null;
  return d.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDeadline(value, locale) {
  if (!value) return null;
  const d = parseLeagueDate(value) || new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

const PHASE_BADGE = {
  upcoming: 'outline',
  running: 'default',
  completed: 'secondary',
};

function CalendarItem({ item, variant, t, locale }) {
  const dateLabel = formatCalendarDate(item.event_date, locale);
  const deadline = formatDeadline(item.registration_deadline, locale);
  const orderLabel =
    item.order_index != null && Number.isFinite(Number(item.order_index))
      ? t('calendar.orderIndex', { n: Number(item.order_index) + 1 })
      : null;
  const slug = item.public_slug;
  const showSignup =
    Boolean(slug) && (item.status === 'published' || item.status === 'running');
  const showPublicStatus = Boolean(slug) && (item.status === 'running' || item.status === 'closed');

  return (
    <li>
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {orderLabel ? <Badge variant="outline">{orderLabel}</Badge> : null}
              <span className="font-medium">{item.name}</span>
              <Badge variant={PHASE_BADGE[item.calendar_phase] || 'outline'}>
                {t(`calendar.phase.${item.calendar_phase}`)}
              </Badge>
              <CompetitionStatusBadge status={item.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {dateLabel || t('calendar.noDate')}
              {item.circuit_name ? (
                <span className="inline-flex items-center gap-1">
                  {' · '}
                  <MapPin className="inline size-3.5" aria-hidden />
                  {item.circuit_name}
                </span>
              ) : null}
            </p>
            {item.date_source === 'club_event' && dateLabel ? (
              <p className="text-xs text-muted-foreground">{t('calendar.dateFromClubEvent')}</p>
            ) : null}
            {deadline ? (
              <p className="text-xs text-muted-foreground">
                {t('calendar.signupUntil', { date: deadline })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {variant === 'organizer' ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={competitionDetailPath(item.id)}>
                  <ExternalLink className="mr-2 size-4" />
                  {t('calendar.manage')}
                </Link>
              </Button>
            ) : null}
            {showSignup ? (
              <Button size="sm" variant={variant === 'organizer' ? 'outline' : 'default'} asChild>
                <Link to={`/competitions/signup/${encodeURIComponent(slug)}`}>
                  <UserPlus className="mr-2 size-4" />
                  {t('calendar.signup')}
                </Link>
              </Button>
            ) : null}
            {showPublicStatus ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/competitions/status/${encodeURIComponent(slug)}`}>
                  {t('calendar.publicStatus')}
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

/**
 * Vista calendario de temporada: próximas / en curso / disputadas.
 * @param {{ competitions?: Array, variant?: 'organizer'|'public', compact?: boolean, className?: string, showTitle?: boolean }} props
 */
const LeagueSeasonCalendar = ({
  competitions = [],
  variant = 'public',
  compact = false,
  className,
  showTitle = true,
}) => {
  const { t } = useTranslation('leagues');
  const locale = getIntlLocale();
  const [filter, setFilter] = useState('all');

  const grouped = useMemo(
    () => groupLeagueCalendarItems(competitions, { publicOnly: variant === 'public' }),
    [competitions, variant],
  );

  const sections = useMemo(() => {
    if (filter === 'all') return CALENDAR_PHASES;
    return CALENDAR_PHASES.filter((p) => p === filter);
  }, [filter]);

  if (grouped.items.length === 0) {
    return (
      <Card className={cn('border-dashed bg-muted/20', className)}>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {(competitions || []).length === 0
            ? t('calendar.empty')
            : t('calendar.emptyPublic')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showTitle ? (
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="size-5" aria-hidden />
            {t('calendar.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('calendar.subtitle')}</p>
        </div>
      ) : null}

      {!compact ? (
        <div
          className="inline-flex w-full max-w-full flex-wrap rounded-lg border border-border bg-muted/30 p-0.5 sm:w-auto"
          role="group"
          aria-label={t('calendar.filterLabel')}
        >
          {['all', ...CALENDAR_PHASES].map((key) => (
            <Button
              key={key}
              type="button"
              variant={filter === key ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-8 rounded-md px-3', filter === key && 'shadow-sm')}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
            >
              {t(`calendar.filter.${key}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {!grouped.hasDates ? (
        <p className="text-xs text-muted-foreground">{t('calendar.noDatesHint')}</p>
      ) : null}

      {sections.map((phase) => {
        const items = grouped[phase];
        if (!items.length) {
          if (filter !== 'all') {
            return (
              <Card key={phase} className="border-dashed bg-muted/20">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t('calendar.emptySection')}
                </CardContent>
              </Card>
            );
          }
          return null;
        }
        return (
          <section key={phase} className="space-y-2" aria-labelledby={`league-cal-${phase}`}>
            <h3 id={`league-cal-${phase}`} className="text-base font-semibold">
              {t(`calendar.section.${phase}`)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {items.length}
              </span>
            </h3>
            <ul className="space-y-2">
              {items.map((item) => (
                <CalendarItem
                  key={item.id}
                  item={item}
                  variant={variant}
                  t={t}
                  locale={locale}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

export default LeagueSeasonCalendar;
