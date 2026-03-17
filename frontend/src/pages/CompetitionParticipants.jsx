import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Trash2, Pencil, ArrowLeft, Check, X, Trophy, AlertTriangle, Clock, Tags, Link2 } from 'lucide-react';
import axios from '../lib/axios';
import CompetitionSignups from '../components/CompetitionSignups';
import CompetitionCategories from '../components/CompetitionCategories';
import CompetitionRulesPanel from '../components/CompetitionRulesPanel';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Spinner } from '../components/ui/spinner';
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
} from '../components/ui/alert-dialog';

const CompetitionParticipants = () => {
  const { id: competitionId } = useParams();
  const navigate = useNavigate();

  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('participants');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    vehicle_id: '',
    driver_name: '',
    vehicle_model: '',
    category_id: ''
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [participantType, setParticipantType] = useState('own');
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, participantId: null });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editForm, setEditForm] = useState({
    vehicle_id: '',
    driver_name: '',
    vehicle_model: '',
    category_id: ''
  });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState(null);

  const loadCompetition = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}`);
      setCompetition(response.data);
      setParticipants(response.data.participants || []);
      setError(null);
    } catch (err) {
      console.error('Error al cargar competición:', err);
      setError('Error al cargar la competición');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  const loadVehicles = useCallback(async () => {
    try {
      const response = await axios.get('/competitions/vehicles');
      setVehicles(response.data);
    } catch (err) {
      console.error('Error al cargar vehículos:', err);
    }
  }, []);

  useEffect(() => {
    loadCompetition();
    loadVehicles();
  }, [loadCompetition, loadVehicles]);

  const handleAddParticipant = useCallback(async (e) => {
    e.preventDefault();
    if (!addForm.driver_name.trim()) {
      setAddError('El nombre del piloto es requerido');
      return;
    }
    if (!addForm.category_id) {
      setAddError('Debes seleccionar una categoría');
      return;
    }
    if (participantType === 'own' && !addForm.vehicle_id) {
      setAddError('Debes seleccionar un vehículo');
      return;
    }
    if (participantType === 'external' && !addForm.vehicle_model.trim()) {
      setAddError('Debes especificar el modelo del vehículo');
      return;
    }
    try {
      setAdding(true);
      setAddError(null);
      const participantData = {
        driver_name: addForm.driver_name.trim(),
        category_id: addForm.category_id
      };
      if (participantType === 'own') {
        participantData.vehicle_id = addForm.vehicle_id;
      } else {
        participantData.vehicle_model = addForm.vehicle_model.trim();
      }
      await axios.post(`/competitions/${competitionId}/participants`, participantData);
      setShowAddModal(false);
      setAddForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
      setParticipantType('own');
      loadCompetition();
    } catch (err) {
      console.error('Error al añadir participante:', err);
      setAddError(err.response?.data?.error || 'Error al añadir el participante');
    } finally {
      setAdding(false);
    }
  }, [addForm, participantType, competitionId, loadCompetition]);

  const handleEditParticipant = useCallback(async (e) => {
    e.preventDefault();
    if (!editForm.driver_name.trim()) {
      setEditError('El nombre del piloto es requerido');
      return;
    }
    if (!editForm.category_id) {
      setEditError('Debes seleccionar una categoría');
      return;
    }
    try {
      setEditing(true);
      setEditError(null);
      const participantData = {
        driver_name: editForm.driver_name.trim(),
        category_id: editForm.category_id
      };
      if (editForm.vehicle_id) {
        participantData.vehicle_id = editForm.vehicle_id;
      } else if (editForm.vehicle_model) {
        participantData.vehicle_model = editForm.vehicle_model.trim();
      }
      await axios.put(`/competitions/${competitionId}/participants/${editingParticipant.id}`, participantData);
      setShowEditModal(false);
      setEditingParticipant(null);
      setEditForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
      loadCompetition();
    } catch (err) {
      console.error('Error al editar participante:', err);
      setEditError(err.response?.data?.error || 'Error al editar el participante');
    } finally {
      setEditing(false);
    }
  }, [editForm, editingParticipant, competitionId, loadCompetition]);

  const openEditModal = useCallback((participant) => {
    setEditingParticipant(participant);
    setEditForm({
      vehicle_id: participant.vehicle_id || '',
      driver_name: participant.driver_name,
      vehicle_model: participant.vehicle_model || '',
      category_id: participant.category_id || ''
    });
    setShowEditModal(true);
  }, []);

  const handleDeleteParticipant = useCallback((participantId) => {
    setDeleteConfirm({ open: true, participantId });
  }, []);

  const confirmDeleteParticipant = useCallback(async () => {
    if (!deleteConfirm.participantId) return;
    try {
      await axios.delete(`/competitions/${competitionId}/participants/${deleteConfirm.participantId}`);
      setDeleteConfirm({ open: false, participantId: null });
      loadCompetition();
    } catch (err) {
      console.error('Error al eliminar participante:', err);
      toast.error('Error al eliminar el participante');
    }
  }, [competitionId, loadCompetition, deleteConfirm.participantId]);

  const getVehicleInfo = useCallback((participant) => {
    if (participant.vehicle_id && participant.vehicles) {
      return { model: participant.vehicles.model, manufacturer: participant.vehicles.manufacturer, type: 'own' };
    }
    if (participant.vehicle_model) {
      return { model: participant.vehicle_model, manufacturer: 'Externo', type: 'external' };
    }
    return null;
  }, []);

  const getCategoryName = useCallback((categoryId) => {
    if (!competition?.categories) return 'Sin categoría';
    const category = competition.categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Sin categoría';
  }, [competition?.categories]);

  const generatePublicLink = () => {
    if (competition?.public_slug && competition.categories && competition.categories.length > 0) {
      return `${window.location.origin}/competitions/signup/${competition.public_slug}`;
    }
    return null;
  };

  const generateStatusLink = () => {
    if (competition?.public_slug) {
      return `${window.location.origin}/competitions/status/${competition.public_slug}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!competition) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Competición no encontrada</AlertDescription>
      </Alert>
    );
  }

  const isFull = participants.length >= competition.num_slots;
  const canStartCompetition = participants.length > 0;
  const publicLink = generatePublicLink();
  const statusLink = generateStatusLink();
  const progressPercent = (participants.length / competition.num_slots) * 100;

  return (
    <div className="space-y-6">
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, participantId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar participante?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este participante? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteParticipant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/competitions')}>
              <ArrowLeft className="size-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{competition.name}</h1>
              <p className="text-muted-foreground text-sm">Gestionar competición</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {publicLink && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(publicLink);
                  toast.success('Enlace copiado al portapapeles');
                }}
                title="Copiar enlace de inscripción pública"
              >
                <Link2 className="size-4 mr-2" />
                Formulario de inscripción
              </Button>
            )}
            <Button
              onClick={() => navigate(`/competitions/${competitionId}/timings`)}
              disabled={!canStartCompetition}
              title={!canStartCompetition ? 'Necesitas al menos un participante' : 'Gestionar tiempos'}
            >
              <Clock className="size-4 mr-2" />
              Gestionar Tiempos
              {!canStartCompetition && (
                <Badge variant="secondary" className="ml-2">Sin participantes</Badge>
              )}
              {canStartCompetition && !isFull && (
                <Badge variant="secondary" className="ml-2">{participants.length} participantes</Badge>
              )}
              {isFull && (
                <Badge variant="default" className="ml-2">Completa</Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="size-4 text-primary" />
                <strong>Participantes:</strong>
                <Badge variant={isFull ? 'default' : participants.length > 0 ? 'default' : 'secondary'}>
                  {participants.length}/{competition.num_slots}
                </Badge>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className="h-full bg-primary transition-all rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {isFull && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Check className="size-4" />
                  Competición completa
                </div>
              )}
              {participants.length > 0 && !isFull && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  Lista para comenzar
                </div>
              )}
              {participants.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4" />
                  Sin participantes
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="size-4" />
                <strong>Estado:</strong>
                <Badge variant={isFull ? 'default' : participants.length > 0 ? 'secondary' : 'outline'}>
                  {isFull ? 'Completa' : participants.length > 0 ? 'Lista' : 'Vacía'}
                </Badge>
              </div>
              {participants.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4" />
                  Añade al menos un participante
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="size-4" />
                <strong>Rondas:</strong>
                <Badge variant="secondary">{competition.rounds}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Total de tiempos: {participants.length * competition.rounds}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="size-4" />
                <strong>Enlace público:</strong>
              </div>
              {publicLink ? (
                <span
                  className="text-sm font-medium text-primary break-all cursor-pointer select-all"
                  onClick={() => {
                    navigator.clipboard.writeText(statusLink);
                    toast.success('Enlace copiado al portapapeles');
                  }}
                  title="Haz clic para copiar"
                >
                  {statusLink}
                </span>
              ) : !competition.public_slug ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="size-4" />
                  No disponible
                </div>
              ) : !competition.categories || competition.categories.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                  Sin categorías
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="size-4" />
                  No disponible
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-2">
          <TabsTrigger value="participants" className="flex items-center gap-2">
            <Users className="size-4" />
            Participantes ({participants.length})
          </TabsTrigger>
          <TabsTrigger value="signups" className="flex items-center gap-2">
            <Users className="size-4" />
            Inscripciones ({competition?.signups_count || 0})
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tags className="size-4" />
            Categorías ({competition?.categories?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Trophy className="size-4" />
            Reglas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h5 className="font-semibold">Participantes Confirmados</h5>
            <Button
              onClick={() => setShowAddModal(true)}
              disabled={!competition.categories || competition.categories.length === 0}
            >
              <span className="mr-2">+</span>
              Añadir Participante
            </Button>
          </div>

          {participants.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Users className="size-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="mb-2">No hay participantes</h4>
                <p className="text-muted-foreground mb-6">Añade el primer participante para empezar</p>
                <Button onClick={() => setShowAddModal(true)}>
                  <span className="mr-2">+</span>
                  Añadir Primer Participante
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Piloto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Vehículo</TableHead>
                    {competition?.rules?.length > 0 && <TableHead>Puntos</TableHead>}
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant, idx) => {
                    const info = getVehicleInfo(participant);
                    return (
                      <TableRow key={participant.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{participant.driver_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Tags className="size-3" />
                            {getCategoryName(participant.category_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>{info ? `${info.manufacturer} ${info.model}` : '-'}</TableCell>
                        {competition?.rules?.length > 0 && (
                          <TableCell>{participant.points || 0}</TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditModal(participant)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteParticipant(participant.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="signups" className="mt-4">
          <CompetitionSignups competitionId={competitionId} onSignupApproved={loadCompetition} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CompetitionCategories competitionId={competitionId} onCategoryChange={loadCompetition} />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <CompetitionRulesPanel competitionId={competitionId} onRuleChange={() => {}} />
        </TabsContent>
      </Tabs>

      {/* Modal Añadir */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir Participante</DialogTitle>
            <DialogDescription>Añade un nuevo participante a la competición</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddParticipant}>
            <div className="space-y-4 py-4">
              {addError && (
                <Alert variant="destructive">
                  <AlertDescription>{addError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Tipo de participante</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="participantType"
                      checked={participantType === 'own'}
                      onChange={() => setParticipantType('own')}
                      className="rounded-full"
                    />
                    De mi colección
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="participantType"
                      checked={participantType === 'external'}
                      onChange={() => setParticipantType('external')}
                      className="rounded-full"
                    />
                    Externo
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-category">Categoría *</Label>
                <Select
                  value={addForm.category_id}
                  onValueChange={(v) => setAddForm({ ...addForm, category_id: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {competition.categories?.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-driver">Nombre del piloto *</Label>
                <Input
                  id="add-driver"
                  value={addForm.driver_name}
                  onChange={(e) => setAddForm({ ...addForm, driver_name: e.target.value })}
                  placeholder="Nombre del piloto"
                  required
                />
              </div>

              {participantType === 'own' ? (
                <div className="space-y-2">
                  <Label>Vehículo *</Label>
                  <Select
                    value={addForm.vehicle_id}
                    onValueChange={(v) => setAddForm({ ...addForm, vehicle_id: v })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un vehículo" />
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
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="add-model">Modelo del vehículo *</Label>
                  <Input
                    id="add-model"
                    value={addForm.vehicle_model}
                    onChange={(e) => setAddForm({ ...addForm, vehicle_model: e.target.value })}
                    placeholder="Ej: Scalextric Ferrari F1, Carrera Porsche 911..."
                    required
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Añadiendo...
                  </>
                ) : (
                  'Añadir Participante'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={showEditModal} onOpenChange={(open) => !open && setShowEditModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Participante</DialogTitle>
            <DialogDescription>Modifica los datos del participante</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditParticipant}>
            <div className="space-y-4 py-4">
              {editError && (
                <Alert variant="destructive">
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-driver">Nombre del piloto *</Label>
                <Input
                  id="edit-driver"
                  value={editForm.driver_name}
                  onChange={(e) => setEditForm({ ...editForm, driver_name: e.target.value })}
                  placeholder="Nombre del piloto"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Categoría *</Label>
                <Select
                  value={editForm.category_id}
                  onValueChange={(v) => setEditForm({ ...editForm, category_id: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {competition.categories?.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vehículo</Label>
                <Select
                  value={editForm.vehicle_id}
                  onValueChange={(v) => setEditForm({ ...editForm, vehicle_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un vehículo" />
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

              <div className="space-y-2">
                <Label htmlFor="edit-model">O modelo personalizado</Label>
                <Input
                  id="edit-model"
                  value={editForm.vehicle_model}
                  onChange={(e) => setEditForm({ ...editForm, vehicle_model: e.target.value })}
                  placeholder="Ej: Scalextric Ferrari F1, Carrera Porsche 911..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editing}>
                {editing ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Pencil className="size-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetitionParticipants;
