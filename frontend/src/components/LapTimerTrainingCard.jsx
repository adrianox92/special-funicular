import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { useLapTimerPremium } from '../hooks/useLapTimerPremium';
import LapTimerPremiumNotice from './LapTimerPremiumNotice';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Spinner } from './ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { buildAppTimingRedirectUrl, DEFAULT_GUIDED_TARGET_MS } from '../utils/appTimingLink';

/**
 * PB + CTA para abrir Slot Lap Timer con entrenamiento guiado.
 */
export default function LapTimerTrainingCard({
  vehicleId,
  circuits = [],
  initialCircuitId = '',
  initialLane = '',
  compact = false,
}) {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);
  const { isPremium, loading: premiumLoading } = useLapTimerPremium();

  const [circuitId, setCircuitId] = useState(initialCircuitId || '');
  const [lane, setLane] = useState(initialLane && initialLane !== 'Sin carril' ? String(initialLane) : '1');
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialCircuitId) setCircuitId(initialCircuitId);
  }, [initialCircuitId]);

  useEffect(() => {
    if (initialLane && initialLane !== 'Sin carril') setLane(String(initialLane));
  }, [initialLane]);

  const selectedCircuit = useMemo(
    () => circuits.find((c) => c.id === circuitId),
    [circuits, circuitId],
  );

  const laneOptions = useMemo(() => {
    const n = selectedCircuit?.num_lanes ?? 4;
    return Array.from({ length: Math.max(1, n) }, (_, i) => String(i + 1));
  }, [selectedCircuit]);

  const fetchBaseline = useCallback(async () => {
    if (!vehicleId || !circuitId) {
      setBaseline(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/vehicles/${vehicleId}/training-baseline`, {
        params: { circuit_id: circuitId, lane },
      });
      setBaseline(data);
    } catch (e) {
      setBaseline(null);
      setError(e.response?.data?.error || 'No se pudo cargar la referencia');
    } finally {
      setLoading(false);
    }
  }, [vehicleId, circuitId, lane]);

  useEffect(() => {
    fetchBaseline();
  }, [fetchBaseline]);

  const targetSeconds =
    baseline?.best_lap_seconds != null
      ? Math.max(0, baseline.best_lap_seconds - DEFAULT_GUIDED_TARGET_MS / 1000)
      : null;

  const redirectUrl = buildAppTimingRedirectUrl({
    vehicleId,
    circuitId: circuitId || undefined,
    lane,
    guided: true,
  });

  if (!isAdmin) return null;

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        asChild
        disabled={!vehicleId || !circuitId}
        title={
          !premiumLoading && !isPremium
            ? 'Entrenamiento guiado con Slot Lap Timer (Premium). Solo administradores.'
            : 'Entrenamiento guiado con Slot Lap Timer. Solo administradores.'
        }
      >
        <Link to={redirectUrl}>
          <Smartphone className="size-3.5 mr-1" />
          Lap Timer
        </Link>
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="size-4" />
          Entrenamiento con Lap Timer
        </CardTitle>
        <p className="text-sm text-muted-foreground font-normal pt-1">
          Función en prueba para administradores. La app aún no está publicada en las tiendas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Circuito</Label>
            <Select value={circuitId || undefined} onValueChange={setCircuitId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona circuito" />
              </SelectTrigger>
              <SelectContent>
                {circuits.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Carril</Label>
            <Select value={lane} onValueChange={setLane}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {laneOptions.map((l) => (
                  <SelectItem key={l} value={l}>
                    Carril {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Cargando referencia…
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-muted-foreground">{error}</p>
        )}

        {!loading && baseline?.best_lap_time && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Mejor vuelta (PB): </span>
              <span className="font-mono font-semibold">{baseline.best_lap_time}</span>
              {baseline.lane_fallback && (
                <span className="text-muted-foreground text-xs ml-2">(sin carril exacto)</span>
              )}
            </p>
            {targetSeconds != null && (
              <p className="text-muted-foreground">
                Objetivo guiado sugerido: bajar {(DEFAULT_GUIDED_TARGET_MS / 1000).toFixed(3)} s
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {baseline.timings_count} sesión(es) de referencia
            </p>
          </div>
        )}

        {!loading && !baseline?.best_lap_time && circuitId && !error && (
          <p className="text-sm text-muted-foreground">
            Sin referencia previa en este circuito/carril. La app usará tu primera sesión como baseline.
          </p>
        )}

        {!premiumLoading && !isPremium && <LapTimerPremiumNotice />}

        <Button asChild disabled={!vehicleId || !circuitId} className="w-full sm:w-auto">
          <Link to={redirectUrl}>
            <Smartphone className="size-4 mr-2" />
            Cronometrar con Lap Timer
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
