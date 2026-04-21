import React, { useState, useEffect } from 'react';
import { Users, Check, X, User, Mail, Car, Tag, Calendar } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
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
import { Spinner } from './ui/spinner';
import { toast } from 'sonner';
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

const CompetitionSignups = ({ competitionId, onSignupApproved }) => {
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedSignup, setSelectedSignup] = useState(null);
  const [approveForm, setApproveForm] = useState({ vehicle_id: '', vehicle_model: '' });
  const [approveMode, setApproveMode] = useState('member');
  const [vehicles, setVehicles] = useState([]);
  const [rejectConfirm, setRejectConfirm] = useState({ open: false, signupId: null });

  const formatMemberVehicle = (signup) => {
    if (!signup) return '';
    if (signup.vehicles) {
      const parts = [signup.vehicles.manufacturer, signup.vehicles.model].filter(Boolean);
      return parts.join(' ');
    }
    return signup.vehicle ?? '';
  };

  const loadSignups = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}/signups`);
      setSignups(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar inscripciones:', err);
      setError('Error al cargar las inscripciones');
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await axios.get('/competitions/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Error al cargar vehículos:', err);
    }
  };

  useEffect(() => {
    loadSignups();
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  const openApproveModal = (signup) => {
    setSelectedSignup(signup);
    setApproveForm({ vehicle_id: '', vehicle_model: signup.vehicle || '' });
    setApproveMode('member');
    setApproveError(null);
    setShowApproveModal(true);
  };

  const handleApproveSignup = async (e) => {
    e.preventDefault();
    let approveData = {};
    if (approveMode === 'member') {
      if (!selectedSignup?.vehicle_id && !(selectedSignup?.vehicle || '').trim()) {
        setApproveError('La inscripción no tiene vehículo; elige otra opción.');
        return;
      }
      approveData = {};
    } else if (approveMode === 'organizer') {
      if (!approveForm.vehicle_id) {
        setApproveError('Selecciona un vehículo de tu colección');
        return;
      }
      approveData = { vehicle_id: approveForm.vehicle_id };
    } else if (approveMode === 'custom') {
      if (!approveForm.vehicle_model.trim()) {
        setApproveError('Escribe el modelo del vehículo');
        return;
      }
      approveData = { vehicle_model: approveForm.vehicle_model.trim() };
    }
    try {
      setApproving(true);
      setApproveError(null);
      await axios.post(
        `/competitions/${competitionId}/signups/${selectedSignup.id}/approve`,
        approveData,
      );
      setShowApproveModal(false);
      setSelectedSignup(null);
      setApproveForm({ vehicle_id: '', vehicle_model: '' });
      setApproveMode('member');
      loadSignups();
      onSignupApproved?.();
    } catch (err) {
      console.error('Error al aprobar inscripción:', err);
      setApproveError(err.response?.data?.error || 'Error al aprobar la inscripción');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSignup = (signupId) => {
    setRejectConfirm({ open: true, signupId });
  };

  const confirmRejectSignup = async () => {
    if (!rejectConfirm.signupId) return;
    try {
      await axios.delete(`/competitions/${competitionId}/signups/${rejectConfirm.signupId}`);
      setRejectConfirm({ open: false, signupId: null });
      loadSignups();
      onSignupApproved?.();
    } catch (err) {
      console.error('Error al rechazar inscripción:', err);
      toast.error('Error al rechazar la inscripción');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h6 className="font-semibold flex items-center gap-2">
            <Users className="size-4" />
            Inscripciones Públicas
          </h6>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Spinner className="size-6 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Cargando inscripciones...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h6 className="font-semibold flex items-center gap-2">
            <Users className="size-4" />
            Inscripciones pendientes de validar ({signups.length})
          </h6>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {signups.length === 0 ? (
            <div className="text-center py-8">
              <Users className="size-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay inscripciones pendientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {signups.map((signup) => (
                <div
                  key={signup.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg border bg-card"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="size-4 text-primary" />
                      <strong>{signup.name}</strong>
                      <Badge variant="secondary" className="ml-auto">
                        <Calendar className="size-3 mr-1" />
                        {formatDate(signup.created_at)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Mail className="size-4" />
                      {signup.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Car className="size-4" />
                      {formatMemberVehicle(signup) || signup.vehicle}
                      {signup.vehicle_id && (
                        <Badge variant="outline" className="ml-1">De su colección</Badge>
                      )}
                    </div>
                    {signup.competition_categories && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Tag className="size-4" />
                        {signup.competition_categories.name}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openApproveModal(signup)} className="flex items-center gap-1">
                      <Check className="size-4" />
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectSignup(signup.id)}
                      className="flex items-center gap-1"
                    >
                      <X className="size-4" />
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={rejectConfirm.open} onOpenChange={(open) => !open && setRejectConfirm({ open: false, signupId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar inscripción?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres rechazar esta inscripción? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRejectSignup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="size-5" />
              Aprobar Inscripción
            </DialogTitle>
            <DialogDescription>
              Confirma el vehículo con el que correrá el participante.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApproveSignup}>
            <div className="space-y-4 py-4">
              {approveError && (
                <Alert variant="destructive">
                  <AlertDescription>{approveError}</AlertDescription>
                </Alert>
              )}
              {selectedSignup && (
                <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                  <h6 className="font-medium">Información del solicitante:</h6>
                  <p className="text-sm"><strong>Nombre:</strong> {selectedSignup.name}</p>
                  <p className="text-sm"><strong>Email:</strong> {selectedSignup.email}</p>
                  <p className="text-sm">
                    <strong>Vehículo propuesto:</strong>{' '}
                    {formatMemberVehicle(selectedSignup) || selectedSignup.vehicle || '—'}
                    {selectedSignup.vehicle_id && ' (de su colección)'}
                  </p>
                  {selectedSignup.competition_categories && (
                    <p className="text-sm">
                      <strong>Categoría:</strong> {selectedSignup.competition_categories.name}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Vehículo para la competición</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="approveMode"
                      checked={approveMode === 'member'}
                      onChange={() => setApproveMode('member')}
                      className="rounded-full"
                    />
                    Usar el propuesto por el miembro
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="approveMode"
                      checked={approveMode === 'organizer'}
                      onChange={() => setApproveMode('organizer')}
                      className="rounded-full"
                    />
                    Asignar uno de mi colección
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="approveMode"
                      checked={approveMode === 'custom'}
                      onChange={() => setApproveMode('custom')}
                      className="rounded-full"
                    />
                    Escribir modelo personalizado
                  </label>
                </div>
              </div>

              {approveMode === 'organizer' && (
                <div className="space-y-2">
                  <Label>Vehículo de mi colección</Label>
                  <Select
                    value={approveForm.vehicle_id}
                    onValueChange={(v) => setApproveForm({ ...approveForm, vehicle_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar vehículo de mi colección" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.manufacturer} {v.model} ({v.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {approveMode === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="vehicle-model">Modelo personalizado</Label>
                  <Input
                    id="vehicle-model"
                    value={approveForm.vehicle_model}
                    onChange={(e) => setApproveForm({ ...approveForm, vehicle_model: e.target.value })}
                    placeholder="Ej: Scalextric Ferrari F1..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowApproveModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={approving}>
                {approving ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Aprobando...
                  </>
                ) : (
                  <>
                    <Check className="size-4 mr-2" />
                    Aprobar Participante
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompetitionSignups;
