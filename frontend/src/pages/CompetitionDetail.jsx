import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import CompetitionDetailHeader from '../components/CompetitionDetailHeader';
import CompetitionParticipants from './CompetitionParticipants';
import CompetitionTimings from './CompetitionTimings';
import { resolveCompetitionSection } from '../utils/competitionRoutes';

const CompetitionDetail = () => {
  const { id: competitionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation('competitions');

  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const section = resolveCompetitionSection(searchParams.get('section'));

  const loadCompetition = useCallback(async () => {
    if (!competitionId) return;
    try {
      setLoading(true);
      setError(null);
      const { data } = await axios.get(`/competitions/${competitionId}`);
      setCompetition(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || t('detail.loadError'));
      setCompetition(null);
    } finally {
      setLoading(false);
    }
  }, [competitionId, t]);

  useEffect(() => {
    loadCompetition();
  }, [loadCompetition]);

  const onSectionChange = (value) => {
    const tab = searchParams.get('tab');
    const next = { section: value };
    if (value === 'setup' && tab) next.tab = tab;
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !competition) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate('/competitions')}>
          {t('detail.back')}
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error || t('detail.notFound')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CompetitionDetailHeader
        competition={competition}
        competitionId={competitionId}
        section={section}
        onSectionChange={onSectionChange}
        onRefresh={loadCompetition}
      />

      {section === 'setup' ? (
        <CompetitionParticipants embedded onCompetitionChange={loadCompetition} />
      ) : (
        <CompetitionTimings embedded />
      )}
    </div>
  );
};

export default CompetitionDetail;
