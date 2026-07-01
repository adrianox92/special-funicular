import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
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
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { SlidersHorizontal, Bell, CircleHelp, KeyRound } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';

const STALE_DAYS_MIN = 1;
const STALE_DAYS_MAX = 365;
const STALE_DAYS_DEFAULT = 60;

/** Bot de notificaciones de tiempos (mismo que TELEGRAM_BOT_TOKEN en el servidor). */
const TELEGRAM_APP_BOT = {
  handle: '@tiempos_slot_bot',
  tMeUrl: 'https://t.me/tiempos_slot_bot',
  webUrl: 'https://web.telegram.org/k/#@tiempos_slot_bot',
};

const VALID_TABS = new Set(['dashboard', 'notifications', 'cuenta']);

const PASSWORD_MIN_LEN = 6;

const SettingsPage = () => {
  const { t } = useTranslation('settings');
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
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [weeklyDigestDay, setWeeklyDigestDay] = useState('1');
  const [digestTestLoading, setDigestTestLoading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(null);

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
    setWeeklyDigestEnabled(user?.user_metadata?.weekly_digest_enabled === true);
    const wd = user?.user_metadata?.weekly_digest_day;
    setWeeklyDigestDay(wd != null && Number.isFinite(Number(wd)) ? String(wd) : '1');
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
          weekly_digest_enabled: weeklyDigestEnabled,
          weekly_digest_day: parseInt(weeklyDigestDay, 10),
        },
      });
      if (error) throw error;
      setNotifSuccess(t('notifications.saved'));
      setTimeout(() => setNotifSuccess(null), 6000);
    } catch (err) {
      setNotifError(err.message || t('notifications.saveError'));
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
      setNotifSuccess(t('notifications.testSent'));
      setTimeout(() => setNotifSuccess(null), 5000);
    } catch (err) {
      setNotifError(err.response?.data?.error || err.message || t('notifications.testError'));
    } finally {
      setNotifTestLoading(false);
    }
  };

  const handleTestDigest = async () => {
    setDigestTestLoading(true);
    setNotifError(null);
    setNotifSuccess(null);
    try {
      await api.post('/cron/weekly-digest/test');
      setNotifSuccess(t('notifications.digestTestSent'));
      setTimeout(() => setNotifSuccess(null), 5000);
    } catch (err) {
      setNotifError(err.response?.data?.error || err.message || t('notifications.digestTestError'));
    } finally {
      setDigestTestLoading(false);
    }
  };

  const handleSaveDashboardSettings = async () => {
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    try {
      const parsed = parseInt(String(staleDaysInput).trim(), 10);
      if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        setSettingsError(t('staleDays.invalidDays'));
        return;
      }
      const clamped = Math.min(STALE_DAYS_MAX, Math.max(STALE_DAYS_MIN, Math.round(parsed)));
      const { error } = await supabase.auth.updateUser({
        data: { stale_days_threshold: clamped },
      });
      if (error) throw error;
      setStaleDaysInput(String(clamped));
      setSettingsSuccess(t('staleDays.savedDetail'));
      setTimeout(() => setSettingsSuccess(null), 5000);
    } catch (err) {
      setSettingsError(err.message || t('staleDays.saveError'));
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

  const handleChangePassword = async () => {
    setPwdSaving(true);
    setPwdError(null);
    setPwdSuccess(null);
    try {
      if (!user) {
        setPwdError(t('account.noSession'));
        return;
      }
      if (newPassword.length < PASSWORD_MIN_LEN) {
        setPwdError(t('account.passwordTooShort', { min: PASSWORD_MIN_LEN }));
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setPwdError(t('account.passwordMismatch'));
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      setNewPassword('');
      setConfirmNewPassword('');
      setPwdSuccess(t('account.passwordUpdated'));
      setTimeout(() => setPwdSuccess(null), 6000);
    } catch (err) {
      setPwdError(err.message || t('account.passwordError'));
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="dashboard">{t('tabs.dashboard')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('tabs.notifications')}</TabsTrigger>
          <TabsTrigger value="cuenta">{t('tabs.account')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('language')}</CardTitle>
              <CardDescription>{t('languageHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSelector variant="outline" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-5" />
                {t('staleDays.title')}
              </CardTitle>
              <CardDescription>
                {t('staleDays.description', { default: STALE_DAYS_DEFAULT, min: STALE_DAYS_MIN, max: STALE_DAYS_MAX })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 max-w-xs">
                <Label htmlFor="stale-days">{t('staleDays.label')}</Label>
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
                  {t('staleDays.hint')}
                </p>
              </div>
              <Button type="button" onClick={handleSaveDashboardSettings} disabled={settingsSaving}>
                {settingsSaving ? <Spinner className="size-4 mr-2" /> : null}
                {t('staleDays.save')}
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
                {t('notifications.title')}
              </CardTitle>
              <CardDescription>
                {t('notifications.cardDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discord-webhook">{t('notifications.discordLabel')}</Label>
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
                  {t('notifications.discordHint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tg-chat">{t('notifications.telegramLabel')}</Label>
                <Input
                  id="tg-chat"
                  className="font-mono text-sm"
                  placeholder="ej. 123456789 o -100..."
                  value={tgChat}
                  onChange={(e) => setTgChat(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  {t('notifications.telegramHint', { botHandle: TELEGRAM_APP_BOT.handle })}
                </p>
              </div>

              <div
                className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm"
                aria-labelledby="telegram-help-heading"
              >
                <h3 id="telegram-help-heading" className="font-semibold flex items-center gap-2 text-base">
                  <CircleHelp className="size-5 shrink-0 text-muted-foreground" />
                  {t('notifications.telegramHelpTitle')}
                </h3>

                <div className="space-y-2">
                  <p className="font-medium text-foreground">{t('notifications.telegramHelp1Title')}</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>
                      {t('notifications.telegramHelp1a', { botHandle: TELEGRAM_APP_BOT.handle })}{' '}
                      <a
                        href={TELEGRAM_APP_BOT.tMeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {t('notifications.telegramOpenApp')}
                      </a>
                      {' · '}
                      <a
                        href={TELEGRAM_APP_BOT.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {t('notifications.telegramOpenWeb')}
                      </a>
                      .
                    </li>
                    <li>{t('notifications.telegramHelp1b')}</li>
                    <li>{t('notifications.telegramHelp1c', { botHandle: TELEGRAM_APP_BOT.handle })}</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-foreground">{t('notifications.telegramHelp2Title')}</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>{t('notifications.telegramHelp2a')}</li>
                    <li>{t('notifications.telegramHelp2b', { botHandle: TELEGRAM_APP_BOT.handle })}</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-foreground">{t('notifications.telegramHelp3Title')}</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>{t('notifications.telegramHelp3a')}</li>
                    <li>{t('notifications.telegramHelp3b', { botHandle: TELEGRAM_APP_BOT.handle })}</li>
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                  {t('notifications.telegramHelpFooter', { botHandle: TELEGRAM_APP_BOT.handle })}
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="weekly-digest">{t('notifications.weeklyDigestLabel')}</Label>
                    <p className="text-xs text-muted-foreground">{t('notifications.weeklyDigestHint')}</p>
                  </div>
                  <Switch
                    id="weekly-digest"
                    checked={weeklyDigestEnabled}
                    onCheckedChange={setWeeklyDigestEnabled}
                  />
                </div>
                {weeklyDigestEnabled && (
                  <div className="space-y-2 max-w-xs">
                    <Label>{t('notifications.weeklyDigestDay')}</Label>
                    <Select value={weeklyDigestDay} onValueChange={setWeeklyDigestDay}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {t(`notifications.weekday.${d}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSaveNotifications} disabled={notifSaving}>
                  {notifSaving ? <Spinner className="size-4 mr-2" /> : null}
                  {t('notifications.save')}
                </Button>
                <Button type="button" variant="secondary" onClick={handleTestNotification} disabled={notifTestLoading}>
                  {notifTestLoading ? <Spinner className="size-4 mr-2" /> : null}
                  {t('notifications.test')}
                </Button>
                <Button type="button" variant="outline" onClick={handleTestDigest} disabled={digestTestLoading}>
                  {digestTestLoading ? <Spinner className="size-4 mr-2" /> : null}
                  {t('notifications.digestTest')}
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

        <TabsContent value="cuenta" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5" />
                {t('account.passwordTitle')}
              </CardTitle>
              <CardDescription>
                {t('account.passwordDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('account.newPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('account.passwordMinHint', { min: PASSWORD_MIN_LEN })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">{t('account.confirmPassword')}</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>
              <Button type="button" onClick={handleChangePassword} disabled={pwdSaving}>
                {pwdSaving ? <Spinner className="size-4 mr-2" /> : null}
                {t('account.savePassword')}
              </Button>
              {pwdError && (
                <Alert variant="destructive">
                  <AlertDescription>{pwdError}</AlertDescription>
                </Alert>
              )}
              {pwdSuccess && (
                <Alert>
                  <AlertDescription>{pwdSuccess}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('account.debugTitle')}</CardTitle>
              <CardDescription>
                {t('account.debugDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link to="/settings/debug-data">{t('account.debugLink')}</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
