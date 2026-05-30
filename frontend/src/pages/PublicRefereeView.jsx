import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import CompetitionRefereePanel from '../components/CompetitionRefereePanel';

const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/+$/, '');

const publicRefereeApi = axios.create({
  baseURL: `${apiBase}/referee`,
});

const PublicRefereeView = () => {
  const { token } = useParams();
  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [round, setRound] = useState(1);

  const apiRequest = useCallback(
    async (method, path, body) => {
      const url = `/${encodeURIComponent(token)}${path}`;
      if (method === 'get') return publicRefereeApi.get(url);
      if (method === 'post') return publicRefereeApi.post(url, body);
      if (method === 'put') return publicRefereeApi.put(url, body);
      if (method === 'patch') return publicRefereeApi.patch(url, body);
      throw new Error(`Método no soportado: ${method}`);
    },
    [token],
  );

  const loadCompetitionData = useCallback(async () => {
    try {
      setLoading(true);
      const [compResponse, partResponse, timingsResponse] = await Promise.all([
        publicRefereeApi.get(`/${encodeURIComponent(token)}`),
        publicRefereeApi.get(`/${encodeURIComponent(token)}/participants`),
        publicRefereeApi.get(`/${encodeURIComponent(token)}/timings`),
      ]);
      setCompetition(compResponse.data);
      setParticipants(partResponse.data || []);
      setTimings(timingsResponse.data || []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || 'Enlace no válido o desactivado');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadCompetitionData();
  }, [loadCompetitionData]);

  useEffect(() => {
    if (!competition?.rounds) return;
    setRound((r) => Math.min(Math.max(1, r), competition.rounds));
  }, [competition?.rounds]);

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
      <div className="mt-4 p-4 max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!participants.length) {
    return (
      <div className="mt-4 p-4 max-w-lg mx-auto">
        <Alert>
          <AlertDescription>
            Aún no hay participantes confirmados en esta competición.
          </AlertDescription>
        </Alert>
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
      showBackButton={false}
    />
  );
};

export default PublicRefereeView;
