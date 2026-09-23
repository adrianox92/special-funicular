import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '../ui/alert';
import CompetitionRulesPanel from '../CompetitionRulesPanel';
import LeagueRulesHelp from './LeagueRulesHelp';

const LeagueRulesTab = ({
  leagueId,
  scoringMode,
  countingRaces = null,
  tiebreakMode = null,
}) => {
  const { t } = useTranslation('leagues');

  return (
    <div className="space-y-4">
      <LeagueRulesHelp
        countingRaces={countingRaces}
        tiebreakMode={tiebreakMode}
        variant="inline"
        context="settings"
      />
      {scoringMode !== 'league_rules' ? (
        <Alert>
          <AlertDescription>
            {t('scoring.perCompetition')}
          </AlertDescription>
        </Alert>
      ) : (
        <CompetitionRulesPanel
          leagueId={leagueId}
          onRuleChange={() => {}}
        />
      )}
    </div>
  );
};

export default LeagueRulesTab;
