import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Users, UserCheck, Car, Trophy } from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const PRESETS = [
  { value: '7d', label: 'Últimos 7 días', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: 'Últimos 30 días', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: '90d', label: 'Últimos 90 días (≈ trimestre)', ms: 90 * 24 * 60 * 60 * 1000 },
];

function rollingRange(ms) {
  const to = new Date();
  const from = new Date(to.getTime() - ms);
  return { from, to };
}

/** Rango [from, to) desde fechas YYYY-MM-DD (interpretadas en UTC). */
function customRangeFromInputs(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  if (![fy, fm, fd, ty, tm, td].every((n) => Number.isFinite(n))) return null;
  const from = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0, 0));
  const to = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0, 0));
  return from.getTime() < to.getTime() ? { from, to } : null;
}

function formatRangeLabel(from, to) {
  try {
    const opts = { dateStyle: 'short', timeStyle: 'short' };
    return `${from.toLocaleString('es-ES', opts)} — ${to.toLocaleString('es-ES', opts)}`;
  } catch {
    return '';
  }
}

const AdminPlatformDashboard = () => {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [preset, setPreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(() => {
    if (preset === 'custom') {
      const r = customRangeFromInputs(customFrom, customTo);
      return r;
    }
    const p = PRESETS.find((x) => x.value === preset);
    return p ? rollingRange(p.ms) : rollingRange(PRESETS[0].ms);
  }, [preset, customFrom, customTo]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    if (!range) return;
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/admin/platform-metrics', {
        params: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
      setData(res);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cargar métricas';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (isAdmin && range) void fetchMetrics();
  }, [isAdmin, range, fetchMetrics]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const kpis = [
    {
      key: 'users_created',
      title: 'Usuarios creados',
      value: data?.users_created ?? '—',
      hint: 'Cuentas nuevas registradas en el intervalo.',
      icon: Users,
    },
    {
      key: 'users_active',
      title: 'Usuarios activos',
      value: data?.users_active ?? '—',
      hint: 'Inicios de sesión (last_sign_in_at) en el intervalo.',
      icon: UserCheck,
    },
    {
      key: 'vehicles_in_period',
      title: 'Vehículos creados',
      value: data?.vehicles_in_period ?? '—',
      hint: 'Vehículos añadidos a la colección en el intervalo.',
      icon: Car,
    },
    {
      key: 'competitions_created',
      title: 'Competiciones creadas',
      value: data?.competitions_created ?? '—',
      hint: 'Competiciones con fecha de creación en el intervalo.',
      icon: Trophy,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="size-7" />
            Métricas de plataforma
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo administradores. Intervalo semiabierto [inicio, fin): el fin es exclusivo.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fetchMetrics()}
          disabled={loading || !range}
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Periodo</CardTitle>
          <CardDescription>
            Elige un periodo predefinido o un rango personalizado (fechas en UTC).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label htmlFor="preset-period">Periodo predefinido</Label>
            <Select
              value={preset}
              onValueChange={(v) => {
                setPreset(v);
                if (v === 'custom') {
                  const seed = rollingRange(PRESETS[0].ms);
                  setCustomFrom(seed.from.toISOString().slice(0, 10));
                  setCustomTo(seed.to.toISOString().slice(0, 10));
                }
              }}
            >
              <SelectTrigger id="preset-period">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Personalizado…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-2">
                <Label htmlFor="custom-from">Desde (UTC)</Label>
                <Input
                  id="custom-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-to">Hasta (UTC, día inclusive)</Label>
                <Input
                  id="custom-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}
          {range && (
            <p className="text-xs text-muted-foreground sm:flex-1 sm:min-w-[240px]">
              {formatRangeLabel(range.from, range.to)}
            </p>
          )}
        </CardContent>
      </Card>

      {preset === 'custom' && !range && (
        <Alert>
          <AlertDescription>
            Indica dos fechas válidas: el día final cuenta como inclusive (internamente el fin es el día siguiente 00:00 UTC).
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="size-5" />
          Cargando…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {kpis.map(({ key, title, value, hint, icon: Icon }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{value}</div>
              <p className="text-xs text-muted-foreground mt-2">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vehículos creados por usuario</CardTitle>
          <CardDescription>
            Top 50 usuarios por número de vehículos creados en el intervalo (según fecha de creación del vehículo).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.vehicles_by_user?.length ? (
            <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right w-[120px]">Vehículos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vehicles_by_user.map((row) => (
                    <TableRow key={row.user_id}>
                      <TableCell className="font-mono text-sm">{row.email || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlatformDashboard;
