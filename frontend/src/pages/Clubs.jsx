import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  Link2,
  LogOut,
  Loader2,
  ChevronRight,
  Copy,
} from 'lucide-react';
import axios from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { useClubInvite } from '../hooks/useClubInvite';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';

const Clubs = () => {
  const { t } = useTranslation('clubs');
  const { user } = useAuth();
  const { joinWithToken } = useClubInvite();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/clubs/mine');
      setClubs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token?.trim()) return;
    (async () => {
      await joinWithToken(token);
      navigate('/clubs', { replace: true });
      load();
    })();
  }, [searchParams, navigate, load, joinWithToken]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    try {
      setCreating(true);
      await axios.post('/clubs', { name: createName.trim() });
      toast.success(t('list.created'));
      setCreateOpen(false);
      setCreateName('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || t('list.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (clubId) => {
    try {
      const { data } = await axios.post(`/clubs/${clubId}/invite`, { expires_in_days: 14 });
      const url = data.join_url || data.joinUrl;
      if (url && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success(t('invite.copied'));
      } else if (url) {
        toast.message(url);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || t('invite.error'));
    }
  };

  const handleLeave = async (club) => {
    if (!user?.id) {
      toast.error(t('list.sessionError'));
      return;
    }
    if (club.owner_user_id === user.id) {
      toast.error(t('list.ownerLeaveError'));
      return;
    }
    try {
      await axios.delete(`/clubs/${club.id}/members/${user.id}`);
      toast.success(t('list.left'));
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || t('list.leaveError'));
    }
  };

  const copyClubId = async (clubId) => {
    try {
      await navigator.clipboard.writeText(clubId);
      toast.success(t('list.uuidCopied'));
    } catch {
      toast.error(t('list.uuidCopyError'));
    }
  };

  const roleLabel = (club) => {
    if (user?.id && club.owner_user_id === user.id) return t('roles.owner');
    if (club.my_role === 'admin') return t('roles.admin');
    return t('roles.member');
  };

  const openClub = (club, tab) => {
    const defaultTab = tab || (club.my_role === 'admin' || club.owner_user_id === user?.id ? 'members' : 'board');
    navigate(`/clubs/${club.id}?tab=${defaultTab}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="size-7" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl">{t('list.subtitle')}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              {t('create')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>{t('list.createTitle')}</DialogTitle>
                <DialogDescription>{t('list.createDescription')}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="club-name">{t('list.nameLabel')}</Label>
                <Input
                  id="club-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('list.namePlaceholder')}
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {t('guestMembers.cancel')}
                </Button>
                <Button type="submit" disabled={creating || !createName.trim()}>
                  {creating ? t('list.creating') : t('create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{t('list.empty')}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clubs.map((c) => {
            const isOwner = user?.id && c.owner_user_id === user.id;
            const canInvite = c.my_role === 'admin' || isOwner;
            return (
              <Card key={c.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{c.name}</CardTitle>
                    <Badge variant="secondary">{roleLabel(c)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('list.licenseHint', { max: c.license_installations_max ?? 10 })}</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 flex-1">
                  <Button className="w-full gap-2 justify-between" onClick={() => openClub(c)}>
                    {t('list.openClub')}
                    <ChevronRight className="size-4" />
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {canInvite && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleInvite(c.id)}>
                        <Link2 className="size-3.5" />
                        {t('invite.action')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => copyClubId(c.id)}
                    >
                      <Copy className="size-3.5" />
                      {t('list.copyUuid')}
                    </Button>
                    {!isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive gap-1"
                        onClick={() => handleLeave(c)}
                      >
                        <LogOut className="size-3.5" />
                        {t('list.leave')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Clubs;
