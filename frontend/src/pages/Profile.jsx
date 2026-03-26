import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { supabase } from '../lib/supabase';
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
import { Key, Copy, RefreshCw, Eye, EyeOff, User, SlidersHorizontal, Bell, CircleHelp, KeyRound } from 'lucide-react';

const STALE_DAYS_MIN = 1;
const STALE_DAYS_MAX = 365;
const STALE_DAYS_DEFAULT = 60;

/** Bot de notificaciones de tiempos (mismo que TELEGRAM_BOT_TOKEN en el servidor). */
const TELEGRAM_APP_BOT = {
  handle: '@tiempos_slot_bot',
  tMeUrl: 'https://t.me/tiempos_slot_bot',
  webUrl: 'https://web.telegram.org/k/#@tiempos_slot_bot',
};

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

  const [staleDaysInput, setStaleDaysInput] = useState(String(STALE_DAYS_DEFAULT));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSuccess, setSettingsSuccess] = useState(null);

  const [discordUrl, setDiscordUrl] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifTestLoading, setNotifTestLoading] = useState(false);
  const [notifError, setNotifError] = useState(null);
  const [notifSuccess, setNotifSuccess] = useState(null);

  const [licenseInfo, setLicenseInfo] = useState(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState(null);
  const [adminPaidSaving, setAdminPaidSaving] = useState(false);

  const licenseAdminEmails = (process.env.REACT_APP_LICENSE_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const isLicenseAdmin =
    user?.email && licenseAdminEmails.includes(String(user.email).toLowerCase());

  useEffect(() => {
    const raw = user?.user_metadata?.stale_days_threshold;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    const d =
      Number.isFinite(n) && !Number.isNaN(n)
        ? Math.min(STALE_DAYS_MAX, Math.max(STALE_DAYS_MIN, Math.round(n)))
        : STALE_DAYS_DEFAULT;
    setStaleDaysInput(String(d));
  }, [user]);

  useEffect(() => {
    setDiscordUrl(String(user?.user_metadata?.webhook_discord_url ?? ''));
    setTgChat(
      user?.user_metadata?.telegram_chat_id != null
        ? String(user.user_metadata.telegram_chat_id)
        : '',
    );
  }, [user]);

  const handleSaveNotifications = async () => {
    setNotifSaving(true);
    setNotifError(null);
    setNotifSuccess(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          webhook_discord_url: discordUrl.trim() || null,
          telegram_chat_id: tgChat.trim() || null,
          telegram_bot_token: null,
        },
      });
      if (error) throw error;
      setNotifSuccess(
        'Notificaciones guardadas. Tras un sync se enviará resumen por Discord (webhook propio) y/o Telegram si el servidor tiene bot configurado y has indicado tu Chat ID.',
      );
      setTimeout(() => setNotifSuccess(null), 6000);
    } catch (err) {
      setNotifError(err.message || 'No se pudo guardar');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setNotifTestLoading(true);
    setNotifError(null);
    setNotifSuccess(null);
    try {
      await api.post('/sync/test-notification');
      setNotifSuccess('Mensaje de prueba enviado (revisa Discord y/o Telegram).');
      setTimeout(() => setNotifSuccess(null), 5000);
    } catch (err) {
      setNotifError(err.response?.data?.error || err.message || 'Error al enviar la prueba');
    } finally {
      setNotifTestLoading(false);
    }
  };

  const handleSaveDashboardSettings = async () => {
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const parsed = parseInt(String(staleDaysInput).trim(), 10);
      if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        setSettingsError('Introduce un número válido de días.');
        return;
      }
      const clamped = Math.min(STALE_DAYS_MAX, Math.max(STALE_DAYS_MIN, Math.round(parsed)));
      const { error } = await supabase.auth.updateUser({
        data: { stale_days_threshold: clamped },
      });
      if (error) throw error;
      setStaleDaysInput(String(clamped));
      setSettingsSuccess('Preferencia guardada. El dashboard usará este umbral en la próxima carga.');
      setTimeout(() => setSettingsSuccess(null), 5000);
    } catch (err) {
      setSettingsError(err.message || 'No se pudo guardar la configuración');
    } finally {
      setSettingsSaving(false);
    }
  };

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
          Cuenta, integración con el cuenta vueltas y preferencias del dashboard
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4 sm:inline-flex sm:w-auto sm:max-w-none">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="license">
            <KeyRound className="size-4 mr-1 inline" aria-hidden />
            Licencia
          </TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
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
                  <code className="text-xs">REACT_APP_LICENSE_ADMIN_EMAILS</code> del frontend.
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

        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-5" />
                Dashboard: circuito habitual
              </CardTitle>
              <CardDescription>
                Número de días sin una sesión en tu circuito más usado para marcar coches como pendientes de
                rodar ahí. Por defecto: {STALE_DAYS_DEFAULT} días. Rango permitido: {STALE_DAYS_MIN}–
                {STALE_DAYS_MAX}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 max-w-xs">
                <Label htmlFor="stale-days">Días sin sesión (umbral)</Label>
                <Input
                  id="stale-days"
                  type="number"
                  min={STALE_DAYS_MIN}
                  max={STALE_DAYS_MAX}
                  step={1}
                  value={staleDaysInput}
                  onChange={(e) => setStaleDaysInput(e.target.value)}
                  aria-describedby="stale-days-hint"
                />
                <p id="stale-days-hint" className="text-xs text-muted-foreground">
                  Tras guardar, recarga el dashboard o vuelve a la página de inicio para ver el bloque
                  “Pendientes y alertas” con el nuevo criterio.
                </p>
              </div>
              <Button type="button" onClick={handleSaveDashboardSettings} disabled={settingsSaving}>
                {settingsSaving ? <Spinner className="size-4 mr-2" /> : null}
                Guardar preferencia
              </Button>
              {settingsError && (
                <Alert variant="destructive">
                  <AlertDescription>{settingsError}</AlertDescription>
                </Alert>
              )}
              {settingsSuccess && (
                <Alert>
                  <AlertDescription>{settingsSuccess}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-5" />
                Discord y Telegram
              </CardTitle>
              <CardDescription>
                Tras cada <code className="rounded bg-muted px-1 py-0.5 text-xs">POST /api/sync/timings</code> se envía un
                resumen (mejor vuelta, delta vs PB, consistencia) si configuras al menos un canal. El webhook de Discord es
                tuyo (se guarda en tu cuenta). Telegram usa un bot común definido por el administrador en el servidor (
                <code className="rounded bg-muted px-1 py-0.5 text-xs">TELEGRAM_BOT_TOKEN</code> en{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">backend/.env</code>); aquí solo indicas tu Chat ID.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discord-webhook">URL del webhook de Discord</Label>
                <Input
                  id="discord-webhook"
                  type="url"
                  className="font-mono text-sm"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Crear en Discord: Ajustes del canal → Integraciones → Webhooks.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tg-chat">Chat ID de Telegram</Label>
                <Input
                  id="tg-chat"
                  className="font-mono text-sm"
                  placeholder="ej. 123456789 o -100..."
                  value={tgChat}
                  onChange={(e) => setTgChat(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  El token del bot lo configura quien despliega la app. Tú: abre {TELEGRAM_APP_BOT.handle}, pulsa Iniciar (o
                  añádelo a un grupo) y pega aquí el chat_id donde quieres los avisos.
                </p>
              </div>

              <div
                className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm"
                aria-labelledby="telegram-help-heading"
              >
                <h3 id="telegram-help-heading" className="font-semibold flex items-center gap-2 text-base">
                  <CircleHelp className="size-5 shrink-0 text-muted-foreground" />
                  Ayuda: conectar con el bot y obtener tu Chat ID
                </h3>

                <div className="space-y-2">
                  <p className="font-medium text-foreground">1. Conectar con el bot de la aplicación</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>
                      Abre el bot{' '}
                      <strong>{TELEGRAM_APP_BOT.handle}</strong>:{' '}
                      <a
                        href={TELEGRAM_APP_BOT.tMeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        abrir en Telegram (móvil / app)
                      </a>
                      {' · '}
                      <a
                        href={TELEGRAM_APP_BOT.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        abrir en Telegram Web
                      </a>
                      .
                    </li>
                    <li>
                      Pulsa <strong>Iniciar</strong> o envía cualquier mensaje al bot. Sin este paso, Telegram no entregará
                      mensajes a tu cuenta.
                    </li>
                    <li>
                      Si quieres avisos en un <strong>grupo</strong>, añade{' '}
                      <strong>{TELEGRAM_APP_BOT.handle}</strong> al grupo (permisos de lectura de mensajes si Telegram lo
                      pide) y escribe algo en el grupo para que exista conversación.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-foreground">2. Saber tu Chat ID (mensajes privados contigo)</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>
                      Escribe a{' '}
                      <a
                        href="https://t.me/userinfobot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        @userinfobot
                      </a>{' '}
                      en Telegram y pulsa <strong>Iniciar</strong>. Te mostrará un <strong>Id</strong> numérico (ej.{' '}
                      <code className="rounded bg-background px-1 py-0.5 text-xs">123456789</code>).
                    </li>
                    <li>
                      En un chat <strong>privado</strong> entre tú y {TELEGRAM_APP_BOT.handle}, ese Id suele ser el mismo
                      que el <strong>Chat ID</strong> que debes pegar aquí arriba.
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-foreground">3. Chat ID de un grupo</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>
                      Los grupos suelen tener un Id <strong>negativo</strong> (ej.{' '}
                      <code className="rounded bg-background px-1 py-0.5 text-xs">-1001234567890</code>). Puedes añadir al
                      grupo un bot como{' '}
                      <a
                        href="https://t.me/getidsbot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        @getidsbot
                      </a>
                      , enviar un mensaje en el grupo y copiar el Id que indique.
                    </li>
                    <li>
                      Asegúrate de que <strong>{TELEGRAM_APP_BOT.handle}</strong> sigue dentro del grupo; si no, no podrá
                      enviar avisos ahí.
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                  Después de guardar tu Chat ID, usa <strong>Probar envío</strong> para comprobar que llega el mensaje. Si
                  falla, revisa que hayas hablado con {TELEGRAM_APP_BOT.handle} y que el servidor tenga{' '}
                  <code className="rounded bg-background px-1 py-0.5 text-[0.7rem]">TELEGRAM_BOT_TOKEN</code> configurado.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSaveNotifications} disabled={notifSaving}>
                  {notifSaving ? <Spinner className="size-4 mr-2" /> : null}
                  Guardar
                </Button>
                <Button type="button" variant="secondary" onClick={handleTestNotification} disabled={notifTestLoading}>
                  {notifTestLoading ? <Spinner className="size-4 mr-2" /> : null}
                  Probar envío
                </Button>
              </div>
              {notifError && (
                <Alert variant="destructive">
                  <AlertDescription>{notifError}</AlertDescription>
                </Alert>
              )}
              {notifSuccess && (
                <Alert>
                  <AlertDescription>{notifSuccess}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
