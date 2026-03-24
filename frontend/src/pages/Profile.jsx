import React, { useState, useEffect, useCallback } from 'react';
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
import { Key, Copy, RefreshCw, Eye, EyeOff, User, Bell, BellOff, SlidersHorizontal } from 'lucide-react';
import { isPushSupported, urlBase64ToUint8Array } from '../utils/webPush';

const STALE_DAYS_MIN = 1;
const STALE_DAYS_MAX = 365;
const STALE_DAYS_DEFAULT = 60;

const Profile = () => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const [pushSupported] = useState(() => isPushSupported());
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [vapidPublicKey, setVapidPublicKey] = useState(() => process.env.REACT_APP_VAPID_PUBLIC_KEY || null);
  const [pushError, setPushError] = useState(null);
  const [pushSuccess, setPushSuccess] = useState(null);

  const [staleDaysInput, setStaleDaysInput] = useState(String(STALE_DAYS_DEFAULT));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSuccess, setSettingsSuccess] = useState(null);

  useEffect(() => {
    const raw = user?.user_metadata?.stale_days_threshold;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    const d =
      Number.isFinite(n) && !Number.isNaN(n)
        ? Math.min(STALE_DAYS_MAX, Math.max(STALE_DAYS_MIN, Math.round(n)))
        : STALE_DAYS_DEFAULT;
    setStaleDaysInput(String(d));
  }, [user]);

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

  const refreshPushState = useCallback(async () => {
    if (!pushSupported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(!!sub);
      setPushPermission(Notification.permission);
    } catch {
      setPushSubscribed(false);
    }
  }, [pushSupported]);

  useEffect(() => {
    refreshPushState();
  }, [refreshPushState]);

  useEffect(() => {
    if (vapidPublicKey || !pushSupported) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/push/vapid-public-key');
        if (!cancelled && data?.publicKey) {
          setVapidPublicKey(data.publicKey);
        }
      } catch {
        /* sin clave en servidor: el usuario puede definir REACT_APP_VAPID_PUBLIC_KEY */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pushSupported, vapidPublicKey]);

  const handleEnablePush = async () => {
    setPushLoading(true);
    setPushError(null);
    setPushSuccess(null);
    try {
      if (!vapidPublicKey) {
        setPushError('No hay clave VAPID pública. Configura REACT_APP_VAPID_PUBLIC_KEY o VAPID en el backend.');
        return;
      }
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm !== 'granted') {
        setPushError('Permiso de notificaciones denegado.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const json = sub.toJSON();
      await api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: json.keys,
      });
      setPushSubscribed(true);
      setPushSuccess('Notificaciones activadas. Recibirás avisos al batir tu récord vía API de sincronización.');
      setTimeout(() => setPushSuccess(null), 5000);
    } catch (err) {
      setPushError(err.response?.data?.error || err.message || 'Error al activar notificaciones');
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setPushLoading(true);
    setPushError(null);
    setPushSuccess(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await api.delete('/push/unsubscribe', { data: { endpoint } });
      }
      setPushSubscribed(false);
      setPushSuccess('Notificaciones desactivadas en este dispositivo.');
      setTimeout(() => setPushSuccess(null), 4000);
    } catch (err) {
      setPushError(err.response?.data?.error || err.message || 'Error al desactivar notificaciones');
    } finally {
      setPushLoading(false);
    }
  };

  const fetchApiKey = async () => {
    try {
      setError(null);
      const { data } = await api.get('/api-keys/me');
      setApiKey(data.api_key);
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
        <TabsList className="grid w-full max-w-md grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
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
                  onClick={() => (apiKey ? setShowRegenerateConfirm(true) : handleRegenerate())}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <Spinner className="size-4 mr-2" />
                  ) : (
                    <RefreshCw className="size-4 mr-2" />
                  )}
                  {apiKey ? 'Regenerar' : 'Generar API key'}
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

          {pushSupported && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="size-5" />
                  Notificaciones push
                </CardTitle>
                <CardDescription>
                  Avisos cuando sincronices un tiempo desde el cuenta vueltas (API) y mejores tu mejor vuelta en un
                  circuito, o cuando subas posiciones en el ranking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <p className="text-sm text-muted-foreground">
                    Estado:{' '}
                    {pushSubscribed ? (
                      <span className="text-foreground font-medium">activas en este dispositivo</span>
                    ) : (
                      <span className="text-foreground font-medium">inactivas</span>
                    )}
                    {pushPermission === 'denied' && (
                      <span className="block mt-1 text-destructive">
                        El navegador bloqueó las notificaciones; actívalas en la configuración del sitio.
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleEnablePush} disabled={pushLoading || pushPermission === 'denied' || !vapidPublicKey}>
                    {pushLoading ? <Spinner className="size-4 mr-2" /> : <Bell className="size-4 mr-2" />}
                    Activar notificaciones
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDisablePush}
                    disabled={pushLoading || !pushSubscribed}
                  >
                    <BellOff className="size-4 mr-2" />
                    Desactivar en este dispositivo
                  </Button>
                </div>
                {!vapidPublicKey && (
                  <p className="text-xs text-muted-foreground">
                    El servidor debe exponer VAPID (variables <code className="rounded bg-muted px-1">VAPID_PUBLIC_KEY</code> /{' '}
                    <code className="rounded bg-muted px-1">VAPID_PRIVATE_KEY</code>) o define{' '}
                    <code className="rounded bg-muted px-1">REACT_APP_VAPID_PUBLIC_KEY</code> en el frontend.
                  </p>
                )}
                {pushError && (
                  <Alert variant="destructive">
                    <AlertDescription>{pushError}</AlertDescription>
                  </Alert>
                )}
                {pushSuccess && (
                  <Alert>
                    <AlertDescription>{pushSuccess}</AlertDescription>
                  </Alert>
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
