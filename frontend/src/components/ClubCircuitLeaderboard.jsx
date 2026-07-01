import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trophy } from 'lucide-react';
import axios from '../lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { VEHICLE_TYPES } from '../data/vehicleTypes';

/**
 * Leaderboard multi-usuario para un circuito de club.
 * @param {{ clubId?: string, circuitId?: string, circuits?: array, publicSlug?: string }} props
 *   Si publicSlug está definido, usa endpoints públicos (sin auth).
 */
const ClubCircuitLeaderboard = ({ clubId, circuitId, circuits = [], publicSlug }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lane, setLane] = useState('all');
  const [period, setPeriod] = useState('all');
  const [vehicleType, setVehicleType] = useState('all');

  const selectedCircuit = useMemo(
    () => circuits.find((c) => c.id === circuitId) || data?.circuit,
    [circuits, circuitId, data?.circuit],
  );

  const laneOptions = useMemo(() => {
    const n = selectedCircuit?.num_lanes || 2;
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }, [selectedCircuit?.num_lanes]);

  const load = useCallback(async () => {
    if (!circuitId) return;
    try {
      setLoading(true);
      const params = {};
      if (lane !== 'all') params.lane = lane;
      if (period !== 'all') params.period = period;
      if (vehicleType !== 'all') params.vehicle_type = vehicleType;

      let res;
      if (publicSlug) {
        res = await axios.get(
          `/public/clubs/by-slug/${encodeURIComponent(publicSlug)}/circuits/${circuitId}/leaderboard`,
          { params },
        );
      } else if (clubId) {
        res = await axios.get(`/clubs/${clubId}/circuits/${circuitId}/leaderboard`, { params });
      } else {
        return;
      }
      setData(res.data);
    } catch (e) {
      console.error(e);
      setData({ entries: [], circuit: selectedCircuit });
    } finally {
      setLoading(false);
    }
  }, [clubId, circuitId, lane, period, vehicleType, publicSlug, selectedCircuit]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = data?.entries || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="size-4" />
          Leaderboard
          {selectedCircuit?.name ? (
            <span className="text-muted-foreground font-normal">— {selectedCircuit.name}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={lane} onValueChange={setLane}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Carril" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los carriles</SelectItem>
              {laneOptions.map((l) => (
                <SelectItem key={l} value={l}>
                  Carril {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Histórico</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="season">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo de coche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay tiempos registrados en este circuito con los filtros seleccionados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Piloto</TableHead>
                <TableHead>Mejor vuelta</TableHead>
                <TableHead>Carril</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vehículo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell>
                    <Badge variant={row.rank <= 3 ? 'default' : 'outline'}>{row.rank}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.pilot_slug ? (
                      <Link to={`/pilot/${row.pilot_slug}`} className="hover:underline">
                        {row.display_name || 'Piloto'}
                      </Link>
                    ) : (
                      row.display_name || `Piloto ${String(row.user_id).slice(0, 8)}…`
                    )}
                  </TableCell>
                  <TableCell className="font-mono">{row.best_lap_time}</TableCell>
                  <TableCell>{row.lane || '—'}</TableCell>
                  <TableCell>{row.timing_date || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{row.vehicle_model || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ClubCircuitLeaderboard;
