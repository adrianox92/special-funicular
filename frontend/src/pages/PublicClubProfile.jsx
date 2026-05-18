import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Building2, CalendarDays, FileText, Link as LinkIcon, MapPin, Globe, Megaphone, Users } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Spinner } from '../components/ui/spinner';
import Footer from '../components/Footer';
import { cn } from '../lib/utils';
import { clubEventCategoryMeta } from '../constants/clubEventCategories';

function formatClubDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function bodySnippet(text, max = 180) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

const pageShellClass = 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

export default function PublicClubProfile() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/public/clubs/by-slug/${encodeURIComponent(slug)}/profile`);
        if (!cancelled) {
          setData(res.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.error || 'Club no encontrado');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className={`flex flex-1 flex-col items-center justify-center py-24 ${pageShellClass}`}>
          <Spinner className="size-8 mb-4" />
          <p className="text-muted-foreground">Cargando club...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data?.club) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className={`${pageShellClass} flex flex-1 flex-col items-center justify-center py-16 text-center`}>
          <p className="text-muted-foreground mb-6">{error || 'Club no encontrado'}</p>
          <Button asChild variant="outline">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const { club, upcoming_events: upcomingEvents, board_items: boardItems = [] } = data;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className={`flex-1 space-y-8 py-10 ${pageShellClass}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Building2 className="size-7" />
              {club.name}
            </CardTitle>
            {club.city ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <MapPin className="size-4 shrink-0" />
                {club.city}
              </p>
            ) : null}
            {club.website_url ? (
              <a
                href={club.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Globe className="size-4" />
                Sitio web
              </a>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {club.description ? (
              <p className="text-muted-foreground whitespace-pre-wrap">{club.description}</p>
            ) : (
              <p className="text-muted-foreground italic">Este club aún no ha añadido una descripción pública.</p>
            )}
            <Button className="gap-2" onClick={() => setJoinOpen(true)}>
              <Users className="size-4" />
              Unirme al club
            </Button>
          </CardContent>
        </Card>

        {boardItems.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Megaphone className="size-5" />
                Tablón público
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {boardItems.map((item) => {
                  const snippet = bodySnippet(item.body);
                  const published = formatClubDate(item.created_at);
                  return (
                    <li key={item.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <p className="font-medium">{item.title}</p>
                      {snippet ? <p className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">{snippet}</p> : null}
                      <div className="mt-2 flex flex-col gap-2 text-sm">
                        {item.link_url ? (
                          <a
                            href={item.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                          >
                            <LinkIcon className="size-4 shrink-0" />
                            {item.link_label || item.link_url}
                          </a>
                        ) : null}
                        {item.document_url ? (
                          <a
                            href={item.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                          >
                            <FileText className="size-4 shrink-0" />
                            {item.document_label || 'Documento'}
                          </a>
                        ) : null}
                      </div>
                      {published ? (
                        <p className="text-xs text-muted-foreground mt-2">Publicado el {published}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5" />
              Próximos eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!upcomingEvents?.length ? (
              <p className="text-muted-foreground text-sm">No hay eventos públicos próximos.</p>
            ) : (
              <ul className="space-y-4">
                {upcomingEvents.map((ev) => {
                  const cat = clubEventCategoryMeta(ev.event_category);
                  return (
                    <li key={ev.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{ev.title}</p>
                        <Badge variant="outline" className={cn('shrink-0 text-xs font-normal', cat.badgeClass)}>
                          {cat.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ev.event_date}
                        {ev.start_time ? ` · ${ev.start_time}` : ''}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                      {ev.description ? <p className="text-sm mt-1 text-muted-foreground">{ev.description}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unirme a {club.name}</DialogTitle>
              <DialogDescription>
                Para formar parte del club necesitas un enlace de invitación del administrador o que te envíen una
                invitación por correo. Si conoces a algún miembro, contacta con ellos para obtener acceso.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setJoinOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </div>
  );
}
