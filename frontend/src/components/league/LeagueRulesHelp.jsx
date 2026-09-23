import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Info } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

export const TIEBREAK_MODES = ['competitions_completed', 'most_wins', 'last_race_position'];

/**
 * Cuerpo de “Reglas de la liga”, alineado con leagueStandings:
 * descartes, DNS/DSQ/DNF, no figura, tiebreak, override y pruebas puntuables.
 */
export function LeagueRulesHelpContent({
  countingRaces = null,
  tiebreakMode = null,
}) {
  const { t } = useTranslation('leagues');
  const mode = TIEBREAK_MODES.includes(tiebreakMode)
    ? tiebreakMode
    : 'competitions_completed';

  return (
    <div className="space-y-5 text-sm" data-testid="league-rules-help">
      <section data-testid="league-rules-drops">
        <h3 className="font-semibold text-foreground">{t('rules.drops.title')}</h3>
        <p className="mt-1 text-muted-foreground">
          {countingRaces
            ? t('rules.drops.counting', { count: countingRaces })
            : t('rules.drops.unset')}
        </p>
        <p className="mt-1 text-muted-foreground">{t('rules.drops.meaning')}</p>
      </section>

      <section data-testid="league-rules-dns">
        <h3 className="font-semibold text-foreground">{t('rules.dns.title')}</h3>
        <p className="mt-1 text-muted-foreground">{t('rules.dns.body')}</p>
      </section>

      <section data-testid="league-rules-absent">
        <h3 className="font-semibold text-foreground">{t('rules.absent.title')}</h3>
        <p className="mt-1 text-muted-foreground">{t('rules.absent.body')}</p>
      </section>

      <section data-testid="league-rules-dnf">
        <h3 className="font-semibold text-foreground">{t('rules.dnf.title')}</h3>
        <p className="mt-1 text-muted-foreground">{t('rules.dnf.body')}</p>
      </section>

      <section data-testid="league-rules-dsq">
        <h3 className="font-semibold text-foreground">{t('rules.dsq.title')}</h3>
        <p className="mt-1 text-muted-foreground">{t('rules.dsq.body')}</p>
      </section>

      <section data-testid="league-rules-tiebreak">
        <h3 className="font-semibold text-foreground">{t('rules.tiebreak.title')}</h3>
        <p className="mt-1 text-muted-foreground">{t('rules.tiebreak.intro')}</p>
        <p className="mt-1 text-muted-foreground">
          {t('rules.tiebreak.current', { mode: t(`rules.tiebreak.modes.${mode}`) })}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          {TIEBREAK_MODES.map((key) => (
            <li key={key} data-testid={`league-rules-tiebreak-${key}`}>
              <span className="font-medium text-foreground">{t(`rules.tiebreak.labels.${key}`)}:</span>{' '}
              {t(`rules.tiebreak.modes.${key}`)}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">{t('rules.tiebreak.fallback')}</p>
      </section>

      <section data-testid="league-rules-override">
        <h3 className="font-semibold text-foreground">{t('rules.override.title')}</h3>
        <p className="mt-1 text-muted-foreground">{t('rules.override.body')}</p>
        <p className="mt-1 text-muted-foreground">{t('rules.override.priority')}</p>
      </section>

      <section data-testid="league-rules-scoring">
        <h3 className="font-semibold text-foreground">{t('rules.scoringEvents.title')}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          <li>{t('rules.scoringEvents.closed')}</li>
          <li>{t('rules.scoringEvents.runningPublished')}</li>
          <li>{t('rules.scoringEvents.other')}</li>
        </ul>
      </section>
    </div>
  );
}

const LeagueRulesHelp = ({
  countingRaces = null,
  tiebreakMode = null,
  variant = 'button',
  context = 'standings',
}) => {
  const { t } = useTranslation('leagues');
  const triggerLabel = context === 'settings' ? t('rules.openSettings') : t('rules.open');
  const title = t('rules.title');
  const subtitleKey = ['standings', 'mySeason', 'settings'].includes(context)
    ? `rules.subtitle.${context}`
    : 'rules.subtitle.standings';
  const subtitle = t(subtitleKey);

  const content = (
    <LeagueRulesHelpContent countingRaces={countingRaces} tiebreakMode={tiebreakMode} />
  );

  if (variant === 'inline') {
    return (
      <details
        className="rounded-md border bg-background px-3 py-2"
        data-testid="league-rules-help-inline"
      >
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          {triggerLabel}
        </summary>
        <div className="mt-3 border-t pt-3">
          <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
          {content}
        </div>
      </details>
    );
  }

  const trigger = variant === 'link' ? (
    <button
      type="button"
      className="text-xs text-primary underline-offset-2 hover:underline"
      data-testid="league-rules-help-trigger"
    >
      {triggerLabel}
    </button>
  ) : (
    <Button type="button" variant="outline" size="sm" data-testid="league-rules-help-trigger">
      <BookOpen className="size-4 mr-2" />
      {triggerLabel}
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="league-rules-help-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="size-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default LeagueRulesHelp;
