import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Users, Calendar, Trophy, Flag, Clock, Star, ChevronDown, ChevronUp } from 'lucide-react';
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
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';

const COMPETITIONS_DEBUG_ORG_KEY = 'scalextric_competitions_for_organizer';

function isUuidString(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
  );
}

const Competitions = () => {
  const { user } = useAuth();
  const isLicenseAdmin = isLicenseAdminUser(user);
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

  const [favorites, setFavorites] = useState([]);
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);
  const [selectedFavorites, setSelectedFavorites] = useState({});
  const [defaultCategoryName, setDefaultCategoryName] = useState('General');

  const [debugOrganizerId, setDebugOrganizerId] = useState(null);
  const [debugOrganizerInput, setDebugOrganizerInput] = useState('');
  const [debugLookupLoading, setDebugLookupLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!isLicenseAdmin) return;
    try {
      const stored = sessionStorage.getItem(COMPETITIONS_DEBUG_ORG_KEY);
      if (stored && isUuidString(stored)) {
        setDebugOrganizerId(stored.trim());
      }
    } catch (_) {
      /* ignore */
    }
  }, [isLicenseAdmin]);

  const loadCompetitions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (debugOrganizerId) {
        params.for_organizer = debugOrganizerId;
      }
      const response = await axios.get('/competitions/my-competitions', { params });
      setCompetitions(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar competiciones:', err);
      setError(err.response?.data?.error || 'Error al cargar las competiciones');
    } finally {
      setLoading(false);
    }
  }, [debugOrganizerId]);

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

  const loadFavorites = async () => {
    try {
      const response = await axios.get('/favorite-pilots');
      setFavorites(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
    }
  };

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions]);

  useEffect(() => {
    loadCircuits();
    loadClubs();
    loadFavorites();
  }, []);

  const toggleFavoriteSelection = (favId) => {
    setSelectedFavorites((prev) => {
      const next = { ...prev };
      if (next[favId]) {
        delete next[favId];
      } else {
        const fav = favorites.find((f) => f.id === favId);
        const defaultSource = fav?.default_vehicle_id || fav?.default_vehicle_model ? 'favorite_default' : 'text';
        next[favId] = {
          vehicle_source: defaultSource,
          vehicle_id: '',
          vehicle_model: '',
        };
      }
      return next;
    });
  };

  const updateFavoriteSelection = (favId, patch) => {
    setSelectedFavorites((prev) => ({
      ...prev,
      [favId]: { ...prev[favId], ...patch },
    }));
  };

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

    const favoriteItems = Object.entries(selectedFavorites);
    if (favoriteItems.length > parseInt(createForm.num_slots || '0', 10)) {
      setCreateError(`Has seleccionado ${favoriteItems.length} favoritos pero solo tienes ${createForm.num_slots} plazas`);
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

      const competitionId = response.data.id;

      if (favoriteItems.length > 0) {
        try {
          const catName = (defaultCategoryName || 'General').trim() || 'General';
          const catResponse = await axios.post(`/competitions/${competitionId}/categories`, {
            name: catName,
          });
          const categoryId = catResponse.data.id;

          const items = favoriteItems.map(([favorite_id, cfg]) => ({
            favorite_id,
            category_id: categoryId,
            vehicle_source: cfg.vehicle_source,
            vehicle_id: cfg.vehicle_source === 'own' ? cfg.vehicle_id : undefined,
            vehicle_model: cfg.vehicle_source === 'text' ? cfg.vehicle_model : undefined,
          }));

          const bulkResponse = await axios.post(
            `/competitions/${competitionId}/participants/bulk-from-favorites`,
            { items },
          );
          const created = bulkResponse.data?.created?.length || 0;
          const skipped = bulkResponse.data?.skipped || [];
          if (created > 0) {
            toast.success(`Competición creada con ${created} piloto${created === 1 ? '' : 's'} favorito${created === 1 ? '' : 's'}`);
          }
          if (skipped.length > 0) {
            toast.warning(`${skipped.length} favorito(s) no se pudieron añadir`);
          }
        } catch (bulkErr) {
          console.error('Error añadiendo favoritos:', bulkErr);
          toast.error(bulkErr.response?.data?.error || 'La competición se creó, pero no se pudieron añadir los favoritos');
        }
      }

      setShowCreateModal(false);
      setCreateForm({ name: '', num_slots: '', rounds: '1', circuit_id: '', club_id: '' });
      setSelectedFavorites({});
      setFavoritesExpanded(false);
      setDefaultCategoryName('General');

      navigate(`/competitions/${competitionId}/participants`);
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

  const applyDebugOrganizerView = async () => {
    const raw = debugOrganizerInput.trim();
    if (!raw) {
      toast.error('Introduce un email o UUID de organizador');
      return;
    }
    try {
      setDebugLookupLoading(true);
      let uid = null;
      if (raw.includes('@')) {
        const { data } = await axios.get('/license-account/admin/lookup', {
          params: { email: raw },
        });
        uid = data?.user_id;
        if (!uid) {
          toast.error('Usuario no encontrado');
          return;
        }
      } else if (isUuidString(raw)) {
        uid = raw.trim();
      } else {
        toast.error('Formato inválido: usa email o UUID');
        return;
      }
      setDebugOrganizerId(uid);
      try {
        sessionStorage.setItem(COMPETITIONS_DEBUG_ORG_KEY, uid);
      } catch (_) {
        /* ignore */
      }
      setDebugOrganizerInput('');
      toast.success('Mostrando competiciones de ese organizador');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'No se pudo resolver el usuario');
    } finally {
      setDebugLookupLoading(false);
    }
  };

  const clearDebugOrganizerView = () => {
    setDebugOrganizerId(null);
    try {
      sessionStorage.removeItem(COMPETITIONS_DEBUG_ORG_KEY);
    } catch (_) {
      /* ignore */
    }
    toast.message('Vista restablecida a tus competiciones');
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
          <p className="text-muted-foreground">
            {isLicenseAdmin && debugOrganizerId
              ? `Modo depuración: competiciones del organizador ${debugOrganizerId}`
              : 'Gestiona tus competiciones y participantes'}
          </p>
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

        <Dialog open={showCreateModal} onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) {
            setSelectedFavorites({});
            setFavoritesExpanded(false);
            setDefaultCategoryName('General');
          }
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="size-4" />
              Nueva Competición
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
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

                <div className="rounded-md border">
                  <button
                    type="button"
                    onClick={() => setFavoritesExpanded((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent rounded-md"
                  >
                    <span className="flex items-center gap-2">
                      <Star className="size-4 text-primary" />
                      Añadir pilotos favoritos ahora (opcional)
                      {Object.keys(selectedFavorites).length > 0 && (
                        <Badge variant="secondary">{Object.keys(selectedFavorites).length}</Badge>
                      )}
                    </span>
                    {favoritesExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>

                  {favoritesExpanded && (
                    <div className="px-3 pb-3 pt-1 space-y-3">
                      {favorites.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Aún no tienes favoritos.{' '}
                          <Link to="/pilots/favorites" className="underline">
                            Crea tu primer favorito
                          </Link>{' '}
                          para añadirlos al tirón a tus competiciones.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="default-category">Categoría para los favoritos</Label>
                            <Input
                              id="default-category"
                              value={defaultCategoryName}
                              onChange={(e) => setDefaultCategoryName(e.target.value)}
                              placeholder="General"
                            />
                            <p className="text-xs text-muted-foreground">
                              Se creará una categoría con este nombre y todos los favoritos se añadirán a ella. Podrás crear más categorías después.
                            </p>
                          </div>

                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {favorites.map((fav) => {
                              const selected = selectedFavorites[fav.id];
                              const hasDefaultVehicle =
                                !!fav.default_vehicle_id || !!fav.default_vehicle_model;
                              return (
                                <div key={fav.id} className="border rounded-md p-2 space-y-2">
                                  <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!selected}
                                      onChange={() => toggleFavoriteSelection(fav.id)}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium text-sm">{fav.display_name}</div>
                                      {hasDefaultVehicle && (
                                        <div className="text-xs text-muted-foreground">
                                          {fav.default_vehicle
                                            ? `${fav.default_vehicle.manufacturer} ${fav.default_vehicle.model}`
                                            : fav.default_vehicle_model}
                                        </div>
                                      )}
                                    </div>
                                  </label>

                                  {selected && (
                                    <div className="pl-6 space-y-2">
                                      <div className="flex flex-wrap gap-3 text-xs">
                                        {hasDefaultVehicle && (
                                          <label className="flex items-center gap-1 cursor-pointer">
                                            <input
                                              type="radio"
                                              name={`fav-src-${fav.id}`}
                                              checked={selected.vehicle_source === 'favorite_default'}
                                              onChange={() =>
                                                updateFavoriteSelection(fav.id, { vehicle_source: 'favorite_default' })
                                              }
                                            />
                                            Vehículo por defecto
                                          </label>
                                        )}
                                        <label className="flex items-center gap-1 cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`fav-src-${fav.id}`}
                                            checked={selected.vehicle_source === 'text'}
                                            onChange={() =>
                                              updateFavoriteSelection(fav.id, { vehicle_source: 'text' })
                                            }
                                          />
                                          Vehículo (texto)
                                        </label>
                                      </div>
                                      {selected.vehicle_source === 'text' && (
                                        <Input
                                          value={selected.vehicle_model}
                                          onChange={(e) =>
                                            updateFavoriteSelection(fav.id, {
                                              vehicle_model: e.target.value,
                                            })
                                          }
                                          placeholder="Modelo de vehículo"
                                          className="h-8 text-sm"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
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

      {isLicenseAdmin && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">Depuración (admin)</p>
            <p className="text-xs text-muted-foreground">
              Ver la lista de competiciones como si fueras otro organizador (email o UUID). Requiere{' '}
              <code className="text-xs bg-muted px-1 rounded">LICENSE_ADMIN_EMAILS</code> en el servidor.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="debug-organizer">Email o UUID del organizador</Label>
                <Input
                  id="debug-organizer"
                  placeholder="correo@ejemplo.com o uuid"
                  value={debugOrganizerInput}
                  onChange={(e) => setDebugOrganizerInput(e.target.value)}
                  disabled={debugLookupLoading}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={debugLookupLoading}
                onClick={applyDebugOrganizerView}
              >
                {debugLookupLoading ? 'Buscando…' : 'Aplicar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!debugOrganizerId}
                onClick={clearDebugOrganizerView}
              >
                Restablecer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
