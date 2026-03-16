import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, Calendar, Flag, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import axios from '../lib/axios';
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

const CompetitionSignup = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
      await axios.post(`/public-signup/${slug}/signup`, formData);
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
      <div className="flex flex-col justify-center items-center min-h-[50vh]">
        <Spinner className="size-8 mb-4" />
        <p className="text-muted-foreground">Cargando información de la competición...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
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
    );
  }

  const isFull = competition.signups_count >= competition.num_slots;
  const progressPercent = (competition.signups_count / competition.num_slots) * 100;
  const canSignup = !isFull && (!status || status.times_registered === 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/')} className="flex items-center gap-2">
          <ArrowLeft className="size-4" />
          Volver
        </Button>
        <h1 className="text-2xl font-bold">Inscripción a Competición</h1>
      </div>

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
                <small>Plazas: {competition.signups_count}/{competition.num_slots}</small>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${isFull ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {isFull && (
                <span className="text-sm font-medium text-destructive">¡Completo!</span>
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
            {isFull ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  <strong>¡Competición completa!</strong> No hay plazas disponibles en este momento.
                </AlertDescription>
              </Alert>
            ) : (
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
                  disabled={submitting || !canSignup}
                >
                  {submitting ? (
                    <>
                      <Spinner className="size-4" />
                      Enviando inscripción...
                    </>
                  ) : !canSignup && status?.times_registered > 0 ? (
                    <>
                      <AlertTriangle className="size-4" />
                      Ya no es posible inscribirse porque la competición ha comenzado.
                    </>
                  ) : (
                    <>
                      <CheckCircle className="size-4" />
                      Enviar Inscripción
                    </>
                  )}
                </Button>

                {status?.times_registered > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>Ya no es posible inscribirse porque la competición ha comenzado.</AlertDescription>
                  </Alert>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="size-5" />
              ¡Inscripción enviada!
            </DialogTitle>
            <DialogDescription>
              Tu inscripción ha sido enviada correctamente. El organizador de la competición revisará tu solicitud y te contactará si es necesario.
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
  );
};

export default CompetitionSignup;
