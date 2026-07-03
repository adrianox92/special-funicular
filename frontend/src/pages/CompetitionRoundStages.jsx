import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Flag, Save } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Spinner } from '../components/ui/spinner';
import { toast } from 'sonner';
import {
  buildCompetitionCircuitOptions,
  competitionCircuitLabel,
} from '../utils/competitionCircuits';

function buildStageMap(stages) {
  const map = {};
  (stages || []).forEach((stage) => {
    map[stage.round_number] = stage.circuit_id || '';
  });
  return map;
}

const CompetitionRoundStages = ({ competitionId, competition, readOnly = false }) => {
  const [circuits, setCircuits] = useState([]);
  const [clubCircuits, setClubCircuits] = useState([]);
  const [stageCircuits, setStageCircuits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const rounds = competition?.rounds || 0;
  const clubId = competition?.club_id || '';

  const circuitOptions = useMemo(
    () => buildCompetitionCircuitOptions(circuits, clubCircuits, clubId || null),
    [clubId, clubCircuits, circuits],
  );

  const loadCircuits = useCallback(async () => {
    try {
      const response = await axios.get('/circuits');
      setCircuits(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar circuitos:', err);
    }
  }, []);

  const loadClubCircuits = useCallback(async () => {
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
  }, [clubId]);

  const loadStages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/competitions/${competitionId}/round-stages`);
      const stages = Array.isArray(response.data) ? response.data : competition?.round_stages || [];
      const initial = buildStageMap(stages);
      const filled = {};
      for (let round = 1; round <= rounds; round += 1) {
        filled[round] = initial[round] || '';
      }
      setStageCircuits(filled);
    } catch (err) {
      console.error('Error al cargar tramos:', err);
      setError(err.response?.data?.error || 'Error al cargar los tramos');
    } finally {
      setLoading(false);
    }
  }, [competition?.round_stages, competitionId, rounds]);

  useEffect(() => {
    loadCircuits();
  }, [loadCircuits]);

  useEffect(() => {
    loadClubCircuits();
  }, [loadClubCircuits]);

  useEffect(() => {
    if (competitionId && rounds > 0) {
      loadStages();
    }
  }, [competitionId, loadStages, rounds]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const stages = Object.entries(stageCircuits)
        .filter(([, circuitId]) => circuitId)
        .map(([roundNumber, circuitId]) => ({
          round_number: parseInt(roundNumber, 10),
          circuit_id: circuitId,
        }));

      await axios.put(`/competitions/${competitionId}/round-stages`, { stages });
      toast.success('Tramos guardados');
      await loadStages();
    } catch (err) {
      console.error('Error al guardar tramos:', err);
      const message = err.response?.data?.error || 'Error al guardar los tramos';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!competition?.is_multi_stage) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Asigna un circuito opcional a cada tramo. Si no seleccionas ninguno, se usará el circuito
          por defecto de la competición
          {competition.circuit_name ? ` (${competition.circuit_name})` : ''}.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {Array.from({ length: rounds }, (_, index) => {
          const roundNumber = index + 1;
          const value = stageCircuits[roundNumber] || 'none';

          return (
            <Card key={roundNumber}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <Flag className="size-4 text-muted-foreground" />
                    Tramo {roundNumber}
                  </div>
                  <div className="w-full sm:max-w-md space-y-2">
                    <Label htmlFor={`stage-circuit-${roundNumber}`}>Circuito</Label>
                    <Select
                      value={value}
                      onValueChange={(v) =>
                        setStageCircuits((prev) => ({
                          ...prev,
                          [roundNumber]: v === 'none' ? '' : v,
                        }))
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger id={`stage-circuit-${roundNumber}`}>
                        <SelectValue placeholder="Usar circuito por defecto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Usar circuito por defecto</SelectItem>
                        {circuitOptions.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {competitionCircuitLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
            Guardar tramos
          </Button>
        </div>
      )}
    </div>
  );
};

export default CompetitionRoundStages;
