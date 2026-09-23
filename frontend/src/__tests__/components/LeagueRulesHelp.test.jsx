import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (key === 'rules.drops.counting') return `Cuentan las ${opts?.count} mejores`;
      if (key === 'rules.tiebreak.current') return `En esta liga: ${opts?.mode}`;
      return key;
    },
  }),
}));

import LeagueRulesHelp, { LeagueRulesHelpContent } from '../../components/league/LeagueRulesHelp';

const CRITICAL_KEYS = [
  'rules.drops.title',
  'rules.drops.meaning',
  'rules.dns.title',
  'rules.dns.body',
  'rules.absent.title',
  'rules.absent.body',
  'rules.dnf.title',
  'rules.dnf.body',
  'rules.dsq.title',
  'rules.dsq.body',
  'rules.tiebreak.title',
  'rules.tiebreak.modes.competitions_completed',
  'rules.tiebreak.modes.most_wins',
  'rules.tiebreak.modes.last_race_position',
  'rules.override.title',
  'rules.override.priority',
  'rules.scoringEvents.title',
  'rules.scoringEvents.closed',
  'rules.scoringEvents.runningPublished',
];

describe('LeagueRulesHelp', () => {
  test('inline renderiza claves críticas alineadas con el motor', () => {
    render(
      <LeagueRulesHelp
        countingRaces={4}
        tiebreakMode="most_wins"
        variant="inline"
        context="settings"
      />,
    );

    expect(screen.getByTestId('league-rules-help-inline')).toBeInTheDocument();
    fireEvent.click(screen.getByText('rules.openSettings'));

    const panel = screen.getByTestId('league-rules-help');
    CRITICAL_KEYS.forEach((key) => {
      expect(panel).toHaveTextContent(key);
    });
    expect(panel).toHaveTextContent('Cuentan las 4 mejores');
    expect(screen.getByTestId('league-rules-tiebreak-most_wins')).toBeInTheDocument();
    expect(screen.getByTestId('league-rules-override')).toHaveTextContent('rules.override.priority');
    expect(screen.getByTestId('league-rules-scoring')).toHaveTextContent(
      'rules.scoringEvents.runningPublished',
    );
  });

  test('dialog abre el panel con DNS vs no figura y Ajustado', () => {
    render(<LeagueRulesHelp countingRaces={null} tiebreakMode="competitions_completed" />);
    fireEvent.click(screen.getByTestId('league-rules-help-trigger'));
    const panel = screen.getByTestId('league-rules-help');
    expect(panel).toHaveTextContent('rules.drops.unset');
    expect(panel).toHaveTextContent('rules.dns.body');
    expect(panel).toHaveTextContent('rules.absent.body');
    expect(panel).toHaveTextContent('rules.override.title');
  });

  test('contenido suelto documenta DNF y estados closed/running/published', () => {
    render(<LeagueRulesHelpContent countingRaces={2} tiebreakMode="last_race_position" />);
    expect(screen.getByTestId('league-rules-dnf')).toHaveTextContent('rules.dnf.body');
    expect(screen.getByTestId('league-rules-scoring')).toHaveTextContent('rules.scoringEvents.closed');
    expect(screen.getByTestId('league-rules-scoring')).toHaveTextContent(
      'rules.scoringEvents.runningPublished',
    );
    expect(screen.getByTestId('league-rules-tiebreak-last_race_position')).toBeInTheDocument();
  });
});
