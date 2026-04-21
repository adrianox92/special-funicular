import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Calendar, Trophy, Flag, Clock } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
  DialogTrigger,
} from '../components/ui/dialog';
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

const Competitions = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [circuits, setCircuits] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [createForm, setCreateForm] = useState({
    name: '',
    num_slots: '',
    rounds: '1',
    circuit_id: '',
    club_id: ''
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, competitionId: null });

  const navigate = useNavigate();

  const loadCompetitions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/competitions/my-competitions');
      setCompetitions(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar competiciones:', err);
      setError('Error al cargar las competiciones');
    } finally {
      setLoading(false);
    }
  };

  const loadCircuits = async () => {
    try {
      const response = await axios.get('/circuits');
      setCircuits(response.data);
    } catch (err) {
      console.error('Error al cargar circuitos:', err);
    }
  };

  const loadClubs = async () => {
    try {
      const response = await axios.get('/clubs/mine');
      setClubs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar clubes:', err);
    }
  };

  useEffect(() => {
    loadCompetitions();
    loadCircuits();
    loadClubs();
  }, []);

  const handleCreateCompetition = async (e) => {
    e.preventDefault();

    if (!createForm.name.trim() || !createForm.num_slots || !createForm.rounds) {
      setCreateError('Por favor, completa todos los campos');
      return;
    }

    if (createForm.num_slots <= 0) {
      setCreateError('El número de plazas debe ser mayor a 0');
      return;
    }

    if (createForm.rounds <= 0) {
      setCreateError('El número de rondas debe ser mayor a 0');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const response = await axios.post('/competitions', {
        name: createForm.name.trim(),
        num_slots: parseInt(createForm.num_slots),
        rounds: parseInt(createForm.rounds),
        circuit_id: createForm.circuit_id || null,
        club_id: createForm.club_id || null
      });

      setShowCreateModal(false);
      setCreateForm({ name: '', num_slots: '', rounds: '1', circuit_id: '', club_id: '' });

      navigate(`/competitions/${response.data.id}/participants`);
    } catch (err) {
      console.error('Error al crear competición:', err);
      setCreateError(err.response?.data?.error || 'Error al crear la competición');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCompetition = (competitionId) => {
    setDeleteConfirm({ open: true, competitionId });
  };

  const confirmDeleteCompetition = async () => {
    if (!deleteConfirm.competitionId) return;
    try {
      await axios.delete(`/competitions/${deleteConfirm.competitionId}`);
      setDeleteConfirm({ open: false, competitionId: null });
      loadCompetitions();
    } catch (err) {
      console.error('Error al eliminar competición:', err);
      toast.error('Error al eliminar la competición');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis Competiciones</h1>
          <p className="text-muted-foreground">Gestiona tus competiciones y participantes</p>
        </div>
        <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, competitionId: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar competición?</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar esta competición? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteCompetition} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="size-4" />
              Nueva Competición
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Competición</DialogTitle>
              <DialogDescription>Crea una nueva competición para gestionar participantes y tiempos</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCompetition}>
              <div className="space-y-4 py-4">
                {createError && (
                  <Alert variant="destructive">
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Competición</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Copa de Invierno 2024"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="num_slots">Número de Plazas</Label>
                  <Input
                    id="num_slots"
                    type="number"
                    min="1"
                    max="50"
                    placeholder="Ej: 8"
                    value={createForm.num_slots}
                    onChange={(e) => setCreateForm({ ...createForm, num_slots: e.target.value })}
                    required
                  />
                  <p className="text-sm text-muted-foreground">Número máximo de participantes permitidos</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rounds">Número de Rondas</Label>
                  <Input
                    id="rounds"
                    type="number"
                    min="1"
                    max="10"
                    placeholder="Ej: 3"
                    value={createForm.rounds}
                    onChange={(e) => setCreateForm({ ...createForm, rounds: e.target.value })}
                    required
                  />
                  <p className="text-sm text-muted-foreground">Número máximo de rondas permitidas</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="circuit_id">Circuito</Label>
                  <Select
                    value={createForm.circuit_id || 'none'}
                    onValueChange={(v) => setCreateForm({ ...createForm, circuit_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar circuito (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {circuits.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Opcional. Crea circuitos en el apartado Circuitos</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="club_id">Club (opcional)</Label>
                  <Select
                    value={createForm.club_id || 'none'}
                    onValueChange={(v) => setCreateForm({ ...createForm, club_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger id="club_id">
                      <SelectValue placeholder="Sin club" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin club</SelectItem>
                      {clubs.map((club) => (
                        <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Los miembros del club podrán ver esta competición. Gestiona clubes en el menú Clubes.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Spinner className="size-4 mr-2" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4 mr-2" />
                      Crear Competición
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {competitions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="size-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="mb-2">No tienes competiciones</h4>
            <p className="text-muted-foreground mb-6">
              Crea tu primera competición para empezar a gestionar participantes
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 mx-auto">
              <Plus className="size-4" />
              Crear Primera Competición
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitions.map((competition) => (
            <Card key={competition.id} className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-2 mb-4 min-w-0">
                  <h5 className="font-semibold text-lg min-w-0 flex-1 truncate">{competition.name}</h5>
                  <Badge variant={competition.participants_count >= competition.num_slots ? 'default' : 'secondary'} className="shrink-0">
                    {competition.participants_count}/{competition.num_slots}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="size-4" />
                    Participantes
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    Creada: {formatDate(competition.created_at)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4" />
                    Rondas: {competition.rounds}
                  </div>
                  {(competition.circuit_name || competition.circuits?.name) && (
                    <div className="flex items-center gap-2">
                      <Flag className="size-4" />
                      Circuito: {competition.circuit_name || competition.circuits?.name}
                    </div>
                  )}
                </div>

                <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
                  <div
                    className="h-full bg-primary transition-all rounded-full"
                    style={{ width: `${(competition.participants_count / competition.num_slots) * 100}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/competitions/${competition.id}/participants`)}
                  >
                    Gestionar Participantes
                  </Button>
                  {competition.participants_count > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/competitions/${competition.id}/timings`)}
                    >
                      <Clock className="size-4 mr-1" />
                      Tiempos
                      {competition.participants_count < competition.num_slots && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {competition.participants_count}
                        </Badge>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCompetition(competition.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Competitions;
