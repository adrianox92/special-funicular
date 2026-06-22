import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Smartphone, RefreshCw, CheckCircle, XCircle, Apple, Bot } from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const PAGE_SIZE = 25;

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function truncateId(id) {
  if (!id) return '—';
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 8)}…` : s;
}

const AdminLapTimerLicensesPage = () => {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get('/admin/lap-timer-licenses', {
        params: { page, limit: PAGE_SIZE },
      });
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al cargar');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const summary = data?.summary;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-7 w-7 text-primary" />
            Licencias Slot Lap Timer
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Datos locales de <code className="rounded bg-muted px-1">user_licenses</code> sincronizados vía webhooks RevenueCat.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Activas</CardDescription>
              <CardTitle className="text-3xl text-green-600">{summary.total_active}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground flex gap-3">
              <span className="flex items-center gap-1"><Apple className="h-3 w-3" /> {summary.ios_active}</span>
              <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> {summary.android_active}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inactivas / reembolsadas</CardDescription>
              <CardTitle className="text-3xl">{summary.total_inactive}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {summary.deactivations_30d} desactivaciones (30 d)
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Activaciones 7 días</CardDescription>
              <CardTitle className="text-3xl">{summary.activations_7d}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Activaciones 30 días</CardDescription>
              <CardTitle className="text-3xl">{summary.activations_30d}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {data?.licenses && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Licencias registradas</CardTitle>
            <CardDescription>
              {data.total} registro{data.total !== 1 ? 's' : ''} · página {page} de {totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>RC App User ID</TableHead>
                  <TableHead>Actualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.licenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay licencias registradas aún.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.licenses.map((lic) => (
                    <TableRow key={lic.id}>
                      <TableCell>
                        {lic.active ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle className="h-3 w-3" /> Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" /> Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{lic.platform}</TableCell>
                      <TableCell className="text-xs font-mono">{lic.product_id}</TableCell>
                      <TableCell className="text-xs font-mono" title={lic.user_id}>
                        {truncateId(lic.user_id)}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[140px] truncate" title={lic.rc_app_user_id}>
                        {truncateId(lic.rc_app_user_id)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(lic.updated_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminLapTimerLicensesPage;
