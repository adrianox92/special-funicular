import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users, Loader2, Building2 } from 'lucide-react';
import axios from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { ResponsiveTabsNav } from '../components/ui/responsive-tabs-nav';
import ClubCalendar from '../components/ClubCalendar';
import ClubBoard from '../components/ClubBoard';
import ClubCircuits from '../components/ClubCircuits';
import ClubLeaguesPanel from '../components/ClubLeaguesPanel';
import ClubMembersPanel from '../components/ClubMembersPanel';
import ClubProfileDialog from '../components/ClubProfileDialog';
import { buildClubTabOptions, resolveClubTab } from '../constants/clubTabs';

const ClubMembers = () => {
  const { id: clubId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation('clubs');

  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [guestMembers, setGuestMembers] = useState([]);
  const [clubCircuits, setClubCircuits] = useState([]);
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);
      const clubRes = await axios.get(`/clubs/${clubId}`);
      setClub(clubRes.data);
      const isManager =
        clubRes.data?.my_role === 'admin' || user?.id === clubRes.data?.owner_user_id;

      if (isManager) {
        const [membersRes, guestRes, circuitsRes] = await Promise.all([
          axios.get(`/clubs/${clubId}/members`),
          axios.get(`/clubs/${clubId}/guest-members`),
          axios.get(`/clubs/${clubId}/circuits`),
        ]);
        const payload = membersRes.data;
        const list = Array.isArray(payload?.members) ? payload.members : Array.isArray(payload) ? payload : [];
        setMembers(list);
        setOwnerUserId(payload?.owner_user_id ?? clubRes.data?.owner_user_id ?? null);
        setGuestMembers(Array.isArray(guestRes.data?.guest_members) ? guestRes.data.guest_members : []);
        setClubCircuits(Array.isArray(circuitsRes.data) ? circuitsRes.data : []);
      } else {
        setMembers([]);
        setGuestMembers([]);
        setClubCircuits([]);
        setOwnerUserId(clubRes.data?.owner_user_id ?? null);
      }
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || t('detail.loadError'));
      setClub(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [clubId, user?.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = club && (club.my_role === 'admin' || user?.id === club.owner_user_id);

  const tabParam = searchParams.get('tab');
  const activeTab = resolveClubTab(tabParam, canManage);

  const tabOptions = useMemo(() => buildClubTabOptions(canManage, t), [canManage, t]);

  const onTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate('/clubs')}>
          <ArrowLeft className="size-4" />
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate('/clubs')}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">{t('detail.back')}</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {canManage ? <Users className="size-7" /> : <Building2 className="size-7" />}
              {club.name}
            </h1>
            <p className="text-muted-foreground">
              {canManage ? t('detail.subtitleAdmin') : t('detail.subtitleMember')}
            </p>
          </div>
        </div>
        {canManage && club.slug ? (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`${window.location.origin}/club/${encodeURIComponent(club.slug)}`, '_blank', 'noopener,noreferrer')
              }
            >
              {t('detail.viewPublic')}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setProfileOpen(true)}>
              {t('detail.editPublic')}
            </Button>
          </div>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <ResponsiveTabsNav
          value={activeTab}
          onValueChange={onTabChange}
          options={tabOptions}
          listClassName={canManage ? 'max-w-4xl sm:grid-cols-2 md:grid-cols-5' : 'max-w-2xl sm:grid-cols-2 md:grid-cols-4'}
          triggerClassName="gap-2"
          mobileLabel={t('detail.sectionLabel')}
        />

        {canManage ? (
          <TabsContent value="members" className="mt-4">
            <ClubMembersPanel
              clubId={clubId}
              members={members}
              guestMembers={guestMembers}
              ownerUserId={ownerUserId}
              clubCircuits={clubCircuits}
              onRefresh={load}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="board" className="mt-4">
          <ClubBoard clubId={clubId} canManage={canManage} />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <ClubCalendar clubId={clubId} canManage={canManage} />
        </TabsContent>
        <TabsContent value="circuits" className="mt-4">
          <ClubCircuits clubId={clubId} canManage={canManage} club={club} onClubUpdated={load} />
        </TabsContent>
        <TabsContent value="leagues" className="mt-4">
          <ClubLeaguesPanel leagues={club.leagues} />
        </TabsContent>
      </Tabs>

      {canManage ? (
        <ClubProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          clubId={clubId}
          club={club}
          onSaved={load}
        />
      ) : null}
    </div>
  );
};

export default ClubMembers;
