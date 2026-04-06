import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Switch } from '../components/ui/switch';
import { Key, Copy, RefreshCw, Eye, EyeOff, User, KeyRound, Globe } from 'lucide-react';
import { isLicenseAdminUser } from '../lib/licenseAdmin';

const Profile = () => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState(null);
  const [keyExists, setKeyExists] = useState(false);
  const [keyMessage, setKeyMessage] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const [licenseInfo, setLicenseInfo] = useState(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState(null);
  const [adminPaidSaving, setAdminPaidSaving] = useState(false);

  const [pilotLoading, setPilotLoading] = useState(true);
  const [pilotSaving, setPilotSaving] = useState(false);
  const [pilotError, setPilotError] = useState(null);
  const [pilotSuccess, setPilotSuccess] = useState(null);
  const [pilotForm, setPilotForm] = useState({ slug: '', display_name: '', enabled: false });

  const isLicenseAdmin = isLicenseAdminUser(user);

  const fetchApiKey = async () => {
    try {
      setError(null);
      const { data } = await api.get('/api-keys/me');
      setApiKey(data.api_key ?? null);
      setKeyExists(!!data.key_exists);
      setKeyMessage(data.message || null);
      setCreatedAt(data.created_at);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al obtener la API key');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKey();
  }, []);

  const fetchPilotProfile = async () => {
    setPilotLoading(true);
    setPilotError(null);
    try {
      const { data } = await api.get('/pilot-profile');
      setPilotForm({
        slug: data.slug || '',
        display_name: data.display_name || '',
        enabled: !!data.enabled,
      });
    } catch (err) {
      setPilotError(err.response?.data?.error || 'Error al cargar el perfil público');
    } finally {
      setPilotLoading(false);
    }
  };

  useEffect(() => {
    fetchPilotProfile();
  }, []);

  const savePilotProfile = async () => {
    setPilotSaving(true);
    setPilotError(null);
    setPilotSuccess(null);
    try {
      const { data } = await api.patch('/pilot-profile', {
        slug: pilotForm.slug.trim() || null,
        display_name: pilotForm.display_name.trim() || null,
        enabled: pilotForm.enabled,
      });
      setPilotForm({
        slug: data.slug || '',
        display_name: data.display_name || '',
        enabled: !!data.enabled,
      });
      setPilotSuccess('Perfil público guardado.');
      setTimeout(() => setPilotSuccess(null), 4000);
    } catch (err) {
      setPilotError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setPilotSaving(false);
    }
  };

  const copyPilotUrl = async () => {
    const s = pilotForm.slug?.trim();
    if (!s || !pilotForm.enabled) return;
    const url = `${window.location.origin}/piloto/${encodeURIComponent(s)}`;
    try {
      await navigator.clipboard.writeText(url);
      setPilotSuccess('Enlace copiado al portapapeles');
      setTimeout(() => setPilotSuccess(null), 3000);
    } catch {
      setPilotError('No se pudo copiar el enlace');
    }
  };

  const fetchLicenseInfo = async () => {
    setLicenseLoading(true);
    setLicenseError(null);
    try {
      const { data } = await api.get('/license-account/me');
      setLicenseInfo(data);
    } catch (err) {
      setLicenseError(err.response?.data?.error || err.message || 'Error al cargar licencia');
      setLicenseInfo(null);
    } finally {
      setLicenseLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchLicenseInfo();
  }, [user?.id]);

  const handleAdminTogglePaid = async (checked) => {
    if (!user?.id) return;
    setAdminPaidSaving(true);
    setLicenseError(null);
    try {
      await api.patch('/license-account/admin/subscription', {
        target_user_id: user.id,
        is_paid: !!checked,
      });
      await fetchLicenseInfo();
    } catch (err) {
      setLicenseError(err.response?.data?.error || err.message || 'Error al actualizar');
    } finally {
      setAdminPaidSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setSuccess('API key copiada al portapapeles');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await api.post('/api-keys/regenerate');
      setApiKey(data.api_key);
      setKeyExists(false);
      setKeyMessage(null);
      setCreatedAt(data.created_at);
      setShowRegenerateConfirm(false);
      setSuccess('API key regenerada correctamente. Guarda la nueva clave de forma segura.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al regenerar la API key');
    } finally {
      setRegenerating(false);
    }
  };

  const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '•'.repeat(key.length);
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Cuenta, API de integración y licencia Slot Race Manager. Las preferencias del dashboard y las notificaciones están en{' '}
          <Link to="/settings" className="text-primary font-medium underline-offset-4 hover:underline">
            Configuración
          </Link>
          .
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="license">
            <KeyRound className="size-4 mr-1 inline" aria-hidden />
            Licencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Información de la cuenta
          </CardTitle>
          <CardDescription>Datos básicos de tu cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <p className="text-base">{user?.email || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Perfil público de piloto
          </CardTitle>
          <CardDescription>
            Página agregada con tus mejores tiempos por circuito e historial de competiciones. Solo se muestra si
            activas la visibilidad y defines un slug único.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pilotLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Cargando…
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Switch
                  id="pilot-enabled"
                  checked={pilotForm.enabled}
                  onCheckedChange={(v) => setPilotForm((prev) => ({ ...prev, enabled: !!v }))}
                  disabled={pilotSaving}
                />
                <Label htmlFor="pilot-enabled" className="cursor-pointer">
                  Mostrar perfil público
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pilot-slug">Slug (URL)</Label>
                <Input
                  id="pilot-slug"
                  placeholder="ej. mi-nick"
                  value={pilotForm.slug}
                  onChange={(e) => setPilotForm((prev) => ({ ...prev, slug: e.target.value }))}
                  disabled={pilotSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Solo minúsculas, números y guiones (3–40 caracteres). URL:{' '}
                  <code className="rounded bg-muted px-1">
                    /piloto/{pilotForm.slug?.trim() || 'tu-slug'}
                  </code>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pilot-display">Nombre para mostrar</Label>
                <Input
                  id="pilot-display"
                  placeholder="Nombre público (opcional)"
                  value={pilotForm.display_name}
                  onChange={(e) => setPilotForm((prev) => ({ ...prev, display_name: e.target.value }))}
                  disabled={pilotSaving}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={savePilotProfile} disabled={pilotSaving}>
                  {pilotSaving ? <Spinner className="size-4 mr-2" /> : null}
                  Guardar
                </Button>
                <Button type="button" variant="outline" onClick={copyPilotUrl} disabled={pilotSaving || !pilotForm.enabled || !pilotForm.slug?.trim()}>
                  <Copy className="size-4 mr-2" />
                  Copiar enlace público
                </Button>
              </div>
              {pilotError && (
                <Alert variant="destructive">
                  <AlertDescription>{pilotError}</AlertDescription>
                </Alert>
              )}
              {pilotSuccess && (
                <Alert>
                  <AlertDescription>{pilotSuccess}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            API Key de integración
          </CardTitle>
          <CardDescription>
            Usa esta clave para conectar tu proyecto de gestión de tiempos con esta aplicación.
            Envía el header <code className="rounded bg-muted px-1 py-0.5 text-xs">X-API-Key</code> en tus peticiones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2">
              <Spinner className="size-4" />
              <span className="text-sm text-muted-foreground">Cargando API key...</span>
            </div>
          ) : (
            <>
              {keyExists && !apiKey && keyMessage && (
                <Alert>
                  <AlertDescription>{keyMessage}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input
                    className="font-mono text-sm pr-8"
                    value={apiKey ? (showKey ? apiKey : maskKey(apiKey)) : '—'}
                    readOnly
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setShowKey(!showKey)}
                      disabled={!apiKey}
                      aria-label={showKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={handleCopy}
                      disabled={!apiKey}
                      aria-label="Copiar"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    apiKey || keyExists ? setShowRegenerateConfirm(true) : handleRegenerate()
                  }
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <Spinner className="size-4 mr-2" />
                  ) : (
                    <RefreshCw className="size-4 mr-2" />
                  )}
                  {apiKey || keyExists ? 'Regenerar' : 'Generar API key'}
                </Button>
              </div>

              {showRegenerateConfirm && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <span className="block mb-2">
                      ¿Regenerar la API key? La clave actual dejará de funcionar de inmediato.
                      Asegúrate de actualizar la clave en tu otro proyecto.
                    </span>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="destructive" onClick={handleRegenerate} disabled={regenerating}>
                        Sí, regenerar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowRegenerateConfirm(false)} disabled={regenerating}>
                        Cancelar
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {createdAt && (
                <p className="text-xs text-muted-foreground">
                  Creada el {new Date(createdAt).toLocaleString('es-ES')}
                </p>
              )}
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <span className="block mb-2">{error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setLoading(true); setError(null); fetchApiKey(); }}
                  className="mt-2"
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="license" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5" />
                Slot Race Manager (DS200)
              </CardTitle>
              <CardDescription>
                Instalaciones registradas de la app de escritorio. Máximo 3 ordenadores por cuenta con licencia. Para
                liberar un dispositivo, contacta con soporte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {licenseLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  Cargando…
                </div>
              )}
              {!licenseLoading && licenseInfo && (
                <>
                  <p className="text-sm">
                    Estado:{' '}
                    <strong className={licenseInfo.is_paid ? 'text-green-600' : 'text-amber-600'}>
                      {licenseInfo.is_paid ? 'Licencia completa' : 'Versión de prueba (solo en la app)'}
                    </strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Instalaciones: {licenseInfo.installations_used ?? 0} / {licenseInfo.installations_max ?? 3}
                  </p>
                  {Array.isArray(licenseInfo.installations) && licenseInfo.installations.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID instalación</TableHead>
                          <TableHead>Registro</TableHead>
                          <TableHead>Última conexión</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {licenseInfo.installations.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs max-w-[12rem] truncate" title={row.installation_id}>
                              {row.installation_id}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.registered_at
                                ? new Date(row.registered_at).toLocaleString('es-ES')
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.last_seen_at
                                ? new Date(row.last_seen_at).toLocaleString('es-ES')
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aún no hay instalaciones registradas.</p>
                  )}
                </>
              )}
              {licenseError && (
                <Alert variant="destructive">
                  <AlertDescription>{licenseError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {isLicenseAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Administración (licencia de pago)</CardTitle>
                <CardDescription>
                  Solo visible si tu email está en <code className="text-xs">LICENSE_ADMIN_EMAILS</code> del servidor y en{' '}
                  <code className="text-xs">REACT_APP_LICENSE_ADMIN_EMAILS</code> del frontend. Para{' '}
                  <Link to="/admin/slot-race-licenses" className="text-primary underline-offset-4 hover:underline font-medium">
                    buscar otras cuentas por email
                  </Link>
                  , usa la página de admin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="admin-paid"
                    checked={!!licenseInfo?.is_paid}
                    onCheckedChange={handleAdminTogglePaid}
                    disabled={adminPaidSaving || !licenseInfo}
                    aria-label="Licencia de pago Slot Race Manager"
                  />
                  <Label htmlFor="admin-paid" className="cursor-pointer">
                    Marcar mi cuenta como licencia de pago (Slot Race Manager)
                  </Label>
                </div>
                {adminPaidSaving && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Spinner className="size-4" /> Guardando…
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
