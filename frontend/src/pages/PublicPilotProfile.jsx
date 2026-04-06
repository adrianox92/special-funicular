import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trophy, Users, Flag, Car, Zap } from 'lucide-react';
import api from '../lib/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const PublicPilotProfile = () => {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: res } = await api.get(`/public/pilot/${encodeURIComponent(slug)}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'No se pudo cargar el perfil');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (slug) load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Perfil no encontrado'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const title = data.display_name?.trim() || 'Piloto';

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">Perfil público · {data.slug}</p>
      </div>

      {data.vehicles?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Car className="size-5" />
              Vehículos
            </CardTitle>
            <CardDescription>Coches en la colección</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 sm:grid-cols-2">
              {data.vehicles.map((v) => (
                <li key={v.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {v.manufacturer} {v.model}
                  </span>
                  {v.type ? <Badge variant="secondary">{v.type}</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flag className="size-5" />
            Mejores tiempos por circuito
          </CardTitle>
          <CardDescription>Mejor vuelta registrada (todos los vehículos)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.best_times_by_circuit?.length ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Circuito</TableHead>
                    <TableHead>Mejor vuelta</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead>V (V)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.best_times_by_circuit.map((row, i) => (
                    <TableRow key={`${row.circuit_id || row.circuit_name}-${i}`}>
                      <TableCell className="font-medium">{row.circuit_name}</TableCell>
                      <TableCell className="font-mono">{row.best_lap_time}</TableCell>
                      <TableCell className="text-sm">
                        {row.vehicle_manufacturer} {row.vehicle_model}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.timing_date ? new Date(row.timing_date).toLocaleDateString('es-ES') : '—'}
                      </TableCell>
                      <TableCell>
                        {row.session_type ? (
                          <Badge variant="outline">{row.session_type === 'HEAT' ? 'Manga' : 'Entreno'}</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {row.supply_voltage_volts != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Zap className="size-3.5 text-muted-foreground" aria-hidden />
                            {Number(row.supply_voltage_volts).toFixed(2)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay tiempos sincronizados.</p>
          )}
        </CardContent>
      </Card>

      {data.competitions_organized?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="size-5" />
              Competiciones como organizador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.competitions_organized.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                  <span className="font-medium">{c.name}</span>
                  {c.public_slug ? (
                    <Link
                      to={`/competitions/status/${c.public_slug}`}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Ver estado
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.competitions_participated?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="size-5" />
              Participaciones
            </CardTitle>
            <CardDescription>Competiciones en las que has participado</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.competitions_participated.map((p) => (
                <li key={p.competition_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                  <div>
                    <span className="font-medium">{p.competition_name}</span>
                    {p.driver_name ? (
                      <span className="text-muted-foreground text-sm ml-2">({p.driver_name})</span>
                    ) : null}
                  </div>
                  {p.public_slug ? (
                    <Link
                      to={`/competitions/status/${p.public_slug}`}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Ver estado
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PublicPilotProfile;
