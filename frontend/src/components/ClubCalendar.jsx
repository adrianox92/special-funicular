import React, { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Loader2, MapPin, Pencil, Trash2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
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
import { Textarea } from './ui/textarea';
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

function parseLocalDate(isoDate) {
  if (!isoDate) return null;
  const s = String(isoDate).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function badgeForEvent(eventDateStr) {
  const d = parseLocalDate(eventDateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = d.getTime();
  const start = today.getTime();
  const diffDays = Math.round((t - start) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return { label: 'Hoy', variant: 'default' };
  if (diffDays > 0 && diffDays <= 7) return { label: 'Esta semana', variant: 'secondary' };
  if (diffDays > 0) return { label: `En ${diffDays} días`, variant: 'outline' };
  return null;
}

const emptyForm = () => ({
  title: '',
  description: '',
  event_date: new Date().toISOString().slice(0, 10),
  location: '',
});

const ClubCalendar = ({ clubId, canManage }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`/clubs/${clubId}/events`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'No se pudieron cargar los eventos');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (ev) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      event_date: String(ev.event_date).slice(0, 10),
      location: ev.location || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!clubId || !form.title.trim() || !form.event_date) {
      toast.error('Título y fecha son obligatorios');
      return;
    }
    setSaving(true);
    try {
      if (editingEvent) {
        await axios.put(`/clubs/${clubId}/events/${editingEvent.id}`, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          event_date: form.event_date,
          location: form.location.trim() || null,
        });
        toast.success('Evento actualizado');
      } else {
        await axios.post(`/clubs/${clubId}/events`, {
          title: form.title.trim(),
          description: form.description.trim() || null,
          event_date: form.event_date,
          location: form.location.trim() || null,
        });
        toast.success('Evento creado');
      }
      setDialogOpen(false);
      setEditingEvent(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !clubId) return;
    try {
      await axios.delete(`/clubs/${clubId}/events/${deleteTarget.id}`);
      toast.success('Evento eliminado');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo eliminar');
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Próximos eventos</h2>
          <p className="text-sm text-muted-foreground">Carreras, reuniones y fechas del club.</p>
        </div>
        {canManage ? (
          <Button type="button" className="gap-2" onClick={openCreate}>
            <CalendarPlus className="size-4" />
            Nuevo evento
          </Button>
        ) : null}
      </div>

      {events.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay eventos programados.
            {canManage ? ' Crea el primero con el botón de arriba.' : ''}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => {
            const badge = badgeForEvent(ev.event_date);
            const when = parseLocalDate(ev.event_date);
            return (
              <li key={ev.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base leading-snug">{ev.title}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {when
                              ? when.toLocaleDateString('es-ES', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })
                              : ev.event_date}
                          </span>
                          {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
                        </CardDescription>
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Editar evento"
                            onClick={() => openEdit(ev)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            aria-label="Eliminar evento"
                            onClick={() => setDeleteTarget(ev)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  {(ev.location || ev.description) && (
                    <CardContent className="space-y-2 pt-0 text-sm">
                      {ev.location ? (
                        <p className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="mt-0.5 size-4 shrink-0" />
                          {ev.location}
                        </p>
                      ) : null}
                      {ev.description ? <p className="whitespace-pre-wrap">{ev.description}</p> : null}
                    </CardContent>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
            <DialogDescription>
              Visible para todos los miembros del club. Solo administradores pueden editar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ce-title">Título</Label>
              <Input
                id="ce-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ce-date">Fecha</Label>
              <Input
                id="ce-date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ce-loc">Lugar (opcional)</Label>
              <Input
                id="ce-loc"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ce-desc">Descripción (opcional)</Label>
              <Textarea
                id="ce-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                maxLength={5000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title} — esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClubCalendar;
