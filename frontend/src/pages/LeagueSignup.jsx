import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, Users, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import axios from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import LeagueStatusBadge from '../components/league/LeagueStatusBadge';

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
  const [success, setSuccess] = useState(false);

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
      await axios.post(`/public-leagues/${slug}/signup`, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        vehicle: form.vehicle.trim() || undefined,
      });
      setSuccess(true);
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

  if (success) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b px-4 py-3">
          <Link to="/">
            <img src={headerLogoSrc} alt="Slot Database" className={headerImgClass} />
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 text-center space-y-4">
              <CheckCircle className="size-12 mx-auto text-green-500" />
              <h2 className="text-xl font-bold">¡Inscripción confirmada!</h2>
              <p className="text-muted-foreground">
                Te has inscrito en <strong>{league.name}</strong>. Podrás apuntarte a cada prueba individual cuando se abran sus inscripciones.
              </p>
              <Button asChild variant="outline">
                <Link to={`/leagues/standings/${slug}`}>Ver clasificación</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const signupClosed = league.status === 'closed';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-3">
        <Link to="/">
          <img src={headerLogoSrc} alt="Slot Database" className={headerImgClass} />
        </Link>
      </header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-8">
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
              {league.participants_count} participante{league.participants_count !== 1 ? 's' : ''} inscrito{league.participants_count !== 1 ? 's' : ''}
            </p>
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
                    {submitting ? <Spinner className="size-4" /> : 'Inscribirse en la liga'}
                  </Button>
                </form>
              </>
            )}

            {(league.competitions || []).length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-medium mb-2">Pruebas de la liga</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {league.competitions.map((c, i) => (
                    <li key={c.id}>#{i + 1} {c.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LeagueSignup;
