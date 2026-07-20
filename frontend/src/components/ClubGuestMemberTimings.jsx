import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pen, Plus, Trash2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
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
import { VEHICLE_TYPES } from '../data/vehicleTypes';

const emptyTimingForm = () => ({
  circuit_id: '',
  best_lap_time: '',
  timing_date: new Date().toISOString().slice(0, 10),
  lane: '',
  laps: '',
  vehicle_model: '',
  vehicle_type: '',
  notes: '',
});

const ClubGuestMemberTimings = ({ clubId, guestMember, open, onOpenChange, circuits = [] }) => {
  const { t } = useTranslation('clubs');
  const gt = (key, opts) => t(`guestTimings.${key}`, opts);

  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTimingForm());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadTimings = useCallback(async () => {
    if (!clubId || !guestMember?.id) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`/clubs/${clubId}/guest-members/${guestMember.id}/timings`);
      setTimings(Array.isArray(data?.timings) ? data.timings : []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || gt('loadError'));
      setTimings([]);
    } finally {
      setLoading(false);
    }
  }, [clubId, guestMember?.id, gt]);

  useEffect(() => {
    if (open) {
      loadTimings();
    }
  }, [open, loadTimings]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyTimingForm(),
      circuit_id: circuits[0]?.id || '',
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      circuit_id: row.circuit_id || '',
      best_lap_time: row.best_lap_time || '',
      timing_date: row.timing_date || new Date().toISOString().slice(0, 10),
      lane: row.lane || '',
      laps: row.laps != null ? String(row.laps) : '',
      vehicle_model: row.vehicle_model || '',
      vehicle_type: row.vehicle_type || '',
      notes: row.notes || '',
    });
    setFormOpen(true);
  };

  const saveTiming = async () => {
    if (!clubId || !guestMember?.id) return;
    if (!form.circuit_id) {
      toast.error(gt('circuitRequired'));
      return;
    }
    if (!form.best_lap_time.trim()) {
      toast.error(gt('lapRequired'));
      return;
    }

    const payload = {
      circuit_id: form.circuit_id,
      best_lap_time: form.best_lap_time.trim(),
      timing_date: form.timing_date || undefined,
      lane: form.lane.trim() || undefined,
      laps: form.laps !== '' ? parseInt(form.laps, 10) : undefined,
      vehicle_model: form.vehicle_model.trim() || undefined,
      vehicle_type: form.vehicle_type || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      setSaving(true);
      if (editing?.id) {
        await axios.patch(
          `/clubs/${clubId}/guest-members/${guestMember.id}/timings/${editing.id}`,
          payload,
        );
        toast.success(gt('updated'));
      } else {
        await axios.post(`/clubs/${clubId}/guest-members/${guestMember.id}/timings`, payload);
        toast.success(gt('created'));
      }
      setFormOpen(false);
      loadTimings();
    } catch (e) {
      toast.error(e.response?.data?.error || gt('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !clubId || !guestMember?.id) return;
    try {
      await axios.delete(
        `/clubs/${clubId}/guest-members/${guestMember.id}/timings/${deleteTarget.id}`,
      );
      toast.success(gt('deleted'));
      setDeleteTarget(null);
      loadTimings();
    } catch (e) {
      toast.error(e.response?.data?.error || gt('deleteError'));
    }
  };

  const circuitName = (circuitId) => circuits.find((c) => c.id === circuitId)?.name || circuitId;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{gt('title', { name: guestMember?.name || '' })}</DialogTitle>
            <DialogDescription>{gt('description')}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button type="button" size="sm" className="gap-2" onClick={openCreate} disabled={circuits.length === 0}>
              <Plus className="size-4" />
              {gt('add')}
            </Button>
          </div>

          {circuits.length === 0 ? (
            <p className="text-sm text-muted-foreground">{gt('noCircuits')}</p>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : timings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{gt('empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{gt('circuit')}</TableHead>
                  <TableHead>{gt('bestLap')}</TableHead>
                  <TableHead>{gt('lane')}</TableHead>
                  <TableHead>{gt('date')}</TableHead>
                  <TableHead>{gt('vehicle')}</TableHead>
                  <TableHead className="text-right">{gt('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timings.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{circuitName(row.circuit_id)}</TableCell>
                    <TableCell className="font-mono">{row.best_lap_time}</TableCell>
                    <TableCell>{row.lane || '—'}</TableCell>
                    <TableCell>{row.timing_date || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.vehicle_model || '—'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        <Pen className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? gt('editTitle') : gt('addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{gt('circuit')}</Label>
              <Select value={form.circuit_id} onValueChange={(v) => setForm((f) => ({ ...f, circuit_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={gt('circuitPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {circuits.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-best-lap">{gt('bestLap')}</Label>
              <Input
                id="guest-best-lap"
                value={form.best_lap_time}
                onChange={(e) => setForm((f) => ({ ...f, best_lap_time: e.target.value }))}
                placeholder="1:23.456"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest-date">{gt('date')}</Label>
                <Input
                  id="guest-date"
                  type="date"
                  value={form.timing_date}
                  onChange={(e) => setForm((f) => ({ ...f, timing_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-lane">{gt('lane')}</Label>
                <Input
                  id="guest-lane"
                  value={form.lane}
                  onChange={(e) => setForm((f) => ({ ...f, lane: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest-laps">{gt('laps')}</Label>
                <Input
                  id="guest-laps"
                  type="number"
                  min={0}
                  value={form.laps}
                  onChange={(e) => setForm((f) => ({ ...f, laps: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{gt('vehicleType')}</Label>
                <Select
                  value={form.vehicle_type || 'none'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, vehicle_type: v === 'none' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={gt('vehicleTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{gt('vehicleTypeNone')}</SelectItem>
                    {VEHICLE_TYPES.map((vt) => (
                      <SelectItem key={vt} value={vt}>
                        {vt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-vehicle">{gt('vehicleModel')}</Label>
              <Input
                id="guest-vehicle"
                value={form.vehicle_model}
                onChange={(e) => setForm((f) => ({ ...f, vehicle_model: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-notes">{gt('notes')}</Label>
              <Textarea
                id="guest-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              {gt('cancel')}
            </Button>
            <Button type="button" onClick={saveTiming} disabled={saving}>
              {saving ? gt('saving') : gt('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{gt('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{gt('deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{gt('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{gt('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClubGuestMemberTimings;
