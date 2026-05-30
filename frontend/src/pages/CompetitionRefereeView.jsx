import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import CompetitionRefereePanel from '../components/CompetitionRefereePanel';

const CompetitionRefereeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [round, setRound] = useState(1);

  const canUseOrganizerTools = useMemo(
    () =>
      Boolean(
        (user?.id && competition?.organizer === user.id) || isLicenseAdminUser(user),
      ),
    [user, competition?.organizer],
  );

  const loadCompetitionData = useCallback(async () => {
    try {
      setLoading(true);
      const [compResponse, partResponse, timingsResponse] = await Promise.all([
        axios.get(`/competitions/${id}`),
        axios.get(`/competitions/${id}/participants`),
        axios.get(`/competitions/${id}/timings`),
      ]);
      setCompetition(compResponse.data);
      setParticipants(partResponse.data || []);
      setTimings(timingsResponse.data || []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCompetitionData();
  }, [loadCompetitionData]);

  useEffect(() => {
    if (!competition?.rounds) return;
    setRound((r) => Math.min(Math.max(1, r), competition.rounds));
  }, [competition?.rounds]);

  const apiRequest = useCallback(
    async (method, path, body) => {
      const base = `/competitions/${id}`;
      if (method === 'post') return axios.post(`${base}${path}`, body);
      if (method === 'put') return axios.put(`${base}${path}`, body);
      if (method === 'patch') {
        if (path.includes('/penalty')) {
          const timingId = path.split('/')[2];
          return axios.patch(`/competitions/competition-timings/${timingId}/penalty`, body);
        }
        return axios.patch(`${base}${path}`, body);
      }
      return axios.get(`${base}${path}`);
    },
    [id],
  );

  if (loading) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center gap-3 min-h-[40vh]">
        <Spinner className="size-8" />
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/competitions/${id}/timings`)}>
          Volver a tiempos
        </Button>
      </div>
    );
  }

  if (!canUseOrganizerTools) {
    return (
      <div className="mt-4 p-4 max-w-lg mx-auto space-y-4">
        <Alert>
          <AlertDescription>No tienes permiso para usar el modo árbitro en esta competición.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate(`/competitions/${id}/timings`)}>
          <ArrowLeft className="size-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  if (!participants.length) {
    return (
      <div className="mt-4 p-4 space-y-4">
        <Alert>
          <AlertDescription>Añade participantes antes de registrar tiempos.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate(`/competitions/${id}/participants`)}>
          Ir a participantes
        </Button>
      </div>
    );
  }

  return (
    <CompetitionRefereePanel
      competition={competition}
      participants={participants}
      timings={timings}
      round={round}
      setRound={setRound}
      onReload={loadCompetitionData}
      apiRequest={apiRequest}
      onBack={() => navigate(`/competitions/${id}/timings`)}
      showBackButton
    />
  );
};

export default CompetitionRefereeView;
