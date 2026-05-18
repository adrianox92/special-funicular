import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Trophy, Users, Calendar, Flag, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import axios from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Spinner } from '../components/ui/spinner';

const headerImgClass =
  'h-9 w-auto max-w-[min(100%,14rem)] object-contain object-left sm:max-w-[16rem]';
const footerImgClass =
  'h-8 w-auto max-w-[min(100%,12rem)] object-contain sm:max-w-[14rem]';

const SignupLayout = ({ headerLogoSrc, headerRight, title, children }) => (
  <div className="flex min-h-screen flex-col bg-background">
    <header
      className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            key={headerLogoSrc}
            src={headerLogoSrc}
            alt="Slot Database"
            className={headerImgClass}
            decoding="async"
          />
        </Link>
        {headerRight ? <div className="flex shrink-0 items-center gap-2">{headerRight}</div> : null}
      </div>
    </header>
    {title ? (
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">{title}</div>
    ) : null}
    <main className="flex-1 w-full">{children}</main>
    <footer className="border-t bg-muted/50 mt-auto">
      <div className="mx-auto flex max-w-6xl justify-center px-4 py-6 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            key={`${headerLogoSrc}-footer`}
            src={headerLogoSrc}
            alt="Slot Database"
            className={footerImgClass}
            decoding="async"
          />
        </Link>
      </div>
    </footer>
  </div>
);

