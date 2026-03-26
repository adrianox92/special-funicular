import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Switch } from '../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Shield, Search, RefreshCw } from 'lucide-react';

const AdminSlotRaceLicenses = () => {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);
  const [toggleSaving, setToggleSaving] = useState(false);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [rowSaving, setRowSaving] = useState({});

  const fetchSubscriptions = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const { data } = await api.get('/license-account/admin/subscriptions');
      setSubscriptions(data.subscriptions ?? []);
    } catch (err) {
      setListError(err.response?.data?.error || err.message || 'Error al cargar');
      setSubscriptions([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchSubscriptions();
  }, [isAdmin, fetchSubscriptions]);

  const handleLookup = async (e) => {
    e?.preventDefault?.();
    const email = lookupEmail.trim();
    if (!email) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const { data } = await api.get('/license-account/admin/lookup', { params: { email } });
      setLookupResult(data);
    } catch (err) {
      setLookupError(err.response?.data?.error || err.message || 'Error');
    } finally {
      setLookupLoading(false);
    }
  };

  const patchPaid = async (targetUserId, isPaid) => {
    await api.patch('/license-account/admin/subscription', {
      target_user_id: targetUserId,
      is_paid: !!isPaid,
    });
  };

  const handleToggleLookup = async (checked) => {
    if (!lookupResult?.user_id) return;
    setToggleSaving(true);
    setLookupError(null);
    try {
      await patchPaid(lookupResult.user_id, checked);
      setLookupResult((prev) => (prev ? { ...prev, is_paid: !!checked } : null));
      await fetchSubscriptions();
    } catch (err) {
      setLookupError(err.response?.data?.error || err.message || 'Error al guardar');
    } finally {
      setToggleSaving(false);
    }
  };

  const handleToggleRow = async (targetUserId, checked) => {
    setRowSaving((s) => ({ ...s, [targetUserId]: true }));
    setListError(null);
    try {
      await patchPaid(targetUserId, checked);
      setSubscriptions((rows) =>
        rows.map((r) => (r.user_id === targetUserId ? { ...r, is_paid: !!checked } : r))
      );
      if (lookupResult?.user_id === targetUserId) {
        setLookupResult((prev) => (prev ? { ...prev, is_paid: !!checked } : null));
      }
    } catch (err) {
      setListError(err.response?.data?.error || err.message || 'Error al guardar');
    } finally {
      setRowSaving((s) => ({ ...s, [targetUserId]: false }));
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="size-7 text-primary" aria-hidden />
          Admin — Licencias Slot Race Manager
        </h1>
        <p className="text-muted-foreground mt-1">
          Marca cuentas como licencia de pago para pruebas. El servidor comprueba tu email frente a{' '}
          <code className="text-xs bg-muted px-1 rounded">LICENSE_ADMIN_EMAILS</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar cliente por email</CardTitle>
          <CardDescription>
            Resuelve la cuenta en Supabase Auth y muestra o crea el estado de suscripción al activar el interruptor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <div className="flex-1 space-y-2">
              <Label htmlFor="admin-lookup-email">Email</Label>
              <Input
                id="admin-lookup-email"
                type="email"
                autoComplete="off"
                placeholder="cliente@ejemplo.com"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={lookupLoading || !lookupEmail.trim()}>
                {lookupLoading ? <Spinner className="size-4 mr-2" /> : <Search className="size-4 mr-2" />}
                Buscar
              </Button>
            </div>
          </form>

          {lookupError && (
            <Alert variant="destructive">
              <AlertDescription>{lookupError}</AlertDescription>
            </Alert>
          )}

          {lookupResult && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Email:</span>{' '}
                <strong>{lookupResult.email}</strong>
              </div>
              <div className="text-xs font-mono break-all text-muted-foreground">
                user_id: {lookupResult.user_id}
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="admin-lookup-paid"
                  checked={!!lookupResult.is_paid}
                  onCheckedChange={handleToggleLookup}
                  disabled={toggleSaving}
                  aria-label="Licencia de pago"
                />
                <Label htmlFor="admin-lookup-paid" className="cursor-pointer">
                  Licencia de pago (Slot Race Manager)
                </Label>
                {toggleSaving && <Spinner className="size-4" />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Suscripciones recientes</CardTitle>
            <CardDescription>Hasta 200 filas de user_subscriptions con email.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={fetchSubscriptions} disabled={listLoading}>
            {listLoading ? <Spinner className="size-4" /> : <RefreshCw className="size-4 mr-1" />}
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {listError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          )}
          {listLoading && subscriptions.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Cargando…
            </div>
          ) : subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay filas en user_subscriptions todavía.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Actualizado</TableHead>
                  <TableHead className="w-[120px]">Pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">{row.email ?? '—'}</TableCell>
                    <TableCell>
                      {row.is_paid ? (
                        <span className="text-green-600 text-sm">Completa</span>
                      ) : (
                        <span className="text-amber-600 text-sm">Prueba</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {row.updated_at ? new Date(row.updated_at).toLocaleString('es-ES') : '—'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!row.is_paid}
                        onCheckedChange={(c) => handleToggleRow(row.user_id, c)}
                        disabled={rowSaving[row.user_id]}
                        aria-label={`Pago ${row.email}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSlotRaceLicenses;
