import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Smartphone,
  RefreshCw,
  CheckCircle,
  XCircle,
  Apple,
  Bot,
  Copy,
  Share2,
  Clock,
  Ticket,
} from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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

function buildShareMessage(code, email) {
  return [
    'Tu código Premium para Slot Lap Timer:',
    code,
    '',
    `Debe canjearse con la cuenta ${email}.`,
    'En la app: Paywall → ¿Tienes un código?',
  ].join('\n');
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

const AdminLapTimerLicensesPage = () => {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [activeTab, setActiveTab] = useState('licenses');

  const [licenseData, setLicenseData] = useState(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState(null);
  const [licensePage, setLicensePage] = useState(1);

  const [promoData, setPromoData] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState(null);
  const [promoPage, setPromoPage] = useState(1);

  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);

  const fetchLicenses = useCallback(async () => {
    setLicenseLoading(true);
    setLicenseError(null);
    try {
      const { data: res } = await api.get('/admin/lap-timer-licenses', {
        params: { page: licensePage, limit: PAGE_SIZE },
      });
      setLicenseData(res);
    } catch (err) {
      setLicenseError(err.response?.data?.error || err.message || 'Error al cargar licencias');
      setLicenseData(null);
    } finally {
      setLicenseLoading(false);
    }
  }, [licensePage]);

  const fetchPromoCodes = useCallback(async () => {
    setPromoLoading(true);
    setPromoError(null);
    try {
      const { data: res } = await api.get('/admin/promo-codes', {
        params: { page: promoPage, limit: PAGE_SIZE },
      });
      setPromoData(res);
    } catch (err) {
      setPromoError(err.response?.data?.error || err.message || 'Error al cargar códigos');
      setPromoData(null);
    } finally {
      setPromoLoading(false);
    }
  }, [promoPage]);

  useEffect(() => {
    if (isAdmin && activeTab === 'licenses') fetchLicenses();
  }, [isAdmin, activeTab, fetchLicenses]);

  useEffect(() => {
    if (isAdmin && activeTab === 'promo') fetchPromoCodes();
  }, [isAdmin, activeTab, fetchPromoCodes]);

  const licenseTotalPages = licenseData
    ? Math.max(1, Math.ceil(licenseData.total / PAGE_SIZE))
    : 1;

  const promoTotalPages = useMemo(
    () => (promoData ? Math.max(1, Math.ceil(promoData.total / PAGE_SIZE)) : 1),
    [promoData],
  );

  const handleRefresh = () => {
    if (activeTab === 'licenses') fetchLicenses();
    else fetchPromoCodes();
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error('Introduce el email del usuario');
      return;
    }

    setGenerating(true);
    try {
      const { data: res } = await api.post('/admin/promo-codes', {
        email: trimmedEmail,
        note: note.trim() || undefined,
      });
      setGenerated(res);
      setEmail('');
      setNote('');
      toast.success('Código generado');
      if (promoPage !== 1) {
        setPromoPage(1);
      } else {
        await fetchPromoCodes();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al generar el código');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await copyText(code);
      toast.success('Código copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleCopyShare = async (code, assignedEmail) => {
    try {
      await copyText(buildShareMessage(code, assignedEmail));
      toast.success('Mensaje copiado para compartir');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleShare = async (code, assignedEmail) => {
    const text = buildShareMessage(code, assignedEmail);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Código Premium Slot Lap Timer', text });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    await handleCopyShare(code, assignedEmail);
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const loading = activeTab === 'licenses' ? licenseLoading : promoLoading;
  const error = activeTab === 'licenses' ? licenseError : promoError;
  const licenseSummary = licenseData?.summary;
  const promoSummary = promoData?.summary;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-7 w-7 text-primary" />
            Slot Lap Timer
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Licencias Premium y códigos promocionales de la app móvil.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="licenses">Licencias</TabsTrigger>
          <TabsTrigger value="promo" className="gap-1.5">
            <Ticket className="h-4 w-4" />
            Códigos promo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="space-y-8 mt-6">
          {licenseLoading && !licenseData && (
            <div className="flex justify-center py-16">
              <Spinner className="h-8 w-8" />
            </div>
          )}

          {licenseSummary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Activas</CardDescription>
                  <CardTitle className="text-3xl text-green-600">{licenseSummary.total_active}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground flex gap-3">
                  <span className="flex items-center gap-1"><Apple className="h-3 w-3" /> {licenseSummary.ios_active}</span>
                  <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> {licenseSummary.android_active}</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Inactivas / reembolsadas</CardDescription>
                  <CardTitle className="text-3xl">{licenseSummary.total_inactive}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {licenseSummary.deactivations_30d} desactivaciones (30 d)
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Activaciones 7 días</CardDescription>
                  <CardTitle className="text-3xl">{licenseSummary.activations_7d}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Activaciones 30 días</CardDescription>
                  <CardTitle className="text-3xl">{licenseSummary.activations_30d}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {licenseData?.licenses && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Licencias registradas</CardTitle>
                <CardDescription>
                  Datos de <code className="rounded bg-muted px-1">user_licenses</code> sincronizados vía webhooks RevenueCat.
                  {' '}{licenseData.total} registro{licenseData.total !== 1 ? 's' : ''} · página {licensePage} de {licenseTotalPages}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>RC App User ID</TableHead>
                      <TableHead>Actualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licenseData.licenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay licencias registradas aún.
                        </TableCell>
                      </TableRow>
                    ) : (
                      licenseData.licenses.map((lic) => (
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
                          <TableCell className="capitalize text-sm">{lic.source || 'iap'}</TableCell>
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

                {licenseTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={licensePage <= 1 || licenseLoading}
                      onClick={() => setLicensePage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {licensePage} / {licenseTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={licensePage >= licenseTotalPages || licenseLoading}
                      onClick={() => setLicensePage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="promo" className="space-y-8 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Generar código</CardTitle>
              <CardDescription>
                El email debe coincidir con la cuenta Slot Database del destinatario. Solo esa persona puede canjearlo en la app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="promo-email">Email del usuario</Label>
                    <Input
                      id="promo-email"
                      type="email"
                      placeholder="usuario@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={generating}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-note">Nota interna (opcional)</Label>
                    <Input
                      id="promo-note"
                      placeholder="Beta tester, amigo del equipo…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={generating}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={generating}>
                  {generating ? <Spinner className="h-4 w-4 mr-2" /> : null}
                  Generar código
                </Button>
              </form>
            </CardContent>
          </Card>

          {generated && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Código generado</CardTitle>
                <CardDescription>
                  Compártelo con <strong>{generated.assigned_email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-background px-4 py-6 text-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Código</p>
                  <p className="text-3xl font-black tracking-[0.2em] font-mono">{generated.code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopyCode(generated.code)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar código
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyShare(generated.code, generated.assigned_email)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar mensaje
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleShare(generated.code, generated.assigned_email)}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartir
                  </Button>
                </div>
                <pre className="rounded-md bg-muted p-3 text-xs whitespace-pre-wrap text-muted-foreground">
                  {buildShareMessage(generated.code, generated.assigned_email)}
                </pre>
              </CardContent>
            </Card>
          )}

          {promoSummary && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pendientes de canje</CardDescription>
                  <CardTitle className="text-3xl flex items-center gap-2">
                    <Clock className="h-6 w-6 text-amber-500" />
                    {promoSummary.pending}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Canjeados</CardDescription>
                  <CardTitle className="text-3xl flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    {promoSummary.redeemed}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {promoLoading && !promoData ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Historial de códigos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead>Canjeado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(promoData?.codes ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No hay códigos generados todavía.
                        </TableCell>
                      </TableRow>
                    ) : (
                      promoData.codes.map((row) => {
                        const redeemed = Boolean(row.redeemed_by_user_id);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono font-semibold tracking-wide">
                              {row.code}
                            </TableCell>
                            <TableCell>{row.assigned_email}</TableCell>
                            <TableCell>
                              {redeemed ? (
                                <Badge variant="default" className="bg-green-600">Canjeado</Badge>
                              ) : (
                                <Badge variant="secondary">Pendiente</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-muted-foreground">
                              {row.note || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(row.created_at)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(row.redeemed_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Copiar código"
                                  onClick={() => handleCopyCode(row.code)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                {!redeemed && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Compartir"
                                    onClick={() => handleShare(row.code, row.assigned_email)}
                                  >
                                    <Share2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                {promoData && promoData.total > PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {promoPage} de {promoTotalPages} · {promoData.total} códigos
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={promoPage <= 1 || promoLoading}
                        onClick={() => setPromoPage((p) => p - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={promoPage >= promoTotalPages || promoLoading}
                        onClick={() => setPromoPage((p) => p + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLapTimerLicensesPage;
