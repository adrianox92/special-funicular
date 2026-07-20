import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Link2, Clock } from 'lucide-react';
import axios from '../lib/axios';
import { useLocale } from '../hooks/useLocale';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import ClubGuestMemberTimings from './ClubGuestMemberTimings';

const ClubMembersPanel = ({
  clubId,
  members,
  guestMembers,
  ownerUserId,
  clubCircuits,
  onRefresh,
}) => {
  const { t } = useTranslation('clubs');
  const { formatDate } = useLocale();
  const gm = (key, opts) => t(`guestMembers.${key}`, opts);

  const [kickTarget, setKickTarget] = useState(null);
  const [roleUpdating, setRoleUpdating] = useState({});

  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: '', email: '' });
  const [guestSaving, setGuestSaving] = useState(false);
  const [editGuest, setEditGuest] = useState(null);
  const [editGuestForm, setEditGuestForm] = useState({ name: '', email: '' });
  const [editGuestSaving, setEditGuestSaving] = useState(false);
  const [deleteGuestTarget, setDeleteGuestTarget] = useState(null);
  const [linkGuestTarget, setLinkGuestTarget] = useState(null);
  const [linkUserId, setLinkUserId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [timingsGuest, setTimingsGuest] = useState(null);

  const linkableMembers = useMemo(
    () => members.filter((m) => m.user_id && !m.is_owner),
    [members],
  );

  const formatMemberDate = (iso) => {
    if (!iso) return '—';
    try {
      return formatDate(iso, { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const handleRoleChange = async (memberUserId, newRole) => {
    if (!clubId) return;
    setRoleUpdating((s) => ({ ...s, [memberUserId]: true }));
    try {
      await axios.patch(`/clubs/${clubId}/members/${memberUserId}`, { role: newRole });
      toast.success(t('detail.roleUpdated'));
      onRefresh?.();
    } catch (e) {
      toast.error(e.response?.data?.error || t('detail.roleUpdateError'));
    } finally {
      setRoleUpdating((s) => ({ ...s, [memberUserId]: false }));
    }
  };

  const confirmKick = async () => {
    if (!kickTarget || !clubId) return;
    try {
      await axios.delete(`/clubs/${clubId}/members/${kickTarget.user_id}`);
      toast.success(t('detail.memberKicked'));
      setKickTarget(null);
      onRefresh?.();
    } catch (e) {
      toast.error(e.response?.data?.error || t('detail.kickError'));
    }
  };

  const createGuestMember = async () => {
    if (!clubId || !guestForm.name.trim()) {
      toast.error(gm('nameRequired'));
      return;
    }
    try {
      setGuestSaving(true);
      await axios.post(`/clubs/${clubId}/guest-members`, {
        name: guestForm.name.trim(),
        email: guestForm.email.trim() || null,
      });
      toast.success(gm('created'));
      setGuestDialogOpen(false);
      setGuestForm({ name: '', email: '' });
      onRefresh?.();
    } catch (e) {
      toast.error(e.response?.data?.error || gm('createError'));
    } finally {
      setGuestSaving(false);
    }
  };

  const saveEditGuest = async () => {
    if (!clubId || !editGuest?.id || !editGuestForm.name.trim()) {
      toast.error(gm('nameRequired'));
      return;
    }
    try {
      setEditGuestSaving(true);
      await axios.patch(`/clubs/${clubId}/guest-members/${editGuest.id}`, {
        name: editGuestForm.name.trim(),
        email: editGuestForm.email.trim() || null,
      });
      toast.success(gm('updated'));
      setEditGuest(null);
      onRefresh?.();
    } catch (e) {
      toast.error(e.response?.data?.error || gm('updateError'));
    } finally {
      setEditGuestSaving(false);
    }
  };

  const confirmDeleteGuest = async () => {
    if (!clubId || !deleteGuestTarget?.id) return;
    try {
      await axios.delete(`/clubs/${clubId}/guest-members/${deleteGuestTarget.id}`);
      toast.success(gm('deleted'));
      setDeleteGuestTarget(null);
      onRefresh?.();
    } catch (e) {
      toast.error(e.response?.data?.error || gm('deleteError'));
    }
  };

  const confirmLinkGuest = async () => {
    if (!clubId || !linkGuestTarget?.id || !linkUserId) {
      toast.error(gm('linkRequired'));
      return;
    }
    try {
      setLinkSaving(true);
      await axios.patch(`/clubs/${clubId}/guest-members/${linkGuestTarget.id}`, {
        linked_user_id: linkUserId,
      });
      toast.success(gm('linked'));
      setLinkGuestTarget(null);
      setLinkUserId('');
      onRefresh?.();
    } catch (e) {
      toast.error(e.response?.data?.error || gm('linkError'));
    } finally {
      setLinkSaving(false);
    }
  };

  const unlinkGuest = async (guest) => {
    if (!clubId || !guest?.id) return;
    try {
      await axios.patch(`/clubs/${clubId}/guest-members/${guest.id}`, {
        linked_user_id: null,
      });
      toast.success(gm('unlinked'));
      onRefresh?.();
    } catch (e) {
      toast.error(e.response?.data?.error || gm('unlinkError'));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{gm('registeredTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('detail.email')}</TableHead>
                <TableHead>{t('detail.role')}</TableHead>
                <TableHead>{t('detail.joinedAt')}</TableHead>
                <TableHead className="text-right">{gm('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t('detail.noMembers')}
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => {
                  const isOwner = m.is_owner || m.user_id === ownerUserId;
                  const showActions = !isOwner;
                  return (
                    <TableRow key={m.id || m.user_id}>
                      <TableCell className="font-medium">
                        {m.email || m.user_id}
                        {isOwner && (
                          <Badge variant="secondary" className="ml-2">
                            {t('roles.owner')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {showActions ? (
                          <Select
                            value={m.role}
                            onValueChange={(v) => handleRoleChange(m.user_id, v)}
                            disabled={roleUpdating[m.user_id]}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                              <SelectItem value="member">{t('roles.member')}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={m.role === 'admin' ? 'default' : 'outline'}>
                            {m.role === 'admin' ? t('roles.admin') : t('roles.member')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatMemberDate(m.joined_at)}</TableCell>
                      <TableCell className="text-right">
                        {showActions ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setKickTarget(m)}
                          >
                            {t('detail.kick')}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base">{gm('guestTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{gm('guestHint')}</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => {
              setGuestForm({ name: '', email: '' });
              setGuestDialogOpen(true);
            }}
          >
            <UserPlus className="size-4" />
            {gm('addGuestMember')}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{gm('name')}</TableHead>
                <TableHead>{gm('email')}</TableHead>
                <TableHead>{gm('status')}</TableHead>
                <TableHead className="text-right">{gm('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guestMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {gm('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                guestMembers.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>{g.email || '—'}</TableCell>
                    <TableCell>
                      {g.linked_user_id ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary">{gm('linkedBadge')}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {g.linked_user_email || g.linked_user_id}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline">{gm('guestBadge')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditGuest(g);
                            setEditGuestForm({ name: g.name || '', email: g.email || '' });
                          }}
                        >
                          {gm('edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setTimingsGuest(g)}
                        >
                          <Clock className="size-3.5" />
                          {gm('manageTimings')}
                        </Button>
                        {g.linked_user_id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkGuest(g)}
                          >
                            {gm('unlinkAccount')}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setLinkGuestTarget(g);
                              setLinkUserId('');
                            }}
                          >
                            <Link2 className="size-3.5" />
                            {gm('linkAccount')}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteGuestTarget(g)}
                        >
                          {gm('delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(kickTarget)} onOpenChange={(open) => !open && setKickTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.kickConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('detail.kickConfirmBody', { email: kickTarget?.email || kickTarget?.user_id })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{gm('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmKick}
            >
              {t('detail.kick')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gm('addGuestMember')}</DialogTitle>
            <DialogDescription>{gm('addGuestDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-name">{gm('name')}</Label>
              <Input
                id="guest-name"
                value={guestForm.name}
                onChange={(e) => setGuestForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-email">{gm('emailOptional')}</Label>
              <Input
                id="guest-email"
                type="email"
                value={guestForm.email}
                onChange={(e) => setGuestForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGuestDialogOpen(false)}>
              {gm('cancel')}
            </Button>
            <Button type="button" disabled={guestSaving} onClick={createGuestMember}>
              {guestSaving ? gm('saving') : gm('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editGuest)} onOpenChange={(open) => !open && setEditGuest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gm('editGuest')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-guest-name">{gm('name')}</Label>
              <Input
                id="edit-guest-name"
                value={editGuestForm.name}
                onChange={(e) => setEditGuestForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-guest-email">{gm('emailOptional')}</Label>
              <Input
                id="edit-guest-email"
                type="email"
                value={editGuestForm.email}
                onChange={(e) => setEditGuestForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditGuest(null)}>
              {gm('cancel')}
            </Button>
            <Button type="button" disabled={editGuestSaving} onClick={saveEditGuest}>
              {editGuestSaving ? gm('saving') : gm('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(linkGuestTarget)} onOpenChange={(open) => !open && setLinkGuestTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gm('linkAccount')}</DialogTitle>
            <DialogDescription>{gm('linkDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{gm('selectMember')}</Label>
            <Select value={linkUserId} onValueChange={setLinkUserId}>
              <SelectTrigger>
                <SelectValue placeholder={gm('selectMemberPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {linkableMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.email || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLinkGuestTarget(null)}>
              {gm('cancel')}
            </Button>
            <Button type="button" disabled={linkSaving} onClick={confirmLinkGuest}>
              {linkSaving ? gm('saving') : gm('linkConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteGuestTarget)} onOpenChange={(open) => !open && setDeleteGuestTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{gm('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {gm('deleteConfirmBody', { name: deleteGuestTarget?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{gm('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGuest}>{gm('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClubGuestMemberTimings
        clubId={clubId}
        guestMember={timingsGuest}
        open={Boolean(timingsGuest)}
        onOpenChange={(open) => !open && setTimingsGuest(null)}
        circuits={clubCircuits}
      />
    </div>
  );
};

export default ClubMembersPanel;
