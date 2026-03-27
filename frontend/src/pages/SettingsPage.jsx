import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { SlidersHorizontal, Bell, CircleHelp } from 'lucide-react';

const STALE_DAYS_MIN = 1;
const STALE_DAYS_MAX = 365;
const STALE_DAYS_DEFAULT = 60;

/** Bot de notificaciones de tiempos (mismo que TELEGRAM_BOT_TOKEN en el servidor). */
const TELEGRAM_APP_BOT = {
  handle: '@tiempos_slot_bot',
  tMeUrl: 'https://t.me/tiempos_slot_bot',
  webUrl: 'https://web.telegram.org/k/#@tiempos_slot_bot',
};

const VALID_TABS = new Set(['dashboard', 'notifications']);

const SettingsPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = searchParams.get('tab');
  const activeTab = VALID_TABS.has(tabFromUrl) ? tabFromUrl : 'dashboard';

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

  const handleTabChange = (value) => {
    if (value === 'dashboard') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: value }, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Preferencias del dashboard y notificaciones (Discord y Telegram)
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6 space-y-6">
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

export default SettingsPage;
