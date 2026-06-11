import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Users, CheckCircle, AlertTriangle, ArrowLeft, Calendar } from 'lucide-react';
import axios from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import LeagueStatusBadge from '../components/league/LeagueStatusBadge';
import CompetitionStatusBadge from '../components/CompetitionStatusBadge';

const headerImgClass =
  'h-9 w-auto max-w-[min(100%,14rem)] object-contain object-left sm:max-w-[16rem]';

const LeagueSignup = () => {
  const { slug } = useParams();
  const { theme } = useTheme();
  const headerLogoSrc = `${process.env.PUBLIC_URL || ''}/${
    theme === 'dark' ? 'logo-header.png' : 'logo-header-dark.png'
  }`;

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', vehicle: '' });
  const [submitting, setSubmitting] = useState(false);
  const [signupResult, setSignupResult] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/public-leagues/${slug}`);
        setLeague(res.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Liga no encontrada');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await axios.post(`/public-leagues/${slug}/signup`, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        vehicle: form.vehicle.trim() || undefined,
      });
      setSignupResult({
        waitlisted: Boolean(res.data?.waitlisted),
        position: res.data?.waitlist_position ?? null,
      });
      setShowSuccessModal(true);
      setForm({ name: '', email: '', vehicle: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al inscribirse');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error && !league) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="link" asChild className="mt-4">
          <Link to="/"><ArrowLeft className="size-4 mr-2" />Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  const signupClosed = league.status === 'closed';
  const participantsCount = league.participants_count ?? 0;
  const waitlistCount = league.waitlist_count ?? 0;
  const maxParticipants = league.max_participants;
  const slotsFull = maxParticipants != null && participantsCount >= maxParticipants;
  const progressPercent = maxParticipants
    ? Math.min(100, (participantsCount / maxParticipants) * 100)
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-3">
        <Link to="/">
          <img src={headerLogoSrc} alt="Slot Database" className={headerImgClass} />
        </Link>
      </header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="size-5" />
              <h1 className="text-xl font-bold">{league.name}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <LeagueStatusBadge status={league.status} />
              {league.club?.name && <Badge variant="outline">{league.club.name}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
              <Users className="size-4" />
              {maxParticipants
                ? `${participantsCount}/${maxParticipants} plazas`
                : `${participantsCount} participante${participantsCount !== 1 ? 's' : ''}`}
              {waitlistCount > 0 ? ` · Lista espera: ${waitlistCount}` : ''}
            </p>
            {maxParticipants ? (
              <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {signupClosed ? (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertDescription>Esta liga está cerrada y no acepta nuevas inscripciones.</AlertDescription>
              </Alert>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del piloto *</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle">Vehículo</Label>
                    <Input
                      id="vehicle"
                      value={form.vehicle}
                      onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                      placeholder="Ej: Porsche 911"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <Spinner className="size-4" />
                    ) : slotsFull ? (
                      'Unirme a la lista de espera'
                    ) : (
                      'Inscribirse en la liga'
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        {(league.competitions || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="size-4" />
                Calendario de pruebas
              </h3>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {league.competitions.map((c, i) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      #{i + 1} {c.name}
                      {c.circuit_name ? ` · ${c.circuit_name}` : ''}
                    </span>
                    <CompetitionStatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-500" />
              {signupResult?.waitlisted ? 'Estás en lista de espera' : '¡Inscripción confirmada!'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {signupResult?.waitlisted ? (
              <>
                Te has apuntado a la lista de espera de <strong>{league.name}</strong> en posición{' '}
                <strong>{signupResult.position ?? '—'}</strong>.
              </>
            ) : (
              <>
                Te has inscrito en <strong>{league.name}</strong>. Podrás apuntarte a cada prueba cuando se abran sus inscripciones.
              </>
            )}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild variant="outline">
              <Link to={`/leagues/standings/${slug}`}>Ver clasificación</Link>
            </Button>
            <Button variant="ghost" onClick={() => setShowSuccessModal(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeagueSignup;
