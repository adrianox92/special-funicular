import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Users, Calendar, Trophy, Flag, Star, ChevronDown, ChevronUp, Link2, ChevronRight } from 'lucide-react';
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
import { Switch } from '../components/ui/switch';
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
import CompetitionStatusBadge from '../components/CompetitionStatusBadge';
import { competitionPublicSignupUrl } from '../utils/clubEventCalendarExport';
import {
  buildCompetitionCircuitOptions,
  competitionCircuitLabel,
} from '../utils/competitionCircuits';
import { competitionDetailPath } from '../utils/competitionRoutes';

const COMPETITIONS_DEBUG_ORG_KEY = 'scalextric_competitions_for_organizer';

function isUuidString(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
  );
}

const Competitions = () => {
  const { t } = useTranslation('competitions');
  const { user } = useAuth();
  const isLicenseAdmin = isLicenseAdminUser(user);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [circuits, setCircuits] = useState([]);
  const [clubCircuits, setClubCircuits] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [createForm, setCreateForm] = useState({
    name: '',
    num_slots: '',
    rounds: '1',
    laps_per_round: '',
    circuit_id: '',
    club_id: '',
    registration_deadline: '',
    is_multi_stage: false,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, competitionId: null });

  const [favorites, setFavorites] = useState([]);
  const [favoritesExpanded, setFavoritesExpanded] = useState(false);
  const [selectedFavorites, setSelectedFavorites] = useState({});
  const [guestMembers, setGuestMembers] = useState([]);
  const [guestsExpanded, setGuestsExpanded] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState({});
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

  const loadGuestMembers = async (clubId) => {
    if (!clubId) {
      setGuestMembers([]);
      return;
    }
    try {
      const response = await axios.get(`/clubs/${clubId}/guest-members`);
      setGuestMembers(Array.isArray(response.data?.guest_members) ? response.data.guest_members : []);
    } catch (err) {
      console.error('Error al cargar miembros invitados:', err);
      setGuestMembers([]);
    }
  };

  const patchCompetitionStatus = async (competitionId, status) => {
    try {
      await axios.patch(`/competitions/${competitionId}/status`, { status });
      toast.success('Estado actualizado');
      await loadCompetitions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo cambiar el estado');
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

  const loadClubCircuits = async (clubId) => {
    if (!clubId) {
      setClubCircuits([]);
      return;
    }
    try {
      const response = await axios.get(`/clubs/${clubId}/circuits`);
      setClubCircuits(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar circuitos del club:', err);
      setClubCircuits([]);
    }
  };

  useEffect(() => {
    loadClubCircuits(createForm.club_id || null);
    loadGuestMembers(createForm.club_id || null);
    if (!createForm.club_id) {
      setSelectedGuests({});
      setGuestsExpanded(false);
    }
  }, [createForm.club_id]);

  const circuitOptions = buildCompetitionCircuitOptions(
    circuits,
    clubCircuits,
    createForm.club_id || null,
  );

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

  const eligibleGuestMembers = (guestMembers || []).filter((guest) => !guest.linked_user_id);

  const toggleGuestSelection = (guestId) => {
    setSelectedGuests((prev) => {
      const next = { ...prev };
      if (next[guestId]) {
        delete next[guestId];
      } else {
        next[guestId] = {
          vehicle_source: 'text',
          vehicle_id: '',
          vehicle_model: '',
        };
      }
      return next;
    });
  };

  const updateGuestSelection = (guestId, patch) => {
    setSelectedGuests((prev) => ({
      ...prev,
      [guestId]: { ...prev[guestId], ...patch },
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
    const guestItems = Object.entries(selectedGuests);
    const totalQuickAdd = favoriteItems.length + guestItems.length;
    if (totalQuickAdd > parseInt(createForm.num_slots || '0', 10)) {
      setCreateError(
        t('guestMembers.slotsExceeded', {
          total: totalQuickAdd,
          slots: createForm.num_slots,
        }),
      );
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const response = await axios.post('/competitions', {
        name: createForm.name.trim(),
        num_slots: parseInt(createForm.num_slots),
        rounds: parseInt(createForm.rounds),
        laps_per_round:
          createForm.is_multi_stage || parseInt(createForm.rounds, 10) > 1
            ? null
            : createForm.laps_per_round
              ? parseInt(createForm.laps_per_round, 10)
              : null,
        circuit_id: createForm.circuit_id || null,
        club_id: createForm.club_id || null,
        is_multi_stage: Boolean(createForm.is_multi_stage),
        registration_deadline: createForm.registration_deadline
          ? new Date(createForm.registration_deadline).toISOString()
          : null,
      });

      const competitionId = response.data.id;

      if (favoriteItems.length > 0 || guestItems.length > 0) {
        try {
          const catName = (defaultCategoryName || 'General').trim() || 'General';
          const catResponse = await axios.post(`/competitions/${competitionId}/categories`, {
            name: catName,
          });
          const categoryId = catResponse.data.id;

          if (favoriteItems.length > 0) {
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
          }

          if (guestItems.length > 0) {
            const guestBulkItems = guestItems.map(([guest_member_id, cfg]) => ({
              guest_member_id,
              category_id: categoryId,
              vehicle_source: cfg.vehicle_source,
              vehicle_id: cfg.vehicle_source === 'own' ? cfg.vehicle_id : undefined,
              vehicle_model: cfg.vehicle_source === 'text' ? cfg.vehicle_model : undefined,
            }));

            const guestBulkResponse = await axios.post(
              `/competitions/${competitionId}/participants/bulk-from-guest-members`,
              { items: guestBulkItems },
            );
            const guestCreated = guestBulkResponse.data?.created?.length || 0;
            const guestSkipped = guestBulkResponse.data?.skipped || [];
            if (guestCreated > 0) {
              toast.success(t('guestMembers.createBulkSuccess', { count: guestCreated }));
            }
            if (guestSkipped.length > 0) {
              toast.warning(t('guestMembers.createBulkWarning', { count: guestSkipped.length }));
            }
          }
        } catch (bulkErr) {
          console.error('Error añadiendo pilotos:', bulkErr);
          toast.error(bulkErr.response?.data?.error || t('guestMembers.createBulkError'));
        }
      }

      setShowCreateModal(false);
      setCreateForm({ name: '', num_slots: '', rounds: '1', laps_per_round: '', circuit_id: '', club_id: '', registration_deadline: '', is_multi_stage: false });
      setSelectedFavorites({});
      setSelectedGuests({});
      setFavoritesExpanded(false);
      setGuestsExpanded(false);
      setDefaultCategoryName('General');

      navigate(competitionDetailPath(competitionId));
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

  const copyPublicSignupLink = async (slug) => {
    const url = competitionPublicSignupUrl(slug);
    if (!url || !navigator.clipboard?.writeText) {
      toast.error('No se pudo copiar el enlace');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace público copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const confirmDeleteCompetition = async () => {
    if (!deleteConfirm.competitionId) return;
    try {
      await axios.delete(`/competitions/${deleteConfirm.competitionId}`);
      setDeleteConfirm({ open: false, competitionId: null });
      loadCompetitions();
    } catch (err) {
      console.error('Error al eliminar competición:', err);
      const status = err.response?.status;
      const msg =
        status === 404
          ? 'No puedes eliminar esta competición (solo el organizador o un administrador).'
          : err.response?.data?.error || 'Error al eliminar la competición';
      toast.error(msg);
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
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {isLicenseAdmin && debugOrganizerId
              ? t('list.debugSubtitle', { id: debugOrganizerId })
              : t('list.subtitle')}
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
          <DialogContent className="max-w-lg">
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
                    placeholder="Ej: 3"
                    value={createForm.rounds}
                    onChange={(e) => {
                      const nextRounds = e.target.value;
                      const roundsNum = parseInt(nextRounds || '1', 10);
                      setCreateForm({
                        ...createForm,
                        rounds: nextRounds,
                        laps_per_round: roundsNum > 1 ? '' : createForm.laps_per_round,
                      });
                    }}
                    required
                  />
                  <p className="text-sm text-muted-foreground">Número máximo de rondas permitidas</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="laps_per_round">Vueltas por ronda (objetivo)</Label>
                  <Input
                    id="laps_per_round"
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={createForm.laps_per_round}
                    onChange={(e) => setCreateForm({ ...createForm, laps_per_round: e.target.value })}
                    disabled={
                      createForm.is_multi_stage ||
                      parseInt(createForm.rounds || '1', 10) > 1
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    {createForm.is_multi_stage
                      ? 'En competiciones multi-tramo, configura las vueltas por tramo en la gestión de la competición.'
                      : parseInt(createForm.rounds || '1', 10) > 1
                        ? 'Con varias rondas, configura las vueltas por ronda en la gestión de la competición.'
                        : 'Opcional. Si se define, Slot Lap Timer fijará ese número de vueltas y no permitirá cambiarlo.'}
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="is_multi_stage">Competición multi-tramo</Label>
                    <p className="text-sm text-muted-foreground">
                      Cada ronda puede usar un circuito distinto (ideal para rally).
                    </p>
                  </div>
                  <Switch
                    id="is_multi_stage"
                    checked={createForm.is_multi_stage}
                    onCheckedChange={(checked) =>
                      setCreateForm({
                        ...createForm,
                        is_multi_stage: checked,
                        laps_per_round: checked ? '' : createForm.laps_per_round,
                      })
                    }
                  />
                </div>

                {createForm.is_multi_stage && (
                  <Alert>
                    <AlertDescription>
                      El circuito y las vueltas de cada tramo se configuran en la gestión de la competición.
                      El circuito seleccionado abajo actuará como circuito por defecto.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="registration_deadline">Fecha límite de inscripción (opcional)</Label>
                  <Input
                    id="registration_deadline"
                    type="datetime-local"
                    value={createForm.registration_deadline}
                    onChange={(e) => setCreateForm({ ...createForm, registration_deadline: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Tras esta fecha no se aceptarán inscripciones públicas. El organizador podrá añadir participantes manualmente.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="circuit_id">
                    {createForm.is_multi_stage ? 'Circuito por defecto' : 'Circuito'}
                  </Label>
                  <Select
                    value={createForm.circuit_id || 'none'}
                    onValueChange={(v) => setCreateForm({ ...createForm, circuit_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar circuito (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno</SelectItem>
                      {circuitOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {competitionCircuitLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {createForm.club_id
                      ? 'Incluye circuitos del club y tus circuitos personales.'
                      : 'Opcional. Crea circuitos en el apartado Circuitos o en tu club.'}
                  </p>
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
                    onClick={() => requestAnimationFrame(() => setFavoritesExpanded((v) => !v))}
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

                {createForm.club_id && (
                  <div className="rounded-md border">
                    <button
                      type="button"
                      onClick={() => requestAnimationFrame(() => setGuestsExpanded((v) => !v))}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent rounded-md"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="size-4 text-primary" />
                        {t('guestMembers.createSectionTitle')}
                        {Object.keys(selectedGuests).length > 0 && (
                          <Badge variant="secondary">{Object.keys(selectedGuests).length}</Badge>
                        )}
                      </span>
                      {guestsExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>

                    {guestsExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-3">
                        {eligibleGuestMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t('guestMembers.empty')}{' '}
                            <Link to={`/clubs/${createForm.club_id}`} className="underline">
                              {t('guestMembers.emptyManageLink')}
                            </Link>
                          </p>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="default-category-guests">{t('guestMembers.categoryLabel')}</Label>
                              <Input
                                id="default-category-guests"
                                value={defaultCategoryName}
                                onChange={(e) => setDefaultCategoryName(e.target.value)}
                                placeholder="General"
                              />
                              <p className="text-xs text-muted-foreground">
                                Se creará una categoría con este nombre y todos los miembros seleccionados se añadirán a ella.
                              </p>
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {eligibleGuestMembers.map((guest) => {
                                const selected = selectedGuests[guest.id];
                                return (
                                  <div key={guest.id} className="border rounded-md p-2 space-y-2">
                                    <label className="flex items-start gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!selected}
                                        onChange={() => toggleGuestSelection(guest.id)}
                                        className="mt-1"
                                      />
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{guest.name}</div>
                                        {guest.email && (
                                          <div className="text-xs text-muted-foreground">{guest.email}</div>
                                        )}
                                      </div>
                                    </label>

                                    {selected && (
                                      <div className="pl-6 space-y-2">
                                        <div className="flex flex-wrap gap-3 text-xs">
                                          <label className="flex items-center gap-1 cursor-pointer">
                                            <input
                                              type="radio"
                                              name={`guest-src-${guest.id}`}
                                              checked={selected.vehicle_source === 'text'}
                                              onChange={() =>
                                                updateGuestSelection(guest.id, { vehicle_source: 'text' })
                                              }
                                            />
                                            {t('guestMembers.vehicleText')}
                                          </label>
                                        </div>
                                        {selected.vehicle_source === 'text' && (
                                          <Input
                                            value={selected.vehicle_model}
                                            onChange={(e) =>
                                              updateGuestSelection(guest.id, {
                                                vehicle_model: e.target.value,
                                              })
                                            }
                                            placeholder={t('guestMembers.vehicleTextPlaceholder')}
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
                )}
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
          {competitions.map((competition) => {
            const participantCount = competition.participants_count ?? 0;
            const slotCap = competition.num_slots ?? 0;
            const occupancyPct =
              slotCap > 0 ? Math.min(100, (participantCount / slotCap) * 100) : 0;
            return (
            <Card key={competition.id} className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-2 mb-4 min-w-0">
                  <h5 className="font-semibold text-lg min-w-0 flex-1 truncate">{competition.name}</h5>
                  <div className="flex shrink-0 items-center gap-1">
                    {competition.public_slug ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Copiar enlace público (inscripción)"
                        aria-label="Copiar enlace público"
                        onClick={() => copyPublicSignupLink(competition.public_slug)}
                      >
                        <Link2 className="size-4" />
                      </Button>
                    ) : (
                      <span
                        className="hidden text-[10px] text-muted-foreground sm:inline whitespace-nowrap"
                        title="Esta competición no tiene slug de inscripción pública"
                      >
                        Sin enlace público
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <CompetitionStatusBadge status={competition.status} />
                  {(isLicenseAdmin || user?.id === competition.organizer) && (
                    <>
                      {(competition.status || 'published') === 'draft' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => patchCompetitionStatus(competition.id, 'published')}
                        >
                          Publicar
                        </Button>
                      )}
                      {(competition.status || 'published') === 'published' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => patchCompetitionStatus(competition.id, 'draft')}
                        >
                          Despublicar
                        </Button>
                      )}
                      {(competition.status || 'published') === 'running' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => patchCompetitionStatus(competition.id, 'closed')}
                        >
                          Cerrar
                        </Button>
                      )}
                      {(competition.status || 'published') === 'closed' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => patchCompetitionStatus(competition.id, 'published')}
                        >
                          Reabrir
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-2 mb-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 shrink-0" />
                    <span>
                      Participantes:{' '}
                      <span className="font-medium tabular-nums text-foreground">
                        {participantCount}/{slotCap}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    Creada: {formatDate(competition.created_at)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4" />
                    Rondas: {competition.rounds}
                    {competition.laps_per_round ? (
                      <span> · Vueltas/ronda: {competition.laps_per_round}</span>
                    ) : null}
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
                    style={{ width: `${occupancyPct}%` }}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full gap-2 justify-between"
                    onClick={() => navigate(competitionDetailPath(competition.id))}
                  >
                    {t('list.openCompetition')}
                    <ChevronRight className="size-4" />
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {competition.public_slug && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => copyPublicSignupLink(competition.public_slug)}
                      >
                        <Link2 className="size-3.5" />
                        {t('list.copyPublicLink')}
                      </Button>
                    )}
                    {(isLicenseAdmin || user?.id === competition.organizer) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteCompetition(competition.id)}
                      >
                        {t('list.delete')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Competitions;
