import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../lib/axios';
import { formatDistance } from '../utils/formatUtils';

const formatTime = (seconds) => {
  if (seconds == null || seconds === 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;
};

const SessionComparisonModal = ({ show, onHide, sessions = [] }) => {
  const [sessionA, setSessionA] = useState(null);
  const [sessionB, setSessionB] = useState(null);
  const [lapsA, setLapsA] = useState([]);
  const [lapsB, setLapsB] = useState([]);
  const [loadingLaps, setLoadingLaps] = useState(false);

  const sortedSessions = [...sessions].sort((a, b) => new Date(b.timing_date) - new Date(a.timing_date));

  useEffect(() => {
    if (!show) {
      setSessionA(null);
      setSessionB(null);
      setLapsA([]);
      setLapsB([]);
      return;
    }
  }, [show]);

  useEffect(() => {
    if (!sessionA?.id || !sessionB?.id) {
      setLapsA([]);
      setLapsB([]);
      return;
    }
    setLoadingLaps(true);
    Promise.all([
      api.get(`/timings/${sessionA.id}/laps`).then((r) => r.data?.laps || []).catch(() => []),
      api.get(`/timings/${sessionB.id}/laps`).then((r) => r.data?.laps || []).catch(() => []),
    ]).then(([a, b]) => {
      setLapsA(a);
      setLapsB(b);
      setLoadingLaps(false);
    });
  }, [sessionA?.id, sessionB?.id]);

  const hasLapComparison = lapsA.length > 0 && lapsB.length > 0;

  const lapChartData = hasLapComparison
    ? Array.from({ length: Math.max(lapsA.length, lapsB.length) }, (_, i) => ({
        lap: i + 1,
        sessionA: lapsA[i] ? parseFloat(lapsA[i].lap_time_seconds) : null,
        sessionB: lapsB[i] ? parseFloat(lapsB[i].lap_time_seconds) : null,
      })).filter((d) => d.sessionA != null || d.sessionB != null)
    : [];

  const comparisonRows = [
    { key: 'best_lap_time', label: 'Mejor vuelta', fmt: (t) => t.best_lap_time },
    { key: 'worst_lap_timestamp', label: 'Peor vuelta', fmt: (t) => formatTime(t.worst_lap_timestamp) },
    { key: 'average_time', label: 'Promedio', fmt: (t) => t.average_time },
    { key: 'total_time', label: 'Tiempo total', fmt: (t) => t.total_time },
    { key: 'laps', label: 'Vueltas', fmt: (t) => t.laps },
    { key: 'total_distance_meters', label: 'Distancia', fmt: (t) => formatDistance(t.total_distance_meters) },
    { key: 'avg_speed_kmh', label: 'Velocidad media (km/h)', fmt: (t) => (t.avg_speed_kmh != null ? Number(t.avg_speed_kmh).toFixed(1) : '—') },
    { key: 'best_lap_speed_kmh', label: 'Velocidad mejor vuelta (km/h)', fmt: (t) => (t.best_lap_speed_kmh != null ? Number(t.best_lap_speed_kmh).toFixed(1) : '—') },
    { key: 'consistency_score', label: 'Consistencia (%)', fmt: (t) => (t.consistency_score != null ? `${Number(t.consistency_score).toFixed(2)}%` : '—') },
  ];

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onHide()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparar sesiones</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Sesión A</label>
              <Select value={sessionA?.id || '__none__'} onValueChange={(v) => setSessionA(sessions.find((s) => s.id === v) || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sesión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {sortedSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {new Date(s.timing_date).toLocaleDateString()} — {s.best_lap_time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Sesión B</label>
              <Select value={sessionB?.id || '__none__'} onValueChange={(v) => setSessionB(sessions.find((s) => s.id === v) || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sesión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {sortedSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {new Date(s.timing_date).toLocaleDateString()} — {s.best_lap_time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sessionA && sessionB && (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Métrica</TableHead>
                      <TableHead>Sesión A ({new Date(sessionA.timing_date).toLocaleDateString()})</TableHead>
                      <TableHead>Sesión B ({new Date(sessionB.timing_date).toLocaleDateString()})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell>{row.fmt(sessionA)}</TableCell>
                        <TableCell>{row.fmt(sessionB)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {loadingLaps && <p className="text-sm text-muted-foreground">Cargando vueltas...</p>}
              {hasLapComparison && lapChartData.length > 0 && (
                <div className="mt-4">
                  <h6 className="font-semibold mb-3">Comparativa vuelta a vuelta</h6>
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <LineChart data={lapChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="lap" />
                        <YAxis tickFormatter={(v) => formatTime(v)} width={70} />
                        <Tooltip formatter={(v) => (v != null ? formatTime(v) : '—')} />
                        <Legend />
                        <Line type="monotone" dataKey="sessionA" stroke="#8884d8" strokeWidth={2} name="Sesión A" dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="sessionB" stroke="#82ca9d" strokeWidth={2} name="Sesión B" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionComparisonModal;
