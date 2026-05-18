import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  CalendarPlus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LayoutList,
  MapPin,
  Pencil,
  Trash2,
  Rss,
  ClipboardCopy,
  UserPlus,
  Calendar as CalendarIcon,
  Download,
  Link2,
  QrCode,
} from 'lucide-react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
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
import { toast } from 'sonner';
import {
  googleCalendarUrlForClubEvent,
  downloadClubEventIcs,
  competitionPublicSignupUrl,
  clubEventTimeForInput,
  defaultClubEventTz,
} from '../utils/clubEventCalendarExport';
import { cn } from '../lib/utils';
import { CLUB_EVENT_CATEGORY_OPTIONS, clubEventCategoryMeta } from '../constants/clubEventCategories';

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
  start_time: '',
  end_time: '',
  location: '',
  competition_id: '',
  event_category: 'other',
});

function ClubEventCard({
  ev,
  canManage,
  onEdit,
  onDelete,
  copyCompetitionPublicUrl,
  openSignupQr,
}) {
  const cat = clubEventCategoryMeta(ev.event_category);
  const badge = badgeForEvent(ev.event_date);
  const when = parseLocalDate(ev.event_date);
  const slug = ev.competitions?.public_slug;
  const googleCalUrl = googleCalendarUrlForClubEvent(ev);
  return (
    <Card className={cn('overflow-hidden', cat.cardBorderClass)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base leading-snug">{ev.title}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('shrink-0 border font-normal', cat.badgeClass)}>
                {cat.label}
              </Badge>
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
            {ev.competitions?.name && (
              <p className="text-xs text-muted-foreground">Competición: {ev.competitions.name}</p>
            )}
            {ev.start_time ? (
              <p className="text-xs text-muted-foreground">
                {clubEventTimeForInput(ev.start_time)}
                {ev.end_time
                  ? ` – ${clubEventTimeForInput(ev.end_time)}`
                  : ' (fin por defecto +1 h en calendarios externos)'}
              </p>
            ) : null}
          </div>
          {canManage ? (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Editar evento"
                onClick={() => onEdit(ev)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Eliminar evento"
                onClick={() => onDelete(ev)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        <div className="flex flex-wrap gap-2">
          {slug ? (
            <>
              <Button type="button" size="sm" variant="secondary" className="gap-2" asChild>
                <Link to={`/competitions/signup/${encodeURIComponent(slug)}`}>
                  <UserPlus className="size-4" />
                  Inscribirme
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => copyCompetitionPublicUrl(slug)}
                title="Copiar URL de inscripción"
              >
                <Link2 className="size-4" />
                Copiar enlace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => openSignupQr(slug)}
                title="Mostrar código QR"
              >
                <QrCode className="size-4" />
                QR
              </Button>
            </>
          ) : null}
          {googleCalUrl ? (
            <Button variant="outline" size="sm" className="gap-1" asChild>
              <a href={googleCalUrl} target="_blank" rel="noopener noreferrer" title="Abre Google Calendar">
                <CalendarIcon className="size-4" />
                Google Calendar
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              if (!downloadClubEventIcs(ev)) {
                toast.error('No se pudo generar el calendario (.ics)');
              }
            }}
            title="Apple Calendar, Outlook y otras apps"
          >
            <Download className="size-4" />
            iCal (.ics)
          </Button>
        </div>
        {ev.location || ev.description ? (
          <div className="space-y-2">
            {ev.location ? (
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                {ev.location}
              </p>
            ) : null}
            {ev.description ? <p className="whitespace-pre-wrap">{ev.description}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const ClubCalendar = ({ clubId, canManage }) => {
  const [events, setEvents] = useState([]);
  const [clubCompetitions, setClubCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedStatus, setFeedStatus] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrPathShort, setQrPathShort] = useState('');
  const [qrFullUrl, setQrFullUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      const qs = viewMode === 'calendar' ? '?all=true' : '';
      const { data } = await axios.get(`/clubs/${clubId}/events${qs}`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'No se pudieron cargar los eventos');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [clubId, viewMode]);

  const eventsByDate = useMemo(() => {
    const m = new Map();
    for (const ev of events) {
      const k = String(ev.event_date).slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(ev);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const as = a.start_time || '';
        const bs = b.start_time || '';
        if (as !== bs) return as.localeCompare(bs);
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });
    }
    return m;
  }, [events]);

  const gridMonthStart = useMemo(
    () => new Date(calMonth.year, calMonth.month, 1),
    [calMonth.year, calMonth.month],
  );

  const calendarGridDays = useMemo(() => {
    const monthEnd = endOfMonth(gridMonthStart);
    const gridStart = startOfWeek(gridMonthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [gridMonthStart]);

  const dayEventsForSelected = selectedDay
    ? eventsByDate.get(format(selectedDay, 'yyyy-MM-dd')) || []
    : [];

  const loadCompetitions = useCallback(async () => {
    if (!clubId || !canManage) return;
    try {
      const { data } = await axios.get(`/clubs/${clubId}/competitions`);
      setClubCompetitions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setClubCompetitions([]);
    }
  }, [clubId, canManage]);

  const loadFeedStatus = useCallback(async () => {
    if (!clubId || !canManage) return;
    try {
      setFeedLoading(true);
      const { data } = await axios.get(`/clubs/${clubId}/calendar-feed/status`);
      setFeedStatus(data);
    } catch (e) {
      console.error(e);
      setFeedStatus(null);
    } finally {
      setFeedLoading(false);
    }
  }, [clubId, canManage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (canManage) {
      loadCompetitions();
      loadFeedStatus();
    }
  }, [canManage, loadCompetitions, loadFeedStatus]);

  const openCreate = () => {
    setSelectedDay(null);
    setEditingEvent(null);
    setForm(emptyForm());
    loadCompetitions();
    setDialogOpen(true);
  };

  const openEdit = (ev) => {
    setSelectedDay(null);
    setEditingEvent(ev);
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      event_date: String(ev.event_date).slice(0, 10),
      start_time: clubEventTimeForInput(ev.start_time),
      end_time: clubEventTimeForInput(ev.end_time),
      location: ev.location || '',
      competition_id: ev.competition_id ? String(ev.competition_id) : '',
      event_category: ev.event_category || 'other',
    });
    loadCompetitions();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!clubId || !form.title.trim() || !form.event_date) {
      toast.error('Título y fecha son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_date: form.event_date,
        start_time: form.start_time.trim() || null,
        end_time: form.end_time.trim() || null,
        location: form.location.trim() || null,
        competition_id: form.competition_id ? form.competition_id : null,
        event_category: form.event_category || 'other',
      };
      if (editingEvent) {
        await axios.put(`/clubs/${clubId}/events/${editingEvent.id}`, payload);
        toast.success('Evento actualizado');
      } else {
        await axios.post(`/clubs/${clubId}/events`, payload);
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

  const copyFeedUrl = async () => {
    const u = feedStatus?.feed_url;
    if (!u || !navigator.clipboard?.writeText) {
      toast.error('No hay enlace para copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(u);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const enableFeed = async () => {
    try {
      setFeedLoading(true);
      const { data } = await axios.post(`/clubs/${clubId}/calendar-feed/enable`);
      setFeedStatus({ enabled: true, feed_url: data.feed_url });
      toast.success('Suscripción activada');
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo activar');
    } finally {
      setFeedLoading(false);
    }
  };

  const regenerateFeed = async () => {
    try {
      setFeedLoading(true);
      const { data } = await axios.post(`/clubs/${clubId}/calendar-feed/regenerate`);
      setFeedStatus({ enabled: true, feed_url: data.feed_url });
      toast.success('Enlace regenerado (el anterior deja de funcionar)');
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo regenerar');
    } finally {
      setFeedLoading(false);
    }
  };

  const copyCompetitionPublicUrl = async (slug) => {
    const url = competitionPublicSignupUrl(slug);
    if (!url || !navigator.clipboard?.writeText) {
      toast.error('No se pudo copiar');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace público copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const openSignupQr = (slug) => {
    const full = competitionPublicSignupUrl(slug);
    const path = `/competitions/signup/${encodeURIComponent(slug)}`;
    setQrFullUrl(full);
    setQrPathShort(path);
    setQrDataUrl('');
    setQrOpen(true);
    setQrLoading(true);
    QRCode.toDataURL(full, { width: 220, margin: 2 })
      .then((u) => setQrDataUrl(u))
      .catch(() => toast.error('No se pudo generar el QR'))
      .finally(() => setQrLoading(false));
  };

  const disableFeed = async () => {
    try {
      setFeedLoading(true);
      await axios.post(`/clubs/${clubId}/calendar-feed/disable`);
      setFeedStatus({ enabled: false, feed_url: null });
      toast.success('Suscripción desactivada');
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo desactivar');
    } finally {
      setFeedLoading(false);
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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-lg font-semibold leading-tight">Próximos eventos</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Carreras, reuniones y fechas del club. Horas opcionales (zona {defaultClubEventTz()}) para Google e .ics.
            Puedes exportar cada evento a Google Calendar o descargar un .ics.
          </p>
        </div>
        <div
          className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start lg:justify-end"
          aria-label="Acciones del calendario"
        >
          <div
            className="inline-flex h-9 w-full max-w-full rounded-lg border border-border bg-muted/30 p-0.5 shadow-sm sm:w-auto sm:max-w-none"
            role="group"
            aria-label="Cambiar vista de eventos"
          >
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 flex-1 gap-1.5 rounded-md px-3 sm:flex-initial',
                viewMode === 'list' && 'shadow-sm',
              )}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
            >
              <LayoutList className="size-4 shrink-0" aria-hidden />
              Lista
            </Button>
            <Button
              type="button"
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 flex-1 gap-1.5 rounded-md px-3 sm:flex-initial',
                viewMode === 'calendar' && 'shadow-sm',
              )}
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              title="Vista de rejilla mensual"
            >
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              Mes
            </Button>
          </div>
          {canManage ? (
            <Button type="button" size="sm" className="h-9 w-full gap-2 shadow-sm sm:w-auto sm:shrink-0" onClick={openCreate}>
              <CalendarPlus className="size-4 shrink-0" aria-hidden />
              Nuevo evento
            </Button>
          ) : null}
        </div>
      </header>

      {canManage ? (
        <Card className="border-border/60 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Rss className="size-4" />
              Suscripción al calendario (.ics)
            </CardTitle>
            <CardDescription>
              Enlace privado: quien lo tenga puede ver fechas y títulos en Google Calendar, Apple, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {feedLoading && !feedStatus ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : feedStatus?.enabled && feedStatus.feed_url ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input readOnly value={feedStatus.feed_url} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" onClick={copyFeedUrl}>
                    <ClipboardCopy className="size-4" />
                    Copiar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={regenerateFeed} disabled={feedLoading}>
                    Regenerar enlace
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={disableFeed} disabled={feedLoading}>
                    Desactivar
                  </Button>
                </div>
              </>
            ) : (
              <Button type="button" size="sm" onClick={enableFeed} disabled={feedLoading}>
                Activar suscripción pública
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {viewMode === 'list' ? (
        events.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No hay eventos programados.
              {canManage ? ' Crea el primero con el botón de arriba.' : ''}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id}>
                <ClubEventCard
                  ev={ev}
                  canManage={canManage}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  copyCompetitionPublicUrl={copyCompetitionPublicUrl}
                  openSignupQr={openSignupQr}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Mes anterior"
              onClick={() =>
                setCalMonth((m) => {
                  const d = new Date(m.year, m.month - 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h3 className="min-w-0 flex-1 text-center text-base font-semibold capitalize">
              {format(gridMonthStart, 'MMMM yyyy', { locale: es })}
            </h3>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Mes siguiente"
              onClick={() =>
                setCalMonth((m) => {
                  const d = new Date(m.year, m.month + 1, 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {events.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No hay eventos registrados.</p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[280px]">
              <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="px-1 py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-border">
                {calendarGridDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayEvs = eventsByDate.get(key) || [];
                  const inMonth = isSameMonth(day, gridMonthStart);
                  const todayKey = format(new Date(), 'yyyy-MM-dd');
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`flex min-h-[5.5rem] flex-col bg-background p-1.5 text-left text-xs transition-colors hover:bg-muted/30 ${
                        !inMonth ? 'text-muted-foreground/70' : ''
                      } ${isToday ? 'ring-2 ring-inset ring-primary/50' : ''}`}
                    >
                      <span className={`mb-1 font-medium ${inMonth ? 'text-foreground' : ''}`}>{format(day, 'd')}</span>
                      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                        {dayEvs.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            title={ev.title}
                            className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${clubEventCategoryMeta(ev.event_category).pillClass}`}
                          >
                            {ev.title}
                          </span>
                        ))}
                        {dayEvs.length > 3 ? (
                          <span className="text-[10px] text-muted-foreground">+{dayEvs.length - 3} más</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(selectedDay)} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {selectedDay ? format(selectedDay, "EEEE d 'de' MMMM yyyy", { locale: es }) : ''}
            </DialogTitle>
            <DialogDescription>
              {dayEventsForSelected.length === 0
                ? 'No hay eventos este día.'
                : `${dayEventsForSelected.length} evento${dayEventsForSelected.length === 1 ? '' : 's'}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dayEventsForSelected.map((ev) => (
              <ClubEventCard
                key={ev.id}
                ev={ev}
                canManage={canManage}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                copyCompetitionPublicUrl={copyCompetitionPublicUrl}
                openSignupQr={openSignupQr}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="ce-cat">Categoría</Label>
              <Select
                value={form.event_category || 'other'}
                onValueChange={(v) => setForm((f) => ({ ...f, event_category: v }))}
              >
                <SelectTrigger id="ce-cat">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CLUB_EVENT_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ce-start">Hora inicio (opcional)</Label>
                <Input
                  id="ce-start"
                  type="time"
                  value={form.start_time}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      start_time: e.target.value,
                      end_time: e.target.value ? f.end_time : '',
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ce-end">Hora fin (opcional)</Label>
                <Input
                  id="ce-end"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  disabled={!form.start_time}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Sin horas = evento de día entero. Si solo indicas inicio, el fin será +1 h en enlaces a Google o .ics (zona {defaultClubEventTz()}).
            </p>
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
              <Label>Competición vinculada (opcional)</Label>
              <Select
                value={form.competition_id || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, competition_id: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger id="ce-comp">
                  <SelectValue placeholder="Sin competición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin competición</SelectItem>
                  {clubCompetitions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {!c.public_slug ? ' (sin inscripción pública)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo competiciones de este club. Los miembros verán el botón de inscripción si hay slug público.
              </p>
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

      <Dialog
        open={qrOpen}
        onOpenChange={(o) => {
          setQrOpen(o);
          if (!o) {
            setQrDataUrl('');
            setQrPathShort('');
            setQrFullUrl('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inscripción pública</DialogTitle>
            <DialogDescription>Enlace corto y código QR para compartir la competición.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrLoading || !qrDataUrl ? (
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
            ) : (
              <img src={qrDataUrl} alt="Código QR inscripción" className="max-w-[220px] rounded-md border border-border" />
            )}
            <code className="text-center text-xs break-all text-muted-foreground">{qrPathShort}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!qrFullUrl}
              onClick={async () => {
                if (!qrFullUrl || !navigator.clipboard?.writeText) return;
                try {
                  await navigator.clipboard.writeText(qrFullUrl);
                  toast.success('Enlace copiado');
                } catch {
                  toast.error('No se pudo copiar');
                }
              }}
            >
              <ClipboardCopy className="size-4" />
              Copiar URL completa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubCalendar;