const CompetitionSignup = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const headerLogoSrc = `${process.env.PUBLIC_URL || ''}/${
    theme === 'dark' ? 'logo-header.png' : 'logo-header-dark.png'
  }`;

  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [signupResult, setSignupResult] = useState(null);
  const [status, setStatus] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category_id: '',
    vehicle: ''
  });

  const loadCompetition = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/public-signup/${slug}`);
      setCompetition(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar competición:', err);
      if (err.response?.status === 404) {
        setError('Competición no encontrada');
      } else {
        setError('Error al cargar la información de la competición');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompetition();
    axios.get(`/public-signup/${slug}/status`).then(res => setStatus(res.data.status)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setSubmitError('El nombre es requerido');
      return;
    }
    if (!formData.email.trim()) {
      setSubmitError('El email es requerido');
      return;
    }
    if (!formData.category_id) {
      setSubmitError('Debes seleccionar una categoría');
      return;
    }
    if (!formData.vehicle.trim()) {
      setSubmitError('El vehículo es requerido');
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await axios.post(`/public-signup/${slug}/signup`, formData);
      setSignupResult({
        waitlisted: Boolean(res.data?.waitlisted),
        position: res.data?.waitlist_position ?? null,
      });
      setShowSuccessModal(true);
      setFormData({ name: '', email: '', category_id: '', vehicle: '' });
    } catch (err) {
      console.error('Error al enviar inscripción:', err);
      setSubmitError(err.response?.data?.error || 'Error al enviar la inscripción');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <SignupLayout headerLogoSrc={headerLogoSrc}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-16 sm:px-6">
          <Spinner className="size-8 mb-4" />
          <p className="text-muted-foreground">Cargando información de la competición...</p>
        </div>
      </SignupLayout>
    );
  }

  if (error) {
    return (
      <SignupLayout headerLogoSrc={headerLogoSrc}>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <Card className="text-center py-12">
            <CardContent>
              <AlertTriangle className="size-12 mx-auto text-destructive mb-4" />
              <h4 className="mb-4">Error</h4>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button variant="outline" onClick={() => navigate('/')} className="flex items-center gap-2 mx-auto">
                <ArrowLeft className="size-4" />
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </SignupLayout>
    );
  }

  const participantsCount = competition.participants_count ?? 0;
  const waitlistCount = competition.waitlist_count ?? 0;
  const slotsFull = participantsCount >= competition.num_slots;
  const effectiveStatus = competition.status || 'published';
  const progressPercent = Math.min(100, (participantsCount / competition.num_slots) * 100);
  const canSignup =
    effectiveStatus === 'published' && (!status || status.times_registered === 0);

  return (
    <SignupLayout
      headerLogoSrc={headerLogoSrc}
      headerRight={
        <Button variant="outline" size="sm" onClick={() => navigate('/')} className="flex items-center gap-2">
          <ArrowLeft className="size-4" />
          Volver
        </Button>
      }
      title={<h1 className="text-2xl font-bold">Inscripción a Competición</h1>}
    >
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info card */}
          <Card className="lg:col-span-1">
            <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
              <h5 className="font-semibold flex items-center gap-2">
                <Trophy className="size-4" />
                {competition.name}
              </h5>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="size-4" />
                  <small>
                    Pilotos confirmados: {participantsCount}/{competition.num_slots}
                    {waitlistCount > 0 ? ` · Lista espera: ${waitlistCount}` : ''}
                  </small>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${slotsFull ? 'bg-amber-600' : 'bg-primary'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {slotsFull && effectiveStatus === 'published' && (
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Plazas completas — inscripción con lista de espera
                  </span>
                )}
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="size-4" />
                  Creada: {formatDate(competition.created_at)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Trophy className="size-4" />
                  Rondas: {competition.rounds}
                </div>
                {competition.circuit_name && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Flag className="size-4" />
                    Circuito: {competition.circuit_name}
                  </div>
                )}
              </div>
              {competition.categories?.length > 0 && (
                <div>
                  <h6 className="font-medium mb-2">Categorías disponibles:</h6>
                  <div className="flex flex-wrap gap-2">
                    {competition.categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <h5 className="font-semibold">Formulario de Inscripción</h5>
            </CardHeader>
            <CardContent>
              {!canSignup ? (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    {effectiveStatus !== 'published' ? (
                      <>
                        <strong>Inscripción no disponible.</strong> Esta competición no está abierta a nuevas
                        inscripciones en este momento.
                      </>
                    ) : (
                      <>
                        <strong>La competición ya ha comenzado.</strong> Ya no es posible inscribirse.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {slotsFull && (
                    <Alert className="mb-4 border-amber-600/50 bg-amber-50 dark:bg-amber-950/30">
                      <AlertTriangle className="size-4 text-amber-700" />
                      <AlertDescription>
                        Las plazas de piloto están completas. Si envías el formulario, pasarás a la{' '}
                        <strong>lista de espera</strong>. Te avisaremos por correo si se libera una plaza.
                      </AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-4">
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre completo *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Tu nombre completo"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="tu@email.com"
                        required
                      />
                    </div>
                  </div>

                  {competition.categories?.length > 0 ? (
                    <div className="space-y-2">
                      <Label>Categoría *</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {competition.categories.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">Selecciona la categoría en la que quieres competir</p>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="size-4" />
                      <AlertDescription>
                        <strong>No hay categorías disponibles</strong> para esta competición. Contacta al organizador.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="vehicle">Vehículo con el que competirás *</Label>
                    <Input
                      id="vehicle"
                      value={formData.vehicle}
                      onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                      placeholder="Ej: Scalextric Ferrari F1, Carrera Porsche 911..."
                      required
                    />
                    <p className="text-sm text-muted-foreground">Especifica el modelo y marca de tu vehículo</p>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full flex items-center justify-center gap-2"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Spinner className="size-4" />
                        Enviando inscripción...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="size-4" />
                        {slotsFull ? 'Unirme a la lista de espera' : 'Enviar inscripción'}
                      </>
                    )}
                  </Button>
                </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={showSuccessModal}
          onOpenChange={(open) => {
            setShowSuccessModal(open);
            if (!open) setSignupResult(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="size-5" />
                {signupResult?.waitlisted ? 'Estás en lista de espera' : '¡Inscripción enviada!'}
              </DialogTitle>
              <DialogDescription>
                {signupResult?.waitlisted ? (
                  <>
                    Plazas completas. Tu posición en la lista de espera:{' '}
                    <strong>{signupResult.position ?? '—'}</strong>. Te enviaremos un correo si pasas a pendiente de
                    aprobación.
                  </>
                ) : (
                  <>
                    Tu inscripción ha sido enviada correctamente. El organizador revisará tu solicitud y te contactará
                    si es necesario.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              <strong>Competición:</strong> {competition?.name}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSuccessModal(false)}>Cerrar</Button>
              <Button onClick={() => navigate('/')}>Volver al inicio</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SignupLayout>
  );
};

export default CompetitionSignup;
