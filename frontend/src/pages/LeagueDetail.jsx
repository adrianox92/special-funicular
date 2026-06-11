import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, BarChart3, Settings, Trash2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';
import LeagueStatusBadge from '../components/league/LeagueStatusBadge';
import LeagueCompetitionsTab from '../components/league/LeagueCompetitionsTab';
import LeagueParticipantsTab from '../components/league/LeagueParticipantsTab';
import LeagueRulesTab from '../components/league/LeagueRulesTab';
import LeagueStandingsTable from '../components/league/LeagueStandingsTable';
import { toast } from 'sonner';

const SCORING_LABEL = {
  league_rules: 'Reglas de liga',
  per_competition: 'Reglas por prueba',
};

const TIEBREAK_LABEL = {
  competitions_completed: 'Más pruebas disputadas',
  most_wins: 'Más victorias',
  last_race_position: 'Última prueba',
};

const LeagueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('competitions');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    counting_races: '',
    max_participants: '',
    tiebreak_mode: 'competitions_completed',
  });

  const loadLeague = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/leagues/${id}`);
      setLeague(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar la liga');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadStandings = useCallback(async () => {
    try {
      setStandingsLoading(true);
      const res = await axios.get(`/leagues/${id}/standings`);
      setStandings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setStandingsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  useEffect(() => {
    if (activeTab === 'standings') {
      loadStandings();
    }
  }, [activeTab, loadStandings]);

  const handleStatusChange = async (newStatus) => {
    try {
      setStatusUpdating(true);
      await axios.put(`/leagues/${id}`, { status: newStatus });
      toast.success('Estado actualizado');
      loadLeague();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar estado');
    } finally {
      setStatusUpdating(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      name: league.name || '',
      counting_races: league.counting_races != null ? String(league.counting_races) : '',
      max_participants: league.max_participants != null ? String(league.max_participants) : '',
      tiebreak_mode: league.tiebreak_mode || 'competitions_completed',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        name: editForm.name.trim(),
        tiebreak_mode: editForm.tiebreak_mode,
        counting_races: editForm.counting_races ? parseInt(editForm.counting_races, 10) : null,
        max_participants: editForm.max_participants ? parseInt(editForm.max_participants, 10) : null,
      };
      await axios.put(`/leagues/${id}`, payload);
      toast.success('Liga actualizada');
      setEditOpen(false);
      loadLeague();
      if (activeTab === 'standings') loadStandings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`/leagues/${id}`);
      toast.success('Liga eliminada');
      navigate('/leagues');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const copyLink = async (path) => {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    toast.success('Enlace copiado');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !league) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Liga no encontrada'}</AlertDescription>
      </Alert>
    );
  }

  const canManage = league.can_manage;
  const hasCompetitionsOrRules =
    (league.competitions?.length || 0) > 0 || (league.rules_count || 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate('/leagues')}>
          <ArrowLeft className="size-4 mr-2" />
          Volver
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{league.name}</h1>
              <LeagueStatusBadge status={league.status} />
              <Badge variant="outline">{SCORING_LABEL[league.scoring_mode]}</Badge>
              {league.counting_races ? (
                <Badge variant="secondary">Cuentan {league.counting_races} pruebas</Badge>
              ) : null}
            </div>
            {league.club?.name && (
              <p className="text-sm text-muted-foreground mt-1">Club: {league.club.name}</p>
            )}
            {league.tiebreak_mode ? (
              <p className="text-xs text-muted-foreground mt-1">
                Desempate: {TIEBREAK_LABEL[league.tiebreak_mode] || league.tiebreak_mode}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {league.status !== 'draft' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(`/leagues/signup/${league.slug}`)}
                >
                  <Link2 className="size-4 mr-2" />
                  Inscripción
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(`/leagues/standings/${league.slug}`)}
                >
                  <BarChart3 className="size-4 mr-2" />
                  Clasificación
                </Button>
              </>
            )}
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Settings className="size-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4 mr-2" />
                  Eliminar
                </Button>
                <Select
                  value={league.status}
                  onValueChange={handleStatusChange}
                  disabled={statusUpdating}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="published">Publicada</SelectItem>
                    <SelectItem value="running">En curso</SelectItem>
                    <SelectItem value="closed">Cerrada</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="competitions">Pruebas</TabsTrigger>
          <TabsTrigger value="participants">Participantes</TabsTrigger>
          {league.scoring_mode === 'league_rules' && (
            <TabsTrigger value="rules">Reglas</TabsTrigger>
          )}
          <TabsTrigger value="standings">Clasificación</TabsTrigger>
        </TabsList>

        <TabsContent value="competitions" className="mt-4">
          <LeagueCompetitionsTab league={league} canManage={canManage} onRefresh={loadLeague} />
        </TabsContent>

        <TabsContent value="participants" className="mt-4">
          <LeagueParticipantsTab league={league} canManage={canManage} onRefresh={loadLeague} />
        </TabsContent>

        {league.scoring_mode === 'league_rules' && (
          <TabsContent value="rules" className="mt-4">
            <LeagueRulesTab leagueId={league.id} scoringMode={league.scoring_mode} />
          </TabsContent>
        )}

        <TabsContent value="standings" className="mt-4">
          {standingsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6" />
            </div>
          ) : (
            <LeagueStandingsTable
              standings={standings?.standings || []}
              competitions={standings?.competitions || []}
              countingRaces={league.counting_races}
              exportBasePath={`/leagues/${id}`}
              leagueName={league.name}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar liga</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-counting">Pruebas que cuentan</Label>
              <Input
                id="edit-counting"
                type="number"
                min={1}
                value={editForm.counting_races}
                onChange={(e) => setEditForm({ ...editForm, counting_races: e.target.value })}
                placeholder="Todas"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-max">Cupo máximo</Label>
              <Input
                id="edit-max"
                type="number"
                min={1}
                value={editForm.max_participants}
                onChange={(e) => setEditForm({ ...editForm, max_participants: e.target.value })}
                placeholder="Sin límite"
              />
            </div>
            <div className="space-y-2">
              <Label>Desempate</Label>
              <Select
                value={editForm.tiebreak_mode}
                onValueChange={(v) => setEditForm({ ...editForm, tiebreak_mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competitions_completed">Más pruebas disputadas</SelectItem>
                  <SelectItem value="most_wins">Más victorias</SelectItem>
                  <SelectItem value="last_race_position">Última prueba</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasCompetitionsOrRules && (
              <p className="text-xs text-muted-foreground">
                El modo de puntuación no se puede cambiar porque ya hay pruebas o reglas.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner className="size-4" /> : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta liga?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán participantes y vínculos con competiciones. Las competiciones no se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeagueDetail;
