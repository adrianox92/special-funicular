import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/axios';
import { formatHistoryDate, getIntlLocale } from '../utils/formatUtils';
import CompetitionStatusBadge from './CompetitionStatusBadge';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Spinner } from './ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const emptyForm = () => ({
  competition_name: '',
  event_date: '',
  position: '',
  category: '',
  notes: '',
  competition_id: '',
});

const VehiclePalmares = ({ vehicleId }) => {
  const { t } = useTranslation('vehicles');
  const { t: tc } = useTranslation('common');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [competitionOptions, setCompetitionOptions] = useState([]);

  const formatPosition = useCallback(
    (position) => {
      if (position == null || position === '') return null;
      const n = Number(position);
      if (!Number.isFinite(n) || n < 1) return null;
      return t('palmares.positionSuffix', { n });
    },
    [t],
  );

  const loadCompetitionOptions = useCallback(async () => {
    try {
      const { data } = await api.get('/competitions/my-competitions');
      setCompetitionOptions(Array.isArray(data) ? data : []);
    } catch {
      setCompetitionOptions([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/vehicles/${vehicleId}/palmares`);
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || t('palmares.loadError'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCompetitionOptions();
  }, [loadCompetitionOptions]);

  const linkedCompetitionOptions = useMemo(() => {
    const byId = new Map();
    competitionOptions.forEach((c) => {
      if (c?.id) byId.set(c.id, c);
    });
    entries.forEach((entry) => {
      if (entry.source === 'system' && entry.competition_id && entry.competition_name) {
        byId.set(entry.competition_id, {
          id: entry.competition_id,
          name: entry.competition_name,
        });
      }
    });
    return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), getIntlLocale()));
  }, [competitionOptions, entries]);

  const openCreateDialog = () => {
    setEditingEntry(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (entry) => {
    setEditingEntry(entry);
    setForm({
      competition_name: entry.competition_name || '',
      event_date: entry.event_date ? String(entry.event_date).slice(0, 10) : '',
      position: entry.position != null ? String(entry.position) : '',
      category: entry.category || '',
      notes: entry.notes || '',
      competition_id: entry.competition_id || '',
    });
    setDialogOpen(true);
  };

  const handleCompetitionLinkChange = (value) => {
    if (value === 'none') {
      setForm((f) => ({ ...f, competition_id: '' }));
      return;
    }
    const selected = linkedCompetitionOptions.find((c) => c.id === value);
    setForm((f) => ({
      ...f,
      competition_id: value,
      competition_name: selected?.name || f.competition_name,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleId) return;
    if (!form.competition_name.trim()) {
      toast.error(t('palmares.eventNameRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        competition_name: form.competition_name.trim(),
        event_date: form.event_date || null,
        position: form.position !== '' ? form.position : null,
        category: form.category.trim() || null,
        notes: form.notes.trim() || null,
        competition_id: form.competition_id || null,
      };

      if (editingEntry) {
        await api.put(`/vehicles/${vehicleId}/palmares/${editingEntry.id}`, payload);
        toast.success(t('palmares.updateSuccess'));
      } else {
        await api.post(`/vehicles/${vehicleId}/palmares`, payload);
        toast.success(t('palmares.addSuccess'));
      }

      setDialogOpen(false);
      setEditingEntry(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('palmares.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry || !vehicleId) return;
    try {
      await api.delete(`/vehicles/${vehicleId}/palmares/${deleteEntry.id}`);
      toast.success(t('palmares.deleteSuccess'));
      setDeleteEntry(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('palmares.deleteError'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="size-5" />
            {t('palmares.title')}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">{t('palmares.description')}</p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="size-4 mr-2" />
          {t('palmares.addEvent')}
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Trophy className="size-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground">{t('palmares.emptyTitle')}</p>
            <p className="text-sm mt-1">{t('palmares.emptyDescription')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const posLabel = formatPosition(entry.position, t);
            const isManual = entry.source === 'manual';

            return (
              <Card key={`${entry.source}-${entry.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base leading-snug">{entry.competition_name}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatHistoryDate(entry.event_date)}</span>
                        {entry.circuit_name && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{entry.circuit_name}</span>
                          </>
                        )}
                        {posLabel && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-medium text-foreground">{posLabel}</span>
                          </>
                        )}
                        {entry.category && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{entry.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Badge variant={isManual ? 'secondary' : 'outline'}>
                        {isManual ? t('palmares.manual') : t('palmares.system')}
                      </Badge>
                      {!isManual && entry.competition_status && (
                        <CompetitionStatusBadge status={entry.competition_status} />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!isManual && (entry.driver_name || entry.team_name) && (
                    <p className="text-sm text-muted-foreground">
                      {[entry.driver_name, entry.team_name].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {entry.notes && (
                    <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {entry.competition_id && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/competitions/${entry.competition_id}/participants`}>
                          <ExternalLink className="size-4 mr-2" />
                          {t('palmares.viewCompetition')}
                        </Link>
                      </Button>
                    )}
                    {isManual && (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                          <Pencil className="size-4 mr-2" />
                          {tc('actions.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteEntry(entry)}
                        >
                          <Trash2 className="size-4 mr-2" />
                          {tc('actions.delete')}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? t('palmares.dialogEditTitle') : t('palmares.dialogAddTitle')}</DialogTitle>
            <DialogDescription>{t('palmares.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="palmares-name">{t('palmares.eventNameLabel')}</Label>
              <Input
                id="palmares-name"
                value={form.competition_name}
                onChange={(e) => setForm((f) => ({ ...f, competition_name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="palmares-date">{t('palmares.dateLabel')}</Label>
                <Input
                  id="palmares-date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="palmares-position">{t('palmares.positionLabel')}</Label>
                <Input
                  id="palmares-position"
                  type="number"
                  min="1"
                  step="1"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder={t('palmares.positionPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="palmares-category">{t('palmares.categoryLabel')}</Label>
              <Input
                id="palmares-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder={t('palmares.categoryPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="palmares-link">{t('palmares.linkLabel')}</Label>
              <Select
                value={form.competition_id || 'none'}
                onValueChange={handleCompetitionLinkChange}
              >
                <SelectTrigger id="palmares-link">
                  <SelectValue placeholder={t('palmares.linkNone')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('palmares.linkNone')}</SelectItem>
                  {linkedCompetitionOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="palmares-notes">{t('palmares.notesLabel')}</Label>
              <Textarea
                id="palmares-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder={t('palmares.notesPlaceholder')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t('edit.saving') : editingEntry ? t('palmares.saveChanges') : t('palmares.addEvent')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('palmares.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('palmares.deleteBody', { name: deleteEntry?.competition_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{tc('actions.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VehiclePalmares;
