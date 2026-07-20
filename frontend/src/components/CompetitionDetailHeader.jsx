import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Link2 } from 'lucide-react';
import axios from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs } from './ui/tabs';
import { ResponsiveTabsNav } from './ui/responsive-tabs-nav';
import CompetitionStatusBadge from './CompetitionStatusBadge';
import { toast } from 'sonner';
import { buildCompetitionSectionOptions } from '../constants/competitionSections';

const CompetitionDetailHeader = ({ competition, competitionId, section, onSectionChange, onRefresh }) => {
  const { t } = useTranslation('competitions');
  const navigate = useNavigate();
  const { user } = useAuth();

  const canUseOrganizerTools = Boolean(
    (user?.id && competition?.organizer === user.id) || isLicenseAdminUser(user),
  );
  const effectiveStatus = competition?.status || 'published';
  const sectionOptions = buildCompetitionSectionOptions(t);

  const patchStatus = async (status) => {
    if (!competitionId) return;
    try {
      await axios.patch(`/competitions/${competitionId}/status`, { status });
      toast.success(t('detail.statusUpdated'));
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || t('detail.statusUpdateError'));
    }
  };

  const handlePublicLink = () => {
    if (!competition?.public_slug) return;
    const url = `${window.location.origin}/competitions/signup/${competition.public_slug}`;
    if (canUseOrganizerTools) {
      navigator.clipboard?.writeText(url).then(
        () => toast.success(t('detail.signupLinkCopied')),
        () => toast.error(t('detail.signupLinkCopyError')),
      );
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!competition) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate('/competitions')}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">{t('detail.back')}</span>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{competition.name}</h1>
              <CompetitionStatusBadge status={competition.status} />
              {canUseOrganizerTools && (
                <>
                  {effectiveStatus === 'draft' && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => patchStatus('published')}>
                      {t('detail.publish')}
                    </Button>
                  )}
                  {effectiveStatus === 'published' && (
                    <Button type="button" size="sm" variant="outline" onClick={() => patchStatus('draft')}>
                      {t('detail.unpublish')}
                    </Button>
                  )}
                  {effectiveStatus === 'running' && (
                    <Button type="button" size="sm" variant="destructive" onClick={() => patchStatus('closed')}>
                      {t('detail.close')}
                    </Button>
                  )}
                  {effectiveStatus === 'closed' && (
                    <Button type="button" size="sm" variant="outline" onClick={() => patchStatus('published')}>
                      {t('detail.reopen')}
                    </Button>
                  )}
                </>
              )}
              {competition.league && (
                <Link to={`/leagues/${competition.league.id}`}>
                  <Badge variant="secondary" className="hover:bg-secondary/80">
                    {t('detail.leagueBadge', { name: competition.league.name })}
                  </Badge>
                </Link>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {canUseOrganizerTools ? t('detail.subtitleOrganizer') : t('detail.subtitleMember')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {competition.public_slug && (
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handlePublicLink}>
              <Link2 className="size-4" />
              {canUseOrganizerTools ? t('detail.copySignupLink') : t('detail.openSignup')}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={section} onValueChange={onSectionChange} className="w-full">
        <ResponsiveTabsNav
          value={section}
          onValueChange={onSectionChange}
          options={sectionOptions}
          listClassName="max-w-md sm:grid-cols-2"
          triggerClassName="gap-2"
          mobileLabel={t('detail.sectionLabel')}
        />
      </Tabs>
    </div>
  );
};

export default CompetitionDetailHeader;
