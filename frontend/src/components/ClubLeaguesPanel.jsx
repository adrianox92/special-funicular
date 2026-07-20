import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

const ClubLeaguesPanel = ({ leagues = [] }) => {
  const { t } = useTranslation('clubs');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('detail.leaguesTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {leagues.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.leaguesEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {leagues.map((lg) => (
              <li
                key={lg.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-md p-3"
              >
                <div>
                  <Link to={`/leagues/${lg.id}`} className="font-medium hover:underline">
                    {lg.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('detail.leaguesMeta', {
                      competitions: lg.competitions_count ?? 0,
                      participants: lg.participants_count ?? 0,
                    })}
                  </p>
                </div>
                <Badge variant="outline">{lg.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default ClubLeaguesPanel;
