import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trophy, ExternalLink, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const APPEARANCE_VARIANT = {
  result: 'secondary',
  dns: 'outline',
  dsq: 'destructive',
  absent: 'outline',
  pending: 'outline',
};

const LeagueMySeason = ({ season, showEmail = false }) => {
  const { t } = useTranslation('leagues');

  if (!season) return null;

  if (!season.found) {
    return (
      <div className="space-y-3" data-testid="league-my-season-empty">
        <h2 className="text-lg font-semibold">{t('mySeason.titleFallback')}</h2>
        <p className="text-sm text-muted-foreground">
          {season.empty_reason === 'no_competitions'
            ? t('mySeason.emptyNoCompetitions')
            : t('mySeason.emptyNotFound')}
        </p>
      </div>
    );
  }

  const title = season.is_self
    ? t('mySeason.titleSelf')
    : t('mySeason.titleOther', { name: season.participant?.name || t('mySeason.driverFallback') });

  return (
    <div className="space-y-5" data-testid="league-my-season">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('mySeason.kicker')}</p>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="size-4" />
          {title}
        </h2>
        {season.league?.name ? (
          <p className="text-sm text-muted-foreground mt-1">{season.league.name}</p>
        ) : null}
        {showEmail && season.participant?.email ? (
          <p className="text-xs text-muted-foreground">{season.participant.email}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3" data-testid="league-my-season-position">
          <p className="text-xs text-muted-foreground">{t('mySeason.position')}</p>
          <p className="text-2xl font-bold tabular-nums">{season.position ?? '—'}</p>
        </div>
        <div className="rounded-lg border p-3" data-testid="league-my-season-points">
          <p className="text-xs text-muted-foreground">{t('mySeason.points')}</p>
          <p className="text-2xl font-bold tabular-nums">{season.total_points}</p>
          <p className="text-[11px] text-muted-foreground">{t('mySeason.pointsHint')}</p>
        </div>
      </div>

      <Alert>
        <Info className="size-4" />
        <AlertTitle>{t('mySeason.helpTitle')}</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            {season.counting_races
              ? t('mySeason.helpCounting', { count: season.counting_races })
              : t('mySeason.helpCountingUnset')}
          </p>
          <p>{t('mySeason.helpDnsVsAbsent')}</p>
        </AlertDescription>
      </Alert>

      {season.empty_reason === 'no_competitions' ? (
        <p className="text-sm text-muted-foreground" data-testid="league-my-season-no-races">
          {t('mySeason.emptyNoCompetitions')}
        </p>
      ) : null}

      {season.empty_reason === 'no_results' ? (
        <p className="text-sm text-muted-foreground" data-testid="league-my-season-no-results">
          {t('mySeason.emptyNoResults')}
        </p>
      ) : null}

      {season.counting_races && season.dropped?.length ? (
        <section data-testid="league-my-season-dropped">
          <h3 className="text-sm font-semibold mb-2">{t('mySeason.droppedTitle')}</h3>
          <ul className="space-y-2">
            {season.dropped.map((race) => (
              <li
                key={race.competition_id}
                className="flex items-start justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{race.competition_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`mySeason.appearance.${race.appearance}`)}
                    {race.points != null ? ` · ${t('mySeason.pointsValue', { points: race.points })}` : ''}
                    {race.position != null ? ` · ${t('mySeason.place', { n: race.position })}` : ''}
                  </p>
                </div>
                <Badge variant="outline">{t('mySeason.droppedBadge')}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : season.counting_races ? (
        <p className="text-xs text-muted-foreground">{t('mySeason.droppedEmpty')}</p>
      ) : null}

      {season.counting?.length ? (
        <section data-testid="league-my-season-counting">
          <h3 className="text-sm font-semibold mb-2">{t('mySeason.countingTitle')}</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {season.counting.map((race) => (
              <li key={race.competition_id}>
                {race.competition_name}
                {race.points != null ? ` · ${t('mySeason.pointsValue', { points: race.points })}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {season.races?.length ? (
        <section data-testid="league-my-season-races">
          <h3 className="text-sm font-semibold mb-2">{t('mySeason.racesTitle')}</h3>
          <ul className="divide-y rounded-md border">
            {season.races.map((race) => (
              <li key={race.competition_id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{race.competition_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {race.points != null
                        ? t('mySeason.pointsValue', { points: race.points })
                        : t('mySeason.noPoints')}
                      {race.position != null ? ` · ${t('mySeason.place', { n: race.position })}` : ''}
                      {race.vehicle ? ` · ${race.vehicle}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={APPEARANCE_VARIANT[race.appearance] || 'outline'}>
                      {t(`mySeason.appearance.${race.appearance}`)}
                    </Badge>
                    {race.dropped ? <Badge variant="outline">{t('mySeason.droppedBadge')}</Badge> : null}
                    {race.counts ? <Badge>{t('mySeason.countsBadge')}</Badge> : null}
                  </div>
                </div>
                {race.public_path ? (
                  <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                    <Link to={race.public_path}>
                      {t('mySeason.openRace')}
                      <ExternalLink className="size-3 ml-1" />
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default LeagueMySeason;
