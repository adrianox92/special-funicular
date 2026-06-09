import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, BarChart3 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
            </div>
            {league.club?.name && (
              <p className="text-sm text-muted-foreground mt-1">Club: {league.club.name}</p>
            )}
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
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LeagueDetail;
