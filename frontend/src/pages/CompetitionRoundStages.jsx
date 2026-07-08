import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Flag, Save } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
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
import { Spinner } from '../components/ui/spinner';
import { toast } from 'sonner';
import {
  buildCompetitionCircuitOptions,
  competitionCircuitLabel,
} from '../utils/competitionCircuits';

function buildStageMap(stages, rounds) {
  const map = {};
  for (let round = 1; round <= rounds; round += 1) {
    map[round] = { circuit_id: '', laps_per_round: '' };
  }
  (stages || []).forEach((stage) => {
    map[stage.round_number] = {
      circuit_id: stage.circuit_id || '',
      laps_per_round: stage.laps_per_round != null ? String(stage.laps_per_round) : '',
    };
  });
  return map;
}

const CompetitionRoundStages = ({ competitionId, competition, readOnly = false }) => {
  const [circuits, setCircuits] = useState([]);
  const [clubCircuits, setClubCircuits] = useState([]);
  const [stageConfig, setStageConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const rounds = competition?.rounds || 0;
  const clubId = competition?.club_id || '';
  const isMultiStage = Boolean(competition?.is_multi_stage);
  const lapsOnly = !isMultiStage && rounds > 1;

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
      setStageConfig(buildStageMap(stages, rounds));
    } catch (err) {
      console.error('Error al cargar configuración por ronda:', err);
      setError(err.response?.data?.error || 'Error al cargar la configuración por ronda');
    } finally {
      setLoading(false);
    }
  }, [competition?.round_stages, competitionId, rounds]);

  useEffect(() => {
    if (isMultiStage) {
      loadCircuits();
    }
  }, [isMultiStage, loadCircuits]);

  useEffect(() => {
    if (isMultiStage) {
      loadClubCircuits();
    }
  }, [isMultiStage, loadClubCircuits]);

  useEffect(() => {
    if (competitionId && rounds > 0 && (isMultiStage || lapsOnly)) {
      loadStages();
    }
  }, [competitionId, isMultiStage, lapsOnly, loadStages, rounds]);

  const updateStage = (roundNumber, patch) => {
    setStageConfig((prev) => ({
      ...prev,
      [roundNumber]: {
        circuit_id: '',
        laps_per_round: '',
        ...prev[roundNumber],
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const stages = Object.entries(stageConfig)
        .map(([roundNumber, config]) => {
          const circuitId = lapsOnly ? null : config.circuit_id || null;
          const lapsRaw = config.laps_per_round?.trim?.() ?? config.laps_per_round;
          const lapsPerRound = lapsRaw ? parseInt(lapsRaw, 10) : null;
          return {
            round_number: parseInt(roundNumber, 10),
            circuit_id: circuitId,
            laps_per_round: lapsPerRound,
          };
        })
        .filter((stage) => stage.circuit_id || stage.laps_per_round);

      await axios.put(`/competitions/${competitionId}/round-stages`, { stages });
      toast.success(lapsOnly ? 'Vueltas por ronda guardadas' : 'Tramos guardados');
      await loadStages();
    } catch (err) {
      console.error('Error al guardar configuración por ronda:', err);
      const message = err.response?.data?.error || 'Error al guardar la configuración por ronda';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isMultiStage && rounds <= 1) {
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
          {lapsOnly ? (
            <>
              Define un número de vueltas opcional para cada ronda. Si una ronda no tiene valor,
              Slot Lap Timer usará modo libre.
              {competition.laps_per_round
                ? ` También puedes usar el valor global (${competition.laps_per_round}) si lo defines en la competición.`
                : ''}
            </>
          ) : (
            <>
              Asigna un circuito y/o un número de vueltas opcional a cada tramo. Si no seleccionas
              circuito, se usará el circuito por defecto de la competición
              {competition.circuit_name ? ` (${competition.circuit_name})` : ''}.
              {competition.laps_per_round
                ? ` Si un tramo no define vueltas, se aplicará el valor global (${competition.laps_per_round}).`
                : ' Si un tramo no define vueltas, Slot Lap Timer usará modo libre.'}
            </>
          )}
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
          const config = stageConfig[roundNumber] || { circuit_id: '', laps_per_round: '' };
          const circuitValue = config.circuit_id || 'none';

          return (
            <Card key={roundNumber}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 font-medium">
                    <Flag className="size-4 text-muted-foreground" />
                    {lapsOnly ? `Ronda ${roundNumber}` : `Tramo ${roundNumber}`}
                  </div>
                  <div className={`grid gap-4 ${isMultiStage ? 'sm:grid-cols-2' : ''}`}>
                    {isMultiStage && (
                      <div className="space-y-2">
                        <Label htmlFor={`stage-circuit-${roundNumber}`}>Circuito</Label>
                        <Select
                          value={circuitValue}
                          onValueChange={(v) =>
                            updateStage(roundNumber, { circuit_id: v === 'none' ? '' : v })
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
                    )}
                    <div className="space-y-2">
                      <Label htmlFor={`stage-laps-${roundNumber}`}>Vueltas (objetivo)</Label>
                      <Input
                        id={`stage-laps-${roundNumber}`}
                        type="number"
                        min="1"
                        placeholder="Sin límite"
                        value={config.laps_per_round}
                        onChange={(e) =>
                          updateStage(roundNumber, { laps_per_round: e.target.value })
                        }
                        disabled={readOnly}
                      />
                    </div>
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
            {lapsOnly ? 'Guardar vueltas por ronda' : 'Guardar tramos'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CompetitionRoundStages;
