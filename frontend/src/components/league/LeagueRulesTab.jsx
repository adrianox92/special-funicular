import React from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import CompetitionRulesPanel from '../CompetitionRulesPanel';

const LeagueRulesTab = ({ leagueId, scoringMode }) => {
  if (scoringMode !== 'league_rules') {
    return (
      <Alert>
        <AlertDescription>
          Esta liga usa reglas de puntuación por competición. Configura las reglas en cada prueba individual.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <CompetitionRulesPanel
      leagueId={leagueId}
      onRuleChange={() => {}}
    />
  );
};

export default LeagueRulesTab;
