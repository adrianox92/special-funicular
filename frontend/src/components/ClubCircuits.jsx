import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, Loader2, Pen, Plus, Trash2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
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
import { toast } from 'sonner';
import ClubCircuitLeaderboard from './ClubCircuitLeaderboard';
import ClubCircuitPersonalLink from './ClubCircuitPersonalLink';

const emptyForm = () => ({
  name: '',
  description: '',
  num_lanes: '2',
  lane_lengths: [0, 0],
});

const ClubCircuits = ({ clubId, canManage, club, onClubUpdated }) => {
  const { t } = useTranslation('clubs');
  const { t: tCommon } = useTranslation('common');
  const p = (key, opts) => t(`circuitsPanel.${key}`, opts);
  const [circuits, setCircuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedCircuitId, setSelectedCircuitId] = useState(null);
  const [leaderboardPublic, setLeaderboardPublic] = useState(false);
  const [savingPublic, setSavingPublic] = useState(false);
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`/clubs/${clubId}/circuits`);
      const list = Array.isArray(data) ? data : [];
      setCircuits(list);
      setSelectedCircuitId((prev) => {
        if (list.length === 0) return null;
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0].id;
      });
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || p('loadError'));
      setCircuits([]);
      setSelectedCircuitId(null);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setLeaderboardPublic(Boolean(club?.leaderboard_public));
  }, [club?.leaderboard_public]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (circuit) => {
    const lengths = Array.isArray(circuit.lane_lengths) ? circuit.lane_lengths : [];
    const numLanes = circuit.num_lanes || lengths.length || 2;
    setEditing(circuit);
    setForm({
      name: circuit.name || '',
      description: circuit.description || '',
      num_lanes: String(numLanes),
      lane_lengths: Array(numLanes)
        .fill(null)
        .map((_, i) => lengths[i] ?? 0),
    });
    setDialogOpen(true);
  };

  const handleNumLanesChange = (num) => {
    const n = Math.max(1, parseInt(num, 10) || 1);
    const current = form.lane_lengths;
    setForm({
      ...form,
      num_lanes: String(n),
      lane_lengths: Array(n)
        .fill(null)
        .map((_, i) => current[i] ?? 0),
    });
  };

  const saveCircuit = async () => {
    if (!form.name.trim()) {
      toast.error(p('nameRequired'));
      return;
    }
    const numLanes = parseInt(form.num_lanes, 10);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      num_lanes: numLanes,
      lane_lengths: form.lane_lengths.slice(0, numLanes).map((v) => Number(v) || 0),
    };
    try {
      setSaving(true);
      if (editing) {
        await axios.put(`/clubs/${clubId}/circuits/${editing.id}`, payload);
        toast.success(p('updated'));
      } else {
        await axios.post(`/clubs/${clubId}/circuits`, payload);
        toast.success(p('created'));
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || p('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`/clubs/${clubId}/circuits/${deleteTarget.id}`);
      toast.success(p('deleted'));
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || p('deleteError'));
    }
  };

  const saveLeaderboardPublic = async (checked) => {
    try {
      setSavingPublic(true);
      await axios.patch(`/clubs/${clubId}`, { leaderboard_public: checked });
      setLeaderboardPublic(checked);
      toast.success(checked ? p('publicVisible') : p('publicHidden'));
      onClubUpdated?.();
    } catch (e) {
      toast.error(e.response?.data?.error || p('visibilityError'));
    } finally {
      setSavingPublic(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{p('publicTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{p('publicLeaderboard')}</p>
              <p className="text-xs text-muted-foreground">
                {p('publicLeaderboardHint')}
              </p>
            </div>
            <Switch
              checked={leaderboardPublic}
              disabled={savingPublic}
              onCheckedChange={saveLeaderboardPublic}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="size-4" />
            {p('clubCircuits')}
          </CardTitle>
          {canManage ? (
            <Button type="button" size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              {p('newCircuit')}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {circuits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canManage ? p('emptyManage') : p('emptyGuest')}
            </p>
          ) : (
            <ul className="space-y-2">
              {circuits.map((c) => (
                <li
                  key={c.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-md p-3 cursor-pointer transition-colors ${
                    selectedCircuitId === c.id ? 'border-primary bg-accent/30' : 'hover:bg-accent/20'
                  }`}
                  onClick={() => setSelectedCircuitId(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedCircuitId(c.id);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p('lanes', { count: c.num_lanes })}
                      {c.description ? ` · ${c.description}` : ''}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(c)}>
                        <Pen className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedCircuitId ? (
        <>
          <ClubCircuitPersonalLink
            clubId={clubId}
            clubCircuitId={selectedCircuitId}
            onLinked={() => setLeaderboardKey((k) => k + 1)}
          />
          <ClubCircuitLeaderboard
            key={leaderboardKey}
            clubId={clubId}
            circuitId={selectedCircuitId}
            circuits={circuits}
          />
        </>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? p('dialogEditFull') : p('dialogCreateFull')}</DialogTitle>
            <DialogDescription>
              {p('dialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cc-name">{p('name')}</Label>
              <Input
                id="cc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-desc">{p('description')}</Label>
              <Textarea
                id="cc-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-lanes">{p('lanesLabel')}</Label>
              <Input
                id="cc-lanes"
                type="number"
                min={1}
                max={8}
                value={form.num_lanes}
                onChange={(e) => handleNumLanesChange(e.target.value)}
              />
            </div>
            {form.lane_lengths.map((len, i) => (
              <div key={i} className="space-y-2">
                <Label htmlFor={`cc-len-${i}`}>{p('laneLength', { n: i + 1 })}</Label>
                <Input
                  id={`cc-len-${i}`}
                  type="number"
                  min={0}
                  step={0.1}
                  value={len}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    const next = [...form.lane_lengths];
                    next[i] = v;
                    setForm((f) => ({ ...f, lane_lengths: next }));
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {p('cancel')}
            </Button>
            <Button type="button" disabled={saving} onClick={saveCircuit}>
              {saving ? p('saving') : p('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{p('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {p('deleteConfirmName', { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {p('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClubCircuits;
